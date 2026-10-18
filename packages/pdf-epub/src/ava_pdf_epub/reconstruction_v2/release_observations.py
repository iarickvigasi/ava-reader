"""Release source-only workspace in two stages; coverage keeps only its small exact bindings."""

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .assembly_state import AssemblyState


def release_observations(state: "AssemblyState") -> None:
    state.evidence.clear()
    state.marker_styles.clear()
    state.marker_presentations.clear()
    state.list_body_geometry.clear()
    state.literal_label_geometry.clear()
    state.segments.clear()
    state.internal_targets.clear()
    state.source_contents_rows.clear()
    state.source_index_entries.clear()
    state.source_index_projections.clear()
    state.pending_uri_link = None
    state.source_reference_containers.clear()
    state.aliases.clear()
    state.native_line_maps.clear()
    state.native_hyphen_decisions.clear()
    state.native_continuations.clear()
    state.native_source_lines.clear()
    state.normalization_maps.clear()
    state.compound_heading_sources.clear()
    state.source_prefix_cuts.clear()
    state.bibliographic_source_ranges.clear()
    state.bibliographic_projections.clear()
    state.bibliographic_claim_owners.clear()
    state.placements.clear()
    state.flush_starts.clear()
    state.page_labels.clear()
    state.source_linked_furniture_ids.clear()
    state.refined_joins.clear()
    state.continuation_presentation = None
    state.bibliographic_roles.clear()
    state.printed_title = None
    state.frontmatter_title = None
    state.frontmatter_cover.clear()
    state.source_outline_aliases.clear()
    state.source_outline_alias_parents.clear()
    state.source_outline_targets.clear()


def release_source_workspace(state: "AssemblyState") -> None:
    state.blocks.clear()
    state.styles.clear()
    state.resources.clear()
    state.lists.clear()
    state.compound_feature_sources.clear()
    release_observations(state)
