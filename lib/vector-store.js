import { Index } from '@upstash/vector';

export const vectorIndex = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Query:', queryText);
    
    const results = await vectorIndex.query({
      data: queryText,
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Trovati:', results.length, 'risultati');
    console.log('📄 Dettagli:', JSON.stringify(results));
    
    return results.map(result => ({
      text: result.metadata?.text || '',
      score: result.score,
      source: result.metadata?.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('❌ Errore Upstash:', error);
    console.error('Stack:', error.stack);
    return [];
  }
}
