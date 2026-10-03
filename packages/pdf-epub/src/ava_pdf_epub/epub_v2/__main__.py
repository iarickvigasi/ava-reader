"""Private bounded reimport subprocess; no paths, provider environment, or publication."""

import base64
import json
import sys

from ..contracts.common import MAX_WIRE_BYTES
from .archive import MAX_ARCHIVE_BYTES
from .reader import prepare_reader
from .reimport import reimport_epub


def main() -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_ARCHIVE_BYTES * 2 + 1)
        if len(raw) > MAX_ARCHIVE_BYTES * 2:
            raise ValueError("Input bound exceeded")
        request = json.loads(raw)
        if not isinstance(request, dict) or set(request) != {
            "epub_base64",
            "canonical_sha256",
            "final_content_id",
        }:
            raise ValueError("Invalid request")
        data = base64.b64decode(request["epub_base64"], validate=True)
        book = reimport_epub(data, request["canonical_sha256"])
        reader = prepare_reader(book, request["final_content_id"])
        response = reader.model_dump_json().encode()
        if len(response) > MAX_WIRE_BYTES:
            raise ValueError("Output bound exceeded")
        sys.stdout.buffer.write(response)
        return 0
    except Exception:
        # No source content, ZIP paths, or library exception text crosses this boundary.
        sys.stdout.write('{"error":"INVALID_EPUB"}')
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
