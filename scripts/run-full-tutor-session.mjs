import { getConceptById } from "../src/concepts.js";
import { createInitialMemory, generateWhiteboardArtifact, updateMemoryAfterTeachBack } from "../src/tutor-engine.js";
import { scoreTutorReply } from "../src/tutor-eval.js";

const args = new Set(process.argv.slice(2));
const jsonOutput = args.has("--json");
const baseUrl = (process.env.TUTOR_SESSION_BASE_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");

const concept = getConceptById("docker-containers");
const artifact = generateWhiteboardArtifact({ concept });
const profile = {
  learningStyle: "visual",
  depth: "simple",
  tone: "encouraging",
  strugglingConcepts: ["Docker Containers"],
  confidenceLevel: 42,
  motivationLevel: 76,
  assessmentHistory: [
    {
      conceptId: "docker-containers",
      conceptName: "Docker Containers",
      score: 42,
      source: "precheck",
      missingPoints: [
        "Images are templates and containers are running instances",
        "Volumes persist data outside the container lifecycle",
      ],
      misconceptions: ["Containers are the same as virtual machines"],
      createdAt: Date.now() - 120000,
    },
  ],
};

const firstMessage =
  "I think containers are basically tiny virtual machines. If I delete the container, I guess the image and all its data go away too?";
const secondMessage =
  "So the image is like a template, the container is the running copy, and volumes hold data outside it. Is that why two containers can come from one image?";
const teachBack =
  "A Docker image is the template and a container is the running instance made from it. A container packages the app with dependencies, shares the host OS kernel instead of being a full virtual machine, and a volume keeps important data outside the container lifecycle.";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${body.error || response.statusText}`);
  }
  return body;
}

async function post(path, body) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const health = await request("/api/health");
const llmHealth = await request("/api/llm/health");
const kb = await request("/api/kb");

const first = await post("/api/tutor", {
  concept,
  profile,
  mode: "explainer",
  message: firstMessage,
  history: [],
});

const second = await post("/api/tutor", {
  concept,
  profile,
  mode: "socratic",
  message: secondMessage,
  history: [
    { role: "user", content: firstMessage },
    { role: "assistant", content: first.content },
  ],
});

const analysis = await post("/api/analyze", {
  concept,
  profile,
  explanation: teachBack,
  learningGoal: "Understand images, containers, and volumes well enough to debug a local app.",
});

const quiz = await post("/api/quiz", {
  concept,
  profile: {
    ...profile,
    assessmentHistory: [
      {
        conceptId: "docker-containers",
        conceptName: "Docker Containers",
        score: analysis.accuracy,
        source: "teach-back",
        missingPoints: analysis.missingPoints || [],
        misconceptions: analysis.misconceptions || [],
        createdAt: Date.now(),
      },
      ...profile.assessmentHistory,
    ],
  },
  count: 4,
  learningGoal: "Prepare for Docker troubleshooting questions.",
});

await post("/api/learner/events", {
  type: "quiz_completed",
  concept,
  score: 100,
  questionCount: quiz.questions?.length || 0,
  provider: quiz.provider,
  model: quiz.model,
  evidenceTrace: quiz.evidenceTrace,
  sources: quiz.sources,
  source: "full-session-smoke",
});

const memory = updateMemoryAfterTeachBack(createInitialMemory(concept.id), analysis.accuracy);
const stateResponse = await request("/api/learner/state", {
  method: "PUT",
  body: JSON.stringify({
    state: {
      updatedAt: Date.now(),
      selectedConceptId: concept.id,
      learningGoal: "Understand Docker images, containers, and volumes for DevOps troubleshooting.",
      activeMode: "socratic",
      profile,
      memory: { [concept.id]: memory },
      messages: {
        [concept.id]: [
          { role: "user", content: firstMessage, conceptId: concept.id },
          first,
          { role: "user", content: secondMessage, conceptId: concept.id },
          second,
        ],
      },
      lastTeachBack: analysis,
      quiz: {
        conceptId: concept.id,
        questions: quiz.questions || [],
        index: 0,
        answers: {},
        checked: false,
        complete: false,
        provider: quiz.provider,
        model: quiz.model,
        sources: quiz.sources,
        evidenceTrace: quiz.evidenceTrace,
      },
    },
  }),
});

const journal = await request("/api/learner/events?limit=12");
const resume = await request("/api/learner/resume");
const citationNotebook = await request(`/api/learner/citations?conceptId=${concept.id}`);
const courseOutline = await post("/api/learner/course-outline", {
  concept,
  goal: "Understand Docker images, containers, and volumes for DevOps troubleshooting.",
  state: stateResponse.state,
});
const lesson = await post("/api/learner/lesson-script", {
  concept,
  goal: "Understand Docker images, containers, and volumes for DevOps troubleshooting.",
  state: stateResponse.state,
});

const evalBase = {
  concept,
  profile,
  expectedKeyPoints: concept.keyPoints.slice(0, 4),
  expectedMisconceptions: concept.commonMisconceptions.slice(0, 3),
  requiresCitation: true,
};
const firstScore = scoreTutorReply({
  ...evalBase,
  id: "full-session-explainer",
  mode: "explainer",
  message: firstMessage,
  passScore: 72,
}, first);
const secondScore = scoreTutorReply({
  ...evalBase,
  id: "full-session-socratic",
  mode: "socratic",
  message: secondMessage,
  passScore: 68,
}, second);

const checks = [
  { id: "health", pass: Boolean(health.ok), detail: health.name || "" },
  { id: "llm-diagnostics", pass: Boolean(llmHealth.ok || llmHealth.troubleshooting?.length), detail: llmHealth.ok ? String(llmHealth.model || "") : String(llmHealth.reason || "") },
  { id: "kb-indexed", pass: Number(kb.chunkCount || 0) > 0, detail: `${kb.documentCount} docs / ${kb.chunkCount} chunks` },
  { id: "first-tutor-score", pass: firstScore.pass, detail: `${firstScore.total}/${firstScore.passScore}` },
  { id: "second-tutor-score", pass: secondScore.pass, detail: `${secondScore.total}/${secondScore.passScore}` },
  { id: "first-live-self-eval", pass: Number(first.quality?.total || 0) >= 70, detail: `${first.quality?.total || 0}/${first.quality?.passScore || 70}` },
  { id: "second-live-self-eval", pass: Number(second.quality?.total || 0) >= 60, detail: `${second.quality?.total || 0}/${second.quality?.passScore || 70}` },
  { id: "first-citations", pass: Number(first.evidenceTrace?.citationCoverage || 0) > 0, detail: String(first.evidenceTrace?.citationCoverage || 0) },
  { id: "second-citations", pass: Number(second.evidenceTrace?.citationCoverage || 0) > 0, detail: String(second.evidenceTrace?.citationCoverage || 0) },
  { id: "teachback-score", pass: Number(analysis.accuracy || 0) >= 75, detail: `${analysis.accuracy}%` },
  { id: "teachback-citations", pass: Number(analysis.evidenceTrace?.citationCoverage || 0) > 0, detail: String(analysis.evidenceTrace?.citationCoverage || 0) },
  { id: "quiz-generated", pass: (quiz.questions || []).length >= 3, detail: `${(quiz.questions || []).length} questions` },
  { id: "quiz-citations", pass: Number(quiz.evidenceTrace?.citationCoverage || 0) > 0, detail: String(quiz.evidenceTrace?.citationCoverage || 0) },
  { id: "journal-recorded", pass: Number(journal.summary?.totalEvents || 0) >= 5, detail: `${journal.summary?.totalEvents || 0} events` },
  { id: "citation-notebook", pass: Number(citationNotebook.notebook?.sourceCount || 0) > 0, detail: `${citationNotebook.notebook?.sourceCount || 0} sources` },
  { id: "citation-coverage", pass: Number(citationNotebook.notebook?.averageCitationCoverage || 0) > 0, detail: String(citationNotebook.notebook?.averageCitationCoverage || 0) },
  { id: "course-outline", pass: Number(courseOutline.outline?.modules?.length || 0) >= 3, detail: `${courseOutline.outline?.modules?.length || 0} modules` },
  { id: "course-source-coverage", pass: Number(courseOutline.outline?.sourceCoverage?.chunkCount || 0) > 0, detail: `${courseOutline.outline?.sourceCoverage?.readyModules || 0}/${courseOutline.outline?.sourceCoverage?.totalModules || 0} source-ready` },
  { id: "whiteboard-artifact", pass: Boolean(artifact.diagram?.nodeCount && artifact.workedExample?.steps?.length >= 3), detail: `${artifact.diagram?.nodeCount || 0} nodes` },
  { id: "state-saved", pass: Boolean(stateResponse.summary?.messageCount), detail: `${stateResponse.summary?.messageCount || 0} messages` },
  { id: "resume-ready", pass: Boolean(resume.resume?.actions?.length), detail: resume.resume?.headline || "" },
  { id: "lesson-script", pass: (lesson.script?.steps || []).length >= 5, detail: `${lesson.script?.steps?.length || 0} steps` },
  { id: "lesson-current-step", pass: Boolean(lesson.script?.currentStep?.view), detail: lesson.script?.currentStep?.title || "" },
];

const report = {
  baseUrl,
  providers: {
    first: first.provider,
    second: second.provider,
    teachBack: analysis.provider,
    quiz: quiz.provider,
  },
  fallbackReasons: [first, second, analysis, quiz]
    .map((item) => item.fallbackReason)
    .filter(Boolean),
  llmHealth,
  transcript: [
    { role: "learner", content: firstMessage },
    { role: "tutor", mode: "explainer", content: first.content, score: firstScore, selfEval: first.quality },
    { role: "learner", content: secondMessage },
    { role: "tutor", mode: "socratic", content: second.content, score: secondScore, selfEval: second.quality },
    { role: "learner-teach-back", content: teachBack },
    {
      role: "system-teach-back-analysis",
      accuracy: analysis.accuracy,
      missingPoints: analysis.missingPoints,
      misconceptions: analysis.misconceptions,
      suggestions: analysis.suggestions,
      refinedExplanation: analysis.refinedExplanation,
    },
    {
      role: "system-quiz",
      questionCount: quiz.questions?.length || 0,
      questions: (quiz.questions || []).map((question) => ({
        question: question.question,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      })),
    },
  ],
  journal: journal.summary,
  citationNotebook: citationNotebook.notebook,
  courseOutline: courseOutline.outline,
  whiteboardArtifact: artifact,
  stateSummary: stateResponse.summary,
  resume: resume.resume,
  lessonScript: lesson.script,
  checks,
  pass: checks.every((check) => check.pass),
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Full tutor session against ${baseUrl}`);
  console.log(`Providers: tutor=${first.provider}/${second.provider}, teach-back=${analysis.provider}, quiz=${quiz.provider}`);
  console.log(`LM Studio: ${llmHealth.ok ? `ok (${llmHealth.model || "auto"})` : `not reachable (${llmHealth.reason || "unknown"})`}`);
  if (report.fallbackReasons.length) console.log(`Fallback reasons: ${[...new Set(report.fallbackReasons)].join(" | ")}`);
  console.log("");
  for (const item of report.transcript) {
    if (item.role === "learner" || item.role === "tutor" || item.role === "learner-teach-back") {
      console.log(`${item.role.toUpperCase()}${item.mode ? ` (${item.mode})` : ""}:`);
      console.log(item.content);
      if (item.score) console.log(`Score: ${item.score.total}/${item.score.passScore}`);
      if (item.selfEval) console.log(`Self-eval: ${item.selfEval.total}/${item.selfEval.passScore}`);
      console.log("");
    }
  }
  console.log(`Teach-back accuracy: ${analysis.accuracy}%`);
  console.log(`Quiz questions: ${quiz.questions?.length || 0}`);
  console.log(`Resume headline: ${resume.resume?.headline || ""}`);
  console.log(`Course outline: ${courseOutline.outline?.modules?.length || 0} modules`);
  console.log(`Lesson script: ${lesson.script?.steps?.length || 0} steps, current="${lesson.script?.currentStep?.title || ""}"`);
  console.log("");
  for (const check of checks) {
    console.log(`${check.pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  }
}

process.exitCode = report.pass ? 0 : 1;
