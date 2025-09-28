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
        const { message } = req.body;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-sonnet-20240229',
                max_tokens: 1000,
                system: 'Sei un consulente di sicurezza sul lavoro specializzato nel D.Lgs 81/2008. Rispondi in italiano.',
                messages: [{ role: 'user', content: message }]
            })
        });

        const data = await response.json();
        return res.json({ response: data.content[0].text });

    } catch (error) {
        return res.status(500).json({ 
            response: 'Errore di connessione con il servizio AI'
        });
    }
}
