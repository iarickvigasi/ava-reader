"""Only requested observed OCR role/style fields change; every other source field stays fixed."""

import hashlib
import json
from typing import Any

from ..contracts.common import document_digest
from .assembly_state import AssemblyState
from .refinement_contract import AnyRefinementResponse
from .segments import Segment
from .source_feature_response import STYLE_FEATURES
from .source_feature_task_contract import SourceFeatureResponse, SourceFeatureTask


def apply_source_features(
    segments: list[Segment],
    tasks: list[SourceFeatureTask],
    receipts: dict[str, AnyRefinementResponse],
    state: AssemblyState,
) -> list[Segment]:
    result, applied = {s.id: s for s in segments}, set()
    for task in tasks:
        response = receipts[task.task_id]
        if not isinstance(response, SourceFeatureResponse):
            raise ValueError("Source feature response authority differs")
        requests = {q.node_id: q for q in task.source_features}
        for decision in response.feature_decisions:
            if decision.node_id in applied:
                raise ValueError("Repeated source-feature appearance")
            applied.add(decision.node_id)
            segment, request = result[decision.node_id], requests[decision.node_id]
            if segment.method != "ocr" or segment.box != request.source_box:
                raise ValueError("Source features cannot override native or foreign geometry")
            values = segment.model_dump()
            style: dict[str, Any] = (
                segment.style.model_dump() if segment.style else {"id": "observed"}
            )
            observed_style = False
            for feature in decision.features:
                if feature.disposition == "observed":
                    if feature.feature == "paragraph_role":
                        values["kind"] = feature.value
                    else:
                        style[STYLE_FEATURES[feature.feature]] = feature.value
                        observed_style = True
                selected = [c for c in task.crops if c.id in feature.evidence_ids]
                state.source_feature_evidence.append(
                    dict(
                        node_id=segment.id,
                        page=segment.page,
                        box=segment.box.model_dump(mode="json"),
                        text_sha256=decision.text_sha256,
                        text_length=len(segment.text),
                        feature=feature.feature,
                        disposition=feature.disposition,
                        value=feature.value,
                        reason=feature.reason,
                        task_id=task.task_id,
                        task_sha256=document_digest(task),
                        response_sha256=document_digest(response),
                        observation_sha256=task.observation_sha256,
                        source_sha256=task.source_sha256,
                        crop_ids=feature.evidence_ids,
                        crop_sha256=hashlib.sha256(
                            json.dumps(
                                [c.model_dump(mode="json") for c in selected],
                                sort_keys=True,
                                separators=(",", ":"),
                            ).encode()
                        ).hexdigest(),
                    )
                )
            if observed_style:
                values["style"] = style
            updated = Segment.model_validate(values)
            if updated.model_dump(exclude={"kind", "style"}) != segment.model_dump(
                exclude={"kind", "style"}
            ):
                raise ValueError("Source feature patch changed immutable source content")
            result[segment.id] = updated
    return [result[s.id] for s in segments]
