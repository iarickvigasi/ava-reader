"""Group source comparison crops and bibliographic context without body-wide copies."""

from .bibliographic_refinement import metadata_crop_groups
from .packed_refinement_groups import packed_refinement_groups
from .refinement_catalogue import RefinementCatalogue
from .refinement_catalogue_limits import TASK_NODE_LIMIT
from .refinement_context import RefinementContext
from .refinement_contract import RefinementEdge
from .refinement_groups import refinement_groups
from .refinement_sheet_bounds import sheet_fits

RefinementGroup = tuple[list[str], list[str], list[RefinementEdge], list[str]]


def task_groups(
    catalogue: RefinementCatalogue, context: RefinementContext
) -> list[RefinementGroup]:
    def fits(ids: list[str]) -> bool:
        return sheet_fits(ids, context.segments, context.pages, context.tail_ids)

    grouping = (
        packed_refinement_groups
        if context.projected_nodes and len(catalogue.nodes) > TASK_NODE_LIMIT
        else refinement_groups
    )
    groups: list[RefinementGroup] = [
        (decisions, crops, edges, []) for decisions, crops, edges in grouping(catalogue, fits)
    ]
    anchors = [n.id for n in catalogue.metadata_nodes if n.kind == "heading"][:1]
    for ids in metadata_crop_groups(
        catalogue.metadata_ids,
        lambda ids: sheet_fits(
            list(dict.fromkeys([*anchors, *ids])), context.segments, context.pages, set()
        ),
    ):
        groups.append(([], list(dict.fromkeys([*anchors, *ids])), [], ids))
    return groups
