// api/chat.js
import Anthropic from '@anthropic-ai/sdk';
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "crypto";

// Database connection
const sql = neon(process.env.DATABASE_URL);

// Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { content, sessionId, userId } = req.body;

    if (!content || !userId) {
      return res.status(400).json({ message: 'Content e userId richiesti' });
    }

    // Verifica utente e limiti
    const users = await sql`
      SELECT id, questions_used, questions_limit 
      FROM users 
      WHERE id = ${userId} 
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(404).json({ message: 'Utente non trovato' });
    }

    const user = users[0];

    if (user.questions_used >= user.questions_limit) {
      return res.status(403).json({ 
        message: 'Limite domande raggiunto. Aggiorna il tuo piano per continuare.',
        questionsUsed: user.questions_used,
        questionsLimit: user.questions_limit
      });
    }

    // Crea sessione se non esiste
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = randomUUID();
      await sql`
        INSERT INTO chat_sessions (id, user_id, title, created_at)
        VALUES (${currentSessionId}, ${userId}, ${content.substring(0, 50) + '...'}, NOW())
      `;
    }

    // Aggiungi messaggio utente
    await sql`
      INSERT INTO chat_messages (id, session_id, user_id, role, content, created_at)
      VALUES (${randomUUID()}, ${currentSessionId}, ${userId}, 'user', ${content}, NOW())
    `;

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
    await sql`
      INSERT INTO chat_messages (id, session_id, user_id, role, content, created_at)
      VALUES (${randomUUID()}, ${currentSessionId}, ${userId}, 'assistant', ${aiResponse}, NOW())
    `;

    // Aggiorna contatore domande
    await sql`
      UPDATE users 
      SET questions_used = questions_used + 1 
      WHERE id = ${userId}
    `;

    res.json({
      sessionId: currentSessionId,
      response: aiResponse,
      questionsUsed: user.questions_used + 1,
      questionsLimit: user.questions_limit
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ message: 'Errore durante la chat' });
  }
}
