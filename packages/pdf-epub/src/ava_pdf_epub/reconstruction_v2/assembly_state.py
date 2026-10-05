"""Small mutable assembly workspace, validated as a complete canonical graph at the boundary."""

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any

from ..contracts.styles import Style
from .findings import Finding


@dataclass
class AssemblyState:
    blocks: list[dict[str, Any]] = field(default_factory=list)
    styles: dict[str, dict[str, Any]] = field(default_factory=dict)
    resources: list[dict[str, Any]] = field(default_factory=list)
    assets: dict[str, bytes] = field(default_factory=dict)
    lists: list[dict[str, Any]] = field(default_factory=list)
    evidence: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    marker_styles: dict[str, str] = field(default_factory=dict)
    segments: dict[str, Any] = field(default_factory=dict)
    internal_targets: list[tuple[str, int, int, str, int]] = field(default_factory=list)
    aliases: dict[str, tuple[str, int]] = field(default_factory=dict)
    placements: dict[str, tuple[int, int, int]] = field(default_factory=dict)
    flush_starts: dict[str, bool] = field(default_factory=dict)
    structure_findings: list[Finding] = field(default_factory=list)
    page_labels: dict[int, str] = field(default_factory=dict)
    refinement_evidence: list[dict[str, Any]] = field(default_factory=list)
    bibliographic_roles: dict[str, tuple[str | None, str]] = field(default_factory=dict)
    refined_joins: dict[tuple[str, str], bool] = field(default_factory=dict)
    source_feature_policy: str | None = None
    source_feature_evidence: list[dict[str, Any]] = field(default_factory=list)
    requested_source_features: int = 0
    unrequested_optional_features: int = 0

    def style_id(self, style: Style | None) -> str | None:
        if style is None:
            return None
        value = style.model_dump(exclude={"id"})
        digest = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:24]
        ident = "style-" + digest
        self.styles[ident] = {"id": ident, **value}
        return ident

    def release_observations(self) -> None:
        """After relationships/addresses are compiled, raw observations are no longer used."""
        self.evidence.clear()
        self.marker_styles.clear()
        self.segments.clear()
        self.internal_targets.clear()
        self.aliases.clear()
        self.placements.clear()
        self.flush_starts.clear()
        self.page_labels.clear()
        self.refined_joins.clear()
        self.bibliographic_roles.clear()

    def release_source_workspace(self) -> None:
        """After canonical validation, retain only assets and report evidence for export."""
        self.blocks.clear()
        self.styles.clear()
        self.resources.clear()
        self.lists.clear()
        self.release_observations()
