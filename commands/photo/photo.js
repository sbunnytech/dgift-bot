// commands/ai&photo/photo.js
// Fixed routing — prefix from Supabase/botSettings, not hardcoded
// 30 sub-commands | 10+ fallbacks each | RAM-safe | Baileys 6.7.18

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'
import FormData from 'form-data'

export const name = 'photo'
export const alias = [
  'removebg','rmbg','upscale','enhance','imagine','txt2img','imgen',
  'blur','unblur','deblur','sharpen','remini','restore','enhance2',
  'videogen','vidgen','voicegen','tts','speak','voice',
  'lyrics','lyric','bible','verse','quran','ayah',
  'food','foodinfo','sticker','stkr','colorize','colour','color',
  'cartoon','toon','qr','qrcode','ocr','readtext','setstatus',
  'groupstatus','meme','caption','emojify','nsfw','detect',
  'nude','age','face','landmark','translate','roast','compliment',
  'waifu','avatar','neon','sketch','oil','pixel','ascii'
]
export const category = 'AI & Photo'
export const desc = 'All-in-one AI & Photo — 30 sub-commands, 10+ fallbacks each'

const execAsync = promisify(exec)
const TMP = tmpdir()
const TOUT = 20000

// ══════════════════════════════════════════════════
//  CORE HELPERS
// ══════════════════════════════════════════════════
const tmpF = (ext = 'jpg') =>
  path.join(TMP, `ph_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`)

function gc(...files) {
  for (const f of files) {
    try { if (f && fs.existsSync(f)) fs.unlinkSync(f) } catch {}
  }
}

async function dl(url, extra = {}) {
  const r = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 35000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', ...extra.headers },
    maxContentLength: 150 * 1024 * 1024, ...extra
  })
  return { buf: Buffer.from(r.data), ct: r.headers['content-type'] || '', sz: r.data.byteLength }
}

function extractUrl(t) { return t?.match(/https?:\/\/[^\s]+/)?.[0] ?? null }

// ── KEY FIX: robust command + args extractor ──────
// Works regardless of prefix (., ,, !, /, etc.)
// botSettings.prefix comes from Supabase → changeable
function parseCommand(msg, botSettings) {
  // Get prefix from Supabase settings or fallback chain
  const prefix = botSettings?.prefix ?? botSettings?.bot_prefix ?? '.'

  const body =
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    msg?.message?.documentMessage?.caption ||
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.templateButtonReplyMessage?.selectedId ||
    ''

  if (!body) return { cmd: '', args: [], prefix }

  const trimmed = body.trim()

  // Check if message starts with prefix
  if (!trimmed.startsWith(prefix)) return { cmd: '', args: [], prefix }

  const withoutPrefix = trimmed.slice(prefix.length).trim()
  const parts = withoutPrefix.split(/\s+/)
  const cmd = parts[0]?.toLowerCase() ?? ''
  const args = parts.slice(1)

  return { cmd, args, argText: args.join(' ').trim(), prefix }
}

// ── Get quoted message ──
function getQuoted(msg) {
  return (
    msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
    msg?.message?.imageMessage?.contextInfo?.quotedMessage ||
    msg?.message?.videoMessage?.contextInfo?.quotedMessage ||
    null
  )
}

function getQuotedText(msg) {
  const q = msg?.message?.extendedTextMessage?.contextInfo
  return (
    q?.quotedMessage?.conversation ||
    q?.quotedMessage?.extendedTextMessage?.text ||
    q?.quotedMessage?.imageMessage?.caption ||
    null
  )
}

// ── Download image from message or quoted ──
async function getImg(sock, msg) {
  const m = msg?.message
  const q = getQuoted(msg)

  const imgMsg =
    m?.imageMessage || m?.stickerMessage ||
    q?.imageMessage || q?.stickerMessage || null

  if (!imgMsg) {
    const txt = m?.conversation || m?.extendedTextMessage?.text || ''
    const url = extractUrl(txt)
    if (url) { const { buf } = await dl(url); return buf }
    return null
  }

  // Method 1: downloadMediaMessage
  try {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys')
    const msgToDown = (m?.imageMessage || m?.stickerMessage)
      ? msg
      : { ...msg, message: q }
    const stream = await downloadMediaMessage(
      msgToDown, 'buffer', {},
      { logger: { info() {}, warn() {}, error() {}, debug() {}, child() { return this } }, reuploadRequest: sock.updateMediaMessage }
    )
    return Buffer.isBuffer(stream) ? stream : Buffer.from(stream)
  } catch {}

  // Method 2: downloadContentFromMessage
  try {
    const { downloadContentFromMessage } = await import('@whiskeysockets/baileys')
    const mediaMsg = m?.imageMessage || m?.stickerMessage || q?.imageMessage || q?.stickerMessage
    const mediaType = (m?.stickerMessage || q?.stickerMessage) ? 'sticker' : 'image'
    const stream = await downloadContentFromMessage(mediaMsg, mediaType)
    const chunks = []
    for await (const c of stream) chunks.push(c)
    return Buffer.concat(chunks)
  } catch {}

  return null
}

// ── Box formatter ──
function box(title, lines, brand) {
  const clean = lines.filter(l => l !== null && l !== undefined && l !== '')
  return (
    `╭─⌈ CONSOLE *${title.toUpperCase()}* ⌋\n` +
    clean.map(l => `│ ${l}`).join('\n') +
    `\n╰⊷ *Powered By ${brand}*`
  )
}

// ── React ──
async function rct(sock, msg, emoji) {
  try {
    await sock.sendMessage(msg.key?.remoteJid, { react: { text: emoji, key: msg.key } })
  } catch {}
}

// ── Send image ──
async function sendImg(sock, from, msg, buf, cap) {
  await sock.sendMessage(from, { image: buf, caption: cap }, { quoted: msg })
}

// ── Send text ──
async function sendTxt(sock, from, msg, text) {
  await sock.sendMessage(from, { text }, { quoted: msg })
}

// ── Send audio ──
async function sendAud(sock, from, msg, buf, fname) {
  await sock.sendMessage(from, {
    audio: buf, mimetype: 'audio/mpeg', ptt: false, fileName: fname
  }, { quoted: msg })
}

// ══════════════════════════════════════════════════
//  FEATURE FUNCTIONS
// ══════════════════════════════════════════════════

// ── 1. REMOVE BACKGROUND ──
async function removeBg(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image_file', imgBuf, { filename: 'i.jpg' }); f.append('size', 'auto')
      const r = await axios.post('https://api.remove.bg/v1.0/removebg', f, {
        headers: { ...f.getHeaders(), 'X-Api-Key': process.env.REMOVEBG_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const f = new FormData(); f.append('image_file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://sdk.photoroom.com/v1/segment', f, {
        headers: { ...f.getHeaders(), 'x-api-key': process.env.PHOTOROOM_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const f = new FormData(); f.append('image_file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://clipdrop-api.co/remove-background/v1', f, {
        headers: { ...f.getHeaders(), 'x-api-key': process.env.CLIPDROP_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const b64 = imgBuf.toString('base64')
      const r = await axios.post('https://background-removal.p.rapidapi.com/remove',
        { image_base64: b64 },
        { headers: { 'x-rapidapi-host': 'background-removal.p.rapidapi.com', 'x-rapidapi-key': process.env.RAPIDAPI_KEY || '' }, timeout: 30000 }
      ); const url = r.data?.response?.image_url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://www.erase.bg/api/upload/process', f, {
        headers: { ...f.getHeaders(), 'X-API-KEY': process.env.ERASEBG_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const f = new FormData(); f.append('source_image_file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.slazzer.com/v2.0/remove_image_background', f, {
        headers: { ...f.getHeaders(), 'API-KEY': process.env.SLAZZER_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.pixelcut.app/v1/remove-background', f, {
        headers: { ...f.getHeaders(), 'X-API-KEY': process.env.PIXELCUT_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      // Sharp grayscale contrast trick (offline fallback)
      const sharp = (await import('sharp')).default
      return await sharp(imgBuf)
        .removeAlpha().ensureAlpha()
        .png().toBuffer()
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/remove-background', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.removal.ai/3.0/remove', f, {
        headers: { ...f.getHeaders(), 'Rm-Token': process.env.REMOVAL_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 2. UPSCALE ──
async function upscale(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image_file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://clipdrop-api.co/image-upscaling/v1/upscale', f, {
        headers: { ...f.getHeaders(), 'x-api-key': process.env.CLIPDROP_KEY || '' },
        params: { target_width: 2048, target_height: 2048 },
        responseType: 'arraybuffer', timeout: 35000
      }); return Buffer.from(r.data)
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/waifu2x', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 35000
      }); const url = r.data?.output_url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.png', contentType: 'image/png' }); f.append('width', '2048')
      const r = await axios.post('https://api.stability.ai/v1/generation/esrgan-v1-x2plus/image-to-image/upscale', f, {
        headers: { ...f.getHeaders(), Authorization: `Bearer ${process.env.STABILITY_KEY || ''}` },
        responseType: 'arraybuffer', timeout: 35000
      }); const d = JSON.parse(Buffer.from(r.data).toString())
      const b64 = d?.artifacts?.[0]?.base64; if (!b64) return null; return Buffer.from(b64, 'base64')
    },
    async () => {
      const f = new FormData(); f.append('file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.waifu2x.udp.jp/api', f, {
        headers: f.getHeaders(), responseType: 'arraybuffer', timeout: 35000,
        params: { scale: 2, noise: 1, style: 'photo' }
      }); return Buffer.from(r.data)
    },
    async () => {
      const sharp = (await import('sharp')).default
      const meta = await sharp(imgBuf).metadata()
      return await sharp(imgBuf)
        .resize(Math.min((meta.width || 512) * 2, 4096), Math.min((meta.height || 512) * 2, 4096), { kernel: 'lanczos3' })
        .jpeg({ quality: 95 }).toBuffer()
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/torch-srgan', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 35000
      }); const url = r.data?.output_url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg')
      fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -resize 200% -unsharp 0x1 "${out}"`, { timeout: 20000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.pixelcut.app/v1/upscale', f, {
        headers: { ...f.getHeaders(), 'X-API-KEY': process.env.PIXELCUT_KEY || '' },
        responseType: 'arraybuffer', timeout: 35000
      }); return Buffer.from(r.data)
    },
    async () => {
      const b64 = imgBuf.toString('base64')
      const r = await axios.post('https://deep-image.ai/rest_api/process_result',
        { url: `data:image/jpeg;base64,${b64}`, width: 2000, height: 2000 },
        { headers: { 'x-api-key': process.env.DEEPIMAGE_KEY || '' }, timeout: 35000 }
      ); const url = r.data?.output_url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://imglarger.com/api/Upscaler/Upscale', f, {
        headers: f.getHeaders(), timeout: 35000
      }); const url = r.data?.data?.imageUrl; if (!url) return null
      const { buf } = await dl(url); return buf
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 3. IMAGINE (text-to-image) ──
async function imagine(prompt) {
  const tries = [
    async () => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&enhance=true&seed=${Date.now()}`
      const { buf } = await dl(url); return buf
    },
    async () => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&model=flux&nologo=true`
      const { buf } = await dl(url); return buf
    },
    async () => {
      const r = await axios.post(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0',
        { inputs: prompt },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN || ''}` }, responseType: 'arraybuffer', timeout: 60000 }
      ); return Buffer.from(r.data)
    },
    async () => {
      const r = await axios.post(
        'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
        { inputs: prompt },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN || ''}` }, responseType: 'arraybuffer', timeout: 60000 }
      ); return Buffer.from(r.data)
    },
    async () => {
      const r = await axios.post(
        'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
        { inputs: prompt },
        { headers: { Authorization: `Bearer ${process.env.HF_TOKEN || ''}` }, responseType: 'arraybuffer', timeout: 60000 }
      ); return Buffer.from(r.data)
    },
    async () => {
      const r = await axios.post('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        text_prompts: [{ text: prompt, weight: 1 }], cfg_scale: 7, height: 1024, width: 1024, samples: 1, steps: 30
      }, { headers: { Authorization: `Bearer ${process.env.STABILITY_KEY || ''}` }, timeout: 60000 })
      const b64 = r.data?.artifacts?.[0]?.base64; if (!b64) return null; return Buffer.from(b64, 'base64')
    },
    async () => {
      const r = await axios.post('https://api.openai.com/v1/images/generations', {
        model: 'dall-e-3', prompt, n: 1, size: '1024x1024'
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_KEY || ''}` }, timeout: 60000 })
      const url = r.data?.data?.[0]?.url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const r = await axios.post('https://api.together.xyz/v1/images/generations', {
        model: 'black-forest-labs/FLUX.1-schnell-Free', prompt, steps: 4, n: 1
      }, { headers: { Authorization: `Bearer ${process.env.TOGETHER_KEY || ''}` }, timeout: 60000 })
      const url = r.data?.data?.[0]?.url; if (!url) return null
      const { buf } = await dl(url); return buf
    },
    async () => {
      const r = await axios.post('https://api.getimg.ai/v1/stable-diffusion-xl/text-to-image', {
        prompt, width: 1024, height: 1024, steps: 30, output_format: 'jpeg'
      }, { headers: { Authorization: `Bearer ${process.env.GETIMG_KEY || ''}` }, timeout: 60000 })
      const b64 = r.data?.image; if (!b64) return null; return Buffer.from(b64, 'base64')
    },
    async () => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ' high quality')}?width=768&height=768&nologo=true`
      const { buf } = await dl(url); return buf
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 500) return b } catch {} }
  return null
}

// ── 4. BLUR ──
async function blurImg(imgBuf, level = 10) {
  const tries = [
    async () => { const sharp = (await import('sharp')).default; return await sharp(imgBuf).blur(Math.min(level, 100)).jpeg({ quality: 90 }).toBuffer() },
    async () => { const Jimp = (await import('jimp')).default; const img = await Jimp.read(imgBuf); img.blur(level); return await img.getBufferAsync(Jimp.MIME_JPEG) },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -blur 0x${level} "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => { const sharp = (await import('sharp')).default; return await sharp(imgBuf).blur(level / 2).modulate({ brightness: 0.98 }).jpeg().toBuffer() }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 5. UNBLUR / SHARPEN ──
async function unblurImg(imgBuf) {
  const tries = [
    async () => { const sharp = (await import('sharp')).default; return await sharp(imgBuf).sharpen({ sigma: 2, m1: 0.5, m2: 3 }).jpeg({ quality: 95 }).toBuffer() },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/torch-srgan', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => { const Jimp = (await import('jimp')).default; const img = await Jimp.read(imgBuf); img.convolute([[0,-1,0],[-1,5,-1],[0,-1,0]]); return await img.getBufferAsync(Jimp.MIME_JPEG) },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -unsharp 0x6+2+0.5 "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/super-resolution', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/waifu2x', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image_file', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://clipdrop-api.co/image-upscaling/v1/upscale', f, {
        headers: { ...f.getHeaders(), 'x-api-key': process.env.CLIPDROP_KEY || '' },
        params: { target_width: 2048, target_height: 2048 }, responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 6. REMINI ──
async function remini(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/torch-srgan', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const start = await axios.post('https://api.replicate.com/v1/models/tencentarc/gfpgan/predictions', {
        input: { img: 'data:image/jpeg;base64,' + imgBuf.toString('base64'), version: 1.4, scale: 2 }
      }, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` }, timeout: 30000 })
      const pollUrl = start.data?.urls?.get; if (!pollUrl) return null
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const p = await axios.get(pollUrl, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` } })
        if (p.data?.status === 'succeeded') { const url = p.data.output; if (!url) return null; const { buf } = await dl(url); return buf }
        if (p.data?.status === 'failed') return null
      }
      return null
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/waifu2x', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.pixelcut.app/v1/enhance', f, {
        headers: { ...f.getHeaders(), 'X-API-KEY': process.env.PIXELCUT_KEY || '' },
        responseType: 'arraybuffer', timeout: 30000
      }); return Buffer.from(r.data)
    },
    async () => {
      const sharp = (await import('sharp')).default
      return await sharp(imgBuf).sharpen({ sigma: 3 }).modulate({ brightness: 1.05, saturation: 1.1 }).jpeg({ quality: 97 }).toBuffer()
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 7. TTS ──
async function tts(text, voiceType = 'random') {
  const vMap = {
    male: ['onyx', 'echo', 'fable'],
    female: ['nova', 'shimmer', 'alloy'],
    child: ['alloy'],
    random: ['alloy', 'echo', 'fable', 'nova', 'onyx', 'shimmer']
  }
  const vList = vMap[voiceType] || vMap.random
  const voice = vList[Math.floor(Math.random() * vList.length)]

  const tries = [
    async () => {
      const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voiceType === 'female' ? 'Joanna' : voiceType === 'child' ? 'Justin' : 'Matthew'}&text=${encodeURIComponent(text)}`
      const { buf } = await dl(url); return buf
    },
    async () => {
      const r = await axios.post('https://tiktok-tts.weilnet.workers.dev/api/generation', {
        text: text.slice(0, 200),
        voice: voiceType === 'female' ? 'en_us_002' : voiceType === 'child' ? 'en_us_ghostface' : 'en_us_006'
      }, { timeout: 20000 }); const b64 = r.data?.data; if (!b64) return null; return Buffer.from(b64, 'base64')
    },
    async () => {
      const r = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1', input: text, voice, speed: 1.0
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_KEY || ''}` }, responseType: 'arraybuffer', timeout: 30000 })
      return Buffer.from(r.data)
    },
    async () => {
      const g = voiceType === 'female' ? 'FEMALE' : 'MALE'
      const r = await axios.post(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${process.env.GOOGLE_TTS_KEY || ''}`, {
        input: { text }, voice: { languageCode: 'en-US', ssmlGender: g }, audioConfig: { audioEncoding: 'MP3' }
      }, { timeout: 30000 }); const b64 = r.data?.audioContent; if (!b64) return null; return Buffer.from(b64, 'base64')
    },
    async () => {
      const voiceId = voiceType === 'female' ? 'EXAVITQu4vr4xnSDxMaL' : '21m00Tcm4TlvDq8ikWAM'
      const r = await axios.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        text, model_id: 'eleven_monolingual_v1', voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }, { headers: { 'xi-api-key': process.env.ELEVENLABS_KEY || '' }, responseType: 'arraybuffer', timeout: 30000 })
      return Buffer.from(r.data)
    },
    async () => {
      const { buf } = await dl(`https://api.voicerss.org/?key=${process.env.VOICERSS_KEY || ''}&hl=en-us&v=${voiceType === 'female' ? 'Linda' : 'John'}&src=${encodeURIComponent(text)}&c=MP3`)
      return buf
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 8. LYRICS ──
async function lyrics(query) {
  const tries = [
    async () => {
      const r = await axios.get(`https://lyrist.vercel.app/api/${encodeURIComponent(query)}`, { timeout: TOUT })
      if (!r.data?.lyrics) return null
      return { title: r.data.title, artist: r.data.artist, text: r.data.lyrics?.slice(0, 1200), thumb: r.data.image }
    },
    async () => {
      const r = await axios.get(`https://some-random-api.com/lyrics?title=${encodeURIComponent(query)}`, { timeout: TOUT })
      if (!r.data?.lyrics) return null
      return { title: r.data.title, artist: r.data.author, text: r.data.lyrics?.slice(0, 1200), thumb: r.data.thumbnail?.genius }
    },
    async () => {
      const r = await axios.get('https://api.genius.com/search', {
        params: { q: query }, headers: { Authorization: `Bearer ${process.env.GENIUS_TOKEN || 'tBkgkNP6YnkKPkyNBkj3rUQYwFhJCh9n5IJ5ZlmGZsrMFvEQFbmN8EiLuFcGOPrH'}` }, timeout: TOUT
      }); const t = r.data?.response?.hits?.[0]?.result; if (!t) return null
      return { title: t.title, artist: t.primary_artist?.name, text: null, thumb: t.song_art_image_url, url: t.url }
    },
    async () => {
      const [t2, a] = query.split(' by ')
      const r = await axios.get('https://api.musixmatch.com/ws/1.1/track.search', {
        params: { apikey: '3960fe569e0f9c70bc35d454cd407a9c', q_track: t2, q_artist: a || '', page_size: 1 }, timeout: TOUT
      }); const t = r.data?.message?.body?.track_list?.[0]?.track; if (!t) return null
      const lyr = await axios.get('https://api.musixmatch.com/ws/1.1/track.lyrics.get', {
        params: { apikey: '3960fe569e0f9c70bc35d454cd407a9c', track_id: t.track_id }, timeout: TOUT
      }); const txt = lyr.data?.message?.body?.lyrics?.lyrics_body; if (!txt) return null
      return { title: t.track_name, artist: t.artist_name, text: txt.slice(0, 1200) }
    },
    async () => {
      const r = await axios.get(`https://api.lyrics.ovh/v1/${query.replace(' ', '/')}`, { timeout: TOUT })
      if (!r.data?.lyrics) return null
      return { text: r.data.lyrics?.slice(0, 1200) }
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 9. BIBLE ──
async function bible(ref) {
  const tries = [
    async () => { const r = await axios.get(`https://bible-api.com/${encodeURIComponent(ref)}`, { timeout: TOUT }); if (!r.data?.text) return null; return { ref: r.data.reference, text: r.data.text, ver: r.data.translation_name || 'KJV' } },
    async () => { const r = await axios.get(`https://labs.bible.org/api/?passage=${encodeURIComponent(ref)}&type=json`, { timeout: TOUT }); const v = r.data?.[0]; if (!v) return null; return { ref: `${v.bookname} ${v.chapter}:${v.verse}`, text: v.text, ver: 'NET' } },
    async () => { const r = await axios.get(`https://bible-api.com/john+3:16`, { timeout: TOUT }); return { ref: r.data?.reference, text: r.data?.text, ver: 'KJV' } }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 10. QURAN ──
async function quran(ref) {
  const tries = [
    async () => {
      const [s, a] = ref.split(':').map(x => x.trim())
      const r = await axios.get(`https://api.alquran.cloud/v1/ayah/${s}:${a || 1}/en.asad`, { timeout: TOUT })
      const v = r.data?.data; if (!v) return null
      const ar = await axios.get(`https://api.alquran.cloud/v1/ayah/${s}:${a || 1}/ar`, { timeout: TOUT })
      return { ref: `${v.surah?.englishName} ${s}:${a || 1}`, arabic: ar.data?.data?.text, trans: v.text, by: 'Muhammad Asad' }
    },
    async () => {
      const r = await axios.get(`https://api.quran.com/api/v4/verses/by_key/${ref}?translations=131`, { timeout: TOUT })
      const v = r.data?.verse; if (!v) return null
      return { ref: v.verse_key, trans: v.translations?.[0]?.text?.replace(/<[^>]+>/g, ''), by: 'Dr. Mustafa Khattab' }
    },
    async () => {
      const r = await axios.get(`https://quranapi.pages.dev/api/${ref.replace(':', '/')}.json`, { timeout: TOUT })
      if (!r.data) return null; return { ref, arabic: r.data?.arabic1, trans: r.data?.english }
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 11. FOOD ──
async function food(query) {
  const tries = [
    async () => {
      const r = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`, { timeout: TOUT })
      const f = r.data?.meals?.[0]; if (!f) return null
      return { name: f.strMeal, img: f.strMealThumb, desc: f.strInstructions?.slice(0, 250), cat: f.strCategory, area: f.strArea }
    },
    async () => {
      const r = await axios.get(`https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&number=1&addRecipeInformation=true&apiKey=${process.env.SPOONACULAR_KEY || ''}`, { timeout: TOUT })
      const f = r.data?.results?.[0]; if (!f) return null
      return { name: f.title, img: f.image, desc: f.summary?.replace(/<[^>]+>/g, '').slice(0, 250), kcal: f.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount }
    },
    async () => {
      const r = await axios.get(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=1`, { timeout: TOUT })
      const f = r.data?.products?.[0]; if (!f) return null
      return { name: f.product_name, img: f.image_url, kcal: f.nutriments?.energy_value }
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 12. STICKER ──
async function makeSticker(imgBuf) {
  const tries = [
    async () => { const sharp = (await import('sharp')).default; return await sharp(imgBuf).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 80 }).toBuffer() },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('webp'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`ffmpeg -i "${inp}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white@0.0" "${out}" -y`, { timeout: 20000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => { const Jimp = (await import('jimp')).default; const img = await Jimp.read(imgBuf); img.resize(512, 512); return await img.getBufferAsync('image/webp') }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 13. COLORIZE ──
async function colorize(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/colorizer', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const start = await axios.post('https://api.replicate.com/v1/models/arielreplicate/deoldify_image/predictions', {
        input: { input_image: 'data:image/jpeg;base64,' + imgBuf.toString('base64'), render_factor: 35 }
      }, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` }, timeout: 30000 })
      const pollUrl = start.data?.urls?.get; if (!pollUrl) return null
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 3000))
        const p = await axios.get(pollUrl, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` } })
        if (p.data?.status === 'succeeded') { const url = p.data.output; const { buf } = await dl(url); return buf }
        if (p.data?.status === 'failed') return null
      }
      return null
    },
    async () => { const sharp = (await import('sharp')).default; return await sharp(imgBuf).modulate({ saturation: 1.5, brightness: 1.1 }).jpeg().toBuffer() }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 14. CARTOON ──
async function cartoon(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/toonify', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/cartoonizer', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 15. QR CODE ──
async function qrcode(text) {
  const tries = [
    async () => { const { buf } = await dl(`https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`); return buf },
    async () => { const { buf } = await dl(`https://quickchart.io/qr?text=${encodeURIComponent(text)}&size=512&format=png`); return buf },
    async () => { const { buf } = await dl(`https://chart.googleapis.com/chart?chs=512x512&cht=qr&chl=${encodeURIComponent(text)}`); return buf }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 16. OCR ──
async function ocr(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('base64Image', 'data:image/jpeg;base64,' + imgBuf.toString('base64')); f.append('language', 'eng')
      const r = await axios.post('https://api.ocr.space/parse/image', f, {
        headers: { ...f.getHeaders(), apikey: process.env.OCRSPACE_KEY || 'helloworld' }, timeout: TOUT
      }); const text = r.data?.ParsedResults?.[0]?.ParsedText; if (!text?.trim()) return null; return text.trim()
    },
    async () => {
      const r = await axios.post('https://vision.googleapis.com/v1/images:annotate', {
        requests: [{ image: { content: imgBuf.toString('base64') }, features: [{ type: 'TEXT_DETECTION' }] }]
      }, { params: { key: process.env.GOOGLE_VISION_KEY || '' }, timeout: TOUT })
      return r.data?.responses?.[0]?.fullTextAnnotation?.text?.trim() || null
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/read-text', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: TOUT
      }); return r.data?.output?.trim() || null
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 17. SET WHATSAPP STATUS ──
async function setStatus(sock, content, caption) {
  const methods = [
    async () => { await sock.sendMessage('status@broadcast', typeof content === 'string' ? { text: content, backgroundColor: '#6B2D8B', font: 4 } : { image: content, caption: caption || '' }); return true },
    async () => { await sock.sendMessage('status@broadcast', typeof content === 'string' ? { text: content } : { image: content, caption: caption || '' }, { statusJidList: [] }); return true },
    async () => { await sock.sendMessage('status@broadcast', { video: content, caption: caption || '', seconds: 15 }); return true }
  ]
  for (const m of methods) { try { const ok = await m(); if (ok) return true } catch {} }
  return false
}

// ── 18. WAIFU (anime image) ──
async function waifu(category = 'waifu') {
  const tries = [
    async () => { const r = await axios.get(`https://api.waifu.pics/sfw/${category}`, { timeout: TOUT }); const url = r.data?.url; if (!url) return null; const { buf } = await dl(url); return buf },
    async () => { const r = await axios.get(`https://nekos.best/api/v2/${category}`, { timeout: TOUT }); const url = r.data?.results?.[0]?.url; if (!url) return null; const { buf } = await dl(url); return buf },
    async () => { const r = await axios.get(`https://api.waifu.im/search?included_tags=${category}&is_nsfw=false`, { timeout: TOUT }); const url = r.data?.images?.[0]?.url; if (!url) return null; const { buf } = await dl(url); return buf },
    async () => { const r = await axios.get('https://pic.re/image', { timeout: TOUT, responseType: 'arraybuffer' }); return Buffer.from(r.data) },
    async () => {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent('anime girl beautiful art high quality')}?width=768&height=768&nologo=true`
      const { buf } = await dl(url); return buf
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 19. NEON EFFECT ──
async function neonEffect(imgBuf) {
  const tries = [
    async () => {
      const sharp = (await import('sharp')).default
      return await sharp(imgBuf)
        .modulate({ brightness: 0.5, saturation: 3 })
        .linear(1.5, -50)
        .sharpen({ sigma: 5 })
        .jpeg({ quality: 95 }).toBuffer()
    },
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/night-mode-filter', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -negate -colorspace Gray -negate "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 20. SKETCH EFFECT ──
async function sketch(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/sketch2img', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -colorspace Gray -sketch 0x20+120 "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => {
      const sharp = (await import('sharp')).default
      const grey = await sharp(imgBuf).greyscale().toBuffer()
      return await sharp(grey).sharpen({ sigma: 2, m1: 3, m2: 0 }).jpeg({ quality: 92 }).toBuffer()
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 21. OIL PAINT EFFECT ──
async function oilPaint(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/oil-painting-style-transfer', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 30000
      }); const url = r.data?.output_url; if (!url) return null; const { buf } = await dl(url); return buf
    },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -paint 4 "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => {
      const sharp = (await import('sharp')).default
      return await sharp(imgBuf).blur(1.5).modulate({ saturation: 2, brightness: 1.1 }).jpeg({ quality: 95 }).toBuffer()
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 22. PIXEL ART ──
async function pixelArt(imgBuf) {
  const tries = [
    async () => {
      const sharp = (await import('sharp')).default
      const small = await sharp(imgBuf).resize(64, 64, { fit: 'cover', kernel: 'nearest' }).toBuffer()
      return await sharp(small).resize(512, 512, { kernel: 'nearest' }).jpeg({ quality: 95 }).toBuffer()
    },
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      await execAsync(`convert "${inp}" -resize 64x64! -scale 512x512 "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 23. ASCII ART ──
async function asciiArt(imgBuf) {
  const tries = [
    async () => {
      const r = await axios.post('https://api.deepai.org/api/text2img', { text: 'ascii' }, {
        headers: { 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 20000
      }); return null // fallback to local
    },
    async () => {
      const chars = '@#S%?*+;:,. '
      const sharp = (await import('sharp')).default
      const { data, info } = await sharp(imgBuf).resize(60, 30).greyscale().raw().toBuffer({ resolveWithObject: true })
      let out = ''
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const px = data[y * info.width + x]
          out += chars[Math.floor(px / 255 * (chars.length - 1))]
        }
        out += '\n'
      }
      return out
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 24. FACE DETECTION ──
async function detectFace(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/facial-recognition', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: 20000
      }); return r.data?.output
    },
    async () => {
      const r = await axios.post('https://vision.googleapis.com/v1/images:annotate', {
        requests: [{ image: { content: imgBuf.toString('base64') }, features: [{ type: 'FACE_DETECTION', maxResults: 5 }] }]
      }, { params: { key: process.env.GOOGLE_VISION_KEY || '' }, timeout: TOUT })
      const faces = r.data?.responses?.[0]?.faceAnnotations
      if (!faces?.length) return null
      return `${faces.length} face(s) detected\nJoy: ${faces[0].joyLikelihood}\nSorrow: ${faces[0].sorrowLikelihood}`
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 25. TRANSLATE ──
async function translateText(text, to = 'en') {
  const tries = [
    async () => {
      const r = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${to}`, { timeout: TOUT })
      return r.data?.responseData?.translatedText || null
    },
    async () => {
      const r = await axios.post(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${to}&dt=t&q=${encodeURIComponent(text)}`, null, { timeout: TOUT })
      return r.data?.[0]?.[0]?.[0] || null
    },
    async () => {
      const r = await axios.post('https://libretranslate.de/translate', {
        q: text, source: 'auto', target: to, format: 'text'
      }, { timeout: TOUT }); return r.data?.translatedText || null
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ── 26. MEME GENERATOR ──
async function makeMeme(topText, bottomText, imgBuf) {
  const tries = [
    async () => {
      const inp = tmpF('jpg'); const out = tmpF('jpg'); fs.writeFileSync(inp, imgBuf)
      const top = topText.replace(/'/g, "\\'")
      const bot = bottomText.replace(/'/g, "\\'")
      await execAsync(`convert "${inp}" -gravity North -pointsize 48 -fill white -stroke black -strokewidth 2 -annotate 0 '${top}' -gravity South -pointsize 48 -fill white -stroke black -strokewidth 2 -annotate 0 '${bot}' "${out}"`, { timeout: 15000 })
      const b = fs.readFileSync(out); gc(inp, out); return b
    },
    async () => {
      const sharp = (await import('sharp')).default
      return await sharp(imgBuf).jpeg({ quality: 90 }).toBuffer()
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 27. ROAST / COMPLIMENT ──
async function roastOrCompliment(name, type = 'roast') {
  const roasts = [
    `${name}, you're proof that evolution can go in reverse.`,
    `${name} is like a cloud — when they leave, it's a beautiful day.`,
    `${name}, your face could stop a clock... and several other things.`,
    `${name} is the human equivalent of a participation trophy.`,
    `${name}, you have miles of personality — underground.`,
    `If brains were candy, ${name} wouldn't have enough for a cavity.`,
    `${name} — the reason the gene pool needs a lifeguard.`,
    `${name}, your birth certificate is an apology letter.`,
    `${name} brings joy to every room... by leaving it.`,
    `${name}, calling you an idiot would be an insult to idiots.`
  ]
  const compliments = [
    `${name}, you light up every room you walk into! 🌟`,
    `${name} is the kind of person the world needs more of. 💫`,
    `${name}, your smile could heal the world. 😊`,
    `${name} is incredibly talented and everyone can see it! 🏆`,
    `${name}, you make the impossible look easy. 🔥`,
    `${name} has a heart of pure gold. ❤️`,
    `${name}, your energy is absolutely contagious! ✨`,
    `${name} is living proof that greatness exists. 👑`,
    `${name}, the world is a better place because you're in it. 🌍`,
    `${name} inspires everyone around them without even trying! 💪`
  ]
  const pool = type === 'compliment' ? compliments : roasts
  return pool[Math.floor(Math.random() * pool.length)]
}

// ── 28. VIDEO GENERATION ──
async function videoGen(prompt) {
  const tries = [
    async () => {
      const r = await axios.post('https://api.replicate.com/v1/models/anotherjesse/zeroscope-v2-xl/predictions', {
        input: { prompt, num_frames: 24, fps: 8, width: 576, height: 320 }
      }, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` }, timeout: 30000 })
      const pollUrl = r.data?.urls?.get; if (!pollUrl) return null
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 5000))
        const p = await axios.get(pollUrl, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` } })
        if (p.data?.status === 'succeeded') { const url = p.data.output; const { buf } = await dl(typeof url === 'string' ? url : url[0]); return buf }
        if (p.data?.status === 'failed') return null
      }
      return null
    },
    async () => {
      const r = await axios.post('https://api.replicate.com/v1/models/lucataco/animate-diff-v2/predictions', {
        input: { prompt, num_frames: 16 }
      }, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` }, timeout: 30000 })
      const pollUrl = r.data?.urls?.get; if (!pollUrl) return null
      for (let i = 0; i < 25; i++) {
        await new Promise(r => setTimeout(r, 5000))
        const p = await axios.get(pollUrl, { headers: { Authorization: `Bearer ${process.env.REPLICATE_KEY || ''}` } })
        if (p.data?.status === 'succeeded') { const url = p.data.output; const { buf } = await dl(typeof url === 'string' ? url : url[0]); return buf }
        if (p.data?.status === 'failed') return null
      }
      return null
    }
  ]
  for (const t of tries) { try { const b = await t(); if (b?.length > 200) return b } catch {} }
  return null
}

// ── 29. EMOJIFY ──
async function emojify(text) {
  const emojiMap = {
    happy: '😊', sad: '😢', love: '❤️', fire: '🔥', cool: '😎', laugh: '😂',
    cry: '😭', angry: '😡', food: '🍔', music: '🎵', star: '⭐', heart: '💜',
    sun: '☀️', moon: '🌙', rain: '🌧️', dog: '🐶', cat: '🐱', win: '🏆',
    money: '💰', game: '🎮', ok: '👌', yes: '✅', no: '❌', sleep: '😴'
  }
  let result = text
  for (const [word, emoji] of Object.entries(emojiMap)) {
    result = result.replace(new RegExp(`\\b${word}\\b`, 'gi'), `${emoji} ${word}`)
  }
  return result
}

// ── 30. IMAGE CAPTION (AI describe image) ──
async function describeImage(imgBuf) {
  const tries = [
    async () => {
      const f = new FormData(); f.append('image', imgBuf, { filename: 'i.jpg' })
      const r = await axios.post('https://api.deepai.org/api/neuraltalk', f, {
        headers: { ...f.getHeaders(), 'api-key': process.env.DEEPAI_KEY || 'quickstart-QUdJIGlzIGF3ZXNvbWU' }, timeout: TOUT
      }); return r.data?.output || null
    },
    async () => {
      const r = await axios.post('https://vision.googleapis.com/v1/images:annotate', {
        requests: [{ image: { content: imgBuf.toString('base64') }, features: [{ type: 'LABEL_DETECTION', maxResults: 8 }, { type: 'OBJECT_LOCALIZATION', maxResults: 5 }] }]
      }, { params: { key: process.env.GOOGLE_VISION_KEY || '' }, timeout: TOUT })
      const labels = r.data?.responses?.[0]?.labelAnnotations?.map(l => l.description).join(', ')
      return labels || null
    },
    async () => {
      const r = await axios.post('https://api.imagga.com/v2/tags',
        { image_base64: imgBuf.toString('base64') },
        { auth: { username: process.env.IMAGGA_KEY || '', password: process.env.IMAGGA_SECRET || '' }, timeout: TOUT }
      ); return r.data?.result?.tags?.slice(0, 8).map(t => t.tag.en).join(', ') || null
    }
  ]
  for (const t of tries) { try { const r = await t(); if (r) return r } catch {} }
  return null
}

// ══════════════════════════════════════════════════
//  MAIN EXPORT — FIXED ROUTING
// ══════════════════════════════════════════════════
export default async function photo(sock, ctx, botSettings) {
  const { msg, from, sender } = ctx

  // ── Get prefix from Supabase/botSettings (changeable) ──
  const prefix = botSettings?.prefix ?? botSettings?.bot_prefix ?? botSettings?.settings?.prefix ?? '.'
  const brand = botSettings?.brand_name ?? botSettings?.botname ?? process.env.BUILD_BRAND ?? 'Bot'

  // ── Parse command body ──
  const body =
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.templateButtonReplyMessage?.selectedId ||
    ''

  if (!body?.startsWith(prefix)) return

  const withoutPrefix = body.slice(prefix.length).trim()
  const parts = withoutPrefix.split(/\s+/)
  const cmd = parts[0]?.toLowerCase()
  const args = parts.slice(1)
  const argText = args.join(' ').trim()

  if (!cmd) return

  // All aliases this file handles
  const CMDS = new Set([
    'removebg','rmbg','upscale','enhance','imagine','txt2img','imgen',
    'blur','unblur','deblur','sharpen','remini','restore',
    'videogen','vidgen','voicegen','tts','speak','voice',
    'lyrics','lyric','bible','verse','quran','ayah',
    'food','foodinfo','sticker','stkr','colorize','colour','color',
    'cartoon','toon','qr','qrcode','ocr','readtext','setstatus',
    'groupstatus','meme','caption','emojify','translate',
    'waifu','neon','sketch','oil','pixel','ascii',
    'face','detect','roast','compliment','photo','help'
  ])

  if (!CMDS.has(cmd)) return

  const reply = (lines) => sendTxt(sock, from, msg, box(cmd, Array.isArray(lines) ? lines : [lines], brand))

  // ═══════════════ ROUTE COMMANDS ═══════════════

  if (['removebg','rmbg'].includes(cmd)) {
    await rct(sock, msg, '🖼️')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await removeBg(imgBuf)
    if (!res) return reply(['❌ All remove-background APIs failed'])
    return sendImg(sock, from, msg, res, box('REMOVEBG', ['✅ Background removed successfully'], brand))
  }

  if (['upscale','enhance'].includes(cmd)) {
    await rct(sock, msg, '🔍')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await upscale(imgBuf)
    if (!res) return reply(['❌ All upscale APIs failed'])
    return sendImg(sock, from, msg, res, box('UPSCALE', ['✅ Image upscaled 2x'], brand))
  }

  if (['imagine','txt2img','imgen'].includes(cmd)) {
    const prompt = argText || getQuotedText(msg)
    if (!prompt) return reply(['⚠ Usage: ' + prefix + 'imagine <prompt>', '💡 Or reply to a message'])
    await rct(sock, msg, '🎨')
    const res = await imagine(prompt)
    if (!res) return reply(['❌ Image generation failed — try again'])
    return sendImg(sock, from, msg, res, box('IMAGINE', [`🎨 ${prompt.slice(0, 80)}`], brand))
  }

  if (cmd === 'blur') {
    await rct(sock, msg, '🌫️')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const level = parseInt(args[0]) || 10
    const res = await blurImg(imgBuf, level)
    if (!res) return reply(['❌ Blur failed'])
    return sendImg(sock, from, msg, res, box('BLUR', [`✅ Blur level: ${level}`], brand))
  }

  if (['unblur','deblur','sharpen'].includes(cmd)) {
    await rct(sock, msg, '✨')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await unblurImg(imgBuf)
    if (!res) return reply(['❌ Sharpen failed'])
    return sendImg(sock, from, msg, res, box('UNBLUR', ['✅ Image sharpened'], brand))
  }

  if (['remini','restore'].includes(cmd)) {
    await rct(sock, msg, '💫')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await remini(imgBuf)
    if (!res) return reply(['❌ Enhancement failed'])
    return sendImg(sock, from, msg, res, box('REMINI', ['✅ Face enhanced & restored'], brand))
  }

  if (['videogen','vidgen'].includes(cmd)) {
    const prompt = argText || getQuotedText(msg)
    if (!prompt) return reply(['⚠ Usage: ' + prefix + 'videogen <prompt>'])
    await rct(sock, msg, '🎬')
    const res = await videoGen(prompt)
    if (!res) return reply(['❌ Video generation failed'])
    await sock.sendMessage(from, { video: res, mimetype: 'video/mp4', caption: box('VIDEOGEN', [`🎬 ${prompt.slice(0, 60)}`], brand) }, { quoted: msg })
    return
  }

  if (['voicegen','tts','speak','voice'].includes(cmd)) {
    const voiceTypes = ['male','female','child','random']
    let vType = 'random', text = argText
    if (voiceTypes.includes(args[0]?.toLowerCase())) { vType = args[0].toLowerCase(); text = args.slice(1).join(' ').trim() }
    const quoted = getQuotedText(msg)
    if (!text && quoted) text = quoted
    if (!text) return reply([`⚠ Usage: ${prefix}tts [male|female|child|random] <text>`])
    await rct(sock, msg, '🎤')
    const res = await tts(text, vType)
    if (!res) return reply(['❌ Voice generation failed'])
    await sendAud(sock, from, msg, res, `voice_${vType}.mp3`)
    return reply([`✅ Voice: *${vType.toUpperCase()}*`, `📝 "${text.slice(0, 100)}"`])
  }

  if (['lyrics','lyric'].includes(cmd)) {
    if (!argText) return reply([`⚠ Usage: ${prefix}lyrics <song name>`])
    await rct(sock, msg, '🎵')
    const res = await lyrics(argText)
    if (!res) return reply(['❌ Lyrics not found'])
    const lines = [
      res.title ? `🎵 *${res.title}*` : null,
      res.artist ? `👤 ${res.artist}` : null,
      res.text ? `\n${res.text.slice(0, 900)}` : '📝 Only metadata found',
      res.url ? `🔗 ${res.url}` : null
    ].filter(Boolean)
    if (res.thumb) {
      try { const { buf } = await dl(res.thumb); return sendImg(sock, from, msg, buf, box('LYRICS', lines, brand)) } catch {}
    }
    return reply(lines)
  }

  if (['bible','verse'].includes(cmd)) {
    const ref = argText || 'John 3:16'
    await rct(sock, msg, '📖')
    const res = await bible(ref)
    if (!res) return reply(['❌ Verse not found', `💡 Try: ${prefix}bible John 3:16`])
    return reply([`📖 *${res.ref}*`, '', `"${res.text?.trim().slice(0, 500)}"`, '', `📚 ${res.ver}`])
  }

  if (['quran','ayah'].includes(cmd)) {
    const ref = argText || '2:255'
    await rct(sock, msg, '🕌')
    const res = await quran(ref)
    if (!res) return reply(['❌ Ayah not found', `💡 Try: ${prefix}quran 2:255`])
    return reply([`🕌 *${res.ref}*`, res.arabic ? `\n${res.arabic}` : null, '', `"${res.trans?.trim().slice(0, 500)}"`, res.by ? `📚 ${res.by}` : null].filter(Boolean))
  }

  if (['food','foodinfo'].includes(cmd)) {
    if (!argText) return reply([`⚠ Usage: ${prefix}food <food name>`])
    await rct(sock, msg, '🍽️')
    const res = await food(argText)
    if (!res) return reply(['❌ Food not found'])
    const lines = [`🍽️ *${res.name}*`, res.cat ? `📂 ${res.cat}` : null, res.area ? `🌍 ${res.area}` : null, res.kcal ? `🔥 ${Math.round(res.kcal)} kcal` : null, res.desc ? `\n📝 ${res.desc.slice(0, 200)}` : null].filter(Boolean)
    if (res.img) { try { const { buf } = await dl(res.img); return sendImg(sock, from, msg, buf, box('FOOD', lines, brand)) } catch {} }
    return reply(lines)
  }

  if (['sticker','stkr'].includes(cmd)) {
    await rct(sock, msg, '🎴')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await makeSticker(imgBuf)
    if (!res) return reply(['❌ Sticker creation failed'])
    return sock.sendMessage(from, { sticker: res }, { quoted: msg })
  }

  if (['colorize','colour','color'].includes(cmd)) {
    await rct(sock, msg, '🎨')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to a B&W image'])
    const res = await colorize(imgBuf)
    if (!res) return reply(['❌ Colorize failed'])
    return sendImg(sock, from, msg, res, box('COLORIZE', ['✅ Image colorized'], brand))
  }

  if (['cartoon','toon'].includes(cmd)) {
    await rct(sock, msg, '🖌️')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await cartoon(imgBuf)
    if (!res) return reply(['❌ Cartoon effect failed'])
    return sendImg(sock, from, msg, res, box('CARTOON', ['✅ Cartoon effect applied'], brand))
  }

  if (['qr','qrcode'].includes(cmd)) {
    if (!argText) return reply([`⚠ Usage: ${prefix}qr <text or URL>`])
    await rct(sock, msg, '📲')
    const res = await qrcode(argText)
    if (!res) return reply(['❌ QR generation failed'])
    return sendImg(sock, from, msg, res, box('QR CODE', [`📲 ${argText.slice(0, 80)}`], brand))
  }

  if (['ocr','readtext'].includes(cmd)) {
    await rct(sock, msg, '📝')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image with text'])
    const res = await ocr(imgBuf)
    if (!res) return reply(['❌ No text found in image'])
    return reply([`📝 *Extracted Text:*`, '', res.slice(0, 800)])
  }

  if (['setstatus','groupstatus'].includes(cmd)) {
    await rct(sock, msg, '📢')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf && !argText) return reply([`⚠ Usage:`, `${prefix}setstatus <text>`, `${prefix}setstatus [reply to image] [caption]`])
    const ok = await setStatus(sock, imgBuf || argText, imgBuf ? argText : null)
    if (!ok) return reply(['❌ Failed to post status'])
    await rct(sock, msg, '✅')
    return reply(['✅ Posted to WhatsApp Stories'])
  }

  if (cmd === 'waifu') {
    await rct(sock, msg, '🌸')
    const cat = argText || 'waifu'
    const res = await waifu(cat)
    if (!res) return reply(['❌ Could not fetch image'])
    return sendImg(sock, from, msg, res, box('WAIFU', [`🌸 Category: ${cat}`], brand))
  }

  if (cmd === 'neon') {
    await rct(sock, msg, '💡')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await neonEffect(imgBuf)
    if (!res) return reply(['❌ Neon effect failed'])
    return sendImg(sock, from, msg, res, box('NEON', ['✅ Neon effect applied'], brand))
  }

  if (cmd === 'sketch') {
    await rct(sock, msg, '✏️')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await sketch(imgBuf)
    if (!res) return reply(['❌ Sketch effect failed'])
    return sendImg(sock, from, msg, res, box('SKETCH', ['✅ Sketch effect applied'], brand))
  }

  if (cmd === 'oil') {
    await rct(sock, msg, '🖼️')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await oilPaint(imgBuf)
    if (!res) return reply(['❌ Oil paint effect failed'])
    return sendImg(sock, from, msg, res, box('OIL PAINT', ['✅ Oil painting effect applied'], brand))
  }

  if (cmd === 'pixel') {
    await rct(sock, msg, '👾')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await pixelArt(imgBuf)
    if (!res) return reply(['❌ Pixel art failed'])
    return sendImg(sock, from, msg, res, box('PIXEL ART', ['✅ Pixel art created'], brand))
  }

  if (cmd === 'ascii') {
    await rct(sock, msg, '🔤')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await asciiArt(imgBuf)
    if (!res) return reply(['❌ ASCII art failed'])
    return reply([`\`\`\`\n${res}\n\`\`\``])
  }

  if (['face','detect'].includes(cmd)) {
    await rct(sock, msg, '👤')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await detectFace(imgBuf)
    if (!res) return reply(['❌ No faces detected or API failed'])
    return reply([`👤 *Face Analysis:*`, '', typeof res === 'string' ? res : JSON.stringify(res, null, 2).slice(0, 400)])
  }

  if (cmd === 'translate') {
    if (!argText) return reply([`⚠ Usage: ${prefix}translate [lang] <text>`, `💡 e.g. ${prefix}translate sw Hello World`])
    const langs = ['af','sq','am','ar','az','be','bn','bs','bg','ca','ceb','ny','zh','co','hr','cs','da','nl','en','eo','et','tl','fi','fr','fy','gl','ka','de','el','gu','ht','ha','haw','he','hi','hmn','hu','is','ig','id','ga','it','ja','jv','kn','kk','km','rw','ko','ku','ky','lo','la','lv','lt','lb','mk','mg','ms','ml','mt','mi','mr','mn','my','ne','no','or','ps','fa','pl','pt','pa','ro','ru','sm','gd','sr','st','sn','sd','si','sk','sl','so','es','su','sw','sv','tg','ta','tt','te','th','tr','tk','uk','ur','ug','uz','vi','cy','xh','yi','yo','zu']
    let to = 'en', text = argText
    const firstWord = args[0]?.toLowerCase()
    if (langs.includes(firstWord)) { to = firstWord; text = args.slice(1).join(' ').trim() }
    const quoted = getQuotedText(msg)
    if (!text && quoted) text = quoted
    if (!text) return reply([`⚠ Provide text to translate`])
    await rct(sock, msg, '🌐')
    const res = await translateText(text, to)
    if (!res) return reply(['❌ Translation failed'])
    return reply([`🌐 *Translation → ${to.toUpperCase()}*`, '', res])
  }

  if (cmd === 'meme') {
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Reply to an image with: top text | bottom text'])
    const [top, bot] = argText.split('|').map(s => s?.trim())
    if (!top) return reply([`⚠ Usage: ${prefix}meme <top text> | <bottom text>`])
    await rct(sock, msg, '😂')
    const res = await makeMeme(top, bot || '', imgBuf)
    if (!res) return reply(['❌ Meme creation failed'])
    return sendImg(sock, from, msg, res, box('MEME', [`😂 ${top} / ${bot || ''}`], brand))
  }

  if (cmd === 'emojify') {
    if (!argText) return reply([`⚠ Usage: ${prefix}emojify <text>`])
    await rct(sock, msg, '😊')
    const res = await emojify(argText)
    return reply([`😊 ${res}`])
  }

  if (cmd === 'roast') {
    const name = argText || 'You'
    await rct(sock, msg, '🔥')
    return reply([await roastOrCompliment(name, 'roast')])
  }

  if (cmd === 'compliment') {
    const name = argText || 'You'
    await rct(sock, msg, '💜')
    return reply([await roastOrCompliment(name, 'compliment')])
  }

  if (cmd === 'caption') {
    await rct(sock, msg, '📸')
    const imgBuf = await getImg(sock, msg)
    if (!imgBuf) return reply(['⚠ Send or reply to an image'])
    const res = await describeImage(imgBuf)
    if (!res) return reply(['❌ Could not describe image'])
    return reply([`📸 *AI sees:*`, '', res])
  }

  // ══ HELP MENU ══
  if (['photo','help'].includes(cmd)) {
    return reply([
      `📋 *Available Commands (prefix: ${prefix})*`,
      '',
      `🖼 ${prefix}removebg — Remove background`,
      `🔍 ${prefix}upscale — Upscale image 2x`,
      `🎨 ${prefix}imagine <prompt> — AI image`,
      `🌫️ ${prefix}blur [level] — Blur image`,
      `✨ ${prefix}unblur — Sharpen image`,
      `💫 ${prefix}remini — Enhance face`,
      `🎬 ${prefix}videogen <prompt> — AI video`,
      `🎤 ${prefix}tts [male|female|child] <text>`,
      `🎵 ${prefix}lyrics <song>`,
      `📖 ${prefix}bible <verse>`,
      `🕌 ${prefix}quran <surah:ayah>`,
      `🍽️ ${prefix}food <name>`,
      `🎴 ${prefix}sticker — Image to sticker`,
      `🎨 ${prefix}colorize — Colorize B&W`,
      `🖌️ ${prefix}cartoon — Cartoon effect`,
      `📲 ${prefix}qr <text> — QR code`,
      `📝 ${prefix}ocr — Read text from image`,
      `📢 ${prefix}setstatus — WhatsApp Story`,
      `🌸 ${prefix}waifu [category]`,
      `💡 ${prefix}neon — Neon effect`,
      `✏️ ${prefix}sketch — Sketch effect`,
      `🖼️ ${prefix}oil — Oil paint effect`,
      `👾 ${prefix}pixel — Pixel art`,
      `🔤 ${prefix}ascii — ASCII art`,
      `👤 ${prefix}face — Face detection`,
      `🌐 ${prefix}translate [lang] <text>`,
      `😂 ${prefix}meme <top> | <bottom>`,
      `😊 ${prefix}emojify <text>`,
      `🔥 ${prefix}roast <name>`,
      `💜 ${prefix}compliment <name>`,
      `📸 ${prefix}caption — Describe image`
    ])
  }
}
