import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nome e email richiesti' });
    }

    // Verifica se email esiste già
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email già registrata' });
    }

    // Registra nuovo utente
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        name: name,
        email: email,
        registration_date: new Date().toISOString(),
        is_active: true,
        total_questions: 0
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      success: true,
      message: 'Registrazione completata',
      user: {
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Errore registrazione:', error);
    return res.status(500).json({ 
      error: 'Errore interno del server'
    });
  }
}
