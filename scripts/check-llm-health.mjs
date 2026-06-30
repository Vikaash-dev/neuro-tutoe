import { probeLlm } from "../src/local-llm.js";

const health = await probeLlm();

console.log(`LM Studio health: ${health.ok ? "ok" : "not reachable"}`);
console.log(`Base URL: ${health.baseUrl}`);
console.log(`Models URL: ${health.modelsUrl || `${health.baseUrl}/models`}`);
console.log(`Model: ${health.model || "auto"}`);
if (health.reason) console.log(`Reason: ${health.reason}`);
if (health.details?.causeCode) console.log(`Cause: ${health.details.causeCode}`);

if (health.troubleshooting?.length) {
  console.log("");
  console.log("Troubleshooting:");
  for (const step of health.troubleshooting) {
    console.log(`- ${step}`);
  }
}

process.exitCode = health.ok ? 0 : 1;
