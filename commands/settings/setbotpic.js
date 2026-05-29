// commands/settings/setstartupimage.js
import axios from 'axios'
import FormData from 'form-data'

async function getBrandName(botSettings) {
  try {
    const { data } = await botSettings.supabase
     .from('b_settings')
     .select('botname')
     .eq('id', 'DGIFT_DEFAULT')
     .single()
    return data?.botname || 'Bot'
  } catch {
    return 'Bot'
  }
}

export const name = 'setstartupimage'
export const alias = ['setimage', 'startupimg']
export const category = 'Settings'
export const desc = 'Change bot startup image'

export default async function setstartupimage(sock, { msg, from, sender }, botSettings) {
  try {
    // Angalia kama database ipo
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '📸', key: msg.key } })

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const inputText = args[0]?.trim()

    // Chukua settings za sasa
    const { data: settings } = await botSettings.supabase
     .from('b_settings')
     .select('startup_image, botname, imgbb_api')
     .eq('id', 'DGIFT_DEFAULT')
     .maybeSingle()

    const currentImage = settings?.startup_image || 'None'
    const brandName = await getBrandName(botSettings)
    const imgbbKey = process.env.IMGBB_API || settings?.imgbb_api || 'e4159b76d900cd8803bdf1bd7bc96fbb'

    // Onyesha status kama hakuna image mpya
    if (!inputText &&!msg.message?.imageMessage &&!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🖼️ *Startup Image Settings* ⌋
│ Current: ${currentImage}
│ Bot: ${brandName}
│
│ Usage:
│ 1. Reply to image with ${botSettings.prefix || '.'}setstartupimage
│ 2. Send image with caption ${botSettings.prefix || '.'}setstartupimage
│ 3. ${botSettings.prefix || '.'}setstartupimage https://link.jpg
╰⊷ *${brandName}*`
      }, { quoted: msg })
    }

    let imageUrl = inputText

    // Kama ni reply ya picha
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const isReplyImage = quotedMsg?.imageMessage

    // Kama ni picha direct
    const isDirectImage = msg.message?.imageMessage

    // Download na upload ImgBB kama ni picha
    if (isReplyImage || isDirectImage) {
      if (imgbbKey === 'e4159b76d900cd8803bdf1bd7bc96fbb') {
        console.log('[SETSTARTUPIMAGE] No Imgbb API key set')
        return sock.sendMessage(from, { text: '> ImgBB API key not set. Add IMGBB_API to ENV.' }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '⬇️', key: msg.key } })

      const buffer = await sock.downloadMediaMessage(isReplyImage? { message: quotedMsg } : msg)

      const form = new FormData()
      form.append('image', buffer.toString('base64'))

      const upload = await axios.post(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, form, {
        headers: form.getHeaders()
      })

      imageUrl = upload.data.url
      await sock.sendMessage(from, { react: { text: '☁️', key: msg.key } })
    }

    // Kama link si ya picha, ruhusu tu
    if (!imageUrl) {
      return sock.sendMessage(from, { text: '> No image found. Send image or link.' }, { quoted: msg })
    }

    // Sasisha database
    const { error } = await botSettings.supabase
     .from('b_settings')
     .update({
        startup_image: imageUrl,
        updated_at: new Date().toISOString()
      })
     .eq('id', 'DGIFT_DEFAULT')

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    // Sasisha live memory
    botSettings.startup_image = imageUrl

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ ✅ *Startup Image Updated* ⌋
│ Status: Applied instantly
│ New Image: Set
│
│ Try: ${botSettings.prefix || '.'}alive
╰⊷ *${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[SETSTARTUPIMAGE ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed to update startup image.' }, { quoted: msg })
  }
}