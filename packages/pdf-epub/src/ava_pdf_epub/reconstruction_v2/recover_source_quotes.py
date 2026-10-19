"""Recover exact source punctuation before links, joins and refinement identities are compiled."""

from collections.abc import Sequence

from ..contracts.common import document_digest, text_digest
from .assembly_state import AssemblyState
from .findings import Finding
from .prepared_types import AnyPreparedPage
from .segments import Segment
from .source_quote_receipt import SourceQuoteReceipt
from .source_quote_recovery import source_quote_recovery


def recover_source_quotes(
    prepared: Sequence[AnyPreparedPage], segments: list[Segment], state: AssemblyState
) -> list[Segment]:
    result = list(segments)
    positions = {item.id: index for index, item in enumerate(segments)}
    if len(positions) != len(segments):
        raise ValueError("Source punctuation owner IDs repeat")
    pages = sorted({item.page for item in segments if item.method == "ocr" and "'" in item.text})
    for number in pages:
        observation = prepared[number - 1].observation
        local = [item for item in result if item.page == number]
        observation_sha = None
        for original in list(local):
            recovered = source_quote_recovery(
                observation, original, local, state.source_continuation_policy
            )
            if recovered is None:
                continue
            candidate, changes = recovered
            observation_sha = observation_sha or document_digest(observation)
            for index in range(0, len(changes), 8):
                receipt = SourceQuoteReceipt.model_validate(
                    dict(
                        owner_id=original.id,
                        original_sha256=text_digest(original.text),
                        recovered_sha256=text_digest(candidate.text),
                        observation_sha256=observation_sha,
                        substitutions=[
                            dict(offset=c[0], line=c[1], glyph=c[2])
                            for c in changes[index : index + 8]
                        ],
                    )
                )
                state.structure_findings.append(
                    Finding(
                        code="SOURCE_APOSTROPHE_RECOVERED",
                        severity="information",
                        page=number,
                        box=original.box,
                        message=receipt.model_dump_json(),
                    )
                )
            result[positions[original.id]] = candidate
            local[local.index(original)] = candidate
            state.segments[original.id] = candidate
    return result
