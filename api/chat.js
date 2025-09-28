import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const SYSTEM_PROMPT = `Sei un assistente esperto di sicurezza sul lavoro specializzato nella normativa italiana completa.

NORMATIVE DI RIFERIMENTO:
- D.Lgs 81/2008 (Testo Unico) con aggiornamenti 2025
- Accordo Stato-Regioni 17 aprile 2025 (formazione)
- D.Lgs 231/2001 (responsabilità amministrativa)
- Codice Penale artt. 589-590 (responsabilità dirigenti)

COMPETENZE SPECIFICHE:
- DPI obbligatori per settore
- Formazione e aggiornamenti 2025
- Procedure emergenza e infortuni
- Responsabilità dirigenti e preposti
- Sanzioni amministrative e penali

APPROCCIO:
- Cita sempre la norma specifica
- Distingui obblighi dirigenti vs preposti vs lavoratori
- Evidenzia responsabilità penali quando rilevanti
- Linguaggio tecnico ma comprensibile
- Esempi pratici e soluzioni immediate

Se la domanda non riguarda sicurezza lavoro, reindirizza: "Mi specializzo in sicurezza sul lavoro e normative correlate. Puoi riformulare su questo tema?"`;

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, sessionId, email, isRegistered } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message richiesto' });
    }

    // Controlla limiti
    if (!isRegistered) {
      // Per utenti anonimi - verifica se è la prima domanda
      const { data: session } = await supabase
        .from('anonymous_sessions')
        .select('first_question_asked')
        .eq('session_id', sessionId)
        .single();

      if (session?.first_question_asked) {
        return res.status(429).json({ 
          error: 'Devi registrarti per continuare',
          needsRegistration: true
        });
      }

      // Salva che ha fatto la prima domanda
      await supabase
        .from('anonymous_sessions')
        .upsert({
          session_id: sessionId,
          first_question_asked: true,
          created_at: new Date().toISOString()
        });

    } else {
      // Per utenti registrati - verifica limite giornaliero
      const today = new Date().toISOString().split('T')[0];
      
      const { data: limits } = await supabase
        .from('daily_limits')
        .select('question_count')
        .eq('user_identifier', email)
        .eq('date', today)
        .single();

      const currentCount = limits?.question_count || 0;
      
      if (currentCount >= 5) {
        return res.status(429).json({ 
          error: 'Limite giornaliero raggiunto (5 domande)',
          remaining: 0
        });
      }

      // Incrementa contatore
      await supabase
        .from('daily_limits')
        .upsert({
          user_identifier: email,
          date: today,
          question_count: currentCount + 1,
          user_type: 'registered'
        });
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
    await supabase
      .from('user_requests')
      .insert({
        user_identifier: isRegistered ? email : sessionId,
        session_id: sessionId,
        question: message,
        response: claudeResponse,
        user_type: isRegistered ? 'registered' : 'anonymous',
        is_first_question: !isRegistered
      });

    return res.json({
      response: claudeResponse,
      success: true
    });

  } catch (error) {
    console.error('Errore chat:', error);
    return res.status(500).json({ 
      error: 'Errore interno del server'
    });
  }
}
