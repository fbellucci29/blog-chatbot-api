import { checkUserLimits } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Gestisci CORS per richieste OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIdentifier } = req.body;

    if (!userIdentifier) {
      return res.status(400).json({ 
        error: 'User identifier è richiesto' 
      });
    }

    // Controlla i limiti dell'utente
    const limits = await checkUserLimits(userIdentifier);

    if (limits.error) {
      return res.status(500).json({ 
        error: 'Errore controllo database',
        details: limits.error
      });
    }

    return res.status(200).json({
      allowed: limits.allowed,
      remaining: limits.remaining,
      currentCount: limits.currentCount,
      limit: limits.limit,
      message: limits.allowed 
        ? `Richieste rimanenti: ${limits.remaining}` 
        : 'Limite giornaliero raggiunto. Riprova domani.'
    });

  } catch (error) {
    console.error('Errore API check-limits:', error);
    return res.status(500).json({ 
      error: 'Errore interno del server',
      details: error.message
    });
  }
}
