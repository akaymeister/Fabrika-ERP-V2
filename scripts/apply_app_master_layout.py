"""
Wrap module pages with app-master-body (sidebar #navSlot + main content) for pilot visual parity.
Skips login, admin-users (own shell), purchase-order-print.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public"
SKIP = frozenset({"login.html", "admin-users.html", "purchase-order-print.html"})

OPEN_PAT = re.compile(
    r'(<div id="globalNavSlot"></div>\s*)<div id="navSlot"></div>',
    re.MULTILINE,
)

SCRIPT_START = re.compile(r"\n  <script\b")


def insert_main_closers(before_scripts: str) -> str:
    lines = before_scripts.split("\n")
    insert_at = None
    for i in range(len(lines) - 1, -1, -1):
        if lines[i] == "  </div>":
            insert_at = i
            break
    if insert_at is None:
        raise ValueError("no container close")
    lines.insert(insert_at, "      </main>")
    lines.insert(insert_at + 1, "    </div>")
    return "\n".join(lines)


def process(path: Path) -> bool:
    if path.name in SKIP:
        return False
    text = path.read_text(encoding="utf-8", errors="replace").replace("\r\n", "\n")
    if "app-master-body" in text:
        return False
    if 'id="globalNavSlot"' not in text or 'id="navSlot"' not in text:
        return False

    new_text, n = OPEN_PAT.subn(
        r'\1<div class="app-master-body">\n'
        r'      <aside class="app-master-sidebar">\n'
        r'        <div id="navSlot" class="app-master-subtabs"></div>\n'
        r'      </aside>\n'
        r'      <main class="app-master-main">',
        text,
        count=1,
    )
    if n == 0:
        print("skip (pattern):", path.name)
        return False
    text = new_text

    m = SCRIPT_START.search(text)
    if not m:
        print("skip (no script):", path.name)
        return False
    before = text[: m.start()]
    after = text[m.start() :]
    try:
        before = insert_main_closers(before)
    except ValueError:
        print("skip (close):", path.name)
        return False
    text = before + after

    if "app-master-page" not in text:
        text = text.replace('class="app-shell"', 'class="app-shell app-master-page"', 1)

    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    for p in sorted(ROOT.glob("*.html")):
        if process(p):
            print("ok", p.name)


if __name__ == "__main__":
    main()
