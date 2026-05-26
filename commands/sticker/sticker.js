// commands/sticker/sticker.js
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'

export const name = 'sticker'
export const alias = ['s', 'stiker', 'wm']
export const category = 'Sticker'
export const desc = 'Convert image/video to sticker with custom pack'

async function getStickerConfig(botSettings) {
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  
  if (!botSettings.supabase) {
    return { 
      pack: 'Bunny MD', 
      author: 'Lupin Starnley', 
      categories: ['🤖', '🎉'] 
    }
  }

  const { data } = await botSettings.supabase
    .from('b_settings')
    .select('sticker_pack, sticker_author, sticker_category')
    .eq('id', instanceId)
    .maybeSingle()

  return {
    pack: data?.sticker_pack || 'Bunny MD',
    author: data?.sticker_author || 'Lupin Starnley',
    categories: data?.sticker_category 
      ? data.sticker_category.split(',').map(c => c.trim()).filter(Boolean)
      : ['🤖', '🎉']
  }
}

export default async function sticker(sock, { msg, from }, botSettings) {
  const prefix = botSettings.prefix

  try {
    // 1. ADVANCED MEDIA DETECTION
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const mediaMessage = msg.message?.imageMessage || 
                         msg.message?.videoMessage ||
                         quoted?.imageMessage || 
                         quoted?.videoMessage ||
                         quoted?.viewOnceMessageV2?.message?.imageMessage ||
                         quoted?.viewOnceMessageV2?.message?.videoMessage ||
                         quoted?.viewOnceMessage?.message?.imageMessage ||
                         quoted?.viewOnceMessage?.message?.videoMessage

    if (!mediaMessage) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `Reply to an image or video to create a sticker. Usage: ${prefix}s`
      }, { quoted: msg })
    }

    // 2. React processing
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })

    // 3. Download media
    const buffer = await downloadMediaMessage(
      { message: { [mediaMessage.videoMessage ? 'videoMessage' : 'imageMessage']: mediaMessage } },
      'buffer',
      {},
      { logger: console }
    )

    if (!buffer) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, {
        text: 'Failed to download media.'
      }, { quoted: msg })
    }

    // 4. Get sticker config from DB
    const { pack, author, categories } = await getStickerConfig(botSettings)

    // 5. Create sticker with dynamic WM
    const sticker = new Sticker(buffer, {
      pack: pack,
      author: author,
      type: StickerTypes.FULL,
      categories: categories,
      quality: 70
    })

    const stickerBuffer = await sticker.toBuffer()

    // 6. Send sticker
    await sock.sendMessage(from, {
      sticker: stickerBuffer
    }, { quoted: msg })

    // 7. React done
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

  } catch (error) {
    console.error('[STICKER ERROR]', error)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, {
      text: `Error: ${error.message}`
    }, { quoted: msg })
  }
}