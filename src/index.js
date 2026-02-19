'use strict';

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

// ─── Validate required environment variables ──────────────────────────────────
const { DISCORD_TOKEN, CLIENT_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌  Missing required environment variables.\n'
    + '    Copy .env.example to .env and fill in DISCORD_TOKEN and CLIENT_ID.');
  process.exit(1);
}

// ─── Create client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ─── Load commands ────────────────────────────────────────────────────────────
client.commands = new Collection();
const commandsDir = path.join(__dirname, 'commands');

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`  📦 Loaded command: ${command.data.name}`);
  }
}

// ─── Load events ──────────────────────────────────────────────────────────────
const eventsDir = path.join(__dirname, 'events');

for (const file of fs.readdirSync(eventsDir).filter(f => f.endsWith('.js'))) {
  const event = require(path.join(eventsDir, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`  📡 Registered event: ${event.name}`);
}

// ─── Login ────────────────────────────────────────────────────────────────────
client.login(DISCORD_TOKEN).catch(err => {
  console.error('❌  Failed to log in:', err.message);
  process.exit(1);
});
