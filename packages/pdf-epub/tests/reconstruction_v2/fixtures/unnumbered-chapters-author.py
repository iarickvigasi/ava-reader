"""Independent tiny source: named chapters explicitly specified by its authored contents."""

from pathlib import Path

from reportlab.pdfgen.canvas import Canvas

out = Path(__file__).parent
pdf = out / "unnumbered-chapters.pdf"
c = Canvas(str(pdf), pagesize=(504, 720), invariant=1, pageCompression=1)
c.setTitle("Walking by the Water")
c.setAuthor("AVA synthetic reviewer")


def line(text, y, size=11, bold=False):
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    c.drawString(48, y, text)


line("Walking by the Water", 655, 22, True)
line("Contents", 570, 18, True)
line("The Harbour ........................................ 2", 530)
line("The Orchard ........................................ 3", 505)
c.showPage()
line("The Harbour", 650, 22, True)
line("The first chapter follows the path beside the water.", 590)
line("The reader can see a boat and the light above the shore.", 572)
line("This is the harbour where the walking journey begins.", 554)
line("2", 32)
c.showPage()
line("The Orchard", 650, 22, True)
line("The second chapter reaches the trees beyond the water.", 590)
line("The reader can see the fruit and the path between the trees.", 572)
line("Return to The Harbour on page 2.", 530)
line("3", 32)
c.save()
(out / "oracle.json").write_text(
    '{"chapters":["The Harbour","The Orchard"],'
    '"printed_reference":{"source_text":"Return to The Harbour on page 2.",'
    '"target_chapter":"The Harbour","target_print_page":"2"},'
    '"authority":"Authored contents labels and explicit chapter opening pages; '
    'not parser output"}\n'
)
