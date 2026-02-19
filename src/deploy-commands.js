'use strict';

/**
 * deploy-commands.js
 *
 * Registers all slash commands and context menu commands with Discord.
 *
 * Usage:
 *   node src/deploy-commands.js          → global deployment
 *   GUILD_ID=<id> node src/deploy-commands.js  → guild-only (instant, for testing)
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const { REST, Routes } = require('@discordjs/rest');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('❌  Missing DISCORD_TOKEN or CLIENT_ID in your .env file.');
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'commands');
const commands    = [];

for (const file of fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(commandsDir, file));
  if (cmd.data) {
    commands.push(cmd.data.toJSON());
    console.log(`  📦 Queued: ${cmd.data.name}`);
  }
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`\n⬆️  Deploying ${commands.length} command(s)…`);

    if (GUILD_ID) {
      // Guild deployment — appears instantly, ideal for development
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log(`✅ Deployed to guild ${GUILD_ID}`);
    } else {
      // Global deployment — can take up to 1 hour to propagate
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Deployed globally (may take up to 1 hour to propagate)');
    }
  } catch (err) {
    console.error('❌ Deployment failed:', err);
    process.exit(1);
  }
})();
