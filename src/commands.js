const {
  Events,
  PermissionFlagsBits,
  SlashCommandBuilder
} = require("discord.js");
const { guildId, ownerId } = require("./config");
const { sendGuardLog } = require("./logger");
const {
  ACTIONS,
  addGuardPermission,
  getUserPermissions,
  listGuardPermissions,
  removeGuardPermission
} = require("./permissions");

const actionChoices = [
  { name: "kick", value: ACTIONS.kick },
  { name: "ban", value: ACTIONS.ban },
  { name: "bot", value: ACTIONS.bot },
  { name: "channel_delete", value: ACTIONS.channel_delete },
  { name: "channel_update", value: ACTIONS.channel_update },
  { name: "role_delete", value: ACTIONS.role_delete },
  { name: "role_update", value: ACTIONS.role_update },
  { name: "full", value: ACTIONS.full }
];

function canManageGuards(interaction) {
  return interaction.user.id === ownerId || interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

async function registerSlashCommands(client) {
  const commands = [
    new SlashCommandBuilder()
      .setName("guardekle")
      .setDescription("Bir kullaniciya guard yetkisi ekler.")
      .addUserOption((option) =>
        option.setName("uye").setDescription("Yetki verilecek uye").setRequired(true)
      )
      .addStringOption((option) => {
        option.setName("yetki").setDescription("Verilecek guard yetkisi").setRequired(true);
        for (const choice of actionChoices) {
          option.addChoices(choice);
        }
        return option;
      }),
    new SlashCommandBuilder()
      .setName("guardcikar")
      .setDescription("Bir kullanicidan guard yetkisi kaldirir.")
      .addUserOption((option) =>
        option.setName("uye").setDescription("Yetkisi alinacak uye").setRequired(true)
      )
      .addStringOption((option) => {
        option.setName("yetki").setDescription("Kaldirilacak guard yetkisi").setRequired(true);
        for (const choice of actionChoices) {
          option.addChoices(choice);
        }
        return option;
      }),
    new SlashCommandBuilder()
      .setName("guardliste")
      .setDescription("Sunucudaki guard yetkilerini listeler."),
    new SlashCommandBuilder()
      .setName("guardgoster")
      .setDescription("Bir kullanicinin guard yetkilerini gosterir.")
      .addUserOption((option) =>
        option.setName("uye").setDescription("Yetkileri gosterilecek uye").setRequired(true)
      )
  ].map((command) => command.toJSON());

  const guild = await client.guilds.fetch(guildId);
  await guild.commands.set(commands);
}

async function handleGuardAdd(interaction) {
  const member = interaction.options.getUser("uye", true);
  const action = interaction.options.getString("yetki", true);
  const permissions = await addGuardPermission(interaction.guild.id, member.id, action);

  await interaction.reply({
    content: `<@${member.id}> icin \`${action}\` guard yetkisi eklendi. Aktif yetkiler: ${permissions.join(", ")}`,
    ephemeral: true
  });
}

async function handleGuardRemove(interaction) {
  const member = interaction.options.getUser("uye", true);
  const action = interaction.options.getString("yetki", true);
  const permissions = await removeGuardPermission(interaction.guild.id, member.id, action);

  await interaction.reply({
    content: permissions.length > 0
      ? `<@${member.id}> icin \`${action}\` guard yetkisi kaldirildi. Kalan yetkiler: ${permissions.join(", ")}`
      : `<@${member.id}> icin guard yetkileri temizlendi.`,
    ephemeral: true
  });
}

async function handleGuardList(interaction) {
  const permissions = listGuardPermissions(interaction.guild.id);
  const rows = Object.entries(permissions);

  if (rows.length === 0) {
    await interaction.reply({
      content: "Bu sunucuda tanimli guard yetkisi yok.",
      ephemeral: true
    });
    return;
  }

  const lines = rows.map(([userId, actions]) => `<@${userId}> -> ${actions.join(", ")}`);
  await interaction.reply({
    content: lines.join("\n").slice(0, 1900),
    ephemeral: true
  });
}

async function handleGuardShow(interaction) {
  const member = interaction.options.getUser("uye", true);
  const permissions = getUserPermissions(interaction.guild.id, member.id);

  await interaction.reply({
    content: permissions.length > 0
      ? `<@${member.id}> guard yetkileri: ${permissions.join(", ")}`
      : `<@${member.id}> icin tanimli bir guard yetkisi yok.`,
    ephemeral: true
  });
}

function registerCommandHandlers(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || interaction.guildId !== guildId) {
      return;
    }

    if (!canManageGuards(interaction)) {
      await interaction.reply({
        content: "Bu komutu kullanmak icin owner ya da admin olmalisin.",
        ephemeral: true
      }).catch(() => null);
      return;
    }

    try {
      if (interaction.commandName === "guardekle") {
        await handleGuardAdd(interaction);
      } else if (interaction.commandName === "guardcikar") {
        await handleGuardRemove(interaction);
      } else if (interaction.commandName === "guardliste") {
        await handleGuardList(interaction);
      } else if (interaction.commandName === "guardgoster") {
        await handleGuardShow(interaction);
      }
    } catch (error) {
      await sendGuardLog(client, {
        title: "Slash Komut Hatasi",
        description: `\`\`\`${String(error).slice(0, 3900)}\`\`\``,
        color: 0xed4245
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: "Komut islenirken hata olustu.", ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ content: "Komut islenirken hata olustu.", ephemeral: true }).catch(() => null);
      }
    }
  });
}

module.exports = {
  registerCommandHandlers,
  registerSlashCommands
};
