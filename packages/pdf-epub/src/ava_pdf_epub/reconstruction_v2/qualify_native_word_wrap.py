"""Promote source checkpoints once under captured sparse-stage authority."""

from pathlib import Path

from .native_word_wrap_policy import NativeWordWrapPolicy, validate_word_wrap_policy
from .page_checkpoints import PageCheckpoints
from .prepared_native_structure import NativeStructurePreparedPage
from .prepared_native_word_wrap import NativeWordWrapPreparedPage


def qualify_native_word_wrap(
    pages: PageCheckpoints, scratch: Path, policy: NativeWordWrapPolicy
) -> None:
    checked_policy = validate_word_wrap_policy(policy)
    if checked_policy is None:
        raise ValueError("Native word-wrap qualification requires its explicit policy")
    for index in range(len(pages)):
        page = pages[index]
        if isinstance(page, NativeWordWrapPreparedPage):
            if page.source_normalization_policy != checked_policy:
                raise ValueError("Native word-wrap checkpoint policy differs")
            continue
        if not isinstance(page, NativeStructurePreparedPage):
            raise ValueError("Sparse lexical qualification requires native structure checkpoints")
        pages.qualify(
            index,
            NativeWordWrapPreparedPage.model_validate(
                {
                    **page.model_dump(),
                    "schema_version": "ava-prepared-page-4",
                    "source_normalization_policy": checked_policy,
                }
            ),
        )
