// commands/profile/getpp.js
export const name = 'getpp'
export const alias = ['pp', 'getdp', 'dp', 'getprofile']
export const category = 'Profile'
export const desc = 'Get profile picture - supports tags, numbers, reply'

export default async function getpp(sock, { msg, from, args }, botSettings) {
  const prefix = botSettings?.prefix || '.'
  const brandName = botSettings?.brand_name || botSettings?.botname || 'Bot'

  try {
    await sock.sendMessage(from, { react: { text: '🤘', key: msg.key } }).catch(() => {})

    // Get targets from mention, reply, or args
    const quoted = msg.message?.extendedTextMessage?.contextInfo
    const mentioned = quoted?.mentionedJid || []
    const replied = quoted?.participant
    const textArgs = args.filter(a => /^[0-9+]+$/.test(a))

    let targets = []

    if (mentioned.length > 0) {
      targets.push(...mentioned)
    } else if (replied) {
      targets.push(replied)
    } else if (textArgs.length > 0) {
      for (const num of textArgs) {
        const cleanNum = num.replace(/[^0-9]/g, '')
        if (cleanNum.length >= 7 && cleanNum.length <= 15) {
          targets.push(cleanNum + '@s.whatsapp.net')
        }
      }
    } else {
      targets.push(msg.key.participant || msg.key.remoteJid)
    }

    if (targets.length === 0) throw new Error('NO_TARGET')

    // Limit to 5 to avoid spam
    if (targets.length > 5) {
      await sock.sendMessage(from, {
        text: `> ⚠️ Max 5 users at once\n> Processing first 5 only`
      }, { quoted: msg })
      targets = targets.slice(0, 5)
    }

    let successCount = 0

    for (let i = 0; i < targets.length; i++) {
      const targetJid = targets[i]

      try {
        // Check if number exists on WhatsApp
        const [result] = await sock.onWhatsApp(targetJid)
        if (!result?.exists) {
          await sock.sendMessage(from, {
            text: `> ❌ User ${i + 1}: ${targetJid.split('@')[0]}\n> Not registered on WhatsApp`
          }, { quoted: msg })
          continue
        }

        const correctJid = result.jid

        // Get profile picture
        let ppUrl
        try {
          ppUrl = await sock.profilePictureUrl(correctJid, 'image')
        } catch (error) {
          if (error.output?.statusCode === 404) {
            await sock.sendMessage(from, {
              text: `> 📭 +${correctJid.split('@')[0]}\n> No profile picture`
            }, { quoted: msg })
          } else if (error.output?.statusCode === 403) {
            await sock.sendMessage(from, {
              text: `> 🔒 +${correctJid.split('@')[0]}\n> Picture hidden by privacy`
            }, { quoted: msg })
          } else if (error.output?.statusCode === 401) {
            await sock.sendMessage(from, {
              text: `> 🚫 +${correctJid.split('@')[0]}\n> You may be blocked`
            }, { quoted: msg })
          }
          continue
        }

        if (!ppUrl) continue

        const number = correctJid.split('@')[0]

        const caption = `╭─⌈ 🖼️ *PROFILE PICTURE* ⌋
│ Number: +${number}
╰⊷ *${brandName}*`

        await sock.sendMessage(from, {
          image: { url: ppUrl },
          caption: caption,
          mentions: [correctJid]
        }, { quoted: msg })

        successCount++

        // Rate limit
        if (i < targets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (err) {
        console.log(`Failed for ${targetJid}: ${err.message}`)
        continue
      }
    }

    // Final reaction
    if (successCount > 0) {
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {})
    } else {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {})
      await sock.sendMessage(from, {
        text: `> ❌ Failed to fetch any profile pictures\n> Check numbers or privacy settings\n> Usage: ${prefix}getpp @user1 @user2`
      }, { quoted: msg })
    }

  } catch (error) {
    console.error('[GETPP ERROR]', error.message)

    let errorMsg = '> Failed to fetch profile picture'

    if (error.message === 'NO_TARGET') {
      errorMsg = '> Could not identify target user\n> Tag, reply, or provide number'
    }

    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg }).catch(() => {})
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {})
  }
}