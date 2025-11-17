import { Index } from "@upstash/vector"

const client = Index.fromEnv();

await index.upsert({
  id: "id1",
  data: "Enter data as string",
  metadata: { metadata_field: "metadata_value" },
});

await index.query({
  data: "Enter data as string",
  topK: 1,
  includeVectors: true,
  includeMetadata: true,
});

export async function searchDocuments(queryText, topK = 3) {
  try {
    console.log('🔍 Query:', queryText);
    
    const response = await fetch(
      `${process.env.UPSTASH_VECTOR_REST_URL}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.UPSTASH_VECTOR_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: queryText,
          topK: topK,
          includeMetadata: true,
        })
      }
    );
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, await response.text());
      return [];
    }
    
    const results = await response.json();
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
