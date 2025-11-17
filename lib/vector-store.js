import { Index } from '@upstash/vector';

// Passa manualmente le variabili con REST_ nel nome
export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Query:', queryText);
    
    const results = await vectorIndex.query({
      data: queryText,
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Trovati:', results.length, 'risultati');
    
    return results.map(result => ({
      text: result.metadata?.text || '',
      score: result.score,
      source: result.metadata?.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('❌ Errore:', error);
    return [];
  }
}
