"""
Build the Lutherbibel 1912 (public domain) as the app's second translation,
in the same per-book format as the Menge-Bibel (see scripts/build-bibel.py),
so the reader can set the two side by side.

Source: eBible.org's USFM edition, https://eBible.org/Scriptures/deu1912_usfm.zip
— verses, paragraphs (\\p) and poetry lines (\\q1), with Strong's numbers
tagged on the words (\\w …|strong="…"\\w*), which are dropped here. The 1912
text carries no section headings; those came with later, copyrighted
revisions, so this translation has none.

Writes public/bibeltext/luther1912/<slug>.json — the slugs of
src/assets/bibel/index.json, so a chapter is the same address in both.

Usage:
    python scripts/build-luther.py <directory with the unzipped .usfm files>
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "src" / "assets" / "bibel" / "index.json"
OUT = ROOT / "public" / "bibeltext" / "luther1912"

# USFM book codes in canonical order — the order of the index.
CODES = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO "
    "ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL "
    "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB "
    "JAS 1PE 2PE 1JN 2JN 3JN JUD REV"
).split()

WORD = re.compile(r"\\w ([^|\\]*)(?:\|[^\\]*)?\\w\*")
MARKER = re.compile(r"\\(\w+)\s?(.*)$")


def clean(text: str) -> str:
    text = WORD.sub(r"\1", text)
    text = re.sub(r"\\\+?\w+\*?", "", text)  # any other inline marker
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", text)).strip()


def parse(path: Path) -> list[list[dict]]:
    chapters: list[list[dict]] = []
    para: list[dict] | None = None
    poetry = False

    def flush() -> None:
        nonlocal para, poetry
        if para:
            block: dict = {"p": para}
            if poetry:
                block["q"] = 1
            chapters[-1].append(block)
        para, poetry = None, False

    def add_line(segs: list) -> None:
        nonlocal para
        if para is None:
            para = []
        para.append({"s": segs})

    for raw in path.read_text(encoding="utf-8").splitlines():
        m = MARKER.match(raw.strip())
        if not m:
            continue
        tag, rest = m.group(1), m.group(2)
        if tag == "c":
            flush()
            chapters.append([])
        elif tag == "p":
            flush()
        elif tag.startswith("q"):
            # Each \q1 opens a poetry line; consecutive ones form one block.
            if para is not None and not poetry:
                flush()
            poetry = True
            if rest.strip():
                add_line([clean(rest)])
        elif tag == "v" and chapters:
            vm = re.match(r"(\d+)\s*(.*)$", rest)
            if not vm:
                continue
            segs: list = [{"v": int(vm.group(1))}]
            text = clean(vm.group(2))
            if text:
                segs.append(text)
            if poetry and para:
                para.append({"s": segs})
            else:
                add_line(segs)
    flush()
    return chapters


def main() -> None:
    source = Path(sys.argv[1])
    books = json.loads(INDEX.read_text(encoding="utf-8"))["books"]
    assert len(books) == len(CODES)
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    for book, code in zip(books, CODES):
        path = next(source.glob(f"*-{code}*.usfm"))
        chapters = parse(path)
        if len(chapters) != book["chapters"]:
            print(f"  {book['name']}: {len(chapters)} chapters (Menge: {book['chapters']})")
        target = OUT / f"{book['slug']}.json"
        target.write_text(
            json.dumps({"chapters": chapters}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        total += target.stat().st_size
    print(f"{len(books)} books → {OUT} ({total // 1024} KB)")


if __name__ == "__main__":
    main()
