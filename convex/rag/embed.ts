// Único módulo que habla con Voyage AI. Indexar usa input_type "document";
// buscar usa "query". Mezclarlos degrada la recuperación en silencio.

export const EMBEDDING_DIMENSIONS = 1024;
export const VOYAGE_MODEL = "voyage-4";
export const VOYAGE_EMBEDDINGS_URL = "https://api.voyageai.com/v1/embeddings";

export type VoyageInputType = "document" | "query";

export function zeroEmbedding(): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0);
}

function requireApiKey(): string {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY no está configurada");
  }
  return apiKey;
}

export async function embedDocument(text: string): Promise<number[]> {
  return embedText(text, "document");
}

export async function embedQuery(text: string): Promise<number[]> {
  return embedText(text, "query");
}

async function embedText(text: string, inputType: VoyageInputType): Promise<number[]> {
  const response = await fetch(VOYAGE_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text,
      model: VOYAGE_MODEL,
      input_type: inputType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Voyage embeddings falló: ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const embedding = payload.data?.[0]?.embedding;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Voyage devolvió un embedding inválido");
  }
  return embedding;
}
