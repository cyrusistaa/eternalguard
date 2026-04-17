const {
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} = require("@discordjs/voice");
const { ChannelType } = require("discord.js");
const { voiceChannelId } = require("./config");
const { sendGuardLog } = require("./logger");

let reconnectTimer = null;

async function fetchTargetChannel(client) {
  const channel = await client.channels.fetch(voiceChannelId).catch(() => null);

  if (!channel) {
    await sendGuardLog(client, {
      title: "Ses Kanali Bulunamadi",
      description: "VOICE_CHANNEL_ID ile eslesen bir kanal bulunamadi.",
      color: 0xed4245
    });
    return null;
  }

  if (channel.type !== ChannelType.GuildVoice && channel.type !== ChannelType.GuildStageVoice) {
    await sendGuardLog(client, {
      title: "Ses Kanali Gecersiz",
      description: "Belirtilen kanal voice ya da stage voice olmali.",
      color: 0xed4245
    });
    return null;
  }

  if (!channel.joinable) {
    await sendGuardLog(client, {
      title: "Ses Kanalina Girilemiyor",
      description: "Botun hedef ses kanalina baglanma izni yok.",
      color: 0xed4245
    });
    return null;
  }

  return channel;
}

async function connectToVoice(client) {
  const channel = await fetchTargetChannel(client);
  if (!channel) {
    return null;
  }

  const previous = getVoiceConnection(channel.guild.id);
  if (previous) {
    previous.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
    group: client.user.id
  });

  connection.on("stateChange", async (_, nextState) => {
    if (nextState.status === VoiceConnectionStatus.Disconnected) {
      scheduleReconnect(client, 5000);
    }
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000).catch(() => null);

  await sendGuardLog(client, {
    title: "Ses Baglantisi Hazir",
    description: `Bot **${channel.name}** kanalina baglandi.`,
    color: 0x57f287
  });

  return connection;
}

function scheduleReconnect(client, delay = 5000) {
  if (reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectToVoice(client);
  }, delay);
}

function registerVoiceGuard(client) {
  client.on("voiceStateUpdate", async (oldState, newState) => {
    if (!client.user) {
      return;
    }

    if (oldState.id !== client.user.id && newState.id !== client.user.id) {
      return;
    }

    const targetChannel = await fetchTargetChannel(client);
    if (!targetChannel) {
      return;
    }

    if (newState.channelId !== targetChannel.id) {
      scheduleReconnect(client, 3000);
    }
  });
}

module.exports = {
  connectToVoice,
  registerVoiceGuard
};
