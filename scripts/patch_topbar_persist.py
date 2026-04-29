"""Add data-topbar-persist=\"1\" to topbar-right links and proc-top-print-wrap."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1] / "frontend" / "public"
SKIP = frozenset({"login.html", "admin-users.html", "purchase-order-print.html"})
OPEN = '<div class="topbar-right">'


def find_topbar_right_span(html: str) -> tuple[int, int] | None:
    start = html.find(OPEN)
    if start < 0:
        return None
    pos = start + len(OPEN)
    depth = 1
    while pos < len(html) and depth:
        d_o = html.find("<div", pos)
        d_c = html.find("</div>", pos)
        if d_c < 0:
            return None
        if d_o != -1 and d_o < d_c:
            depth += 1
            pos = d_o + 4
        else:
            depth -= 1
            pos = d_c + len("</div>")
    return start, pos


def patch_body(body: str) -> str:
    lines = body.split("\n")
    out = []
    for line in lines:
        s = line
        if "data-topbar-persist" in s:
            out.append(s)
            continue
        if "<a " in s and "version-btn" in s:
            s = s.replace("<a ", '<a data-topbar-persist="1" ', 1)
        if 'class="proc-top-print-wrap"' in s:
            s = s.replace(
                '<div class="proc-top-print-wrap"',
                '<div class="proc-top-print-wrap" data-topbar-persist="1"',
                1,
            )
        out.append(s)
    return "\n".join(out)


def main() -> None:
    for p in sorted(ROOT.glob("*.html")):
        if p.name in SKIP:
            continue
        t = p.read_text(encoding="utf-8")
        if "app-master-page" not in t:
            continue
        span = find_topbar_right_span(t)
        if not span:
            continue
        a, b = span
        full = t[a:b]
        if not full.startswith(OPEN):
            continue
        rest = full[len(OPEN) :]
        li = rest.rfind("</div>")
        if li < 0:
            continue
        body, tail = rest[:li], rest[li:]
        new_body = patch_body(body)
        if new_body == body:
            continue
        new_t = t[:a] + OPEN + new_body + tail + t[b:]
        p.write_text(new_t, encoding="utf-8")
        print("persist", p.name)


if __name__ == "__main__":
    main()
