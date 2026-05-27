// commands/settings/antivideosending.js
export const name = 'antivideosending'
export const alias = ['antivideo', 'novideo']
export const category = 'Settings'
export const desc = 'Toggle anti video sending on/off'

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

export default async function antivideosending(sock, { msg, from }, botSettings) {
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
  .select('anti_video_sending')
  .eq('id', targetJid)
  .maybeSingle()

    const currentValue = settings?.anti_video_sending || false

    if (!action) {
      await sock.sendMessage(from, { react: { text: '🎥', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🎥 *AntiVideo Control* ⌋
│ Status: ${currentValue? 'ON ✅' : 'OFF ❌'}
│
│ Usage:
│ ${botSettings.prefix}antivideosending on
│ ${botSettings.prefix}antivideosending off
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    const newValue = ['on', 'enable', '1'].includes(action)
    if (newValue === currentValue) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, { text: `> AntiVideo is already ${action}` }, { quoted: msg })
    }

    const { error } = await botSettings.supabase
  .from('b_settings')
  .upsert({ id: targetJid, anti_video_sending: newValue, updated_at: new Date().toISOString() },
   { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: newValue? '✅' : '❌', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ 🎥 *Settings Updated* ⌋
│ AntiVideo: ${newValue? 'ON ✅' : 'OFF ❌'}
│
│ ${newValue? 'All videos will be deleted.' : 'Videos will be allowed.'}
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[ANTIVIDEO CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}