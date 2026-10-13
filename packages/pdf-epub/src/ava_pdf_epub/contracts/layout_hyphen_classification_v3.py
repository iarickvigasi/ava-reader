"""Compact decisions bind to a validated catalogue; native echo authority stays distinct."""

from typing import Literal

from .common import Digest, Id, Record
from .layout_hyphen import LayoutHyphenCandidate

LayoutDecision = Literal["layout", "literal", "unresolved"]


class LayoutHyphenClassificationReceipt(Record):
    authority: Literal["word_wrap"]
    task_id: Id
    task_sha256: Digest
    response_sha256: Digest
    catalogue_sha256: Digest
    candidate_id: Id
    source_candidate_sha256: Digest
    decision: LayoutDecision


class NativeStructureHyphenClassificationReceipt(Record):
    authority: Literal["native_structure"]
    task_id: Id
    task_sha256: Digest
    response_sha256: Digest
    candidate_id: Id
    source_candidate_sha256: Digest
    decision: LayoutDecision
    original_candidate: LayoutHyphenCandidate


LayoutClassificationReceipt = (
    LayoutHyphenClassificationReceipt | NativeStructureHyphenClassificationReceipt
)
