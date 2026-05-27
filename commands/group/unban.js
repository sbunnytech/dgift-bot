// commands/group/unban.js
export const name = 'unban'
export const alias = ['unbanuser', 'editban']
export const category = 'Group'
export const desc = 'Unban user, edit ban time, edit reason, or list banned users'

export default async function unbanCommand(sock, { msg, from }, botSettings) {
  try {
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const subCmd = args[0]?.toLowerCase()

    // Show help if no subcommand
    if (!subCmd) {
      await sock.sendMessage(from, { react: { text: '🔓', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🔓 *Unban Manager* ⌋
│
│ Usage:
│ ${botSettings.prefix}unban @user
│ ${botSettings.prefix}unban time @user 2h
│ ${botSettings.prefix}unban reason @user new reason
│ ${botSettings.prefix}unban cancel @user
│ ${botSettings.prefix}unban list
│
│ Subcommands:
│ • time - Change ban duration
│ • reason - Change ban reason
│ • cancel - Remove ban completely
│ • list - Show all banned users
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })
    }

    // List all banned users
    if (subCmd === 'list') {
      const { data: bannedList } = await botSettings.supabase
   .from('banned_users')
   .select('user_id, reason, unban_at')
   .eq('group_id', from)
   .order('unban_at', { ascending: true })

      if (!bannedList || bannedList.length === 0) {
        return sock.sendMessage(from, { text: '> No banned users in this group.' }, { quoted: msg })
      }

      let listText = `╭─⌈ 🔓 *Banned Users* ⌋\n`
      bannedList.forEach((user, i) => {
        const timeLeft = new Date(user.unban_at).getTime() - Date.now()
        const timeStr = timeLeft > 0? formatDuration(timeLeft) : 'Expired'
        listText += `│ ${i + 1}. @${user.user_id.split('@')[0]}\n`
        listText += `│ Time: ${timeStr}\n`
        listText += `│ Reason: ${user.reason}\n`
      })
      listText += `╰⊷ *${botSettings.botname}*`

      return await sock.sendMessage(from, {
        text: listText,
        mentions: bannedList.map(u => u.user_id)
      }, { quoted: msg })
    }

    // Get target user
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentionedJid) {
      return sock.sendMessage(from, { text: '> Tag a user first.' }, { quoted: msg })
    }

    // Check if user is banned
    const { data: banData } = await botSettings.supabase
  .from('banned_users')
  .select('*')
  .eq('group_id', from)
  .eq('user_id', mentionedJid)
  .maybeSingle()

    if (!banData) {
      return sock.sendMessage(from, { text: '> This user is not banned.' }, { quoted: msg })
    }

    // Cancel ban completely
    if (subCmd === 'cancel') {
      await botSettings.supabase
   .from('banned_users')
   .delete()
   .eq('group_id', from)
   .eq('user_id', mentionedJid)

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🔓 *Ban Cancelled* ⌋
│ User: @${mentionedJid.split('@')[0]}
│ Ban has been removed completely.
╰⊷ *${botSettings.botname}*`,
        mentions: [mentionedJid]
      }, { quoted: msg })
    }

    // Edit ban time
    if (subCmd === 'time') {
      const newDuration = args[2]
      if (!newDuration) {
        return sock.sendMessage(from, { text: '> Specify new duration. Example: 2h, 30min' }, { quoted: msg })
      }

      const durationMs = parseDuration(newDuration)
      if (!durationMs) {
        return sock.sendMessage(from, { text: '> Invalid duration. Use 5min, 1h, 2d' }, { quoted: msg })
      }

      const newUnbanAt = new Date(Date.now() + durationMs).toISOString()

      await botSettings.supabase
   .from('banned_users')
   .update({ unban_at: newUnbanAt })
   .eq('group_id', from)
   .eq('user_id', mentionedJid)

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ ⏰ *Ban Time Updated* ⌋
│ User: @${mentionedJid.split('@')[0]}
│ New Duration: ${formatDuration(durationMs)}
│ New Unban Time: ${formatDuration(durationMs)} from now
╰⊷ *${botSettings.botname}*`,
        mentions: [mentionedJid]
      }, { quoted: msg })
    }

    // Edit ban reason
    if (subCmd === 'reason') {
      const newReason = args.slice(2).join(' ')
      if (!newReason) {
        return sock.sendMessage(from, { text: '> Specify new reason.' }, { quoted: msg })
      }

      await botSettings.supabase
   .from('banned_users')
   .update({ reason: newReason })
   .eq('group_id', from)
   .eq('user_id', mentionedJid)

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 📝 *Ban Reason Updated* ⌋
│ User: @${mentionedJid.split('@')[0]}
│ New Reason: ${newReason}
╰⊷ *${botSettings.botname}*`,
        mentions: [mentionedJid]
      }, { quoted: msg })
    }

    // Default: unban immediately - same as cancel
    await botSettings.supabase
  .from('banned_users')
  .delete()
  .eq('group_id', from)
  .eq('user_id', mentionedJid)

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ 🔓 *User Unbanned* ⌋
│ User: @${mentionedJid.split('@')[0]}
│ Ban has been removed.
╰⊷ *${botSettings.botname}*`,
      mentions: [mentionedJid]
    }, { quoted: msg })

  } catch (err) {
    console.error(`[UNBAN CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}

const parseDuration = (input) => {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.toLowerCase())
  if (!match) return null
  const value = parseInt(match[1])
  const unit = match[2]
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[unit] * 1000
}

const formatDuration = (ms) => {
  const sec = Math.floor(ms / 1000)
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}