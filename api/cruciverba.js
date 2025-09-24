import Anthropic from 'anthropic';
import { checkUserLimits, incrementUserRequests, getCourseContent } from '../lib/supabase.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CRUCIVERBA_PROMPT = `Sei un creatore esperto di cruciverba educativi specializzato in sicurezza sul lavoro e normative italiane.

OBIETTIVO: Creare cruciverba didattici basati sui contenuti specifici del modulo fornito.

REGOLE CRUCIVERBA:
- Esattamente 10 parole chiave dal modulo
- IMPORTANTE: Le risposte devono essere SEMPRE UNA SOLA PAROLA (no spazi, no trattini)
- Lunghezza parole: minimo 4, massimo 12 lettere
- Definizioni chiare e precise che portano a UNA parola specifica
- Riferimenti normativi quando possibile
- Livello comprensibile per lavoratori/dirigenti

FORMATO OUTPUT (JSON):
{
  "titolo": "Cruciverba: [Nome Modulo]",
  "istruzioni": "Completa il cruciverba con i termini di sicurezza sul lavoro",
  "parole": [
    {
      "numero": 1,
      "direzione": "orizzontale",
      "parola": "ANTINFORTUNISTICA",
      "definizione": "Disciplina che previene gli incidenti sul lavoro (art. 2 D.Lgs 81/08)",
      "lunghezza": 17
    }
  ],
  "soluzioni": ["ANTINFORTUNISTICA", "DPI", "RSPP", ...]
}

ESEMPI CORRETTI:
✅ "DPI" - Dispositivi di Protezione Individuale
✅ "RSPP" - Responsabile del Servizio Prevenzione e Protezione  
✅ "ELMETTO" - Dispositivo che protegge la testa
✅ "PREPOSTO" - Figura che sovrintende ai lavoratori

ESEMPI SBAGLIATI:
❌ "DISPOSITIVI DPI" (più parole)
❌ "ANTI-INFORTUNISTICA" (con trattino)
❌ "PRIMO SOCCORSO" (due parole)

FOCUS: Solo contenuti del modulo fornito, una parola per risposta.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIdentifier, courseId, moduleId } = req.body;

    if (!userIdentifier || !courseId || !moduleId) {
      return res.status(400).json({ 
        error: 'userIdentifier, courseId e moduleId sono richiesti' 
      });
    }

    // Controlla limiti utente
    const limits = await checkUserLimits(userIdentifier);
    
    if (!limits.allowed) {
      return res.status(429).json({ 
        error: 'Limite giornaliero raggiunto',
        message: 'Hai raggiunto il limite di richieste per oggi. Riprova domani.'
      });
    }

    // Ottieni contenuti del modulo
    const courseData = await getCourseContent(courseId, moduleId);
    
    if (!courseData.success) {
      return res.status(404).json({ 
        error: 'Modulo non trovato',
        details: courseData.error
      });
    }

    // Genera cruciverba
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      temperature: 0.7,
      system: CRUCIVERBA_PROMPT,
      messages: [
        {
          role: "user",
          content: `Crea un cruciverba educativo basato sui seguenti contenuti del modulo:

TITOLO MODULO: ${courseData.title}
DESCRIZIONE: ${courseData.description}

CONTENUTI:
${courseData.content}

Genera SOLO parole e concetti presenti in questi contenuti. Rispondi SOLO con un JSON valido senza testo aggiuntivo.`
        }
      ]
    });

    let claudeResponse = response.content[0].text;
    
    // Pulisci la risposta per ottenere solo JSON
    claudeResponse = claudeResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Prova a parsare il JSON
    let cruciverba;
    try {
      cruciverba = JSON.parse(claudeResponse);
    } catch (parseError) {
      console.error('Errore parsing JSON:', parseError);
      return res.status(500).json({ 
        error: 'Errore nella generazione del cruciverba',
        details: 'Formato risposta non valido'
      });
    }

    // Incrementa il contatore
    await incrementUserRequests(userIdentifier);

    return res.status(200).json({
      cruciverba,
      moduleTitle: courseData.title,
      success: true,
      usage: {
        remaining: limits.remaining - 1,
        limit: limits.limit
      }
    });

  } catch (error) {
    console.error('Errore API cruciverba:', error);
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Servizio temporaneamente sovraccarico',
        message: 'Riprova tra qualche minuto'
      });
    }

    return res.status(500).json({ 
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
