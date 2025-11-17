//SOLUZIONE - Inizializza l'Index DENTRO la funzione:
import { Index } from '@upstash/vector';

export async function searchDocuments(queryText, topK = 3) {
  try {
    // Inizializza l'Index QUI, quando le env vars sono sicuramente disponibili
    const vectorIndex = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
    
    console.log('🔍 Query:', queryText);
    console.log('🔧 URL:', process.env.UPSTASH_VECTOR_REST_URL);
    
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
