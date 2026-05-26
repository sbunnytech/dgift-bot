// commands/tools/save.js
export const name = 'save'
export const alias = ['savestatus', 'ss', 'savechat']
export const category = 'Tools'
export const desc = 'Save replied status or mentioned status to your chat'

export default async function save(sock, { msg, from, quoted }, botSettings) {
  try {
    const brand = botSettings?.brand_name || botSettings?.botname || 'DGIFT BOT'

    if (!quoted) {
      return sock.sendMessage(from, {
        text: `╭─⌈ 💾 *SAVE TOOL* ⌋
│
│ Reply to a status OR status mention
│ Works in: DMs, Groups, Status mentions
│ Types: image, video, audio, text
│
│ Usage: Reply to status → ${botSettings.prefix}save
│
╰⊷ *Powered By ${brand}*`
      }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '💾', key: msg.key } })

    const loadingMsg = await sock.sendMessage(from, {
      text: `╭─⌈ ⏳ *SAVING STATUS* ⌋
│
│ Downloading media...
│ Please wait
│
╰⊷ *Powered By ${brand}*`
    }, { quoted: msg })

    // Unwrap status mention if present
    let targetMsg = quoted
    let isStatusMention = false
    
    if (quoted.message?.statusMentionMessage) {
      targetMsg = {
        ...quoted,
        message: quoted.message.statusMentionMessage.message
      }
      isStatusMention = true
    }

    // Check types
    const isStatus = targetMsg.key.remoteJid === 'status@broadcast'
    const isViewOnce = targetMsg.message?.viewOnceMessageV2 || 
                       targetMsg.message?.imageMessage?.viewOnce || 
                       targetMsg.message?.videoMessage?.viewOnce

    let mediaType = null
    let mediaBuffer = null
    let caption = ''

    // Handle image
    if (targetMsg.message?.imageMessage || targetMsg.message?.viewOnceMessageV2?.message?.imageMessage) {
      mediaType = 'image'
      const imgMsg = targetMsg.message.imageMessage || targetMsg.message.viewOnceMessageV2.message.imageMessage
      caption = imgMsg.caption || ''
      mediaBuffer = await sock.downloadMediaMessage(targetMsg)
    }
    // Handle video
    else if (targetMsg.message?.videoMessage || targetMsg.message?.viewOnceMessageV2?.message?.videoMessage) {
      mediaType = 'video'
      const vidMsg = targetMsg.message.videoMessage || targetMsg.message.viewOnceMessageV2.message.videoMessage
      caption = vidMsg.caption || ''
      mediaBuffer = await sock.downloadMediaMessage(targetMsg)
    }
    // Handle audio/voice
    else if (targetMsg.message?.audioMessage || targetMsg.message?.viewOnceMessageV2?.message?.audioMessage) {
      mediaType = 'audio'
      mediaBuffer = await sock.downloadMediaMessage(targetMsg)
    }
    // Handle text status
    else if (targetMsg.message?.conversation || targetMsg.message?.extendedTextMessage) {
      mediaType = 'text'
      caption = targetMsg.message.conversation || targetMsg.message.extendedTextMessage.text
    }
    else {
      throw new Error('Unsupported status type')
    }

    // Send saved media back
    const statusType = isStatusMention? 'Status Mention' : isStatus? 'Status' : 'Message'
    
    if (mediaType === 'image') {
      await sock.sendMessage(from, {
        image: mediaBuffer,
        caption: `╭─⌈ 💾 *SAVED ${statusType.toUpperCase()}* ⌋
│
│ Type: Image ${isViewOnce? '(View Once)' : ''}
│
│ ${caption}
│
╰⊷ *Powered By ${brand}*`
      }, { quoted: msg })
    }
    else if (mediaType === 'video') {
      await sock.sendMessage(from, {
        video: mediaBuffer,
        caption: `╭─⌈ 💾 *SAVED ${statusType.toUpperCase()}* ⌋
│
│ Type: Video ${isViewOnce? '(View Once)' : ''}
│
│ ${caption}
│
╰⊷ *Powered By ${brand}*`
      }, { quoted: msg })
    }
    else if (mediaType === 'audio') {
      await sock.sendMessage(from, {
        audio: mediaBuffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: false,
        caption: `╭─⌈ 💾 *SAVED ${statusType.toUpperCase()}* ⌋
│
│ Type: Audio ${isViewOnce? '(Voice Note)' : ''}
│
╰⊷ *Powered By ${brand}*`
      }, { quoted: msg })
    }
    else if (mediaType === 'text') {
      await sock.sendMessage(from, {
        text: `╭─⌈ 💾 *SAVED ${statusType.toUpperCase()}* ⌋
│
│ Type: Text
│
│ ${caption}
│
╰⊷ *Powered By ${brand}*`
      }, { quoted: msg })
    }

    await sock.sendMessage(from, {
      text: `╭─⌈ ✅ *SAVED SUCCESSFULLY* ⌋
│
│ Status saved to your chat
│ Source: ${statusType}
│ Type: ${mediaType} ${isViewOnce? '+ View Once bypass' : ''}
│
╰⊷ *Powered By ${brand}*`,
      edit: loadingMsg.key
    })

    await sock.sendMessage(from, { react: { text: '✅', key: loadingMsg.key } }).catch(() => {})

  } catch (error) {
    console.error('[SAVE ERROR]', error.message)
    await sock.sendMessage(from, {
      text: `╭─⌈ ❌ *ERROR* ⌋
│
│ Failed to save status
│ Reason: ${error.message}
│
╰⊷ *Powered By ${botSettings?.brand_name || 'DGIFT BOT'}*`
    }, { quoted: msg })
  }
}