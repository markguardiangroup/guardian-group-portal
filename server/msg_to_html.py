#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to an A4 PDF using extract-msg + weasyprint.
Usage: python3 msg_to_html.py <input.msg> <output.pdf>
"""
import sys
import os
import html as html_lib

_libs = os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages')
sys.path.insert(0, _libs)

import extract_msg
import weasyprint

A4_STYLE = """
@page { size: A4; margin: 2cm; }
body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; }
pre { white-space: pre-wrap; word-wrap: break-word; font-size: 10pt; }
img { max-width: 100%; height: auto; }
table { border-collapse: collapse; }
td, th { padding: 4px 8px; }
a { color: #1a0dab; }
"""

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

    html_body = msg.htmlBody
    plain_body = msg.body or ""

    if html_body:
        if isinstance(html_body, bytes):
            try:
                html_body = html_body.decode("utf-8", errors="replace")
            except Exception:
                html_body = html_body.decode("latin-1", errors="replace")
        body_content = html_body
        is_full_html = "<html" in body_content.lower()
    else:
        body_content = "<pre>" + html_lib.escape(plain_body) + "</pre>"
        is_full_html = False

    def header_row(label: str, value: str) -> str:
        if not value:
            return ""
        return (
            f'<tr>'
            f'<td style="font-weight:bold;padding:3px 10px 3px 0;white-space:nowrap;color:#444;vertical-align:top;">'
            f'{html_lib.escape(label)}:</td>'
            f'<td style="padding:3px 0;">{html_lib.escape(value)}</td>'
            f'</tr>'
        )

    header_html = (
        '<div style="border-bottom:2px solid #ccc;padding-bottom:10px;margin-bottom:16px;">'
        '<table style="border-collapse:collapse;width:100%;">'
        + header_row("Subject", subject)
        + header_row("From", sender)
        + header_row("To", to_field)
        + header_row("Cc", cc_field)
        + header_row("Date", date)
        + '</table></div>'
    )

    if is_full_html:
        # Inject A4 style into existing <head>
        head_end = body_content.lower().find("</head>")
        if head_end >= 0:
            body_content = (body_content[:head_end]
                            + f'<style>{A4_STYLE}</style>'
                            + body_content[head_end:])
        else:
            body_content = f'<head><style>{A4_STYLE}</style></head>' + body_content

        # Inject header after <body ...>
        body_tag = body_content.lower().find("<body")
        if body_tag >= 0:
            tag_end = body_content.find(">", body_tag)
            if tag_end >= 0:
                body_content = body_content[:tag_end + 1] + header_html + body_content[tag_end + 1:]
        return body_content
    else:
        return (
            f'<!DOCTYPE html><html><head><meta charset="utf-8">'
            f'<style>{A4_STYLE}</style></head>'
            f'<body>{header_html}{body_content}</body></html>'
        )


def msg_to_pdf(msg_path: str, pdf_path: str) -> None:
    html_src = build_html(msg_path)
    doc = weasyprint.HTML(string=html_src, base_url=os.path.dirname(msg_path))
    doc.write_pdf(pdf_path)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: msg_to_html.py <input.msg> <output.pdf>", file=sys.stderr)
        sys.exit(1)
    msg_to_pdf(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
