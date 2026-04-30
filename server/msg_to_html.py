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

# Injected at the END of <head> so it wins over Outlook's styles
A4_OVERRIDE = """
<style>
/* Force A4 and reset Outlook page dimensions */
@page { size: A4 !important; margin: 2cm !important; }
@page WordSection1 { size: A4 !important; margin: 2cm !important; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
div.WordSection1 { width: 100% !important; max-width: 100% !important; margin: 0 !important; }
table { max-width: 100% !important; }
img { max-width: 100% !important; height: auto !important; }
.email-header-block {
    border-bottom: 1px solid #999;
    padding-bottom: 8pt;
    margin-bottom: 12pt;
}
.email-header-block table { border-collapse: collapse; width: 100%; }
.email-header-block td.lbl { font-weight: bold; white-space: nowrap; vertical-align: top; padding: 2pt 12pt 2pt 0; width: 72pt; }
.email-header-block td.val { vertical-align: top; padding: 2pt 0; }
</style>
"""


def preprocess_outlook_html(html_src: str) -> str:
    """Remove Outlook/Word-specific constructs that break weasyprint A4 rendering."""
    # Remove conditional comments <!--[if ...]>...</[endif]-->
    html_src = re.sub(r'<!--\[if[^\]]*\]>.*?<!\[endif\]-->', '', html_src, flags=re.DOTALL)
    # Remove <o:p> tags (Office empty paragraph markers)
    html_src = re.sub(r'<o:p[^>]*>.*?</o:p>', '', html_src, flags=re.DOTALL | re.IGNORECASE)
    # Remove mso-specific CSS properties from inline styles
    def clean_style(m):
        style = m.group(1)
        # Remove mso-* properties
        style = re.sub(r'mso-[^;]+;?\s*', '', style)
        return f'style="{style}"'
    html_src = re.sub(r'style="([^"]*)"', clean_style, html_src)
    # Remove @page WordSection definitions (they set Letter size)
    html_src = re.sub(r'@page\s+\w+\s*\{[^}]*\}', '', html_src)
    # Remove div.WordSection rules (they reference the old page size)
    html_src = re.sub(r'div\.WordSection\d+\s*\{[^}]*\}', '', html_src)
    # Remove Office namespace attributes from <html> tag
    html_src = re.sub(r'\s+xmlns:[a-z]="[^"]*"', '', html_src)
    return html_src


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
        '<div class="email-header-block">'
        '<table>'
        + hrow("Subject", subject)
        + hrow("From", sender)
        + hrow("To", to_field)
        + hrow("Cc", cc_field)
        + hrow("Date", date)
        + '</table></div>'
    )

    html_body = msg.htmlBody
    if html_body:
        if isinstance(html_body, bytes):
            try:
                html_body = html_body.decode("utf-8", errors="replace")
            except Exception:
                html_body = html_body.decode("latin-1", errors="replace")

        html_body = preprocess_outlook_html(html_body)

        # Inject A4 override CSS before </head>
        head_end = html_body.lower().find("</head>")
        if head_end >= 0:
            html_body = html_body[:head_end] + A4_OVERRIDE + html_body[head_end:]
        else:
            html_body = "<head>" + A4_OVERRIDE + "</head>" + html_body

        # Inject email header block after <body ...>
        body_tag = html_body.lower().find("<body")
        if body_tag >= 0:
            tag_end = html_body.find(">", body_tag)
            if tag_end >= 0:
                html_body = html_body[:tag_end + 1] + header_html + html_body[tag_end + 1:]
        return html_body
    else:
        # Plain text fallback
        plain = (msg.body or "").encode("ascii", errors="ignore").decode("ascii")
        return (
            f'<!DOCTYPE html><html><head><meta charset="utf-8">{A4_OVERRIDE}</head>'
            f'<body>{header_html}<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:11pt;">'
            f'{html_lib.escape(plain)}</pre></body></html>'
        )


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
