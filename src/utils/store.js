'use strict';

const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

/**
 * In-memory write-through cache.
 * Eliminates repeated synchronous disk reads on every settings lookup while
 * keeping persistence: every write goes to disk immediately.
 * @type {{ users: Object, guilds: Object } | null}
 */
let _cache = null;

/**
 * Ensure the data directory and settings file exist.
 */
function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SETTINGS_FILE)) fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ users: {}, guilds: {} }, null, 2));
}

/**
 * Load all settings (from cache when available, otherwise from disk).
 * @returns {{ users: Object, guilds: Object }}
 */
function load() {
  if (_cache) return _cache;
  ensureStore();
  try {
    _cache = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  } catch {
    _cache = { users: {}, guilds: {} };
  }
  return _cache;
}

/**
 * Persist settings to disk atomically (write to a temp file then rename) and
 * update the in-memory cache.
 * @param {{ users: Object, guilds: Object }} data
 */
function save(data) {
  ensureStore();
  _cache = data;
  const tmp = SETTINGS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, SETTINGS_FILE);
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

/** Guild-only defaults (never merged into user settings). */
const GUILD_ONLY_DEFAULTS = {
  redirectChannelId: null,
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
  return { ...USER_DEFAULTS, ...GUILD_ONLY_DEFAULTS, ...(store.guilds[guildId] || {}) };
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
