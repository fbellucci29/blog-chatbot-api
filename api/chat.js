import Anthropic from 'anthropic';
import { checkUserLimits, incrementUserRequests, getCourseContent } from '../lib/supabase.js';

// Inizializza client Claude
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Prompt di sistema per il chatbot (il tuo prompt attuale)
const SYSTEM_PROMPT = `Sei un assistente esperto di sicurezza sul lavoro specializzato nella normativa italiana completa.

NORMATIVE DI RIFERIMENTO:
- D.Lgs 81/2008 (Testo Unico) con aggiornamenti 2025
- Accordo Stato-Regioni 17 aprile 2025 (formazione)
- D.Lgs 231/2001 (responsabilità amministrativa)
- Codice Penale artt. 589-590 (responsabilità dirigenti)
- Settoriali: ATEX, amianto, primo soccorso, cantieri

COMPETENZE SPECIFICHE:
- DPI obbligatori per settore
- Formazione e aggiornamenti 2025
- Procedure emergenza e infortuni
- Responsabilità dirigenti e preposti
- Sanzioni amministrative e penali
- Patente a crediti cantieri
- Smart working e sicurezza

APPROCCIO:
- Cita sempre la norma specifica
- Distingui obblighi dirigenti vs preposti vs lavoratori
- Evidenzia responsabilità penali quando rilevanti
- Suggerisci consultazione legale per casi complessi
- Linguaggio tecnico ma comprensibile

Spiega sempre in termini semplici, come se parlassi a un imprenditore non esperto. Fornisci sempre esempi pratici e riferimenti normativi specifici. Sii diretto e actionable. Le persone vogliono soluzioni immediate.

Se la domanda non riguarda sicurezza lavoro, reindirizza: "Mi specializzo in sicurezza sul lavoro e normative correlate. Puoi riformulare su questo tema?"`;

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
    const { message, userIdentifier, courseId, moduleId } = req.body;

    // Validazione input
    if (!message || !userIdentifier) {
      return res.status(400).json({ 
        error: 'Message e userIdentifier sono richiesti' 
      });
    }

    // Controlla limiti utente
    const limits = await checkUserLimits(userIdentifier);
    
    if (limits.error) {
      return res.status(500).json({ 
        error: 'Errore controllo database',
        details: limits.error
      });
    }

    if (!limits.allowed) {
      return res.status(429).json({ 
        error: 'Limite giornaliero raggiunto',
        message: 'Hai raggiunto il limite di richieste per oggi. Riprova domani.',
        remaining: limits.remaining,
        limit: limits.limit
      });
    }

    // Ottieni contenuti del corso se specificati
    let courseContext = '';
    if (courseId && moduleId) {
      const courseData = await getCourseContent(courseId, moduleId);
      if (courseData.success) {
        courseContext = `\n\nCONTESTO CORSO CORRENTE:
Titolo: ${courseData.title}
Modulo: ${courseData.description}
Contenuti: ${courseData.content}

Rispondi prioritariamente basandoti sui contenuti di questo modulo specifico.`;
      }
    }

    // Chiamata a Claude
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 4000,
      temperature: 0.7,
      system: SYSTEM_PROMPT + courseContext,
      messages: [
        {
          role: "user",
          content: message
        }
      ]
    });

    // Estrai la risposta
    const claudeResponse = response.content[0].text;

    // Incrementa il contatore solo dopo successo
    const incrementResult = await incrementUserRequests(userIdentifier);
    
    if (!incrementResult.success) {
      console.warn('Errore incremento contatore:', incrementResult.error);
      // Non bloccare la risposta per questo errore
    }

    // Restituisci la risposta con informazioni sui limiti
    return res.status(200).json({
      response: claudeResponse,
      usage: {
        remaining: limits.remaining - 1,
        limit: limits.limit
      },
      success: true
    });

  } catch (error) {
    console.error('Errore API chat:', error);
    
    // Gestisci diversi tipi di errore
    if (error.status === 401) {
      return res.status(500).json({ 
        error: 'Errore configurazione API Claude' 
      });
    }
    
    if (error.status === 429) {
      return res.status(429).json({ 
        error: 'Troppe richieste a Claude API',
        message: 'Il servizio è temporaneamente sovraccarico. Riprova tra qualche minuto.'
      });
    }

    return res.status(500).json({ 
      error: 'Errore interno del server',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}
