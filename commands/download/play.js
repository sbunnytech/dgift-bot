// commands/download/play.js

import ytdl from '@distube/ytdl-core'
import yts from 'yt-search'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

const pipelineAsync = promisify(pipeline)

export const name = 'play'
export const alias = ['song', 'ytmp3', 'ytplay']
export const category = 'Download'
export const desc = 'Ultra Backup YouTube Audio Downloader'

const TMP_DIR = './tmp'

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true })
}

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
15+ FREE OPEN APIs / SCRAPERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

const API_PROVIDERS = [

  // 1
  async (id) => {
    const { data } = await axios.get(`https://api.vevioz.com/api/button/mp3/${id}`)
    const match = data.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/)
    return match?.[1]
  },

  // 2
  async (id) => {
    const { data } = await axios.get(`https://api.vkrdown.com/api/y2mate.php?video_id=${id}`)
    return data?.mp3_url
  },

  // 3
  async (id) => {
    const { data } = await axios.get(`https://cdn38.savetube.me/info?url=https://youtu.be/${id}`)
    return data?.data?.downloadUrl
  },

  // 4
  async (id) => {
    const { data } = await axios.get(`https://submagic-free-tools.fly.dev/api/youtube-to-mp3?url=https://youtu.be/${id}`)
    return data?.download
  },

  // 5
  async (id) => {
    const { data } = await axios.get(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        url: `https://youtu.be/${id}`,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3'
      }
    })

    return data?.url
  },

  // 6
  async (id) => {
    const { data } = await axios.get(`https://p.oceansaver.in/ajax/download.php?format=mp3&url=https://youtu.be/${id}`)
    return data?.url
  },

  // 7
  async (id) => {
    const { data } = await axios.get(`https://api.onlinevideoconverter.pro/api/convert?url=https://youtu.be/${id}`)
    return data?.download_url
  },

  // 8
  async (id) => {
    const { data } = await axios.get(`https://co.wuk.sh/api/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        url: `https://youtu.be/${id}`,
        filenamePattern: 'basic',
        isAudioOnly: true
      }
    })

    return data?.url
  },

  // 9
  async (id) => {
    const { data } = await axios.get(`https://api.mp3youtube.cc/dl?url=https://youtu.be/${id}`)
    return data?.url
  },

  // 10
  async (id) => {
    const { data } = await axios.get(`https://api.y2down.cc/api/download?url=https://youtu.be/${id}`)
    return data?.download
  },

  // 11
  async (id) => {
    const { data } = await axios.get(`https://apiyt.onrender.com/download/mp3?url=https://youtu.be/${id}`)
    return data?.result?.download
  },

  // 12
  async (id) => {
    const { data } = await axios.get(`https://api.douxx.tech/api/ytdlmp3?url=https://youtu.be/${id}`)
    return data?.result?.download
  },

  // 13
  async (id) => {
    const { data } = await axios.get(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=https://youtu.be/${id}`)
    return data?.url
  },

  // 14
  async (id) => {
    const { data } = await axios.get(`https://api.agatz.xyz/api/ytmp3?url=https://youtu.be/${id}`)
    return data?.data?.download
  },

  // 15
  async (id) => {
    const { data } = await axios.get(`https://api.akuari.my.id/downloader/youtube?link=https://youtu.be/${id}`)
    return data?.respon?.audio
  },

  // 16
  async (id) => {
    const { data } = await axios.get(`https://api.botcahx.eu.org/api/dowloader/ytmp3?url=https://youtu.be/${id}`)
    return data?.result?.dl
  }

]

export default async function play(sock, { msg, from, args }, botSettings) {

  try {

    const query = args.join(' ').trim()

    if (!query) {
      await sock.sendMessage(from, {
        text: `╭─❍
│ 🎵 PLAY COMMAND
│
│ Example:
│ ${botSettings.prefix}play faded
│ ${botSettings.prefix}play https://youtu.be/xxx
╰─────────────`
      }, { quoted: msg })

      return
    }

    await sock.sendMessage(from, {
      react: {
        text: '⏳',
        key: msg.key
      }
    })

    let videoUrl = query
    let videoInfo = {}

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEARCH VIDEO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!ytdl.validateURL(query)) {

      const search = await yts(query)

      if (!search.videos.length) {
        return sock.sendMessage(from, {
          text: '❌ No results found.'
        }, { quoted: msg })
      }

      videoInfo = search.videos[0]
      videoUrl = videoInfo.url

    } else {

      const info = await ytdl.getInfo(videoUrl)

      videoInfo = {
        title: info.videoDetails.title,
        duration: info.videoDetails.lengthSeconds,
        author: info.videoDetails.author.name,
        thumbnail: info.videoDetails.thumbnails.pop()?.url,
        videoId: info.videoDetails.videoId
      }

    }

    if (!ytdl.validateURL(videoUrl)) {
      return sock.sendMessage(from, {
        text: '❌ Invalid YouTube URL.'
      }, { quoted: msg })
    }

    const info = await ytdl.getInfo(videoUrl)

    const videoId = info.videoDetails.videoId
    const title = info.videoDetails.title
    const duration = formatDuration(info.videoDetails.lengthSeconds)
    const author = info.videoDetails.author.name
    const thumbnail = info.videoDetails.thumbnails.pop()?.url

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND THUMBNAIL FIRST
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      image: { url: thumbnail },
      caption: `╭─❍
│ 🎵 DOWNLOADING
│
│ 📌 Title: ${title}
│ ⏱ Duration: ${duration}
│ 👤 Author: ${author}
│
│ 🔄 Searching 15+ APIs...
╰─────────────`
    }, { quoted: msg })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    TRY LOCAL YTDL FIRST
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '').slice(0, 70)

    const filePath = path.join(
      TMP_DIR,
      `${safeTitle}_${Date.now()}.mp3`
    )

    let downloaded = false

    try {

      const stream = ytdl(videoUrl, {
        filter: 'audioonly',
        quality: 'highestaudio',
        highWaterMark: 1 << 25
      })

      await pipelineAsync(
        stream,
        fs.createWriteStream(filePath)
      )

      downloaded = true

    } catch (err) {

      console.log('PRIMARY FAILED:', err.message)

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    BACKUP APIs SYSTEM
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!downloaded) {

      for (let i = 0; i < API_PROVIDERS.length; i++) {

        try {

          await sock.sendMessage(from, {
            text: `🔄 Trying API Backup ${i + 1}/16`
          }, { quoted: msg })

          const url = await API_PROVIDERS[i](videoId)

          if (!url) continue

          const response = await axios({
            url,
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

        } catch (e) {

          console.log(`API ${i + 1} FAILED ->`, e.message)

        }

      }

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    CHECK DOWNLOAD
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!downloaded || !fs.existsSync(filePath)) {

      await sock.sendMessage(from, {
        react: {
          text: '❌',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text: '❌ All 16 APIs failed.'
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    FILE SIZE LIMIT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const stats = fs.statSync(filePath)

    const fileSizeMB = stats.size / (1024 * 1024)

    if (fileSizeMB > 64) {

      return sock.sendMessage(from, {
        text: '❌ File exceeds 64MB.'
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND AUDIO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      react: {
        text: '✅',
        key: msg.key
      }
    })

    await sock.sendMessage(from, {
      audio: fs.readFileSync(filePath),
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: `${safeTitle}.mp3`
    }, { quoted: msg })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    NO DELETE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    // FILE WILL STAY
    // NO fs.unlinkSync(filePath)

  } catch (err) {

    console.error('PLAY ERROR:', err)

    await sock.sendMessage(from, {
      react: {
        text: '❌',
        key: msg.key
      }
    })

    await sock.sendMessage(from, {
      text: `❌ Error:\n${err.message}`
    }, { quoted: msg })

  }

}

function formatDuration(seconds) {

  seconds = Number(seconds)

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return `${m}:${s.toString().padStart(2, '0')}`

}