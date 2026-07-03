export const NOTEBOOK_SAATHI_QUESTION = {
  id: "fraction-addition-01",
  prompt: "Solve: 1/2 + 1/3",
  correctAnswer: "5/6",
  concept: "Adding unlike fractions",
};

export const NOTEBOOK_SAATHI_RETRY_QUESTION = {
  id: "fraction-addition-retry-01",
  prompt: "Retry: 1/4 + 1/3",
  correctAnswer: "7/12",
  concept: "Adding unlike fractions",
};

export const NOTEBOOK_SAATHI_INITIAL_ATTEMPTS = [
  {
    studentId: "S01",
    answer: "5/6",
    work: "LCM of 2 and 3 is 6. 1/2 = 3/6, 1/3 = 2/6, so 5/6.",
  },
  {
    studentId: "S02",
    answer: "2/5",
    work: "Add the top numbers and add the bottom numbers: 1+1 over 2+3.",
  },
  {
    studentId: "S03",
    answer: "1/6",
    work: "Fractions use numerator times numerator and denominator times denominator.",
  },
  {
    studentId: "S04",
    answer: "2/6",
    work: "Make both denominators 6, then 1/2 becomes 1/6 and 1/3 becomes 1/6.",
  },
  {
    studentId: "S05",
    answer: "3/6",
    work: "Common denominator 6. I changed 1/2 to 2/6 and kept 1/3 as 1/6.",
  },
  {
    studentId: "S06",
    answer: "5/6",
    work: "1/2 is 3 parts out of 6 and 1/3 is 2 parts out of 6.",
  },
  {
    studentId: "S07",
    answer: "4/6",
    work: "LCM is 6, so I wrote 1/2 as 2/6 and 1/3 as 2/6.",
  },
  {
    studentId: "S08",
    answer: "2/5",
    work: "Same denominator is not needed; just add numerator and denominator.",
  },
  {
    studentId: "S09",
    answer: "1/6",
    work: "I multiplied because the denominators are different.",
  },
  {
    studentId: "S10",
    answer: "3/5",
    work: "I added the numerators and guessed a denominator between 2 and 3.",
  },
];

export const NOTEBOOK_SAATHI_RETRY_ATTEMPTS = [
  {
    studentId: "S01",
    answer: "7/12",
    work: "LCM 12. 1/4 = 3/12 and 1/3 = 4/12, total 7/12.",
  },
  {
    studentId: "S02",
    answer: "7/12",
    work: "I used the common denominator 12 instead of adding denominators.",
  },
  {
    studentId: "S03",
    answer: "7/12",
    work: "This is addition, so convert to twelfths first.",
  },
  {
    studentId: "S04",
    answer: "7/12",
    work: "1/4 is 3/12 and 1/3 is 4/12.",
  },
  {
    studentId: "S05",
    answer: "7/12",
    work: "Both pieces are twelfths: 3/12 plus 4/12.",
  },
  {
    studentId: "S06",
    answer: "7/12",
    work: "Equivalent fractions: 3/12 + 4/12 = 7/12.",
  },
  {
    studentId: "S07",
    answer: "7/12",
    work: "I scaled numerator and denominator by the same factor.",
  },
  {
    studentId: "S08",
    answer: "2/7",
    work: "Add top and bottom again.",
  },
  {
    studentId: "S09",
    answer: "1/12",
    work: "I multiplied 1 by 1 and 4 by 3.",
  },
  {
    studentId: "S10",
    answer: "4/12",
    work: "LCM 12. 1/4 = 1/12 and 1/3 = 3/12.",
  },
];

export const NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY = {
  adds_numerators_and_denominators: {
    label: "Adds numerators and denominators",
    teacherSummary: "Students are treating a fraction like two independent whole numbers.",
    remediation:
      "Use a bar model with equal-sized sixths, then ask students why denominator size must stay fixed after conversion.",
    prototypePrompt: "Circle why 1/2 + 1/3 cannot become 2/5.",
    risk: "high",
  },
  uses_multiplication_for_addition: {
    label: "Uses multiplication rule for addition",
    teacherSummary: "Students may be overgeneralizing the multiply-fractions procedure.",
    remediation:
      "Contrast two examples side by side: 1/2 x 1/3 changes the operation, while 1/2 + 1/3 combines quantities.",
    prototypePrompt: "Sort three problems into add-fractions and multiply-fractions before solving.",
    risk: "medium",
  },
  weak_common_denominator_conversion: {
    label: "Weak common-denominator conversion",
    teacherSummary: "Students know they need a common denominator but are not scaling equivalent fractions correctly.",
    remediation:
      "Make students write the multiplier above each fraction: x3 for 1/2 and x2 for 1/3, applied to both numerator and denominator.",
    prototypePrompt: "Fill the missing numerator in 1/2 = __/6 and explain the multiplier.",
    risk: "medium",
  },
  unclear_reasoning: {
    label: "Unclear reasoning",
    teacherSummary: "The answer is incorrect but the visible work is too thin to diagnose reliably.",
    remediation:
      "Ask for one more line of work or a quick oral explanation before grouping the student.",
    prototypePrompt: "Show the equivalent fractions you used before adding.",
    risk: "low",
  },
};

const NOTEBOOK_SAATHI_CLUSTER_PRIORITY = Object.keys(NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY);

function normalizeFraction(value = "") {
  return String(value).trim().replace(/\s+/g, "").toLowerCase();
}

function clampConfidence(value) {
  return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
}

export function classifyFractionMisconception(attempt = {}, question = NOTEBOOK_SAATHI_QUESTION) {
  const answer = normalizeFraction(attempt.answer);
  const work = String(attempt.work || "").toLowerCase();
  const correctAnswer = normalizeFraction(question.correctAnswer);
  const evidence = [attempt.answer, attempt.work].filter(Boolean).join(" | ");

  if (answer === correctAnswer) {
    return {
      id: "secure_strategy",
      label: "Secure strategy",
      confidence: 0.98,
      evidence,
      isCorrect: true,
      risk: "none",
    };
  }

  if (
    ["2/5", "3/5", "2/7"].includes(answer) ||
    /add.*(top|numerator).*add.*(bottom|denominator)/.test(work) ||
    /add numerator.*denominator/.test(work)
  ) {
    return {
      id: "adds_numerators_and_denominators",
      ...NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY.adds_numerators_and_denominators,
      confidence: clampConfidence(work.includes("add") ? 0.92 : 0.82),
      evidence,
      isCorrect: false,
    };
  }

  if (["1/6", "1/12"].includes(answer) || /multiply|multiplied|times/.test(work)) {
    return {
      id: "uses_multiplication_for_addition",
      ...NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY.uses_multiplication_for_addition,
      confidence: clampConfidence(/multiply|multiplied|times/.test(work) ? 0.9 : 0.8),
      evidence,
      isCorrect: false,
    };
  }

  if (
    ["2/6", "3/6", "4/6", "4/12", "5/12"].includes(answer) ||
    /common denominator|lcm|denominator 6|denominator 12|twelfth|sixth/.test(work)
  ) {
    return {
      id: "weak_common_denominator_conversion",
      ...NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY.weak_common_denominator_conversion,
      confidence: clampConfidence(/common denominator|lcm/.test(work) ? 0.88 : 0.78),
      evidence,
      isCorrect: false,
    };
  }

  return {
    id: "unclear_reasoning",
    ...NOTEBOOK_SAATHI_MISCONCEPTION_LIBRARY.unclear_reasoning,
    confidence: 0.58,
    evidence,
    isCorrect: false,
  };
}

export function scoreNotebookAttempts(attempts = [], question = NOTEBOOK_SAATHI_QUESTION) {
  const total = attempts.length;
  const correct = attempts.filter(
    (attempt) => normalizeFraction(attempt.answer) === normalizeFraction(question.correctAnswer),
  ).length;
  return {
    correct,
    total,
    percent: total ? Math.round((correct / total) * 100) : 0,
  };
}

export function clusterNotebookAttempts(attempts = [], question = NOTEBOOK_SAATHI_QUESTION) {
  const clusters = new Map();
  for (const attempt of attempts) {
    const diagnosis = classifyFractionMisconception(attempt, question);
    if (diagnosis.isCorrect) continue;
    if (!clusters.has(diagnosis.id)) {
      clusters.set(diagnosis.id, {
        id: diagnosis.id,
        label: diagnosis.label,
        teacherSummary: diagnosis.teacherSummary,
        remediation: diagnosis.remediation,
        prototypePrompt: diagnosis.prototypePrompt,
        risk: diagnosis.risk,
        attempts: [],
        confidenceTotal: 0,
      });
    }
    const cluster = clusters.get(diagnosis.id);
    cluster.attempts.push({
      studentId: String(attempt.studentId || "").trim() || `S${cluster.attempts.length + 1}`,
      answer: String(attempt.answer || "").trim(),
      evidence: diagnosis.evidence,
    });
    cluster.confidenceTotal += diagnosis.confidence;
  }

  return [...clusters.values()]
    .map((cluster) => ({
      ...cluster,
      count: cluster.attempts.length,
      confidence: clampConfidence(cluster.confidenceTotal / Math.max(1, cluster.attempts.length)),
      studentIds: cluster.attempts.map((attempt) => attempt.studentId),
      sampleEvidence: cluster.attempts.slice(0, 2).map((attempt) => attempt.evidence),
    }))
    .sort((left, right) => {
      const leftPriority = NOTEBOOK_SAATHI_CLUSTER_PRIORITY.indexOf(left.id);
      const rightPriority = NOTEBOOK_SAATHI_CLUSTER_PRIORITY.indexOf(right.id);
      return (leftPriority < 0 ? 999 : leftPriority) - (rightPriority < 0 ? 999 : rightPriority);
    });
}

export function buildNotebookSaathiDemoSummary({
  attempts = NOTEBOOK_SAATHI_INITIAL_ATTEMPTS,
  retryAttempts = NOTEBOOK_SAATHI_RETRY_ATTEMPTS,
  question = NOTEBOOK_SAATHI_QUESTION,
  retryQuestion = NOTEBOOK_SAATHI_RETRY_QUESTION,
} = {}) {
  const initialScore = scoreNotebookAttempts(attempts, question);
  const retryScore = scoreNotebookAttempts(retryAttempts, retryQuestion);
  const clusters = clusterNotebookAttempts(attempts, question);
  return {
    question,
    retryQuestion,
    initialScore,
    retryScore,
    improvementPercentagePoints: retryScore.percent - initialScore.percent,
    clusters,
    affectedStudents: clusters.reduce((sum, cluster) => sum + cluster.count, 0),
    readinessChecks: [
      "Teacher approves every remediation before students see it",
      "Student identifiers are anonymized in the prototype",
      "The system explains evidence and confidence instead of issuing final grades",
      "Retry question measures learning lift after the teacher intervention",
    ],
  };
}

export function parseNotebookSaathiRows(text = "") {
  return String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const cleaned = line.replace(/^\d+[\).]\s*/, "");
      const parts = cleaned.split(/\s*\|\s*|\s*,\s*/).filter(Boolean);
      if (parts.length >= 3) {
        return {
          studentId: parts[0],
          answer: parts[1],
          work: parts.slice(2).join(" | "),
        };
      }
      if (parts.length === 2) {
        return {
          studentId: `S${String(index + 1).padStart(2, "0")}`,
          answer: parts[0],
          work: parts[1],
        };
      }
      return {
        studentId: `S${String(index + 1).padStart(2, "0")}`,
        answer: "",
        work: cleaned,
      };
    });
}

export function formatNotebookSaathiRows(attempts = NOTEBOOK_SAATHI_INITIAL_ATTEMPTS) {
  return attempts.map((attempt) => `${attempt.studentId} | ${attempt.answer} | ${attempt.work}`).join("\n");
}
