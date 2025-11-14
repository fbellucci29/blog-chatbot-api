import fs from 'fs';
import pdf from 'pdf-parse';

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

// Leggi PDF e restituisci testo
export async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    console.error(`Errore lettura PDF ${pdfPath}:`, error);
    throw error;
  }
}

// Suddividi testo in chunks
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    const cleanChunk = chunk.replace(/\s+/g, ' ').trim();
    
    if (cleanChunk.length > 50) {
      chunks.push(cleanChunk);
    }
    
    start += chunkSize - overlap;
  }

  return chunks;
}

// Processa PDF completo
export async function processPDF(pdfPath, documentName) {
  console.log(`\n📄 Processing: ${documentName}`);
  
  const fullText = await extractTextFromPDF(pdfPath);
  console.log(`   Estratti ${fullText.length} caratteri`);
  
  const chunks = chunkText(fullText, 1000, 200);
  console.log(`   Creati ${chunks.length} chunks`);
  
  const embeddingsData = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Pausa per non saturare API gratuita
    if (i > 0 && i % 3 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    const embedding = await createEmbedding(chunk);
    
    embeddingsData.push({
      id: `${documentName}-chunk-${i}`,
      embedding: embedding,
      metadata: {
        text: chunk,
        source: documentName,
        chunkIndex: i,
        totalChunks: chunks.length
      }
    });
    
    if ((i + 1) % 5 === 0) {
      console.log(`   Processati ${i + 1}/${chunks.length} chunks...`);
    }
  }
  
  console.log(`✅ Completato: ${documentName}`);
  return embeddingsData;
}
