"""Install one verified official EPUBCheck release during the image build."""

import hashlib
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

URL = "https://github.com/w3c/epubcheck/releases/download/v5.4.0/epubcheck-5.4.0.zip"
ARCHIVE_SHA256 = "33350c61038e71dfb3d45a76aed04bf5481e6d5500cb780f6e98db8bbd15a28c"


def main() -> None:
    target = Path(sys.argv[1])
    manifest = json.loads(Path(__file__).with_name("epubcheck-distribution.json").read_text())
    with urllib.request.urlopen(URL, timeout=60) as response:
        data = response.read(64 * 1024 * 1024 + 1)
    if len(data) > 64 * 1024 * 1024 or hashlib.sha256(data).hexdigest() != ARCHIVE_SHA256:
        raise ValueError("EPUBCheck release digest mismatch")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        files = {
            name.removeprefix("epubcheck-5.4.0/"): archive.read(name)
            for name in archive.namelist()
            if not name.endswith("/")
        }
    if set(files) != set(manifest["files_sha256"]):
        raise ValueError("EPUBCheck distribution membership mismatch")
    for name, payload in files.items():
        if hashlib.sha256(payload).hexdigest() != manifest["files_sha256"][name]:
            raise ValueError("EPUBCheck member digest mismatch")
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
    (target / "ava-distribution.json").write_text(json.dumps(manifest, sort_keys=True))


if __name__ == "__main__":
    main()
