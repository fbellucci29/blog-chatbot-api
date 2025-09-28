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
        
        // Risposta temporanea per testare che tutto funzioni
        return res.json({ 
            response: `Hai chiesto: "${message}". L'API funziona correttamente. Il problema era la connessione ad Anthropic.`
        });

    } catch (error) {
        return res.status(500).json({ 
            response: 'Errore interno'
        });
    }
}
