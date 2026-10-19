"""Select exact whole source nodes; cover corroboration never rewrites title fragments."""

from .printed_title_v2_contract import FrontmatterTitleResponse, FrontmatterTitleTask


def accept_frontmatter_title(
    task: FrontmatterTitleTask, response: FrontmatterTitleResponse
) -> None:
    task = FrontmatterTitleTask.model_validate(task.model_dump())
    response = FrontmatterTitleResponse.model_validate(response.model_dump())
    if (
        response.task_id,
        response.source_sha256,
        response.observation_sha256,
        response.image_sha256,
    ) != (task.task_id, task.source_sha256, task.observation_sha256, task.image.sha256):
        raise ValueError("Frontmatter title source/task/image identity differs")
    if response.selected_node_id is None:
        return
    nodes = {n.id: n for n in task.nodes}
    node = nodes.get(response.selected_node_id)
    if (
        node is None
        or not node.primary_eligible
        or node.text_sha256 != response.selected_text_sha256
    ):
        raise ValueError("Selected title lacks eligible whole source text")
    expected = {
        c.id
        for c in task.crops
        if (c.part == "title" and c.node_id == node.id)
        or (c.part == "context" and c.page == node.page)
    }
    if (
        len(set(response.evidence_ids)) != len(response.evidence_ids)
        or set(response.evidence_ids) != expected
    ):
        raise ValueError("Selected title lacks its exact heading/context evidence")
    cover = response.cover
    if cover is None:
        return
    if len(set(cover.node_ids)) != len(cover.node_ids) or any(
        ident not in nodes or nodes[ident].page != 1 for ident in cover.node_ids
    ):
        raise ValueError("Cover corroboration requires unique first-page source headings")
    if cover.node_ids != [n.id for n in task.nodes if n.id in set(cover.node_ids)]:
        raise ValueError("Cover corroboration reverses source reading order")
    required = {
        c.id
        for c in task.crops
        if (c.part == "title" and c.node_id in cover.node_ids)
        or (c.part == "context" and c.page == 1)
    }
    if (
        len(set(cover.evidence_ids)) != len(cover.evidence_ids)
        or set(cover.evidence_ids) != required
    ):
        raise ValueError("Cover corroboration lacks exact first-page source context")
