"""Assemble each concept into one self-contained page: dist/<concept>/index.html (+ the CV)."""
import base64
import shutil
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "shared"))
import content  # noqa: E402
from scope_css import scope_css  # noqa: E402

CONCEPTS = sys.argv[1:] or ["a", "b", "c"]


def build(cid: str) -> Path:
    cdir = ROOT / "concepts" / cid
    env = Environment(loader=FileSystemLoader([str(cdir), str(ROOT / "shared")]), autoescape=True,
                      trim_blocks=True, lstrip_blocks=True)
    def logo(pid: str) -> str:
        f = ROOT / "shared" / "logos" / f"{pid}.png"
        return "data:image/png;base64," + base64.b64encode(f.read_bytes()).decode() if f.exists() else ""
    env.globals["logo"] = logo
    def photo(name: str) -> str:
        f = ROOT / "shared" / "photos" / name
        mime = "image/png" if name.endswith(".png") else "image/jpeg"
        return f"data:{mime};base64," + base64.b64encode(f.read_bytes()).decode()
    env.globals["photo"] = photo
    tpl = env.get_template("page.html")
    html = tpl.render(
        c=content,
        css=(ROOT / "shared" / "now.css").read_text() + (ROOT / "shared" / "switcher.css").read_text() + (cdir / "style.css").read_text(),
        engine=(ROOT / "shared" / "engine.js").read_text(),
        render=(cdir / "render.js").read_text(),
    )
    out = ROOT / "dist" / cid
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html)
    shutil.copy(ROOT / "shared" / "Ahmad_Naeem_CV.pdf", out / "Ahmad_Naeem_CV.pdf")
    return out / "index.html"


def build_combined() -> Path:
    """All three concepts on one page with a theme switcher at the top."""
    env = Environment(loader=FileSystemLoader([str(ROOT / "concepts"), str(ROOT / "shared")]), autoescape=True,
                      trim_blocks=True, lstrip_blocks=True)
    env.globals["logo"] = lambda pid: (
        "data:image/png;base64," + base64.b64encode((ROOT / "shared" / "logos" / f"{pid}.png").read_bytes()).decode()
        if (ROOT / "shared" / "logos" / f"{pid}.png").exists() else "")
    env.globals["photo"] = lambda name: (
        ("data:image/png;base64," if name.endswith(".png") else "data:image/jpeg;base64,")
        + base64.b64encode((ROOT / "shared" / "photos" / name).read_bytes()).decode())
    now_css = (ROOT / "shared" / "now.css").read_text() + (ROOT / "shared" / "switcher.css").read_text()
    css = "\n".join(scope_css(now_css + (ROOT / "concepts" / c / "style.css").read_text(), f'[data-concept="{c}"]')
                    for c in "abc")
    html = env.get_template("combined.html").render(
        c=content, css=css,
        engine=(ROOT / "shared" / "engine.js").read_text(),
        renders=[(ROOT / "concepts" / c / "render.js").read_text() for c in "abc"],
    )
    out = ROOT / "dist" / "all"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html)
    shutil.copy(ROOT / "shared" / "Ahmad_Naeem_CV.pdf", out / "Ahmad_Naeem_CV.pdf")
    return out / "index.html"


if __name__ == "__main__":
    for cid in CONCEPTS:
        print("built", build(cid))
    if not sys.argv[1:]:
        print("built", build_combined())
