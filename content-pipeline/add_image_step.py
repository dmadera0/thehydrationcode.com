import re
from pathlib import Path

p = Path("content-pipeline/draft_from_paper.py")
s = p.read_text()

# 1. Add PEXELS key loading after the Anthropic key check
if "PEXELS_API_KEY" not in s:
    s = s.replace(
        'if not API_KEY:\n    sys.exit("ERROR: ANTHROPIC_API_KEY not found in content-pipeline/.env")',
        'if not API_KEY:\n    sys.exit("ERROR: ANTHROPIC_API_KEY not found in content-pipeline/.env")\n'
        'PEXELS_KEY = os.environ.get("PEXELS_API_KEY")\n'
        'if not PEXELS_KEY:\n    sys.exit("ERROR: PEXELS_API_KEY not found in content-pipeline/.env")'
    )

# 2. Add the Pexels fetch function before def main()
if "def fetch_hero_image" not in s:
    fn = '''
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

'''
    s = s.replace("def main():", fn + "def main():")

# 3. In the prompt, ask Claude to append image keywords on a final line
s = s.replace(
    "Produce the complete .mdx file now.",
    "Produce the complete .mdx file now.\\n\\nAfter the .mdx, on a separate final "
    "line, output exactly:\\nIMAGE_KEYWORDS: three comma-separated search terms "
    "for a stock photo hero image (real photography, e.g. 'glass water bottle, "
    "clean, natural light')."
)

# 4. In main(), extract keywords, strip that line from the draft, fetch image, fix frontmatter path
s = s.replace(
    'draft = re.sub(r"\\n```$", "", draft)',
    'draft = re.sub(r"\\n```$", "", draft)\n\n'
    '    # Pull IMAGE_KEYWORDS off the end, if present\n'
    '    keywords = []\n'
    '    km = re.search(r"IMAGE_KEYWORDS:\\s*(.+)\\s*$", draft)\n'
    '    if km:\n'
    '        keywords = [k.strip() for k in km.group(1).split(",") if k.strip()]\n'
    '        draft = draft[:km.start()].rstrip()\n'
)

# 5. After slug is computed and file written, fetch image and rewrite heroImage path
s = s.replace(
    "    out.write_text(draft)\n",
    "    img = fetch_hero_image(keywords, slug)\n"
    "    if img:\n"
    "        # Point frontmatter heroImage at the real downloaded file\n"
    "        draft = re.sub(r'heroImage:.*', f'heroImage: \"../../assets/images/posts/{slug}.jpg\"', draft, count=1)\n"
    "    out.write_text(draft)\n"
)

p.write_text(s)
print("Script patched for Pexels image fetching.")
