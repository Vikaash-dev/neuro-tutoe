import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseModelId,
  diagnoseLlmProbeFailure,
  extractJson,
  getLlmConfig,
  messageTextCandidates,
} from "../src/local-llm.js";

test("extractJson parses plain JSON", () => {
  assert.deepEqual(extractJson('{"ok":true,"items":[1,2]}'), {
    ok: true,
    items: [1, 2],
  });
});

test("extractJson parses fenced JSON", () => {
  const parsed = extractJson(`
    Here is the result:
    \`\`\`json
    {"content":"hello","followUps":["a"]}
    \`\`\`
  `);

  assert.equal(parsed.content, "hello");
  assert.deepEqual(parsed.followUps, ["a"]);
});

test("extractJson parses LM Studio reasoning_content JSON", () => {
  const candidates = messageTextCandidates({
    message: {
      content: "",
      reasoning_content: '{\n  "content": "OK",\n  "followUps": []\n}',
    },
    finish_reason: "stop",
  });

  assert.equal(candidates.length, 1);
  assert.deepEqual(extractJson(candidates[0]), {
    content: "OK",
    followUps: [],
  });
});

test("messageTextCandidates supports OpenAI-compatible content arrays", () => {
  const candidates = messageTextCandidates({
    message: {
      content: [
        { type: "text", text: '{"ok":true}' },
        { type: "input_text", text: "" },
      ],
    },
  });

  assert.deepEqual(candidates, ['{"ok":true}']);
});

test("LLM config defaults to LM Studio endpoint and one shared model", () => {
  const config = getLlmConfig();

  assert.equal(config.baseUrl, "http://192.168.1.7:1234/v1");
  assert.equal(config.sameModelForTutorAndEvaluator, true);
  assert.equal(config.enabled, true);
});

test("model discovery prefers a loaded 4B model", () => {
  const model = chooseModelId([
    { id: "mythomax-l2-13b" },
    { id: "nvidia/nemotron-3-nano-4b" },
    { id: "qwen/qwen3.5-9b" },
  ]);

  assert.equal(model, "nvidia/nemotron-3-nano-4b");
});

test("diagnoseLlmProbeFailure explains LM Studio TCP failures", () => {
  const diagnostics = diagnoseLlmProbeFailure(new TypeError("fetch failed"), {
    enabled: true,
    baseUrl: "http://192.168.1.7:1234/v1",
    model: "auto",
  });

  assert.equal(diagnostics.modelsUrl, "http://192.168.1.7:1234/v1/models");
  assert.ok(diagnostics.troubleshooting.some((step) => /port 1234/i.test(step)));
  assert.ok(diagnostics.troubleshooting.some((step) => /0\.0\.0\.0|network access/i.test(step)));
});

test("diagnoseLlmProbeFailure catches missing /v1 base URL", () => {
  const diagnostics = diagnoseLlmProbeFailure(new Error("Model discovery failed: 404"), {
    enabled: true,
    baseUrl: "http://localhost:1234",
    model: "auto",
  });

  assert.ok(diagnostics.troubleshooting.some((step) => /\/v1/i.test(step)));
});

test("fallback tutor replies cite retrieved sources when LLM is disabled", async () => {
  const previous = process.env.LLM_ENABLED;
  process.env.LLM_ENABLED = "false";
  try {
    const module = await import(`../src/local-llm.js?fallback-citations=${Date.now()}`);
    const reply = await module.generateTutorReplyWithLlm({
      conceptId: "docker-containers",
      mode: "explainer",
      message: "I think containers are tiny virtual machines.",
      retrieval: {
        query: "containers images volumes",
        sources: [
          {
            id: "S1",
            title: "Docker Containers concept card",
            source: "built-in concept map",
            section: "Core ideas",
            snippet: "Images are templates and containers are running instances.",
          },
        ],
      },
    });

    assert.equal(reply.provider, "fallback");
    assert.match(reply.content, /\[S1\]/);
    assert.equal(reply.evidenceTrace.citedSourceCount, 1);
    assert.equal(reply.evidenceTrace.citationCoverage, 1);
  } finally {
    if (previous === undefined) delete process.env.LLM_ENABLED;
    else process.env.LLM_ENABLED = previous;
  }
});
