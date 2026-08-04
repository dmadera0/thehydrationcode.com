#!/usr/bin/env python3
"""
The Hydration Code — Phase 1 draft pipeline.

Reads a PDF from content-pipeline/inbox/, verifies its DOI is real and not
retracted, sends the full text to Claude with the article production spec,
and writes a draft .mdx into src/content/posts/ for human review.

Run:  python content-pipeline/draft_from_paper.py
Stops at a local draft. No image, no PR, no publishing.
"""

import os
import re
import sys
import glob
import json
from pathlib import Path

import requests
from pypdf import PdfReader
from dotenv import load_dotenv
from anthropic import Anthropic

# ---- paths ----
ROOT = Path(__file__).resolve().parent.parent
INBOX = ROOT / "content-pipeline" / "inbox"
PROCESSED = ROOT / "content-pipeline" / "processed"
POSTS = ROOT / "src" / "content" / "posts"

PILLARS = ["science-of-plastic", "why-glass-matters", "health-optimization"]
MODEL = "claude-opus-4-8"

load_dotenv(ROOT / "content-pipeline" / ".env")
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not API_KEY:
    sys.exit("ERROR: ANTHROPIC_API_KEY not found in content-pipeline/.env")
PEXELS_KEY = os.environ.get("PEXELS_API_KEY")
if not PEXELS_KEY:
    sys.exit("ERROR: PEXELS_API_KEY not found in content-pipeline/.env")


def pick_pdf():
    pdfs = sorted(glob.glob(str(INBOX / "*.pdf")))
    if not pdfs:
        sys.exit(f"No PDF found in {INBOX}. Drop a paper there and rerun.")
    if len(pdfs) > 1:
        print("Multiple PDFs found. Using the first:")
        for p in pdfs:
            print("   ", Path(p).name)
    return Path(pdfs[0])


def extract_text(pdf_path):
    reader = PdfReader(str(pdf_path))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    text = re.sub(r"[ \t]+", " ", text)
    if len(text.strip()) < 500:
        sys.exit(
            "Extracted almost no text. This PDF may be a scan (image-only). "
            "Phase 1 needs a text-based PDF."
        )
    return text


def find_doi(text: str):
    # Standard DOI pattern. Takes the first match in the paper.
    m = re.search(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", text, re.IGNORECASE)
    if not m:
        return None
    return m.group(0).rstrip(".").rstrip(")")


def verify_doi(doi):
    """Confirm the DOI resolves via Crossref and check retraction signals."""
    url = f"https://api.crossref.org/works/{doi}"
    headers = {"User-Agent": "TheHydrationCode/1.0 (mailto:hello@thehydrationcode.com)"}
    r = requests.get(url, headers=headers, timeout=30)
    if r.status_code != 200:
        sys.exit(
            f"DOI {doi} did not resolve on Crossref (status {r.status_code}). "
            "Verification failed — stopping. Do not draft from an unverifiable paper."
        )
    msg = r.json()["message"]

    title = (msg.get("title") or ["(no title)"])[0]
    journal = (msg.get("container-title") or ["(unknown journal)"])[0]
    year = None
    for key in ("published-print", "published-online", "issued"):
        if msg.get(key, {}).get("date-parts"):
            year = msg[key]["date-parts"][0][0]
            break
    authors = []
    for a in msg.get("author", [])[:8]:
        name = " ".join(filter(None, [a.get("given"), a.get("family")]))
        if name:
            authors.append(name)

    type_ = msg.get("type", "")
    updates = msg.get("update-to", [])
    retracted = any(u.get("type") == "retraction" for u in updates)
    if retracted or "retract" in title.lower():
        sys.exit(
            f"Paper appears RETRACTED: {title}. Stopping. This must never be cited."
        )

    return {
        "doi": doi,
        "title": title,
        "journal": journal,
        "year": year,
        "authors": authors,
        "type": type_,
        "is_peer_reviewed_type": type_ in ("journal-article", "review", "proceedings-article"),
    }


def load_spec():
    spec = ROOT / "content-pipeline" / "ARTICLE_PRODUCTION_SPEC.md"
    if spec.exists():
        return spec.read_text()
    return "(Production spec not found — draft to standard Hydration Code conventions.)"


def build_prompt(meta, paper_text, spec):
    return f"""You are drafting an article for The Hydration Code, a faceless,
citation-first blog about microplastics and hydration science.

Follow this production spec exactly:

<production_spec>
{spec}
</production_spec>

VERIFIED SOURCE METADATA (confirmed real via Crossref — use these exact values
in the frontmatter `sources` entry for this paper):
- Title: {meta['title']}
- Journal: {meta['journal']}
- Year: {meta['year']}
- Authors: {', '.join(meta['authors']) or 'see paper'}
- DOI: {meta['doi']}

CRITICAL RULES:
- This article is built from ONE paper: the source above. Any claim you make
  must be supported by THIS paper's actual content, quoted or paraphrased from
  the text below.
- Do NOT introduce statistics, studies, or facts that are not in this paper.
  If the article would benefit from an external fact you cannot support from
  this text, insert the literal marker {{/* NEEDS SOURCE */}} instead.
- Choose the single best-fit pillar from: {', '.join(PILLARS)}.
- Output ONLY the complete .mdx file: frontmatter between --- fences, then the
  MDX body. No commentary before or after. No markdown code fences around it.
- The one required source in frontmatter is the paper above.
- Do not claim the site sells or makes any product.
- Do NOT include a <SourceList /> component anywhere in the body. It renders
  automatically from frontmatter `sources` at the end of the article. Placing
  it manually breaks the page.
- In frontmatter, set heroImage to the literal string "PLACEHOLDER" — do not
  invent a real file path. The pipeline fetches a real, licensed photo and
  sets the actual path automatically after you finish.

PAPER FULL TEXT:
<paper>
{paper_text[:120000]}
</paper>

Produce the complete .mdx file now.\n\nAfter the .mdx, on a separate final line, output exactly:\nIMAGE_KEYWORDS: three comma-separated search terms for a stock photo hero image (real photography, e.g. 'glass water bottle, clean, natural light')."""


def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return "-".join(s.split("-")[:8]) or "untitled-draft"


def word_boundary_trim(text, max_len):
    """Trim to max_len without cutting mid-word."""
    if len(text) <= max_len:
        return text
    trimmed = text[:max_len]
    last_space = trimmed.rfind(" ")
    if last_space > 0:
        trimmed = trimmed[:last_space]
    return trimmed.rstrip(" ,.;:-")


def regenerate_field(client, field, current_value, max_len, article_title):
    """Ask the model to rewrite ONE frontmatter field to fit under max_len chars."""
    prompt = (
        f"Rewrite ONLY the {field} for a blog article titled \"{article_title}\" "
        f"so it is at most {max_len} characters. Preserve its meaning and keep it "
        f"a real, compelling {field} — not a chopped-off fragment of the original.\n\n"
        f"Current {field} ({len(current_value)} chars):\n{current_value}\n\n"
        f"Output ONLY the rewritten {field} text. No quotes, no commentary, no "
        f"markdown fences."
    )
    resp = client.messages.create(
        model=MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    return text.strip().strip('"').strip()


def fit_field(client, draft, field, max_len, article_title):
    """If a frontmatter field exceeds max_len, regenerate it (max 2 tries), then
    fall back to a clean word-boundary trim. Never truncates mechanically first."""
    pattern = rf'^{re.escape(field)}: "(.*)"$'
    m = re.search(pattern, draft, re.MULTILINE)
    if not m:
        return draft
    value = m.group(1)
    if len(value) <= max_len:
        return draft

    for _ in range(2):
        before_len = len(value)
        value = regenerate_field(client, field, value, max_len, article_title)
        print(f"{field.capitalize()} was {before_len} chars, regenerated to {len(value)}.")
        if len(value) <= max_len:
            break

    if len(value) > max_len:
        trimmed = word_boundary_trim(value, max_len)
        print(
            f"WARNING: {field} still {len(value)} chars after 2 regeneration "
            f"attempts. Falling back to a word-boundary trim: \"{trimmed}\""
        )
        value = trimmed

    value = value.replace('"', "'").strip()
    return draft[: m.start()] + f'{field}: "{value}"' + draft[m.end() :]


def strip_manual_sourcelist(draft):
    """<SourceList /> auto-renders from frontmatter and must never be hand-placed
    in the body. If the model wrote one anyway, remove that line and say so."""
    pattern = re.compile(
        r"^[ \t]*<SourceList\s*/?>\s*(</SourceList>)?[ \t]*\n?", re.MULTILINE
    )
    new_draft, n = pattern.subn("", draft)
    if n:
        print(
            f"Removed {n} manually-placed <SourceList /> occurrence(s) — it "
            f"auto-renders from frontmatter and must not appear in the body."
        )
    return new_draft.rstrip() + "\n"


def warn_schema_issues(draft):
    """Cheap, read-only checks against src/content.config.ts. Warn, never mutate."""
    m = re.search(r'^pillar: "(.*)"$', draft, re.MULTILINE)
    if m and m.group(1) not in PILLARS:
        print(f"WARNING: pillar '{m.group(1)}' is not one of {PILLARS}.")

    m = re.search(r'^dek: "(.*)"$', draft, re.MULTILINE)
    if m and len(m.group(1)) < 50:
        print(f"WARNING: dek is only {len(m.group(1))} chars (schema minimum is 50).")

    m = re.search(r'^heroAlt: "(.*)"$', draft, re.MULTILINE)
    if m and len(m.group(1)) < 10:
        print(f"WARNING: heroAlt is only {len(m.group(1))} chars (schema minimum is 10).")

    has_sources = re.search(r"^sources:\s*\n[ \t]*-\s", draft, re.MULTILINE) or re.search(
        r"^sources:\s*\[.+\]", draft, re.MULTILINE
    )
    if not has_sources:
        print("WARNING: no sources entries found in frontmatter — schema requires at least one.")


def fetch_hero_image(keywords, slug):
    """Search Pexels for a landscape photo matching the keywords, download it."""
    query = " ".join(keywords[:3]) if keywords else "glass water bottle"
    print(f"Searching Pexels for: {query}")
    r = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": PEXELS_KEY},
        params={"query": query, "orientation": "landscape", "per_page": 5, "size": "large"},
        timeout=30,
    )
    if r.status_code != 200:
        print(f"  Pexels search failed (status {r.status_code}). Leaving placeholder path.")
        return None
    photos = r.json().get("photos", [])
    if not photos:
        print("  No Pexels results. Leaving placeholder path.")
        return None
    img_url = photos[0]["src"]["large2x"]
    dest = POSTS.parent.parent / "assets" / "images" / "posts" / f"{slug}.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)
    img = requests.get(img_url, timeout=60)
    dest.write_bytes(img.content)
    print(f"  Image saved: {dest.relative_to(ROOT)}")
    print(f"  Photo by {photos[0].get('photographer','?')} on Pexels")
    return dest

def main():
    pdf = pick_pdf()
    print(f"Reading: {pdf.name}")
    text = extract_text(pdf)

    doi = find_doi(text)
    if not doi:
        sys.exit(
            "No DOI found in the PDF text. Phase 1 verifies via DOI — cannot "
            "confirm this paper is real. Stopping. (Add the DOI to the paper "
            "or use a paper that includes one.)"
        )
    print(f"Found DOI: {doi}")
    print("Verifying against Crossref...")
    meta = verify_doi(doi)
    print(f"  VERIFIED: {meta['title']} — {meta['journal']}, {meta['year']}")
    if not meta["is_peer_reviewed_type"]:
        print(f"  WARNING: Crossref type is '{meta['type']}', not a standard "
              "journal article. Review carefully before publishing.")

    print("Drafting with Claude (this takes a minute)...")
    client = Anthropic(api_key=API_KEY)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": build_prompt(meta, text, load_spec())}],
    )
    draft = "".join(block.text for block in resp.content if block.type == "text").strip()
    draft = re.sub(r"^```(mdx|markdown)?\n", "", draft)
    draft = re.sub(r"\n```$", "", draft)

    # Pull IMAGE_KEYWORDS off the end, if present
    keywords = []
    km = re.search(r"IMAGE_KEYWORDS:\s*(.+)\s*$", draft)
    if km:
        keywords = [k.strip() for k in km.group(1).split(",") if k.strip()]
        draft = draft[:km.start()].rstrip()

    slug = slugify(meta["title"])
    out = POSTS / f"{slug}.mdx"
    if out.exists():
        answer = input(
            f"A draft already exists at {out.relative_to(ROOT)}. Overwrite? (y/n) "
        ).strip().lower()
        if answer != "y":
            print(f"Kept existing file: {out.relative_to(ROOT)}. No changes written.")
            return

    draft = fit_field(client, draft, "title", 70, meta["title"])
    draft = fit_field(client, draft, "dek", 165, meta["title"])
    draft = strip_manual_sourcelist(draft)
    warn_schema_issues(draft)

    # The model was told to emit a placeholder heroImage; the pipeline owns the
    # real path. Always point it at the slug-based file, whether or not the
    # Pexels fetch below actually succeeds in creating that file.
    draft = re.sub(
        r'heroImage:.*',
        f'heroImage: "../../assets/images/posts/{slug}.jpg"',
        draft,
        count=1,
    )
    img = fetch_hero_image(keywords, slug)
    if not img:
        print(
            f"⚠  WARNING: Pexels image fetch failed. Frontmatter heroImage points "
            f"to src/assets/images/posts/{slug}.jpg, but that file was not "
            f"created. Add a commercially-licensed image there by hand before "
            f"running `pnpm build` — the build will fail on the missing file "
            f"otherwise."
        )
    out.write_text(draft)

    PROCESSED.mkdir(exist_ok=True)
    pdf.rename(PROCESSED / pdf.name)

    needs = draft.count("NEEDS SOURCE")
    print("\n" + "=" * 60)
    print(f"DRAFT WRITTEN: {out.relative_to(ROOT)}")
    print(f"Source PDF moved to: content-pipeline/processed/{pdf.name}")
    if needs:
        print(f"⚠  {needs} NEEDS SOURCE marker(s) — resolve before publishing.")
    print("\nNEXT: read the draft critically. Confirm the frontmatter, the")
    print("pillar, the hero image, and that every claim traces to the paper.")
    print("Then run `pnpm check` and `pnpm build`.")
    print("=" * 60)


if __name__ == "__main__":
    main()
