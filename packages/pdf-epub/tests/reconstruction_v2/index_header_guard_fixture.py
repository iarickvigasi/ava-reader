"""Three same-parity pages make every lost witness observable in a cohort test."""

from ava_pdf_epub.reconstruction_v2.assembly_state import AssemblyState
from ava_pdf_epub.reconstruction_v2.continuation_presentation_contract import POLICY
from ava_pdf_epub.reconstruction_v2.corroborate_index_headers import corroborate_index_headers

from .index_header_fixture import header_case


def guard_case(root):
    source, pages, owners = header_case(root)
    pages = [p for p in pages if p.observation.number in {2, 4, 6}]
    return source, pages, {p.observation.number: owners[p.observation.number] for p in pages}


def unchanged(source, pages, owners):
    state = AssemblyState(source_continuation_policy=POLICY)
    output = corroborate_index_headers(source, pages, owners, state)
    return output == owners and not state.structure_findings
