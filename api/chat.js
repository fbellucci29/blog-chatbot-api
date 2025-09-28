// api/chat.js
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        console.log('Received message:', message);
        console.log('API Key present:', !!process.env.ANTHROPIC_API_KEY);

        // Chiamata ad Anthropic con modello corretto
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022', // Modello aggiornato
                max_tokens: 1000,
                system: 'Sei un esperto consulente per la sicurezza sul lavoro specializzato nel D.Lgs 81/2008 italiano. Rispondi sempre in italiano, cita articoli specifici quando pertinenti.',
                messages: [{
                    role: 'user',
                    content: message
                }]
            })
        });

        console.log('Anthropic response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Anthropic API error:', response.status, errorText);
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Anthropic response received');
        
        const aiResponse = data.content[0].text;

        res.json({ response: aiResponse });

    } catch (error) {
        console.error('Chat API error:', error);
       res.status(500).json({ 
    error: 'Internal server error',
    message: 'Mi dispiace, si è verificato un errore interno. Riprova tra poco.',
    details: error.message
     });
    }
}
