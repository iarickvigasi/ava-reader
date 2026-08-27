# iPhone live-tab inspector

Evaluate JavaScript inside the user's *real, logged-in* Safari tab on a USB-connected iPhone — no
Xcode, no simulator, no sudo, no automation session. Built to diagnose device-only bugs on
avareader.space (the tab-bar drift and the invisible-selection bug were both root-caused with it,
2026-08-27, iPhone 17 / iOS 26.5.2). Works for any site by passing a URL substring.

## How it works
`pymobiledevice3` speaks Apple's Web Inspector protocol over plain usbmux. We attach an inspector
session to an existing page (the user's session and cookies — nothing is relaunched), install
small "recorder" scripts that buffer measurements inside the page (`window.__ava*Probe` ring
buffers), and stream those buffers back every few seconds. Reproduction is therefore captured even
while the Mac isn't looking — essential for intermittent bugs and for the fact that the page
suspends whenever the user leaves Safari.

## One-time setup
Phone (user does this): Settings → Apps → Safari → Advanced → **Web Inspector** ON. Connect USB,
tap **Trust This Computer**. (Developer Mode NOT needed. **Remote Automation** only if you want
`pymobiledevice3 webinspector launch <url>`; attaching to existing tabs doesn't need it.)

Mac:
```bash
python3 -m venv .venv && .venv/bin/pip install pymobiledevice3   # proven with 11.1.3
.venv/bin/pymobiledevice3 usbmux list                            # phone visible?
.venv/bin/pymobiledevice3 webinspector opened-tabs -t 4          # tabs listed?
```
`opened-tabs` shows tabs only while Safari is running; `Safari(<pid>)` in each row is how you
verify a force-quit actually happened (new pid), which matters below.

## Golden rules (each one cost us an hour — agents: read before touching)
1. **One inspector session per page.** Never run two probes/daemons concurrently — they
   race the single per-page slot and both hang.
2. **Every attach gets a timeout AND a `teardown_inspector_socket` in `finally`.** A session
   killed without teardown *wedges webinspectord*: every later attach hangs with no Target event
   until Safari is **force-quit** (App Switcher → swipe away; confirm via a new Safari pid).
3. **A backgrounded Safari is a suspended page.** The tab stays *listed*, but attach/evaluate
   stalls. Don't diagnose "wedged" from failures while the user isn't in Safari; the daemon just 
   waits and retries.
4. **In-page recorder state survives SPA navigation but dies on reload.** The daemon detects the
   loss on its next round and reinstalls automatically; a reproduction made in that gap is lost.
5. **Filter rubber-band before calling anything an anomaly.** During overscroll, `scrollY` goes
   negative (or past max) and `position:fixed` elements shift by exactly the excursion — normal
   iOS behaviour that floods naive detectors (see `probes/footer-monitor.js` for the filter).

## Running an investigation
```bash
.venv/bin/python daemon.py            # or: daemon.py mysite.example  (URL substring)
```
Run it in the background and watch stdout — it prints only state changes: `WAITING TO ATTACH`,
`ATTACHED`, `RECORDERS READY`, `SEL EVENTS +n`, `FOOTER ANOMALIES +n`, `PAGE SUSPENDED`,
`RECORDERS REINSTALLED`, `CMD DONE`. Latest recorder buffers land in `out/latest-*.json`.

Ad-hoc queries while the daemon runs: drop any `.js` file into `cmdq/` (prefix `01-`, `02-` for
order). Each is evaluated in the page on the next round; the return value lands in
`cmdq/done/<name>.result.json`. Never run `rprobe.py` while the daemon is up (rule 1) — it's the
standalone one-shot for when nothing else is attached.

Coordinating with the user (they can't see chat while in Safari — sequence it):
1. Ask them to open the target page and *stay in Safari ~1 min* (daemon attaches + installs).
2. They reproduce at their own pace; recorders capture offline; you get live `SEL EVENTS` lines.
3. They return to chat; you read `out/` + `cmdq/done/` and correlate with what they saw.

## Probes — per-investigation scratch area (`probes/`, gitignored)
Probe files are NOT committed; each investigation writes its own. At startup the daemon loads any
of these well-known pairs and silently skips absent ones (`cmdq/` works regardless; with no probes
at all it still attaches and serves ad-hoc queries). Restart the daemon after adding files.
- `footer-monitor.js` + `footer-pull.js` — fixed/sticky-chrome drift recorder.
- `sel-monitor.js` + `sel-pull.js` — text-selection recorder.

Contract: a *monitor* is an IIFE that installs a persistent recorder on `window` (guard against
double-install) and returns a short status string. A *pull* is an IIFE returning
`{installed: bool, counts: {...}, ...}`. `installed: false` on any active recorder triggers a
reinstall of all of them (page reloaded); growth of `counts.changes` (sel) or `counts.anomalies`
(footer) emits an event line with the pull's `last`/`peak` payloads.

Probe designs proven in the 2026-08 investigations (regenerate from these notes as needed):
- footer recorder — sample visualViewport scale/offsets, scrollY, doc size, and the fixed nav's
  rect + computed position on scroll/touch/resize/focus + a 1s tick; classify per sample
  (`SCALE`, `VV-PAN`, `NAV-RECT-OFF`, `NAV-NOT-FIXED`, `DOC-WIDE` — each maps to a different
  mechanism); ignore rubber-band-explained frames (golden rule 5).
- selection recorder — every selectionchange with the range's client rects (geometry-vs-paint
  discrimination), collapse timeline, touchend correlation.
- useful one-shots — viewport snapshot (vv + nav computed style); `::selection` rules + article
  column/transform/ancestor compositing chain + CSS Highlight API availability; staged
  repaint-nudge experiment (willChange → translateZ → opacity, then a loud red `::selection`) to
  split styling vs geometry vs compositing vs app-cleared. Experiments mutate styles transiently —
  run them only with the user's informed go-ahead.

## Scope & conduct
You are inside a real person's browsing session. Measurements only; transient style experiments
only with the user's informed go-ahead; never navigate, type, or touch their data. Tear down what
you install (recorders die with the page; the red-style experiment removes itself).
