// Unico adaptador de embeddings. OpenAI no distingue entre documentos y
// consultas (`input_type` de Voyage); ambos usan exactamente el mismo modelo.
// Esa perdida se mide con scripts/evaluate-rag-retrieval.mjs antes de liberar.

export const EMBEDDING_DIMENSIONS = 1024;
export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

export type EmbeddingBatch = {
  embeddings: number[][];
  totalTokens: number;
};

export function zeroEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
}

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no esta configurada");
  return apiKey;
}

export async function embedDocument(text: string): Promise<number[]> {
  const result = await embedDocuments([text]);
  return result.embeddings[0];
}

export async function embedQuery(text: string): Promise<number[]> {
  const result = await embedTexts([text]);
  return result.embeddings[0];
}

// La ingesta usa entradas por lote para no hacer 31.102 viajes de red.
export async function embedDocuments(texts: string[]): Promise<EmbeddingBatch> {
  return embedTexts(texts);
}

async function embedTexts(texts: string[]): Promise<EmbeddingBatch> {
  if (texts.length === 0) return { embeddings: [], totalTokens: 0 };

  const response = await fetch(OPENAI_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: OPENAI_EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
      encoding_format: "float",
    }),
  });

  if (!response.ok) throw new Error(`OpenAI embeddings fallo: ${response.status}`);

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
    usage?: { total_tokens?: number };
  };
  const ordered = [...(payload.data ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const embeddings = ordered.map((item) => item.embedding);
  if (
    embeddings.length !== texts.length ||
    embeddings.some((embedding) => !embedding || embedding.length !== EMBEDDING_DIMENSIONS)
  ) {
    throw new Error("OpenAI devolvio embeddings invalidos");
  }

  return {
    embeddings: embeddings as number[][],
    totalTokens: payload.usage?.total_tokens ?? 0,
  };
}
