"""Source fragment changes exercise entry eligibility independently of page classification."""

from ava_pdf_epub.reconstruction_v2.geometry import union

from .test_ocr_link_context import line


def replace_left(page, owners, index, text, *, x=44):
    old = next(row for row in page.observation.lines if row.id == f"left{index}")
    row = line(old.id, text, x, old.box.y0)
    changed = page.model_copy(
        update={
            "observation": page.observation.model_copy(
                update={
                    "lines": [
                        row if original.id == row.id else original
                        for original in page.observation.lines
                    ],
                }
            )
        }
    )
    values = [
        owner.model_copy(update={"text": row.text, "box": row.box})
        if owner.text == old.text
        else owner
        for owner in owners
    ]
    return changed, values


def wrapped_entry(page, owners, text):
    old = next(owner for owner in owners if owner.text.startswith("alpha1"))
    page, owners = replace_left(page, owners, 1, text, x=52)
    first = next(owner for owner in owners if owner.text.startswith("alpha0"))
    second = next(owner for owner in owners if owner.id == old.id)
    combined = first.model_copy(
        update={
            "text": first.text + " " + second.text,
            "box": union([first.box, second.box]),
        }
    )
    return (
        page,
        [combined if owner.id == first.id else owner for owner in owners if owner.id != second.id],
        combined,
    )
