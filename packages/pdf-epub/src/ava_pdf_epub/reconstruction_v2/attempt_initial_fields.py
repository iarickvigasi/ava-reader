"""Initial packets select one closed version before any source work or provider dispatch."""

from typing import Any


def validate_initial_fields(raw: dict[str, Any]) -> None:
    required = {"schema_version", "profile_id", "source_sha256", "responses", "refinements"}
    marker = raw.get("schema_version")
    valid: tuple[set[str], ...]
    if marker in {"ava-reconstruct-input-4", "ava-reconstruct-input-5", "ava-reconstruct-input-6"}:
        required |= {
            "source_feature_policy",
            "source_layout_policy",
            "source_structure_policy",
            "native_structure_responses",
        }
        if marker in {"ava-reconstruct-input-5", "ava-reconstruct-input-6"}:
            required |= {"source_normalization_policy", "word_wrap_responses"}
        if marker == "ava-reconstruct-input-6":
            required |= {"recognition_repair_policy", "geometry_corrections"}
        valid = (required,)
    elif marker == "ava-reconstruct-input-3":
        valid = (required | {"source_feature_policy", "source_layout_policy"},)
    else:
        valid = (required, required | {"source_feature_policy"})
    if set(raw) not in valid:
        raise ValueError("Invalid initial reconstruction input fields")
