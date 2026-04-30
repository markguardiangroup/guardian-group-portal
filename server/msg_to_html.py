#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to an A4 PDF using extract-msg + weasyprint.
Matches Outlook's native "Print to PDF" layout.
Usage: python3 msg_to_html.py <input.msg> <output.pdf>
"""
import sys
import os
import html as html_lib
import re
import email.utils as email_utils

_libs = os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages')
sys.path.insert(0, _libs)

import extract_msg
import weasyprint

MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def format_uk_date(dt) -> str:
    if dt is None:
        return ""
    return f"{dt.day} {MONTHS[dt.month - 1]} {dt.year} {dt.hour:02d}:{dt.minute:02d}"


def display_name_from_addr(addr: str) -> str:
    """Extract display name from 'Name <email@example.com>' format, or return as-is."""
    if not addr:
        return ""
    addr = addr.strip()
    # Only parse if it looks like an email address form
    if "<" in addr:
        name, email_addr = email_utils.parseaddr(addr)
        return (name or email_addr).strip()
    # Plain name with no angle brackets — return as-is
    return addr


def display_names_from_addrs(addr_list: str) -> str:
    """Handle comma-separated list of addresses, returning display names only."""
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


# Injected before </head> — wins over all Outlook/Word styles
A4_CSS = """
<style>
@page {
    size: A4;
    margin: 1.8cm 2.4cm 2cm 2.4cm;
}
@page WordSection1 { size: A4; margin: 1.8cm 2.4cm 2cm 2.4cm; }

* { box-sizing: border-box; }

body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000;
    margin: 0;
    padding: 0;
    background: #fff;
}

/* ---- Outlook-style print header ---- */
.ol-print-sender {
    font-size: 12pt;
    font-weight: normal;
    margin: 0 0 10pt 0;
    padding: 0;
    border-bottom: none;
}
.ol-print-header {
    margin: 0 0 10pt 0;
    padding-bottom: 10pt;
    border-bottom: 2px solid #000;
}
.ol-print-header table {
    border-collapse: collapse;
    width: 100%;
}
.ol-print-header td {
    vertical-align: top;
    padding: 1.5pt 0;
}
.ol-print-header td.lbl {
    font-weight: bold;
    white-space: nowrap;
    width: 105pt;
    text-align: left;
}
.ol-print-header td.val {
    padding-left: 4pt;
}

/* ---- Body content ---- */
div.WordSection1 {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
}
p.MsoNormal, li.MsoNormal, div.MsoNormal {
    margin: 0;
    padding: 0;
}
table { max-width: 100% !important; }
img   { max-width: 100% !important; height: auto !important; }
a     { color: #467886; }
</style>
"""


def preprocess_outlook_html(html_src: str) -> str:
    """Strip Office-specific constructs that break weasyprint A4 rendering."""
    # Remove conditional comments <!--[if ...]>...</[endif]-->
    html_src = re.sub(r'<!--\[if[^\]]*\]>.*?<!\[endif\]-->', '', html_src, flags=re.DOTALL)
    # Remove <o:p> tags (empty Office paragraph markers)
    html_src = re.sub(r'<o:p[^>]*>.*?</o:p>', '', html_src, flags=re.DOTALL | re.IGNORECASE)
    # Strip mso-* properties from inline styles
    def clean_style(m):
        style = re.sub(r'mso-[^;]+;?\s*', '', m.group(1))
        return f'style="{style}"'
    html_src = re.sub(r'style="([^"]*)"', clean_style, html_src)
    # Remove @page WordSection size declarations (they force Letter)
    html_src = re.sub(r'@page\s+\w+\s*\{[^}]*\}', '', html_src)
    # Remove div.WordSection rules
    html_src = re.sub(r'div\.WordSection\d+\s*\{[^}]*\}', '', html_src)
    # Remove Office XML namespace attributes on <html>
    html_src = re.sub(r'\s+xmlns:[a-z]="[^"]*"', '', html_src)
    return html_src


def build_html(msg_path: str) -> str:
    msg = extract_msg.openMsg(msg_path)

    sender      = msg.sender or ""
    subject     = msg.subject or "(No Subject)"
    date_str    = format_uk_date(msg.date)

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
        f'<div class="ol-print-sender">{html_lib.escape(sender_display)}</div>'
        f'<div class="ol-print-header"><table>'
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

        html_body = preprocess_outlook_html(html_body)

        # Inject A4 CSS before </head>
        head_end = html_body.lower().find("</head>")
        if head_end >= 0:
            html_body = html_body[:head_end] + A4_CSS + html_body[head_end:]
        else:
            html_body = "<head><meta charset='utf-8'>" + A4_CSS + "</head>" + html_body

        # Inject header block right after <body …>
        body_open = html_body.lower().find("<body")
        if body_open >= 0:
            tag_end = html_body.find(">", body_open)
            if tag_end >= 0:
                html_body = html_body[:tag_end + 1] + header_html + html_body[tag_end + 1:]
        return html_body

    else:
        # Plain-text fallback
        plain = msg.body or ""
        return (
            f'<!DOCTYPE html><html><head><meta charset="utf-8">{A4_CSS}</head>'
            f'<body>{header_html}'
            f'<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:10pt;">'
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
