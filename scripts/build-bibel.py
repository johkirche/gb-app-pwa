"""
Build the app's Bible from the Menge-Bibel (1939), which is in the public
domain (gemeinfrei since 2010, per the Deutsche Bibelgesellschaft).

Source: the CC0 Markdown edition at https://github.com/renehamburger/Menge-Bibel
— Menge's own section headings, paragraphs, indented poetry and footnotes,
which the bare verse lists of other public-domain Bibles do not carry.

Writes:
  src/assets/bibel/index.json      the books: slug, name, title, group, chapters
  public/bibeltext/menge/<slug>.json   one file per book, fetched when opened
  src/assets/bibelstellen.json     the passages each song text cites, with their
                                   wording — see src/utils/bibelstellen.ts

The song references come from gb-scripts (14-ai-extract-metadata.py, checked by
17-verify-bible-references.py). Only what that check let through is carried:
every reference it judged `ok`, and the `suspect` ones whose cited passage the
model still confirmed.

Usage:
    git clone --depth 1 https://github.com/renehamburger/Menge-Bibel
    python scripts/build-bibel.py <Menge-Bibel dir> <ai_text_bible_check.json>
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
STELLEN_OUT = ROOT / "src" / "assets" / "bibelstellen.json"

TRANSLATION = "Menge-Bibel (1939)"

# A whole-chapter reference or a long range is a pointer, not a quotation: past
# this many verses the passage is named but its wording is not carried.
MAX_VERSES = 30

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


def verse_texts(chapters: list[list[dict]]) -> dict[int, dict[int, str]]:
    """chapter → verse → plain text, for quoting."""
    out: dict[int, dict[int, str]] = {}
    for c, blocks in enumerate(chapters, start=1):
        verses: dict[int, list[str]] = {}
        current = None
        for block in blocks:
            for line in block.get("p", []):
                for seg in line["s"]:
                    if isinstance(seg, dict) and "v" in seg:
                        current = seg["v"]
                        verses.setdefault(current, [])
                    elif current is not None:
                        if isinstance(seg, str):
                            verses[current].append(seg)
                        elif "e" in seg:
                            verses[current].append(seg["e"])
                if current is not None:
                    verses[current].append(" ")
        out[c] = {v: re.sub(r"\s+", " ", "".join(parts)).strip() for v, parts in verses.items()}
    return out


# ---------------------------------------------------------------- song quotes


def is_carried(result: dict) -> bool:
    if result.get("verdict") == "ok":
        return True
    if result.get("verdict") == "suspect":
        llm = next((s for s in result.get("steps", []) if s["step"] == "llm"), None)
        return bool(llm and llm["status"] == "pass")
    return False


def passage(chapters: dict[int, dict[int, str]], parsed: dict) -> list[list]:
    first, last = parsed["chapter"], parsed.get("end_chapter") or parsed["chapter"]
    start, end = parsed.get("start_verse"), parsed.get("end_verse")
    out = []
    for chap in range(first, last + 1):
        for v, text in sorted(chapters.get(chap, {}).items()):
            if start is not None and chap == first and v < start:
                continue
            if chap == last and start is not None:
                limit = end if end is not None else (start if first == last else None)
                if limit is not None and v > limit:
                    continue
            out.append([chap, v, text])
    return out


def title_key(title: str) -> str:
    title = nfc(title).replace("­", "").lower()
    return re.sub(r"[^\wäöüß]+", " ", title).strip()


def build_stellen(check_path: Path, texts: dict, slugs: dict) -> None:
    songs = json.loads(check_path.read_text(encoding="utf-8"))
    by_text: dict[str, list] = {}
    titles: dict[str, list[str]] = {}
    missing = 0
    for song in songs:
        refs, seen = [], set()
        for r in song.get("results", []):
            parsed = r.get("parsed")
            if not parsed or not is_carried(r):
                continue
            label = nfc(parsed["canonical"])
            book = nfc(parsed["book"])
            if label in seen or book not in texts:
                missing += label not in seen
                continue
            seen.add(label)
            verses = passage(texts[book], parsed)
            if not verses:
                missing += 1
                continue
            entry = {
                "ref": label,
                "note": nfc(r.get("note") or ""),
                # Where the reader opens: the book, chapter and first verse.
                "at": [slugs[book], verses[0][0], verses[0][1]],
            }
            if len(verses) <= MAX_VERSES:
                entry["verses"] = verses
            refs.append(entry)
        if refs:
            text_id = str(song["text_id"])
            by_text[text_id] = refs
            titles.setdefault(title_key(song.get("titel", "")), []).append(text_id)

    by_title = {k: ids[0] for k, ids in titles.items() if k and len(ids) == 1}
    STELLEN_OUT.write_text(
        json.dumps(
            {"translation": TRANSLATION, "byText": by_text, "byTitle": by_title},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    count = sum(len(v) for v in by_text.values())
    print(f"{count} song passages for {len(by_text)} texts → {STELLEN_OUT.name}")
    if missing:
        print(f"  {missing} references had no verses in the text and were left out")


# ----------------------------------------------------------------------- main


def main() -> None:
    source, check_path = Path(sys.argv[1]) / "Bibel", Path(sys.argv[2])
    BOOKS_OUT.mkdir(parents=True, exist_ok=True)
    INDEX_OUT.parent.mkdir(parents=True, exist_ok=True)

    index, texts, slugs = [], {}, {}
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
            texts[name] = verse_texts(chapters)
            slugs[name] = slug
            total += (BOOKS_OUT / f"{slug}.json").stat().st_size

    INDEX_OUT.write_text(
        json.dumps({"translation": TRANSLATION, "books": index}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{len(index)} books → {BOOKS_OUT} ({total // 1024} KB)")
    build_stellen(check_path, texts, slugs)


if __name__ == "__main__":
    main()
