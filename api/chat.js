// api/chat.js
import { Redis } from '@upstash/redis';
import { Index } from '@upstash/vector';

const redis = Redis.fromEnv();
const vectorIndex = new Index({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

async function retrieveRelevantDocs(query, topK = 3) {
    try {
        const results = await vectorIndex.query({
            data: query,
            topK: topK,
            includeMetadata: true,
        });
        return results.map(r => r.metadata?.content || '').filter(Boolean);
    } catch (error) {
        console.error('Vector error:', error);
        return [];
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0].trim() || 'unknown';
        const rateLimitKey = `rate_limit:${clientIP}`;
        const currentCount = await redis.get(rateLimitKey);
        
        if (currentCount >= 50) {
            return res.status(429).json({ 
                response: '⏳ Limite raggiunto. Torna domani!' 
            });
        }

        const { message } = req.body;
        if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

        const relevantDocs = await retrieveRelevantDocs(message.trim());
        const context = relevantDocs.length > 0 
            ? '\n\nDOCUMENTI:\n' + relevantDocs.map((d, i) => `[${i+1}] ${d}`).join('\n\n')
            : '';

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1500,
                system: `Esperto D.Lgs 81/2008. Rispondi in testo semplice senza markdown. Usa i documenti forniti.${context}`,
                messages: [{ role: 'user', content: message.trim() }]
            })
        });

        if (!response.ok) throw new Error('API error');

        const data = await response.json();
        const aiResponse = data.content[0].text;

        await redis.set(rateLimitKey, (currentCount || 0) + 1, { ex: 86400 });
        
        const remaining = 50 - ((currentCount || 0) + 1);
        return res.status(200).json({ 
            response: aiResponse + `\n\n---\n💬 Domande: ${remaining}/50`
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ response: 'Errore server' });
    }
}
