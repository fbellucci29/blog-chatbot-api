import { Index } from "@upstash/vector"
import { createEmbedding } from './embedding.js'; // ⬅️ Assicurati che il percorso sia corretto

const client = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
    try {
        console.log('🔍 Query Text:', queryText);
        
        // 1. Converti il testo della query in un vettore di embedding numerico
        const queryVector = await createEmbedding(queryText); // Chiami la funzione corretta
        console.log(`✅ Embedding generato. Dimensione: ${queryVector.length}`);

        // 2. Utilizza il metodo query di Upstash, PASSANDO L'ARRAY NUMERICO
        const results = await client.query({
            vector: queryVector, // ⬅️ Upstash ora riceve l'array di numeri corretto
            topK: topK,
            includeMetadata: true,
        });

        // ... Il resto della tua logica di mappatura dei risultati ...
        if (!results || !Array.isArray(results)) {
            return [];
        }
        
        return results.map(result => ({
            text: result.metadata?.text || '',
            score: result.score,
            source: result.metadata?.source || 'Documento normativo'
        }));
        
    } catch (error) {
        console.error('❌ Errore durante la ricerca completa:', error);
        return [];
    }
}
