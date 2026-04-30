#!/usr/bin/env python3
"""
Add sequential page numbers to a PDF using reportlab + pypdf.
This is reliable across all PDF types (Chromium, LibreOffice, etc.)
Usage: python3 add_page_numbers.py <input.pdf> <output.pdf>
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
    """Create a single-page PDF containing just the page number."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(width, height))
    c.setFont("Helvetica", 9)
    c.setFillColorRGB(0, 0, 0)
    # Bottom-right: 30pt from right edge, 15pt from bottom
    text = str(page_num)
    text_width = c.stringWidth(text, "Helvetica", 9)
    x = width - 30 - text_width
    y = 15
    c.drawString(x, y, text)
    c.save()
    buf.seek(0)
    return buf.read()


def add_page_numbers(input_path: str, output_path: str) -> None:
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for i, page in enumerate(reader.pages):
        page_num = i + 1
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
    if len(sys.argv) != 3:
        print("Usage: add_page_numbers.py <input.pdf> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    add_page_numbers(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
