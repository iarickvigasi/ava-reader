"""Tesseract TSV carries literal quotes; it does not apply CSV quote escaping."""

import csv
import io
from collections.abc import Iterator


def annotation_tsv_rows(payload: bytes) -> Iterator[list[str]]:
    return csv.reader(
        io.StringIO(payload.decode("utf-8", errors="strict")),
        delimiter="\t",
        quoting=csv.QUOTE_NONE,
    )
