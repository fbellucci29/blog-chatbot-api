export async function createEmbedding(text) {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,  
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
        inputs: text,
  options: { 
      wait_for_model: true,
        })
      }
    );
    
    if (!response.ok) {
      // Gestione di un errore specifico per il modello inattivo o errore API
      throw new Error(`HuggingFace API error: ${response.status} - ${await response.text()}`);
    }
    
    const result = await response.json();
    
    // 🔑 CORREZIONE CHIAVE: L'API restituisce un array di array, 
    // noi vogliamo solo il primo elemento (l'embedding vero e proprio).
    const embeddingVector = result[0]; 
    
    if (!embeddingVector || embeddingVector.length === 0) {
        throw new Error("L'embedding restituito è vuoto.");
    }

    return embeddingVector; // Restituisce l'array di numeri [0.123, -0.456, ...]
    
  } catch (error) {
    console.error('❌ Errore creazione embedding:', error);
    // Rilancia l'errore per gestirlo in searchDocuments
    throw error;
  }
}
