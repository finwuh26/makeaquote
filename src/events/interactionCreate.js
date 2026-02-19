'use strict';

/**
 * interactionCreate.js
 *
 * Handles every interaction the bot receives:
 *   • Slash commands  (ChatInputCommandInteraction)
 *   • Context menus   (MessageContextMenuCommandInteraction)
 *   • Quote buttons   (customId prefix: qt_)
 *   • Settings panels (customId prefix: ds_)
 */

const {
  Events,
  EmbedBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const {
  getSession,
  updateSession,
  buildQuoteComponents,
  renderFromSession,
  redirectQuote,
} = require('../utils/quoteHelpers');

const {
  getUserSettings,
  getGuildSettings,
  setUserSettings,
  setGuildSettings,
} = require('../utils/store');

const {
  buildSettingsPanel,
  buildRedirectPanel,
  TOGGLE_FIELDS,
} = require('../commands/settings');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_DEFAULTS = {
  theme: 'dark', accentColor: '#5865F2',
  showAvatar: true, showTimestamp: true, showServer: true, font: 'serif',
};

function errorEmbed(msg) {
  return new EmbedBuilder().setColor('#ED4245').setDescription(`❌ ${msg}`);
}

// ─── Quote button / select handlers ──────────────────────────────────────────

/**
 * Handle a qt_* component interaction (theme select, font button, toggle button).
 * Updates the session state and re-renders the quote image in-place.
 */
async function handleQuoteComponent(interaction) {
  const [action, sessionId, extra] = interaction.customId.split(':');

  const session = getSession(sessionId);
  if (!session) {
    return interaction.reply({
      embeds: [errorEmbed('This quote has expired. Run the command again to generate a new one.')],
      ephemeral: true,
    });
  }

  // Only the person who triggered the quote can use its buttons
  if (session.invokerUserId && interaction.user.id !== session.invokerUserId) {
    return interaction.reply({
      embeds: [errorEmbed('Only the person who created this quote can customise it.')],
      ephemeral: true,
    });
  }

  await interaction.deferUpdate();

  // Apply state change
  if (action === 'qt_theme') {
    const newTheme = interaction.values[0];
    updateSession(sessionId, { theme: newTheme });
  } else if (action === 'qt_font') {
    updateSession(sessionId, { font: extra });
  } else if (action === 'qt_tog') {
    const field = { av: 'showAvatar', ts: 'showTimestamp', sv: 'showServer' }[extra];
    if (field) {
      const updated = !getSession(sessionId)[field];
      updateSession(sessionId, { [field]: updated });
    }
  }

  const updated = getSession(sessionId);
  let buffer;
  try {
    buffer = await renderFromSession(updated);
  } catch (err) {
    console.error('[qt component] Render error:', err);
    return interaction.followUp({ embeds: [errorEmbed('Failed to re-render the quote.')], ephemeral: true });
  }

  const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
  const components = buildQuoteComponents(sessionId, updated);

  await interaction.editReply({ files: [attachment], components });
}

// ─── Settings dashboard handlers ─────────────────────────────────────────────

/**
 * Resolve a settings session and guard that the invoker matches.
 * Returns { session, current, isServer } or null on failure (reply already sent).
 */
async function _resolveSettings(interaction, sessionId) {
  const session = getSession(sessionId);
  if (!session) {
    await interaction.reply({ embeds: [errorEmbed('This settings panel has expired. Run `/settings` again.')], ephemeral: true });
    return null;
  }
  if (interaction.user.id !== session.invokerUserId) {
    await interaction.reply({ embeds: [errorEmbed('Only the person who opened this panel can use it.')], ephemeral: true });
    return null;
  }
  const isServer = session.scope === 'server';
  const current  = isServer ? getGuildSettings(session.targetId) : getUserSettings(session.targetId, session.guildId);
  return { session, current, isServer };
}

/** Persist a settings patch and refresh the panel. */
async function _applyAndRefresh(interaction, sessionId, patch) {
  const ctx = await _resolveSettings(interaction, sessionId);
  if (!ctx) return;

  const { session, isServer } = ctx;
  if (isServer) {
    setGuildSettings(session.targetId, patch);
  } else {
    setUserSettings(session.targetId, patch);
  }

  const updated = isServer ? getGuildSettings(session.targetId) : getUserSettings(session.targetId, session.guildId);
  const panel   = buildSettingsPanel(sessionId, session.scope, updated, null);

  await interaction.deferUpdate();
  await interaction.editReply(panel);
}

/**
 * Handle a ds_* component interaction (settings dashboard).
 */
async function handleSettingsComponent(interaction) {
  const parts     = interaction.customId.split(':');
  const action    = parts[0];
  const sessionId = parts[1];
  const extra     = parts[2];

  // ── Theme select ────────────────────────────────────────────────────────────
  if (action === 'ds_theme') {
    return _applyAndRefresh(interaction, sessionId, { theme: interaction.values[0] });
  }

  // ── Font button ─────────────────────────────────────────────────────────────
  if (action === 'ds_font') {
    return _applyAndRefresh(interaction, sessionId, { font: extra });
  }

  // ── Layout toggle ───────────────────────────────────────────────────────────
  if (action === 'ds_tog') {
    const field = TOGGLE_FIELDS[extra];
    if (!field) return;
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    return _applyAndRefresh(interaction, sessionId, { [field]: !ctx.current[field] });
  }

  // ── Accent colour select ────────────────────────────────────────────────────
  if (action === 'ds_color') {
    return _applyAndRefresh(interaction, sessionId, { accentColor: interaction.values[0] });
  }

  // ── Reset to defaults ───────────────────────────────────────────────────────
  if (action === 'ds_reset') {
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    // Spread USER_DEFAULTS so any future additions are automatically included
    const { redirectChannelId: _ignored, ...resetPatch } = { ...USER_DEFAULTS };
    return _applyAndRefresh(interaction, sessionId, resetPatch);
  }

  // ── Open redirect sub-panel ─────────────────────────────────────────────────
  if (action === 'ds_redirect_open') {
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    const gs    = getGuildSettings(ctx.session.guildId);
    const panel = buildRedirectPanel(sessionId, gs);
    await interaction.deferUpdate();
    return interaction.editReply(panel);
  }

  // ── Channel select (save redirect) ─────────────────────────────────────────
  if (action === 'ds_redirect_set') {
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    const channelId = interaction.values[0];
    setGuildSettings(ctx.session.guildId, { redirectChannelId: channelId });
    const gs    = getGuildSettings(ctx.session.guildId);
    const panel = buildRedirectPanel(sessionId, gs);
    await interaction.deferUpdate();
    return interaction.editReply(panel);
  }

  // ── Clear redirect ──────────────────────────────────────────────────────────
  if (action === 'ds_redirect_clear') {
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    setGuildSettings(ctx.session.guildId, { redirectChannelId: null });
    const gs    = getGuildSettings(ctx.session.guildId);
    const panel = buildRedirectPanel(sessionId, gs);
    await interaction.deferUpdate();
    return interaction.editReply(panel);
  }

  // ── Back to main panel ──────────────────────────────────────────────────────
  if (action === 'ds_redirect_back') {
    const ctx = await _resolveSettings(interaction, sessionId);
    if (!ctx) return;
    const current = ctx.isServer ? getGuildSettings(ctx.session.targetId) : getUserSettings(ctx.session.targetId, ctx.session.guildId);
    const panel   = buildSettingsPanel(sessionId, ctx.session.scope, current, null);
    await interaction.deferUpdate();
    return interaction.editReply(panel);
  }
}

// ─── Main event handler ───────────────────────────────────────────────────────

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // ── Slash commands & context menus ──────────────────────────────────────
      if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // ── Quote component interactions (qt_ prefix) ───────────────────────────
      if (
        (interaction.isStringSelectMenu() || interaction.isButton()) &&
        (interaction.customId.startsWith('qt_theme:') ||
         interaction.customId.startsWith('qt_font:')  ||
         interaction.customId.startsWith('qt_tog:'))
      ) {
        await handleQuoteComponent(interaction);
        return;
      }

      // ── Settings dashboard interactions (ds_ prefix) ────────────────────────
      if (
        (interaction.isStringSelectMenu() ||
         interaction.isButton()            ||
         interaction.isChannelSelectMenu()) &&
        interaction.customId.startsWith('ds_')
      ) {
        await handleSettingsComponent(interaction);
        return;
      }
    } catch (err) {
      console.error('[interactionCreate] Unhandled error:', err);
      const reply = { embeds: [errorEmbed('An unexpected error occurred.')], ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.followUp(reply).catch(() => {});
      } else {
        interaction.reply(reply).catch(() => {});
      }
    }
  },
};
