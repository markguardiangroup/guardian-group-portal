#!/usr/bin/env python3
"""
Convert a .msg (Outlook) file to HTML for PDF conversion.
Usage: python3 msg_to_html.py <input.msg> <output.html>
"""
import sys
import os
import html as html_lib

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '.pythonlibs', 'lib', 'python3.11', 'site-packages'))

import extract_msg

def msg_to_html(msg_path: str, html_path: str) -> None:
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
            f'<tr><td style="font-weight:bold;padding:2px 8px 2px 0;white-space:nowrap;color:#555;">'
            f'{html_lib.escape(label)}:</td>'
            f'<td style="padding:2px 0;">{html_lib.escape(value)}</td></tr>'
        )

    header_html = f"""
<div style="border-bottom:2px solid #ccc;padding-bottom:10px;margin-bottom:16px;font-family:Arial,sans-serif;font-size:13px;">
  <table style="border-collapse:collapse;width:100%;">
    {header_row("Subject", subject)}
    {header_row("From", sender)}
    {header_row("To", to_field)}
    {header_row("Cc", cc_field)}
    {header_row("Date", date)}
  </table>
</div>
"""

    if is_full_html:
        insert_after = body_content.find("<body")
        if insert_after >= 0:
            tag_end = body_content.find(">", insert_after)
            if tag_end >= 0:
                output = body_content[:tag_end + 1] + header_html + body_content[tag_end + 1:]
            else:
                output = body_content.replace("<body", "<body>" + header_html + "<body", 1)
        else:
            output = f"<html><body>{header_html}{body_content}</body></html>"
    else:
        output = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body {{ font-family: Arial, sans-serif; font-size: 13px; margin: 24px; }}
  pre {{ white-space: pre-wrap; word-wrap: break-word; }}
</style></head>
<body>
{header_html}
{body_content}
</body>
</html>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(output)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: msg_to_html.py <input.msg> <output.html>", file=sys.stderr)
        sys.exit(1)
    msg_to_html(sys.argv[1], sys.argv[2])
    print(f"OK: {sys.argv[2]}")
