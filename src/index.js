const {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Partials
} = require("discord.js");
const { registerCommandHandlers, registerSlashCommands } = require("./commands");
const { registerGuards } = require("./guards");
const { sendGuardLog } = require("./logger");
const { getStorageMode, loadPermissionStore } = require("./permissions");
const { statusText, streamUrl, token } = require("./config");
const { connectToVoice, registerVoiceGuard } = require("./voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.GuildMember, Partials.User]
});

client.once(Events.ClientReady, async (readyClient) => {
  await loadPermissionStore();
  await registerSlashCommands(readyClient);

  readyClient.user.setPresence({
    status: "online",
    activities: [
      {
        name: statusText,
        type: ActivityType.Streaming,
        url: streamUrl
      }
    ]
  });

  registerVoiceGuard(readyClient);
  await connectToVoice(readyClient);

  await sendGuardLog(readyClient, {
    title: "Cyrus Guard Aktif",
    description: `${readyClient.user.tag} guard sistemiyle birlikte baslatildi. Slash komutlar yuklendi. Veri modu: ${getStorageMode()}.`,
    color: 0x57f287
  });
});

client.on("warn", async (warning) => {
  await sendGuardLog(client, {
    title: "Discord Uyarisi",
    description: String(warning).slice(0, 4000),
    color: 0xfee75c
  });
});

client.on("error", async (error) => {
  await sendGuardLog(client, {
    title: "Discord Hatasi",
    description: `\`\`\`${String(error).slice(0, 3900)}\`\`\``,
    color: 0xed4245
  });
});

process.on("unhandledRejection", async (error) => {
  await sendGuardLog(client, {
    title: "Unhandled Rejection",
    description: `\`\`\`${String(error).slice(0, 3900)}\`\`\``,
    color: 0xed4245
  });
});

process.on("uncaughtException", async (error) => {
  await sendGuardLog(client, {
    title: "Uncaught Exception",
    description: `\`\`\`${String(error).slice(0, 3900)}\`\`\``,
    color: 0xed4245
  });
});

registerGuards(client);
registerCommandHandlers(client);

client.login(token).catch((error) => {
  console.error("[LOGIN ERROR]", error);
  process.exit(1);
});
