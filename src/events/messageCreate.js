'use strict';

/**
 * messageCreate.js
 *
 * Handles the reply + @mention trigger:
 *   1. Someone replies to a message AND mentions the bot in the same message
 *   2. The bot generates a quote from the replied-to message using the sender's settings
 */

const { Events, EmbedBuilder } = require('discord.js');
const { getUserSettings } = require('../utils/store');
const { buildQuoteReply, redirectQuote } = require('../utils/quoteHelpers');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bots and messages without a mention of this bot
    if (message.author.bot) return;
    if (!message.mentions.users.has(message.client.user.id)) return;

    // Must be a reply to another message
    if (!message.reference?.messageId) return;

    let targetMessage;
    try {
      targetMessage = await message.channel.messages.fetch(message.reference.messageId);
    } catch {
      return; // silently ignore if the referenced message can't be fetched
    }

    if (!targetMessage.content.trim()) {
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ That message has no text content to quote.')],
      });
      return;
    }

    const settings = getUserSettings(message.author.id, message.guildId);

    const author      = targetMessage.author;
    const member      = await message.guild?.members.fetch(author.id).catch(() => null);
    const displayName = member?.displayName || author.globalName || author.username;
    const avatarUrl   = author.displayAvatarURL({ extension: 'png', size: 128 });

    // Show a typing indicator while the image is generated
    await message.channel.sendTyping().catch(() => {});

    try {
      const { attachment, components, buffer } = await buildQuoteReply({
        text:          targetMessage.content,
        authorName:    displayName,
        avatarUrl,
        theme:         settings.theme,
        accentColor:   settings.accentColor,
        font:          settings.font,
        showAvatar:    settings.showAvatar,
        showTimestamp: settings.showTimestamp,
        showServer:    settings.showServer,
        serverName:    message.guild?.name     || null,
        channelName:   message.channel?.name   || null,
        channelId:     message.channel?.id,
        timestamp:     targetMessage.createdAt.toISOString(),
        quotedBy:      message.author.globalName || message.author.username,
        invokerUserId: message.author.id,
        guildId:       message.guildId,
      });

      await message.reply({ files: [attachment], components });

      await redirectQuote(message.guild, buffer, {
        quotedBy:  message.author.globalName || message.author.username,
        channelId: message.channel?.id,
      });
    } catch (err) {
      console.error('[messageCreate] Quote generation error:', err);
      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Failed to generate the quote image. Please try again.')],
      }).catch(() => {});
    }
  },
};
