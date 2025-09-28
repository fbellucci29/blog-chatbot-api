// api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, sql as sqlOp } from "drizzle-orm";
import { randomUUID } from "crypto";

// Database connection
const neonSql = neon(process.env.DATABASE_URL!, {
  fullResults: true,
  fetchOptions: {
    cache: 'no-store',
  }
});
const db = drizzle(neonSql);

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SAFETY_SYSTEM_PROMPT = `Sei un esperto consulente per la sicurezza sul lavoro specializzato nel D.Lgs 81/2008 (Testo Unico sulla Sicurezza sul Lavoro) italiano. 

Le tue responsabilità includono:
- Fornire consulenza accurata e aggiornata sulla normativa italiana in materia di sicurezza sul lavoro
- Interpretare correttamente gli articoli del D.Lgs 81/2008 e relative modifiche
- Suggerire procedure di sicurezza conformi alla legge italiana
- Assistere nella valutazione dei rischi e nella redazione di DVR (Documento di Valutazione dei Rischi)
- Fornire informazioni su DPI (Dispositivi di Protezione Individuale) e DPC (Dispositivi di Protezione Collettiva)
- Guidare nella pianificazione della formazione obbligatoria per lavoratori
- Spiegare ruoli e responsabilità di datori di lavoro, RSPP, RLS, medici competenti

Rispondi sempre in italiano, in modo chiaro e professionale. Cita sempre gli articoli specifici del D.Lgs 81/2008 quando pertinenti. Se una domanda esula dalla sicurezza sul lavoro, indirizza gentilmente l'utente verso argomenti pertinenti.`;

// Tabelle (dovrai definirle come nel tuo schema)
const users = {
  id: "id",
  questionsUsed: "questions_used",
  questionsLimit: "questions_limit"
};

const chatSessions = {
  id: "id",
  userId: "user_id",
  title: "title",
  createdAt: "created_at"
};

const chatMessages = {
  id: "id",
  sessionId: "session_id",
  userId: "user_id", 
  role: "role",
  content: "content",
  createdAt: "created_at"
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { content, sessionId, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ message: 'Content e userId richiesti' });
    }

    // Verifica utente e limiti
    const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const user = userResult[0];

    if (!user) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    if (user.questionsUsed >= user.questionsLimit) {
      return res.status(403).json({ 
        message: 'Limite domande raggiunto. Aggiorna il tuo piano per continuare.',
        questionsUsed: user.questionsUsed,
        questionsLimit: user.questionsLimit
      });
    }

    // Crea sessione se non esiste
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const newSessionId = randomUUID();
      await db.insert(chatSessions).values({
        id: newSessionId,
        userId: userId,
        title: content.substring(0, 50) + '...',
        createdAt: new Date()
      });
      currentSessionId = newSessionId;
    }

    // Aggiungi messaggio utente
    await db.insert(chatMessages).values({
      id: randomUUID(),
      sessionId: currentSessionId,
      userId: userId,
      role: 'user',
      content: content,
      createdAt: new Date()
    });

    // Ottieni risposta AI
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      system: SAFETY_SYSTEM_PROMPT,
      max_tokens: 2048,
      messages: [
        { role: 'user', content: content }
      ],
    });

    const aiResponse = response.content[0].type === 'text' ? response.content[0].text : '';

    // Aggiungi risposta AI
    await db.insert(chatMessages).values({
      id: randomUUID(),
      sessionId: currentSessionId,
      userId: userId,
      role: 'assistant',
      content: aiResponse,
      createdAt: new Date()
    });

    // Aggiorna contatore domande
    await db.update(users)
      .set({ questionsUsed: sqlOp`questions_used + 1` })
      .where(eq(users.id, userId));

    res.json({
      sessionId: currentSessionId,
      response: aiResponse,
      questionsUsed: user.questionsUsed + 1,
      questionsLimit: user.questionsLimit
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Errore durante la chat' });
  }
}
