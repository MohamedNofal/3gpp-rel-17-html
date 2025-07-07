#!/usr/bin/env python3
"""
truncate_html.py  –  keep only the first 200 lines of each HTML file
found in immediate sub‑directories of the current working directory.

Usage:
    cd /Users/mohamednofal/Documents/Standards/3gpp-rel-17-html
    python3 truncate_html.py
"""

from pathlib import Path
import sys

# --- configuration ---------------------------------------------------------
MAX_LINES = 200                              # how many lines to keep
COMMENT    = "<!-- *** File truncated after first {} lines *** -->\n".format(MAX_LINES)
# ---------------------------------------------------------------------------

def truncate_file(html_path: Path) -> None:
    """Keep the first MAX_LINES of *html_path* and overwrite the file."""
    try:
        lines = html_path.read_text(encoding="utf-8", errors="ignore").splitlines(keepends=True)
    except Exception as exc:
        print(f"[skip] {html_path} – could not read ({exc})", file=sys.stderr)
        return

    if len(lines) <= MAX_LINES:
        # Nothing to do
        return

    new_content = "".join(lines[:MAX_LINES]) + COMMENT
    try:
        html_path.write_text(new_content, encoding="utf-8")
        print(f"[ok]   {html_path}")
    except Exception as exc:
        print(f"[fail] {html_path} – could not write ({exc})", file=sys.stderr)


def main() -> None:
    root = Path.cwd()              # run the script from the top‑level folder
    folders = [p for p in root.iterdir() if p.is_dir()]

    if not folders:
        print("No sub‑directories found; nothing to do.", file=sys.stderr)
        return

    for folder in folders:
        for html_file in folder.rglob("*.html"):
            truncate_file(html_file)


if __name__ == "__main__":
    main()
