import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildKnowledgeBase,
  conceptDocuments,
  retrieveKnowledgeContext,
} from "../src/knowledge-base.js";
import { CONCEPTS } from "../src/concepts.js";
import { generateTutorReplyWithLlm, probeLlm } from "../src/local-llm.js";
import { resolveConcept } from "../src/tutor-engine.js";
import {
  runTutorQualityEval,
  runTutorQualityEvalWithProvider,
} from "../src/tutor-eval.js";

const args = new Set(process.argv.slice(2));
const useLlm = args.has("--llm");
const requireLlm = args.has("--require-llm");
const jsonOutput = args.has("--json");
const datasetPath = resolve(process.cwd(), "data/tutor-quality-evals.json");

async function loadEvalCases() {
  const raw = await readFile(datasetPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.cases) ? parsed.cases : [];
}

function retrievalForCase(kb, evalCase) {
  const concept = resolveConcept(evalCase.concept || evalCase.conceptId || evalCase.topic);
  const query = [
    "tutor-quality-eval",
    concept.name,
    concept.description,
    evalCase.message,
    ...(evalCase.expectedKeyPoints || []),
    ...(evalCase.expectedMisconceptions || []),
  ].filter(Boolean).join("\n");

  return {
    concept,
    retrieval: retrieveKnowledgeContext(kb, {
      query,
      conceptId: concept.id,
      prerequisiteConceptIds: concept.prerequisites,
      relatedConceptIds: concept.relatedConcepts,
      maxPerDocument: 3,
      topK: 5,
      maxChars: 5200,
    }),
  };
}

function printReport(report, mode, llmHealth = null) {
  console.log(`Tutor quality eval mode: ${mode}`);
  if (llmHealth) {
    console.log(`LM Studio health: ${llmHealth.ok ? "ok" : "not reachable"}${llmHealth.reason ? ` (${llmHealth.reason})` : ""}`);
  }
  console.log(`Cases: ${report.summary.passCount}/${report.summary.caseCount} passing`);
  console.log(`Average: ${report.summary.averageScore}`);
  if (report.summary.providers?.length) console.log(`Providers: ${report.summary.providers.join(", ")}`);
  if (Number.isFinite(report.summary.fallbackCount)) console.log(`Fallback responses: ${report.summary.fallbackCount}`);
  console.log("");

  for (const result of report.results) {
    const status = result.pass ? "PASS" : "FAIL";
    const provider = result.model ? `${result.provider}/${result.model}` : result.provider;
    console.log(`${status} ${result.id}: ${result.total}/${result.passScore} (${provider})`);
    if (result.fallbackReason) console.log(`  fallback: ${result.fallbackReason}`);
  }
}

const cases = await loadEvalCases();
let report;
let llmHealth = null;

if (useLlm) {
  const kb = buildKnowledgeBase(conceptDocuments(CONCEPTS));
  llmHealth = await probeLlm();
  report = await runTutorQualityEvalWithProvider(cases, async (evalCase) => {
    const { concept, retrieval } = retrievalForCase(kb, evalCase);
    return generateTutorReplyWithLlm({
      concept,
      mode: evalCase.mode || "explainer",
      message: evalCase.message || "",
      profile: evalCase.profile || {},
      retrieval,
    });
  });
} else {
  report = runTutorQualityEval(cases);
}

if (jsonOutput) {
  console.log(JSON.stringify({ mode: useLlm ? "lmstudio" : "deterministic", llmHealth, ...report }, null, 2));
} else {
  printReport(report, useLlm ? "lmstudio" : "deterministic", llmHealth);
}

const allPassed = report.summary.passCount === report.summary.caseCount;
const llmRequiredButMissing = requireLlm && (!llmHealth?.ok || report.summary.fallbackCount > 0);

if (llmRequiredButMissing && !jsonOutput) {
  console.log("");
  console.log("LLM required: failed because LM Studio was unavailable or at least one response used fallback.");
}

process.exitCode = allPassed && !llmRequiredButMissing ? 0 : 1;
