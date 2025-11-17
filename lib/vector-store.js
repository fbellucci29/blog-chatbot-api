Cambia vector-store.js così:
javascriptimport { Index } from '@upstash/vector';

export const vectorIndex = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Ricerca:', queryText);
    
    // Upstash genera automaticamente l'embedding usando il modello dell'index!
    const results = await vectorIndex.query({
      data: queryText,  // ← TESTO DIRETTO!
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
    console.error('❌ Errore completo:', error);
    return [];
  }
}
