"""Source comparison, not model-generated metrics, authorizes uniform continuations."""

from .refinement_prompt import MIXED_HIERARCHY_PROMPT

CONTINUATION_PROMPT = (
    MIXED_HIERARCHY_PROMPT
    + """
This version also supplies finite join_candidates derived from exact endpoint source values.
Return schema_version ava-book-refinement-response-5 and a presentations array with exactly
one choice for EACH candidate edge. Copy edge_id. Choose its candidate_id only when BOTH source
crops positively establish one continuing paragraph with UNIFORM typography and compatible
paragraph presentation. Cite exactly its previous tail (head if no tail) and next head crop IDs.
The native_alignment_fallback flag is host extraction provenance, not proof of ragged-right
print. Compare the actual source alignment. Candidate metrics reuse source measurements; do not
recopy, round or guess them. A known conflict, different appearance or insufficient evidence
cannot authorize the candidate. Select candidate_id:null/evidence_ids:[] in that case.
A selected candidate also requires join:true. No selected candidate means ordinary legacy join
and OCR-style requirements still apply; essential unresolved comparisons stay unresolved.
For an OCR endpoint covered by a SELECTED candidate, keep role_kind:null and return style:null
to delegate its exact source-derived typography. All other OCR decisions still require observed
style with explicit bold/relative_size. Native role decisions still use role_kind/style:null.
Do not delegate a heading, context node or unselected candidate endpoint. Presentations change
only supported paragraph presentation; source text, spans, references and geometry stay fixed.
"""
)
