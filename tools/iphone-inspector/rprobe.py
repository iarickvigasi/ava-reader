# One-shot evaluator: attach to the matching Safari tab, evaluate the given
# probe files in order, print each result as JSON, tear down, exit. Use ONLY
# when daemon.py is NOT running (one inspector session per page — concurrent
# attachers wedge webinspectord; see README.md). While the daemon runs, drop
# files into cmdq/ instead.
#   usage: rprobe.py <probe.js> [more.js ...] [--match <url-substring>]
import asyncio
import json
import os
import sys
import uuid

from pymobiledevice3.lockdown import create_using_usbmux
from pymobiledevice3.services.web_protocol.inspector_session import InspectorSession
from pymobiledevice3.services.web_protocol.session_protocol import SessionProtocol
from pymobiledevice3.services.webinspector import WebinspectorService

HERE = os.path.dirname(os.path.abspath(__file__))


def parse_args():
    files, match = [], "avareader"
    args = sys.argv[1:]
    while args:
        a = args.pop(0)
        if a == "--match":
            match = args.pop(0)
        else:
            files.append(a)
    return files, match


async def wait_target(inspector):
    while True:
        while inspector.wir_events:
            ev = inspector.wir_events.pop(0)
            if "targetInfo" in ev.get("params", {}):
                return ev["params"]["targetInfo"]["targetId"]
        await asyncio.sleep(0.05)


async def main():
    files, match = parse_args()
    lockdown = await create_using_usbmux()
    inspector = WebinspectorService(lockdown=lockdown)
    await inspector.connect()
    session_id = str(uuid.uuid4()).upper()
    target = None
    try:
        pages = await inspector.get_open_application_pages(timeout=6)
        target = next((ap for ap in pages if match in (ap.page.web_url or "")), None)
        if target is None:
            print(json.dumps({"error": "page-not-found", "pages": [str(p) for p in pages]}))
            return
        await inspector.setup_inspector_socket(
            session_id, target.application.id_, target.page.id_
        )
        try:
            target_id = await asyncio.wait_for(wait_target(inspector), timeout=15)
        except asyncio.TimeoutError:
            print(json.dumps({
                "error": "no-target-event",
                "hint": "page suspended (foreground Safari) or webinspectord wedged"
                        " (force-quit Safari, verify new PID in opened-tabs)",
            }))
            return
        protocol = SessionProtocol(
            inspector, session_id, target.application, target.page, method_prefix=""
        )
        session = InspectorSession(protocol, target_id)
        await session.runtime_enable()
        for name in files:
            path = name if os.path.isabs(name) else os.path.join(HERE, "probes", name)
            if not os.path.exists(path):
                path = name
            exp = open(path).read()
            result = await asyncio.wait_for(
                session.runtime_evaluate(exp, return_by_value=True), timeout=20
            )
            print(json.dumps({name: result}, default=str), flush=True)
    finally:
        if target is not None:
            # Never skip: a leaked session blocks every future attach to this
            # page until Safari is force-quit.
            try:
                await asyncio.wait_for(
                    inspector.teardown_inspector_socket(
                        session_id, target.application.id_, target.page.id_
                    ),
                    timeout=5,
                )
            except Exception:
                pass
        await inspector.close()


asyncio.run(main())
