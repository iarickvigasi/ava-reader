// From apps/api: TS_NODE_TRANSPILE_ONLY=true node -r ts-node/register ../../scripts/narration/benchmark-language.cjs
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const apiRequire = createRequire(
  path.resolve(__dirname, "../../apps/api/package.json"),
);
const { ConfigService } = apiRequire("@nestjs/config");
const {
  requestLanguageDecision,
} = require("../../apps/api/src/narration/language/request-language-decision");
const config = new ConfigService(process.env);
const cases = require("./language-cases.json");
const models = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["typesafe/jev-1.14", "liquid/d1.1"];
const fetchOriginal = global.fetch;
let usage;
global.fetch = async (...args) => {
  const response = await fetchOriginal(...args);
  try {
    const data = await response.clone().json();
    usage = { ...data.usage, servedModel: data.model };
  } catch {
    usage = undefined;
  }
  return response;
};
(async () => {
  const results = [];
  for (const model of models) {
    for (const [index, row] of cases.entries()) {
      const start = performance.now();
      usage = undefined;
      try {
        const answer = await requestLanguageDecision(config, row, model);
        results.push({
          model,
          index,
          expected: row.expected,
          actual: answer.choice,
          probability: answer.probabilities[answer.choice],
          ms: Math.round(performance.now() - start),
          usage,
        });
      } catch (error) {
        results.push({
          model,
          index,
          expected: row.expected,
          error: error.message,
          ms: Math.round(performance.now() - start),
          usage,
        });
      }
      console.log(results.at(-1));
    }
  }
  const out = path.resolve(__dirname, "../../output/word-narration");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "language-benchmark.json"),
    JSON.stringify(results, null, 2),
  );
})();
