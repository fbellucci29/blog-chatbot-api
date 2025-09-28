// api/auth/login.js
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcrypt";

// Database connection
const sql = neon(process.env.DATABASE_URL);

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e password richiesti' });
    }

    // Trova utente per email
    const users = await sql`
      SELECT id, email, password, name, questions_used, questions_limit 
      FROM users 
      WHERE email = ${email} 
      LIMIT 1
    `;

    if (users.length === 0) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    const user = users[0];

    // Verifica password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

    // Risposta successo
    res.json({ 
      id: user.id, 
      email: user.email, 
      name: user.name,
      questionsUsed: user.questions_used,
      questionsLimit: user.questions_limit
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Errore durante il login' });
  }
}
