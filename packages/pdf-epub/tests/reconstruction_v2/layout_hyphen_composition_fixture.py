"""Original source pair decisions before their eventual paragraph owner is known."""

from ava_pdf_epub.contracts.layout_hyphen import candidate_digest
from ava_pdf_epub.contracts.normalization import NormalizationMap
from ava_pdf_epub.reconstruction_v2.layout_hyphen_derivation import derive_layout_hyphen
from ava_pdf_epub.reconstruction_v2.layout_hyphen_normalization import normalize_layout_hyphens
from ava_pdf_epub.reconstruction_v2.normalization_map import line_wrap_map

from .layout_hyphen_fixtures import PDF_SHA, authored_hyphens


def paired_map(pair, identity, *, prefix="", disposition="layout"):
    candidates, decisions = authored_hyphens(pair, [(0, disposition)])
    original = candidates[0]
    candidate = original.model_copy(
        update={
            "id": identity,
            "left": original.left.model_copy(update={"line_id": identity + "-left"}),
            "right": original.right.model_copy(update={"line_id": identity + "-right"}),
        }
    )
    decision = decisions[0].model_copy(
        update={"candidate_id": identity, "candidate_sha256": candidate_digest(candidate)}
    )
    source = prefix + pair
    item = derive_layout_hyphen(source, pair, candidate, decision, len(prefix))
    literal = source.replace("\r\n", " ").replace("\n", " ")
    base = NormalizationMap.model_validate(line_wrap_map(source, literal))
    result = normalize_layout_hyphens(
        source,
        PDF_SHA,
        [item.candidate],
        [item.disposition],
        text=literal,
        normalization=base,
        derivations=[item.derivation],
    )
    return source, result
