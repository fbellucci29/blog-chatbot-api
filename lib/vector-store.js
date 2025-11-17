import { Index } from '@upstash/vector';
import { createEmbedding } from './embeddings.js';  // ← AGGIUNGI QUESTO

// Connessione a Upstash Vector
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

export async function searchDocuments(queryText, topK = 3) {
  try {
    // 1. Converti la query in embedding
    const queryEmbedding = await createEmbedding(queryText);
    
    // 2. CORREZIONE: prendi il primo elemento se è un array di array
    const embedding = Array.isArray(queryEmbedding[0]) ? queryEmbedding[0] : queryEmbedding;
    
    console.log('🔍 Embedding dimensioni:', embedding.length); // Debug
    
    // 3. Cerca su Upstash
    const results = await vectorIndex.query({
      data: embedding,  // ← Array semplice
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Risultati trovati:', results.length); // Debug
    
    return results.map(result => ({
      text: result.metadata.text,
      score: result.score,
      source: result.metadata.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('Errore ricerca vector:', error);
    return [];
  }
}
