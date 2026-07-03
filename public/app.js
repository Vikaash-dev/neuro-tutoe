import { CONCEPTS, createCustomConcept, getConceptById } from "/src/concepts.js";
import {
  analyzeTeachBack,
  buildTeachingSnapshot,
  buildTutorSessionState,
  createInitialMemory,
  estimateRetention,
  generateLearningPath,
  generateQuiz,
  generateTutorReply,
  generateWhiteboardArtifact,
  identifyWeakAreas,
  inferSkillGaps,
  masteryPercent,
  recommendResources,
  updateLearnerProfileAfterAssessment,
  updateMemoryAfterTeachBack,
  updateMemoryAfterQuiz,
} from "/src/tutor-engine.js";
import { scoreTutorReply } from "/src/tutor-eval.js";
import {
  NOTEBOOK_SAATHI_INITIAL_ATTEMPTS,
  buildNotebookSaathiDemoSummary,
  formatNotebookSaathiRows,
  parseNotebookSaathiRows,
} from "/src/notebook-saathi.js";

const STORAGE_KEY = "neuroTutorWebState.v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
let hadLocalState = false;

const defaultState = {
  selectedConceptId: "docker-containers",
  customConcepts: [],
  memory: {},
  messages: {},
  quiz: null,
  profile: {
    learningStyle: "visual",
    depth: "moderate",
    tone: "encouraging",
    knownConcepts: [],
    strugglingConcepts: [],
    confidenceLevel: 50,
    motivationLevel: 75,
    assessmentHistory: [],
    lastUpdated: null,
  },
  activeMode: "explainer",
  lastTeachBack: null,
  learningGoal: "Build durable understanding of the selected concept",
  updatedAt: null,
};

let state = loadState();
let kbStats = null;
let kbSearchResults = [];
let kbSelectedDocumentId = "";
let kbSelectedDocumentChunks = [];
let llmHealth = null;
let learnerJournalSummary = null;
let learnerStateSummary = null;
let learnerStateSaveTimer = null;
let smartResume = null;
let lessonScript = null;
let lessonScriptSaved = false;
let citationNotebook = null;
let courseOutline = null;
let notebookSaathiInput = formatNotebookSaathiRows(NOTEBOOK_SAATHI_INITIAL_ATTEMPTS);
let notebookSaathiSummary = buildNotebookSaathiDemoSummary();
let notebookSaathiApproved = new Set();

function allConcepts() {
  return [...CONCEPTS, ...state.customConcepts];
}

function currentConcept() {
  return allConcepts().find((concept) => concept.id === state.selectedConceptId) || allConcepts()[0];
}

function currentMemory() {
  const concept = currentConcept();
  if (!state.memory[concept.id]) state.memory[concept.id] = createInitialMemory(concept.id);
  return state.memory[concept.id];
}

function currentSessionState() {
  const concept = currentConcept();
  return buildTutorSessionState({
    concept,
    memory: state.memory[concept.id] || createInitialMemory(concept.id),
    profile: state.profile,
  });
}

function memorySnapshot() {
  const snapshot = { ...state.memory };
  for (const concept of allConcepts()) {
    if (!snapshot[concept.id]) snapshot[concept.id] = createInitialMemory(concept.id);
  }
  return snapshot;
}

function loadState() {
  const base = structuredClone(defaultState);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    hadLocalState = Boolean(saved);
    return saved
      ? {
          ...base,
          ...saved,
          profile: {
            ...base.profile,
            ...(saved.profile || {}),
          },
        }
      : base;
  } catch {
    return base;
  }
}

function saveState(options = {}) {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (options.sync !== false) scheduleLearnerStateSave();
}

function learnerStateSnapshot() {
  return {
    selectedConceptId: state.selectedConceptId,
    customConcepts: state.customConcepts,
    memory: state.memory,
    messages: state.messages,
    profile: state.profile,
    activeMode: state.activeMode,
    lastTeachBack: state.lastTeachBack,
    learningGoal: state.learningGoal,
    quiz: state.quiz,
    updatedAt: state.updatedAt || Date.now(),
  };
}

function applyLearnerStateSnapshot(snapshot = {}) {
  state = {
    ...structuredClone(defaultState),
    ...snapshot,
    profile: {
      ...structuredClone(defaultState.profile),
      ...(snapshot.profile || {}),
    },
    customConcepts: Array.isArray(snapshot.customConcepts) ? snapshot.customConcepts : [],
    memory: snapshot.memory && typeof snapshot.memory === "object" ? snapshot.memory : {},
    messages: snapshot.messages && typeof snapshot.messages === "object" ? snapshot.messages : {},
    quiz: snapshot.quiz && Array.isArray(snapshot.quiz.questions) ? snapshot.quiz : null,
    lastTeachBack: snapshot.lastTeachBack || null,
  };
}

function scheduleLearnerStateSave() {
  clearTimeout(learnerStateSaveTimer);
  learnerStateSaveTimer = setTimeout(syncLearnerStateToServer, 800);
}

async function syncLearnerStateToServer() {
  try {
    const response = await fetch("/api/learner/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: learnerStateSnapshot() }),
    });
    if (!response.ok) throw new Error("Learner state save failed");
    const result = await response.json();
    learnerStateSummary = result.summary || learnerStateSummary;
    await refreshSmartResume({ render: false });
    await refreshLessonScript({ render: false });
    await refreshCourseOutline({ render: false });
    renderDashboard();
    renderChat();
  } catch {
    // Browser localStorage remains available when server persistence is offline.
  }
}

async function hydrateLearnerStateFromServer() {
  try {
    const response = await fetch("/api/learner/state");
    if (!response.ok) throw new Error("Learner state unavailable");
    const result = await response.json();
    learnerStateSummary = result.summary || null;
    const serverState = result.state || {};
    const serverUpdatedAt = Number(serverState.updatedAt || 0);
    const localUpdatedAt = Number(state.updatedAt || 0);
    if (serverUpdatedAt > 0 && (!hadLocalState || serverUpdatedAt > localUpdatedAt)) {
      applyLearnerStateSnapshot(serverState);
      saveState({ sync: false });
      if (!state.memory[state.selectedConceptId]) currentMemory();
      if (!state.messages[state.selectedConceptId]) setConcept(state.selectedConceptId);
      renderAll();
    } else if (hadLocalState && localUpdatedAt > serverUpdatedAt) {
      scheduleLearnerStateSave();
    } else {
      renderChat();
    }
  } catch {
    learnerStateSummary = null;
  }
}

async function recordLearnerEvent(payload = {}) {
  try {
    const response = await fetch("/api/learner/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Learner journal failed");
    const result = await response.json();
    learnerJournalSummary = result.summary || learnerJournalSummary;
    await refreshCitationNotebook({ render: false });
  } catch {
    // Local state remains the source of truth if the server journal is unavailable.
  }
}

async function refreshLearnerJournal() {
  try {
    const response = await fetch("/api/learner/events?limit=6");
    if (!response.ok) throw new Error("Learner journal unavailable");
    const result = await response.json();
    learnerJournalSummary = result.summary || null;
    await refreshCitationNotebook({ render: false });
  } catch {
    learnerJournalSummary = null;
  }
  renderChat();
}

async function refreshCitationNotebook(options = {}) {
  try {
    const response = await fetch(`/api/learner/citations?conceptId=${encodeURIComponent(currentConcept().id)}`);
    if (!response.ok) throw new Error("Citation notebook unavailable");
    const result = await response.json();
    citationNotebook = result.notebook || null;
  } catch {
    citationNotebook = null;
  }
  if (options.render !== false) renderProgress();
}

async function refreshLlmHealth(options = {}) {
  try {
    const response = await fetch("/api/llm/health");
    if (!response.ok) throw new Error("LLM health unavailable");
    llmHealth = await response.json();
  } catch (error) {
    llmHealth = {
      ok: false,
      reason: error instanceof Error ? error.message : "LLM health unavailable",
      troubleshooting: ["Check whether the tutor server is running."],
    };
  }
  if (options.render !== false) {
    renderDashboard();
    renderChat();
  }
}

async function refreshSmartResume(options = {}) {
  try {
    const response = await fetch("/api/learner/resume");
    if (!response.ok) throw new Error("Smart resume unavailable");
    const result = await response.json();
    smartResume = result.resume || null;
  } catch {
    smartResume = null;
  }
  if (options.render !== false) renderDashboard();
}

async function refreshLessonScript(options = {}) {
  try {
    const response = await fetch(`/api/learner/lesson-script?conceptId=${encodeURIComponent(currentConcept().id)}`);
    if (!response.ok) throw new Error("Lesson script unavailable");
    const result = await response.json();
    lessonScript = result.script || null;
    lessonScriptSaved = Boolean(result.saved);
  } catch {
    lessonScript = null;
    lessonScriptSaved = false;
  }
  if (options.render !== false) renderPlan();
}

async function refreshCourseOutline(options = {}) {
  try {
    const response = await fetch("/api/learner/course-outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept: currentConcept(),
        goal: state.learningGoal,
        state: learnerStateSnapshot(),
      }),
    });
    if (!response.ok) throw new Error("Course outline unavailable");
    const result = await response.json();
    courseOutline = result.outline || null;
  } catch {
    courseOutline = null;
  }
  if (options.render !== false) renderPlan();
}

async function generateAndSaveLessonScript() {
  const button = $("#generateLessonScriptButton");
  if (button) button.disabled = true;
  try {
    const concept = currentConcept();
    const response = await fetch("/api/learner/lesson-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept,
        goal: state.learningGoal,
        state: learnerStateSnapshot(),
      }),
    });
    if (!response.ok) throw new Error("Could not save lesson script");
    const result = await response.json();
    lessonScript = result.script || null;
    lessonScriptSaved = true;
  } catch {
    lessonScript = null;
    lessonScriptSaved = false;
  } finally {
    if (button) button.disabled = false;
  }
  renderPlan();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function guardrailLevel(item = {}) {
  const level = item?.guardrail?.riskLevel || "none";
  return level === "none" ? "" : level;
}

function renderGuardrailBadge(item = {}) {
  const level = guardrailLevel(item);
  if (!level) return "";
  const findings = (item.guardrail?.findings || []).map((finding) => finding.id).join(", ");
  return `<span class="risk-chip risk-${escapeHtml(level)}" title="${escapeHtml(findings)}">${escapeHtml(level)} risk</span>`;
}

function renderSources(sources = []) {
  if (!Array.isArray(sources) || sources.length === 0) return "";
  return `
    <div class="source-list" aria-label="Retrieved sources">
      ${sources
        .map(
          (source) => `
            <span class="source-chip ${guardrailLevel(source) ? "source-chip-risk" : ""}" title="${escapeHtml(source.source || "")}">
              ${escapeHtml(source.id || "S")} ${escapeHtml(source.title || "Source")}
              ${renderGuardrailBadge(source)}
            </span>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEvidenceTrace(trace = null) {
  if (!trace || !trace.sourceCount) return "";
  const invalid = Array.isArray(trace.missingLabels) && trace.missingLabels.length
    ? `, invalid: ${trace.missingLabels.map((label) => escapeHtml(label)).join(", ")}`
    : "";
  return `
    <div class="evidence-trace" title="Retrieved chunks cited by bracket labels such as [S1]">
      Evidence trace: ${Number(trace.citedSourceCount || 0)} / ${Number(trace.sourceCount || 0)} source chunks cited${invalid}
    </div>
  `;
}

function compactSvgLabel(value = "", max = 18) {
  const text = String(value || "").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function qualityClass(quality = {}) {
  if (quality.pass === false) return "needs-work";
  if (Number(quality.total || 0) >= 85) return "strong";
  return "ok";
}

function renderTutorQuality(quality = null) {
  if (!quality || !Number.isFinite(Number(quality.total))) return "";
  const criteria = Object.entries(quality.criteria || {})
    .map(([name, item]) => ({
      name,
      score: Number(item?.score || 0),
      evidence: item?.evidence || "",
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const label = quality.pass ? "passed" : "review";

  return `
    <div class="tutor-quality ${qualityClass(quality)}">
      <div class="quality-main">
        <strong>Tutor self-check ${Number(quality.total || 0)}/${Number(quality.passScore || 70)}</strong>
        <span>${escapeHtml(label)}</span>
      </div>
      ${
        criteria.length
          ? `<div class="quality-criteria">
              ${criteria.map((item) => `<span title="${escapeHtml(item.evidence)}">${escapeHtml(item.name)} ${item.score}</span>`).join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderArtifactDiagram(artifact = {}) {
  const nodes = Array.isArray(artifact.nodes) ? artifact.nodes : [];
  const edges = Array.isArray(artifact.edges) ? artifact.edges : [];
  const target = nodes.find((node) => node.kind === "target") || nodes[0];
  const prereqs = nodes.filter((node) => node.kind === "prerequisite");
  const related = nodes.filter((node) => node.kind === "related");
  const positions = new Map();

  if (target) positions.set(target.id, { x: 170, y: 105 });
  prereqs.slice(0, 3).forEach((node, index) => positions.set(node.id, { x: 62, y: 54 + index * 52 }));
  related.slice(0, 3).forEach((node, index) => positions.set(node.id, { x: 278, y: 54 + index * 52 }));

  const lines = edges
    .map((edge) => {
      const source = positions.get(edge.source);
      const targetPosition = positions.get(edge.target);
      if (!source || !targetPosition) return "";
      const midX = (source.x + targetPosition.x) / 2;
      const midY = (source.y + targetPosition.y) / 2;
      return `
        <line class="artifact-edge" x1="${source.x}" y1="${source.y}" x2="${targetPosition.x}" y2="${targetPosition.y}"></line>
        <text class="artifact-edge-label" x="${midX}" y="${midY - 5}">${escapeHtml(edge.label || "")}</text>
      `;
    })
    .join("");

  const circles = nodes
    .filter((node) => positions.has(node.id))
    .map((node) => {
      const position = positions.get(node.id);
      const radius = node.kind === "target" ? 38 : 30;
      return `
        <g class="artifact-node artifact-${escapeHtml(node.kind || "related")}">
          <circle cx="${position.x}" cy="${position.y}" r="${radius}"></circle>
          <text x="${position.x}" y="${position.y + 4}">${escapeHtml(compactSvgLabel(node.label, node.kind === "target" ? 20 : 15))}</text>
        </g>
      `;
    })
    .join("");

  return `
    <svg class="artifact-diagram" viewBox="0 0 340 210" role="img" aria-label="${escapeHtml(artifact.title || "Whiteboard diagram")}">
      ${lines}
      ${circles}
    </svg>
  `;
}

function renderWhiteboardArtifact(artifact = {}) {
  const contrast = artifact.misconceptionContrast || {};
  const example = artifact.workedExample || {};

  return `
    <article class="whiteboard-card">
      <p class="eyebrow">Whiteboard artifact</p>
      <h3>${escapeHtml(artifact.title || "Whiteboard")}</h3>
      ${renderArtifactDiagram(artifact)}
      <section class="artifact-section">
        <strong>Misconception contrast</strong>
        <p><span>Trap:</span> ${escapeHtml(contrast.misconception || "No misconception recorded.")}</p>
        <p><span>Repair:</span> ${escapeHtml(contrast.correction || "Use the core mechanism.")}</p>
      </section>
      <section class="artifact-section">
        <strong>Worked example</strong>
        <p>${escapeHtml(example.prompt || "Apply the concept to a real scenario.")}</p>
        <ol>
          ${(example.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </section>
      <div class="pill-row">
        ${(artifact.notes || []).map((note) => `<span class="pill">${escapeHtml(note)}</span>`).join("")}
      </div>
    </article>
  `;
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays <= 0) return "Review now";
  if (diffDays === 1) return "Review tomorrow";
  return `Review in ${diffDays} days`;
}

function setView(viewName) {
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${viewName}View`)?.classList.add("active");
  $$(".nav-button").forEach((button) => {
    const active = button.dataset.view === viewName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  renderAll();
}

function setConcept(conceptId) {
  state.selectedConceptId = conceptId;
  lessonScript = null;
  lessonScriptSaved = false;
  citationNotebook = null;
  courseOutline = null;
  currentMemory();
  if (!state.messages[conceptId]) {
    const concept = currentConcept();
    state.messages[conceptId] = [
      {
        id: `welcome-${conceptId}`,
        role: "assistant",
        content: buildTeachingSnapshot(concept, state.profile),
      },
    ];
  }
  saveState();
  renderAll();
  refreshLessonScript();
  refreshCourseOutline();
  refreshCitationNotebook();
}

function updateProfileFromControls() {
  state.profile.learningStyle = $("#learningStyle").value;
  state.profile.depth = $("#depth").value;
  state.profile.tone = $("#tone").value;
  saveState();
}

function syncProfileControls() {
  $("#learningStyle").value = state.profile.learningStyle;
  $("#depth").value = state.profile.depth;
  $("#tone").value = state.profile.tone;
}

function compactProfileList(values = [], fallback = "None yet") {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  if (items.length === 0) return fallback;
  const visible = items.slice(0, 3).join(", ");
  return items.length > 3 ? `${visible}, +${items.length - 3} more` : visible;
}

function profilePercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.max(0, Math.min(100, number)));
}

function renderProfileInsights() {
  const mount = $("#profileInsightList");
  if (!mount) return;
  const confidence = profilePercent(state.profile.confidenceLevel, 50);
  const motivation = profilePercent(state.profile.motivationLevel, 75);

  mount.innerHTML = `
    <div class="profile-insight">
      <span>Confidence</span>
      <strong>${confidence}%</strong>
    </div>
    <div class="profile-insight">
      <span>Motivation</span>
      <strong>${motivation}%</strong>
    </div>
    <div class="profile-insight">
      <span>Known</span>
      <strong>${escapeHtml(compactProfileList(state.profile.knownConcepts, "Building"))}</strong>
    </div>
    <div class="profile-insight">
      <span>Needs review</span>
      <strong>${escapeHtml(compactProfileList(state.profile.strugglingConcepts, "Clear"))}</strong>
    </div>
  `;
}

function renderSmartResume() {
  const panel = $("#smartResumePanel");
  const headline = $("#resumeHeadline");
  if (!panel || !headline) return;

  if (!smartResume) {
    headline.textContent = "Pick up where you left off";
    panel.innerHTML = `<div class="note">Resume loading from server state.</div>`;
    return;
  }

  const signals = smartResume.learnerSignals || {};
  const actions = smartResume.actions || [];
  const dueReviews = smartResume.dueReviews || [];
  const weakAreas = smartResume.weakAreas || [];
  const recentActivity = smartResume.recentActivity || [];
  headline.textContent = smartResume.headline || "Continue learning";

  panel.innerHTML = `
    <div class="resume-grid">
      <article class="resume-summary">
        <p>${escapeHtml(smartResume.summary || "")}</p>
        <div class="resume-meta">
          <span>${escapeHtml(signals.phase || "learn")}</span>
          <span>${Number(signals.retention || 0)}% retention</span>
          <span>${escapeHtml(signals.masteryLevel || "novice")}</span>
          <span>${Number(signals.dueReviewCount || 0)} due</span>
        </div>
      </article>
      <div class="resume-actions">
        ${actions
          .map(
            (item) => `
              <button class="action-row" data-resume-view="${escapeHtml(item.view || "tutor")}" type="button">
                <span class="action-dot"></span>
                <span>
                  <strong>${escapeHtml(item.label || "Continue")}</strong>
                  <small>${escapeHtml(item.reason || "")}</small>
                </span>
                <strong>Open</strong>
              </button>
            `,
          )
          .join("")}
      </div>
      <div class="resume-columns">
        <section>
          <p class="eyebrow">Due</p>
          ${
            dueReviews.length
              ? dueReviews
                  .map((item) => `<p>${escapeHtml(item.conceptName)} <strong>${Number(item.retention || 0)}%</strong></p>`)
                  .join("")
              : `<p>Clear</p>`
          }
        </section>
        <section>
          <p class="eyebrow">Weakest</p>
          ${
            weakAreas.length
              ? weakAreas
                  .slice(0, 3)
                  .map((item) => `<p>${escapeHtml(item.conceptName)} <strong>${Number(item.retention || 0)}%</strong></p>`)
                  .join("")
              : `<p>Building</p>`
          }
        </section>
        <section>
          <p class="eyebrow">Recent</p>
          ${
            recentActivity.length
              ? recentActivity
                  .slice(0, 3)
                  .map((item) => {
                    const score = Number.isFinite(Number(item.score)) ? ` ${Number(item.score)}%` : "";
                    return `<p>${escapeHtml((item.type || "event").replaceAll("_", " "))}${escapeHtml(score)}</p>`;
                  })
                  .join("")
              : `<p>No journal events yet</p>`
          }
        </section>
      </div>
    </div>
  `;

  $$("[data-resume-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.resumeView || "tutor"));
  });
}

function renderConceptSelect() {
  const select = $("#conceptSelect");
  select.innerHTML = allConcepts()
    .map((concept) => `<option value="${concept.id}">${escapeHtml(concept.name)}</option>`)
    .join("");
  select.value = state.selectedConceptId;
}

function renderDashboard() {
  const concept = currentConcept();
  const memory = state.memory[concept.id] || createInitialMemory(concept.id);
  const session = buildTutorSessionState({ concept, memory, profile: state.profile });
  const retention = estimateRetention(memory);
  const accuracy = memory.totalAttempts > 0 ? Math.round((memory.correctAnswers / memory.totalAttempts) * 100) : 0;

  $("#dashRetention").textContent = `${retention}%`;
  $("#dashReviewDate").textContent = formatDate(memory.nextReviewDate);
  $("#dashMastery").textContent = memory.masteryLevel.replace("_", " ");
  $("#dashMemoryType").textContent = memory.memoryType === "long_term" ? "Long term" : "Short term";
  $("#dashReviews").textContent = String(memory.reviewCount);
  $("#dashAccuracy").textContent = `${accuracy}% accuracy`;
  $("#dashLlmStatus").textContent = llmHealth
    ? llmHealth.ok
      ? "LM Studio"
      : "Fallback"
    : "Checking";
  $("#dashLlmDetail").textContent = llmHealth
    ? llmHealth.ok
      ? String(llmHealth.model || "local model")
      : String(llmHealth.reason || "LM Studio offline").slice(0, 80)
    : "LM Studio health";
  $("#dashConceptName").textContent = concept.name;
  $("#dashConceptDescription").textContent = concept.description;
  $("#dashKeyPoints").innerHTML = concept.keyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join("");
  $("#dashMisconceptions").innerHTML = concept.commonMisconceptions
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  renderSmartResume();

  const dueCount = Object.values(state.memory).filter((item) => item.nextReviewDate <= Date.now()).length;
  const actions = [
    {
      label: session.nextAction.label,
      view: session.nextAction.view,
      color: "var(--teal)",
    },
    {
      label: `Build a goal-oriented plan for ${concept.name}`,
      view: "plan",
      color: "var(--indigo)",
    },
    {
      label: dueCount > 0 ? `${dueCount} concept${dueCount === 1 ? "" : "s"} ready for review` : "No urgent reviews due",
      view: "quiz",
      color: dueCount > 0 ? "var(--amber)" : "var(--green)",
    },
    {
      label: `Teach back ${concept.name} to expose gaps`,
      view: "teachback",
      color: "var(--teal)",
    },
    {
      label: `Ask the tutor for an application problem`,
      view: "tutor",
      color: "var(--indigo)",
    },
  ];

  $("#nextActionList").innerHTML = actions
    .map(
      (action) => `
        <button class="action-row" data-view="${action.view}" type="button">
          <span class="action-dot" style="background:${action.color}"></span>
          <span>${escapeHtml(action.label)}</span>
          <strong>Open</strong>
        </button>
      `,
    )
    .join("");
  $$("#nextActionList [data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
}

function renderPlan() {
  const concept = currentConcept();
  const memoryByConcept = memorySnapshot();
  const plan = generateLearningPath({
    concept,
    concepts: allConcepts(),
    memoryByConcept,
    profile: state.profile,
    goal: state.learningGoal,
  });
  const gaps = inferSkillGaps({ concept, concepts: allConcepts(), memoryByConcept });
  const weakAreas = identifyWeakAreas({ concepts: allConcepts(), memoryByConcept });
  const resources = recommendResources({ concept, profile: state.profile });

  $("#learningGoalInput").value = state.learningGoal;
  $("#learningPath").innerHTML = `
    <div class="note">
      Target: <strong>${escapeHtml(plan.target)}</strong>.
      ${plan.readiness.ready ? "Prerequisites are ready." : `Blocked by: ${plan.readiness.blockedBy.map((id) => escapeHtml(getConceptById(id).name)).join(", ")}.`}
    </div>
    ${plan.sessions
      .map(
        (session) => `
          <article class="path-card">
            <header>
              <h3>${escapeHtml(session.title)}</h3>
              <span class="status-chip">${escapeHtml(session.status)}</span>
            </header>
            <p>${escapeHtml(session.abstract)}</p>
            <div class="pill-row">
              ${session.associatedSkills.map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join("")}
            </div>
            <small>${session.minutes} min target</small>
          </article>
        `,
      )
      .join("")}
  `;

  $("#skillGaps").innerHTML = gaps
    .map(
      (gap) => `
        <article class="gap-card">
          <header>
            <strong>${escapeHtml(gap.name)}</strong>
            <span class="status-chip ${gap.isGap ? "warn" : "good"}">${gap.isGap ? "gap" : "ready"}</span>
          </header>
          <p>${escapeHtml(gap.currentLevel)} -> ${escapeHtml(gap.requiredLevel)}. ${escapeHtml(gap.reason)}</p>
          <small>confidence: ${escapeHtml(gap.levelConfidence)}</small>
        </article>
      `,
    )
    .join("");

  $("#weakAreas").innerHTML = weakAreas
    .map(
      (area) => `
        <article class="gap-card">
          <header>
            <strong>${escapeHtml(area.name)}</strong>
            <span class="status-chip warn">${area.urgency}</span>
          </header>
          <p>${area.retention}% retention, ${area.mastery}% mastery, ${area.attempts} attempts</p>
        </article>
      `,
    )
    .join("");

  $("#resourceList").innerHTML = resources
    .map(
      (resource) => `
        <article class="resource-card">
          <strong>${escapeHtml(resource.type)}: ${escapeHtml(resource.title)}</strong>
          <p>${escapeHtml(resource.why)}</p>
        </article>
      `,
    )
    .join("");
  renderCourseOutline();
  renderLessonScript();
}

function courseStatusClass(status = "") {
  if (status === "complete") return "good";
  if (status === "repair" || status === "practice") return "warn";
  return "";
}

function renderCourseOutline() {
  const mount = $("#courseOutlineMount");
  const title = $("#courseOutlineTitle");
  if (!mount || !title) return;
  if (!courseOutline || courseOutline.conceptId !== currentConcept().id) {
    title.textContent = "Module path";
    mount.innerHTML = `<div class="note">Refresh the outline to generate a course from your goal, learner model, concept graph, and current knowledge base.</div>`;
    return;
  }

  const progress = courseOutline.progress || { doneCount: 0, totalModules: 0, percent: 0 };
  const coverage = courseOutline.sourceCoverage || {};
  title.textContent = courseOutline.title || "Module path";
  mount.innerHTML = `
    <article class="course-summary">
      <div>
        <strong>${escapeHtml(courseOutline.goal || "")}</strong>
        <p>${Number(courseOutline.estimatedMinutes || 0)} min | ${progress.doneCount || 0}/${progress.totalModules || 0} modules complete | ${Number(coverage.readyModules || 0)}/${Number(coverage.totalModules || 0)} source-ready</p>
      </div>
      <div class="bar course-progress" style="--value:${Number(progress.percent || 0)}%"><span></span></div>
    </article>
    <div class="course-module-list">
      ${(courseOutline.modules || []).map((module) => `
        <article class="course-module">
          <header>
            <div>
              <p class="eyebrow">Module ${Number(module.sequence || 0)} | ${escapeHtml(module.role || "core")}</p>
              <h3>${escapeHtml(module.title || module.conceptName || "Module")}</h3>
            </div>
            <span class="status-chip ${courseStatusClass(module.status)}">${escapeHtml(module.status || "ready")}</span>
          </header>
          <div class="course-meta">
            <span>${Number(module.minutes || 0)} min</span>
            <span>${module.sourceCoverage?.hasDedicatedSource ? "source ready" : "source gap"}</span>
            <span>${Number(module.sourceCoverage?.documentCount || 0)} docs</span>
          </div>
          <ul>
            ${(module.objectives || []).map((objective) => `<li>${escapeHtml(objective)}</li>`).join("")}
          </ul>
          <div class="course-checkpoints">
            ${(module.checkpoints || []).map((checkpoint) => `
              <button class="ghost-button compact-button" data-course-view="${escapeHtml(checkpoint.view || "tutor")}" type="button" title="${escapeHtml(checkpoint.target || "")}">
                ${escapeHtml(checkpoint.label || "Open")}
              </button>
            `).join("")}
          </div>
        </article>
      `).join("")}
    </div>
  `;

  $$("[data-course-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.courseView || "tutor"));
  });
}

function lessonStatusClass(status = "") {
  if (status === "done") return "good";
  if (status === "active") return "warn";
  return "";
}

function renderLessonScript() {
  const mount = $("#lessonScriptMount");
  const title = $("#lessonScriptTitle");
  if (!mount || !title) return;

  if (!lessonScript || lessonScript.conceptId !== currentConcept().id) {
    title.textContent = "Guided session";
    mount.innerHTML = `<div class="note">Save a lesson script to turn the study plan into a step-by-step session.</div>`;
    return;
  }

  const progress = lessonScript.progress || { doneCount: 0, totalSteps: 0, percent: 0 };
  const signals = lessonScript.learnerSignals || {};
  title.textContent = lessonScript.title || "Guided session";
  mount.innerHTML = `
    <article class="lesson-summary">
      <div>
        <strong>${escapeHtml(lessonScript.goal || "")}</strong>
        <p>${lessonScriptSaved ? "Saved" : "Preview"} | ${Number(lessonScript.estimatedMinutes || 0)} min | ${progress.doneCount || 0}/${progress.totalSteps || 0} done</p>
      </div>
      <div class="bar lesson-progress" style="--value:${Number(progress.percent || 0)}%"><span></span></div>
      <div class="resume-meta">
        <span>${escapeHtml(signals.phase || "learn")}</span>
        <span>${Number(signals.retention || 0)}% retention</span>
        <span>${escapeHtml(signals.masteryLevel || "novice")}</span>
      </div>
    </article>
    <div class="lesson-step-list">
      ${(lessonScript.steps || [])
        .map(
          (item, index) => `
            <article class="lesson-step ${index === lessonScript.currentStepIndex ? "current" : ""}">
              <header>
                <div>
                  <p class="eyebrow">Step ${index + 1}</p>
                  <h3>${escapeHtml(item.title)}</h3>
                </div>
                <span class="status-chip ${lessonStatusClass(item.status)}">${escapeHtml(item.status || "todo")}</span>
              </header>
              <p>${escapeHtml(item.prompt || "")}</p>
              <ul>
                ${(item.checks || []).map((check) => `<li>${escapeHtml(check)}</li>`).join("")}
              </ul>
              <button class="ghost-button compact-button" data-lesson-view="${escapeHtml(item.view || "tutor")}" type="button">Open</button>
            </article>
          `,
        )
        .join("")}
    </div>
  `;

  $$("[data-lesson-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.lessonView || "tutor"));
  });
}

function renderKnowledgeBase() {
  if (!$("#kbDocCount")) return;

  $("#kbConceptSelect").innerHTML = [
    `<option value="">No concept attachment</option>`,
    ...allConcepts().map((concept) => `<option value="${concept.id}">${escapeHtml(concept.name)}</option>`),
  ].join("");
  $("#kbConceptSelect").value = currentConcept().id;

  if (!kbStats) {
    $("#kbDocCount").textContent = "...";
    $("#kbChunkCount").textContent = "...";
    $("#kbAvgTokens").textContent = "...";
    $("#kbChunkShape").textContent = "loading index";
    $("#kbDocuments").innerHTML = `<div class="note">Knowledge base stats are loading.</div>`;
    return;
  }

  const options = kbStats.chunkOptions || {};
  const embedding = kbStats.embedding || {};
  $("#kbDocCount").textContent = String(kbStats.documentCount || 0);
  $("#kbChunkCount").textContent = String(kbStats.chunkCount || 0);
  $("#kbAvgTokens").textContent = String(kbStats.avgChunkTokens || 0);
  $("#kbChunkShape").textContent =
    `${options.targetTokens || 0} target, ${options.overlapTokens || 0} overlap, ${embedding.provider || "local-hash"}`;

  $("#kbDocuments").innerHTML = (kbStats.documents || [])
    .slice(0, 24)
    .map(
      (document) => `
        <article class="document-row">
          <div>
            <strong>${escapeHtml(document.title)}</strong>
            <p>${escapeHtml(document.source)}${document.conceptId ? ` | ${escapeHtml(document.conceptId)}` : ""}</p>
          </div>
          <div class="document-actions">
            ${renderGuardrailBadge(document)}
            <small>${Math.round((document.textLength || 0) / 100) / 10}k chars</small>
            <button class="ghost-button compact-button" data-kb-preview="${escapeHtml(document.id)}" type="button">Chunks</button>
            ${
              document.userEditable
                ? `<button class="ghost-button compact-button danger-button" data-kb-delete="${escapeHtml(document.id)}" type="button">Delete</button>`
                : ""
            }
          </div>
        </article>
      `,
    )
    .join("");
  $$("[data-kb-preview]").forEach((button) => {
    button.addEventListener("click", () => previewKnowledgeDocumentChunks(button.dataset.kbPreview));
  });
  $$("[data-kb-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteKnowledgeDocument(button.dataset.kbDelete));
  });

  $("#kbChunkPreview").innerHTML = kbSelectedDocumentId
    ? `
      <div class="chunk-preview-header">
        <div>
          <p class="eyebrow">Indexed chunks</p>
          <h3>${escapeHtml(kbSelectedDocumentId)}</h3>
        </div>
        <button class="ghost-button compact-button" id="closeChunkPreview" type="button">Close</button>
      </div>
      ${
        kbSelectedDocumentChunks.length
          ? kbSelectedDocumentChunks
              .map(
                (chunk) => `
                  <article class="chunk-card">
                    <header>
                      <strong>${escapeHtml(chunk.section)}</strong>
                      <small>${chunk.tokenCount} tokens</small>
                      ${renderGuardrailBadge(chunk)}
                    </header>
                    <p>${escapeHtml(chunk.text.slice(0, 620))}${chunk.text.length > 620 ? "..." : ""}</p>
                  </article>
                `,
              )
              .join("")
          : `<div class="note">Loading chunks...</div>`
      }
    `
    : "";
  $("#closeChunkPreview")?.addEventListener("click", () => {
    kbSelectedDocumentId = "";
    kbSelectedDocumentChunks = [];
    renderKnowledgeBase();
  });

  $("#kbSearchResults").innerHTML = kbSearchResults.length
    ? kbSearchResults
        .map(
          (result) => `
            <article class="retrieval-card">
              <header>
                <strong>${escapeHtml(result.title)}</strong>
                <span class="status-chip" title="lexical ${escapeHtml(String(result.lexicalScore || 0))}, embedding ${escapeHtml(String(result.semanticScore || 0))}">${escapeHtml(String(result.score))}</span>
              </header>
              <p class="eyebrow">${escapeHtml(result.section)} | ${escapeHtml(result.source)}</p>
              ${renderGuardrailBadge(result)}
              <p>${escapeHtml(result.text.slice(0, 520))}${result.text.length > 520 ? "..." : ""}</p>
            </article>
          `,
        )
        .join("")
    : `<div class="note">Search results will show the exact chunks the tutor can retrieve.</div>`;
}

function renderChat() {
  const concept = currentConcept();
  const session = currentSessionState();
  if (!state.messages[concept.id]) setConcept(concept.id);
  const messages = state.messages[concept.id] || [];
  $("#chatMessages").innerHTML = messages
    .map(
      (message) => `
        <div class="message ${message.role}${message.loading ? " loading" : ""}">
          <div>${escapeHtml(message.content)}</div>
          ${message.role === "assistant" ? renderTutorQuality(message.quality) : ""}
          ${renderSources(message.sources)}
          ${renderEvidenceTrace(message.evidenceTrace)}
        </div>
      `,
    )
    .join("");
  $("#chatMessages").scrollTop = $("#chatMessages").scrollHeight;

  $$("#modeControl button").forEach((button) => {
    const active = button.dataset.mode === state.activeMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });

  $("#coachNotes").innerHTML = [
    `Mode: ${state.activeMode}.`,
    `Tutor phase: ${session.phase}.`,
    `Next action: ${session.nextAction.label}.`,
    `Focus: ${session.focusPoints.slice(0, 2).join(" | ")}.`,
    `Current analogy: ${concept.analogy}`,
    kbStats ? `Knowledge base: ${kbStats.documentCount} docs, ${kbStats.chunkCount} chunks indexed.` : "Knowledge base: loading index.",
    llmHealth
      ? llmHealth.ok
        ? `LLM: LM Studio reachable at ${llmHealth.baseUrl}; model ${llmHealth.model || "auto"}.`
        : `LLM: using fallback because ${llmHealth.reason || "LM Studio is unavailable"}. ${llmHealth.troubleshooting?.[0] || ""}`
      : "LLM: checking LM Studio health.",
    `Learner model: confidence ${profilePercent(state.profile.confidenceLevel, 50)}%, motivation ${profilePercent(state.profile.motivationLevel, 75)}%.`,
    `Known concepts: ${compactProfileList(state.profile.knownConcepts, "building")}.`,
    `Needs review: ${compactProfileList(state.profile.strugglingConcepts, "clear")}.`,
    learnerJournalSummary
      ? `Server journal: ${learnerJournalSummary.totalEvents || 0} durable events across ${learnerJournalSummary.conceptCount || 0} concepts.`
      : "Server journal: not loaded yet.",
    learnerStateSummary
      ? `Server state: ${learnerStateSummary.memoryCount || 0} memory records, ${learnerStateSummary.messageCount || 0} saved messages.`
      : "Server state: local-only until synced.",
    `Next review: ${formatDate(currentMemory().nextReviewDate)}.`,
    "Best loop: explain, teach back, quiz, then review later.",
  ]
    .map((note) => `<div class="note">${escapeHtml(note)}</div>`)
    .join("");

  const artifact = generateWhiteboardArtifact({ concept });
  $("#whiteboardNotes").innerHTML = renderWhiteboardArtifact(artifact);
}

function renderTeachBack() {
  const result = state.lastTeachBack;
  if (result?.loading && result.conceptId === currentConcept().id) {
    $("#teachBackResults").innerHTML = `
      <p class="body-copy">Analyzing your explanation against the concept and retrieved source chunks...</p>
    `;
    return;
  }

  if (!result || result.conceptId !== currentConcept().id) {
    $("#teachBackResults").innerHTML = `
      <p class="body-copy">Your analysis will appear here after you submit an explanation.</p>
    `;
    return;
  }

  const scoreStyle = `--score: ${result.accuracy}%`;
  $("#teachBackResults").innerHTML = `
    <div class="score-ring" style="${scoreStyle}">${result.accuracy}%</div>
    <div>
      <h3>Missing points</h3>
      <div class="pill-row">
        ${
          result.missingPoints.length
            ? result.missingPoints.map((point) => `<span class="pill">${escapeHtml(point)}</span>`).join("")
            : `<span class="pill">No major gaps</span>`
        }
      </div>
    </div>
    <div>
      <h3>Misconceptions</h3>
      <div class="pill-row">
        ${
          result.misconceptions.length
            ? result.misconceptions.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")
            : `<span class="pill">None detected</span>`
        }
      </div>
    </div>
    ${
      result.selfCorrection?.conflict
        ? `<div>
            <h3>Self-correction</h3>
            <p class="body-copy">${escapeHtml(result.selfCorrection.feedback)}</p>
            <div class="pill-row">
              <span class="pill">${escapeHtml(result.selfCorrection.correctedClaim)}</span>
              ${(result.selfCorrection.cues || []).slice(0, 2).map((cue) => `<span class="pill">${escapeHtml(cue)}</span>`).join("")}
            </div>
          </div>`
        : ""
    }
    <div>
      <h3>Refined explanation</h3>
      <p class="body-copy">${escapeHtml(result.refinedExplanation)}</p>
    </div>
    <div>
      <h3>Next repair moves</h3>
      <div class="pill-row">
        ${
          (result.suggestions || []).length
            ? result.suggestions.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")
            : `<span class="pill">Try the quiz or apply the concept to a fresh example</span>`
        }
      </div>
    </div>
    ${renderSources(result.sources)}
    ${renderEvidenceTrace(result.evidenceTrace)}
  `;
}

function renderNotebookSaathi() {
  const input = $("#notebookSaathiInput");
  if (!input) return;

  const summary = notebookSaathiSummary || buildNotebookSaathiDemoSummary();
  $("#notebookInitialScore").textContent = `${summary.initialScore.correct}/${summary.initialScore.total}`;
  $("#notebookInitialPercent").textContent = `${summary.initialScore.percent}% correct`;
  $("#notebookRetryScore").textContent = `${summary.retryScore.correct}/${summary.retryScore.total}`;
  $("#notebookRetryPercent").textContent = `${summary.retryScore.percent}% correct`;
  $("#notebookLift").textContent = `${summary.improvementPercentagePoints >= 0 ? "+" : ""}${summary.improvementPercentagePoints} pts`;
  $("#notebookAffected").textContent = `${summary.affectedStudents} students grouped`;
  $("#notebookQuestion").textContent = summary.question.prompt;
  $("#notebookRetryQuestion").textContent = summary.retryQuestion.prompt;
  input.value = notebookSaathiInput;

  $("#notebookReadinessList").innerHTML = summary.readinessChecks
    .map((check) => `
      <article class="gap-card notebook-check">
        <header>
          <strong>${escapeHtml(check)}</strong>
          <span class="status-chip good">ready</span>
        </header>
      </article>
    `)
    .join("");

  $("#notebookSaathiResults").innerHTML = summary.clusters.length
    ? `
      <div class="notebook-cluster-grid">
        ${summary.clusters
          .map((cluster) => {
            const approved = notebookSaathiApproved.has(cluster.id);
            return `
              <article class="notebook-cluster-card ${approved ? "approved" : ""}">
                <header>
                  <div>
                    <p class="eyebrow">${escapeHtml(cluster.risk)} risk</p>
                    <h3>${escapeHtml(cluster.label)}</h3>
                  </div>
                  <span class="status-chip ${cluster.risk === "high" ? "warn" : "good"}">${cluster.count} learners</span>
                </header>
                <p>${escapeHtml(cluster.teacherSummary)}</p>
                <div class="notebook-evidence">
                  ${cluster.sampleEvidence.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
                </div>
                <div class="notebook-remediation">
                  <strong>Teacher-approved repair</strong>
                  <p>${escapeHtml(cluster.remediation)}</p>
                  <small>${escapeHtml(cluster.prototypePrompt)}</small>
                </div>
                <footer>
                  <span>${Math.round(cluster.confidence * 100)}% confidence</span>
                  <button class="${approved ? "ghost-button" : "primary-button"} compact-button" data-notebook-approve="${escapeHtml(cluster.id)}" type="button">
                    ${approved ? "Approved" : "Approve"}
                  </button>
                </footer>
              </article>
            `;
          })
          .join("")}
      </div>
    `
    : `<div class="note">No misconception clusters found in the current rows.</div>`;

  $$("#notebookSaathiResults [data-notebook-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      notebookSaathiApproved.add(button.dataset.notebookApprove);
      renderNotebookSaathi();
    });
  });
}

function analyzeNotebookSaathiInput() {
  const input = $("#notebookSaathiInput");
  if (!input) return;
  const attempts = parseNotebookSaathiRows(input.value).filter((attempt) => attempt.answer || attempt.work);
  notebookSaathiInput = input.value;
  notebookSaathiApproved.clear();

  if (!attempts.length) {
    notebookSaathiSummary = buildNotebookSaathiDemoSummary({ attempts: [] });
    $("#notebookSaathiStatus").textContent = "Add at least one anonymized answer row.";
    renderNotebookSaathi();
    return;
  }

  notebookSaathiSummary = buildNotebookSaathiDemoSummary({ attempts });
  $("#notebookSaathiStatus").textContent = `Analyzed ${attempts.length} anonymized notebook rows.`;
  renderNotebookSaathi();
}

function loadNotebookSaathiDemo() {
  notebookSaathiInput = formatNotebookSaathiRows(NOTEBOOK_SAATHI_INITIAL_ATTEMPTS);
  notebookSaathiSummary = buildNotebookSaathiDemoSummary();
  notebookSaathiApproved.clear();
  $("#notebookSaathiStatus").textContent = "Loaded the fraction misconception demo dataset.";
  renderNotebookSaathi();
}
function ensureQuiz() {
  if (!state.quiz || state.quiz.conceptId !== currentConcept().id) {
    state.quiz = {
      conceptId: currentConcept().id,
      questions: generateQuiz({ concept: currentConcept(), profile: state.profile, count: 5 }),
      index: 0,
      answers: {},
      checked: false,
      complete: false,
      sources: [],
      provider: "fallback",
    };
  }
}

function renderQuiz() {
  ensureQuiz();
  const quiz = state.quiz;

  if (quiz.loading) {
    $("#quizMount").innerHTML = `
      <div class="quiz-question">
        <p class="eyebrow">Generating</p>
        <h2>Building a RAG-backed quiz...</h2>
        <p class="body-copy">The tutor is retrieving source chunks and asking the local model for active-recall questions.</p>
      </div>
    `;
    renderSchedulePreview();
    return;
  }

  const question = quiz.questions[quiz.index];

  if (quiz.complete) {
    const score = quizScore();
    $("#quizMount").innerHTML = `
      <div class="score-ring" style="--score:${score}%">${score}%</div>
      <p class="body-copy">Quiz complete. Your memory schedule has been updated for ${escapeHtml(currentConcept().name)}.</p>
      ${renderSources(quiz.sources)}
      ${renderEvidenceTrace(quiz.evidenceTrace)}
      <button class="primary-button" id="quizAgain" type="button">Practice again</button>
    `;
    $("#quizAgain").addEventListener("click", startNewQuiz);
  } else if (question.type === "multiple_choice") {
    const selected = quiz.answers[question.id];
    $("#quizMount").innerHTML = `
      <div class="quiz-question">
        <p class="eyebrow">Question ${quiz.index + 1} of ${quiz.questions.length}</p>
        <h2>${escapeHtml(question.question)}</h2>
        <div class="option-list">
          ${question.options
            .map((option) => {
              const isSelected = selected === option;
              const checkedClass =
                quiz.checked && option === question.correctAnswer
                  ? "correct"
                  : quiz.checked && isSelected
                    ? "incorrect"
                    : "";
          return `<button class="option-button ${isSelected ? "selected" : ""} ${checkedClass}" data-answer="${escapeHtml(option)}" aria-pressed="${isSelected ? "true" : "false"}" type="button">${escapeHtml(option)}</button>`;
            })
            .join("")}
        </div>
        ${
          quiz.checked
            ? `<p class="body-copy">${escapeHtml(question.explanation)}</p>${renderSources(question.sources || quiz.sources)}${renderEvidenceTrace(question.evidenceTrace || quiz.evidenceTrace)}<button class="primary-button" id="nextQuestion" type="button">${quiz.index === quiz.questions.length - 1 ? "Finish" : "Next"}</button>`
            : `<button class="primary-button" id="checkAnswer" ${selected ? "" : "disabled"} type="button">Check</button>`
        }
      </div>
    `;
    $$(".option-button").forEach((button) => button.addEventListener("click", () => selectAnswer(button.dataset.answer)));
    $("#checkAnswer")?.addEventListener("click", checkAnswer);
    $("#nextQuestion")?.addEventListener("click", nextQuestion);
  } else {
    $("#quizMount").innerHTML = `
      <div class="quiz-question">
        <p class="eyebrow">Teach-back prompt</p>
        <h2>${escapeHtml(question.question)}</h2>
        <label class="sr-only" for="quizExplainInput">Quiz teach-back answer</label>
        <textarea id="quizExplainInput" class="large-input recall-friction-text" placeholder="Write your explanation"></textarea>
        <button class="primary-button" id="scoreExplain" type="button">Score explanation</button>
      </div>
    `;
    $("#scoreExplain").addEventListener("click", () => {
      const quizConcept = allConcepts().find((item) => item.id === quiz.conceptId) || currentConcept();
      const analysis = analyzeTeachBack({
        concept: quizConcept,
        explanation: $("#quizExplainInput").value,
        profile: state.profile,
      });
      quiz.answers[question.id] = analysis.accuracy >= 70 ? question.correctAnswer : "";
      quiz.checked = true;
      nextQuestion();
    });
  }

  renderSchedulePreview();
}

function renderSchedulePreview() {
  const memory = currentMemory();
  const retention = estimateRetention(memory);
  $("#schedulePreview").innerHTML = `
    <div class="note">Current retention estimate: <strong>${retention}%</strong></div>
    <div class="note">Next review: <strong>${formatDate(memory.nextReviewDate)}</strong></div>
    <div class="note">Consolidation: <strong>${memory.consolidationProgress || 0}%</strong></div>
  `;
}

function quizScore() {
  const quiz = state.quiz;
  if (!quiz) return 0;
  const correct = quiz.questions.filter((question) => quiz.answers[question.id] === question.correctAnswer).length;
  return Math.round((correct / quiz.questions.length) * 100);
}

function quizAssessmentGaps(quiz, concept) {
  const missedQuestions = quiz.questions.filter((question) => quiz.answers[question.id] !== question.correctAnswer);
  const misconceptionAnswers = missedQuestions
    .map((question) => {
      const selected = quiz.answers[question.id];
      const related = question.relatedMisconceptions || [];
      return selected && (related.includes(selected) || concept.commonMisconceptions.includes(selected)) ? selected : "";
    })
    .filter(Boolean);

  return {
    missingPoints: missedQuestions.map((question) =>
      question.type === "explain" ? `Explain ${concept.name} clearly` : question.question,
    ),
    misconceptions: [...new Set(misconceptionAnswers)],
  };
}

function selectAnswer(answer) {
  if (state.quiz.checked) return;
  const question = state.quiz.questions[state.quiz.index];
  state.quiz.answers[question.id] = answer;
  saveState();
  renderQuiz();
}

function checkAnswer() {
  state.quiz.checked = true;
  saveState();
  renderQuiz();
}

function nextQuestion() {
  const quiz = state.quiz;
  if (quiz.index >= quiz.questions.length - 1) {
    const concept = allConcepts().find((item) => item.id === quiz.conceptId) || currentConcept();
    const score = quizScore();
    const memory = state.memory[concept.id] || createInitialMemory(concept.id);
    state.memory[memory.conceptId] = updateMemoryAfterQuiz(memory, score, state.quiz.questions.length);
    state.profile = updateLearnerProfileAfterAssessment(state.profile, {
      concept,
      score,
      source: "quiz",
      ...quizAssessmentGaps(quiz, concept),
    });
    recordLearnerEvent({
      type: "quiz_completed",
      concept,
      score,
      questionCount: quiz.questions.length,
      provider: quiz.provider,
      model: quiz.model,
      evidenceTrace: quiz.evidenceTrace,
      sources: quiz.sources,
      source: "quiz",
      ...quizAssessmentGaps(quiz, concept),
    });
    quiz.complete = true;
  } else {
    quiz.index += 1;
    quiz.checked = false;
  }
  saveState();
  renderAll();
}

async function startNewQuiz() {
  const concept = currentConcept();
  state.quiz = {
    conceptId: concept.id,
    questions: [],
    index: 0,
    answers: {},
    checked: false,
    complete: false,
    loading: true,
    sources: [],
  };
  saveState();
  renderQuiz();

  try {
    const response = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept,
        profile: state.profile,
        count: 5,
        learningGoal: state.learningGoal,
      }),
    });
    if (!response.ok) throw new Error("Quiz API failed");
    const result = await response.json();
    state.quiz = {
      conceptId: concept.id,
      questions: result.questions || generateQuiz({ concept, profile: state.profile, count: 5 }),
      index: 0,
      answers: {},
      checked: false,
      complete: false,
      loading: false,
      provider: result.provider || "api",
      model: result.model,
      sources: result.sources || [],
      evidenceTrace: result.evidenceTrace || null,
    };
  } catch {
    state.quiz = {
      conceptId: concept.id,
      questions: generateQuiz({ concept, profile: state.profile, count: 5 }),
      index: 0,
      answers: {},
      checked: false,
      complete: false,
      loading: false,
      provider: "fallback",
      sources: [],
      evidenceTrace: null,
    };
  }

  saveState();
  await refreshLearnerJournal();
  await refreshCitationNotebook({ render: false });
  renderQuiz();
}

function renderGraph() {
  const concepts = allConcepts();
  const selected = currentConcept();
  const center = { x: 450, y: 280 };
  const radius = 210;
  const nodes = concepts.map((concept, index) => {
    if (concept.id === selected.id) return { ...concept, x: center.x, y: center.y, selected: true };
    const angle = (Math.PI * 2 * index) / Math.max(1, concepts.length - 1) - Math.PI / 2;
    return {
      ...concept,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      selected: false,
    };
  });
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const edges = [];
  for (const concept of concepts) {
    for (const target of [...concept.prerequisites, ...concept.relatedConcepts]) {
      if (nodeMap[concept.id] && nodeMap[target]) edges.push([concept.id, target]);
    }
  }

  const edgeMarkup = edges
    .map(([source, target]) => {
      const a = nodeMap[source];
      const b = nodeMap[target];
      return `<line class="graph-edge" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"></line>`;
    })
    .join("");

  const nodeMarkup = nodes
    .map((node) => {
      const memory = state.memory[node.id] || createInitialMemory(node.id);
      const color = node.selected
        ? "var(--teal)"
        : memory.memoryType === "long_term"
          ? "var(--green)"
          : estimateRetention(memory) < 45
            ? "var(--amber)"
            : "var(--indigo)";
      const label = node.name.length > 18 ? `${node.name.slice(0, 17)}...` : node.name;
      return `
        <g class="graph-node" data-concept-id="${node.id}" tabindex="0" role="button" aria-label="${escapeHtml(`Open ${node.name}`)}">
          <title>${escapeHtml(`Open ${node.name}`)}</title>
          <circle cx="${node.x}" cy="${node.y}" r="${node.selected ? 50 : 38}" fill="${color}"></circle>
          <text x="${node.x}" y="${node.y + (node.selected ? 68 : 56)}">${escapeHtml(label)}</text>
        </g>
      `;
    })
    .join("");

  $("#knowledgeGraph").innerHTML = edgeMarkup + nodeMarkup;
  $$("#knowledgeGraph .graph-node").forEach((node) => {
    node.addEventListener("click", () => setConcept(node.dataset.conceptId));
    node.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setConcept(node.dataset.conceptId);
    });
  });
}

function renderProgress() {
  const concepts = allConcepts();
  $("#progressList").innerHTML = concepts
    .map((concept) => {
      const memory = state.memory[concept.id] || createInitialMemory(concept.id);
      const mastery = masteryPercent(memory.masteryLevel);
      const retention = estimateRetention(memory);
      return `
        <div class="progress-row">
          <div>
            <strong>${escapeHtml(concept.name)}</strong>
            <p class="eyebrow">${escapeHtml(memory.masteryLevel)} / ${escapeHtml(memory.memoryType)}</p>
          </div>
          <div>
            <div class="bar" style="--value:${mastery}%"><span></span></div>
            <small>${retention}% retention, ${memory.consolidationProgress || 0}% consolidation</small>
          </div>
          <button class="ghost-button" data-concept-jump="${concept.id}" type="button">Open</button>
        </div>
      `;
    })
    .join("");
  $$("[data-concept-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      setConcept(button.dataset.conceptJump);
      setView("dashboard");
    });
  });
  renderCitationNotebook();
}

function renderCitationNotebook() {
  const mount = $("#citationNotebookMount");
  if (!mount) return;
  if (!citationNotebook || citationNotebook.conceptId !== currentConcept().id) {
    mount.innerHTML = `<div class="note">Citation history will appear after the tutor retrieves and cites source chunks for this concept.</div>`;
    return;
  }

  const sources = citationNotebook.sources || [];
  mount.innerHTML = `
    <article class="citation-summary">
      <div>
        <strong>${Number(citationNotebook.sourceCount || 0)} sources tracked</strong>
        <p>${Number(citationNotebook.eventCount || 0)} evidence events | ${Number(citationNotebook.totalCitations || 0)} citations | ${Math.round(Number(citationNotebook.averageCitationCoverage || 0) * 100)}% avg coverage</p>
      </div>
      <span class="status-chip ${Number(citationNotebook.invalidCitationCount || 0) ? "warn" : "good"}">${Number(citationNotebook.invalidCitationCount || 0)} invalid</span>
    </article>
    <div class="citation-grid">
      ${
        sources.length
          ? sources.slice(0, 10).map((source) => `
              <article class="citation-card">
                <header>
                  <strong>${escapeHtml(source.title || "Source")}</strong>
                  <span class="status-chip">${Number(source.citedCount || 0)} / ${Number(source.retrievedCount || 0)}</span>
                </header>
                <p class="eyebrow">${escapeHtml(source.section || source.source || "Retrieved chunk")}</p>
                <p>${escapeHtml(source.snippet || "No snippet saved.")}</p>
                <div class="citation-events">
                  ${(source.events || []).slice(0, 4).map((event) => `
                    <span title="${escapeHtml(event.type || "")}">
                      ${escapeHtml(event.purpose || event.type || "event")} ${event.cited ? "cited" : "uncited"}
                    </span>
                  `).join("")}
                </div>
              </article>
            `).join("")
          : `<div class="note">No cited or retrieved source chunks yet for this concept.</div>`
      }
    </div>
  `;
}

function renderAll() {
  renderConceptSelect();
  renderProfileInsights();
  renderDashboard();
  renderPlan();
  renderKnowledgeBase();
  renderChat();
  renderTeachBack();
  renderQuiz();
  renderGraph();
  renderProgress();
  syncProfileControls();
}

async function sendChatMessage(event) {
  event.preventDefault();
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text) return;

  const concept = currentConcept();
  const messages = state.messages[concept.id] || [];
  const apiHistory = messages.slice(-8);
  messages.push({ id: `user-${Date.now()}`, role: "user", content: text });
  const loadingId = `loading-${Date.now()}`;
  messages.push({ id: loadingId, role: "assistant", content: "Thinking with the local tutor model...", loading: true });
  state.messages[concept.id] = messages;
  input.value = "";
  renderChat();

  try {
    const response = await fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept,
        message: text,
        mode: state.activeMode,
        profile: state.profile,
        history: apiHistory,
      }),
    });
    if (!response.ok) throw new Error("Tutor API failed");
    const reply = await response.json();
    const index = messages.findIndex((message) => message.id === loadingId);
    if (index >= 0) messages[index] = reply;
    else messages.push(reply);
  } catch {
    const reply = generateTutorReply({
      concept,
      message: text,
      mode: state.activeMode,
      profile: state.profile,
      history: apiHistory,
    });
    reply.quality = scoreTutorReply(
      {
        concept,
        mode: state.activeMode,
        message: text,
        profile: state.profile,
        expectedKeyPoints: concept.keyPoints.slice(0, 4),
        expectedMisconceptions: concept.commonMisconceptions.slice(0, 3),
      },
      reply,
    );
    const index = messages.findIndex((message) => message.id === loadingId);
    if (index >= 0) messages[index] = reply;
    else messages.push(reply);
  }

  saveState();
  await refreshLearnerJournal();
  await refreshCitationNotebook({ render: false });
  renderAll();
}

async function analyzeTeachBackInput() {
  const explanation = $("#teachBackInput").value.trim();
  if (!explanation) return;
  const concept = currentConcept();

  state.lastTeachBack = { conceptId: concept.id, loading: true };
  saveState();
  renderTeachBack();

  let result;
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        concept,
        explanation,
        profile: state.profile,
        learningGoal: state.learningGoal,
      }),
    });
    if (!response.ok) throw new Error("Analyze API failed");
    result = await response.json();
  } catch {
    result = analyzeTeachBack({
      concept,
      explanation,
      profile: state.profile,
    });
  }

  state.lastTeachBack = { ...result, conceptId: concept.id };
  state.profile = updateLearnerProfileAfterAssessment(state.profile, {
    concept,
    score: result.accuracy,
    missingPoints: result.missingPoints || [],
    misconceptions: result.misconceptions || [],
    source: "teach-back",
  });

  const memory = state.memory[concept.id] || createInitialMemory(concept.id);
  state.memory[memory.conceptId] = updateMemoryAfterTeachBack(memory, result.accuracy);

  saveState();
  await refreshLearnerJournal();
  await refreshCitationNotebook({ render: false });
  renderAll();
}

async function refreshKnowledgeBaseStats() {
  try {
    const response = await fetch("/api/kb");
    if (!response.ok) throw new Error("Knowledge API failed");
    kbStats = await response.json();
  } catch {
    kbStats = {
      documentCount: 0,
      chunkCount: 0,
      avgChunkTokens: 0,
      chunkOptions: {},
      documents: [],
    };
  }
  renderKnowledgeBase();
}

async function submitKnowledgeDocument(event) {
  event.preventDefault();
  const title = $("#kbTitleInput").value.trim();
  const source = $("#kbSourceInput").value.trim();
  const text = $("#kbTextInput").value.trim();
  const conceptId = $("#kbConceptSelect").value;

  if (!title || text.length < 80) {
    $("#kbFormStatus").textContent = "Add a title and at least 80 characters of source material.";
    return;
  }

  $("#kbFormStatus").textContent = "Chunking and indexing...";
  try {
    const response = await fetch("/api/kb/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, source, text, conceptId }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not add document");
    }
    kbStats = await response.json();
    kbSearchResults = [];
    $("#kbTitleInput").value = "";
    $("#kbSourceInput").value = "";
    $("#kbTextInput").value = "";
    $("#kbFormStatus").textContent = "Added. Future tutor replies can retrieve from this material.";
  } catch (error) {
    $("#kbFormStatus").textContent = error instanceof Error ? error.message : "Could not add document.";
  }
  renderKnowledgeBase();
}

async function previewKnowledgeDocumentChunks(documentId) {
  kbSelectedDocumentId = documentId;
  kbSelectedDocumentChunks = [];
  renderKnowledgeBase();

  try {
    const response = await fetch(`/api/kb/documents/${encodeURIComponent(documentId)}/chunks`);
    if (!response.ok) throw new Error("Could not load chunks");
    const data = await response.json();
    kbSelectedDocumentChunks = data.chunks || [];
  } catch {
    kbSelectedDocumentChunks = [];
  }

  renderKnowledgeBase();
}

async function deleteKnowledgeDocument(documentId) {
  const document = (kbStats?.documents || []).find((item) => item.id === documentId);
  const name = document?.title || documentId;
  if (!confirm(`Delete "${name}" from the knowledge base?`)) return;

  try {
    const response = await fetch(`/api/kb/documents/${encodeURIComponent(documentId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Could not delete document");
    }
    kbStats = await response.json();
    kbSearchResults = [];
    if (kbSelectedDocumentId === documentId) {
      kbSelectedDocumentId = "";
      kbSelectedDocumentChunks = [];
    }
    $("#kbFormStatus").textContent = "Document removed from the knowledge base.";
  } catch (error) {
    $("#kbFormStatus").textContent = error instanceof Error ? error.message : "Could not delete document.";
  }

  renderKnowledgeBase();
}

function extractDocumentFromJson(raw, fallbackTitle) {
  const parsed = JSON.parse(raw);
  const candidate = Array.isArray(parsed) ? parsed[0] : parsed.document || parsed;
  const title = candidate.title || candidate.name || parsed.title || fallbackTitle;
  const source = candidate.source || candidate.url || parsed.source || "imported JSON";
  const text =
    candidate.text ||
    candidate.content ||
    candidate.markdown ||
    candidate.body ||
    parsed.text ||
    parsed.content ||
    "";

  if (!text || typeof text !== "string") {
    throw new Error("JSON file needs a text, content, markdown, or body field.");
  }

  return { title: String(title || fallbackTitle), source: String(source || "imported JSON"), text };
}

async function importKnowledgeFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const maxBytes = 200000;
  if (file.size > maxBytes) {
    $("#kbFileStatus").textContent = "File is too large for this MVP. Keep imports under 200 KB.";
    event.target.value = "";
    return;
  }

  try {
    const raw = await file.text();
    const isJson = file.name.toLowerCase().endsWith(".json") || file.type === "application/json";
    const imported = isJson
      ? extractDocumentFromJson(raw, file.name.replace(/\.[^.]+$/, ""))
      : {
          title: file.name.replace(/\.[^.]+$/, ""),
          source: file.name,
          text: raw,
        };

    $("#kbTitleInput").value = imported.title;
    $("#kbSourceInput").value = imported.source;
    $("#kbTextInput").value = imported.text.trim();
    $("#kbFileStatus").textContent = `Loaded ${file.name}: ${Math.round(imported.text.length / 100) / 10}k characters.`;
    $("#kbFormStatus").textContent = "Review the text, then add it to the knowledge base.";
  } catch (error) {
    $("#kbFileStatus").textContent = error instanceof Error ? error.message : "Could not read file.";
  } finally {
    event.target.value = "";
  }
}

async function searchKnowledgeBasePreview(event) {
  event.preventDefault();
  const query = $("#kbSearchInput").value.trim() || currentConcept().name;
  $("#kbSearchResults").innerHTML = `<div class="note">Retrieving chunks...</div>`;

  try {
    const response = await fetch("/api/kb/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, conceptId: currentConcept().id, topK: 6 }),
    });
    if (!response.ok) throw new Error("Search failed");
    const data = await response.json();
    kbSearchResults = data.results || [];
  } catch {
    kbSearchResults = [];
  }
  renderKnowledgeBase();
}

function bindEvents() {
  $$(".nav-button, [data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.view) setView(button.dataset.view);
    });
  });

  $("#conceptSelect").addEventListener("change", (event) => setConcept(event.target.value));
  $("#customTopicForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("#customTopicInput").value.trim();
    if (!value) return;
    const existing = allConcepts().find((concept) => concept.name.toLowerCase() === value.toLowerCase());
    const concept = existing || createCustomConcept(value);
    if (!existing) state.customConcepts.push(concept);
    $("#customTopicInput").value = "";
    setConcept(concept.id);
  });

  $("#goalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = $("#learningGoalInput").value.trim();
    state.learningGoal = value || `Build durable understanding of ${currentConcept().name}`;
    saveState();
    refreshCourseOutline({ render: false });
    renderPlan();
  });

  ["#learningStyle", "#depth", "#tone"].forEach((selector) => {
    $(selector).addEventListener("change", () => {
      updateProfileFromControls();
      renderAll();
    });
  });

  $$("#modeControl button").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMode = button.dataset.mode;
      saveState();
      renderChat();
    });
  });

  $("#chatForm").addEventListener("submit", sendChatMessage);
  $("#analyzeTeachBack").addEventListener("click", analyzeTeachBackInput);
  $("#notebookAnalyzeButton").addEventListener("click", analyzeNotebookSaathiInput);
  $("#notebookLoadDemo").addEventListener("click", loadNotebookSaathiDemo);
  $("#newQuizButton").addEventListener("click", startNewQuiz);
  $("#resumeRefreshButton").addEventListener("click", () => refreshSmartResume());
  $("#refreshCourseOutlineButton").addEventListener("click", () => refreshCourseOutline());
  $("#refreshLessonScriptButton").addEventListener("click", () => refreshLessonScript());
  $("#generateLessonScriptButton").addEventListener("click", generateAndSaveLessonScript);
  $("#refreshCitationNotebookButton").addEventListener("click", () => refreshCitationNotebook());
  $("#refreshKbButton").addEventListener("click", refreshKnowledgeBaseStats);
  $("#kbDocumentForm").addEventListener("submit", submitKnowledgeDocument);
  $("#kbFileInput").addEventListener("change", importKnowledgeFile);
  $("#kbSearchForm").addEventListener("submit", searchKnowledgeBasePreview);
  $("#resetProgress").addEventListener("click", () => {
    if (!confirm("Reset local learning progress?")) return;
    state.memory = {};
    state.quiz = null;
    state.lastTeachBack = null;
    saveState();
    renderAll();
  });
}

function normaliseUiGlyphs() {
  const icons = {
    dashboard: "D",
    plan: "P",
    knowledge: "KB",
    tutor: "T",
    notebook: "N",
    teachback: "R",
    quiz: "?",
    graph: "G",
    progress: "M",
  };

  $$(".nav-button").forEach((button) => {
    const icon = button.querySelector(".nav-icon");
    if (icon && icons[button.dataset.view]) icon.textContent = icons[button.dataset.view];
  });

  const sendButton = $(".send-button");
  if (sendButton) sendButton.textContent = ">";
}

function bootstrap() {
  normaliseUiGlyphs();
  if (!state.memory[state.selectedConceptId]) currentMemory();
  if (!state.messages[state.selectedConceptId]) setConcept(state.selectedConceptId);
  bindEvents();
  renderAll();
  refreshKnowledgeBaseStats();
  refreshLlmHealth();
  refreshLearnerJournal();
  hydrateLearnerStateFromServer();
  refreshSmartResume();
  refreshCourseOutline();
  refreshLessonScript();
  refreshCitationNotebook();
}

bootstrap();





