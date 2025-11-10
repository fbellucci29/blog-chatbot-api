// api/chat.js - Funzione serverless con rate limiting IP
import { Redis } from '@upstash/redis';

// Inizializza connessione Redis
const redis = Redis.fromEnv();

export default async function handler(req, res) {
    // CORS headers
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
        // RATE LIMITING PER IP
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                         req.headers['x-real-ip'] || 
                         req.socket.remoteAddress || 
                         'unknown';

        // Chiave univoca per tracciare le richieste dell'IP
        const rateLimitKey = `rate_limit:${clientIP}`;
        
        // Ottieni il contatore attuale (null se non esiste)
        const currentCount = await redis.get(rateLimitKey);
        
        // Controlla se ha superato il limite di 3 domande
        if (currentCount !== null && currentCount >= 3) {
            return res.status(429).json({ 
                response: '⏳ Hai raggiunto il limite di 3 domande gratuite per oggi.\n\nIl limite si resetterà tra 24 ore. Torna domani per altre domande!\n\n💡 Suggerimento: salva le risposte che ti interessano.' 
            });
        }

        // Estrai e valida il messaggio
        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ 
                error: 'Message is required' 
            });
        }

        // Valida API key
        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY not configured');
            return res.status(500).json({ 
                response: 'Configurazione server non completa' 
            });
        }

        // Prepara richiesta Claude (modello aggiornato)
        const anthropicRequest = {
            model: 'claude-sonnet-4-20250514', // Modello più recente
            max_tokens: 1500,
            system: `Sei un esperto consulente per la sicurezza sul lavoro specializzato nel D.Lgs 81/2008 (Testo Unico sulla Sicurezza sul Lavoro) italiano.

Le tue responsabilità includono:
- Fornire consulenza accurata e aggiornata sulla normativa italiana in materia di sicurezza sul lavoro
- Interpretare correttamente gli articoli del D.Lgs 81/2008 e relative modifiche
- Suggerire procedure di sicurezza conformi alla legge italiana
- Assistere nella valutazione dei rischi e nella redazione di DVR (Documento di Valutazione dei Rischi)
- Fornire informazioni su DPI (Dispositivi di Protezione Individuale) e DPC (Dispositivi di Protezione Collettiva)
- Guidare nella pianificazione della formazione obbligatoria per lavoratori
- Spiegare ruoli e responsabilità di datori di lavoro, RSPP, RLS, medici competenti

Rispondi sempre in italiano, in modo chiaro, professionale e conciso. Cita gli articoli specifici del D.Lgs 81/2008 quando pertinenti. Se una domanda esula dalla sicurezza sul lavoro, indirizza gentilmente l'utente verso argomenti pertinenti.`,
            messages: [
                {
                    role: 'user',
                    content: message.trim()
                }
            ]
        };

        // Chiamata a Claude
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(anthropicRequest)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Anthropic API error ${response.status}:`, errorText);
            
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

        const data = await response.json();
        
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
            console.error('Invalid response structure from Anthropic:', data);
            return res.status(500).json({ 
                response: 'Risposta malformata dal servizio AI' 
            });
        }

        const aiResponse = data.content[0].text;
        
        if (!aiResponse || typeof aiResponse !== 'string') {
            console.error('Invalid response text from Anthropic:', data.content[0]);
            return res.status(500).json({ 
                response: 'Risposta vuota dal servizio AI' 
            });
        }

        // INCREMENTA IL CONTATORE dopo risposta riuscita
        const newCount = (currentCount || 0) + 1;
        
        // Salva con scadenza di 24 ore (86400 secondi)
        await redis.set(rateLimitKey, newCount, { ex: 86400 });

        // Aggiungi info domande rimanenti
        const remainingQuestions = 3 - newCount;
        let responseWithInfo = aiResponse;
        
        if (remainingQuestions > 0) {
            responseWithInfo += `\n\n---\n💬 Domande rimanenti oggi: ${remainingQuestions}/3`;
        } else {
            responseWithInfo += `\n\n---\n⏳ Hai utilizzato tutte le 3 domande gratuite. Torna domani!`;
        }

        return res.status(200).json({ 
            response: responseWithInfo
        });

    } catch (error) {
        console.error('Unexpected error in chat API:', error);
        
        // Errori specifici Redis
        if (error.message && (error.message.includes('Redis') || error.message.includes('Upstash'))) {
            console.error('Upstash Redis error - check if Redis is enabled:', error);
            return res.status(500).json({ 
                response: 'Errore di configurazione del database. Contatta l\'amministratore.' 
            });
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(500).json({ 
                response: 'Impossibile raggiungere il servizio AI. Controlla la connessione.' 
            });
        }
        
        return res.status(500).json({ 
            response: 'Si è verificato un errore interno. Riprova tra poco.' 
        });
    }
}
