// observers/joinapproval.js
async function getGroupSettings(botSettings, targetId) {
  if (!botSettings?.supabase) return null

  const { data: groupSettings } = await botSettings.supabase
.from('b_settings')
.select('join_approval, join_requests, botname')
.eq('id', targetId)
.maybeSingle()

  if (groupSettings?.join_approval!== undefined) return groupSettings

  const { data: globalSettings } = await botSettings.supabase
.from('b_settings')
.select('join_approval, join_requests, botname')
.eq('id', 'DGIFT_DEFAULT')
.maybeSingle()

  return globalSettings
}

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

export const name = 'joinapproval'

export default async function joinApprovalObserver(sock, event, botSettings) {
  try {
    const { id: groupId, participants, action } = event
    if (action!== 'add') return
    if (!botSettings.supabase) return

    const settings = await getGroupSettings(botSettings, groupId)
    if (!settings?.join_approval) return

    const brandName = await getBrandName(botSettings)
    const botName = settings.botname || brandName
    const groupMeta = await sock.groupMetadata(groupId).catch(() => null)
    const groupName = groupMeta?.subject || 'this group'
    const prefix = botSettings.prefix || '.'

    let currentRequests = settings.join_requests || []

    for (const userId of participants) {
      // Check if already pending
      const alreadyExists = currentRequests.some(req => req.user_id === userId)
      if (alreadyExists) continue

      // Add to array
      currentRequests.push({
        user_id: userId,
        requested_at: new Date().toISOString()
      })

      // Update DB
      const { error } = await botSettings.supabase
    .from('b_settings')
    .update({ join_requests: currentRequests })
    .eq('id', groupId)

      if (error) {
        console.error('[JOINAPPROVAL DB ERROR]', error)
        continue
      }

      // Send notice to group with dynamic prefix
      let noticeText = `╭─⌈ 🔐 *Join Request* ⌋\n`
      noticeText += `│ Bot: ${botName}\n`
      noticeText += `│ Group: ${groupName}\n`
      noticeText += `│ User: @${userId.split('@')[0]}\n`
      noticeText += `│\n`
      noticeText += `│ This user wants to join.\n`
      noticeText += `│ Admins use: ${prefix}joinapproval approve\n`
      noticeText += `╰⊷ *Powered By ${brandName}*`

      await sock.sendMessage(groupId, {
        text: noticeText,
        mentions: [userId]
      }).catch(() => {})

      // Auto-reject until approved
      await sock.groupRequestParticipantsUpdate(groupId, [userId], 'reject').catch(() => {})
    }
  } catch (err) {
    console.error('[JOINAPPROVAL OBSERVER ERROR]', err.message)
  }
}