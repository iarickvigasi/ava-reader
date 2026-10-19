"""Authored source font/resources and coordinates are independent of OCR estimates."""

import hashlib
from pathlib import Path

from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from ava_pdf_epub.contracts.profiles import BILINGUAL_PROFILE
from ava_pdf_epub.contracts.styles import Style
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_metric_rows import cadence
from ava_pdf_epub.reconstruction_v2.continuation_metrics import corroborate_continuation_metrics
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.geometry import union
from ava_pdf_epub.reconstruction_v2.prepare_source import prepare_source
from ava_pdf_epub.reconstruction_v2.segments import Segment


class Fixture:
    def __init__(
        self,
        root: Path,
        *,
        split_font=False,
        transform=False,
        ocr_first=False,
        different_leading=False,
    ):
        self.root, self.source = root, root / "source.pdf"
        writer = PdfWriter()
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Times-Roman"),
            }
        )
        shared = writer._add_object(font)
        texts = [
            [
                "The original paragraph describes the same reading flow",
                "and continues across the source page boundary as a con-",
            ],
            [
                "tinuing paragraph with success-",
                "fully retained source words and the same printed font",
                "while the last original row finishes this source paragraph.",
            ],
        ]
        for number, lines in enumerate(texts):
            page = writer.add_blank_page(width=500, height=600)
            resource = (
                writer._add_object(DictionaryObject(font)) if number and split_font else shared
            )
            page[NameObject("/Resources")] = DictionaryObject(
                {NameObject("/Font"): DictionaryObject({NameObject("/F1"): resource})}
            )
            stream = DecodedStreamObject()
            start = "10.6" if number and transform else "10.395"
            data = f"BT /F1 1 Tf {start} 0 0 10.5 40 500 Tm "
            data += (" 0 -1.209501 TD " if number and different_leading else " 0 -1.2095 TD ").join(
                f"({line}) Tj" for line in lines
            ) + " ET"
            stream.set_data(data.encode())
            page[NameObject("/Contents")] = writer._add_object(stream)
        writer.write(self.source)
        self.prepared = prepare_source(
            self.source,
            root / "scratch",
            hashlib.sha256(self.source.read_bytes()).hexdigest(),
            BILINGUAL_PROFILE,
        )
        self.prepared = list(self.prepared)
        self.segments = []
        for number, checkpoint in enumerate(self.prepared, 1):
            native = (number == 2) if ocr_first else (number == 1)
            rows = checkpoint.observation.lines
            text = " ".join(r.text for r in rows).replace("success- fully", "successfully")
            self.segments.append(
                Segment(
                    id="native" if native else "ocr",
                    page=number,
                    kind="paragraph",
                    method="native" if native else "ocr",
                    box=union([r.box for r in rows]),
                    text=text,
                    native_line_ids=[r.id for r in rows] if native else [],
                    style=Style(
                        id="source" if native else "observed",
                        family="serif",
                        bold=False if native else None,
                        relative_size=1 if native else None,
                        italic=False if native else None,
                        small_caps=False if native else None,
                        vertical_align="baseline" if native else None,
                        align="start" if native else None,
                        line_height=cadence(rows, 10.5)[0] if native else 1.25,
                        indent_em=0 if number == 2 else 1.1,
                        space_before_em=0.2 if number == 1 else None,
                        space_after_em=0.3 if number == 2 else None,
                    ),
                    continues_to_next=number == 1,
                    continues_from_previous=False,
                )
            )
        self.state = AssemblyState(
            source_continuation_policy=POLICY,
            placements={s.id: (s.page, 1, 1) for s in self.segments},
        )

    def run(self):
        return corroborate_continuation_metrics(
            self.source, self.root / "scratch", self.prepared, self.segments, self.state
        )
