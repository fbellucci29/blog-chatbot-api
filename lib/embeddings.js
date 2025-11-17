// Crea embedding usando HuggingFace (GRATIS)
export async function createEmbedding(text) {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: text,
          options: { wait_for_model: true }
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }
    
    const embedding = await response.json();
    return embedding;
    
  } catch (error) {
    console.error('Errore creazione embedding:', error);
    throw error;
  }
}

// CANCELLA TUTTO IL RESTO (extractTextFromPDF, chunkText, processPDF)
// Non servono più perché hai già caricato i PDF su Upstash!
