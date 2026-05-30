// commands/settings/setbrandname.js
export const name = 'setbrandname'
export const alias = ['brandname', 'setbrand', 'brand']
export const category = 'Settings'
export const desc = 'Change brand name shown in messages'

export default async function setbrandname(sock, { msg, from, sender }, botSettings) {
  try {
    // Angalia kama database ipo
    if (!botSettings.supabase ||!botSettings.instance_id) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const newBrand = args.join(' ').trim()

    const instanceId = botSettings.instance_id // KILA BOT NA DATA ZAKE - NO DEFAULT

    // Chukua settings za instance hii - KAMA INDEX.JS
    const { data: settings } = await botSettings.supabase
   .from('b_settings')
   .select('brand_name, botname, prefix')
   .eq('id', instanceId)
   .maybeSingle()

    const currentBrand = settings?.brand_name || settings?.botname || 'dgift-bot'
    const botname = settings?.botname || 'dgift-bot'
    const prefix = settings?.prefix || '.'

    // Onyesha status kama hakuna brand mpya
    if (!newBrand) {
      await sock.sendMessage(from, { react: { text: '🏷️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🏷️ *Brand Name Control* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ Current Brand: ${currentBrand}
│
│ Usage:
│ ${prefix}setbrandname Bunny Tech
│ ${prefix}setbrandname Dgift-MD
│
│ Note: Name inayotumika footer za message
╰⊷ *${botname}*`
      }, { quoted: msg })
    }

    // Hakikisha brand sio ndefu sana
    if (newBrand.length > 30) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: '> Brand name too long. Max 30 characters.' }, { quoted: msg })
    }

    // Angalia kama brand ni ileile
    if (newBrand === currentBrand) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Brand name is already set to "${currentBrand}"` }, { quoted: msg })
    }

    // Sasisha database kwa upsert - KAMA INDEX.JS
    const { error } = await botSettings.supabase
   .from('b_settings')
   .upsert({
        id: instanceId,
        brand_name: newBrand,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    // Sasisha live memory
    botSettings.brand_name = newBrand

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ ✅ *Brand Name Updated* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ Old: ${currentBrand}
│ New: ${newBrand}
│ Status: Applied instantly
│
│ All message footers will use the new brand name now
╰⊷ *${newBrand}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[SETBRANDNAME CMD ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed to update brand name.' }, { quoted: msg })
  }
}