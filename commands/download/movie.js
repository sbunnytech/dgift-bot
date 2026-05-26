// commands/download/movie.js

import ytdl from '@distube/ytdl-core'
import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { HttpsProxyAgent } from 'https-proxy-agent'

const pipelineAsync = promisify(pipeline)

export const name = 'movie'
export const alias = ['mv', 'film', 'series', 'episode']
export const category = 'Download'
export const desc = 'Ultra Movie Downloader'

const TMP_DIR = './tmp'

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━
15 ULTRA BACKUP APIS
━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

const VIDEO_APIS = [

  // 1
  async (url) => {
    const { data } = await axios.get(`https://api.vevioz.com/api/button/videos/${url}`)
    const match = data.match(/href="(https:\/\/[^"]+\.mp4[^"]*)"/)
    return match?.[1]
  },

  // 2
  async (url) => {
    const { data } = await axios.get(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        url,
        videoQuality: '360'
      }
    })

    return data?.url
  },

  // 3
  async (url) => {
    const { data } = await axios.get(`https://co.wuk.sh/api/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        url,
        filenamePattern: 'basic'
      }
    })

    return data?.url
  },

  // 4
  async (url) => {
    const { data } = await axios.get(`https://p.oceansaver.in/ajax/download.php?format=720&url=${url}`)
    return data?.url
  },

  // 5
  async (url) => {
    const { data } = await axios.get(`https://api.agatz.xyz/api/ytmp4?url=${url}`)
    return data?.data?.download
  },

  // 6
  async (url) => {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp4?url=${url}`)
    return data?.url
  },

  // 7
  async (url) => {
    const { data } = await axios.get(`https://api.douxx.tech/api/ytdlmp4?url=${url}`)
    return data?.result?.download
  },

  // 8
  async (url) => {
    const { data } = await axios.get(`https://api.botcahx.eu.org/api/dowloader/ytmp4?url=${url}`)
    return data?.result?.dl
  },

  // 9
  async (url) => {
    const { data } = await axios.get(`https://api.akuari.my.id/downloader/youtube?link=${url}`)
    return data?.respon?.video
  },

  // 10
  async (url) => {
    const { data } = await axios.get(`https://api.vkrdown.com/api/video?url=${url}`)
    return data?.video
  },

  // 11
  async (url) => {
    const { data } = await axios.get(`https://apiyt.onrender.com/download/video?url=${url}`)
    return data?.result?.download
  },

  // 12
  async (url) => {
    const { data } = await axios.get(`https://api.onlinevideoconverter.pro/api/convert?url=${url}`)
    return data?.download_url
  },

  // 13
  async (url) => {
    const { data } = await axios.get(`https://api.y2down.cc/api/download?url=${url}`)
    return data?.download
  },

  // 14
  async (url) => {
    const { data } = await axios.get(`https://api.mp4youtube.cc/dl?url=${url}`)
    return data?.url
  },

  // 15
  async (url) => {
    const { data } = await axios.get(`https://submagic-free-tools.fly.dev/api/youtube-to-mp4?url=${url}`)
    return data?.download
  }

]

export default async function movie(sock, { msg, from, args, quoted }, botSettings) {

  let filePath = null

  try {

    const query = args.join(' ').trim()

    const quotedText =
      quoted?.message?.conversation ||
      quoted?.message?.extendedTextMessage?.text ||
      ''

    const link =
      query.match(/(https?:\/\/[^\s]+)/)?.[0] ||
      quotedText.match(/(https?:\/\/[^\s]+)/)?.[0]

    if (!query && !link) {

      await sock.sendMessage(from, {
        react: {
          text: '🎬',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text:
`╭─⌈ 🎬 *Movie Downloader* ⌋
│ Status: Ready
│
│ Usage:
│ ${botSettings.prefix}movie Avatar
│ ${botSettings.prefix}movie youtube_link
│
│ Quality: Optimized 360p
│ Engine: 15 Backup APIs
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
    SEARCH VIDEO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    let videoUrl = link

    if (!videoUrl) {

      const search = await yts(query)

      if (!search.videos.length) {

        await sock.sendMessage(from, {
          react: {
            text: '❌',
            key: msg.key
          }
        })

        return sock.sendMessage(from, {
          text: '> No results found.'
        }, { quoted: msg })

      }

      videoUrl = search.videos[0].url

    }

    if (!ytdl.validateURL(videoUrl)) {

      return sock.sendMessage(from, {
        text: '> Invalid YouTube URL.'
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    PROXY SUPPORT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const proxy =
      botSettings.proxy ||
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY

    const agent = proxy
      ? new HttpsProxyAgent(proxy)
      : undefined

    const requestOptions = {
      agent,
      headers: {
        'User-Agent':
          'Mozilla/5.0',
        'Accept-Language':
          'en-US,en;q=0.9'
      }
    }

    if (botSettings.cookies) {
      requestOptions.headers.Cookie =
        botSettings.cookies
    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    VIDEO INFO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const info = await ytdl.getInfo(
      videoUrl,
      { requestOptions }
    )

    const title =
      info.videoDetails.title

    const duration =
      formatDuration(
        info.videoDetails.lengthSeconds
      )

    const author =
      info.videoDetails.author.name

    const thumbnail =
      info.videoDetails.thumbnails.pop()?.url

    const safeTitle =
      title
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 60)

    filePath = path.join(
      TMP_DIR,
      `${safeTitle}_${Date.now()}.mp4`
    )

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND THUMBNAIL FIRST
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (thumbnail) {

      await sock.sendMessage(from, {
        image: {
          url: thumbnail
        },
        caption:
`╭─⌈ 🎬 *Movie Download* ⌋
│ Title: ${title}
│ Duration: ${duration}
│ Author: ${author}
│
│ Engine: Ultra Backup Mode
│ Quality: 360p Optimized
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    PRIMARY DOWNLOAD
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    let downloaded = false

    try {

      const format = ytdl.chooseFormat(
        info.formats,
        {
          quality: '18'
        }
      )

      const stream =
        ytdl.downloadFromInfo(
          info,
          {
            format,
            requestOptions,
            highWaterMark: 1 << 20
          }
        )

      await pipelineAsync(
        stream,
        fs.createWriteStream(filePath)
      )

      downloaded = true

    } catch (err) {

      console.log(
        'PRIMARY FAILED:',
        err.message
      )

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    15 BACKUP APIs
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!downloaded) {

      for (let i = 0; i < VIDEO_APIS.length; i++) {

        try {

          await sock.sendMessage(from, {
            text:
`🔄 Backup API ${i + 1}/15`
          }, { quoted: msg })

          const dlUrl =
            await VIDEO_APIS[i](videoUrl)

          if (!dlUrl) continue

          const response =
            await axios({
              url: dlUrl,
              method: 'GET',
              responseType: 'stream',
              timeout: 30000
            })

          await pipelineAsync(
            response.data,
            fs.createWriteStream(filePath)
          )

          downloaded = true

          break

        } catch (err) {

          console.log(
            `API ${i + 1} FAILED`,
            err.message
          )

        }

      }

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    CHECK FILE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (
      !downloaded ||
      !fs.existsSync(filePath)
    ) {

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
    SEND VIDEO
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
      fileName: `${safeTitle}.mp4`,
      caption:
`🎬 ${title}

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
      '[MOVIE ERROR]',
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

function formatDuration(seconds) {

  if (!seconds) return 'Unknown'

  const sec = parseInt(seconds)

  const h =
    Math.floor(sec / 3600)

  const m =
    Math.floor((sec % 3600) / 60)

  const s =
    sec % 60

  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`

}