'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const { VALID_THEMES, VALID_FONTS } = require('../utils/quoteGenerator');
const { getUserSettings } = require('../utils/store');
const { buildQuoteReply, redirectQuote } = require('../utils/quoteHelpers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('customquote')
    .setDescription('Create a quote image with any text and author name')
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('The quote text')
        .setRequired(true)
        .setMaxLength(500))
    .addStringOption(opt =>
      opt.setName('author')
        .setDescription('Author name to display')
        .setRequired(true)
        .setMaxLength(80))
    .addStringOption(opt =>
      opt.setName('theme')
        .setDescription('Visual theme')
        .addChoices(
          ...VALID_THEMES.map(t => ({ name: t.charAt(0).toUpperCase() + t.slice(1), value: t })),
        ))
    .addStringOption(opt =>
      opt.setName('accent_color')
        .setDescription('Hex accent colour, e.g. #ff7eb3')
        .setMaxLength(7))
    .addStringOption(opt =>
      opt.setName('font')
        .setDescription('Font style')
        .addChoices(
          ...VALID_FONTS.map(f => ({ name: f.charAt(0).toUpperCase() + f.slice(1), value: f })),
        ))
    .addStringOption(opt =>
      opt.setName('avatar_url')
        .setDescription('Optional image URL to use as the author avatar')),

  async execute(interaction) {
    await interaction.deferReply();

    const text      = interaction.options.getString('text');
    const author    = interaction.options.getString('author');
    const avatarRaw = interaction.options.getString('avatar_url');

    // Validate avatar URL if provided
    let avatarUrl = null;
    if (avatarRaw) {
      try {
        const u = new URL(avatarRaw);
        if (u.protocol === 'https:') avatarUrl = avatarRaw;
      } catch {
        // ignore invalid URL
      }
    }

    const settings = getUserSettings(interaction.user.id, interaction.guildId);

    const theme       = interaction.options.getString('theme')        || settings.theme;
    const accentColor = interaction.options.getString('accent_color') || settings.accentColor;
    const font        = interaction.options.getString('font')         || settings.font;

    try {
      const { attachment, components, buffer } = await buildQuoteReply({
        text,
        authorName:    author,
        avatarUrl,
        theme,
        accentColor,
        font,
        showAvatar:    !!avatarUrl,
        showTimestamp: false,
        showServer:    false,
        serverName:    null,
        channelName:   null,
        channelId:     interaction.channel?.id,
        timestamp:     null,
        quotedBy:      interaction.user.globalName || interaction.user.username,
        invokerUserId: interaction.user.id,
        guildId:       interaction.guildId,
      });

      await interaction.editReply({ files: [attachment], components });

      await redirectQuote(interaction.guild, buffer, {
        quotedBy:  interaction.user.globalName || interaction.user.username,
        channelId: interaction.channel?.id,
      });
    } catch (err) {
      console.error('[/customquote] Error:', err);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Failed to generate the quote image. Please try again.')],
      });
    }
  },
};
