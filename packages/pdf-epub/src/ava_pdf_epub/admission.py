"""Bounded PDF admission only; ordinary Link annotations do not imply qualification."""

import hashlib
import json
import math
import sys
from pathlib import Path

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .admission_actions import AdmissionError, inspect_annotations, inspect_catalog


def inspect_admission(path: Path) -> dict[str, object]:
    if not 0 < path.stat().st_size <= 50 * 1024 * 1024:
        raise AdmissionError("PDF_SIZE_LIMIT")
    with path.open("rb") as stream:
        if not stream.read(8).startswith(b"%PDF-"):
            raise AdmissionError("PDF_INVALID")
    reader = PdfReader(path, strict=True)
    if reader.is_encrypted:
        raise AdmissionError("PDF_ENCRYPTED")
    if not 1 <= len(reader.pages) <= 500:
        raise AdmissionError("PDF_PAGE_LIMIT")
    root = reader.trailer["/Root"]
    inspect_catalog(root)
    pages = []
    for page in reader.pages:
        width, height = float(page.cropbox.width), float(page.cropbox.height)
        if not all(math.isfinite(v) and 0 < v <= 20000 for v in (width, height)):
            raise AdmissionError("PDF_PAGE_DIMENSIONS_UNSUPPORTED")
        inspect_annotations(page)
        pages.append({"width": width, "height": height})
    metadata = {
        str(k).removeprefix("/"): str(v)[:4000]
        for k, v in list((reader.metadata or {}).items())[:100]
    }
    return {
        "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "page_count": len(pages),
        "metadata": metadata,
        "pages": pages,
    }


def main() -> None:
    if sys.platform.startswith("linux"):
        import resource

        resource.setrlimit(resource.RLIMIT_AS, (1024**3, 1024**3))
        resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
    try:
        result = {"accepted": True, "inspection": inspect_admission(Path(sys.argv[1]))}
    except AdmissionError as error:
        result = {"accepted": False, "code": str(error)}
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        IndexError,
        AttributeError,
        RecursionError,
        PdfReadError,
    ):
        result = {"accepted": False, "code": "PDF_INVALID"}
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
