#!/usr/bin/env python3
"""
Add sequential page numbers to a PDF using reportlab + pypdf.
This is reliable across all PDF types (Chromium, LibreOffice, etc.)
Usage: python3 add_page_numbers.py <input.pdf> <output.pdf> [start_page_number]
"""
import sys
import os
import io

_libs = os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages')
sys.path.insert(0, _libs)

from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4


def make_number_overlay(page_num: int, width: float, height: float) -> bytes:
    """Create a single-page PDF containing a white cover box plus the page number.

    The white box masks any pre-existing page number (or stray marks) that may
    already be printed in the same bottom-right corner of the original page,
    before our own number is drawn on top of it.
    """
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))

    # Bottom-right: 30pt from right edge, 15pt from bottom (matches text position below)
    text = str(page_num)
    font_name = "Helvetica"
    font_size = 9
    text_width = c.stringWidth(text, font_name, font_size)
    x = width - 30 - text_width
    y = 15

    # White cover box sized to fully mask a typical existing page number/footer
    # in the bottom-right area of the page — wide/tall enough to cover common
    # Word/LibreOffice footer placements (which are often ~0.5-1in from the
    # bottom/right margins), not just our own text's exact position.
    box_width = 130
    box_height = 45
    box_x = width - box_width
    box_y = 0
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(1, 1, 1)
    c.rect(box_x, box_y, box_width, box_height, fill=1, stroke=0)

    c.setFont(font_name, font_size)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(x, y, text)
    c.save()
    buf.seek(0)
    return buf.read()


def add_page_numbers(input_path: str, output_path: str, start_page_number: int = 1) -> None:
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for i, page in enumerate(reader.pages):
        page_num = start_page_number + i
        # Get actual page dimensions
        box = page.mediabox
        width = float(box.width)
        height = float(box.height)

        # Build overlay PDF for this page number
        overlay_bytes = make_number_overlay(page_num, width, height)
        overlay_reader = PdfReader(io.BytesIO(overlay_bytes))
        overlay_page = overlay_reader.pages[0]

        # Merge: base page first, then overlay on top
        page.merge_page(overlay_page)
        writer.add_page(page)

    with open(output_path, "wb") as f:
        writer.write(f)


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print("Usage: add_page_numbers.py <input.pdf> <output.pdf> [start_page_number]", file=sys.stderr)
        sys.exit(1)
    start_num = 1
    if len(sys.argv) == 4:
        try:
            start_num = int(sys.argv[3])
        except ValueError:
            start_num = 1
        if start_num < 1:
            start_num = 1
    add_page_numbers(sys.argv[1], sys.argv[2], start_num)
    print(f"OK: {sys.argv[2]}")
