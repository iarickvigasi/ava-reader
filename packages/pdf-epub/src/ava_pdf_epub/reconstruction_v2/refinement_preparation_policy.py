"""Validate captured source policies before building comparison tasks."""

from collections.abc import Sequence

from .prepared_types import AnyPreparedPage


def validate_preparation_policies(
    prepared: Sequence[AnyPreparedPage],
    source_feature_policy: str | None,
    source_title_policy: str | None,
    source_continuation_policy: str | None,
) -> None:
    from .source_feature_contract import FEATURE_POLICY

    if source_feature_policy not in {None, FEATURE_POLICY}:
        raise ValueError("Unsupported source feature policy")
    if source_title_policy not in {None, "ava-frontmatter-title-1"}:
        raise ValueError("Unsupported source title policy")
    if source_title_policy is not None and source_feature_policy != FEATURE_POLICY:
        raise ValueError("Complete title requires captured source features")
    from .continuation_presentation_contract import POLICY

    if source_continuation_policy not in {None, POLICY} or (
        source_continuation_policy
        and (
            source_title_policy is None
            or getattr(prepared[0], "source_structure_policy", None) != "ava-native-structure-2"
        )
    ):
        raise ValueError("Continuation presentation requires captured current source policies")
