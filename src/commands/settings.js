'use strict';

/**
 * /settings — interactive per-user and per-server settings dashboard.
 *
 * /settings user   → ephemeral panel with all personal preferences
 * /settings server → ephemeral panel with server-wide defaults + redirect channel
 *                    (requires Manage Guild permission)
 *
 * Dashboard panels use Discord components (select menus, buttons) so every
 * setting can be changed without re-running the command.  The panels are
 * ephemeral, so only the person who opened them can interact with them.
 *
 * Component customId format:
 *   ds_theme:{sessionId}           – StringSelectMenu  (theme)
 *   ds_font:{sessionId}:{font}     – Button            (font)
 *   ds_tog:{sessionId}:{field}     – Button            (showAvatar/Timestamp/Server)
 *   ds_color:{sessionId}           – StringSelectMenu  (accent colour preset)
 *   ds_reset:{sessionId}           – Button            (reset all to defaults)
 *   ds_redirect_open:{sessionId}   – Button            (switch to redirect sub-panel)
 *   ds_redirect_set:{sessionId}    – ChannelSelectMenu (pick redirect channel)
 *   ds_redirect_clear:{sessionId}  – Button            (clear redirect channel)
 *   ds_redirect_back:{sessionId}   – Button            (back to main panel)
 *
 * All handlers live in src/events/interactionCreate.js under the `ds_` prefix
 * dispatcher.  This file exports buildSettingsPanel() and buildRedirectPanel()
 * so that file can refresh the embed without re-running the slash command.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');

const {
  getUserSettings,
  getGuildSettings,
  setUserSettings,
  setGuildSettings,
} = require('../utils/store');
const { VALID_THEMES, VALID_FONTS } = require('../utils/quoteGenerator');
const { createSession, getSession, updateSession, ACCENT_PRESETS, THEME_EMOJI } = require('../utils/quoteHelpers');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USER_DEFAULTS = { theme: 'dark', accentColor: '#5865F2', showAvatar: true, showTimestamp: true, showServer: true, font: 'serif' };

/** Toggle map used by ds_tog handler */
const TOGGLE_FIELDS = { av: 'showAvatar', ts: 'showTimestamp', sv: 'showServer' };

/**
 * Build the main settings embed + components for a given scope.
 *
 * @param {string} sessionId
 * @param {'user'|'server'} scope
 * @param {Object} current   Current settings object
 * @param {import('discord.js').Guild|null} guild
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function buildSettingsPanel(sessionId, scope, current, guild) {
  const isServer = scope === 'server';
  const title    = isServer ? '⚙️ Server Quote Settings' : '⚙️ Your Quote Settings';

  // ── Embed ──────────────────────────────────────────────────────────────────
  const redirectLine = isServer
    ? `\n**Redirect Channel** ${current.redirectChannelId ? `<#${current.redirectChannelId}>` : '`Not set`'}`
    : '';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(current.accentColor || '#5865F2')
    .setDescription(
      [
        `**Theme**         ${(THEME_EMOJI[current.theme] || '🎨')} ${_cap(current.theme)}`,
        `**Font**          ${_fontEmoji(current.font)} ${_cap(current.font)}`,
        `**Accent Colour** ${_colorSwatch(current.accentColor)} \`${current.accentColor}\``,
        `**Show Avatar**   ${current.showAvatar    ? '✅' : '❌'}`,
        `**Timestamp**     ${current.showTimestamp ? '✅' : '❌'}`,
        `**Server Info**   ${current.showServer    ? '✅' : '❌'}`,
        redirectLine,
      ].filter(Boolean).join('\n'),
    )
    .setFooter({ text: isServer ? 'Server settings apply to all members as defaults.' : 'Your settings override the server defaults.' });

  // ── Row 1: Theme select ────────────────────────────────────────────────────
  const themeSelect = new StringSelectMenuBuilder()
    .setCustomId(`ds_theme:${sessionId}`)
    .setPlaceholder('🎨 Change theme…')
    .addOptions(
      VALID_THEMES.map(t => ({
        label: _cap(t),
        value: t,
        emoji: THEME_EMOJI[t] || '🎨',
        default: t === current.theme,
      })),
    );

  // ── Row 2: Font buttons ────────────────────────────────────────────────────
  const fontButtons = VALID_FONTS.map(f =>
    new ButtonBuilder()
      .setCustomId(`ds_font:${sessionId}:${f}`)
      .setLabel(f === 'sans-serif' ? 'Sans-serif' : _cap(f))
      .setStyle(f === current.font ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setEmoji(_fontEmoji(f)),
  );

  // ── Row 3: Layout toggles ──────────────────────────────────────────────────
  const toggleDefs = [
    { id: 'av', label: 'Avatar',    emoji: '👤', field: 'showAvatar'    },
    { id: 'ts', label: 'Timestamp', emoji: '🕐', field: 'showTimestamp' },
    { id: 'sv', label: 'Server',    emoji: '🏠', field: 'showServer'    },
  ];
  const toggleButtons = toggleDefs.map(d =>
    new ButtonBuilder()
      .setCustomId(`ds_tog:${sessionId}:${d.id}`)
      .setLabel(d.label)
      .setStyle(current[d.field] ? ButtonStyle.Success : ButtonStyle.Danger)
      .setEmoji(d.emoji),
  );

  // ── Row 4: Accent colour select ────────────────────────────────────────────
  const colorSelect = new StringSelectMenuBuilder()
    .setCustomId(`ds_color:${sessionId}`)
    .setPlaceholder('🖌️ Change accent colour…')
    .addOptions(
      ACCENT_PRESETS.map(p => ({
        label: p.label,
        value: p.value,
        emoji: p.emoji,
        default: p.value.toLowerCase() === (current.accentColor || '').toLowerCase(),
      })),
    );

  // ── Row 5: Action buttons ──────────────────────────────────────────────────
  const actionButtons = [
    new ButtonBuilder()
      .setCustomId(`ds_reset:${sessionId}`)
      .setLabel('Reset to Defaults')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('↩️'),
  ];
  if (isServer) {
    actionButtons.push(
      new ButtonBuilder()
        .setCustomId(`ds_redirect_open:${sessionId}`)
        .setLabel('Set Redirect Channel')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📢'),
    );
  }

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(themeSelect),
      new ActionRowBuilder().addComponents(...fontButtons),
      new ActionRowBuilder().addComponents(...toggleButtons),
      new ActionRowBuilder().addComponents(colorSelect),
      new ActionRowBuilder().addComponents(...actionButtons),
    ],
  };
}

/**
 * Build the redirect-channel sub-panel (server only).
 *
 * @param {string} sessionId
 * @param {Object} guildSettings
 * @returns {{ embeds: EmbedBuilder[], components: ActionRowBuilder[] }}
 */
function buildRedirectPanel(sessionId, guildSettings) {
  const current = guildSettings.redirectChannelId;

  const embed = new EmbedBuilder()
    .setTitle('📢 Quote Redirect Channel')
    .setColor('#5865F2')
    .setDescription(
      [
        'Every quote generated on this server will also be forwarded to the redirect channel.',
        '',
        `**Current channel:** ${current ? `<#${current}>` : '`None — not set`'}`,
        '',
        'Select a channel below to change it, or clear it to disable forwarding.',
      ].join('\n'),
    );

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(`ds_redirect_set:${sessionId}`)
    .setPlaceholder('Select a text channel…')
    .setChannelTypes(ChannelType.GuildText);

  const backButtons = [
    new ButtonBuilder()
      .setCustomId(`ds_redirect_clear:${sessionId}`)
      .setLabel('Clear Redirect')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🗑️')
      .setDisabled(!current),
    new ButtonBuilder()
      .setCustomId(`ds_redirect_back:${sessionId}`)
      .setLabel('← Back to Settings')
      .setStyle(ButtonStyle.Secondary),
  ];

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(channelSelect),
      new ActionRowBuilder().addComponents(...backButtons),
    ],
  };
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function _cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function _fontEmoji(f) { return f === 'serif' ? '🖋️' : f === 'sans-serif' ? '🔤' : '💻'; }
function _colorSwatch(hex) {
  // Return a unicode block character for visual effect in the embed
  return hex ? '🎨' : '⬜';
}

// ─── Exports used by interactionCreate handler ────────────────────────────────
module.exports.buildSettingsPanel  = buildSettingsPanel;
module.exports.buildRedirectPanel  = buildRedirectPanel;
module.exports.TOGGLE_FIELDS       = TOGGLE_FIELDS;

// ─── Slash command definition ─────────────────────────────────────────────────
module.exports.data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('View and change your quote preferences')
  .addSubcommand(sub =>
    sub.setName('user')
      .setDescription('Open your personal settings dashboard'))
  .addSubcommand(sub =>
    sub.setName('server')
      .setDescription('Open the server-wide settings dashboard (requires Manage Server)'));

module.exports.execute = async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  // ── /settings user ──────────────────────────────────────────────────────────
  if (sub === 'user') {
    const current   = getUserSettings(interaction.user.id, interaction.guildId);
    const sessionId = createSession({
      scope:         'user',
      targetId:      interaction.user.id,
      invokerUserId: interaction.user.id,
      guildId:       interaction.guildId,
    });
    const panel = buildSettingsPanel(sessionId, 'user', current, interaction.guild);
    return interaction.reply({ ...panel, ephemeral: true });
  }

  // ── /settings server ────────────────────────────────────────────────────────
  if (sub === 'server') {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: '❌ Server settings are only available inside a server.', ephemeral: true });
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ You need the **Manage Server** permission to change server settings.', ephemeral: true });
    }

    const current   = getGuildSettings(interaction.guildId);
    const sessionId = createSession({
      scope:         'server',
      targetId:      interaction.guildId,
      invokerUserId: interaction.user.id,
      guildId:       interaction.guildId,
    });
    const panel = buildSettingsPanel(sessionId, 'server', current, interaction.guild);
    return interaction.reply({ ...panel, ephemeral: true });
  }
};
