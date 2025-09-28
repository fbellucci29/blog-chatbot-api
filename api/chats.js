// api/chat.js - Funzione serverless per Vercel
export default async function handler(req, res) {
    // CORS headers per permettere chiamate dal browser
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gestione preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Accetta solo richieste POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        // Estrai il messaggio dal body della richiesta
        const { message } = req.body;

        // Valida che il messaggio sia presente
        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ 
                error: 'Message is required and must be a non-empty string' 
            });
        }

        // Valida che l'API key sia configurata
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY not configured');
            return res.status(500).json({ 
                response: 'Configurazione server non completa' 
            });
        }

        // Prepara la richiesta per Anthropic API
        const anthropicRequest = {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1000,
            system: `Sei un esperto consulente per la sicurezza sul lavoro specializzato nel D.Lgs 81/2008 (Testo Unico sulla Sicurezza sul Lavoro) italiano.

Le tue responsabilità includono:
- Fornire consulenza accurata e aggiornata sulla normativa italiana in materia di sicurezza sul lavoro
- Interpretare correttamente gli articoli del D.Lgs 81/2008 e relative modifiche
- Suggerire procedure di sicurezza conformi alla legge italiana
- Assistere nella valutazione dei rischi e nella redazione di DVR (Documento di Valutazione dei Rischi)
- Fornire informazioni su DPI (Dispositivi di Protezione Individuale) e DPC (Dispositivi di Protezione Collettiva)
- Guidare nella pianificazione della formazione obbligatoria per lavoratori
- Spiegare ruoli e responsabilità di datori di lavoro, RSPP, RLS, medici competenti

Rispondi sempre in italiano, in modo chiaro e professionale. Cita sempre gli articoli specifici del D.Lgs 81/2008 quando pertinenti. Se una domanda esula dalla sicurezza sul lavoro, indirizza gentilmente l'utente verso argomenti pertinenti.`,
            messages: [
                {
                    role: 'user',
                    content: message.trim()
                }
            ]
        };

        // Chiamata all'API di Anthropic
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(anthropicRequest)
        });

        // Controlla se la risposta è valida
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Anthropic API error ${response.status}:`, errorText);
            
            // Gestisci errori specifici
            if (response.status === 401) {
                return res.status(500).json({ 
                    response: 'Errore di autenticazione con il servizio AI' 
                });
            } else if (response.status === 429) {
                return res.status(500).json({ 
                    response: 'Servizio temporaneamente sovraccarico. Riprova tra poco.' 
                });
            } else {
                return res.status(500).json({ 
                    response: 'Errore temporaneo del servizio AI. Riprova tra poco.' 
                });
            }
        }

        // Estrai la risposta JSON
        const data = await response.json();
        
        // Valida la struttura della risposta
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
            console.error('Invalid response structure from Anthropic:', data);
            return res.status(500).json({ 
                response: 'Risposta malformata dal servizio AI' 
            });
        }

        // Estrai il testo della risposta
        const aiResponse = data.content[0].text;
        
        if (!aiResponse || typeof aiResponse !== 'string') {
            console.error('Invalid response text from Anthropic:', data.content[0]);
            return res.status(500).json({ 
                response: 'Risposta vuota dal servizio AI' 
            });
        }

        // Restituisci la risposta all'utente
        return res.status(200).json({ 
            response: aiResponse 
        });

    } catch (error) {
        // Log dell'errore per debugging
        console.error('Unexpected error in chat API:', error);
        
        // Gestisci errori di rete
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(500).json({ 
                response: 'Impossibile raggiungere il servizio AI. Controlla la connessione.' 
            });
        }
        
        // Errore generico
        return res.status(500).json({ 
            response: 'Si è verificato un errore interno. Riprova tra poco.' 
        });
    }
}
