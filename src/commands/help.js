'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available commands and how to use them'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('📖 Make a Quote — Help')
      .setColor('#5865F2')
      .setDescription('Turn any Discord message into a beautiful, customisable quote image.')
      .addFields(
        {
          name: '💬 `/quote <message_id>`',
          value: 'Quote a specific message by its ID. Right-click a message → *Copy Message ID* to get it.\n'
               + 'Optional: `theme`, `accent_color`, `font`, `show_avatar`, `show_timestamp`, `show_server`',
        },
        {
          name: '✏️ `/customquote <text> <author>`',
          value: 'Create a quote image from any text with any author name.\n'
               + 'Optional: `theme`, `accent_color`, `font`, `avatar_url`',
        },
        {
          name: '🎲 `/randomquote`',
          value: 'Generate a quote image from a random inspirational quote.\n'
               + 'Optional: `category` to filter by topic.',
        },
        {
          name: '⚙️ `/settings user`',
          value: 'Open your **personal settings dashboard** — change theme, font, accent colour and layout defaults interactively.',
        },
        {
          name: '🏠 `/settings server`',
          value: '*(Requires **Manage Server**)* Open the **server settings dashboard** — set server-wide defaults and configure a **Quote Redirect** channel where all quotes get forwarded.',
        },
        {
          name: '🖱️ Right-click → Apps → **Make a Quote**',
          value: 'Right-click any message, hover **Apps**, and select **Make a Quote** to instantly quote it using your saved settings.',
        },
        {
          name: '💬 Reply + @Mention',
          value: 'Reply to any message and @mention the bot to generate a quote from the replied message.',
        },
        {
          name: '🎨 Interactive Buttons',
          value: 'Every generated quote has **Theme**, **Font**, and **Layout** controls underneath it — click them to customise the quote on the fly without re-running a command.',
        },
      )
      .setFooter({ text: 'Tip: use /settings user to save your favourite style so every quote looks great automatically.' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
