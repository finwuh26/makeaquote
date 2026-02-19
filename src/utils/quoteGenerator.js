'use strict';

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// ─── Canvas dimensions ───────────────────────────────────────────────────────
const WIDTH       = 1200;
const HEIGHT      = 630;
const PADDING     = 60;
const CARD_MARGIN = 10; // inset from PADDING for the decorative card background
const AVATAR_SIZE = 80;

// ─── Theme definitions ────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    background: '#1a1a2e',
    secondBackground: '#16213e',
    textColor: '#eaeaea',
    quoteColor: '#ffffff',
    accentDefault: '#5865F2',
    mutedColor: '#aaaaaa',
    quoteMarkColor: 'rgba(255,255,255,0.08)',
    gradientStart: '#1a1a2e',
    gradientEnd: '#0f3460',
  },
  light: {
    background: '#f5f5f5',
    secondBackground: '#ffffff',
    textColor: '#333333',
    quoteColor: '#111111',
    accentDefault: '#5865F2',
    mutedColor: '#777777',
    quoteMarkColor: 'rgba(0,0,0,0.06)',
    gradientStart: '#e8eaf6',
    gradientEnd: '#c5cae9',
  },
  midnight: {
    background: '#0d0d0d',
    secondBackground: '#1a1a1a',
    textColor: '#cccccc',
    quoteColor: '#ffffff',
    accentDefault: '#7289DA',
    mutedColor: '#888888',
    quoteMarkColor: 'rgba(255,255,255,0.05)',
    gradientStart: '#0d0d0d',
    gradientEnd: '#1a1a1a',
  },
  ocean: {
    background: '#0a192f',
    secondBackground: '#112240',
    textColor: '#ccd6f6',
    quoteColor: '#e6f1ff',
    accentDefault: '#64ffda',
    mutedColor: '#8892b0',
    quoteMarkColor: 'rgba(100,255,218,0.08)',
    gradientStart: '#0a192f',
    gradientEnd: '#020c1b',
  },
  sunset: {
    background: '#2d1b33',
    secondBackground: '#3d2244',
    textColor: '#f0c0d0',
    quoteColor: '#ffffff',
    accentDefault: '#ff7eb3',
    mutedColor: '#c090a0',
    quoteMarkColor: 'rgba(255,126,179,0.10)',
    gradientStart: '#2d1b33',
    gradientEnd: '#1a0a20',
  },
  forest: {
    background: '#1a2f1a',
    secondBackground: '#223322',
    textColor: '#d4e8c4',
    quoteColor: '#f0ffe0',
    accentDefault: '#4caf50',
    mutedColor: '#88aa88',
    quoteMarkColor: 'rgba(76,175,80,0.10)',
    gradientStart: '#1a2f1a',
    gradientEnd: '#0d1a0d',
  },
};

const VALID_THEMES = Object.keys(THEMES);
const VALID_FONTS = ['serif', 'sans-serif', 'monospace'];

/**
 * Wrap text to fit within maxWidth, returning an array of lines.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    // Handle explicit newlines in the source text
    const parts = word.split('\n');
    for (let i = 0; i < parts.length; i++) {
      const candidate = current ? `${current} ${parts[i]}` : parts[i];
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = parts[i];
      } else {
        current = candidate;
      }
      if (i < parts.length - 1) {
        lines.push(current);
        current = '';
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Draw a rounded rectangle path.
 * @param {CanvasRenderingContext2D} ctx
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw a circular avatar from a URL.  Falls back to a coloured initial if the
 * image cannot be fetched.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string|null} avatarUrl
 * @param {string} fallbackInitial
 * @param {string} accentColor
 * @param {number} x
 * @param {number} y
 * @param {number} size
 */
async function drawAvatar(ctx, avatarUrl, fallbackInitial, accentColor, x, y, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.drawImage(img, x, y, size, size);
    } catch {
      drawInitialFallback(ctx, fallbackInitial, accentColor, x, y, size);
    }
  } else {
    drawInitialFallback(ctx, fallbackInitial, accentColor, x, y, size);
  }

  ctx.restore();

  // Avatar border ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawInitialFallback(ctx, initial, accentColor, x, y, size) {
  ctx.fillStyle = accentColor;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.45}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((initial || '?').toUpperCase().charAt(0), x + size / 2, y + size / 2);
}

/**
 * Parse a hex color or return a fallback.
 * @param {string} color
 * @param {string} fallback
 * @returns {string}
 */
function safeColor(color, fallback) {
  if (!color) return fallback;
  const clean = color.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean) ? clean : fallback;
}

/**
 * Generate a quote image and return a PNG Buffer.
 *
 * @param {Object} opts
 * @param {string}  opts.text         - The quote body
 * @param {string}  opts.authorName   - Display name of the author
 * @param {string|null} opts.avatarUrl - Avatar URL (may be null)
 * @param {string}  opts.theme        - One of VALID_THEMES
 * @param {string}  opts.accentColor  - Hex accent colour
 * @param {string}  opts.font         - One of VALID_FONTS
 * @param {boolean} opts.showTimestamp
 * @param {boolean} opts.showServer
 * @param {string|null} opts.serverName
 * @param {string|null} opts.channelName
 * @param {string|null} opts.timestamp - ISO timestamp string
 * @param {string|null} opts.quotedBy  - Name of the person who created the quote
 * @returns {Promise<Buffer>}
 */
async function generateQuoteImage(opts) {
  const {
    text,
    authorName,
    avatarUrl = null,
    theme = 'dark',
    accentColor: rawAccent,
    font = 'serif',
    showTimestamp = true,
    showServer = true,
    serverName = null,
    channelName = null,
    timestamp = null,
    quotedBy = null,
  } = opts;

  const t = THEMES[VALID_THEMES.includes(theme) ? theme : 'dark'];
  const accent = safeColor(rawAccent, t.accentDefault);
  const fontFamily = VALID_FONTS.includes(font) ? font : 'serif';

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // ── Background gradient ────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, t.gradientStart);
  grad.addColorStop(1, t.gradientEnd);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Decorative card ────────────────────────────────────────────────────────
  ctx.save();
  const cardX = PADDING - CARD_MARGIN;
  const cardW = WIDTH  - cardX * 2;
  const cardH = HEIGHT - cardX * 2;
  roundRect(ctx, cardX, cardX, cardW, cardH, 20);
  ctx.fillStyle = t.secondBackground + 'cc'; // slight transparency
  ctx.fill();
  ctx.restore();

  // ── Accent left bar ────────────────────────────────────────────────────────
  ctx.fillStyle = accent;
  ctx.fillRect(PADDING, PADDING, 5, HEIGHT - PADDING * 2);

  // ── Giant decorative quotation mark ───────────────────────────────────────
  ctx.save();
  ctx.font = `bold 280px ${fontFamily}`;
  ctx.fillStyle = t.quoteMarkColor;
  ctx.textBaseline = 'top';
  ctx.fillText('\u201C', PADDING + 20, PADDING - 40);
  ctx.restore();

  // ── Quote text ─────────────────────────────────────────────────────────────
  const textAreaLeft = PADDING + 30;
  const textAreaRight = WIDTH - PADDING - 20;
  const textAreaWidth = textAreaRight - textAreaLeft;

  // Dynamic font sizing: start large and shrink to fit
  let fontSize = 52;
  let lines = [];
  while (fontSize >= 22) {
    ctx.font = `italic ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, `\u201C${text}\u201D`, textAreaWidth);
    const totalHeight = lines.length * (fontSize * 1.35);
    if (totalHeight <= HEIGHT - PADDING * 2 - 180) break;
    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.35;
  const textBlockHeight = lines.length * lineHeight;

  // Vertically centre the quote text in the upper portion of the card
  const textStartY = (HEIGHT - 160) / 2 - textBlockHeight / 2 + PADDING / 2;

  ctx.font = `italic ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = t.quoteColor;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  lines.forEach((line, i) => {
    ctx.fillText(line, textAreaLeft, textStartY + i * lineHeight);
  });

  // ── Author row ─────────────────────────────────────────────────────────────
  const authorY = HEIGHT - PADDING - AVATAR_SIZE;
  await drawAvatar(ctx, avatarUrl, authorName, accent, PADDING + 20, authorY, AVATAR_SIZE);

  const authorTextX = PADDING + 20 + AVATAR_SIZE + 18;

  ctx.fillStyle = t.textColor;
  ctx.font = `bold 26px ${fontFamily}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(`— ${authorName}`, authorTextX, authorY + AVATAR_SIZE * 0.38);

  // Muted sub-line: server / channel / timestamp
  const subParts = [];
  if (showServer && serverName) subParts.push(`${serverName}${channelName ? ` #${channelName}` : ''}`);
  if (showTimestamp && timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d)) {
      subParts.push(d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }));
    }
  }
  if (subParts.length) {
    ctx.fillStyle = t.mutedColor;
    ctx.font = `18px ${fontFamily}`;
    ctx.fillText(subParts.join(' · '), authorTextX, authorY + AVATAR_SIZE * 0.72);
  }

  // ── "Quoted by" badge ──────────────────────────────────────────────────────
  if (quotedBy) {
    const badge = `Quoted by ${quotedBy}`;
    ctx.font = `15px ${fontFamily}`;
    const bw = ctx.measureText(badge).width + 20;
    const bh = 26;
    const bx = WIDTH - PADDING - bw - 10;
    const by = HEIGHT - PADDING - bh - 5;
    roundRect(ctx, bx, by, bw, bh, 6);
    ctx.fillStyle = accent + '33';
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(badge, bx + bw / 2, by + bh / 2);
  }

  // ── Thin accent bottom border ──────────────────────────────────────────────
  ctx.fillStyle = accent;
  ctx.fillRect(PADDING, HEIGHT - PADDING - 3, WIDTH - PADDING * 2, 3);

  return canvas.toBuffer('image/png');
}

module.exports = { generateQuoteImage, VALID_THEMES, VALID_FONTS };
