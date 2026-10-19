"""One temporary, source-bound 4800px page for confidence-only native link recovery."""

import math
import shutil
import subprocess
import tempfile
from pathlib import Path
from types import TracebackType

from PIL import Image
from pypdf import PdfReader

from ..extract import MAX_SOURCE_BYTES, sha256_file
from .annotation_word_ocr import MAX_IMAGE_BYTES
from .native_caller_context import ERROR, ContextCache
from .observations import PageObservation
from .prepared_types import AnyPreparedPage

LONG_EDGE = 4800


class NativeLinkResolution:
    def __init__(self, source: Path, checkpoint: AnyPreparedPage):
        self.source = source
        self.checkpoint = checkpoint
        self.words: ContextCache = {}
        self._temporary: tempfile.TemporaryDirectory[str] | None = None
        self._page: PageObservation | None = None

    def __enter__(self) -> "NativeLinkResolution":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if self._temporary is not None:
            self._temporary.cleanup()
        self.words.clear()
        self._page = None

    @property
    def directory(self) -> Path:
        if self._temporary is None:
            raise ValueError(ERROR)
        return Path(self._temporary.name)

    def _source_matches(self) -> None:
        if (
            not 0 < self.source.stat().st_size <= MAX_SOURCE_BYTES
            or self.source.stat().st_size != self.checkpoint.source_byte_length
            or sha256_file(self.source) != self.checkpoint.source_sha256
        ):
            raise ValueError(ERROR)

    def observation(self) -> PageObservation:
        """The accepted checkpoint stays unchanged; this frame is private visual evidence."""
        try:
            self._source_matches()
            if self._page is not None:
                return self._page
            page = self.checkpoint.observation
            if page.rotation or page.risks or page.required_regions:
                raise ValueError(ERROR)
            reader = PdfReader(self.source, strict=True)
            if reader.is_encrypted or len(reader.pages) != self.checkpoint.source_page_count:
                raise ValueError(ERROR)
            source_page = reader.pages[page.number - 1]
            unit = source_page.get("/UserUnit", 1)
            if (
                source_page.rotation % 360
                or list(source_page.cropbox) != list(source_page.mediabox)
                or float(source_page.cropbox.left)
                or float(source_page.cropbox.bottom)
                or float(source_page.cropbox.width) != page.width_pt
                or float(source_page.cropbox.height) != page.height_pt
                or isinstance(unit, bool)
                or not isinstance(unit, (int, float))
                or unit != 1
            ):
                raise ValueError(ERROR)
            self._temporary = tempfile.TemporaryDirectory(prefix="ava-link-resolution-")
            rendered = self.directory / "page.png"
            executable = shutil.which("pdftoppm")
            if executable is None:
                raise ValueError(ERROR)
            result = subprocess.run(
                [
                    executable,
                    "-f",
                    str(page.number),
                    "-l",
                    str(page.number),
                    "-singlefile",
                    "-cropbox",
                    "-scale-to",
                    str(LONG_EDGE),
                    "-png",
                    str(self.source.resolve()),
                    str(rendered.with_suffix("")),
                ],
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=60,
                check=False,
            )
            if result.returncode or result.stderr.strip() or not rendered.is_file():
                raise ValueError(ERROR)
            if not 0 < rendered.stat().st_size <= MAX_IMAGE_BYTES:
                raise ValueError(ERROR)
            with Image.open(rendered) as image:
                width, height = image.size
                scale = LONG_EDGE / max(page.width_pt, page.height_pt)
                if (
                    max(width, height) != LONG_EDGE
                    or min(width, height) < 1
                    or abs(width - math.ceil(page.width_pt * scale)) > 1
                    or abs(height - math.ceil(page.height_pt * scale)) > 1
                ):
                    raise ValueError(ERROR)
            self._source_matches()
            self._page = page.model_copy(
                update={
                    "render_path": "page.png",
                    "render_width": width,
                    "render_height": height,
                    "render_sha256": sha256_file(rendered),
                }
            )
            return self._page
        except (OSError, ValueError, IndexError, subprocess.SubprocessError):
            raise ValueError(ERROR) from None
