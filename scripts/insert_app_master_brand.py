"""Insert pilot brand block after <div class=\"topbar dashboard-topbar\"> on app-master pages."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public"
SKIP = frozenset({"login.html", "admin-users.html", "purchase-order-print.html"})
OPEN = '<div class="topbar dashboard-topbar">'
BRAND = (
    "\n"
    '      <div class="app-master-brand" aria-label="Brand">\n'
    '        <span class="app-master-logo">AHK</span>\n'
    '        <strong>Fabrika ERP V2</strong>\n'
    "      </div>\n"
)


def main() -> None:
    for p in sorted(ROOT.glob("*.html")):
        if p.name in SKIP:
            continue
        t = p.read_text(encoding="utf-8")
        if "app-master-page" not in t or "app-master-brand" in t:
            continue
        if OPEN not in t:
            continue
        t = t.replace(OPEN, OPEN + BRAND, 1)
        p.write_text(t, encoding="utf-8")
        print("brand", p.name)


if __name__ == "__main__":
    main()
