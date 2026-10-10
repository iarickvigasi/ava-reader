"""Command-local source identity and rendering view with short-lived parser windows."""

import gc
import hashlib
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pdfplumber
from pdfplumber.pdf import PDF
from pypdf import PdfReader

from ..admission_actions import inspect_annotations, inspect_catalog
from ..annotation_kind import annotation_kind
from ..annotation_view import annotation_view
from ..annotation_view_cache import cached_view
from ..contracts.private_files import snapshot
from ..contracts.profiles import ProfileId, checked_profile
from ..worker_observation import observe

PARSER_WINDOW_PAGES = 2


def identity(path: Path) -> tuple[int, int, int, int, int]:
    info = path.stat()
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


@dataclass
class ParsedPage:
    original: Any
    page: Any
    view: Path
    view_reader: PdfReader
    kinds: list[str]


class SourcePreparation:
    def __init__(
        self, source: Path, scratch: Path, profile_id: ProfileId, expected_sha256: str | None = None
    ):
        self.source, self.scratch = source, scratch
        self.profile_id = checked_profile(profile_id)
        self._source_identity = identity(source)
        self.size = self._source_identity[2]
        if not 0 < self.size <= 52428800:
            raise ValueError("Source byte bound exceeded")
        self.sha256 = hashlib.sha256(source.read_bytes()).hexdigest()
        if expected_sha256 is not None and self.sha256 != expected_sha256:
            raise ValueError("Reconstruction source identity differs")
        self._reader: PdfReader | None = None
        self._view_reader: PdfReader | None = None
        self._document: PDF | None = None
        self._view: Path | None = None
        self._view_identity: tuple[int, int, int, int, int] | None = None
        self._numbers: range = range(0)
        self._catalog_checked = False
        self._closed = False
        try:
            self._reader = PdfReader(source)
            if self._reader.is_encrypted:
                raise ValueError("Source is encrypted or page bound exceeded")
            self.count = len(self._reader.pages)
            if not 1 <= self.count <= 500:
                raise ValueError("Source is encrypted or page bound exceeded")
            self._unchanged()
        except BaseException:
            self.close()
            raise

    def __enter__(self) -> "SourcePreparation":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def _unchanged(self) -> None:
        # The host owns fixed private inputs and its lease writer; the sandbox mount
        # prevents worker writes, not owner-side mutation. Scratch views stay local.
        # Stat guards detect ordinary writes/replacement, not cryptographic sealing.
        if identity(self.source) != self._source_identity:
            raise ValueError("Reconstruction source identity changed")
        if self._view is not None and identity(self._view) != self._view_identity:
            raise ValueError("PDF_ANNOTATION_VIEW_CACHE_INVALID")

    def check_unchanged(self) -> None:
        """Check the existing operational guard while an attempt awaits a reply."""
        if self._closed:
            raise ValueError("Source preparation is closed")
        self._unchanged()

    def verify_inputs(self) -> None:
        """Hash-check original/view bytes at finite attempt phase boundaries."""
        self.check_unchanged()
        data = snapshot(self.source.parent, self.source.name, 52428800)
        if hashlib.sha256(data).hexdigest() != self.sha256:
            raise ValueError("Reconstruction source identity changed")
        del data
        if self._view is not None:
            selected, _, _ = cached_view(self.source, self.scratch)
            if selected != self._view:
                raise ValueError("PDF_ANNOTATION_VIEW_CACHE_INVALID")
        self.check_unchanged()

    def _retire(self) -> None:
        active = any(item is not None for item in (self._document, self._view_reader, self._reader))
        try:
            if self._document is not None:
                try:
                    self._document.close()
                finally:
                    self._document.stream.close()
        finally:
            try:
                if self._view_reader is not None and self._view_reader is not self._reader:
                    self._view_reader.close()
            finally:
                if self._reader is not None:
                    self._reader.close()
                self._document = None
                self._view_reader = self._reader = None
                self._numbers = range(0)
                if active:
                    # Retire decoded parser cycles before opening the next window.
                    # Per-page GC cannot release a still-live two-page parser cache.
                    gc.collect()

    def close(self) -> None:
        self._closed = True
        self._retire()

    def retire_parsers(self) -> None:
        """Keep attempt identity guards without retaining parsers during host waits."""
        self.check_unchanged()
        self._retire()

    @contextmanager
    def page(self, number: int) -> Iterator[ParsedPage]:
        parsed = None
        try:
            parsed = self._page(number)
            yield parsed
            self._unchanged()
        except BaseException:
            self.close()
            raise
        finally:
            if parsed is not None:
                parsed.page.close()

    def _page(self, number: int) -> ParsedPage:
        if self._closed:
            raise ValueError("Source preparation is closed")
        if not 1 <= number <= self.count:
            raise ValueError("Page is outside source")
        self._unchanged()
        if self._numbers and number not in self._numbers:
            self._retire()
        if self._reader is None:
            self._reader = PdfReader(self.source)
        observe("source", self.sha256, self.count, number, self.profile_id)
        if not self._catalog_checked:
            inspect_catalog(self._reader.trailer["/Root"])
            self._catalog_checked = True
        original = self._reader.pages[number - 1]
        inspect_annotations(original, page_number=number, page_count=self.count)
        kinds: list[str] = [
            annotation_kind(ref.get_object()) for ref in original.get("/Annots", [])
        ]
        observe("annotation", number, kinds)
        if self._view is None:
            # annotation_view admits every original page before yielding the first
            # task, including unsafe annotations on later pages of the book.
            self._view = annotation_view(self.source, self.scratch)
            self._view_identity = identity(self._view)
        else:
            observe("reuse", "annotation_view", True)
        if self._document is None:
            self._numbers = range(number, min(number + PARSER_WINDOW_PAGES, self.count + 1))
            self._view_reader = self._reader if self._view == self.source else PdfReader(self._view)
            self._document = pdfplumber.open(self._view, pages=list(self._numbers))
        assert self._view_reader is not None
        page = self._document.pages[number - self._numbers.start]
        return ParsedPage(original, page, self._view, self._view_reader, kinds)
