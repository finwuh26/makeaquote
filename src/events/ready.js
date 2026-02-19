'use strict';

const { Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag} (${client.user.id})`);
    client.user.setActivity('/help • Make a Quote', { type: 3 /* Watching */ });
  },
};
