import Anthropic from 'anthropic';
import { checkUserLimits, incrementUserRequests, getCourseContent } from '../lib/supabase.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const QUIZ_PROMPT = `Sei un esperto creatore di quiz educativi per la sicurezza sul lavoro e normative italiane.

OBIETTIVO: Creare quiz a scelta multipla basati sui contenuti specifici del modulo fornito.

REGOLE QUIZ:
- Esattamente 5 domande dal modulo
- Ogni domanda ha 4 opzioni di risposta (A, B, C, D)
- Solo 1 risposta corretta per domanda
- Domande pratiche e applicative
- Riferimenti normativi quando possibile
- Livello professionale per lavoratori/dirigenti

FORMATO OUTPUT (JSON):
{
  "titolo": "Quiz: [Nome Modulo]",
  "istruzioni": "Scegli la risposta corretta per ogni domanda",
  "domande": [
    {
      "numero": 1,
      "domanda": "Qual è la principale responsabilità del dirigente nella gestione dei DPI?",
      "opzioni": {
        "A": "Acquistare i DPI più economici",
        "B": "Verificare che i lavoratori utilizzino correttamente i DPI forniti",
        "C": "Sostituire tutti i DPI ogni mese",
        "D": "Permettere ai lavoratori di scegliere i propri DPI"
      },
      "risposta_corretta": "B",
      "spiegazione": "Secondo l'art. 18 del D.Lgs 81/08, il dirigente deve verificare l'utilizzo dei DPI da parte dei lavoratori."
    }
  ],
  "punteggio": {
    "domande_totali": 5,
    "punteggio_massimo": 100,
    "sufficienza": 60
  }
}

CARATTERISTICHE DOMANDE:
- Situazioni pratiche reali
- Casi aziendali concreti
- Responsabilità specifiche
- Procedure operative
- Normativa applicata

EVITA:
- Domande troppo teoriche
- Date o numeri di articoli specifici
- Termini troppo tecnici senza contesto
- Opzioni di risposta ovviamente sbagliate

FOCUS: Solo contenuti del modulo fornito, domande applicative.`;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userIdentifier, courseId, moduleId, numDomande = 5 } = req.body;

    if (!userIdentifier || !courseId || !moduleId) {
      return res.status(400).json({ 
        error: 'userIdentifier, courseId e moduleId sono richiesti' 
      });
    }

    // Validazione numero domande
    if (numDomande < 3 || numDomande > 10) {
      return res.status(400).json({ 
        error: 'Il numero di domande deve essere tra 3 e 10' 
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

    // Genera quiz
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      temperature: 0.7,
      system: QUIZ_PROMPT,
      messages: [
        {
          role: "user",
          content: `Crea un quiz a scelta multipla con ${numDomande} domande basato sui seguenti contenuti del modulo:

TITOLO MODULO: ${courseData.title}
DESCRIZIONE: ${courseData.description}

CONTENUTI:
${courseData.content}

Genera SOLO domande e concetti presenti in questi contenuti. Crea domande pratiche e applicative che testino la comprensione reale, non la memorizzazione.

Rispondi SOLO con un JSON valido senza testo aggiuntivo.`
        }
      ]
    });

    let claudeResponse = response.content[0].text;
    
    // Pulisci la risposta per ottenere solo JSON
    claudeResponse = claudeResponse.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    // Prova a parsare il JSON
    let quiz;
    try {
      quiz = JSON.parse(claudeResponse);
    } catch (parseError) {
      console.error('Errore parsing JSON:', parseError);
      return res.status(500).json({ 
        error: 'Errore nella generazione del quiz',
        details: 'Formato risposta non valido'
      });
    }

    // Validazione struttura quiz
    if (!quiz.domande || !Array.isArray(quiz.domande) || quiz.domande.length === 0) {
      return res.status(500).json({ 
        error: 'Errore nella generazione del quiz',
        details: 'Struttura quiz non valida'
      });
    }

    // Incrementa il contatore
    await incrementUserRequests(userIdentifier);

    return res.status(200).json({
      quiz,
      moduleTitle: courseData.title,
      success: true,
      usage: {
        remaining: limits.remaining - 1,
        limit: limits.limit
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        courseId,
        moduleId,
        numDomande: quiz.domande.length
      }
    });

  } catch (error) {
    console.error('Errore API quiz:', error);
    
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
