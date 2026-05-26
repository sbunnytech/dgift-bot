// commands/tools/profile.js
export const name = 'profile'
export const alias = ['userprofile', 'pinfo', 'whois']
export const category = 'Tools'
export const desc = 'Get user profile info, picture, and about'

export default async function profile(sock, { msg, from, args, quoted, sender }, botSettings) {
  try {
    const brand = botSettings?.brand_name || botSettings?.botname || 'DGIFT BOT'

    await sock.sendMessage(from, { react: { text: '👤', key: msg.key } })

    // Determine target user
    let targetJid = sender
    if (quoted) {
      targetJid = quoted.sender || quoted.participant || quoted.key.participant
    } else if (args[0]) {
      let num = args[0].replace(/[^0-9]/g, '')
      if (!num.endsWith('@s.whatsapp.net')) num += '@s.whatsapp.net'
      targetJid = num
    }

    // Get profile picture
    let ppUrl = null
    try {
      ppUrl = await sock.profilePictureUrl(targetJid, 'image')
    } catch {
      ppUrl = null
    }

    // Get about/status
    let about = 'Hidden'
    try {
      const status = await sock.fetchStatus(targetJid)
      about = status.status || 'No about set'
    } catch {
      about = 'Hidden or not available'
    }

    // Check if on WhatsApp
    const onWA = await sock.onWhatsApp(targetJid)
    const isOnWA = onWA.length > 0? 'Yes' : 'No'

    // Get number info
    const number = targetJid.split('@')[0]
    const accountType = targetJid.includes('@lid')? 'Unknown' : 'Personal'

    const caption = `╭─⌈ 👤 *USER PROFILE* ⌋
│
│ Number: +${number}
│ Type: ${accountType}
│ On WhatsApp: ${isOnWA}
│ About: ${about}
│
╰⊷ *Powered By ${brand}*`

    // Send result directly
    if (ppUrl) {
      await sock.sendMessage(from, {
        image: { url: ppUrl },
        caption: caption
      }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: caption
      }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {})

  } catch (error) {
    console.error('[PROFILE ERROR]', error.message)
    await sock.sendMessage(from, {
      text: `╭─⌈ ❌ *ERROR* ⌋
│
│ Failed to fetch profile
│ Reason: ${error.message}
│
╰⊷ *Powered By ${botSettings?.brand_name || 'DGIFT BOT'}*`
    }, { quoted: msg })
  }
}