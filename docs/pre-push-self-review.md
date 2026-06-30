# Pre-Push Self-Review

Date: 2026-06-30
Branch: `codex/ai-tutor-working-app`

## Scope Reviewed

- Pasted NeuroTutor file-by-file and branch analysis.
- Pasted active-construction tutor architecture notes.
- Current local docs and implementation files.
- Current test suite.

## Findings

### P1: Active-construction architecture was under-specified

The branch already said the tutor should not be a chatbot, but it did not fully
capture the stronger system requirement from the pasted analysis: the learner
must actively construct knowledge through attempts, hints, self-explanation,
retrieval, calibration, and fading.

Status: fixed in `docs/tutor-system-architecture.md` by adding the
Active-Construction Architecture section and tightening tutor-policy priorities.

### P2: LLM tutor safety needed more than generic prompt-injection safety

The branch covered prompt injection and groundedness, but not enough
pedagogical-safety risk: answer leakage, over-helping, multi-turn scaffolding
failure, and learner bypassing of the tutor's requested learning step.

Status: fixed in `docs/ai-tutor-research-papers.md` by adding SafeTutors,
answer-leakage robustness, KMP-Bench, and scaffolding-uptake references.

### P2: Several high-value learning engines are still TODO, not implemented

The app has teach-back, active recall, lightweight spaced review, learner state,
and quality scoring. It does not yet fully implement productive-failure
front-ends, FSRS/interleaving, adaptive scaffolding fade-out, confidence
prediction before retrieval, or uptake metrics.

Status: documented as research-backed TODOs. These should not be claimed as
implemented until code and tests exist.

## Verification

Run before this review was recorded:

```powershell
npm.cmd test
```

Result: 71 tests passed, 0 failed.

## Push Decision

Ready to push after this self-review because the review found documentation
gaps, the gaps were fixed, and verification stayed green. The remaining items
are correctly represented as TODOs rather than implemented features.
