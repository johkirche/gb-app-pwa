"""
Build the Lutherbibel 1912 (public domain) as the app's second translation,
in the same per-book format as the Menge-Bibel (see scripts/build-bibel.py),
so the reader can read in either.

Source: the Zefania XML edition "Luther 1912" (2022, www.toledot.info),
https://sourceforge.net/projects/zefania-sharp/files/Bibles/GER/Lutherbibel/Luther%201912/
— SF_2022-02-27_GER_LUTH1912_xml_220227.zip, marked "This Text is in the Public
Domain", in modern spelling. It keeps the German verse numbering of the
printed Lutherbibel (Johannes 10,11 "Ich bin der gute Hirte", the Psalm
superscriptions as verses of their own), which eBible.org's edition had
re-split to the English count; it differs from Menge in 7 chapters only.

The XML carries verses and nothing else: no paragraphs, no poetry lines, no
headings. The paragraphs and the poetry are borrowed from Menge, verse for
verse — the two translations share their numbering almost everywhere, and a
psalm set as running prose would read worse than one broken where Menge
breaks it. Section headings are Menge's own work, and are left out.

Writes public/bibeltext/luther1912/<slug>.json — the slugs of
src/assets/bibel/index.json, so a chapter is the same address in both.

Usage:
    python scripts/build-luther.py <SF_..._GER_LUTH1912_(LUTHER_1912).xml>
"""

from __future__ import annotations

import json
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "src" / "assets" / "bibel" / "index.json"
MENGE = ROOT / "public" / "bibeltext" / "menge"
OUT = ROOT / "public" / "bibeltext" / "luther1912"


def clean(text: str) -> str:
    return unicodedata.normalize("NFC", " ".join(text.split()))


def read_zefania(path: Path) -> dict[int, dict[int, dict[int, str]]]:
    """book number → chapter → verse → text."""
    bible: dict[int, dict[int, dict[int, str]]] = {}
    for book in ET.parse(path).getroot().iter("BIBLEBOOK"):
        chapters = bible.setdefault(int(book.get("bnumber")), {})
        for chapter in book.iter("CHAPTER"):
            verses = chapters.setdefault(int(chapter.get("cnumber")), {})
            for verse in chapter.iter("VERS"):
                text = clean("".join(verse.itertext()))
                if text:
                    verses[int(verse.get("vnumber"))] = text
    return bible


def menge_layout(blocks: list[dict]) -> list[tuple[bool, list[int]]]:
    """Menge's paragraphs as (poetry?, the verses that begin in it)."""
    layout = []
    for block in blocks:
        if "p" not in block:
            continue
        starts = [
            seg["v"]
            for line in block["p"]
            for seg in line["s"]
            if isinstance(seg, dict) and "v" in seg
        ]
        if starts:
            layout.append((bool(block.get("q")), starts))
    return layout


def chapter_blocks(verses: dict[int, str], layout: list[tuple[bool, list[int]]]) -> list[dict]:
    """Luther's verses in Menge's paragraphs; any verse Menge has no place for
    joins the paragraph of the verse before it."""
    home: dict[int, int] = {}
    for i, (_, starts) in enumerate(layout):
        for verse in starts:
            home.setdefault(verse, i)

    paragraphs: list[list[int]] = [[] for _ in layout] or [[]]
    current = 0
    for verse in sorted(verses):
        current = home.get(verse, current)
        paragraphs[current].append(verse)

    blocks = []
    for i, numbers in enumerate(paragraphs):
        if not numbers:
            continue
        poetry = layout[i][0] if i < len(layout) else False
        block: dict = {"p": [{"s": [{"v": v}, verses[v]]} for v in numbers]}
        if poetry:
            block["q"] = 1
        blocks.append(block)
    return blocks


def main() -> None:
    bible = read_zefania(Path(sys.argv[1]))
    books = json.loads(INDEX.read_text(encoding="utf-8"))["books"]
    assert len(bible) == len(books) == 66
    OUT.mkdir(parents=True, exist_ok=True)

    total = 0
    differing = []
    for number, book in enumerate(books, start=1):
        menge = json.loads((MENGE / f"{book['slug']}.json").read_text(encoding="utf-8"))["chapters"]
        luther = bible[number]
        if len(luther) != book["chapters"]:
            print(f"  {book['name']}: {len(luther)} chapters (Menge: {book['chapters']})")
        chapters = []
        for c in range(1, max(luther) + 1):
            layout = menge_layout(menge[c - 1]) if c <= len(menge) else []
            verses = luther.get(c, {})
            starts = {v for _, s in layout for v in s}
            if starts and set(verses) != starts:
                differing.append(f"{book['name']} {c}")
            chapters.append(chapter_blocks(verses, layout))
        target = OUT / f"{book['slug']}.json"
        target.write_text(
            json.dumps({"chapters": chapters}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        total += target.stat().st_size

    print(f"{len(books)} books → {OUT} ({total // 1024} KB)")
    print(f"{len(differing)} chapters number their verses unlike Menge: {', '.join(differing)}")


if __name__ == "__main__":
    main()
