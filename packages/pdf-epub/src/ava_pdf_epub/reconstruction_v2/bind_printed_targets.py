"""Resolve exact printed target text once against source nodes before lexical changes or joins."""

from collections import defaultdict

from .assembly_state import AssemblyState
from .observed_table_grid import observed_table_grid
from .segments import ObservedSpan, Segment


def bind_printed_targets(segments: list[Segment], state: AssemblyState) -> list[Segment]:
    targets: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for segment in segments:
        if segment.text and segment.kind not in {"figure", "table", "separator", "furniture"}:
            targets[segment.text].append((segment.id, segment.id))
        for row, column, cell in observed_table_grid(segment.cells) if segment.cells else []:
            targets[cell.text].append((f"{segment.id}-cell{row}-{column}", segment.id))

    def bind(origin: str, spans: list[ObservedSpan]) -> list[ObservedSpan]:
        output = []
        for span in spans:
            if not span.target_text:
                output.append(span)
                continue
            matches = [
                (target, parent) for target, parent in targets[span.target_text] if target != origin
            ]
            if len(matches) != 1:
                raise ValueError("Printed internal reference is missing or ambiguous in source")
            target, parent = matches[0]
            state.internal_targets.append((origin, span.start, span.end, target, 0))
            if parent != target:
                state.source_reference_containers[target] = parent
            output.append(span.model_copy(update={"target_text": None}))
        return output

    output = []
    for segment in segments:
        cells = [list(row) for row in segment.cells]
        for row, column, cell in observed_table_grid(segment.cells) if segment.cells else []:
            # Cell IDs follow the same source grid used by canonical table assembly.
            spans = bind(f"{segment.id}-cell{row}-{column}", cell.spans)
            source_column = next(i for i, existing in enumerate(cells[row]) if existing is cell)
            cells[row][source_column] = cell.model_copy(update={"spans": spans})
        output.append(
            segment.model_copy(update={"spans": bind(segment.id, segment.spans), "cells": cells})
        )
    return output
