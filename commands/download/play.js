// commands/download/play.js

import axios from 'axios'
import yts from 'yt-search'
import ytdl from '@distube/ytdl-core'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream'
import { promisify } from 'util'

const pipelineAsync = promisify(pipeline)

export const name = 'play'

export const alias = [
  'song',
  'music',
  'ytmp3',
  'audio',
  'mp3'
]

export const category = 'Download'

export const desc =
  'Universal Music Downloader'

const TMP_DIR = './tmp'

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, {
    recursive: true
  })
}

/*
━━━━━━━━━━━━━━━━━━━━━━━━━━
ULTRA AUDIO APIs
━━━━━━━━━━━━━━━━━━━━━━━━━━
*/

const AUDIO_APIS = [

  // 1
  async (url) => {
    const { data } =
      await axios.get(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.data?.music,
      title:
        data?.data?.title,
      thumbnail:
        data?.data?.cover
    }
  },

  // 2
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.agatz.xyz/api/ytmp3?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.data?.download,
      title:
        data?.data?.title,
      thumbnail:
        data?.data?.thumbnail
    }
  },

  // 3
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.douxx.tech/api/ytdlmp3?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.result?.download,
      title:
        data?.result?.title,
      thumbnail:
        data?.result?.image
    }
  },

  // 4
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.botcahx.eu.org/api/dowloader/ytmp3?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.result?.dl,
      title:
        data?.result?.title,
      thumbnail:
        data?.result?.thumbnail
    }
  },

  // 5
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.url,
      title:
        data?.title,
      thumbnail:
        data?.thumbnail
    }
  },

  // 6
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.akuari.my.id/downloader/youtube?link=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.respon?.audio,
      title:
        data?.respon?.title,
      thumbnail:
        data?.respon?.thumbnail
    }
  },

  // 7
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.vkrdown.com/api/y2mate.php?url=${encodeURIComponent(url)}`
      )

    return {
      url:
        data?.mp3_url,
      title:
        data?.title,
      thumbnail:
        data?.thumbnail
    }
  },

  // 8
  async (url) => {
    const { data } =
      await axios.get(
        `https://api.vevioz.com/api/button/mp3/${encodeURIComponent(url)}`
      )

    const match =
      data.match(
        /href="(https:\/\/[^"]+\.mp3[^"]*)"/
      )

    return {
      url:
        match?.[1],
      title:
        'Audio Download',
      thumbnail:
        null
    }
  },

  // 9
  async (url) => {
    const { data } =
      await axios.post(
        'https://co.wuk.sh/api/json',
        {
          url,
          isAudioOnly: true
        },
        {
          headers: {
            'Content-Type':
              'application/json'
          }
        }
      )

    return {
      url:
        data?.url,
      title:
        'Audio Download',
      thumbnail:
        null
    }
  },

  // 10
  async (url) => {
    const { data } =
      await axios.post(
        'https://api.cobalt.tools/api/json',
        {
          url,
          audioFormat: 'mp3'
        },
        {
          headers: {
            'Content-Type':
              'application/json'
          }
        }
      )

    return {
      url:
        data?.url,
      title:
        'Audio Download',
      thumbnail:
        null
    }
  }

]

export default async function play(
  sock,
  { msg, from, args, quoted },
  botSettings
) {

  let filePath = null

  try {

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    GET QUERY
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const query =
      args.join(' ').trim()

    const quotedText =
      quoted?.message?.conversation ||
      quoted?.message?.extendedTextMessage?.text ||
      ''

    let url =
      query.match(/https?:\/\/[^\s]+/)?.[0] ||
      quotedText.match(/https?:\/\/[^\s]+/)?.[0]

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    NO QUERY
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!query && !url) {

      await sock.sendMessage(from, {
        react: {
          text: '🎵',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text:
`╭─⌈ 🎵 *Music Downloader* ⌋
│ Status: Ready
│
│ Usage:
│ ${botSettings.prefix}play faded
│ ${botSettings.prefix}play youtube_link
│
│ Supports:
│ • YouTube
│ • TikTok
│ • Facebook
│ • Instagram
│ • Direct Audio Links
│
│ Reply To Link Supported
╰⊷ *${botSettings.botname}*`
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEARCH YOUTUBE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    let title = 'Audio Download'
    let thumbnail = null

    if (!url) {

      const search =
        await yts(query)

      if (
        !search.videos.length
      ) {

        await sock.sendMessage(from, {
          react: {
            text: '❌',
            key: msg.key
          }
        })

        return sock.sendMessage(from, {
          text:
'> No results found.'
        }, { quoted: msg })

      }

      const video =
        search.videos[0]

      url = video.url

      title =
        video.title

      thumbnail =
        video.thumbnail

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    LOADING REACT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      react: {
        text: '⏳',
        key: msg.key
      }
    })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    PRIMARY INFO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    try {

      if (
        ytdl.validateURL(url)
      ) {

        const info =
          await ytdl.getInfo(url)

        title =
          info.videoDetails.title

        thumbnail =
          info.videoDetails
            .thumbnails
            ?.pop()?.url

      }

    } catch {}

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SILENT API SEARCH
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    let media = null

    for (const api of AUDIO_APIS) {

      try {

        const result =
          await api(url)

        if (
          result &&
          result.url
        ) {

          media = result

          break

        }

      } catch (err) {

        console.log(
          '[API FAILED]',
          err.message
        )

      }

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    FAILED
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (!media) {

      await sock.sendMessage(from, {
        react: {
          text: '❌',
          key: msg.key
        }
      })

      return sock.sendMessage(from, {
        text:
'> Failed to download audio.'
      }, { quoted: msg })

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    FINAL DATA
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    title =
      media.title ||
      title ||
      'Audio Download'

    thumbnail =
      media.thumbnail ||
      thumbnail

    const safeTitle =
      title
      .replace(/[\\/:*?"<>|]/g, '')
      .slice(0, 50)

    filePath = path.join(
      TMP_DIR,
      `${safeTitle}_${Date.now()}.mp3`
    )

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND THUMBNAIL
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    if (thumbnail) {

      try {

        await sock.sendMessage(from, {
          image: {
            url: thumbnail
          },
          caption:
`╭─⌈ 🎵 *Downloading Audio* ⌋
│ Title:
│ ${title}
│
│ Status:
│ Downloading...
╰⊷ *${botSettings.botname}*`
        }, { quoted: msg })

      } catch {}

    }

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    DOWNLOAD STREAM
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    const response =
      await axios({
        url: media.url,
        method: 'GET',
        responseType: 'stream',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0'
        }
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

    if (
      !fs.existsSync(filePath)
    ) {

      throw new Error(
        'File save failed'
      )

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
    SUCCESS REACT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      react: {
        text: '✅',
        key: msg.key
      }
    })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    SEND AUDIO
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    await sock.sendMessage(from, {
      audio: {
        url: filePath
      },
      mimetype:
        'audio/mpeg',
      fileName:
        `${safeTitle}.mp3`,
      ptt: false
    }, { quoted: msg })

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    CLEANUP
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    try {

      fs.unlinkSync(filePath)

    } catch {}

  } catch (err) {

    console.error(
      '[PLAY ERROR]',
      err.message
    )

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    ERROR REACT
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

    try {

      await sock.sendMessage(from, {
        react: {
          text: '❌',
          key: msg.key
        }
      })

    } catch {}

    /*
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    ERROR MESSAGE
    ━━━━━━━━━━━━━━━━━━━━━━━━━━
    */

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