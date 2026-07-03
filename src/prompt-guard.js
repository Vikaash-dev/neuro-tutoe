const INJECTION_RULES = [
  {
    id: "ignore-instructions",
    severity: 5,
    pattern: /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|system|developer)\b.{0,30}\b(instructions?|messages?|prompt)\b/i,
  },
  {
    id: "role-override",
    severity: 4,
    pattern: /\b(you are now|act as|switch role|developer mode|jailbreak)\b/i,
  },
  {
    id: "system-prompt-exfiltration",
    severity: 5,
    pattern: /\b(reveal|print|show|dump|leak|exfiltrate)\b.{0,40}\b(system prompt|developer message|hidden instructions?|secrets?)\b/i,
  },
  {
    id: "tool-manipulation",
    severity: 4,
    pattern: /\b(call|use|invoke|run)\b.{0,30}\b(tool|function|api|shell|command)\b/i,
  },
  {
    id: "source-authority-claim",
    severity: 3,
    pattern: /\b(this document|this source|the retrieved context)\b.{0,50}\b(overrides|has higher priority|is the system message)\b/i,
  },
  {
    id: "data-theft",
    severity: 5,
    pattern: /\b(send|post|upload|copy)\b.{0,50}\b(api key|token|password|private data|local files?)\b/i,
  },
];

export function assessPromptInjectionRisk(text = "") {
  const raw = String(text || "");
  const findings = [];

  for (const rule of INJECTION_RULES) {
    const match = raw.match(rule.pattern);
    if (match) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        excerpt: match[0].slice(0, 160),
      });
    }
  }

  const score = findings.reduce((sum, finding) => sum + finding.severity, 0);
  const riskLevel = score >= 8 ? "high" : score >= 4 ? "medium" : score > 0 ? "low" : "none";

  return {
    riskLevel,
    score,
    findings,
  };
}

export function sanitizeRetrievedText(text = "") {
  const lines = String(text || "").split(/\r?\n/);
  const sanitized = lines.map((line) => {
    const risk = assessPromptInjectionRisk(line);
    if (risk.score === 0) return line;
    const labels = risk.findings.map((finding) => finding.id).join(", ");
    return `[Untrusted source directive redacted: ${labels}]`;
  });

  return sanitized.join("\n");
}

export function guardrailSummary(risk = {}) {
  if (!risk || risk.riskLevel === "none") return "";
  const labels = (risk.findings || []).map((finding) => finding.id).join(", ");
  return `${risk.riskLevel} prompt-injection risk${labels ? `: ${labels}` : ""}`;
}
