import { Index } from '@upstash/vector';

export const vectorIndex = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Ricerca:', queryText);
    
    // Upstash genera automaticamente l'embedding!
    const results = await vectorIndex.query({
      data: queryText,  // ← TESTO DIRETTO, non embedding!
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Risultati:', results.length);
    
    return results.map(result => ({
      text: result.metadata.text,
      score: result.score,
      source: result.metadata.source || 'Documento normativo'
    }));
    
  } catch (error) {
    console.error('❌ Errore:', error);
    return [];
  }
}
