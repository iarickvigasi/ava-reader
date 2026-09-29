"""Source-authored geometry/style facts, not altered live OCR observations."""

import base64
import json
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.accept_response import accept_response
from ava_pdf_epub.reconstruction_v2.assemble_pages import assemble_pages
from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse, RecognitionTask
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.structure_evidence import structure_findings

from .refinement_evidence import join_decisions

FIXTURES = Path(__file__).parent / "fixtures"


def observed_case(scratch):
    raw = json.loads((FIXTURES / "observed-two-column-page1-task.json").read_text())
    raw["image"]["base64"] = base64.b64encode(
        (FIXTURES / "observed-two-column-page1.png").read_bytes()
    ).decode()
    task = RecognitionTask.model_validate(raw)
    response = RecognitionResponse.model_validate_json(
        (FIXTURES / "observed-two-column-page1-semantics.json").read_bytes()
    )
    segments = accept_response(task, response)[:9]
    source = FIXTURES / "two-column-scan.pdf"
    page = prepare_page(source, scratch, 1)
    state = AssemblyState()
    _, segments = assemble_pages([page], {1: segments}, state)
    state.structure_findings = structure_findings(segments, set())
    tasks = prepare_refinement(source, scratch, [page], segments, state)
    return segments, state, tasks


def observed_decisions(tasks):
    # Authored source uses regular Arial: title19,chapter18,section14,body10pt; bodyleading14.5pt.
    sizes = {
        "The Two-Column Log": 1.9,
        "1. Across the Harbour": 1.8,
        "Across the full-width heading": 1.4,
    }
    output = []
    for task in tasks:
        crops = {c.node_id: c.id for c in task.crops if c.part == "head"}
        chapter = next(n.id for n in task.nodes if n.text_excerpt == "1. Across the Harbour")
        decisions = []
        for node in task.nodes:
            if node.id not in task.decision_ids:
                continue
            heading = node.kind == "heading"
            evidence = [crops[node.id]]
            if node.body_reference_id:
                evidence.append(crops[node.body_reference_id])
            decisions.append(
                dict(
                    node_id=node.id,
                    text_sha256=node.text_sha256,
                    evidence_ids=evidence,
                    heading_level=node.observed_level if heading else None,
                    parent_id=chapter if node.observed_level == 2 else None,
                    chapter_start=node.observed_chapter if heading else None,
                    chapter_role=node.observed_role if heading else None,
                    style=dict(
                        id="observed",
                        relative_size=sizes.get(node.text_excerpt, 1),
                        bold=False,
                        **({} if heading else {"line_height": 1.45}),
                    ),
                )
            )
        output.append(
            BookRefinementResponse.model_validate(
                dict(
                    schema_version="ava-book-refinement-response-1",
                    task_id=task.task_id,
                    source_sha256=task.source_sha256,
                    observation_sha256=task.observation_sha256,
                    image_sha256=task.image.sha256,
                    decisions=decisions,
                    unresolved=[],
                    joins=join_decisions(task, True),
                )
            )
        )
    return output
