"""Small mutable assembly workspace, validated as a complete canonical graph at the boundary."""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal

from ..contracts.layout_normalization import LayoutNormalizationMap
from ..contracts.layout_normalization_v3 import LayoutNormalizationMapV3
from ..contracts.layout_prefix_cut_v3 import PrefixCutReceipt
from ..contracts.styles import Style
from .findings import Finding
from .native_continuation import NativeContinuation
from .native_hyphen_decisions import NativeHyphenDecision
from .native_line_offsets import NativeLineOffset
from .segments import Segment

if TYPE_CHECKING:
    from .compound_feature_source import CompoundFeatureSource
    from .continuation_application import PresentationSnapshot
    from .continuation_metrics import SourceMetricProof
    from .index_entry_receipt import IndexEntryReceipt
    from .index_projection_types import IndexPageProjection
    from .uri_group_types import PendingUriLink


@dataclass
class AssemblyState:
    blocks: list[dict[str, Any]] = field(default_factory=list)
    styles: dict[str, dict[str, Any]] = field(default_factory=dict)
    resources: list[dict[str, Any]] = field(default_factory=list)
    assets: dict[str, bytes] = field(default_factory=dict)
    lists: list[dict[str, Any]] = field(default_factory=list)
    evidence: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    marker_styles: dict[str, str] = field(default_factory=dict)
    marker_presentations: dict[str, str] = field(default_factory=dict)
    list_body_geometry: dict[str, tuple[float, float, float]] = field(default_factory=dict)
    literal_label_geometry: dict[str, tuple[str, float]] = field(default_factory=dict)
    segments: dict[str, Any] = field(default_factory=dict)
    internal_targets: list[tuple[str, int, int, str, int]] = field(default_factory=list)
    source_contents_rows: dict[str, str] = field(default_factory=dict)
    pending_uri_link: "PendingUriLink | None" = None
    source_index_projections: dict[int, "IndexPageProjection"] = field(default_factory=dict)
    source_index_entries: dict[str, "IndexEntryReceipt"] = field(default_factory=dict)
    source_reference_containers: dict[str, str] = field(default_factory=dict)
    aliases: dict[str, tuple[str, int]] = field(default_factory=dict)
    native_line_maps: dict[str, NativeLineOffset] = field(default_factory=dict)
    native_hyphen_decisions: list[NativeHyphenDecision] = field(default_factory=list)
    native_continuations: dict[str, NativeContinuation] = field(default_factory=dict)
    native_source_lines: dict[str, str] = field(default_factory=dict)
    normalization_maps: dict[str, LayoutNormalizationMap | LayoutNormalizationMapV3] = field(
        default_factory=dict
    )
    compound_heading_sources: dict[str, tuple[Segment, ...]] = field(default_factory=dict)
    word_wrap_active: bool = False
    source_prefix_cuts: dict[str, PrefixCutReceipt] = field(default_factory=dict)
    bibliographic_source_ranges: dict[str, tuple[int, int, int, str, str, str]] = field(
        default_factory=dict
    )
    bibliographic_projections: dict[str, str] = field(default_factory=dict)
    bibliographic_claim_owners: dict[str, str] = field(default_factory=dict)
    placements: dict[str, tuple[int, int, int]] = field(default_factory=dict)
    flush_starts: dict[str, bool] = field(default_factory=dict)
    structure_findings: list[Finding] = field(default_factory=list)
    page_labels: dict[int, str] = field(default_factory=dict)
    source_linked_furniture_ids: set[str] = field(default_factory=set)
    refinement_evidence: list[dict[str, Any]] = field(default_factory=list)
    bibliographic_roles: dict[str, tuple[str | None, str]] = field(default_factory=dict)
    printed_title: tuple[str, str, Literal["title"] | None] | None = None
    source_title_policy: str | None = None
    frontmatter_title_compared: bool = False
    frontmatter_title: tuple[str, str] | None = None
    frontmatter_cover: list[tuple[str, str]] = field(default_factory=list)
    source_outline_aliases: list[tuple[str, int, int]] = field(default_factory=list)
    source_outline_alias_parents: dict[int, tuple[str, int, int] | None] = field(
        default_factory=dict
    )
    source_outline_targets: dict[tuple[str, int, int], str] = field(default_factory=dict)
    continuation_metric_proofs: dict[str, "SourceMetricProof"] = field(default_factory=dict)
    continuation_presentation: "PresentationSnapshot | None" = None
    source_continuation_policy: str | None = None
    refined_joins: dict[tuple[str, str], bool] = field(default_factory=dict)
    source_feature_policy: str | None = None
    source_feature_evidence: list[dict[str, Any]] = field(default_factory=list)
    compound_feature_sources: dict[str, "CompoundFeatureSource"] = field(default_factory=dict)
    requested_source_features: int = 0
    unrequested_optional_features: int = 0

    def style_id(self, style: Style | None) -> str | None:
        from .observed_style_id import observed_style_id

        return observed_style_id(self.styles, style)

    def release_observations(self) -> None:
        from .release_observations import release_observations

        release_observations(self)

    def release_source_workspace(self) -> None:
        from .release_observations import release_source_workspace

        release_source_workspace(self)
