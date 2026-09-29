"""Independent source oracle supplies responses; expected ranks never derive from output."""

import json
from pathlib import Path

from ava_pdf_epub.reconstruction_v2.prepare_page import prepare_page
from ava_pdf_epub.reconstruction_v2.prepare_refinement import prepare_refinement
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse
from ava_pdf_epub.reconstruction_v2.source_segments import source_segments

from .refinement_evidence import join_decisions

FIXTURES = Path(__file__).parent / "fixtures"


def source_case(scratch):
    source = FIXTURES / "ocr-hierarchy.pdf"
    raw = json.loads((FIXTURES / "ocr-hierarchy-fault.json").read_text())
    pages = [prepare_page(source, scratch, number) for number in (1, 2, 3)]
    responses = []
    for value, page in zip(raw, pages, strict=True):
        task = page.tasks[0]
        responses.append(
            RecognitionResponse.model_validate(
                {
                    **value,
                    "task_id": task.task_id,
                    "source_sha256": task.source_sha256,
                    "render_sha256": task.image.sha256,
                }
            )
        )
    _, segments, state = source_segments(source, scratch, pages, responses)
    tasks = prepare_refinement(source, scratch, pages, segments, state)
    return source, pages, responses, segments, state, tasks


def authored_responses(tasks):
    oracle = json.loads((FIXTURES / "ocr-hierarchy-oracle.json").read_text())
    blocks = {b["text"]: b for page in oracle["pages"] for b in page["blocks"]}
    output = []
    for task in tasks:
        decisions, ancestors = [], {}
        crops = {c.node_id: c.id for c in task.crops if c.part == "head"}
        for node in task.nodes:
            block = blocks[node.text_excerpt]
            level = block.get("level")
            parent = ancestors.get(level - 1) if level else None
            if level:
                if block.get("chapter"):
                    ancestors.clear()
                    parent = None
                ancestors = {k: v for k, v in ancestors.items() if k < level}
                ancestors[level] = node.id
            if node.id not in task.decision_ids:
                continue
            font = oracle["fonts"][block["style"]]
            evidence = [crops[node.id]]
            if node.body_reference_id:
                evidence.append(crops[node.body_reference_id])
            decisions.append(
                dict(
                    node_id=node.id,
                    text_sha256=node.text_sha256,
                    evidence_ids=evidence,
                    heading_level=level,
                    parent_id=parent,
                    chapter_start=bool(block.get("chapter")) if level else None,
                    chapter_role="bodymatter" if block.get("chapter") else None,
                    style=dict(
                        id="observed",
                        relative_size=font["size_pt"] / 11,
                        bold=font["bold"],
                        italic=font["italic"],
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
                    joins=join_decisions(task, False),
                    unresolved=[],
                )
            )
        )
    return output
