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

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

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
                messages: [{
                    role: 'user',
                    content: message
                }]
            })
        });

        if (!response.ok) {
            console.error('Anthropic API error:', response.status, await response.text());
            throw new Error(`Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = `Per i lavori in altezza secondo il D.Lgs 81/2008 (Art. 111-117) sono obbligatori:

- Imbracatura di sicurezza (DPI categoria III)
- Casco protettivo 
- Dispositivi anticaduta
- Scarpe antiscivolo
- Guanti da lavoro

La formazione è obbligatoria secondo l'Art. 37.`;

return res.json({ response: aiResponse });
        return res.json({ response: aiResponse });

    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(500).json({ 
            response: 'Mi dispiace, si è verificato un errore interno. Riprova tra poco.'
        });
    }
}
