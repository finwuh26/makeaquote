'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');
const axios = require('axios');
const { getUserSettings } = require('../utils/store');
const { buildQuoteReply, redirectQuote } = require('../utils/quoteHelpers');

// ─── Built-in fallback quotes ──────────────────────────────────────────────────
const FALLBACK_QUOTES = [
  { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
  { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
  { q: 'It does not matter how slowly you go as long as you do not stop.', a: 'Confucius' },
  { q: 'Life is what happens when you\'re busy making other plans.', a: 'John Lennon' },
  { q: 'The future belongs to those who believe in the beauty of their dreams.', a: 'Eleanor Roosevelt' },
  { q: 'Spread love everywhere you go. Let no one ever come to you without leaving happier.', a: 'Mother Teresa' },
  { q: 'When you reach the end of your rope, tie a knot in it and hang on.', a: 'Franklin D. Roosevelt' },
  { q: 'Always remember that you are absolutely unique. Just like everyone else.', a: 'Margaret Mead' },
  { q: 'Do not go where the path may lead, go instead where there is no path and leave a trail.', a: 'Ralph Waldo Emerson' },
  { q: 'You will face many defeats in life, but never let yourself be defeated.', a: 'Maya Angelou' },
  { q: 'The greatest glory in living lies not in never falling, but in rising every time we fall.', a: 'Nelson Mandela' },
  { q: 'In the end, it\'s not the years in your life that count. It\'s the life in your years.', a: 'Abraham Lincoln' },
  { q: 'Never let the fear of striking out keep you from playing the game.', a: 'Babe Ruth' },
  { q: 'Life is either a daring adventure or nothing at all.', a: 'Helen Keller' },
  { q: 'Many of life\'s failures are people who did not realize how close they were to success when they gave up.', a: 'Thomas A. Edison' },
  { q: 'You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.', a: 'Dr. Seuss' },
  { q: 'If life were predictable it would cease to be life, and be without flavor.', a: 'Eleanor Roosevelt' },
  { q: 'If you look at what you have in life, you\'ll always have more.', a: 'Oprah Winfrey' },
  { q: 'If you set your goals ridiculously high and it\'s a failure, you will fail above everyone else\'s success.', a: 'James Cameron' },
  { q: 'Life is not measured by the number of breaths we take, but by the moments that take our breath away.', a: 'Maya Angelou' },
];

/**
 * Attempt to fetch a quote from api-ninjas.com (requires an API key in .env).
 * Returns null on any failure so the caller can fall back to the built-in list.
 */
async function fetchRemoteQuote(category) {
  const key = process.env.QUOTES_API_KEY;
  if (!key) return null;

  const params = {};
  if (category) params.category = category;

  const res = await axios.get('https://api.api-ninjas.com/v1/quotes', {
    headers: { 'X-Api-Key': key },
    params,
    timeout: 4000,
  });

  const data = res.data;
  if (Array.isArray(data) && data.length > 0) {
    return { q: data[0].quote, a: data[0].author };
  }
  return null;
}

const CATEGORIES = [
  'age', 'alone', 'amazing', 'anger', 'architecture', 'art', 'attitude',
  'beauty', 'best', 'birthday', 'business', 'car', 'change', 'communications',
  'computers', 'cool', 'courage', 'dad', 'dating', 'death', 'design',
  'dreams', 'education', 'environmental', 'equality', 'experience', 'failure',
  'faith', 'family', 'famous', 'fear', 'fitness', 'food', 'forgiveness',
  'freedom', 'friendship', 'funny', 'future', 'god', 'good', 'government',
  'graduation', 'great', 'happiness', 'health', 'history', 'home', 'hope',
  'humor', 'imagination', 'inspirational', 'intelligence', 'jealousy',
  'knowledge', 'leadership', 'learning', 'legal', 'life', 'love', 'marriage',
  'medical', 'men', 'mom', 'money', 'morning', 'movies', 'success',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('randomquote')
    .setDescription('Generate a quote image from a random inspirational quote')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Quote category (uses built-in list if no API key is set)')
        .addChoices(
          ...CATEGORIES.slice(0, 25).map(c => ({ name: c.charAt(0).toUpperCase() + c.slice(1), value: c })),
        )),

  async execute(interaction) {
    await interaction.deferReply();

    const category = interaction.options.getString('category');

    let quoteData;
    try {
      quoteData = await fetchRemoteQuote(category);
    } catch {
      quoteData = null;
    }

    if (!quoteData) {
      quoteData = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    }

    const settings = getUserSettings(interaction.user.id, interaction.guildId);

    try {
      const { attachment, components, buffer } = await buildQuoteReply({
        text:          quoteData.q,
        authorName:    quoteData.a,
        avatarUrl:     null,
        theme:         settings.theme,
        accentColor:   settings.accentColor,
        font:          settings.font,
        showAvatar:    false,
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
      console.error('[/randomquote] Error:', err);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor('#ED4245')
          .setDescription('❌ Failed to generate the quote image. Please try again.')],
      });
    }
  },
};
