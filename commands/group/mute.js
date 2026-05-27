// commands/group/mute.js
export const name = 'mute'
export const alias = ['close', 'gcmute', 'lock']
export const category = 'Group'
export const desc = 'Close group for a duration. Usage: mute 1h reason'

async function getBrandName(botSettings) {
  if (!botSettings.supabase) return 'Bot'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
 .from('b_settings')
 .select('brand_name, botname')
 .eq('id', instanceId)
 .maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

function parseDuration(input) {
  const match = /^(\d+)(s|m|h|d)$/.exec(input.toLowerCase())
  if (!match) return null
  const value = parseInt(match[1])
  const unit = match[2]
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[unit] * 1000
}

function formatDuration(ms) {
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

export default async function mute(sock, { msg, from, args }, botSettings) {
  try {
    if (!msg.key.remoteJid.endsWith('@g.us')) {
      return await sock.sendMessage(from, {
        text: '> This command only works in groups.'
      }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)

    // If no args, show status and usage
    if (!args.length) {
      const groupMeta = await sock.groupMetadata(from)
      const isClosed = groupMeta.announce === true

      await sock.sendMessage(from, { react: { text: '🔒', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ GROUP MUTE ⌋
│ Status: ${isClosed? 'CLOSED 🔒' : 'OPEN 🔓'}
│
│ Usage:
│ ${botSettings.prefix}mute 1h reason
│ ${botSettings.prefix}mute 30min spam
│ ${botSettings.prefix}mute off
│
│ Durations: 30s, 5min, 2h, 1d
│ Only admins can send messages when closed.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Unmute
    if (args[0].toLowerCase() === 'off' || args[0].toLowerCase() === 'open') {
      await sock.groupSettingUpdate(from, 'not_announcement')
      await sock.sendMessage(from, { react: { text: '🔓', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ GROUP OPENED ⌋
│ Group is now open for everyone.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Get duration and reason
    const durationStr = args[0]
    const durationMs = parseDuration(durationStr)
    if (!durationMs) {
      return await sock.sendMessage(from, {
        text: '> Invalid duration. Use 30s, 5min, 2h, 1d'
      }, { quoted: msg })
    }

    const reason = args.slice(1).join(' ') || 'No reason'

    // Close group
    await sock.groupSettingUpdate(from, 'announcement')

    await sock.sendMessage(from, { react: { text: '🔒', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ GROUP CLOSED ⌋
│ Duration: ${formatDuration(durationMs)}
│ Reason: ${reason}
│
│ Only admins can send messages now.
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

    // Auto open after duration
    setTimeout(async () => {
      try {
        const meta = await sock.groupMetadata(from)
        if (meta.announce === true) {
          await sock.groupSettingUpdate(from, 'not_announcement')
          await sock.sendMessage(from, {
            text: `╭─⌈ GROUP AUTO OPENED ⌋
│ Mute time is over. Group is now open.
╰⊷ *Powered By ${brandName}*`
          })
        }
      } catch (err) {
        console.error('[AUTO UNMUTE ERROR]', err.message)
      }
    }, durationMs)

  } catch (err) {
    console.error('[MUTE ERROR]', err)
    await sock.sendMessage(from, {
      text: '> Failed to mute group. Make sure I am admin.'
    }, { quoted: msg })
  }
}