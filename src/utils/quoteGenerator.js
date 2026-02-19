'use strict';

const { createCanvas, loadImage } = require('@napi-rs/canvas');

// ─── Canvas dimensions ───────────────────────────────────────────────────────
const WIDTH  = 1200;
const HEIGHT = 630;

// ─── Portrait panel constants ────────────────────────────────────────────────
// The quoted author's avatar fills the left PORTRAIT_W pixels (B&W, cover-fit).
// A horizontal gradient then fades from transparent → solid background colour,
// starting at FADE_FROM_X and completing at FADE_TO_X, giving the cinematic
// "photo fading into darkness" look.  All quote text lives in the right zone.
const PORTRAIT_W  = 440;   // width of the left avatar panel
const FADE_FROM_X = 200;   // gradient starts here (avatar still fully visible)
const FADE_TO_X   = 500;   // gradient fully opaque from here rightward
const TEXT_X      = 530;   // left edge of quote-text column
const TEXT_RIGHT  = 1150;  // right edge of quote-text column
const TEXT_MAX_W  = TEXT_RIGHT - TEXT_X;   // 620 px

// Without a portrait the full canvas width is used for text.
const TEXT_X_FULL      = 80;
const TEXT_MAX_W_FULL  = WIDTH - TEXT_X_FULL * 2;  // 1040 px

// ─── Theme definitions ────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    background:   '#111118',
    textColor:    '#eaeaea',
    quoteColor:   '#ffffff',
    accentDefault:'#5865F2',
    mutedColor:   '#888899',
  },
  light: {
    background:   '#f0f0f5',
    textColor:    '#222233',
    quoteColor:   '#111122',
    accentDefault:'#5865F2',
    mutedColor:   '#667788',
  },
  midnight: {
    background:   '#080808',
    textColor:    '#cccccc',
    quoteColor:   '#ffffff',
    accentDefault:'#7289DA',
    mutedColor:   '#666677',
  },
  ocean: {
    background:   '#050e1f',
    textColor:    '#ccd6f6',
    quoteColor:   '#e6f1ff',
    accentDefault:'#64ffda',
    mutedColor:   '#6677aa',
  },
  sunset: {
    background:   '#1a0a20',
    textColor:    '#f0c0d0',
    quoteColor:   '#ffffff',
    accentDefault:'#ff7eb3',
    mutedColor:   '#aa6677',
  },
  forest: {
    background:   '#0a180a',
    textColor:    '#d4e8c4',
    quoteColor:   '#f0ffe0',
    accentDefault:'#4caf50',
    mutedColor:   '#557755',
  },
};

const VALID_THEMES = Object.keys(THEMES);
const VALID_FONTS  = ['serif', 'sans-serif', 'monospace'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a 6-digit hex colour string into [r, g, b] integers.
 * Falls back to [0, 0, 0] on invalid input.
 */
function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return [0, 0, 0];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Return a validated hex colour, or the fallback if the input is invalid.
 */
function safeColor(color, fallback) {
  if (!color) return fallback;
  const clean = color.trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean) ? clean : fallback;
}

/**
 * Word-wrap `text` to fit within `maxWidth` pixels using the current canvas
 * font, honouring embedded newline characters.
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
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

// ─── Main generator ───────────────────────────────────────────────────────────

/**
 * Generate a cinematic quote image and return a PNG Buffer.
 *
 * Layout (with portrait):
 *   Left  – B&W author avatar (cover-fit), fades right into dark background
 *   Right – quote text (large italic), author attribution, "Quoted by" corner
 *
 * Layout (without portrait / showAvatar = false):
 *   Full-width background with centred quote text and attribution
 *
 * @param {Object}      opts
 * @param {string}      opts.text
 * @param {string}      opts.authorName
 * @param {string|null} opts.avatarUrl
 * @param {boolean}     [opts.showAvatar=true]
 * @param {string}      [opts.theme='dark']
 * @param {string}      [opts.accentColor]
 * @param {string}      [opts.font='serif']
 * @param {boolean}     [opts.showTimestamp=true]
 * @param {boolean}     [opts.showServer=true]
 * @param {string|null} [opts.serverName]
 * @param {string|null} [opts.channelName]
 * @param {string|null} [opts.timestamp]
 * @param {string|null} [opts.quotedBy]
 * @returns {Promise<Buffer>}
 */
async function generateQuoteImage(opts) {
  const {
    text,
    authorName,
    avatarUrl      = null,
    showAvatar     = true,
    theme          = 'dark',
    accentColor:   rawAccent,
    font           = 'serif',
    showTimestamp  = true,
    showServer     = true,
    serverName     = null,
    channelName    = null,
    timestamp      = null,
    quotedBy       = null,
  } = opts;

  const t          = THEMES[VALID_THEMES.includes(theme) ? theme : 'dark'];
  const accent     = safeColor(rawAccent, t.accentDefault);
  const fontFamily = VALID_FONTS.includes(font) ? font : 'serif';
  const [br, bg, bb] = hexToRgb(t.background);

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx    = canvas.getContext('2d');

  // ── 1. Solid background ────────────────────────────────────────────────────
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── 2. B&W portrait panel (left side) ─────────────────────────────────────
  const hasPortrait = showAvatar && !!avatarUrl;

  if (hasPortrait) {
    let portraitDrawn = false;

    try {
      const img = await loadImage(avatarUrl);

      // Cover-fit: fill PORTRAIT_W × HEIGHT, crop the source to the same ratio
      const iAspect = img.width / img.height;
      const pAspect = PORTRAIT_W / HEIGHT;
      let sx, sy, sw, sh;
      if (iAspect > pAspect) {
        // Image is wider → crop left and right
        sh = img.height;
        sw = sh * pAspect;
        sx = (img.width - sw) / 2;
        sy = 0;
      } else {
        // Image is taller → crop top and bottom, keep face centred
        sw = img.width;
        sh = sw / pAspect;
        sx = 0;
        sy = (img.height - sh) / 3; // bias toward top-third for face framing
      }

      // Render avatar in greyscale onto an offscreen canvas, then blit
      const off    = createCanvas(PORTRAIT_W, HEIGHT);
      const offCtx = off.getContext('2d');
      offCtx.filter = 'grayscale(1)';
      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, PORTRAIT_W, HEIGHT);
      offCtx.filter = 'none';

      ctx.drawImage(off, 0, 0);
      portraitDrawn = true;
    } catch {
      // Avatar could not be fetched – fall through to portrait-less layout
    }

    if (portraitDrawn) {
      // Horizontal fade: avatar → theme background (left side still shows through)
      const fadeGrad = ctx.createLinearGradient(FADE_FROM_X, 0, FADE_TO_X, 0);
      fadeGrad.addColorStop(0, `rgba(${br},${bg},${bb},0)`);
      fadeGrad.addColorStop(1, `rgba(${br},${bg},${bb},1)`);
      ctx.fillStyle = fadeGrad;
      ctx.fillRect(0, 0, FADE_TO_X, HEIGHT);

      // Ensure the text area is a clean solid background
      ctx.fillStyle = t.background;
      ctx.fillRect(FADE_TO_X, 0, WIDTH - FADE_TO_X, HEIGHT);
    }
  }

  // ── 3. Determine text area bounds ──────────────────────────────────────────
  const txLeft = hasPortrait ? TEXT_X     : TEXT_X_FULL;
  const txMaxW = hasPortrait ? TEXT_MAX_W : TEXT_MAX_W_FULL;
  // Reserve bottom space for author block + "Quoted by" line
  const authorBlockH   = 100; // px reserved at bottom for attribution
  const textAreaHeight = HEIGHT - authorBlockH - 60; // ≈ 470 px

  // ── 4. Quote text ──────────────────────────────────────────────────────────
  // Dynamically shrink font to fit
  let fontSize = 48;
  let lines    = [];
  while (fontSize >= 20) {
    ctx.font = `italic ${fontSize}px ${fontFamily}`;
    lines = wrapText(ctx, text, txMaxW);
    if (lines.length * fontSize * 1.4 <= textAreaHeight - 50) break;
    fontSize -= 2;
  }

  const lineHeight  = fontSize * 1.4;
  const textBlockH  = lines.length * lineHeight;
  // Vertically centre the text block within the available area above author block
  const textStartY  = Math.max(50, (textAreaHeight - textBlockH) / 2);

  // Decorative opening quote-mark (accent tinted, semi-transparent)
  const [ar, ag, ab] = hexToRgb(accent);
  ctx.save();
  ctx.font        = `bold ${Math.min(Math.round(fontSize * 2.2), 110)}px ${fontFamily}`;
  ctx.fillStyle   = `rgba(${ar},${ag},${ab},0.28)`;
  ctx.textBaseline = 'top';
  ctx.textAlign   = 'left';
  ctx.fillText('\u201C', txLeft, Math.max(8, textStartY - fontSize * 1.1));
  ctx.restore();

  // Quote body
  ctx.font        = `italic ${fontSize}px ${fontFamily}`;
  ctx.fillStyle   = t.quoteColor;
  ctx.textBaseline = 'top';
  ctx.textAlign   = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, txLeft, textStartY + i * lineHeight);
  });

  // ── 5. Author attribution ──────────────────────────────────────────────────
  // Sits AUTHOR_Y from the top, below the quote text but above "Quoted by"
  const authorY = HEIGHT - authorBlockH;

  // Thin accent rule
  ctx.fillStyle = accent;
  ctx.fillRect(txLeft, authorY - 14, txMaxW * 0.35, 2);

  // "— Author Name"
  ctx.font        = `bold 27px ${fontFamily}`;
  ctx.fillStyle   = t.textColor;
  ctx.textBaseline = 'top';
  ctx.textAlign   = 'left';
  ctx.fillText(`\u2014 ${authorName}`, txLeft, authorY);

  // Muted sub-line (server · channel · timestamp)
  const subParts = [];
  if (showServer && serverName) {
    subParts.push(`${serverName}${channelName ? ` #${channelName}` : ''}`);
  }
  if (showTimestamp && timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      subParts.push(d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }));
    }
  }
  if (subParts.length) {
    ctx.font      = `17px ${fontFamily}`;
    ctx.fillStyle = t.mutedColor;
    ctx.fillText(subParts.join(' \u00B7 '), txLeft, authorY + 36);
  }

  // ── 6. "Quoted by" — bottom-right corner ──────────────────────────────────
  if (quotedBy) {
    const label = `Quoted by ${quotedBy}`;
    ctx.font        = `15px ${fontFamily}`;
    ctx.fillStyle   = t.mutedColor;
    ctx.textBaseline = 'bottom';
    ctx.textAlign   = 'right';
    ctx.fillText(label, TEXT_RIGHT, HEIGHT - 16);
  }

  // ── 7. Thin accent line at very bottom of text area ───────────────────────
  ctx.fillStyle = accent;
  ctx.fillRect(txLeft, HEIGHT - 6, txMaxW, 3);

  return canvas.toBuffer('image/png');
}

module.exports = { generateQuoteImage, VALID_THEMES, VALID_FONTS };

