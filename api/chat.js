// api/chat.js - Con Rate Limiting e RAG
import { Redis } from '@upstash/redis';
import { Index } from '@upstash/vector';

const redis = Redis.fromEnv();
const vectorIndex = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

// Funzione per creare embedding usando HuggingFace
async function createEmbedding(text) {
    const response = await fetch(
        'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HF_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: text })
        }
    );
    
    if (!response.ok) {
        throw new Error(`HuggingFace API error: ${response.status}`);
    }
    
    return await response.json();
}

// Funzione per recuperare documenti rilevanti
async function retrieveRelevantDocs(query, topK = 3) {
    try {
        const embedding = await createEmbedding(query);
        const results = await vectorIndex.query({
            vector: embedding,
            topK: topK,
            includeMetadata: true,
        });
        
        return results.map(r => r.metadata?.text || '').filter(Boolean);
    } catch (error) {
        console.error('Vector search error:', error);
        return [];
    }
}

export default async function handler(req, res) {
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
        // Rate limiting
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                         req.headers['x-real-ip'] || 
                         req.socket.remoteAddress || 
                         'unknown';

        const rateLimitKey = `rate_limit:${clientIP}`;
        const currentCount = await redis.get(rateLimitKey);
        
        if (currentCount !== null && currentCount >= 3) {
            return res.status(429).json({ 
                response: '⏳ Hai raggiunto il limite di 3 domande gratuite per oggi.\n\nIl limite si resetterà tra 24 ore. Torna domani per altre domande!\n\n💡 Suggerimento: salva le risposte che ti interessano.' 
            });
        }

        const { message } = req.body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('ANTHROPIC_API_KEY not configured');
            return res.status(500).json({ response: 'Configurazione server non completa' });
        }

        // Recupera documenti rilevanti dal vector DB
        const relevantDocs = await retrieveRelevantDocs(message.trim(), 3);
        
        // Costruisci context da documenti recuperati
        let contextString = '';
        if (relevantDocs.length > 0) {
            contextString = '\n\nDOCUMENTI DI RIFERIMENTO:\n' + 
                relevantDocs.map((doc, i) => `[${i + 1}] ${doc}`).join('\n\n');
        }

        const anthropicRequest = {
            model: 'claude-sonnet-4-20250514',
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

IMPORTANTE: Scrivi SEMPRE le tue risposte in testo semplice senza formattazione Markdown. NON usare asterischi (**), hashtag (#), trattini (-) per liste o altri simboli di formattazione. Scrivi tutto in testo normale, usando a capo e paragrafi semplici per separare i concetti.

${contextString ? 'Usa i documenti di riferimento forniti per rispondere alle domande sulla normativa più recente. Se i documenti contengono informazioni rilevanti, citali nelle tue risposte.' : ''}

Rispondi sempre in italiano, in modo chiaro, professionale e conciso. Cita gli articoli specifici del D.Lgs 81/2008 quando pertinenti. Se una domanda esula dalla sicurezza sul lavoro, indirizza gentilmente l'utente verso argomenti pertinenti.${contextString}`,
            messages: [
                {
                    role: 'user',
                    content: message.trim()
                }
            ]
        };

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
                return res.status(500).json({ response: 'Errore di autenticazione con il servizio AI' });
            } else if (response.status === 429) {
                return res.status(500).json({ response: 'Servizio temporaneamente sovraccarico. Riprova tra poco.' });
            } else {
                return res.status(500).json({ response: 'Errore temporaneo del servizio AI. Riprova tra poco.' });
            }
        }

        const data = await response.json();
        
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
            console.error('Invalid response structure from Anthropic:', data);
            return res.status(500).json({ response: 'Risposta malformata dal servizio AI' });
        }

        const aiResponse = data.content[0].text;
        
        if (!aiResponse || typeof aiResponse !== 'string') {
            console.error('Invalid response text from Anthropic:', data.content[0]);
            return res.status(500).json({ response: 'Risposta vuota dal servizio AI' });
        }

        // Incrementa contatore
        const newCount = (currentCount || 0) + 1;
        await redis.set(rateLimitKey, newCount, { ex: 86400 });

        const remainingQuestions = 3 - newCount;
        let responseWithInfo = aiResponse;
        
        if (remainingQuestions > 0) {
            responseWithInfo += `\n\n---\n💬 Domande rimanenti oggi: ${remainingQuestions}/3`;
        } else {
            responseWithInfo += `\n\n---\n⏳ Hai utilizzato tutte le 3 domande gratuite. Torna domani!`;
        }

        return res.status(200).json({ response: responseWithInfo });

    } catch (error) {
        console.error('Unexpected error in chat API:', error);
        
        if (error.message && (error.message.includes('Redis') || error.message.includes('Upstash'))) {
            console.error('Upstash error:', error);
            return res.status(500).json({ response: 'Errore di configurazione del database. Contatta l\'amministratore.' });
        }
        
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.status(500).json({ response: 'Impossibile raggiungere il servizio AI. Controlla la connessione.' });
        }
        
        return res.status(500).json({ response: 'Si è verificato un errore interno. Riprova tra poco.' });
    }
}
