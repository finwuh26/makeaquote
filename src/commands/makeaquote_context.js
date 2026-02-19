'use strict';

/**
 * "Make a Quote" message context menu command.
 *
 * Right-click any message → Apps → Make a Quote
 */

const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
} = require('discord.js');
const { getUserSettings } = require('../utils/store');
const { buildQuoteReply, redirectQuote } = require('../utils/quoteHelpers');

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName('Make a Quote')
    .setType(ApplicationCommandType.Message),

  async execute(interaction) {
    await interaction.deferReply();

    const targetMessage = interaction.targetMessage;

    if (!targetMessage.content.trim()) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ That message has no text content to quote.')],
      });
    }

    const settings = getUserSettings(interaction.user.id, interaction.guildId);

    const author      = targetMessage.author;
    const member      = await interaction.guild?.members.fetch(author.id).catch(() => null);
    const displayName = member?.displayName || author.globalName || author.username;
    const avatarUrl   = author.displayAvatarURL({ extension: 'png', size: 512 });

    try {
      const { attachment, components, buffer } = await buildQuoteReply({
        text:         targetMessage.content,
        authorName:   displayName,
        avatarUrl,
        theme:        settings.theme,
        accentColor:  settings.accentColor,
        font:         settings.font,
        showAvatar:   settings.showAvatar,
        showTimestamp: settings.showTimestamp,
        showServer:   settings.showServer,
        serverName:   interaction.guild?.name       || null,
        channelName:  interaction.channel?.name     || null,
        channelId:    interaction.channel?.id,
        timestamp:    targetMessage.createdAt.toISOString(),
        quotedBy:     interaction.user.globalName || interaction.user.username,
        invokerUserId: interaction.user.id,
        guildId:      interaction.guildId,
      });

      await interaction.editReply({ files: [attachment], components });

      await redirectQuote(interaction.guild, buffer, {
        quotedBy:  interaction.user.globalName || interaction.user.username,
        channelId: interaction.channel?.id,
      });
    } catch (err) {
      console.error('[context:MakeaQuote] Image generation error:', err);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Failed to generate the quote image. Please try again.')],
      });
    }
  },
};
