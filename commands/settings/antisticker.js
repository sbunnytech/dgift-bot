// commands/settings/antisticker.js
export const name = 'antisticker'
export const alias = ['antistick', 'nosticker']
export const category = 'Settings'
export const desc = 'Toggle anti sticker on/off'

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

export default async function antisticker(sock, { msg, from }, botSettings) {
  try {
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()

    const targetJid = 'DGIFT_DEFAULT'

    const { data: settings } = await botSettings.supabase
  .from('b_settings')
  .select('anti_sticker')
  .eq('id', targetJid)
  .maybeSingle()

    const currentValue = settings?.anti_sticker || false

    if (!action) {
      await sock.sendMessage(from, { react: { text: '🏷️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🏷️ *AntiSticker Control* ⌋
│ Status: ${currentValue? 'ON ✅' : 'OFF ❌'}
│
│ Usage:
│ ${botSettings.prefix}antisticker on
│ ${botSettings.prefix}antisticker off
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    const newValue = ['on', 'enable', '1'].includes(action)
    if (newValue === currentValue) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, { text: `> AntiSticker is already ${action}` }, { quoted: msg })
    }

    const { error } = await botSettings.supabase
  .from('b_settings')
  .upsert({ id: targetJid, anti_sticker: newValue, updated_at: new Date().toISOString() },
   { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: newValue? '✅' : '❌', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ 🏷️ *Settings Updated* ⌋
│ AntiSticker: ${newValue? 'ON ✅' : 'OFF ❌'}
│
│ ${newValue? 'All stickers will be deleted.' : 'Stickers will be allowed.'}
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[ANTISTICKER CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}