export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export class GeminiError extends Error {
  constructor(public code: string, public status: number) {
    super(code);
  }
}

type JsonSchema = Record<string, unknown>;

export async function generateGeminiJson(options: {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  input: unknown;
  responseSchema: JsonSchema;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 12_000);
  try {
    const model = options.model?.trim() || DEFAULT_GEMINI_MODEL;
    if (!/^[a-z0-9._-]+$/i.test(model)) throw new GeminiError("provider_configuration", 503);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": options.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(options.input) }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
          responseJsonSchema: options.responseSchema,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 429) throw new GeminiError("provider_quota", 429);
      if (response.status === 401 || response.status === 403) throw new GeminiError("provider_configuration", 503);
      throw new GeminiError("provider_unavailable", 502);
    }
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.map((part) => typeof part.text === "string" ? part.text : "").join("").trim();
    if (!text || text.length > 16_000) throw new GeminiError("provider_invalid_response", 502);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new GeminiError("provider_invalid_response", 502);
    }
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new GeminiError("provider_timeout", 504);
    throw new GeminiError("provider_unavailable", 502);
  } finally {
    clearTimeout(timeout);
  }
}
