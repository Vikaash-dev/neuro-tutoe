import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseEmbeddingModel,
  createEmbeddingProvider,
  normalizeEmbeddingVector,
} from "../src/embedding-provider.js";

test("chooseEmbeddingModel prefers embedding-specialized model ids", () => {
  const model = chooseEmbeddingModel([
    { id: "qwen-4b-instruct" },
    { id: "nomic-embed-text-v1.5" },
    { id: "another-chat-model" },
  ]);

  assert.equal(model, "nomic-embed-text-v1.5");
});

test("normalizeEmbeddingVector returns a unit vector", () => {
  const vector = normalizeEmbeddingVector([3, 4]);
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  assert.ok(Math.abs(magnitude - 1) < 0.000001);
});

test("OpenAI-compatible embedding provider batches and normalizes vectors", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith("/models")) {
      return Response.json({
        data: [{ id: "chat-4b" }, { id: "bge-small-en-v1.5" }],
      });
    }

    const body = JSON.parse(options.body);
    assert.equal(body.model, "bge-small-en-v1.5");
    return Response.json({
      data: body.input.map((_, index) => ({
        index,
        embedding: index === 0 ? [3, 4] : [0, 2],
      })),
    });
  };

  const provider = createEmbeddingProvider({
    env: {
      EMBEDDING_MODE: "openai-compatible",
      EMBEDDING_BASE_URL: "http://127.0.0.1:1234/v1",
      EMBEDDING_BATCH_SIZE: "2",
    },
    fetchImpl,
  });
  const result = await provider.embedMany(["alpha", "beta"]);

  assert.equal(result.provider, "openai-compatible");
  assert.equal(result.model, "bge-small-en-v1.5");
  assert.equal(result.dimensions, 2);
  assert.deepEqual(result.vectors[0], [0.6, 0.8]);
  assert.equal(calls.some((call) => String(call.url).endsWith("/embeddings")), true);
});
