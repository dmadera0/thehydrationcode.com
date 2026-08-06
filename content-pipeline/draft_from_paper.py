#!/usr/bin/env python3
"""
The Hydration Code — draft pipeline.

Reads a PDF from content-pipeline/inbox/, verifies its DOI is real and not
retracted, sends the full text to Claude with the article production spec,
extracts and programmatically verifies its major claims against the paper's
own text, then commits the draft (article, hero image, verification report)
onto a draft/<slug> branch and opens a pull request against main for human
review. Nothing is ever written directly to main and nothing is auto-merged.

Run:  python content-pipeline/draft_from_paper.py
Requires a clean git working tree and an authenticated `gh` CLI.
"""

import os
import re
import sys
import glob
import json
import shutil
import hashlib
import subprocess
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
IMAGES_DIR = ROOT / "src" / "assets" / "images" / "posts"
VERIFICATION_DIR = ROOT / "content-pipeline" / "verification"

# Registry of Pexels photo IDs already used as a hero image, so future runs
# can skip a duplicate without downloading it first. Images saved before this
# registry existed were never tagged with their source photo ID, so there's
# no way to backfill it for them — that's fine, because the registry is only
# a fast first-pass check. The real dedup mechanism (see fetch_hero_image) is
# a content-hash comparison against every file already in IMAGES_DIR, which
# catches duplicates of ANY existing image, registry or not.
USED_IMAGES_REGISTRY = ROOT / "content-pipeline" / "used_images.json"

PILLARS = ["science-of-plastic", "why-glass-matters", "health-optimization"]
MODEL = "claude-opus-4-8"
BASE_BRANCH = "main"

load_dotenv(ROOT / "content-pipeline" / ".env")
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
if not API_KEY:
    sys.exit("ERROR: ANTHROPIC_API_KEY not found in content-pipeline/.env")
PEXELS_KEY = os.environ.get("PEXELS_API_KEY")
if not PEXELS_KEY:
    sys.exit("ERROR: PEXELS_API_KEY not found in content-pipeline/.env")


def run_git(*args, check=True):
    return subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=check
    )


def ensure_clean_working_tree():
    result = run_git("status", "--porcelain")
    if result.stdout.strip():
        sys.exit(
            "Working tree is not clean (uncommitted changes present). This "
            "pipeline creates a draft branch and commits onto it — commit or "
            "stash your changes first, then rerun.\n\n" + result.stdout
        )


def ensure_gh_ready():
    if shutil.which("gh") is None:
        sys.exit(
            "GitHub CLI ('gh') is not installed. Install it (e.g. `brew "
            "install gh`) and run `gh auth login` before running this "
            "pipeline."
        )
    result = subprocess.run(
        ["gh", "auth", "status"], capture_output=True, text=True
    )
    if result.returncode != 0:
        sys.exit(
            "GitHub CLI is not authenticated. Run `gh auth login` before "
            "running this pipeline."
        )


def current_branch():
    return run_git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()


def branch_exists_locally(branch):
    result = run_git(
        "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}", check=False
    )
    return result.returncode == 0


def branch_exists_remotely(branch):
    result = run_git("ls-remote", "--heads", "origin", branch)
    return bool(result.stdout.strip())


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


def extract_claims(client, article_body, paper_text):
    """Ask the model for the article's load-bearing claims, each paired with a
    verbatim-quoted supporting sentence from the paper. Raises on any failure —
    caller decides how to degrade gracefully."""
    prompt = f"""Below is a drafted article and the full text of the paper it
is based on.

Identify the article's 5-10 most specific, load-bearing factual claims
(numbers, named effects, strong statements) and for each, find the EXACT
sentence or phrase in the paper's full text that supports it.

The supporting_quote MUST be copied character-for-character from the paper
text below — not reworded, not summarized, not paraphrased — because it will
be checked programmatically as a literal substring match. If a claim in the
article does not have a verbatim-findable supporting sentence in the paper
text, do NOT include that claim in the list — a human will review it
directly instead.

Output ONLY a JSON array, no commentary, no markdown code fences, in this
exact shape:
[{{"claim": "short paraphrase of the claim as it appears in the article", "supporting_quote": "exact verbatim text from the paper"}}]

ARTICLE:
<article>
{article_body}
</article>

PAPER FULL TEXT:
<paper>
{paper_text[:120000]}
</paper>"""
    resp = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    text = re.sub(r"^```(json)?\n", "", text)
    text = re.sub(r"\n```$", "", text)
    claims = json.loads(text)
    if not isinstance(claims, list):
        raise ValueError("model did not return a JSON array")
    return claims


def normalize_for_match(s):
    return re.sub(r"\s+", " ", s).strip().lower()


def verify_claims(claims, paper_text):
    """Deterministic check: does each claim's supporting_quote actually appear
    in the paper's extracted text? No model call — this is the real check."""
    normalized_paper = normalize_for_match(paper_text)
    results = []
    for c in claims:
        claim = str(c.get("claim", "")).strip()
        quote = str(c.get("supporting_quote", "")).strip()
        if not claim or not quote:
            continue
        found = normalize_for_match(quote) in normalized_paper
        results.append(
            {"claim": claim, "quote": quote, "status": "VERIFIED" if found else "NOT FOUND"}
        )
    return results


def build_verification_md(meta, article_title, results, claims_error=None):
    lines = [f"# Verification report — {article_title}", ""]
    lines.append(
        f"Source: {meta['title']} — {meta['journal']}, {meta['year']} — "
        f"DOI: {meta['doi']}"
    )
    lines.append("Verified real via Crossref: yes (not retracted)")
    lines.append("")
    lines.append("## Claims checked against source text")
    lines.append("")

    if claims_error:
        lines.append(
            f"Automated claim verification could not run ({claims_error}). "
            f"All claims in this article require manual verification against "
            f"the source PDF before merging."
        )
        return "\n".join(lines) + "\n"

    if not results:
        lines.append(
            "No auto-checkable claims were extracted. All claims in this "
            "article require manual verification against the source PDF "
            "before merging."
        )
        return "\n".join(lines) + "\n"

    lines.append("| # | Claim | Status | Supporting quote |")
    lines.append("|---|---|---|---|")
    for i, r in enumerate(results, 1):
        claim_cell = r["claim"].replace("|", "\\|").replace("\n", " ")
        quote_cell = r["quote"].replace("|", "\\|").replace("\n", " ")
        lines.append(f'| {i} | {claim_cell} | {r["status"]} | "{quote_cell}" |')

    verified = sum(1 for r in results if r["status"] == "VERIFIED")
    lines.append("")
    lines.append(
        f"{verified} of {len(results)} claims auto-verified. Any NOT FOUND or "
        f"any claim not listed here needs manual verification against the "
        f"source PDF before merging."
    )
    return "\n".join(lines) + "\n"


def ensure_dependencies_installed():
    """Run `pnpm install` only if node_modules is missing or older than the
    lockfile — reuse the existing install otherwise so the build check stays
    fast on every normal run."""
    node_modules = ROOT / "node_modules"
    lockfile = ROOT / "pnpm-lock.yaml"
    stale = (
        not node_modules.exists()
        or (lockfile.exists() and lockfile.stat().st_mtime > node_modules.stat().st_mtime)
    )
    if not stale:
        return
    print("node_modules missing or older than pnpm-lock.yaml — running pnpm install...")
    result = subprocess.run(
        ["pnpm", "install"], cwd=ROOT, capture_output=True, text=True
    )
    if result.returncode != 0:
        sys.exit(
            "pnpm install failed — cannot run the build check. Output:\n\n"
            + result.stdout + result.stderr
        )


def run_build_check():
    """Build the site with the draft's files present, exactly as Amplify
    would. Returns (passed: bool, output: str)."""
    print("Running build check (pnpm build) against the draft branch...")
    ensure_dependencies_installed()
    result = subprocess.run(
        ["pnpm", "build"], cwd=ROOT, capture_output=True, text=True
    )
    output = result.stdout + result.stderr
    return result.returncode == 0, output


def load_used_image_ids():
    if not USED_IMAGES_REGISTRY.exists():
        return set()
    try:
        return set(json.loads(USED_IMAGES_REGISTRY.read_text()))
    except (json.JSONDecodeError, ValueError):
        return set()


def save_used_image_ids(ids):
    USED_IMAGES_REGISTRY.write_text(json.dumps(sorted(ids), indent=2) + "\n")


def existing_image_hashes(exclude_slug):
    """SHA-256 of every hero image already on disk, keyed by hash, so a fresh
    download can be checked for duplicates regardless of where the existing
    file came from. Excludes this article's own slug — on an overwrite run,
    that file is expected to match whatever gets downloaded for it."""
    hashes = {}
    if not IMAGES_DIR.exists():
        return hashes
    exclude_name = f"{exclude_slug}.jpg"
    for path in IMAGES_DIR.glob("*.jpg"):
        if path.name == exclude_name:
            continue
        hashes[hashlib.sha256(path.read_bytes()).hexdigest()] = path
    return hashes


def fetch_hero_image(keywords, slug):
    """Search Pexels for a landscape photo matching the keywords, download it
    — skipping any candidate that duplicates a hero image already on the
    site. Content hash is checked against every existing file (catches any
    duplicate, however it got there); the Pexels photo ID is checked against
    used_images.json first as a cheap way to skip an already-used photo
    without downloading it."""
    query = " ".join(keywords[:3]) if keywords else "glass water bottle"
    print(f"Searching Pexels for: {query}")
    r = requests.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": PEXELS_KEY},
        params={"query": query, "orientation": "landscape", "per_page": 10, "size": "large"},
        timeout=30,
    )
    if r.status_code != 200:
        print(f"  Pexels search failed (status {r.status_code}). Leaving placeholder path.")
        return None
    photos = r.json().get("photos", [])
    if not photos:
        print("  No Pexels results. Leaving placeholder path.")
        return None

    used_ids = load_used_image_ids()
    existing_hashes = existing_image_hashes(slug)
    dest = IMAGES_DIR / f"{slug}.jpg"
    dest.parent.mkdir(parents=True, exist_ok=True)

    # Best duplicate found so far, kept only in case every candidate turns
    # out to be a repeat and we have to fall back to one of them. Preferring
    # the one whose on-disk match is oldest (least recently reused) keeps a
    # forced repeat as unobtrusive as possible.
    fallback = None  # (photo, content_bytes, matched_file_mtime)
    first_unchecked = None  # (photo, content_bytes) — first ID-only skip, downloaded lazily

    for i, photo in enumerate(photos):
        photo_id = photo.get("id")
        if photo_id in used_ids:
            if first_unchecked is None:
                first_unchecked = (photo, None)
            continue

        img_url = photo["src"]["large2x"]
        content = requests.get(img_url, timeout=60).content
        content_hash = hashlib.sha256(content).hexdigest()
        matched_path = existing_hashes.get(content_hash)

        if matched_path is None:
            dest.write_bytes(content)
            used_ids.add(photo_id)
            save_used_image_ids(used_ids)
            print(f"  Image saved: {dest.relative_to(ROOT)} (Pexels result #{i + 1})")
            print(f"  Photo by {photo.get('photographer','?')} on Pexels")
            return dest

        mtime = matched_path.stat().st_mtime
        if fallback is None or mtime < fallback[2]:
            fallback = (photo, content, mtime)

    if fallback is None and first_unchecked is not None:
        photo, _ = first_unchecked
        content = requests.get(photo["src"]["large2x"], timeout=60).content
        fallback = (photo, content, 0)

    if fallback is None:
        print("  No usable Pexels results. Leaving placeholder path.")
        return None

    photo, content, _ = fallback
    print(
        f"  All top Pexels results for '{query}' are already in use on the "
        f"site. Using a repeat image — consider a more specific search "
        f"query or manually replacing this image later."
    )
    dest.write_bytes(content)
    used_ids.add(photo.get("id"))
    save_used_image_ids(used_ids)
    print(f"  Image saved: {dest.relative_to(ROOT)}")
    print(f"  Photo by {photo.get('photographer','?')} on Pexels")
    return dest

def main():
    ensure_clean_working_tree()
    ensure_gh_ready()

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
    branch = f"draft/{slug}"

    local_exists = branch_exists_locally(branch)
    remote_exists = branch_exists_remotely(branch)
    if local_exists or remote_exists:
        where = " and ".join(
            w for w, present in (("locally", local_exists), ("on origin", remote_exists)) if present
        )
        answer = input(
            f"A draft branch already exists at {branch} ({where}). Overwrite? (y/n) "
        ).strip().lower()
        if answer != "y":
            print(f"Kept existing branch: {branch}. No changes written.")
            return

    # ---- fit/validate the draft (all pure text transforms, no git yet) ----
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

    title_match = re.search(r'^title: "(.*)"$', draft, re.MULTILINE)
    article_title = title_match.group(1) if title_match else meta["title"]

    print("Extracting and verifying claims against the source paper...")
    claims_error = None
    results = []
    try:
        claims = extract_claims(client, draft, text)
        results = verify_claims(claims, text)
        verified_n = sum(1 for r in results if r["status"] == "VERIFIED")
        print(f"  {verified_n} of {len(results)} claims verified against paper text.")
    except Exception as e:
        claims_error = str(e)
        print(f"  WARNING: automated claim verification failed ({claims_error}).")
        print("  PR will note that all claims need manual review.")

    verification_md = build_verification_md(meta, article_title, results, claims_error)
    verification_path = VERIFICATION_DIR / f"{slug}-VERIFICATION.md"

    # ---- everything above is pure computation; from here on we touch git ----
    if current_branch() != BASE_BRANCH:
        print(f"Not on {BASE_BRANCH} (on {current_branch()}) — checking out {BASE_BRANCH} first.")
        run_git("checkout", BASE_BRANCH)

    print(f"Creating branch {branch}...")
    run_git("checkout", "-B", branch)

    VERIFICATION_DIR.mkdir(parents=True, exist_ok=True)
    out.write_text(draft)
    img = fetch_hero_image(keywords, slug)
    if not img:
        print(
            f"⚠  WARNING: Pexels image fetch failed. Frontmatter heroImage points "
            f"to src/assets/images/posts/{slug}.jpg, but that file was not "
            f"created. Add a commercially-licensed image there by hand before "
            f"merging — the build will fail on the missing file otherwise."
        )
    verification_path.write_text(verification_md)

    add_paths = [str(out), str(verification_path)]
    if img:
        add_paths.append(str(img))
    run_git("add", *add_paths)
    run_git("commit", "-m", f"draft: {article_title}")

    build_passed, build_output = run_build_check()
    if not build_passed:
        print(
            "Build check failed. This draft would break the live site if "
            "merged. Build output:\n\n" + build_output
        )
        run_git("checkout", BASE_BRANCH)
        run_git("branch", "-D", branch)
        sys.exit(
            "Build check failed — stopping. No branch was pushed and no PR "
            "was opened. The working tree is back on "
            f"{BASE_BRANCH} with the draft branch deleted."
        )
    print("Build check passed.")

    print(f"Pushing {branch} to origin...")
    push_args = ["push", "-u", "origin", branch]
    if remote_exists:
        push_args.append("--force")
    push_result = run_git(*push_args, check=False)
    if push_result.returncode != 0:
        print(f"git push failed:\n{push_result.stderr}")
        run_git("checkout", BASE_BRANCH)
        sys.exit(
            f"Push failed — see error above. The commit is on local branch "
            f"{branch}; fix the issue and push manually, or rerun."
        )

    pr_body = (
        f"Build check: passed\n\n"
        f"Source paper: {meta['title']} — {meta['journal']}, {meta['year']} "
        f"(DOI: {meta['doi']})\n\n"
        f"Review flagged claims before merging. Merging deploys automatically.\n\n"
        f"---\n\n"
        f"{verification_md}"
    )

    print("Opening pull request...")
    pr_create = subprocess.run(
        [
            "gh", "pr", "create",
            "--title", article_title,
            "--body", pr_body,
            "--base", BASE_BRANCH,
            "--head", branch,
        ],
        cwd=ROOT, capture_output=True, text=True,
    )
    pr_url = None
    if pr_create.returncode == 0:
        pr_url = pr_create.stdout.strip().splitlines()[-1] if pr_create.stdout.strip() else None
    else:
        existing = subprocess.run(
            ["gh", "pr", "view", branch, "--json", "url", "-q", ".url"],
            cwd=ROOT, capture_output=True, text=True,
        )
        if existing.returncode == 0 and existing.stdout.strip():
            pr_url = existing.stdout.strip()
            print(f"A PR already exists for {branch}: {pr_url}")
        else:
            print(f"gh pr create failed:\n{pr_create.stderr}")

    print(f"Checking out {BASE_BRANCH}...")
    run_git("checkout", BASE_BRANCH)

    PROCESSED.mkdir(exist_ok=True)
    pdf.rename(PROCESSED / pdf.name)

    needs = draft.count("NEEDS SOURCE")
    print("\n" + "=" * 60)
    print(f"BRANCH: {branch}")
    if pr_url:
        print(f"PR OPENED: {pr_url}")
    else:
        print(f"PR was NOT created — see the error above. {branch} is still")
        print("pushed to origin; open the PR manually.")
    print(f"Source PDF moved to: content-pipeline/processed/{pdf.name}")
    if needs:
        print(f"⚠  {needs} NEEDS SOURCE marker(s) — resolve before publishing.")
    if claims_error:
        print("⚠  Automated claim verification did not run — all claims need manual review.")
    print("\nNEXT: review the PR, especially any NOT FOUND claims in")
    print("VERIFICATION.md, before merging. Merging deploys automatically.")
    print("=" * 60)


if __name__ == "__main__":
    main()
