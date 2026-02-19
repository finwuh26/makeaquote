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
    .setName('quote')
    .setDescription('Turn any Discord message into a beautiful quote image')
    .addStringOption(opt =>
      opt.setName('message_id')
        .setDescription('ID of the message to quote (right-click → Copy Message ID)')
        .setRequired(true))
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
    .addBooleanOption(opt =>
      opt.setName('show_avatar')
        .setDescription('Show the author\'s avatar (default: true)'))
    .addBooleanOption(opt =>
      opt.setName('show_timestamp')
        .setDescription('Show message timestamp (default: true)'))
    .addBooleanOption(opt =>
      opt.setName('show_server')
        .setDescription('Show server/channel name (default: true)')),

  async execute(interaction) {
    await interaction.deferReply();

    const messageId = interaction.options.getString('message_id');
    const channel   = interaction.channel;

    let targetMessage;
    try {
      targetMessage = await channel.messages.fetch(messageId);
    } catch {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Could not find that message in this channel. Make sure you copy the ID from a message **in this channel**.')],
      });
    }

    if (!targetMessage.content.trim()) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ That message has no text content to quote.')],
      });
    }

    const settings = getUserSettings(interaction.user.id, interaction.guildId);

    const theme       = interaction.options.getString('theme')        || settings.theme;
    const accentColor = interaction.options.getString('accent_color') || settings.accentColor;
    const font        = interaction.options.getString('font')         || settings.font;
    const showAvatar  = interaction.options.getBoolean('show_avatar')    ?? settings.showAvatar;
    const showTimestamp = interaction.options.getBoolean('show_timestamp') ?? settings.showTimestamp;
    const showServer  = interaction.options.getBoolean('show_server')    ?? settings.showServer;

    const author      = targetMessage.author;
    const member      = await interaction.guild?.members.fetch(author.id).catch(() => null);
    const displayName = member?.displayName || author.globalName || author.username;
    const avatarUrl   = author.displayAvatarURL({ extension: 'png', size: 512 });

    try {
      const { attachment, components, buffer } = await buildQuoteReply({
        text:        targetMessage.content,
        authorName:  displayName,
        avatarUrl,
        theme,
        accentColor,
        font,
        showAvatar,
        showTimestamp,
        showServer,
        serverName:  interaction.guild?.name  || null,
        channelName: channel.name             || null,
        channelId:   channel.id,
        timestamp:   targetMessage.createdAt.toISOString(),
        quotedBy:    interaction.user.globalName || interaction.user.username,
        invokerUserId: interaction.user.id,
        guildId:     interaction.guildId,
      });

      await interaction.editReply({ files: [attachment], components });

      // Forward to redirect channel if configured
      await redirectQuote(interaction.guild, buffer, {
        quotedBy:  interaction.user.globalName || interaction.user.username,
        channelId: channel.id,
      });
    } catch (err) {
      console.error('[/quote] Image generation error:', err);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Failed to generate the quote image. Please try again.')],
      });
    }
  },
};
