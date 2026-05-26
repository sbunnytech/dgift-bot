// commands/settings/antistatusmention.js
export const name = 'antistatusmention'
export const alias = ['antistatus', 'nostatusmention']
export const category = 'Settings'
export const desc = 'Toggle status mention blocker on/off'

export default async function antistatusmention(sock, { msg, from, sender }, botSettings) {
  try {
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()

    const targetJid = 'DGIFT_DEFAULT'

    const { data: settings } = await botSettings.supabase
  .from('b_settings')
  .select('antistatusmention')
  .eq('id', targetJid)
  .maybeSingle()

    const currentValue = settings?.antistatusmention || false

    if (!action) {
      await sock.sendMessage(from, { react: { text: '🚫', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🚫 *AntiStatusMention* ⌋
│ Status: ${currentValue? 'ON ✅' : 'OFF ❌'}
│ Target: Global
│
│ Usage:
│ ${botSettings.prefix}antistatusmention on
│ ${botSettings.prefix}antistatusmention off
│
│ Note: Blocks users from mentioning the bot in statuses
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })
    }

    const newValue = ['on', 'enable', '1'].includes(action)

    if (newValue === currentValue) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, { text: `> AntiStatusMention is already ${action}` }, { quoted: msg })
    }

    const { error } = await botSettings.supabase
  .from('b_settings')
  .upsert({
        id: targetJid,
        antistatusmention: newValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    botSettings.antistatusmention = newValue

    await sock.sendMessage(from, { react: { text: newValue? '✅' : '❌', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ 🚫 *Settings Updated* ⌋
│ AntiStatusMention: ${newValue? 'ON ✅' : 'OFF ❌'}
│ Target: Global
│
│ ${newValue? 'Bot mentions in statuses will be blocked.' : 'Status mentions are now allowed.'}
╰⊷ *${botSettings.botname}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[ANTISTATUS CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}