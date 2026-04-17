const dotenv = require("dotenv");

dotenv.config();

const requiredKeys = [
  "DISCORD_TOKEN",
  "GUILD_ID",
  "VOICE_CHANNEL_ID",
  "GUARD_LOG_CHANNEL_ID",
  "OWNER_ID"
];

for (const key of requiredKeys) {
  if (!process.env[key]) {
    throw new Error(`${key} environment variable is required.`);
  }
}

function parseIdList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

const safeUserIds = parseIdList(process.env.SAFE_USER_IDS);
safeUserIds.add(process.env.OWNER_ID);

module.exports = {
  token: process.env.DISCORD_TOKEN,
  guildId: process.env.GUILD_ID,
  voiceChannelId: process.env.VOICE_CHANNEL_ID,
  guardLogChannelId: process.env.GUARD_LOG_CHANNEL_ID,
  ownerId: process.env.OWNER_ID,
  safeUserIds,
  statusText: process.env.STATUS_TEXT || "Developed By Cyrus",
  streamUrl: process.env.STREAM_URL || "https://www.twitch.tv/cyrus",
  databaseUrl: process.env.DATABASE_URL || ""
};
