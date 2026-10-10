"""Fixed-path isolated admission; the host never parses the PDF."""

import json
from pathlib import Path

from ..admission_actions import AdmissionError
from .preflight import preflight


def main() -> None:
    try:
        result: dict[str, object] = {
            "accepted": True,
            "inspection": preflight(Path("/input/source.pdf")),
        }
    except AdmissionError as error:
        result = error.refusal()
    except ValueError as error:
        code = str(error)
        result = {
            "accepted": False,
            "code": code
            if code
            in {
                "PDF_PAGE_LIMIT",
                "PDF_RASTER_LIMIT",
                "PDF_RESOURCE_LIMIT",
            }
            else "PDF_INVALID",
        }
    except Exception:
        result = {"accepted": False, "code": "PDF_INVALID"}
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
