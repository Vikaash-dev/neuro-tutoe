import test from "node:test";
import assert from "node:assert/strict";
import {
  NOTEBOOK_SAATHI_INITIAL_ATTEMPTS,
  NOTEBOOK_SAATHI_QUESTION,
  buildNotebookSaathiDemoSummary,
  classifyFractionMisconception,
  formatNotebookSaathiRows,
  parseNotebookSaathiRows,
} from "../src/notebook-saathi.js";

test("Notebook Saathi demo summarizes misconception clusters and learning lift", () => {
  const summary = buildNotebookSaathiDemoSummary();

  assert.equal(summary.initialScore.correct, 2);
  assert.equal(summary.initialScore.total, 10);
  assert.equal(summary.initialScore.percent, 20);
  assert.equal(summary.retryScore.correct, 7);
  assert.equal(summary.retryScore.percent, 70);
  assert.equal(summary.improvementPercentagePoints, 50);
  assert.equal(summary.affectedStudents, 8);

  const clusterIds = summary.clusters.map((cluster) => cluster.id);
  assert.deepEqual(clusterIds, [
    "adds_numerators_and_denominators",
    "uses_multiplication_for_addition",
    "weak_common_denominator_conversion",
  ]);
});

test("Notebook Saathi classifier separates common fraction-error patterns", () => {
  assert.equal(
    classifyFractionMisconception(
      { studentId: "S02", answer: "2/5", work: "Add top and bottom." },
      NOTEBOOK_SAATHI_QUESTION,
    ).id,
    "adds_numerators_and_denominators",
  );

  assert.equal(
    classifyFractionMisconception(
      { studentId: "S03", answer: "1/6", work: "I multiplied numerator and denominator." },
      NOTEBOOK_SAATHI_QUESTION,
    ).id,
    "uses_multiplication_for_addition",
  );

  assert.equal(
    classifyFractionMisconception(
      { studentId: "S04", answer: "2/6", work: "Common denominator 6 but both become 1/6." },
      NOTEBOOK_SAATHI_QUESTION,
    ).id,
    "weak_common_denominator_conversion",
  );
});

test("Notebook Saathi row parser keeps prototype data anonymized", () => {
  const rows = parseNotebookSaathiRows(formatNotebookSaathiRows(NOTEBOOK_SAATHI_INITIAL_ATTEMPTS));

  assert.equal(rows.length, 10);
  assert.equal(rows[0].studentId, "S01");
  assert.equal(rows.some((row) => /vikaash|student name|roll/i.test(row.studentId)), false);
});
