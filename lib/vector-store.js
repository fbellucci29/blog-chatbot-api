import { Index } from '@upstash/vector';
import { createEmbedding } from './embeddings.js';

// Connessione a Upstash Vector - USA fromEnv()!
export const vectorIndex = Index.fromEnv();

// Cerca documenti rilevanti
export async function searchDocuments(queryText, topK = 3) {
  try {
    const queryEmbedding = await createEmbedding(queryText);
    
    // Gestisci array dentro array
    const embedding = Array.isArray(queryEmbedding[0]) ? queryEmbedding[0] : queryEmbedding;
    
    const results = await vectorIndex.query({
      data: embedding,
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
