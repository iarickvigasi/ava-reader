"""Complete direct-page uniform fill evidence; no glyph matching or point tolerance."""

import ctypes
import hashlib
import importlib
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ObjectColourProof:
    count: int
    object_sha256: str
    tool_sha256: str


def tool_identity() -> str:
    pypdfium2 = importlib.import_module("pypdfium2")
    bindings = importlib.import_module("pypdfium2_raw.bindings")

    assert pypdfium2.__file__ is not None and bindings.__file__ is not None
    files = [
        Path(pypdfium2.__file__),
        Path(bindings.__file__),
        Path(bindings._libs["pdfium"]._name),
    ]
    for name in (
        "pdfplumber",
        "pdfminer.pdfinterp",
        "pypdf",
        "ava_pdf_epub.reconstruction_v2.native_paint",
    ):
        module = importlib.import_module(name)
        assert module.__file__ is not None
        files.append(Path(module.__file__))
    for name in (
        "native_colour_pdfium.py",
        "native_colour_capture.py",
        "native_colour_state.py",
        "native_colour_witness.py",
        "native_colour_reobserve.py",
        "native_colour_validate.py",
    ):
        files.append(Path(__file__).with_name(name))
    record = {
        str(index): hashlib.sha256(path.read_bytes()).hexdigest()
        for index, path in enumerate(files)
    }
    record["pdfium"] = str(pypdfium2.PDFIUM_INFO)
    record["pypdfium"] = str(pypdfium2.PYPDFIUM_INFO)
    return hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()


def uniform_objects(
    source: Path, number: int, rgb: tuple[int, int, int], frame: list[float]
) -> ObjectColourProof | None:
    try:
        pdfium = importlib.import_module("pypdfium2")
        raw = importlib.import_module("pypdfium2.raw")

        names = (
            "FPDFPage_CountObjects",
            "FPDFPage_GetObject",
            "FPDFFormObj_CountObjects",
            "FPDFFormObj_GetObject",
            "FPDFPageObj_GetType",
            "FPDFPageObj_GetFillColor",
            "FPDFTextObj_GetTextRenderMode",
            "FPDFPageObj_HasTransparency",
            "FPDFPage_HasTransparency",
            "FPDFPageObj_GetBounds",
            "FPDFPageObj_GetMatrix",
            "FPDFPageObj_GetClipPath",
            "FPDFClipPath_CountPaths",
        )
        if not all(hasattr(raw, name) for name in names) or rgb == (255, 255, 255):
            return None
        before = tool_identity()
        records: list[dict[str, Any]] = []
        seen: set[int] = set()
        total = 0
        unsupported = False
        with pdfium.PdfDocument(source) as document:
            page = document[number - 1]
            try:
                if (
                    raw.FPDFPage_HasTransparency(page)
                    or list(page.get_mediabox()) != frame
                    or list(page.get_cropbox()) != frame
                    or page.get_rotation() != 0
                ):
                    return None

                def visit(parent: Any, form: bool = False, depth: int = 0) -> bool:
                    nonlocal total, unsupported
                    if depth > 12:
                        return False
                    count = (
                        raw.FPDFFormObj_CountObjects(parent)
                        if form
                        else raw.FPDFPage_CountObjects(parent)
                    )
                    if not 0 <= count <= 50000:
                        return False
                    for index in range(count):
                        total += 1
                        if total > 50000:
                            return False
                        obj = (
                            raw.FPDFFormObj_GetObject(parent, index)
                            if form
                            else raw.FPDFPage_GetObject(parent, index)
                        )
                        address = ctypes.cast(obj, ctypes.c_void_p).value if obj else None
                        if address is None or address in seen:
                            return False
                        seen.add(address)
                        kind = raw.FPDFPageObj_GetType(obj)
                        if kind == raw.FPDF_PAGEOBJ_FORM:
                            unsupported = True
                            if not visit(obj, True, depth + 1):
                                return False
                            continue
                        if kind != raw.FPDF_PAGEOBJ_TEXT:
                            unsupported = True
                            continue
                        if (
                            raw.FPDFPageObj_HasTransparency(obj)
                            or raw.FPDFTextObj_GetTextRenderMode(obj) != 0
                        ):
                            return False
                        rgba = [ctypes.c_uint() for _ in range(4)]
                        if not raw.FPDFPageObj_GetFillColor(
                            obj, *[ctypes.byref(v) for v in rgba]
                        ) or tuple(v.value for v in rgba) != (*rgb, 255):
                            return False
                        bounds = [ctypes.c_float() for _ in range(4)]
                        matrix = raw.FS_MATRIX()
                        clip = raw.FPDFPageObj_GetClipPath(obj)
                        if (
                            not clip
                            or not raw.FPDFPageObj_GetBounds(
                                obj, *[ctypes.byref(v) for v in bounds]
                            )
                            or not raw.FPDFPageObj_GetMatrix(obj, ctypes.byref(matrix))
                        ):
                            return False
                        values = [v.value for v in bounds] + [
                            getattr(matrix, key) for key in ("a", "b", "c", "d", "e", "f")
                        ]
                        paths = raw.FPDFClipPath_CountPaths(clip)
                        if not all(math.isfinite(v) for v in values) or paths not in (-1, 0):
                            return False
                        # -1 is unreferenced/unknown. It is usable only together
                        # with the independent complete source no-clip envelope.
                        records.append(
                            {
                                "depth": depth,
                                "index": index,
                                "bounds_matrix": values,
                                "rgba": [v.value for v in rgba],
                                "clip_paths": paths,
                            }
                        )
                    return True

                if not visit(page) or unsupported or not records:
                    return None
            finally:
                page.close()
        data = json.dumps(records, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
        if tool_identity() != before:
            return None
        return ObjectColourProof(len(records), hashlib.sha256(data).hexdigest(), before)
    except (ImportError, AttributeError, ValueError, OSError, RuntimeError, IndexError):
        return None
