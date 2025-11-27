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
            data: query,  // Upstash fa embedding automatico con ALL_MINILM_L6_V2
            topK: topK,
            includeMetadata: true,
            includeData: true,  // IMPORTANTE: necessario per recuperare il campo 'data'
        });
        
        // Il testo è nel campo 'data' (minuscolo) di ogni risultato
        const docs = results.map(r => r.data).filter(Boolean);
        
        console.log(`[VECTOR] Query: "${query}"`);
        console.log(`[VECTOR] Retrieved ${docs.length} documents`);
        if (docs.length > 0) {
            console.log(`[VECTOR] First doc preview: ${docs[0].substring(0, 150)}...`);
        } else {
            console.log('[VECTOR] WARNING: No documents found!');
        }
        
        return docs;
    } catch (error) {
        console.error('[VECTOR] Error during search:', error);
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

        // Rate limiting basato su IP - 20 domande per ora
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 
                         req.headers['x-real-ip'] || 
                         req.socket.remoteAddress || 
                         'unknown';

        const rateLimitKey = `rate_limit:${clientIP}`;
        const currentCount = await redis.get(rateLimitKey);
        
        console.log(`[RATE_LIMIT] IP: ${clientIP}, Count: ${currentCount || 0}/20`);
        
        // Controllo limite (20 domande per ora)
        if (currentCount !== null && currentCount >= 20) {
            const ttl = await redis.ttl(rateLimitKey);
            const minutes = Math.floor(ttl / 60);
            const seconds = ttl % 60;
            
            return res.status(429).json({ 
                response: `⏳ Hai raggiunto il limite di 20 domande per ora.\n\nIl limite si resetterà tra ${minutes} minuti e ${seconds} secondi.\n\n💡 Torna tra poco per altre domande!`,
                remainingQuestions: 0
            });
        }

        // Step 1: Recupera documenti rilevanti
        console.log(`[QUERY] User message: "${message.trim()}"`);
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
            
            console.log(`[CONTEXT] Added ${relevantDocs.length} documents to context`);
        } else {
            console.log('[CONTEXT] No documents found, using Claude base knowledge');
        }

        // Step 3: Chiamata a Claude
        console.log('[CLAUDE] Sending request...');
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
        console.log('[CLAUDE] Response received');

        // Step 4: Aggiorna rate limit
        const newCount = currentCount === null ? 1 : currentCount + 1;
        await redis.set(rateLimitKey, newCount, { ex: 3600 }); // 3600 secondi = 1 ora

        const remainingQuestions = 20 - newCount;
        console.log(`[RATE_LIMIT] Updated count: ${newCount}/20, Remaining: ${remainingQuestions}`);

        // Step 5: Risposta al client
        return res.status(200).json({
            response: responseText,
            remainingQuestions: remainingQuestions,
            documentsUsed: relevantDocs.length
        });

    } catch (error) {
        console.error('[ERROR] Handler error:', error);
        
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
