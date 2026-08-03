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

load_dotenv(ROOT / "content-pipeline" / ".env")
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not API_KEY:
    sys.exit("ERROR: ANTHROPIC_API_KEY not found in content-pipeline/.env")


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

PAPER FULL TEXT:
<paper>
{paper_text[:120000]}
</paper>

Produce the complete .mdx file now."""


def slugify(title):
    s = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return "-".join(s.split("-")[:8]) or "untitled-draft"


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
        model="claude-haiku-4-5-20251001",
        max_tokens=8000,
        messages=[{"role": "user", "content": build_prompt(meta, text, load_spec())}],
    )
    draft = "".join(block.text for block in resp.content if block.type == "text").strip()
    draft = re.sub(r"^```(mdx|markdown)?\n", "", draft)
    draft = re.sub(r"\n```$", "", draft)

    slug = slugify(meta["title"])
    out = POSTS / f"{slug}.mdx"
    if out.exists():
        out = POSTS / f"{slug}-DRAFT.mdx"
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
    print("pillar, the hero image path (still a placeholder), and that every")
    print("claim traces to the paper. Then run `pnpm check` and `pnpm build`.")
    print("=" * 60)


if __name__ == "__main__":
    main()
