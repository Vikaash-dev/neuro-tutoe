const DEFAULT_BASE_URL = "http://192.168.1.7:1234/v1";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_BATCH_SIZE = 32;

function compactText(value = "", max = 8000) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function modeFromEnv(env = process.env) {
  return String(env.RAG_EMBEDDING_MODE || env.EMBEDDING_MODE || "local-hash")
    .trim()
    .toLowerCase();
}

export function normalizeEmbeddingVector(vector = []) {
  const values = (Array.isArray(vector) ? vector : [])
    .map(Number)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) throw new Error("Embedding vector was empty");
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => value / magnitude);
}

export function chooseEmbeddingModel(models = []) {
  const ids = models
    .map((model) => model?.id)
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => id.trim());

  return (
    ids.find((id) => /embed|bge|nomic|gte|e5|minilm|sentence/i.test(id)) ||
    ids[0] ||
    "local-embedding-model"
  );
}

export function getEmbeddingConfig(env = process.env) {
  const mode = modeFromEnv(env);
  const remote = ["lmstudio", "openai", "openai-compatible", "remote"].includes(mode);
  const baseUrl = String(env.EMBEDDING_BASE_URL || env.RAG_EMBEDDING_BASE_URL || env.LLM_BASE_URL || DEFAULT_BASE_URL)
    .replace(/\/+$/, "");

  return {
    enabled: mode !== "off" && mode !== "disabled",
    remote,
    mode,
    provider: remote ? "openai-compatible" : "local-hash",
    baseUrl,
    model: env.EMBEDDING_MODEL || env.RAG_EMBEDDING_MODEL || "",
    timeoutMs: Number(env.EMBEDDING_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    batchSize: Math.max(1, Math.min(Number(env.EMBEDDING_BATCH_SIZE || DEFAULT_BATCH_SIZE), 128)),
  };
}

async function parseJsonResponse(response, label) {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`${label} failed: ${response.status} ${body.slice(0, 160)}`);
  }
  return response.json();
}

export function createEmbeddingProvider(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = getEmbeddingConfig(env);
  const apiKey = env.EMBEDDING_API_KEY || env.RAG_EMBEDDING_API_KEY || env.LLM_API_KEY || "lm-studio";
  let cachedModel = config.model;
  let cachedModelAt = 0;

  async function discoverModel() {
    if (cachedModel) return cachedModel;
    if (!fetchImpl) throw new Error("fetch is unavailable for embedding model discovery");
    if (cachedModel && Date.now() - cachedModelAt < 300000) return cachedModel;

    const timer = withTimeout(Math.min(config.timeoutMs, 5000));
    try {
      const response = await fetchImpl(`${config.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: timer.signal,
      });
      const data = await parseJsonResponse(response, "Embedding model discovery");
      cachedModel = chooseEmbeddingModel(data?.data || []);
      cachedModelAt = Date.now();
      return cachedModel;
    } finally {
      timer.clear();
    }
  }

  async function embedBatch(texts = []) {
    if (!fetchImpl) throw new Error("fetch is unavailable for remote embeddings");
    const model = await discoverModel();
    const timer = withTimeout(config.timeoutMs);
    try {
      const response = await fetchImpl(`${config.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: texts.map((text) => compactText(text)),
        }),
        signal: timer.signal,
      });
      const data = await parseJsonResponse(response, "Embedding request");
      const rows = Array.isArray(data?.data) ? data.data : [];
      const byIndex = rows
        .map((row, index) => ({ index: Number.isFinite(Number(row?.index)) ? Number(row.index) : index, row }))
        .sort((a, b) => a.index - b.index);
      const vectors = byIndex.map(({ row }) => normalizeEmbeddingVector(row?.embedding));
      if (vectors.length !== texts.length) {
        throw new Error(`Embedding request returned ${vectors.length} vectors for ${texts.length} inputs`);
      }
      return { model, vectors };
    } finally {
      timer.clear();
    }
  }

  return {
    config,
    async probe() {
      if (!config.enabled) return { ok: false, reason: "Embedding provider disabled", config };
      if (!config.remote) return { ok: true, provider: "local-hash", config };
      try {
        const model = await discoverModel();
        return { ok: true, provider: config.provider, model, config };
      } catch (error) {
        return {
          ok: false,
          provider: config.provider,
          reason: error instanceof Error ? error.message : "Embedding probe failed",
          config,
        };
      }
    },
    async embedMany(texts = []) {
      if (!config.enabled || !config.remote) {
        throw new Error("Remote embeddings are not enabled");
      }

      const cleanTexts = (Array.isArray(texts) ? texts : []).map((text) => compactText(text));
      const allVectors = [];
      let model = cachedModel;
      for (let index = 0; index < cleanTexts.length; index += config.batchSize) {
        const batch = cleanTexts.slice(index, index + config.batchSize);
        const result = await embedBatch(batch);
        model = result.model;
        allVectors.push(...result.vectors);
      }
      return {
        provider: config.provider,
        model,
        vectors: allVectors,
        dimensions: allVectors[0]?.length || 0,
      };
    },
  };
}
