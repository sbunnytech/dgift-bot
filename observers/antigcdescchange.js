// observers/antichangegroupdescription.js
async function getBrandName(botSettings) {
  if (!botSettings?.supabase) return 'Bot'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
.from('b_settings')
.select('brand_name, botname')
.eq('id', instanceId)
.maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

async function getWarns(botSettings, groupId, userId) {
  const { data } = await botSettings.supabase
.from('warns')
.select('count')
.eq('group_id', groupId)
.eq('user_id', userId)
.maybeSingle()
  return data?.count || 0
}

async function addWarn(botSettings, groupId, userId, reason) {
  const current = await getWarns(botSettings, groupId, userId)
  const newCount = current + 1

  await botSettings.supabase
.from('warns')
.upsert({ group_id: groupId, user_id: userId, count: newCount, reason, updated_at: new Date().toISOString() },
  { onConflict: 'group_id,user_id' })

  return newCount
}

export default async function antichangegroupdescription(sock, event, botSettings) {
  try {
    const { id: groupId, desc, author } = event
    if (!author) return
    if (!botSettings?.supabase) return

    const { data: settings } = await botSettings.supabase
 .from('b_settings')
 .select('anti_change_group_description, warn_enabled, warn_limit, warn_action')
 .eq('id', groupId)
 .maybeSingle()

    if (!settings?.anti_change_group_description) return

    const brandName = await getBrandName(botSettings)
    const groupMeta = await sock.groupMetadata(groupId).catch(() => null)
    if (!groupMeta) return

    const currentDesc = groupMeta.desc || ''
    const storedDesc = settings.anti_change_group_description_settings?.original_desc

    // Hifadhi desc ya sasa mara ya kwanza
    if (!storedDesc) {
      await botSettings.supabase
.from('b_settings')
.update({
  anti_change_group_description_settings: { original_desc: currentDesc, enabled_at: new Date().toISOString() }
})
.eq('id', groupId)
      return
    }

    // Kama desc imebadilika, rudisha na adhibu
    if (currentDesc!== storedDesc) {
      await sock.groupUpdateDescription(groupId, storedDesc).catch(() => {})

      const warnCount = await addWarn(botSettings, groupId, author, 'Changed group description')

      await sock.sendMessage(groupId, {
text: `╭─⌈ 🚫 *AntiChangeGroupDescription* ⌋
│ User: @${author.split('@')[0]}
│ Action: Group description changed
│ Warn: ${warnCount}/${settings.warn_limit || 3}
│
│ Group description restored to original
╰⊷ *Powered By ${brandName}*`,
mentions: [author]
      }).catch(() => {})

      if (warnCount >= (settings.warn_limit || 3)) {
if (settings.warn_action === 'kick') {
  await sock.groupParticipantsUpdate(groupId, [author], 'remove').catch(() => {})
} else if (settings.warn_action === 'ban') {
  await botSettings.supabase
.from('bans')
.upsert({ group_id: groupId, user_id: author, banned_at: new Date().toISOString() },
  { onConflict: 'group_id,user_id' })
  await sock.groupParticipantsUpdate(groupId, [author], 'remove').catch(() => {})
}
      }
    }

  } catch (err) {
    console.log('[ANTICHANGEGROUPDESC ERROR]', err.message)
  }
}