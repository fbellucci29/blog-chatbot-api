// api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Schema types (copia dal tuo schema.ts)
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  questionsUsed: number;
  questionsLimit: number;
  isActive: boolean;
  createdAt: Date;
}

// Database connection
const neonSql = neon(process.env.DATABASE_URL!, {
  fullResults: true,
  fetchOptions: {
    cache: 'no-store',
  }
});
const db = drizzle(neonSql);

// Importa la definizione delle tabelle (dovrai creare un file separato)
const users = {
  id: "id",
  email: "email", 
  password: "password",
  name: "name",
  role: "role",
  questionsUsed: "questions_used",
  questionsLimit: "questions_limit",
  isActive: "is_active",
  createdAt: "created_at"
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email e password richiesti' });
    }

    // Trova utente per email
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = result[0] as User;

    if (!user) {
      return res.status(401).json({ message: 'Credenziali non valide' });
    }

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
      questionsUsed: user.questionsUsed,
      questionsLimit: user.questionsLimit
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Errore durante il login' });
  }
}
