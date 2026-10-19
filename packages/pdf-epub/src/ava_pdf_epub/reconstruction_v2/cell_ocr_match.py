"""Atomic exact complete-line localization; never fuzzy text or box repair."""

import json
from collections import defaultdict
from typing import Any

from .cell_ocr_words import CellOcrWord
from .recognition_cell_geometry_contract import RecognitionCellGeometryTask
from .recognition_fields import RecognitionBox


def _overlap(a: RecognitionBox, b: RecognitionBox) -> bool:
    return max(a.x0, b.x0) < min(a.x1, b.x1) and max(a.y0, b.y0) < min(a.y1, b.y1)


def match_cell_ocr(
    task: RecognitionCellGeometryTask, words: list[CellOcrWord]
) -> list[dict[str, Any]] | None:
    lines: dict[tuple[int, int, int], list[CellOcrWord]] = defaultdict(list)
    for word in words:
        lines[word.identity[:3]].append(word)
    original = json.loads(task.original_response_json)
    addresses = {(s.segment_index, s.row_index, s.cell_index) for s in task.slots}
    used: set[tuple[int, int, int, int]] = set()
    patches: list[dict[str, Any]] = []
    width, height = task.image.width, task.image.height
    for slot in task.slots:
        text = original["segments"][slot.segment_index]["cells"][slot.row_index][slot.cell_index][
            "text"
        ]
        if not 0 < len(text) <= 256 or any(c.isspace() and c != " " for c in text):
            return None
        # Count exact complete lines before confidence/geometry filtering: a weak duplicate
        # must not vanish and make the remaining occurrence appear uniquely identifiable.
        matches = [line for line in lines.values() if " ".join(w.text for w in line) == text]
        if len(matches) != 1:
            return None
        selected = matches[0]
        identities = {w.identity for w in selected}
        if (
            used & identities
            or any(w.confidence < 95 or any(c.isspace() for c in w.text) for w in selected)
            or [w.identity[3] for w in selected] != list(range(1, len(selected) + 1))
            or any(a.box[2] > b.box[0] for a, b in zip(selected, selected[1:], strict=False))
            or max(w.box[1] for w in selected) >= min(w.box[3] for w in selected)
        ):
            return None
        left, top = min(w.box[0] for w in selected), min(w.box[1] for w in selected)
        right, bottom = max(w.box[2] for w in selected), max(w.box[3] for w in selected)
        box = RecognitionBox(
            coordinate_space="render_normalized_1000",
            x0=left * 1000 // width,
            y0=top * 1000 // height,
            x1=(right * 1000 + width - 1) // width,
            y1=(bottom * 1000 + height - 1) // height,
        )
        table = slot.table_box
        if not (
            table.x0 <= box.x0 < box.x1 <= table.x1 and table.y0 <= box.y0 < box.y1 <= table.y1
        ):
            return None
        for other in words:
            if other.identity not in identities and (
                box.x0 * width < other.box[2] * 1000
                and other.box[0] * 1000 < box.x1 * width
                and box.y0 * height < other.box[3] * 1000
                and other.box[1] * 1000 < box.y1 * height
            ):
                return None
        for row_index, row in enumerate(original["segments"][slot.segment_index]["cells"]):
            for column, cell in enumerate(row):
                if (slot.segment_index, row_index, column) in addresses:
                    continue
                # Pinned source-owned cells can have no response box. This small local
                # proposer must abstain rather than silently skip unknown neighbor geometry.
                if cell.get("box") is None or _overlap(
                    box, RecognitionBox.model_validate(cell["box"])
                ):
                    return None
        if any(_overlap(box, RecognitionBox.model_validate(p["box"])) for p in patches):
            return None
        patches.append({"slot_id": slot.slot_id, "box": box.model_dump(mode="json")})
        used.update(identities)
    return patches
