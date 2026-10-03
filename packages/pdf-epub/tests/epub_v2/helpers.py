import io
import json
import zipfile
from pathlib import Path

from ava_pdf_epub.contracts.book import CanonicalBookV2
from ava_pdf_epub.epub_v2.export import export_epub

FIXTURES = Path(__file__).parent / "fixtures"


def fixture():
    book = CanonicalBookV2.model_validate_json((FIXTURES / "canonical.json").read_bytes())
    assets = {r.id: (FIXTURES / "assets" / r.path).read_bytes() for r in book.resources}
    return book, assets, json.loads((FIXTURES / "oracle.json").read_text())


def exported():
    book, assets, oracle = fixture()
    data = export_epub(book, assets)
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = {name: archive.read(name) for name in archive.namelist()}
    return book, data, entries, oracle


def archive_bytes(entries):
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return output.getvalue()
