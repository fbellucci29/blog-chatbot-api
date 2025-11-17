import { Index } from '@upstash/vector';
import { createEmbedding } from './embeddings.js';  // ← AGGIUNGI QUESTO

// Connessione a Upstash Vector
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

// Cerca documenti rilevanti
export async function searchDocuments(queryText, topK = 3) {
  try {
    // 1. Converti la query in embedding
    const queryEmbedding = await createEmbedding(queryText);
    
    // 2. Cerca su Upstash con l'embedding
    const results = await vectorIndex.query({
      data: queryEmbedding,  // ← CAMBIATO: era "query", ora è "queryEmbedding"
      topK: topK,
      includeMetadata: true,
    });
    
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

// Questa funzione NON serve più, puoi cancellarla
// export async function upsertDocument...
