# Historical implementation evidence — 31 October 2026

Snapshot retained verbatim; current status: [shared task](../items/2026-10-31-word-narration.md).

## Reported failures and synchronized tool language — active goal

Founder reported repeated generic narration failures and wrong Rashōmon title/author pronunciation.
Acceptance: reproduce/diagnose failures; recover safely with truthful status feedback; verify the
Japanese readings 羅生門=ラショウモン, 芥川龍之介=アクタガワリュウノスケ and
或日の暮方の事である=アルヒノクレガタノコトデアル against actual generation. Compare cheaper/faster
speech models without losing supported languages. In a separate commit, make Translate To one shared
preference for Toolbox/Preferences and all three tool response languages, with language-scoped
queued/streaming/ready/failure results and regeneration after switching languages. Keep old results
and late completions distinct from the selected language. No production deployment is requested.

### Pronunciation/reliability fix evidence

The supplied three selections classify as Japanese in live Jev calls (0.99, 1.0, 1.0), so correct
language detection alone did not establish correct reading. Added lazy local Kuromoji/IPADIC
conversion. Actual speech inputs now read ラショーモン, アクタガワリューノスケ and
アルヒノクレガタノコトデアル. Three revised Flash generations returned playable MP3; warm calls
were 520/365ms after a 1,223ms first call including dictionary load. Founder listened to the revised
author-name sample and explicitly confirmed it correct. Flash raw/reading comparison and final
samples remain under output/word-narration/rashomon; no book/user content or credentials is staged.

Flash v2.5 costs $40/M characters versus v4’s $80/M at the checked provider rates and removes the
19-character direction prefix for supported languages. V4 fallback preserves broader coverage.
Safe stage/status diagnostics were added because the old generic catch hid auth, provider, timeout
and gesture failures; the exact historical cause of each user-reported failure cannot be recovered.
The detector’s overly tight 2s deadline is now 5s. A gesture-blocked prepared clip prompts a direct
play tap rather than a false connection error. Empty base URL configuration now uses the default.

Independent review found partial-token 生 readings initially fell back to ナマ regardless of
okurigana: repaired to イ in 生きる and ウ in 生まれた; unresolved partial compounds return422.
Review also found server timeout codes were being collapsed to generic provider failure; repaired.
Review’s exact narration tests pass 18/18. The dependency resolver stalled on unrelated optional
metadata; pinned cached-metadata install completed and lock formatting kept the diff to six added
packages. Early test call-argument expectations and a benchmark working-directory error were fixed.
No unrelated dependencies were upgraded. Physical/native-device behavior remains a release limit.
