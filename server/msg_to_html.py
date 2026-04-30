#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to an A4 PDF using extract-msg + headless Chromium.
Produces true "print to PDF" quality — identical to printing from a browser.
Usage: python3 msg_to_html.py <input.msg> <output.pdf>
"""
import sys
import os
import html as html_lib
import re
import email.utils as email_utils
import shutil
import tempfile
import asyncio

_libs = os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages')
sys.path.insert(0, _libs)

import extract_msg
import pyppeteer

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def format_uk_date(dt) -> str:
    if dt is None:
        return ""
    return f"{dt.day} {MONTHS[dt.month - 1]} {dt.year} {dt.hour:02d}:{dt.minute:02d}"


def display_name_from_addr(addr: str) -> str:
    if not addr:
        return ""
    addr = addr.strip()
    if "<" in addr:
        name, email_addr = email_utils.parseaddr(addr)
        return (name or email_addr).strip()
    return addr


def display_names_from_addrs(addr_list: str) -> str:
    if not addr_list:
        return ""
    parts = []
    for segment in addr_list.split(";"):
        segment = segment.strip()
        if not segment:
            continue
        if "<" in segment:
            name, email_addr = email_utils.parseaddr(segment)
            parts.append((name or email_addr).strip())
        else:
            parts.append(segment)
    return "; ".join(parts)


HEADER_CSS = """
<style>
@media print {
  @page { size: A4; margin: 1.8cm 2.4cm 2cm 2.4cm; }
}
.ol-sender-heading {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12pt;
    font-weight: normal;
    margin: 0 0 8pt 0;
}
.ol-header-table {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 12pt;
    padding-bottom: 10pt;
    border-bottom: 2px solid #000;
}
.ol-header-table td {
    vertical-align: top;
    padding: 1.5pt 0;
}
.ol-header-table td.lbl {
    font-weight: bold;
    white-space: nowrap;
    width: 95pt;
}
.ol-header-table td.val {
    padding-left: 4pt;
}
</style>
"""


def preprocess_outlook_html(html_src: str) -> str:
    """Strip Office-specific constructs that break print rendering."""
    html_src = re.sub(r'<!--\[if[^\]]*\]>.*?<!\[endif\]-->', '', html_src, flags=re.DOTALL)
    html_src = re.sub(r'<o:p[^>]*>.*?</o:p>', '', html_src, flags=re.DOTALL | re.IGNORECASE)
    html_src = re.sub(r'\s+xmlns:[a-z]="[^"]*"', '', html_src)
    return html_src


def build_html(msg_path: str) -> str:
    msg = extract_msg.openMsg(msg_path)

    sender   = msg.sender or ""
    subject  = msg.subject or "(No Subject)"
    date_str = format_uk_date(msg.date)

    to_raw = ""
    try:
        to_raw = msg.to or ""
    except Exception:
        pass

    cc_raw = ""
    try:
        cc_raw = msg.cc or ""
    except Exception:
        pass

    sender_display = display_name_from_addr(sender)
    to_display     = display_names_from_addrs(to_raw)
    cc_display     = display_names_from_addrs(cc_raw)

    def hrow(label: str, value: str) -> str:
        if not value:
            return ""
        return (
            f'<tr>'
            f'<td class="lbl">{html_lib.escape(label)}:</td>'
            f'<td class="val">{html_lib.escape(value)}</td>'
            f'</tr>'
        )

    header_html = (
        f'<div class="ol-sender-heading">{html_lib.escape(sender_display)}</div>'
        f'<table class="ol-header-table">'
        + hrow("From",    sender_display)
        + hrow("Sent",    date_str)
        + hrow("To",      to_display)
        + hrow("Cc",      cc_display)
        + hrow("Subject", subject)
        + f'</table>'
    )

    html_body = msg.htmlBody
    if html_body:
        if isinstance(html_body, bytes):
            try:
                html_body = html_body.decode("utf-8", errors="replace")
            except Exception:
                html_body = html_body.decode("latin-1", errors="replace")

        html_body = preprocess_outlook_html(html_body)

        # Inject header CSS before </head>
        head_end = html_body.lower().find("</head>")
        if head_end >= 0:
            html_body = html_body[:head_end] + HEADER_CSS + html_body[head_end:]
        else:
            html_body = "<head><meta charset='utf-8'>" + HEADER_CSS + "</head>" + html_body

        # Inject header block right after <body …>
        body_open = html_body.lower().find("<body")
        if body_open >= 0:
            tag_end = html_body.find(">", body_open)
            if tag_end >= 0:
                html_body = html_body[:tag_end + 1] + header_html + html_body[tag_end + 1:]
        return html_body

    else:
        plain = msg.body or ""
        return (
            f'<!DOCTYPE html><html><head><meta charset="utf-8">{HEADER_CSS}</head>'
            f'<body>{header_html}'
            f'<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:10pt;">'
            f'{html_lib.escape(plain)}</pre></body></html>'
        )


def find_chromium() -> str:
    # 1. Try PATH lookup first
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        path = shutil.which(name)
        if path and os.path.isfile(path):
            return path
    # 2. Scan Nix store directly (handles restricted PATH in spawned subprocesses)
    nix_store = "/nix/store"
    if os.path.isdir(nix_store):
        for entry in sorted(os.listdir(nix_store), reverse=True):
            if "chromium" in entry.lower():
                candidate = os.path.join(nix_store, entry, "bin", "chromium")
                if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                    return candidate
    raise RuntimeError("Chromium not found — install it via system dependencies")


async def _render_pdf(html_src: str, pdf_path: str) -> None:
    chromium = find_chromium()
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_src)
        tmp_html = f.name

    try:
        browser = await pyppeteer.launch(
            executablePath=chromium,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-setuid-sandbox",
            ]
        )
        page = await browser.newPage()
        await page.goto(f"file://{tmp_html}", waitUntil="networkidle0")
        await page.pdf(
            path=pdf_path,
            format="A4",
            printBackground=True,
            margin={
                "top":    "1.8cm",
                "right":  "2.4cm",
                "bottom": "2.0cm",
                "left":   "2.4cm",
            }
        )
        await browser.close()
    finally:
        os.unlink(tmp_html)


def msg_to_pdf(msg_path: str, pdf_path: str) -> None:
    html_src = build_html(msg_path)
    asyncio.run(_render_pdf(html_src, pdf_path))


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: msg_to_html.py <input.msg> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    msg_to_pdf(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
