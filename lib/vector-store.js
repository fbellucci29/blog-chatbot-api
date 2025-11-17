import { Index } from '@upstash/vector';

export async function searchDocuments(queryText, topK = 3) {
  try {
    const vectorIndex = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
    
    console.log('=== DEBUG UPSTASH ===');
    console.log('URL:', process.env.UPSTASH_VECTOR_REST_URL);
    console.log('Token (primi 10 char):', process.env.UPSTASH_VECTOR_REST_TOKEN?.substring(0, 10));
    console.log('Query text:', queryText);
    
    const results = await vectorIndex.query({
      data: queryText,
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('=== RISULTATI RAW ===');
    console.log('Type:', typeof results);
    console.log('Array?:', Array.isArray(results));
    console.log('Length:', results?.length);
    console.log('Full object:', JSON.stringify(results, null, 2));
    console.log('===================');
    
    if (!results || results.length === 0) {
      return [];
    }
    
    return results.map(result => ({
      text: result.metadata?.text || '',
      score: result.score,
      source: result.metadata?.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('❌ ERRORE:', error.message);
    console.error('Stack:', error.stack);
    return [];
  }
}
