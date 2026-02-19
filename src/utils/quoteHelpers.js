'use strict';

/**
 * quoteHelpers.js
 *
 * Centralises:
 *  - In-memory quote sessions (carry state between button presses)
 *  - Building Discord component rows for quote customisation
 *  - Generating an image buffer from a session
 *  - Forwarding finished quotes to a guild's redirect channel
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require('discord.js');

const { generateQuoteImage, VALID_THEMES, VALID_FONTS } = require('./quoteGenerator');
const { getGuildSettings } = require('./store');

// ─── Session store ────────────────────────────────────────────────────────────

const _sessions = new Map();
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 minutes
let _sessionCounter = 0; // monotonic counter eliminates same-millisecond collisions

function _cleanOldSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [k, v] of _sessions) {
    if (v.createdAt < cutoff) _sessions.delete(k);
  }
}

/**
 * Create a new quote session and return its ID.
 * @param {Object} data  Full session data (text, author, mutable state, …)
 * @returns {string}     Session ID (≤18 chars, safe to embed in customIds)
 */
function createSession(data) {
  _cleanOldSessions();
  // Combine timestamp + monotonic counter for uniqueness even under high concurrency
  const id = Date.now().toString(36) + (_sessionCounter++ & 0xffff).toString(36).padStart(3, '0');
  _sessions.set(id, { ...data, createdAt: Date.now() });
  return id;
}

/**
 * Retrieve a session.  Returns null if it has expired or never existed.
 * @param {string} id
 * @returns {Object|null}
 */
function getSession(id) {
  const s = _sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    _sessions.delete(id);
    return null;
  }
  return s;
}

/**
 * Apply a partial update to a session.
 * @param {string} id
 * @param {Object} patch
 */
function updateSession(id, patch) {
  const s = _sessions.get(id);
  if (s) _sessions.set(id, { ...s, ...patch, createdAt: s.createdAt });
}

// ─── Theme / colour metadata ──────────────────────────────────────────────────

const THEME_EMOJI = {
  dark: '🌑',
  light: '☀️',
  midnight: '🌙',
  ocean: '🌊',
  sunset: '🌅',
  forest: '🌲',
};

/** Preset accent colours shown in the settings colour picker. */
const ACCENT_PRESETS = [
  { label: 'Discord Blue',  value: '#5865F2', emoji: '🔵' },
  { label: 'Red',           value: '#ED4245', emoji: '🔴' },
  { label: 'Green',         value: '#57F287', emoji: '🟢' },
  { label: 'Yellow',        value: '#FEE75C', emoji: '🟡' },
  { label: 'Orange',        value: '#E67E22', emoji: '🟠' },
  { label: 'Pink',          value: '#FF7EB3', emoji: '🩷' },
  { label: 'Purple',        value: '#9B59B6', emoji: '🟣' },
  { label: 'Teal',          value: '#1ABC9C', emoji: '🩵' },
];

// ─── Quote customisation component rows ───────────────────────────────────────

/**
 * Build the three ActionRows that appear below every generated quote.
 *
 * Row 1 – Theme select menu
 * Row 2 – Font buttons  (active theme = green, others = grey)
 * Row 3 – Layout toggles (enabled = green, disabled = red)
 *
 * @param {string} sessionId
 * @param {{ theme, font, showAvatar, showTimestamp, showServer }} state
 * @returns {ActionRowBuilder[]}
 */
function buildQuoteComponents(sessionId, state) {
  // Row 1 – theme
  const themeSelect = new StringSelectMenuBuilder()
    .setCustomId(`qt_theme:${sessionId}`)
    .setPlaceholder('🎨 Change theme…')
    .addOptions(
      VALID_THEMES.map(t => ({
        label: t.charAt(0).toUpperCase() + t.slice(1),
        value: t,
        emoji: THEME_EMOJI[t] || '🎨',
        default: t === state.theme,
      })),
    );

  // Row 2 – font
  const fontButtons = VALID_FONTS.map(f =>
    new ButtonBuilder()
      .setCustomId(`qt_font:${sessionId}:${f}`)
      .setLabel(f === 'sans-serif' ? 'Sans-serif' : f.charAt(0).toUpperCase() + f.slice(1))
      .setStyle(f === state.font ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(f === 'serif' ? '🖋️' : f === 'sans-serif' ? '🔤' : '💻'),
  );

  // Row 3 – layout toggles
  const toggleDefs = [
    { id: 'av', label: 'Avatar',    emoji: '👤', field: 'showAvatar'    },
    { id: 'ts', label: 'Timestamp', emoji: '🕐', field: 'showTimestamp' },
    { id: 'sv', label: 'Server',    emoji: '🏠', field: 'showServer'    },
  ];
  const toggleButtons = toggleDefs.map(d =>
    new ButtonBuilder()
      .setCustomId(`qt_tog:${sessionId}:${d.id}`)
      .setLabel(d.label)
      .setStyle(state[d.field] ? ButtonStyle.Success : ButtonStyle.Danger)
      .setEmoji(d.emoji),
  );

  return [
    new ActionRowBuilder().addComponents(themeSelect),
    new ActionRowBuilder().addComponents(...fontButtons),
    new ActionRowBuilder().addComponents(...toggleButtons),
  ];
}

// ─── Image rendering ──────────────────────────────────────────────────────────

/**
 * Render a PNG buffer from the current state of a session object.
 * @param {Object} session
 * @returns {Promise<Buffer>}
 */
async function renderFromSession(session) {
  return generateQuoteImage({
    text:           session.text,
    authorName:     session.authorName,
    avatarUrl:      session.showAvatar ? session.avatarUrl : null,
    theme:          session.theme,
    accentColor:    session.accentColor,
    font:           session.font,
    showTimestamp:  session.showTimestamp,
    showServer:     session.showServer,
    serverName:     session.serverName,
    channelName:    session.channelName,
    timestamp:      session.timestamp,
    quotedBy:       session.quotedBy,
  });
}

// ─── Quote redirect ───────────────────────────────────────────────────────────

/**
 * If the guild has a redirect channel configured, forward the quote there.
 * Safe to call even when no redirect is set – it becomes a no-op.
 *
 * @param {import('discord.js').Guild|null} guild
 * @param {Buffer} buffer          PNG image buffer
 * @param {{ quotedBy: string, channelId?: string }} quoteOpts
 */
async function redirectQuote(guild, buffer, quoteOpts) {
  if (!guild) return;
  const gs = getGuildSettings(guild.id);
  if (!gs.redirectChannelId) return;

  try {
    const ch = await guild.channels.fetch(gs.redirectChannelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return;

    const sourceMention = quoteOpts.channelId ? ` in <#${quoteOpts.channelId}>` : '';
    await ch.send({
      content: `📌 Quoted by **${quoteOpts.quotedBy}**${sourceMention}`,
      files: [new AttachmentBuilder(buffer, { name: 'quote.png' })],
    });
  } catch (err) {
    console.error('[redirect] Failed to send to redirect channel:', err.message);
  }
}

// ─── Full quote build + send ──────────────────────────────────────────────────

/**
 * Create a quote session, render the image and assemble the Discord reply
 * payload (attachment + components).  Does NOT send anything – the caller
 * chooses how to send (reply / editReply / channel.send).
 *
 * @param {Object} opts  Everything needed for the quote (see generateQuoteImage)
 *                       plus invokerUserId, guildId, channelId.
 * @returns {Promise<{ attachment: AttachmentBuilder, components: ActionRowBuilder[], sessionId: string, buffer: Buffer }>}
 */
async function buildQuoteReply(opts) {
  const sessionId = createSession(opts);
  const session   = getSession(sessionId);
  const buffer    = await renderFromSession(session);

  return {
    attachment:  new AttachmentBuilder(buffer, { name: 'quote.png' }),
    components:  buildQuoteComponents(sessionId, session),
    sessionId,
    buffer,
  };
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  buildQuoteComponents,
  renderFromSession,
  redirectQuote,
  buildQuoteReply,
  ACCENT_PRESETS,
  THEME_EMOJI,
};
