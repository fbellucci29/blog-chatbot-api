import { Index } from '@upstash/vector';

export const vectorIndex = Index.fromEnv();

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Ricerca:', queryText);
    
    // Genera embedding con HuggingFace
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: queryText,
          options: { wait_for_model: true }
        })
      }
    );
    
    if (!response.ok) {
      console.error('❌ HuggingFace error:', response.status);
      return [];
    }
    
    const embedding = await response.json();
    const vector = Array.isArray(embedding[0]) ? embedding[0] : embedding;
    
    console.log('✅ Embedding generato, dimensioni:', vector.length);
    
    // Query con il vettore
    const results = await vectorIndex.query({
      vector: vector,  // ← CAMBIATO da "data" a "vector"!
      topK: topK,
      includeMetadata: true,
    });
    
    console.log('📊 Risultati:', results.length);
    
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
