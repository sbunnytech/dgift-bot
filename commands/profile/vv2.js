// commands/profile/vv2.js
export const name = 'vv2'
export const alias = ['vvv2', 'unviewonce2']
export const category = 'Profile'
export const desc = 'Silent reveal viewonce to bot DM'

import { downloadContentFromMessage, getContentType } from "@whiskeysockets/baileys"

export default async function vv2(sock, { msg, from, sender }, botSettings) {
  const ownerJid = botSettings.owner_number + '@s.whatsapp.net'
  const brandName = botSettings?.brand_name || botSettings?.botname || 'Bot'

  try {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    if (!quoted) {
      await sock.sendMessage(ownerJid, {
        text: `*VV2 Error*\n\nUser: ${sender}\nChat: ${from}\nReason: No quoted message`
      }).catch(() => {})
      return
    }

    // Shika ViewOnce v1, v2, v2Extension
    let viewOnce = quoted?.viewOnceMessageV2?.message ||
                   quoted?.viewOnceMessage?.message ||
                   quoted?.viewOnceMessageV2Extension?.message ||
                   quoted

    const type = getContentType(viewOnce)
    const media = viewOnce[type]

    const supportedTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']
    if (!type ||!supportedTypes.includes(type) ||!media?.viewOnce) {
      await sock.sendMessage(ownerJid, {
        text: `*VV2 Error*\n\nUser: ${sender}\nChat: ${from}\nReason: Not a viewonce or expired`
      }).catch(() => {})
      return
    }

    // Download media
    let mediaType = 'image'
    if (type === 'videoMessage') mediaType = 'video'
    if (type === 'audioMessage') mediaType = 'audio'
    if (type === 'documentMessage') mediaType = 'document'

    const stream = await downloadContentFromMessage(media, mediaType)
    let buffer = Buffer.from([])
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk])
    }

    if (!buffer || buffer.length === 0) {
      throw new Error('DOWNLOAD_FAILED')
    }

    const caption = `╭─⌈ 👀 *VIEWONCE REVEALED* ⌋
│ Type: ${mediaType}
│ From: ${sender.split('@')[0]}
│ Chat: ${from}
╰⊷ *${brandName}*`

    // Tuma DM ya bot owner tu
    if (type === 'imageMessage') {
      await sock.sendMessage(ownerJid, { image: buffer, caption: media.caption || caption })
    } else if (type === 'videoMessage') {
      await sock.sendMessage(ownerJid, {
        video: buffer,
        caption: media.caption || caption,
        gifPlayback: media.gifPlayback || false
      })
    } else if (type === 'audioMessage') {
      await sock.sendMessage(ownerJid, {
        audio: buffer,
        mimetype: media.mimetype || 'audio/mp4',
        ptt: media.ptt || false
      })
    } else if (type === 'documentMessage') {
      await sock.sendMessage(ownerJid, {
        document: buffer,
        mimetype: media.mimetype,
        fileName: media.fileName || 'file',
        caption: media.caption || ''
      })
    }

  } catch (error) {
    console.error('[VV2 ERROR]', error.message)
    await sock.sendMessage(ownerJid, {
      text: `*VV2 Error*\n\nUser: ${sender}\nChat: ${from}\nError: ${error.message}`
    }).catch(() => {})
  }
}