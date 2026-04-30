#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to an A4 PDF using extract-msg + weasyprint.
Usage: python3 msg_to_html.py <input.msg> <output.pdf>
"""
import sys
import os
import html as html_lib
import re

_libs = os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages')
sys.path.insert(0, _libs)

import extract_msg
import weasyprint

CSS = """
@page { size: A4; margin: 2cm; }
* { box-sizing: border-box; }
body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    color: #000;
    margin: 0;
    padding: 0;
    line-height: 1.4;
}
.header-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12pt;
    padding-bottom: 8pt;
    border-bottom: 1px solid #999;
}
.header-table td.label {
    font-weight: bold;
    white-space: nowrap;
    vertical-align: top;
    padding: 2pt 12pt 2pt 0;
    width: 80pt;
}
.header-table td.value {
    vertical-align: top;
    padding: 2pt 0;
}
.body-text {
    white-space: pre-wrap;
    word-wrap: break-word;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
}
"""


def strip_html(html_src: str) -> str:
    """Very basic HTML-to-plain-text for email bodies."""
    text = re.sub(r'<br\s*/?>', '\n', html_src, flags=re.IGNORECASE)
    text = re.sub(r'<p[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<div[^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</div>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&quot;', '"', text)
    text = re.sub(r'&#39;', "'", text)
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def build_html(msg_path: str) -> str:
    msg = extract_msg.openMsg(msg_path)

    subject = msg.subject or "(No Subject)"
    sender = msg.sender or ""
    date = str(msg.date) if msg.date else ""

    to_field = ""
    try:
        to_field = msg.to or ""
    except Exception:
        pass

    cc_field = ""
    try:
        cc_field = msg.cc or ""
    except Exception:
        pass

    # Prefer plain text body; fall back to stripping HTML body
    plain_body = ""
    if msg.body:
        plain_body = msg.body.strip()
    elif msg.htmlBody:
        html_src = msg.htmlBody
        if isinstance(html_src, bytes):
            try:
                html_src = html_src.decode("utf-8", errors="replace")
            except Exception:
                html_src = html_src.decode("latin-1", errors="replace")
        plain_body = strip_html(html_src)

    # Remove characters that can't be encoded in common fonts (e.g. emoji surrogates)
    plain_body = plain_body.encode("ascii", errors="ignore").decode("ascii")

    def hrow(label: str, value: str) -> str:
        if not value:
            return ""
        return (
            f'<tr>'
            f'<td class="label">{html_lib.escape(label)}:</td>'
            f'<td class="value">{html_lib.escape(value)}</td>'
            f'</tr>'
        )

    header_rows = (
        hrow("Subject", subject)
        + hrow("From", sender)
        + hrow("To", to_field)
        + hrow("Cc", cc_field)
        + hrow("Date", date)
    )

    body_html = f'<div class="body-text">{html_lib.escape(plain_body)}</div>'

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>{CSS}</style>
</head>
<body>
  <table class="header-table">{header_rows}</table>
  {body_html}
</body>
</html>"""


def msg_to_pdf(msg_path: str, pdf_path: str) -> None:
    html_src = build_html(msg_path)
    doc = weasyprint.HTML(string=html_src)
    doc.write_pdf(pdf_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: msg_to_html.py <input.msg> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    msg_to_pdf(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
