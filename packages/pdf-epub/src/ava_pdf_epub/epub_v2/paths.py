"""Resource names are generated from validated identity and media type, never source paths."""

from ..contracts.resources import ImageResource


def asset_path(resource: ImageResource) -> str:
    extension = ".png" if resource.media_type == "image/png" else ".jpg"
    return "assets/" + resource.id + extension
