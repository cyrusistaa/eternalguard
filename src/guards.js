const {
  AuditLogEvent,
  ChannelType,
  Events,
  PermissionsBitField
} = require("discord.js");
const { guildId, ownerId, safeUserIds } = require("./config");
const { sendGuardLog } = require("./logger");
const { ACTIONS, hasGuardPermission } = require("./permissions");

function isSafe(userId) {
  return safeUserIds.has(userId) || userId === ownerId;
}

function isAllowed(guild, userId, action) {
  return isSafe(userId) || hasGuardPermission(guild.id, userId, action);
}

function isTargetGuild(guild) {
  return Boolean(guild && guild.id === guildId);
}

async function fetchAuditEntry(guild, type) {
  const logs = await guild.fetchAuditLogs({ type, limit: 6 }).catch(() => null);
  if (!logs) {
    return null;
  }

  const now = Date.now();
  return logs.entries.find((entry) => now - entry.createdTimestamp < 15_000) || null;
}

async function punishMember(guild, userId, reason) {
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    return false;
  }

  if (member.id === guild.ownerId) {
    return false;
  }

  if (member.manageable) {
    const removableRoles = member.roles.cache.filter((role) => role.id !== guild.id && role.editable);
    if (removableRoles.size > 0) {
      await member.roles.remove(removableRoles.map((role) => role.id), reason).catch(() => null);
    }
  }

  if (member.bannable) {
    await member.ban({ reason }).catch(() => null);
  }

  return true;
}

async function restoreChannel(channel) {
  if (!channel || !channel.guild) {
    return;
  }

  const parent = channel.parentId ?? null;

  if (channel.type === ChannelType.GuildCategory) {
    const recreated = await channel.guild.channels.create({
      name: channel.name,
      type: ChannelType.GuildCategory
    }).catch(() => null);
    await recreated?.setPosition(channel.rawPosition).catch(() => null);
    return;
  }

  const baseOptions = {
    name: channel.name,
    type: channel.type,
    parent,
    permissionOverwrites: channel.permissionOverwrites.cache.map((overwrite) => ({
      id: overwrite.id,
      allow: overwrite.allow.bitfield,
      deny: overwrite.deny.bitfield,
      type: overwrite.type
    }))
  };

  if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
    baseOptions.topic = channel.topic || null;
    baseOptions.nsfw = channel.nsfw;
    baseOptions.rateLimitPerUser = channel.rateLimitPerUser;
  }

  if (channel.type === ChannelType.GuildVoice) {
    baseOptions.bitrate = channel.bitrate;
    baseOptions.userLimit = channel.userLimit;
  }

  const recreated = await channel.guild.channels.create(baseOptions).catch(() => null);
  await recreated?.setPosition(channel.rawPosition).catch(() => null);
}

async function restoreRole(role) {
  if (!role || !role.guild) {
    return;
  }

  const recreated = await role.guild.roles.create({
    name: role.name,
    color: role.color,
    hoist: role.hoist,
    mentionable: role.mentionable,
    permissions: role.permissions.bitfield
  }).catch(() => null);
  await recreated?.setPosition(role.position).catch(() => null);
}

async function handleUnauthorizedAction(client, options) {
  const { guild, executorId, title, description, restore } = options;

  const punished = await punishMember(guild, executorId, `[CYRUS GUARD] ${title}`);

  if (typeof restore === "function") {
    await restore().catch(() => null);
  }

  await sendGuardLog(client, {
    title,
    description,
    color: 0xed4245,
    fields: [
      {
        name: "Islem Yapan",
        value: `<@${executorId}> (${executorId})`,
        inline: false
      },
      {
        name: "Mudahale",
        value: punished ? "Roller temizlendi, uygunsa banlandi." : "Kullaniciya tam mudahale uygulanamadi.",
        inline: false
      }
    ]
  });
}

function registerGuards(client) {
  client.on(Events.ChannelDelete, async (channel) => {
    if (!isTargetGuild(channel.guild)) {
      return;
    }

    const entry = await fetchAuditEntry(channel.guild, AuditLogEvent.ChannelDelete);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(channel.guild, executorId, ACTIONS.channel_delete)) {
      return;
    }

    await handleUnauthorizedAction(client, {
      guild: channel.guild,
      executorId,
      title: "Izinsiz Kanal Silme",
      description: `**${channel.name}** adli kanal izinsiz silindi ve yeniden olusturulmaya calisildi.`,
      restore: () => restoreChannel(channel)
    });
  });

  client.on(Events.RoleDelete, async (role) => {
    if (!isTargetGuild(role.guild)) {
      return;
    }

    const entry = await fetchAuditEntry(role.guild, AuditLogEvent.RoleDelete);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(role.guild, executorId, ACTIONS.role_delete)) {
      return;
    }

    await handleUnauthorizedAction(client, {
      guild: role.guild,
      executorId,
      title: "Izinsiz Rol Silme",
      description: `**${role.name}** rolu izinsiz silindi ve yeniden olusturulmaya calisildi.`,
      restore: () => restoreRole(role)
    });
  });

  client.on(Events.GuildBanAdd, async (ban) => {
    if (!isTargetGuild(ban.guild)) {
      return;
    }

    const entry = await fetchAuditEntry(ban.guild, AuditLogEvent.MemberBanAdd);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(ban.guild, executorId, ACTIONS.ban)) {
      return;
    }

    await ban.guild.members.unban(ban.user.id, "[CYRUS GUARD] Izinsiz ban geri alindi.").catch(() => null);

    await handleUnauthorizedAction(client, {
      guild: ban.guild,
      executorId,
      title: "Izinsiz Ban",
      description: `<@${ban.user.id}> kullanicisi izinsiz banlandi. Ban geri alindi.`,
      restore: null
    });
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    if (!isTargetGuild(member.guild)) {
      return;
    }

    if (!member.user.bot) {
      return;
    }

    const entry = await fetchAuditEntry(member.guild, AuditLogEvent.BotAdd);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(member.guild, executorId, ACTIONS.bot)) {
      return;
    }

    if (member.bannable) {
      await member.ban({ reason: "[CYRUS GUARD] Izinsiz bot ekleme." }).catch(() => null);
    }

    await handleUnauthorizedAction(client, {
      guild: member.guild,
      executorId,
      title: "Izinsiz Bot Ekleme",
      description: `**${member.user.tag}** boti izinsiz eklendi ve sunucudan uzaklastirilmaya calisildi.`,
      restore: null
    });
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    if (!isTargetGuild(member.guild)) {
      return;
    }

    const entry = await fetchAuditEntry(member.guild, AuditLogEvent.MemberKick);
    const executorId = entry?.executor?.id;

    if (!executorId || isAllowed(member.guild, executorId, ACTIONS.kick)) {
      return;
    }

    const sameTarget = entry.target?.id === member.id;
    if (!sameTarget) {
      return;
    }

    await handleUnauthorizedAction(client, {
      guild: member.guild,
      executorId,
      title: "Supheli Kick",
      description: `<@${member.id}> kullanicisi sunucudan atildi. Hedef kullanici geri getirilemez, ancak islem yapan kisi cezalandirildi.`,
      restore: null
    });
  });

  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!isTargetGuild(newChannel.guild)) {
      return;
    }

    if (oldChannel.name === newChannel.name) {
      return;
    }

    const entry = await fetchAuditEntry(newChannel.guild, AuditLogEvent.ChannelUpdate);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(newChannel.guild, executorId, ACTIONS.channel_update)) {
      return;
    }

    await newChannel.edit({ name: oldChannel.name }).catch(() => null);

    await handleUnauthorizedAction(client, {
      guild: newChannel.guild,
      executorId,
      title: "Izinsiz Kanal Guncelleme",
      description: `**${oldChannel.name}** kanalinda izinsiz degisiklik algilandi. Kanal adi geri alindi.`,
      restore: null
    });
  });

  client.on(Events.RoleUpdate, async (oldRole, newRole) => {
    if (!isTargetGuild(newRole.guild)) {
      return;
    }

    const nameChanged = oldRole.name !== newRole.name;
    const permsChanged = oldRole.permissions.bitfield !== newRole.permissions.bitfield;

    if (!nameChanged && !permsChanged) {
      return;
    }

    const entry = await fetchAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate);
    const executorId = entry?.executor?.id;
    if (!executorId || isAllowed(newRole.guild, executorId, ACTIONS.role_update)) {
      return;
    }

    await newRole.edit({
      name: oldRole.name,
      permissions: new PermissionsBitField(oldRole.permissions.bitfield)
    }).catch(() => null);

    await handleUnauthorizedAction(client, {
      guild: newRole.guild,
      executorId,
      title: "Izinsiz Rol Guncelleme",
      description: `**${oldRole.name}** rolundeki izinsiz degisiklikler geri alinmaya calisildi.`,
      restore: null
    });
  });
}

module.exports = {
  registerGuards
};
