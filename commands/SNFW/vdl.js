// commands/nsfw/vdl.js
export const name = 'vdl'
export const alias = ['video', 'download', 'dlvid', 'getvid', 'xxx']
export const category = 'NSFW'
export const desc = 'Download videos from adult sites (xnxx, xxx, etc).'

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Supported platforms with extractors
const platforms = {
  xnxx: {
    pattern: /xnxx\.com/i,
    name: 'XNXX',
    extract: async (url) => {
      // Using yt-dlp or direct extraction
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  xvideos: {
    pattern: /xvideos\.com/i,
    name: 'XVideos',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  pornhub: {
    pattern: /pornhub\.com/i,
    name: 'PornHub',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  xhamster: {
    pattern: /xhamster\.com/i,
    name: 'xHamster',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  redtube: {
    pattern: /redtube\.com/i,
    name: 'RedTube',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  youporn: {
    pattern: /youporn\.com/i,
    name: 'YouPorn',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  },
  spankbang: {
    pattern: /spankbang\.com/i,
    name: 'SpankBang',
    extract: async (url) => {
      try {
        const { stdout } = await execAsync(`yt-dlp -g "${url}" --no-warnings`)
        return stdout.trim().split('\n')[0]
      } catch {
        return null
      }
    }
  }
}

async function getBrandName(botSettings) {
  if (!botSettings.supabase) return 'Bot'
  const { data } = await botSettings.supabase
    .from('b_settings')
    .select('brand_name, botname')
    .eq('id', 'DGIFT_DEFAULT')
    .maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

function detectPlatform(url) {
  for (const [key, platform] of Object.entries(platforms)) {
    if (platform.pattern.test(url)) {
      return platform
    }
  }
  return null
}

async function downloadVideo(url, outputPath) {
  // Using yt-dlp to download
  const command = `yt-dlp -o "${outputPath}" -f "best[filesize<50M]" --no-warnings --no-check-certificates "${url}"`
  await execAsync(command)
  return fs.existsSync(outputPath)
}

export default async function vdl(sock, { msg, from, sender }, botSettings) {
  try {
    const brandName = await getBrandName(botSettings)
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const url = args[0]

    // HELP
    if (!url) {
      await sock.sendMessage(from, { react: { text: '🎬', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🎬 *Video Downloader* ⌋
│ Download from adult sites
│
│ *Supported Sites:*
│ • xnxx.com
│ • xvideos.com  
│ • pornhub.com
│ • xhamster.com
│ • redtube.com
│ • youporn.com
│ • spankbang.com
│
│ *Usage:*
│ ${botSettings.prefix}vdl <url>
│ ${botSettings.prefix}video <url>
│
│ *Max Size:* 50MB (WhatsApp limit)
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Validate URL
    if (!url.startsWith('http')) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, {
        text: '> Invalid URL. Must start with http:// or https://'
      }, { quoted: msg })
    }

    // Detect platform
    const platform = detectPlatform(url)
    if (!platform) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, {
        text: '> Unsupported site. Check help for supported platforms.'
      }, { quoted: msg })
    }

    // Send processing message
    await sock.sendMessage(from, { react: { text: '⏳', key: msg.key } })
    const processingMsg = await sock.sendMessage(from, {
      text: `⏳ Downloading from ${platform.name}...\nThis may take a moment.`
    }, { quoted: msg })

    // Create temp directory
    const tmpDir = path.join(process.cwd(), 'tmp')
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
    
    const fileName = `vid_${Date.now()}.mp4`
    const filePath = path.join(tmpDir, fileName)

    try {
      // Download
      const success = await downloadVideo(url, filePath)
      
      if (!success || !fs.existsSync(filePath)) {
        throw new Error('Download failed')
      }

      // Check file size (WhatsApp limit ~64MB, but use 50MB for safety)
      const stats = fs.statSync(filePath)
      const fileSizeMB = stats.size / (1024 * 1024)

      if (fileSizeMB > 50) {
        fs.unlinkSync(filePath)
        await sock.sendMessage(from, { 
          edit: processingMsg.key,
          text: `❌ File too large (${fileSizeMB.toFixed(1)}MB).\nMax: 50MB`
        })
        return await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      }

      // Send video
      await sock.sendMessage(from, {
        video: fs.readFileSync(filePath),
        caption: `✅ *${platform.name}*\n📁 ${fileSizeMB.toFixed(1)}MB\n╰⊷ *Powered By ${brandName}*`,
        mimetype: 'video/mp4'
      }, { quoted: msg })

      // Cleanup
      fs.unlinkSync(filePath)
      await sock.sendMessage(from, { delete: processingMsg.key })
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

    } catch (downloadErr) {
      // Cleanup on error
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      console.error('[VDL ERROR]', downloadErr.message)
      await sock.sendMessage(from, { 
        edit: processingMsg.key,
        text: `❌ Failed to download.\nPossible reasons:\n• Video requires login\n• Site blocked the request\n• URL is invalid\n• Video >50MB`
      })
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    }

  } catch (err) {
    console.error('[VDL ERROR]', err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Error processing request.' }, { quoted: msg })
  }
}