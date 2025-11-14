import { Index } from '@upstash/vector';

// Connessione a Upstash Vector
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

// Cerca documenti rilevanti
export async function searchDocuments(query, topK = 3) {
  try {
    const results = await vectorIndex.query({
      data: query,
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

// Carica documento nel vector DB
export async function upsertDocument(id, embedding, metadata) {
  try {
    await vectorIndex.upsert([{
      id: id,
      vector: embedding,
      metadata: metadata
    }]);
    
    console.log(`✅ Caricato: ${id}`);
    
  } catch (error) {
    console.error(`❌ Errore caricamento ${id}:`, error);
    throw error;
  }
}
