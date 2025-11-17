import { Index } from "@upstash/vector"; // ⬅️ L'importazione è corretta

// 1. Inizializzazione corretta del client SDK
const client = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Query:', queryText);

    // 2. Utilizza il metodo query del client
    const results = await client.query({
      data: queryText, // ⬅️ L'SDK accetta il testo da convertire
      topK: topK,
      includeMetadata: true,
    });

    console.log('📊 Risultati:', JSON.stringify(results, null, 2));

    if (!results || !Array.isArray(results)) {
      return [];
    }

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
   
