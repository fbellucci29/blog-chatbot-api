import { checkUserLimits, checkFirstQuestion } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, email, type } = req.body;

    if (type === 'anonymous') {
      const hasAsked = await checkFirstQuestion(sessionId);
      return res.json({
        canAsk: !hasAsked,
        needsRegistration: hasAsked,
        message: hasAsked ? 'Devi registrarti per continuare' : 'Puoi fare una domanda gratis'
      });
    }

    if (type === 'registered' && email) {
      const limits = await checkUserLimits(email);
      return res.json({
        canAsk: limits.allowed,
        remaining: limits.remaining,
        current: limits.current,
        message: limits.allowed ? `${limits.remaining} domande rimaste oggi` : 'Limite giornaliero raggiunto'
      });
    }

    return res.status(400).json({ error: 'Parametri mancanti' });

  } catch (error) {
    return res.status(500).json({ error: 'Errore database' });
  }
}
