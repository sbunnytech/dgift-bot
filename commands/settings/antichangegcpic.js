// commands/settings/antichangegrouppicture.js
export const name = 'antichangegrouppicture'
export const alias = ['antigcpic', 'nochangepic']
export const category = 'Settings'
export const desc = 'Toggle anti change group picture on/off and set imgbb API'

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

export default async function antichangegrouppicture(sock, { msg, from }, botSettings) {
  try {
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()
    const apiKey = args[1]

    const targetJid = from

    const { data: settings } = await botSettings.supabase
.from('b_settings')
.select('anti_change_group_picture, imgbb_api, group_picture_url')
.eq('id', targetJid)
.maybeSingle()

    const currentValue = settings?.anti_change_group_picture || false

    if (!action) {
      await sock.sendMessage(from, { react: { text: '🖼️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🖼️ *AntiChangeGroupPicture Control* ⌋
│ Status: ${currentValue? 'ON ✅' : 'OFF ❌'}
│ Current API: ${settings?.imgbb_api? 'Custom' : 'Default'}
│
│ Usage:
│ ${botSettings.prefix}antichangegrouppicture on [imgbb_api]
│ ${botSettings.prefix}antichangegrouppicture off
│
│ Example:
│ ${botSettings.prefix}antichangegrouppicture on 123456abc
│
│ Note: Will save current picture and restore if changed
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    const newValue = ['on', 'enable', '1'].includes(action)
    if (newValue === currentValue &&!apiKey) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, { text: `> AntiChangeGroupPicture is already ${action}` }, { quoted: msg })
    }

    let updateData = {
      id: targetJid,
      anti_change_group_picture: newValue,
      updated_at: new Date().toISOString()
    }

    // Kama ameweka API key, hifadhi
    if (apiKey) {
      updateData.imgbb_api = apiKey
    }

    // Kama anawasha, hifadhi picha ya sasa
    if (newValue) {
      const groupMeta = await sock.groupMetadata(targetJid).catch(() => null)
      const ppUrl = await sock.profilePictureUrl(targetJid, 'image').catch(() => null)

      if (ppUrl) {
        updateData.group_picture_url = ppUrl // Itahifadhiwa vizuri na observer
      }
    }

    const { error } = await botSettings.supabase
.from('b_settings')
.upsert(updateData, { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: newValue? '✅' : '❌', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ 🖼️ *Settings Updated* ⌋
│ AntiChangeGroupPicture: ${newValue? 'ON ✅' : 'OFF ❌'}
│ Imgbb API: ${apiKey? 'Custom API Set' : settings?.imgbb_api? 'Using Saved API' : 'Using Default'}
│
│ ${newValue? 'Group picture changes will be reverted. Violators will be warned.' : 'Group picture can be changed freely.'}
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[ANTICHANGEGROUPPIC CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}