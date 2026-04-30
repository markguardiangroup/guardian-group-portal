#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to an A4 PDF using extract-msg + headless Chromium.
Produces output matching Outlook's native Print > Print to PDF layout.
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
from bs4 import BeautifulSoup

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


def extract_clean_body_html(html_src: str) -> str:
    """
    Parse Outlook HTML, strip all <style>/<script>/<head> and Office junk,
    return just the visible body content as clean HTML.
    """
    soup = BeautifulSoup(html_src, "html.parser")

    # Remove script and style tags entirely
    for tag in soup.find_all(["script", "style", "head"]):
        tag.decompose()

    # Remove conditional comment leftovers and Office namespace tags
    for tag in soup.find_all(re.compile(r'^o:')):
        tag.decompose()
    for tag in soup.find_all(re.compile(r'^v:')):
        tag.decompose()
    for tag in soup.find_all(re.compile(r'^w:')):
        tag.decompose()

    # Get body content, or fallback to everything
    body = soup.find("body")
    if body:
        content = body
    else:
        content = soup

    # Strip mso-* and Office-specific inline style properties, keep useful ones
    KEEP_PROPS = {"font-weight", "font-style", "font-size", "color",
                  "text-decoration", "font-family", "text-align"}
    for tag in content.find_all(style=True):
        style_str = tag.get("style", "")
        kept = []
        for prop in style_str.split(";"):
            prop = prop.strip()
            if not prop:
                continue
            name = prop.split(":")[0].strip().lower()
            if name in KEEP_PROPS and "mso" not in name:
                kept.append(prop)
        if kept:
            tag["style"] = "; ".join(kept)
        else:
            del tag["style"]

    # Remove class attributes (they referenced Outlook's stripped CSS)
    for tag in content.find_all(class_=True):
        del tag["class"]

    # Remove empty paragraphs that are just &nbsp; spacers
    for p in content.find_all("p"):
        text = p.get_text(strip=True)
        if not text or text == "\xa0":
            p.decompose()

    return str(content)


PRINT_CSS = """
<style>
  @page {
    size: A4;
    margin: 1.8cm 2.4cm 2cm 2.4cm;
  }

  * { box-sizing: border-box; }

  body {
    font-family: Calibri, Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #000;
    background: #fff;
    margin: 0;
    padding: 0;
  }

  /* ── Outlook-style sender heading ── */
  .ol-sender {
    font-family: Calibri, Arial, sans-serif;
    font-size: 14pt;
    font-weight: normal;
    margin: 0 0 6pt 0;
    padding: 0;
  }

  /* ── From / Sent / To / Subject header table ── */
  .ol-header {
    border-bottom: 2px solid #000;
    padding-bottom: 8pt;
    margin-bottom: 12pt;
  }
  .ol-header table {
    border-collapse: collapse;
    width: 100%;
    font-size: 10pt;
  }
  .ol-header td {
    vertical-align: top;
    padding: 1pt 0;
  }
  .ol-header td.lbl {
    font-weight: bold;
    white-space: nowrap;
    width: 80pt;
  }
  .ol-header td.val {
    padding-left: 8pt;
  }

  /* ── Email body ── */
  .ol-body {
    font-size: 11pt;
  }
  .ol-body p {
    margin: 0 0 6pt 0;
    line-height: 1.4;
  }
  .ol-body div {
    line-height: 1.4;
  }

  /* Quoted / replied email separator */
  .ol-body hr {
    border: none;
    border-top: 1px solid #ccc;
    margin: 10pt 0;
  }

  a { color: #1155CC; text-decoration: none; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
</style>
"""


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
        f'<div class="ol-sender">{html_lib.escape(sender_display)}</div>'
        f'<div class="ol-header"><table>'
        + hrow("From",    sender_display)
        + hrow("Sent",    date_str)
        + hrow("To",      to_display)
        + hrow("Cc",      cc_display)
        + hrow("Subject", subject)
        + f'</table></div>'
    )

    html_body = msg.htmlBody
    if html_body:
        if isinstance(html_body, bytes):
            try:
                html_body = html_body.decode("utf-8", errors="replace")
            except Exception:
                html_body = html_body.decode("latin-1", errors="replace")

        body_content = extract_clean_body_html(html_body)
    else:
        plain = msg.body or ""
        body_content = (
            f'<pre style="white-space:pre-wrap;font-family:Calibri,Arial,sans-serif;font-size:11pt;">'
            f'{html_lib.escape(plain)}</pre>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
{PRINT_CSS}
</head>
<body>
{header_html}
<div class="ol-body">
{body_content}
</div>
</body>
</html>"""


def find_chromium() -> str:
    # 1. Try PATH lookup
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        path = shutil.which(name)
        if path and os.path.isfile(path):
            return path
    # 2. Scan Nix store (handles restricted PATH in Node-spawned subprocesses)
    nix_store = "/nix/store"
    if os.path.isdir(nix_store):
        for entry in sorted(os.listdir(nix_store), reverse=True):
            if "chromium" in entry.lower():
                candidate = os.path.join(nix_store, entry, "bin", "chromium")
                if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                    return candidate
    raise RuntimeError("Chromium not found — install via system dependencies")


async def _render_pdf(html_src: str, pdf_path: str) -> None:
    chromium = find_chromium()
    with tempfile.NamedTemporaryFile(
        suffix=".html", delete=False, mode="w", encoding="utf-8"
    ) as f:
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
            printBackground=False,
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
