import { upsertDocument } from '../lib/vector-store.js';
import { processPDF } from '../lib/embeddings.js';
import fs from 'fs';
import path from 'path';

async function uploadAllDocuments() {
  console.log('🚀 Inizio caricamento documenti su Upstash...\n');
  
  const docsFolder = path.join(process.cwd(), 'docs');
  
  // Verifica cartella docs
  if (!fs.existsSync(docsFolder)) {
    console.error('❌ Cartella /docs non trovata!');
    console.log('Crea la cartella /docs e metti i PDF lì dentro');
    process.exit(1);
  }
  
  // Leggi tutti i PDF
  const files = fs.readdirSync(docsFolder).filter(f => f.endsWith('.pdf'));
  
  if (files.length === 0) {
    console.error('❌ Nessun PDF trovato in /docs');
    console.log('Aggiungi i PDF nella cartella /docs e riprova');
    process.exit(1);
  }
  
  console.log(`📚 Trovati ${files.length} PDF da processare\n`);
  
  // Processa ogni PDF
  for (const file of files) {
    const filePath = path.join(docsFolder, file);
    const documentName = file.replace('.pdf', '');
    
    try {
      // Processa PDF → embeddings
      const embeddingsData = await processPDF(filePath, documentName);
      
      // Carica su Upstash
      console.log(`   Caricamento su Upstash...`);
      for (const data of embeddingsData) {
        await upsertDocument(data.id, data.embedding, data.metadata);
      }
      
      console.log(`✅ ${documentName}: ${embeddingsData.length} chunks caricati\n`);
      
    } catch (error) {
      console.error(`❌ Errore con ${file}:`, error.message);
    }
  }
  
  console.log('\n🎉 Caricamento completato!');
}

// Esegui
uploadAllDocuments().catch(error => {
  console.error('❌ Errore:', error);
  process.exit(1);
});
