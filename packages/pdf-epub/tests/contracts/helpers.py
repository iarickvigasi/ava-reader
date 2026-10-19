import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(version="ava-book-2"):
    return json.loads((FIXTURES / (version + ".json")).read_text())


def block(book, ident):
    return next(b for b in book["blocks"] if b["id"] == ident)
