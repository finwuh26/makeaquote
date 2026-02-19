'use strict';

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/**
 * Ensure the data directory and settings file exist.
 */
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ users: {}, guilds: {} }, null, 2));
}

/**
 * Load all settings from disk.
 * @returns {{ users: Object, guilds: Object }}
 */
function load() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    return { users: {}, guilds: {} };
  }
}

/**
 * Persist settings to disk.
 * @param {{ users: Object, guilds: Object }} data
 */
function save(data) {
  ensureStore();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
}

// ──────────────────────────────────────────────
// User settings
// ──────────────────────────────────────────────

const USER_DEFAULTS = {
  theme: 'dark',
  accentColor: '#5865F2',
  showAvatar: true,
  showTimestamp: true,
  showServer: true,
  font: 'serif',
};

/**
 * Get merged settings for a user (user prefs over guild prefs over defaults).
 * @param {string} userId
 * @param {string|null} guildId
 * @returns {Object}
 */
function getUserSettings(userId, guildId = null) {
  const store = load();
  const guild = guildId ? (store.guilds[guildId] || {}) : {};
  const user = store.users[userId] || {};
  return { ...USER_DEFAULTS, ...guild, ...user };
}

/**
 * Persist a partial settings update for a user.
 * @param {string} userId
 * @param {Object} patch
 */
function setUserSettings(userId, patch) {
  const store = load();
  store.users[userId] = { ...(store.users[userId] || {}), ...patch };
  save(store);
}

// ──────────────────────────────────────────────
// Guild settings
// ──────────────────────────────────────────────

/**
 * Get settings for a guild.
 * @param {string} guildId
 * @returns {Object}
 */
function getGuildSettings(guildId) {
  const store = load();
  return { ...USER_DEFAULTS, ...(store.guilds[guildId] || {}) };
}

/**
 * Persist a partial settings update for a guild.
 * @param {string} guildId
 * @param {Object} patch
 */
function setGuildSettings(guildId, patch) {
  const store = load();
  store.guilds[guildId] = { ...(store.guilds[guildId] || {}), ...patch };
  save(store);
}

module.exports = {
  getUserSettings,
  setUserSettings,
  getGuildSettings,
  setGuildSettings,
};
