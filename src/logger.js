const { EmbedBuilder } = require("discord.js");
const { guardLogChannelId } = require("./config");

async function sendGuardLog(client, data) {
  const channel = await client.channels.fetch(guardLogChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(data.color || 0x5865f2)
    .setTitle(data.title || "Guard Log")
    .setDescription(data.description || "Detay yok.")
    .setTimestamp(new Date());

  if (Array.isArray(data.fields) && data.fields.length > 0) {
    embed.addFields(data.fields.slice(0, 25));
  }

  await channel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  sendGuardLog
};
