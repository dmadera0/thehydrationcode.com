/**
 * Builds the SVG rasterized into every auto-generated OG image. This runs at
 * build time outside any component's CSS cascade, so the brand colors below
 * are literal values rather than var(--color-*) references — they mirror the
 * tokens in src/styles/global.css and must be kept in sync with them by hand.
 */
const BRAND_GREEN = '#1A6B4D';
const SURFACE = '#FFFFFF';

const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function buildOgSvg(title: string, kicker: string): string {
  const lines = wrapLines(title, 26);
  const lineHeight = 68;
  const blockHeight = lines.length * lineHeight;
  const startY = HEIGHT / 2 - blockHeight / 2 + lineHeight * 0.75;

  const titleTspans = lines
    .map((line, i) => `<tspan x="80" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="${BRAND_GREEN}" />
    <text x="80" y="110" font-family="sans-serif" font-size="26" font-weight="700" fill="${SURFACE}" letter-spacing="3">${escapeXml(kicker.toUpperCase())}</text>
    <text font-family="sans-serif" font-size="54" font-weight="700" fill="${SURFACE}">${titleTspans}</text>
  </svg>`;
}
