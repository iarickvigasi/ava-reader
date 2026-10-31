// Run from apps/api with OPENROUTER_API_KEY; output contains authored test phrases only.
const fs = require("node:fs");
const path = require("node:path");
const cases = [
  ["羅生門", "ラショウモン"],
  ["芥川龍之介", "アクタガワリュウノスケ"],
  ["或日の暮方の事である", "アルヒノクレガタノコトデアル"],
];
const out = path.resolve("../../output/word-narration/rashomon");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const results = [];
  for (const [i, [original, reading]] of cases.entries())
    for (const [kind, text] of [
      ["raw", original],
      ["reading", reading],
    ]) {
      const started = Date.now();
      const r = await fetch("https://openrouter.ai/api/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "elevenlabs/eleven-flash-v2.5",
          input: text,
          voice: "alice",
          response_format: "mp3",
          provider: {
            options: {
              elevenlabs: {
                language_code: "ja",
                voice_settings: { speed: 0.85 },
              },
            },
          },
        }),
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok) {
        console.log({ i, kind, status: r.status });
        continue;
      }
      const audio = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(path.join(out, `${i}-${kind}.mp3`), audio);
      const row = {
        i,
        kind,
        text,
        bytes: audio.length,
        ms: Date.now() - started,
      };
      results.push(row);
      console.log(row);
    }
  fs.writeFileSync(
    path.join(out, "generation.json"),
    JSON.stringify(results, null, 2),
  );
})();
