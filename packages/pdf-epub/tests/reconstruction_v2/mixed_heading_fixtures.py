"""Independently authored native→raster→native source and structure-only test receipts."""

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, NumberObject

from ava_pdf_epub.extract import render_page
from ava_pdf_epub.reconstruction_v2.recognition_contract import RecognitionResponse
from ava_pdf_epub.reconstruction_v2.refinement_contract import BookRefinementResponse

from .response_fixtures import wire_segment

CHAPTER = "1. The river"
OCR_SECTION = "The upstream watch"
NATIVE_SECTION = "The downstream watch"
BODY = [
    "The keeper watches the river and records the morning light.",
    "Every ordinary word belongs to this independently authored book.",
    "The quiet water carries the boat toward the far western bank.",
]


def source_pdf(root, *, outline=False, ocr_size=14):
    writer = PdfWriter()
    fonts = DictionaryObject()
    for key, face in [("F1", "Times-Roman"), ("F2", "Times-Bold")]:
        fonts[NameObject("/" + key)] = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/" + face),
            }
        )
    for title, size in [(CHAPTER, 22), (OCR_SECTION, ocr_size), (NATIVE_SECTION, 14)]:
        page = writer.add_blank_page(width=600, height=800)
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts})
        commands = [f"BT /F2 {size} Tf 48 740 Td ({title}) Tj ET"]
        commands.extend(
            f"BT /F1 11 Tf 48 {y} Td ({text}) Tj ET"
            for text, y in zip(BODY, [710, 695, 680], strict=True)
        )
        stream = DecodedStreamObject()
        stream.set_data("\n".join(commands).encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    original = root / "native.pdf"
    writer.write(original)
    raster = root / "authored-page-2.png"
    render_page(original, 2, raster)
    mixed = PdfWriter()
    mixed.add_page(PdfReader(original).pages[0])
    page = mixed.add_blank_page(width=600, height=800)
    with Image.open(raster) as image:
        image = image.convert("RGB")
        pixels = DecodedStreamObject()
        pixels.set_data(image.tobytes())
        pixels.update(
            {
                NameObject("/Type"): NameObject("/XObject"),
                NameObject("/Subtype"): NameObject("/Image"),
                NameObject("/Width"): NumberObject(image.width),
                NameObject("/Height"): NumberObject(image.height),
                NameObject("/ColorSpace"): NameObject("/DeviceRGB"),
                NameObject("/BitsPerComponent"): NumberObject(8),
            }
        )
    page[NameObject("/Resources")] = DictionaryObject(
        {NameObject("/XObject"): DictionaryObject({NameObject("/Im0"): mixed._add_object(pixels)})}
    )
    stream = DecodedStreamObject()
    stream.set_data(b"q 600 0 0 800 0 0 cm /Im0 Do Q")
    page[NameObject("/Contents")] = mixed._add_object(stream)
    mixed.add_page(PdfReader(original).pages[2])
    if outline:
        chapter = mixed.add_outline_item(CHAPTER, 0)
        mixed.add_outline_item(OCR_SECTION, 1, parent=chapter)
        mixed.add_outline_item(NATIVE_SECTION, 2, parent=chapter)
    source = root / "mixed.pdf"
    mixed.write(source)
    return source


def recognition(task, *, heading_size=14):
    def box(x0, y0, x1, y1):
        return dict(coordinate_space="page_points_top_left", x0=x0, y0=y0, x1=x1, y1=y1)

    heading = wire_segment(
        task,
        id="ocr-heading",
        page=2,
        text=OCR_SECTION,
        kind="heading",
        box=box(48, 44, 225, 65),
        heading_level=2,
        style=dict(id="observed", relative_size=heading_size / 11, bold=True),
    )
    body = wire_segment(
        task,
        id="ocr-body",
        page=2,
        text=" ".join(BODY),
        box=box(48, 78, 400, 123),
        style=dict(id="observed", relative_size=1, bold=False),
    )
    return RecognitionResponse.model_validate(
        dict(
            schema_version="ava-recognition-response-2",
            task_id=task.task_id,
            source_sha256=task.source_sha256,
            render_sha256=task.image.sha256,
            language="en",
            segments=[heading, body],
            unresolved=[],
        )
    )


def decisions(tasks, *, native_level=2, ocr_size=14):
    responses = []
    for task in tasks:
        ids = {node.text_excerpt: node.id for node in task.nodes}
        crops = {crop.node_id: crop.id for crop in task.crops if crop.part == "head"}
        output = []
        for node in task.nodes:
            if node.id not in task.decision_ids:
                continue
            heading = node.kind == "heading"
            output.append(
                dict(
                    node_id=node.id,
                    text_sha256=node.text_sha256,
                    evidence_ids=[crops[node.id]]
                    + ([crops[node.body_reference_id]] if node.body_reference_id else []),
                    role_kind="heading" if node.candidate_original_kind == "heading" else None,
                    heading_level=native_level
                    if node.candidate_original_kind == "heading"
                    else 2
                    if heading
                    else None,
                    chapter_start=False if heading else None,
                    chapter_role=None,
                    parent_id=ids[OCR_SECTION]
                    if node.candidate_original_kind == "heading" and native_level == 3
                    else ids[CHAPTER]
                    if heading
                    else None,
                    style=None
                    if node.structure_candidate
                    else dict(
                        id="observed", relative_size=ocr_size / 11 if heading else 1, bold=heading
                    ),
                )
            )
        responses.append(
            BookRefinementResponse.model_validate(
                dict(
                    schema_version="ava-book-refinement-response-3",
                    task_id=task.task_id,
                    source_sha256=task.source_sha256,
                    observation_sha256=task.observation_sha256,
                    image_sha256=task.image.sha256,
                    decisions=output,
                    joins=[],
                    unresolved=[],
                )
            )
        )
    return responses
