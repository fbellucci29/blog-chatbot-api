import fs from 'fs';
import pdf from 'pdf-parse';

// Crea embedding usando Voyage AI
export async function createEmbedding(text) {
  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
      },
      body: JSON.stringify({
        input: text,
        model: 'voyage-2'  // Genera embeddings 1024-dimensional
      })
    });

    const data = await response.json();
    return data.data[0].embedding;
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

// Suddividi testo in chunks (pezzi gestibili)
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    // Pulisci il chunk
    const cleanChunk = chunk
      .replace(/\s+/g, ' ')  // Rimuovi spazi multipli
      .trim();
    
    if (cleanChunk.length > 50) {  // Solo chunks significativi
      chunks.push(cleanChunk);
    }
    
    start += chunkSize - overlap;  // Sovrapposizione per non perdere contesto
  }

  return chunks;
}

// Processa un PDF: estrai testo → chunks → embeddings
export async function processPDF(pdfPath, documentName) {
  console.log(`\n📄 Processing: ${documentName}`);
  
  // 1. Estrai testo dal PDF
  const fullText = await extractTextFromPDF(pdfPath);
  console.log(`   Estratti ${fullText.length} caratteri`);
  
  // 2. Dividi in chunks
  const chunks = chunkText(fullText, 1000, 200);
  console.log(`   Creati ${chunks.length} chunks`);
  
  // 3. Crea embeddings per ogni chunk
  const embeddingsData = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Piccola pausa per non saturare l'API
    if (i > 0 && i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    
    // Progress feedback
    if ((i + 1) % 10 === 0) {
      console.log(`   Processati ${i + 1}/${chunks.length} chunks...`);
    }
  }
  
  console.log(`✅ Completato: ${documentName}`);
  return embeddingsData;
}
