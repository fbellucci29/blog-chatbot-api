import { Index } from '@upstash/vector';
import { createEmbedding } from './embeddings.js';

// Connessione a Upstash Vector - USA fromEnv()!
export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 INIZIO RICERCA:', queryText);
    
    // 1. Converti la query in embedding
    const queryEmbedding = await createEmbedding(queryText);
    console.log('📦 Embedding ricevuto:', typeof queryEmbedding, Array.isArray(queryEmbedding));
    console.log('📏 Primo elemento:', queryEmbedding[0]);
    
    // Gestisci array dentro array
    const embedding = Array.isArray(queryEmbedding[0]) ? queryEmbedding[0] : queryEmbedding;
    console.log('✅ Embedding finale dimensioni:', embedding.length);
    console.log('🔢 Primi 5 valori:', embedding.slice(0, 5));
    
    // 2. Query su Upstash
    const results = await vectorIndex.query({
      data: embedding,
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 RISULTATI:', results.length);
    console.log('📄 Dettagli risultati:', JSON.stringify(results, null, 2));
    
    return results.map(result => ({
      text: result.metadata.text,
      score: result.score,
      source: result.metadata.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('❌ ERRORE COMPLETO:', error);
    console.error('❌ Stack:', error.stack);
    return [];
  }
}
