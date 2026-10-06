"""
Build the app's Bible from the Menge-Bibel (1939), which is in the public
domain (gemeinfrei since 2010, per the Deutsche Bibelgesellschaft).

Source: the CC0 Markdown edition at https://github.com/renehamburger/Menge-Bibel
— Menge's own section headings, paragraphs, indented poetry and footnotes,
which the bare verse lists of other public-domain Bibles do not carry.

Writes:
  src/assets/bibel/index.json      the books: slug, name, title, group, chapters
  public/bibeltext/menge/<slug>.json   one file per book, fetched when opened

The Bible only. The passages the songs cite are not part of the app: they come
with the songs from Directus (see src/utils/bibelstellen.ts), built and
uploaded by gb-scripts.

Usage:
    git clone --depth 1 https://github.com/renehamburger/Menge-Bibel
    python scripts/build-bibel.py <Menge-Bibel dir>
"""

from __future__ import annotations

import html
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_OUT = ROOT / "src" / "assets" / "bibel" / "index.json"
BOOKS_OUT = ROOT / "public" / "bibeltext" / "menge"

TRANSLATION = "Menge-Bibel (1939)"

# Menge names a few books differently from the names the reference parser in
# gb-scripts (app/utils/bible_refs.py) produces; the app goes by the latter.
RENAME = {
    "Genesis": "1. Mose",
    "Exodus": "2. Mose",
    "Levitikus": "3. Mose",
    "Numeri": "4. Mose",
    "Deuteronomium": "5. Mose",
    "Psalmen": "Psalm",
    "Hoheslied": "Hohelied",
    "Zefanja": "Zephanja",
}

# The traditional division of the canon, by position within each Testament.
OT_GROUPS = [(17, "Geschichtsbücher"), (22, "Lehrbücher"), (39, "Propheten")]
NT_GROUPS = [(5, "Geschichtsbücher"), (26, "Briefe"), (27, "Offenbarung")]

FILE_NAME = re.compile(r"^(\d+) - (.+)\.md$")
CHAPTER = re.compile(r"^__(\d+)__$")
# Menge's outline runs five levels deep ("##### aa) Jakob am Brunnen …").
HEADING = re.compile(r"^(#{1,5}) (.+)$")
INLINE = re.compile(
    r"<sup>(\d+)</sup>"  # verse number
    r"|<sup title=\"([^\"]*)\">[^<]*</sup>"  # footnote
    r"|<span [^>]*class=\"fussnote\"[^>]*>[^<]*</span>"  # dangling footnote mark
    r"|<em>(.*?)</em>"  # italics (Psalm superscriptions and the like)
)
TAG = re.compile(r"<[^>]+>")


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def slugify(name: str) -> str:
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        name = name.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


# Menge sets the book titles in capitals. Back in sentence case, German keeps
# its articles and prepositions small after the first word.
SMALL_WORDS = {"an", "das", "dem", "den", "der", "des", "die", "nach", "und", "von", "zu"}


def book_title(title: str) -> str:
    if not title.isupper():
        return title
    words = title.lower().split()
    return " ".join(
        w if i and w in SMALL_WORDS else re.sub(r"^\W*\w", lambda m: m.group().upper(), w)
        for i, w in enumerate(words)
    )


def clean(text: str) -> str:
    return html.unescape(TAG.sub("", text))


def parse_inline(line: str) -> list:
    """Segments: "text" | {"v": n} | {"n": "note"} | {"e": "italic"}."""
    segs: list = []
    pos = 0

    def text(t: str) -> None:
        t = clean(t)
        if not t:
            return
        if segs and isinstance(segs[-1], str):
            segs[-1] += t
        else:
            segs.append(t)

    for m in INLINE.finditer(line):
        text(line[pos : m.start()])
        if m.group(1):
            segs.append({"v": int(m.group(1))})
        elif m.group(2) is not None:
            note = clean(m.group(2)).strip()
            if note and note != "?":
                segs.append({"n": note})
        elif m.group(3) is not None:
            segs.append({"e": clean(m.group(3))})
        pos = m.end()
    text(line[pos:])
    return segs


def parse_book(path: Path) -> tuple[str, list[list[dict]]]:
    """(full title, chapters) — each chapter a list of heading/paragraph blocks."""
    title = ""
    chapters: list[list[dict]] = []
    pending: list[dict] = []  # headings not yet placed: they belong to what follows
    para: list[dict] | None = None
    poetry = False
    indent = 0
    previous = ""

    def flush() -> None:
        nonlocal para, poetry
        if para:
            block: dict = {"p": para}
            if poetry:
                block["q"] = 1
            chapters[-1].extend(pending)
            pending.clear()
            chapters[-1].append(block)
        para, poetry = None, False

    for raw in path.read_text(encoding="utf-8").splitlines():
        line = nfc(raw.strip())
        if not line:
            flush()
            continue
        if m := HEADING.match(line):
            flush()
            level = len(m.group(1))
            if level == 1 and not title:
                title = clean(m.group(2)).strip()
            else:
                # The fifth level is set like the fourth: the reader styles
                # h2–h4, and on a phone a further step would not read as one.
                pending.append({"h": min(max(level, 2), 4), "t": clean(m.group(2)).strip()})
            continue
        if m := CHAPTER.match(line):
            # The source repeats a marker once (Daniel 11); that is no new chapter.
            if int(m.group(1)) == len(chapters):
                continue
            flush()
            chapters.append([])
            assert int(m.group(1)) == len(chapters), f"{path.name}: chapter {m.group(1)}"
            continue
        if line in ("<blockquote>", "<ul>"):
            indent += 1
            poetry = True
            continue
        if line in ("</blockquote>", "</ul>"):
            indent -= 1
            continue
        if not chapters:
            continue  # nothing before the first chapter but the title
        if line == previous:
            continue  # the source doubles a verse here and there (Daniel 11,3)
        previous = line
        segs = parse_inline(line)
        if not segs:
            continue
        if line.startswith("<li"):
            poetry = True
        entry: dict = {"s": segs}
        if indent:
            entry["i"] = indent
        para = para if para is not None else []
        para.append(entry)
    flush()
    if pending and chapters:
        chapters[-1].extend(pending)
    return title, chapters


# ----------------------------------------------------------------------- main


def main() -> None:
    source = Path(sys.argv[1]) / "Bibel"
    BOOKS_OUT.mkdir(parents=True, exist_ok=True)
    INDEX_OUT.parent.mkdir(parents=True, exist_ok=True)

    index = []
    total = 0
    for testament, folder, groups in (
        ("AT", "Altes Testament", OT_GROUPS),
        ("NT", "Neues Testament", NT_GROUPS),
    ):
        for path in sorted((source / folder).glob("*.md")):
            m = FILE_NAME.match(nfc(path.name))
            position, name = int(m.group(1)), m.group(2)
            name = RENAME.get(name, name)
            slug = slugify(name)
            title, chapters = parse_book(path)
            group = next(label for upto, label in groups if position <= upto)

            (BOOKS_OUT / f"{slug}.json").write_text(
                json.dumps({"chapters": chapters}, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            index.append(
                {
                    "slug": slug,
                    "name": name,
                    "title": book_title(title),
                    "testament": testament,
                    "group": group,
                    "chapters": len(chapters),
                }
            )
            total += (BOOKS_OUT / f"{slug}.json").stat().st_size

    INDEX_OUT.write_text(
        json.dumps({"translation": TRANSLATION, "books": index}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{len(index)} books → {BOOKS_OUT} ({total // 1024} KB)")


if __name__ == "__main__":
    main()
