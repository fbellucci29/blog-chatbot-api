import { Index } from "@upstash/vector"

// Inizializza il client di Upstash Vector.
// Index.fromEnv() leggerà automaticamente le variabili d'ambiente.
const client = Index.fromEnv();

/**
 * Cerca documenti simili a una data query di testo utilizzando l'indice Upstash Vector.
 *
 * @param {string} queryText - Il testo della query da convertire in embedding.
 * @param {number} [topK=3] - Il numero di risultati da restituire.
 * @returns {Promise<Array<{text: string, score: number, source: string}>>} Un array di risultati mappati.
 */
export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Query:', queryText);
    
    // 1. Esegui la query utilizzando il client SDK.
    // L'SDK si occupa di generare l'embedding per 'queryText' prima di inviarlo.
    const results = await client.query({
      data: queryText, // Passiamo il testo della query qui
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Risultati Grezzi:', JSON.stringify(results, null, 2));
    
    // 2. Validazione dei risultati
    if (!results || !Array.isArray(results)) {
      console.log('⚠️ Risultati non validi o vuoti, restituisco array vuoto.');
      return [];
    }
    
    // 3. Mappatura e pulizia dei risultati per restituire solo i dati utili
    return results.map(result => ({
      text: result.metadata?.text || '', // Estrai il testo dal metadata
      score: result.score,
      source: result.metadata?.source || 'Documento normativo' // Estrai la fonte o usa un default
    }));
    
  } catch (error) {
    console.error('❌ Errore durante la ricerca:', error);
    // In caso di errore, restituisci sempre un array vuoto per evitare crash
    return [];
  }
}
