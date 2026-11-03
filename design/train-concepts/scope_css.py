"""Scope a concept's stylesheet under [data-concept="x"] so three concepts can share one page."""
import re


def _split_top(sel: str):
    out, depth, cur = [], 0, ""
    for ch in sel:
        if ch == "(": depth += 1
        if ch == ")": depth -= 1
        if ch == "," and depth == 0:
            out.append(cur); cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip()]


def _scope_selector(s: str, scope: str) -> str:
    m = re.match(r"^:root((?::not\([^)]*\)|\[[^\]]*\])*)$", s)
    if m:
        return f":root{m.group(1)} {scope}" if m.group(1) else scope
    if s in ("html", "body"):
        return scope
    if s.startswith("body"):
        return scope + s[4:]
    if s == "*":
        return f"{scope} *"
    return f"{scope} {s}"


def scope_css(css: str, scope: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    out, i = [], 0
    while i < len(css):
        j = css.find("{", i)
        if j < 0:
            break
        head = css[i:j].strip()
        depth, k = 1, j + 1
        while depth:
            if css[k] == "{": depth += 1
            elif css[k] == "}": depth -= 1
            k += 1
        block = css[j + 1:k - 1]
        if head.startswith("@media") or head.startswith("@supports"):
            out.append(f"{head} {{\n{scope_css(block, scope)}\n}}")
        elif head.startswith("@"):
            out.append(f"{head} {{{block}}}")
        else:
            sels = ", ".join(_scope_selector(x, scope) for x in _split_top(head))
            out.append(f"{sels} {{{block}}}")
        i = k
    return "\n".join(out)
