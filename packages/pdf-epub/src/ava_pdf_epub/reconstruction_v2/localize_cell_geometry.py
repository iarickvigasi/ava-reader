"""Bounded installed source-image proposer; no provider or canonical authority."""

import base64
import hashlib
import io
import tempfile
from pathlib import Path
from typing import Any

from PIL import Image

from ..contracts.profiles import BILINGUAL_PROFILE
from .annotation_word_ocr import _run_ocr
from .attempt_exchange import strict_json
from .cell_ocr_match import match_cell_ocr
from .cell_ocr_words import BOUND, CELL_OCR_TSV_BYTES, cell_ocr_words
from .recognition_cell_geometry_contract import (
    RecognitionCellGeometryResponse,
    RecognitionCellGeometryTask,
)
from .recognition_cell_geometry_repair import (
    apply_cell_geometry_repair,
    prepare_cell_geometry_repair,
)
from .recognition_contract import RecognitionTask
from .recognition_geometry_identity import geometry_digest

CELL_OCR_METHOD = "ava-cell-exact-line-ocr-1"


def _file_digest(path: Path) -> str:
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def localize_cell_geometry(data: bytes) -> dict[str, Any]:
    if not 0 < len(data) <= 24 * 1024 * 1024:
        raise ValueError("CELL_OCR_REQUEST_BOUND")
    raw = strict_json(data)
    if (
        not isinstance(raw, dict)
        or set(raw) != {"mode", "method", "task", "original"}
        or raw["mode"] != "localize_cell_geometry"
        or raw["method"] != CELL_OCR_METHOD
    ):
        raise ValueError("CELL_OCR_REQUEST_FIELDS")
    original = RecognitionTask.model_validate(raw["original"])
    task = RecognitionCellGeometryTask.model_validate(raw["task"])
    if task != prepare_cell_geometry_repair(original, task.original_response_json):
        raise ValueError("CELL_OCR_SOURCE_BINDING_DIFFERS")
    image = base64.b64decode(task.image.base64, validate=True)
    if task.image.width * task.image.height > 20_000_000:
        raise ValueError("CELL_OCR_IMAGE_BOUND")
    with Image.open(io.BytesIO(image)) as picture:
        if picture.size != (task.image.width, task.image.height) or picture.format != (
            "PNG" if task.image.media_type == "image/png" else "JPEG"
        ):
            raise ValueError("CELL_OCR_IMAGE_FRAME_DIFFERS")
        picture.load()
    languages = "eng+ukr" if task.profile_id == BILINGUAL_PROFILE else "eng"
    result: dict[str, Any] = dict(
        schema_version="ava-cell-geometry-localization-1",
        origin="LOCAL_OCR",
        method=CELL_OCR_METHOD,
        request_sha256=geometry_digest(data),
        task_id=task.task_id,
        source_sha256=task.source_sha256,
        render_sha256=task.render_sha256,
        original_response_sha256=task.original_response_sha256,
        languages=languages,
        binary_sha256=_file_digest(Path("/usr/bin/tesseract")),
        traineddata_sha256=[
            _file_digest(Path("/usr/share/tesseract-ocr/5/tessdata") / (lang + ".traineddata"))
            for lang in languages.split("+")
        ],
        status="NO_PROOF",
        reason="NO_UNIQUE_SOURCE_LINE",
        tsv_base64="",
        tsv_byte_length=0,
        tsv_sha256=geometry_digest(b""),
        response_json=None,
        response_sha256=None,
    )
    with tempfile.TemporaryDirectory(prefix="ava-cell-exact-ocr-") as directory:
        path = Path(directory) / (
            "source.png" if task.image.media_type == "image/png" else "source.jpg"
        )
        path.write_bytes(image)  # Original encoded bytes; no annotation cleanup or rerender.
        path.chmod(0o400)
        try:
            payload = _run_ocr(path, languages)
        except ValueError:
            payload = None
        if geometry_digest(path.read_bytes()) != task.render_sha256:
            raise RuntimeError("CELL_OCR_SOURCE_IMAGE_CHANGED")
        if payload is None:
            result["reason"] = "OCR_UNAVAILABLE"
            return result
    if len(payload) > CELL_OCR_TSV_BYTES:
        result["reason"] = "OCR_EVIDENCE_BOUND"
        return result
    result.update(
        tsv_base64=base64.b64encode(payload).decode(),
        tsv_byte_length=len(payload),
        tsv_sha256=geometry_digest(payload),
    )
    try:
        words = cell_ocr_words(payload, task.image.width, task.image.height)
    except ValueError as error:
        if str(error) != BOUND:
            raise
        result["reason"] = "OCR_EVIDENCE_BOUND"
        return result
    patches = match_cell_ocr(task, words)
    if patches is None:
        return result
    response = RecognitionCellGeometryResponse.model_validate(
        dict(
            schema_version="ava-recognition-cell-geometry-response-1",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            original_task_id=task.original_task_id,
            render_sha256=task.render_sha256,
            original_response_sha256=task.original_response_sha256,
            outcome="corrected",
            patches=patches,
            unresolved_reason=None,
        )
    )
    apply_cell_geometry_repair(
        original, task, response
    )  # All-slot source validation before PROVED.
    content = response.model_dump_json()
    result.update(
        status="PROVED",
        reason=None,
        response_json=content,
        response_sha256=geometry_digest(content.encode()),
    )
    return result
