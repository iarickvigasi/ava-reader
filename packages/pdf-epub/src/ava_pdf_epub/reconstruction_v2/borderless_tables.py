"""Qualify a narrow borderless table pattern: aligned bold headers and repeated cell columns."""

from ..contracts.source import Box
from .geometry import rectangle, union
from .observations import NativeLine, PageObservation
from .observe_tables import TableObservation


def borderless_tables(page: PageObservation) -> list[TableObservation]:
    rows: list[list[NativeLine]] = []
    for line in sorted(page.lines, key=lambda line: (line.box.y0, line.box.x0)):
        if rows and abs(rows[-1][0].box.y0 - line.box.y0) < 2:
            rows[-1].append(line)
        else:
            rows.append([line])
    output = []
    for index, row in enumerate(rows):
        if not 2 <= len(row) <= 8 or not all(
            line.style.bold and len(line.text) < 80 for line in row
        ):
            continue
        selected = [row]
        for following in rows[index + 1 :]:
            if (
                len(following) != len(row)
                or following[0].box.y0 - selected[-1][0].box.y1 > 40
                or any(abs(a.box.x0 - b.box.x0) > 5 for a, b in zip(row, following, strict=True))
            ):
                break
            selected.append(following)
        if len(selected) < 3:
            continue
        box = union([line.box for r in selected for line in r])
        boundaries = [
            box.x0,
            *[(a.box.x1 + b.box.x0) / 2 for a, b in zip(row, row[1:], strict=False)],
            box.x1,
        ]
        cells: list[list[Box | None]] = [
            [
                rectangle(
                    (boundaries[x], r[0].box.y0, boundaries[x + 1], max(line.box.y1 for line in r)),
                    page.width_pt,
                    page.height_pt,
                )
                for x in range(len(row))
            ]
            for r in selected
        ]
        output.append(
            TableObservation(
                box=box,
                cells=cells,
                line_ids=[line.id for r in selected for line in r],
                ruled=False,
            )
        )
    return output
