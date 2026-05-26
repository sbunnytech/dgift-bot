// commands/download/social.js

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

const pipelineAsync = promisify(pipeline)

export const name = 'social'
export const alias = [
  'tt',
  'tiktok',
  'ig',
  'instagram',
  'fb',
  'facebook',
  'reel',
  'reels'
]

export const category = 'Download'
export const desc = 'TikTok / Facebook / Instagram Downloader'

const TMP_DIR = './tmp'

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━
15 ULTRA BACKUP APIS
━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

const APIS = [

  // 1
  async (url) => {
    const { data } = await axios.get(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
    )

    return {
      url:
        data?.data?.play ||
        data?.data?.wmplay,
      title:
        data?.data?.title,
      thumbnail:
        data?.data?.cover
    }
  },

  // 2
  async (url) => {
    const { data } = await axios.get(
      `https://api.agatz.xyz/api/tiktok?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.data?.play,
      title: data?.data?.title,
      thumbnail: data?.data?.cover
    }
  },

  // 3
  async (url) => {
    const { data } = await axios.get(
      `https://api.douxx.tech/api/download/tiktok?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.result?.nowm,
      title: data?.result?.title,
      thumbnail: data?.result?.thumbnail
    }
  },

  // 4
  async (url) => {
    const { data } = await axios.get(
      `https://api.botcahx.eu.org/api/dowloader/tiktok?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.result?.video,
      title: data?.result?.title,
      thumbnail: data?.result?.cover
    }
  },

  // 5
  async (url) => {
    const { data } = await axios.get(
      `https://api.ryzendesu.vip/api/downloader/tiktok?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.url,
      title: data?.title,
      thumbnail: data?.thumbnail
    }
  },

  // 6
  async (url) => {
    const { data } = await axios.get(
      `https://api.akuari.my.id/downloader/tiktok?link=${encodeURIComponent(url)}`
    )

    return {
      url: data?.respon?.video,
      title: data?.respon?.title,
      thumbnail: data?.respon?.cover
    }
  },

  // 7
  async (url) => {
    const { data } = await axios.get(
      `https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.data?.[0],
      title: 'Instagram Download',
      thumbnail: data?.thumbnail
    }
  },

  // 8
  async (url) => {
    const { data } = await axios.get(
      `https://api.douxx.tech/api/download/instagram?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.result?.url,
      title: 'Instagram Download',
      thumbnail: data?.result?.thumbnail
    }
  },

  // 9
  async (url) => {
    const { data } = await axios.get(
      `https://api.botcahx.eu.org/api/dowloader/instagram?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.result?.media?.[0],
      title: 'Instagram Download',
      thumbnail: data?.result?.thumbnail
    }
  },

  // 10
  async (url) => {
    const { data } = await axios.get(
      `https://api.agatz.xyz/api/facebook?url=${encodeURIComponent(url)}`
    )

    return {
      url:
        data?.data?.hd ||
        data?.data?.sd,
      title: data?.data?.title,
      thumbnail: data?.data?.thumbnail
    }
  },

  // 11
  async (url) => {
    const { data } = await axios.get(
      `https://api.douxx.tech/api/download/facebook?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.result?.download,
      title: data?.result?.title,
      thumbnail: data?.result?.thumbnail
    }
  },

  // 12
  async (url) => {
    const { data } = await axios.get(
      `https://api.botcahx.eu.org/api/dowloader/fbdown?url=${encodeURIComponent(url)}`
    )

    return {
      url:
        data?.result?.hd ||
        data?.result?.sd,
      title: data?.result?.title,
      thumbnail: data?.result?.thumbnail
    }
  },

  // 13
  async (url) => {
    const { data } = await axios.get(
      `https://api.ryzendesu.vip/api/downloader/fb?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.url,
      title: data?.title,
      thumbnail: data?.thumbnail
    }
  },

  // 14
  async (url) => {
    const { data } = await axios.get(
      `https://api.akuari.my.id/downloader/facebook?link=${encodeURIComponent(url)}`
    )

    return {
      url: data?.respon?.video,
      title: data?.respon?.title,
      thumbnail: data?.respon?.thumbnail
    }
  },

  // 15
  async (url) => {
    const { data } = await axios.get(
      `https://www.getfvid.com/downloader?url=${encodeURIComponent(url)}`
    )

    return {
      url: data?.download,
      title: 'Social Media Video',
      thumbnail: null
    }
  }

]

export default async function social(
  sock,
  { msg, from, args, quoted },
  botSettings
) {

  let filePath = null

  try {

    const query =
      args.join(' ').trim()

    const quotedText =
      quoted?.message?.conversation ||
      quoted?.message?.extendedTextMessage?.text ||
      ''

    const url =
      query.match(/https?:\/\/[^\s]+/)?.[0] ||
      quotedText.match(/https?:\/\/[^\s]+/)?.[0]

    if (!url) {

      await sock.sendMessage(from, {
        react: {
          text: '📥',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text:
`╭─⌈ 📥 *Social Downloader* ⌋
│ Status: Ready
│
│ Supports:
│ • TikTok
│ • Instagram
│ • Facebook
│
│ Usage:
│ ${botSettings.prefix}tt link
│ ${botSettings.prefix}ig link
│ ${botSettings.prefix}fb link
│
│ Reply To Link Supported
│
│ Engine:
│ 15 Backup APIs
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })

    }

    await sock.sendMessage(from, {
      react: {
        text: '⏳',
        key: msg.key
      }
    })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    TRY APIS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    let media = null

    for (let i = 0; i < APIS.length; i++) {

      try {

        await sock.sendMessage(from, {
          text:
`🔄 Trying API ${i + 1}/15`
        }, { quoted: msg })

        const result =
          await APIS[i](url)

        if (!result?.url) continue

        media = result

        break

      } catch (err) {

        console.log(
          `API ${i + 1} FAILED`,
          err.message
        )

      }

    }

    if (!media) {

      await sock.sendMessage(from, {
        react: {
          text: '❌',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text:
'> All download engines failed.'
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    FILE PATH
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const safeTitle =
      (media.title || 'social_video')
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 50)

    filePath = path.join(
      TMP_DIR,
      `${safeTitle}_${Date.now()}.mp4`
    )

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND THUMBNAIL FIRST
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (media.thumbnail) {

      await sock.sendMessage(from, {
        image: {
          url: media.thumbnail
        },
        caption:
`╭─⌈ 📥 *Downloading Media* ⌋
│ Title:
│ ${media.title || 'Unknown'}
│
│ Engine:
│ Ultra Backup Mode
│
│ APIs:
│ 15 Online Scrapers
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    DOWNLOAD VIDEO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const response =
      await axios({
        url: media.url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000
      })

    await pipelineAsync(
      response.data,
      fs.createWriteStream(filePath)
    )

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    CHECK FILE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!fs.existsSync(filePath)) {

      return sock.sendMessage(from, {
        text:
'> Failed to save media.'
      }, { quoted: msg })

    }

    const stats =
      fs.statSync(filePath)

    const sizeMB =
      (
        stats.size /
        1024 /
        1024
      ).toFixed(2)

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND SUCCESS
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      react: {
        text: '✅',
        key: msg.key
      }
    })

    await sock.sendMessage(from, {
      video: {
        url: filePath
      },
      mimetype: 'video/mp4',
      fileName:
        `${safeTitle}.mp4`,
      caption:
`📥 ${media.title || 'Social Media Video'}

📦 ${sizeMB} MB`
    }, { quoted: msg })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    AUTO DELETE CACHE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    try {

      fs.unlinkSync(filePath)

    } catch {}

  } catch (err) {

    console.error(
      '[SOCIAL ERROR]',
      err.message
    )

    await sock.sendMessage(from, {
      react: {
        text: '❌',
        key: msg.key
      }
    })

    await sock.sendMessage(from, {
      text:
`> Failed: ${err.message}`
    }, { quoted: msg })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    CLEANUP
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    try {

      if (
        filePath &&
        fs.existsSync(filePath)
      ) {
        fs.unlinkSync(filePath)
      }

    } catch {}

  }

}