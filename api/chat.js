import Anthropic from 'anthropic';
import { saveFirstQuestion, incrementUserCount } from '../lib/supabase.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Sei un assistente esperto di sicurezza sul lavoro specializzato nella normativa italiana.

NORMATIVE DI RIFERIMENTO:
- D.Lgs 81/2008 (Testo Unico) con aggiornamenti 2025
- Accordo Stato-Regioni 17 aprile 2025 (formazione)
- D.Lgs 231/2001 (responsabilità amministrativa)

APPROCCIO:
- Spiega in termini semplici come a un imprenditore
- Fornisci esempi pratici e riferimenti normativi
- Sii diretto e actionable
- Evidenzia responsabilità penali quando rilevanti

Se la domanda non riguarda sicurezza lavoro, reindirizza gentilmente.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId, email, type } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message richiesto' });
    }

    // Chiamata a Claude
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message }]
    });

    const claudeResponse = response.content[0].text;

    // Salva la richiesta nel database
    if (type === 'anonymous') {
      await saveFirstQuestion(sessionId, message);
    } else if (type === 'registered' && email) {
      await incrementUserCount(email, message);
    }

    return res.json({
      response: claudeResponse,
      success: true
    });

  } catch (error) {
    console.error('Errore chat:', error);
    return res.status(500).json({ 
      error: 'Errore interno',
      message: 'Riprova tra poco'
    });
  }
}
