# Persistent-session probe daemon for a USB-connected iPhone's Safari tab.
# Attaches ONCE to the first tab whose URL matches TARGET_MATCH, holds the
# inspector session (re-attaching only when truly lost), installs the in-page
# recorders, then streams their buffers to disk every round. Stdout lines are
# emitted only on state changes — run it under a background monitor and treat
# each line as an event. See README.md for the full workflow and pitfalls.
import asyncio
import glob
import json
import os
import sys
import uuid

from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.web_protocol.inspector_session import InspectorSession
from pymobiledevice3.services.web_protocol.session_protocol import SessionProtocol
from pymobiledevice3.services.webinspector import WebinspectorService

HERE = os.path.dirname(os.path.abspath(__file__))
PROBES = os.path.join(HERE, "probes")
CMDQ = os.path.join(HERE, "cmdq")
OUT = os.path.join(HERE, "out")
TARGET_MATCH = sys.argv[1] if len(sys.argv) > 1 else "avareader"

def load_probe(name):
    # probes/ is a per-investigation scratch area (gitignored): recorders are
    # optional, and a missing file just switches that recorder off.
    try:
        return open(os.path.join(PROBES, name)).read()
    except OSError:
        return None


FOOT_MON = load_probe("footer-monitor.js")
FOOT_PULL = load_probe("footer-pull.js")
SEL_MON = load_probe("sel-monitor.js")
SEL_PULL = load_probe("sel-pull.js")
FOOTER_ON = bool(FOOT_MON and FOOT_PULL)
SEL_ON = bool(SEL_MON and SEL_PULL)
ROUND_S = 10
LOST_AFTER_FAILS = 9  # ~90s of stalled evaluates -> assume target gone


async def _wait_target(inspector, timeout):
    async def w():
        while True:
            while inspector.wir_events:
                ev = inspector.wir_events.pop(0)
                if "targetInfo" in ev.get("params", {}):
                    return ev["params"]["targetInfo"]["targetId"]
            await asyncio.sleep(0.05)

    return await asyncio.wait_for(w(), timeout)


async def _teardown(inspector, session_id, target):
    # A session that dies without this wedges webinspectord: every later
    # attach to the page hangs with no Target event until Safari is
    # force-quit. Never skip it, even on error paths.
    try:
        await asyncio.wait_for(
            inspector.teardown_inspector_socket(
                session_id, target.application.id_, target.page.id_
            ),
            timeout=5,
        )
    except Exception:
        pass


async def attach_once():
    # Device/service bring-up gets its own guard: with the cable unplugged,
    # create_using_usbmux raises, and without this the daemon dies instead of
    # waiting for the phone to come back.
    try:
        lockdown = await create_using_usbmux()
        inspector = WebinspectorService(lockdown=lockdown)
        await inspector.connect()
    except Exception as e:
        return None, f"no-device:{type(e).__name__}"
    session_id = str(uuid.uuid4()).upper()
    target = None
    try:
        pages = await inspector.get_open_application_pages(timeout=6)
        target = next(
            (ap for ap in pages if TARGET_MATCH in (ap.page.web_url or "")), None
        )
        if target is None:
            await inspector.close()
            return None, "no-page"
        await inspector.setup_inspector_socket(
            session_id, target.application.id_, target.page.id_
        )
        try:
            tid = await _wait_target(inspector, 20)
        except asyncio.TimeoutError:
            # Suspended page (Safari backgrounded) or wedged webinspectord —
            # indistinguishable here; caller keeps retrying either way.
            await _teardown(inspector, session_id, target)
            await inspector.close()
            return None, "no-target"
        proto = SessionProtocol(
            inspector, session_id, target.application, target.page, method_prefix=""
        )
        session = InspectorSession(proto, tid)
        await session.runtime_enable()
        return (inspector, session, session_id, target), "ok"
    except Exception as e:
        try:
            if target is not None:
                await _teardown(inspector, session_id, target)
            await inspector.close()
        except Exception:
            pass
        return None, f"error:{type(e).__name__}"


async def ev(session, exp, t=15):
    return await asyncio.wait_for(
        session.runtime_evaluate(exp, return_by_value=True), timeout=t
    )


async def run_cmds(session):
    done = []
    for path in sorted(glob.glob(f"{CMDQ}/*.js")):
        name = os.path.basename(path)
        try:
            res = await ev(session, open(path).read(), t=25)
        except Exception as e:
            res = {"cmd-error": f"{type(e).__name__}: {e}"}
        with open(f"{CMDQ}/done/{name}.result.json", "w") as f:
            json.dump(res, f, default=str)
        os.rename(path, f"{CMDQ}/done/{name}")
        done.append(name)
    return done


async def main():
    os.makedirs(f"{CMDQ}/done", exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    attach_fail_streak = 0
    while True:
        bundle, state = await attach_once()
        if bundle is None:
            attach_fail_streak += 1
            if attach_fail_streak in (1, 20):
                print(
                    f"WAITING TO ATTACH (state={state}, tries={attach_fail_streak})"
                    " — page must be foreground",
                    flush=True,
                )
            await asyncio.sleep(12)
            continue
        attach_fail_streak = 0
        inspector, session, session_id, target = bundle
        print(f"ATTACHED url={target.page.web_url}", flush=True)
        try:
            parts = []
            if SEL_ON:
                parts.append(f"sel={await ev(session, SEL_MON, t=20)}")
            if FOOTER_ON:
                parts.append(f"footer={await ev(session, FOOT_MON, t=20)}")
            status = " ".join(parts) if parts else "(none — probes/ empty, cmdq only)"
            print(f"RECORDERS READY {status}", flush=True)
        except Exception as e:
            print(
                f"RECORDER INSTALL FAILED ({type(e).__name__}) — reattaching",
                flush=True,
            )
            await _teardown(inspector, session_id, target)
            await inspector.close()
            continue
        last_sel = 0
        last_anom = 0
        fails = 0
        suspended_noted = False
        while True:
            try:
                sel = await ev(session, SEL_PULL) if SEL_ON else None
                foot = await ev(session, FOOT_PULL) if FOOTER_ON else None
                for name in await run_cmds(session):
                    print(f"CMD DONE: {name}", flush=True)
                fails = 0
                if suspended_noted:
                    print("PAGE ACTIVE AGAIN", flush=True)
                    suspended_noted = False
                if sel is not None:
                    with open(f"{OUT}/latest-sel.json", "w") as f:
                        json.dump(sel, f, default=str)
                if foot is not None:
                    with open(f"{OUT}/latest-footer.json", "w") as f:
                        json.dump(foot, f, default=str)
                # Any active recorder reporting installed:false means the page
                # reloaded (in-page state gone) -> reinstall all active ones.
                lost = lambda pull: not (isinstance(pull, dict) and pull.get("installed"))
                if (SEL_ON and lost(sel)) or (FOOTER_ON and lost(foot)):
                    if SEL_ON:
                        await ev(session, SEL_MON, t=20)
                    if FOOTER_ON:
                        await ev(session, FOOT_MON, t=20)
                    last_sel = 0
                    last_anom = 0
                    print("RECORDERS REINSTALLED after reload", flush=True)
                else:
                    if SEL_ON:
                        n = (sel.get("counts") or {}).get("changes", 0)
                        if n < last_sel:
                            last_sel = 0
                        if n > last_sel:
                            sample = [
                                e
                                for e in (sel.get("last") or [])
                                if not e.get("collapsed")
                            ][-2:]
                            print(
                                f"SEL EVENTS +{n - last_sel} (total {n})"
                                f" noncollapsed={json.dumps(sample)[:600]}",
                                flush=True,
                            )
                            last_sel = n
                    if FOOTER_ON:
                        a = (foot.get("counts") or {}).get("anomalies", 0)
                        if a < last_anom:
                            last_anom = 0
                        if a > last_anom:
                            print(
                                f"FOOTER ANOMALIES +{a - last_anom} (total {a})"
                                f" peak={json.dumps(foot.get('peak'))[:400]}",
                                flush=True,
                            )
                            last_anom = a
            except asyncio.TimeoutError:
                fails += 1
                if not suspended_noted:
                    print(
                        "PAGE SUSPENDED (evaluate stalled) — holding session",
                        flush=True,
                    )
                    suspended_noted = True
                if fails >= LOST_AFTER_FAILS:
                    print("SESSION PRESUMED LOST — reattaching", flush=True)
                    break
            except Exception as e:
                print(
                    f"SESSION ERROR {type(e).__name__}: {e} — reattaching", flush=True
                )
                break
            await asyncio.sleep(ROUND_S)
        await _teardown(inspector, session_id, target)
        try:
            await inspector.close()
        except Exception:
            pass


asyncio.run(main())
