// api/chat.js - Bot Sicurezza con RAG e Rate Limiting
import Anthropic from '@anthropic-ai/sdk';
import { Redis } from '@upstash/redis';
import { Index } from '@upstash/vector';

// Inizializzazione client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

const redis = Redis.fromEnv();

const vectorIndex = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

// Funzione per recuperare documenti rilevanti dal Vector DB
async function retrieveRelevantDocs(query, topK = 5) {
    try {
        const results = await vectorIndex.query({
            data: query,  // Upstash fa embedding automatico
            topK: topK,
            includeMetadata: true,
        });
        
        // Recupera il campo 'Data' dal metadata (Upstash usa 'Data' con la D maiuscola)
        const docs = results.map(r => r.data || r.metadata?.Data || '').filter(Boolean);
        
        console.log(`Retrieved ${docs.length} documents for query: ${query}`);
        return docs;
    } catch (error) {
        console.error('Vector search error:', error);
        return [];
    }
}

// Handler principale
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Gestione preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Solo POST accettato
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Estrazione messaggio
        const { message } = req.body;
        
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ 
                error: 'Messaggio non valido',
                response: 'Per favore invia una domanda valida sulla sicurezza sul lavoro.'
            });
        }

        // Rate limiting basato su IP
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                         req.headers['x-real-ip'] || 
                         req.socket.remoteAddress || 
                         'unknown';

        const rateLimitKey = `rate_limit:${clientIP}`;
        const currentCount = await redis.get(rateLimitKey);
        
        // Controllo limite (3 domande al giorno)
        if (currentCount !== null && currentCount >= 3) {
            const ttl = await redis.ttl(rateLimitKey);
            const hours = Math.floor(ttl / 3600);
            const minutes = Math.floor((ttl % 3600) / 60);
            
            return res.status(429).json({ 
                response: `⏳ Hai raggiunto il limite di 3 domande gratuite per oggi.\n\nIl limite si resetterà tra ${hours}h ${minutes}m.\n\n💡 Torna domani per altre domande!`,
                remainingQuestions: 0
            });
        }

        // Step 1: Recupera documenti rilevanti
        const relevantDocs = await retrieveRelevantDocs(message.trim(), 5);
        
        // Step 2: Costruisci il contesto per Claude
        let systemPrompt = `Sei un assistente esperto in sicurezza sul lavoro italiana, specializzato nella normativa D.Lgs 81/2008 e aggiornamenti 2025.

Il tuo compito è rispondere a domande sulla sicurezza sul lavoro in modo:
- Preciso e basato sulla normativa vigente
- Chiaro e professionale
- Conciso (massimo 3-4 paragrafi)
- In italiano

Se la domanda non riguarda la sicurezza sul lavoro, rispondi educatamente che puoi aiutare solo su temi di sicurezza sul lavoro.`;

        let userMessage = message;

        // Se ci sono documenti rilevanti, aggiungili al contesto
        if (relevantDocs.length > 0) {
            const context = relevantDocs.join('\n\n---\n\n');
            userMessage = `Contesto normativo rilevante:
${context}

---

Domanda dell'utente: ${message}

Rispondi alla domanda utilizzando principalmente il contesto normativo fornito. Se il contesto non contiene informazioni sufficienti, puoi integrare con la tua conoscenza generale della normativa italiana sulla sicurezza sul lavoro.`;
        }

        // Step 3: Chiamata a Claude
        const claudeResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userMessage
                }
            ],
        });

        // Estrai risposta
        const responseText = claudeResponse.content[0].text;

        // Step 4: Aggiorna rate limit
        const newCount = currentCount === null ? 1 : currentCount + 1;
        await redis.set(rateLimitKey, newCount, { ex: 86400 }); // 24 ore

        const remainingQuestions = 3 - newCount;

        // Step 5: Risposta al client
        return res.status(200).json({
            response: responseText,
            remainingQuestions: remainingQuestions,
            documentsUsed: relevantDocs.length
        });

    } catch (error) {
        console.error('Error in chat handler:', error);
        
        // Gestione errori specifici
        if (error.message?.includes('rate_limit')) {
            return res.status(429).json({
                response: 'Troppe richieste. Riprova tra qualche istante.',
                error: 'rate_limit'
            });
        }
        
        return res.status(500).json({
            response: 'Si è verificato un errore. Riprova tra poco.',
            error: 'internal_error'
        });
    }
}
