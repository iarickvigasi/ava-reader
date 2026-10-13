"""Authored source pages/regions for the independent sparse word-wrap fixture."""

from ava_pdf_epub.contracts.source import Box, SourcePage, SourceRegion
from ava_pdf_epub.reconstruction_v2.observations import NativeLine, PageObservation


def word_wrap_fixture_pages(lines: list[NativeLine], numbers: list[int]):
    pages, source_pages = [], []
    for number in numbers:
        local = [line for line in lines if line.id.startswith(f"p{number}-")]
        height = 20 + len(lines) * 2
        pages.append(
            PageObservation(
                number=number,
                width_pt=200,
                height_pt=height,
                rotation=0,
                render_path="unused.png",
                render_sha256="b" * 64,
                render_width=200,
                render_height=100,
                lines=local,
                graphics=[],
                risks=[],
            )
        )
        source_pages.append(
            SourcePage(
                number=number,
                width_pt=200,
                height_pt=height,
                original_rotation=0,
                regions=[
                    SourceRegion(
                        id=f"page{number}-region",
                        box=Box(
                            coordinate_space="page_points_top_left",
                            x0=1,
                            y0=1,
                            x1=199,
                            y1=height - 1,
                        ),
                        band=0,
                        column=0,
                        role="content",
                        route="native",
                    )
                ],
            )
        )
    return pages, source_pages
