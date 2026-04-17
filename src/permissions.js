const path = require("path");
const fs = require("fs-extra");
const { Pool } = require("pg");
const { databaseUrl } = require("./config");

const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "guard-permissions.json");

const ACTIONS = {
  kick: "kick",
  ban: "ban",
  bot: "bot",
  channel_delete: "channel_delete",
  channel_update: "channel_update",
  role_delete: "role_delete",
  role_update: "role_update",
  full: "full"
};

let store = {};
let pool = null;
let storageMode = "json";

function getPool() {
  if (!databaseUrl) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false }
    });
  }

  return pool;
}

async function initializeDatabase() {
  const client = getPool();
  if (!client) {
    storageMode = "json";
    return;
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS guard_permissions (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  storageMode = "postgres";
}

async function loadFromJson() {
  await fs.ensureDir(dataDir);
  const exists = await fs.pathExists(dataFile);

  if (!exists) {
    store = {};
    await fs.writeJson(dataFile, store, { spaces: 2 });
    return store;
  }

  store = await fs.readJson(dataFile).catch(() => ({}));
  return store;
}

async function loadFromDatabase() {
  const client = getPool();
  const result = await client.query("SELECT guild_id, user_id, actions FROM guard_permissions");
  store = {};

  for (const row of result.rows) {
    if (!store[row.guild_id]) {
      store[row.guild_id] = {};
    }

    store[row.guild_id][row.user_id] = Array.isArray(row.actions) ? row.actions : [];
  }

  return store;
}

async function persistGuildUser(guildId, userId) {
  if (storageMode === "postgres") {
    const client = getPool();
    const actions = store[guildId]?.[userId];

    if (!actions || actions.length === 0) {
      await client.query("DELETE FROM guard_permissions WHERE guild_id = $1 AND user_id = $2", [guildId, userId]);
      return;
    }

    await client.query(
      `
        INSERT INTO guard_permissions (guild_id, user_id, actions, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW())
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET actions = EXCLUDED.actions, updated_at = NOW()
      `,
      [guildId, userId, JSON.stringify(actions)]
    );

    return;
  }

  await fs.ensureDir(dataDir);
  await fs.writeJson(dataFile, store, { spaces: 2 });
}

async function loadPermissionStore() {
  await initializeDatabase().catch(() => {
    storageMode = "json";
  });

  if (storageMode === "postgres") {
    return loadFromDatabase();
  }

  return loadFromJson();
}

function getGuildPermissions(guildId) {
  return store[guildId] || {};
}

function getUserPermissions(guildId, userId) {
  const guildPermissions = getGuildPermissions(guildId);
  return guildPermissions[userId] || [];
}

function hasGuardPermission(guildId, userId, action) {
  const permissions = getUserPermissions(guildId, userId);
  return permissions.includes(ACTIONS.full) || permissions.includes(action);
}

async function addGuardPermission(guildId, userId, action) {
  if (!store[guildId]) {
    store[guildId] = {};
  }

  const current = new Set(store[guildId][userId] || []);
  current.add(action);
  store[guildId][userId] = [...current];
  await persistGuildUser(guildId, userId);
  return store[guildId][userId];
}

async function removeGuardPermission(guildId, userId, action) {
  if (!store[guildId]?.[userId]) {
    return [];
  }

  if (action === ACTIONS.full) {
    delete store[guildId][userId];
    await persistGuildUser(guildId, userId);
    return [];
  }

  store[guildId][userId] = store[guildId][userId].filter((item) => item !== action && item !== ACTIONS.full);

  if (store[guildId][userId].length === 0) {
    delete store[guildId][userId];
  }

  await persistGuildUser(guildId, userId);
  return store[guildId]?.[userId] || [];
}

function listGuardPermissions(guildId) {
  return getGuildPermissions(guildId);
}

function getStorageMode() {
  return storageMode;
}

module.exports = {
  ACTIONS,
  addGuardPermission,
  getStorageMode,
  getUserPermissions,
  hasGuardPermission,
  listGuardPermissions,
  loadPermissionStore,
  removeGuardPermission
};
