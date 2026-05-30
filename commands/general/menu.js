// commands/general/menu.js
// Smart interactive menu — reads categories from router, image from Supabase
// Interactive buttons (WhatsApp channel-style via interactiveMessage)
// User picks category by NUMBER — no prefix needed (session-based)
// Baileys 6.7.22 | Self-contained | Supabase-aware

export const name = 'menu'
export const alias = ['start', 'help', 'commands', 'cmds', 'list']
export const category = 'General'
export const desc = 'Interactive bot menu with category navigation'
export const restricted = false

import { getAllCommands } from '../../lib/router.js'

// ── Active menu sessions: from → { categories, page, msgKey, ts }
const SESSIONS = new Map()

// Auto-expire sessions after 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of SESSIONS.entries()) {
    if (now - v.ts > 5 * 60 * 1000) SESSIONS.delete(k)
  }
}, 60 * 1000)

// ══════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════
function box(lines) {
  const clean = lines.filter(l => l != null && l !== '')
  return clean.map(l => `│ ${l}`).join('\n')
}

function getCategoryEmoji(cat) {
  const map = {
    GENERAL:    '🏠', SETTINGS:   '⚙️',  OWNER:      '👑',
    GAMES:      '🎮', AI:         '🤖',  PHOTO:      '🖼️',
    CREATOR:    '🎨', DOWNLOAD:   '⬇️',  ULTIMATE:   '⚡',
    MEDIA:      '🎵', GROUP:      '👥',  FUN:        '😄',
    UTILITY:    '🔧', NSFW:       '🔞',  ANIME:      '🌸',
    INFO:       'ℹ️',  TOOLS:      '🛠️',  SOCIAL:     '📱',
    AUTO:       '🔄', ANTI:       '🛡️',  SEARCH:     '🔍',
    ECONOMY:    '💰', MUSIC:      '🎵',  STICKER:    '🎭',
  }
  return map[cat?.toUpperCase()] || '📁'
}

// Build categories map from loaded commands
function buildCategories() {
  const allCmds = getAllCommands()
  const cats = {}
  for (const cmd of allCmds) {
    const cat = (cmd.category || 'General').toUpperCase()
    if (!cats[cat]) cats[cat] = []
    cats[cat].push(cmd)
  }
  return cats
}

// ── Send via interactiveMessage (channel-style buttons, Baileys 6.7.22)
async function sendInteractive(sock, from, msg, imageUrl, headerText, bodyText, footerText, buttons) {
  // Method 1: interactiveMessage with nativeFlowMessage (modern WA)
  try {
    await sock.sendMessage(from, {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            header: {
              hasMediaAttachment: !!imageUrl,
              ...(imageUrl ? {
                imageMessage: {
                  url: imageUrl,
                  mimetype: 'image/jpeg',
                  fileSha256: Buffer.alloc(32),
                  fileLength: 0,
                  height: 100,
                  width: 100,
                  mediaKey: Buffer.alloc(32),
                  fileEncSha256: Buffer.alloc(32),
                  directPath: ''
                }
              } : { title: headerText || '' })
            },
            body: { text: bodyText },
            footer: { text: footerText || '' },
            nativeFlowMessage: {
              buttons: buttons.map(b => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                  display_text: b.label,
                  id: b.id
                })
              })),
              messageParamsJson: ''
            }
          }
        }
      }
    }, { quoted: msg })
    return true
  } catch {}

  // Method 2: buttonsMessage (older Baileys)
  try {
    await sock.sendMessage(from, {
      image: imageUrl ? { url: imageUrl } : undefined,
      caption: imageUrl ? bodyText : undefined,
      text: imageUrl ? undefined : bodyText,
      footer: footerText,
      buttons: buttons.map((b, i) => ({
        buttonId: b.id,
        buttonText: { displayText: b.label },
        type: 1
      })),
      headerType: imageUrl ? 4 : 1
    }, { quoted: msg })
    return true
  } catch {}

  // Method 3: listMessage (list-style fallback)
  try {
    await sock.sendMessage(from, {
      text: bodyText,
      footer: footerText,
      title: headerText,
      buttonText: '📋 View Menu',
      sections: [{
        title: headerText || 'Menu',
        rows: buttons.map(b => ({
          title: b.label,
          rowId: b.id,
          description: b.desc || ''
        }))
      }],
      listType: 1
    }, { quoted: msg })
    return true
  } catch {}

  // Method 4: Plain text with image (always works)
  try {
    if (imageUrl) {
      await sock.sendMessage(from, {
        image: { url: imageUrl },
        caption: bodyText + (footerText ? `\n\n${footerText}` : '')
      }, { quoted: msg })
    } else {
      await sock.sendMessage(from, {
        text: bodyText + (footerText ? `\n\n${footerText}` : '')
      }, { quoted: msg })
    }
    return true
  } catch {}

  return false
}

// ── Fetch bot settings from Supabase using instanceId
async function fetchSettings(botSettings) {
  try {
    const db = botSettings?.supabase
    const id = botSettings?.instance_id
    if (!db || !id) return botSettings

    const { data, error } = await db
      .from('b_settings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !data) return botSettings
    return { ...botSettings, ...data }
  } catch {
    return botSettings
  }
}

// ══════════════════════════════════════════
// MAIN MENU DISPLAY
// ══════════════════════════════════════════
async function showMainMenu(sock, from, msg, settings, brand, prefix) {
  const cats = buildCategories()
  const catList = Object.keys(cats).sort()
  const imageUrl = settings?.startup_image || null

  // Build display lines
  const totalCmds = getAllCommands().length
  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const bodyLines = [
    `╭─⌈ 📋 *${brand} — Command Menu* ⌋`,
    `│`,
    `│ 👋 Welcome! Choose a category below.`,
    `│ 📦 Total Commands: *${totalCmds}*`,
    `│ 🗂️  Categories: *${catList.length}*`,
    `│ 🕐 ${timeStr} | 📅 ${dateStr}`,
    `│`,
    `│ *Categories:*`,
    ...catList.map((cat, i) => {
      const emoji = getCategoryEmoji(cat)
      const count = cats[cat].length
      return `│ ${i + 1}. ${emoji} *${cat}* (${count} cmds)`
    }),
    `│`,
    `│ ✏️ Reply with a number to explore`,
    `╰⊷ *Powered By ${brand}*`
  ]

  const bodyText = bodyLines.join('\n')
  const footerText = `${brand} • ${prefix}menu to return`

  // Buttons — max 5 per interactive message, so show first 5 + "More"
  const visibleCats = catList.slice(0, 5)
  const hasMore = catList.length > 5

  const buttons = [
    ...visibleCats.map((cat, i) => ({
      label: `${getCategoryEmoji(cat)} ${cat} (${cats[cat].length})`,
      id: `menu_cat_${i + 1}`,
      desc: `View ${cats[cat].length} commands`
    })),
    ...(hasMore ? [{ label: '➡️ More Categories', id: 'menu_more', desc: 'See all categories' }] : [])
  ]

  // Save session
  SESSIONS.set(from, {
    categories: catList,
    catMap: cats,
    page: 0,
    ts: Date.now(),
    imageUrl
  })

  await sendInteractive(sock, from, msg, imageUrl, `${brand} Menu`, bodyText, footerText, buttons)
}

// ══════════════════════════════════════════
// CATEGORY VIEW
// ══════════════════════════════════════════
async function showCategory(sock, from, msg, catName, settings, brand, prefix) {
  const cats = buildCategories()
  const cmds = cats[catName?.toUpperCase()]
  if (!cmds) {
    return sock.sendMessage(from, {
      text: `❌ Category *${catName}* not found.\nSend *${prefix}menu* to see all categories.`
    }, { quoted: msg })
  }

  const emoji = getCategoryEmoji(catName)
  const imageUrl = settings?.startup_image || null

  const bodyLines = [
    `╭─⌈ ${emoji} *${catName} Commands* ⌋`,
    `│`,
    `│ Found *${cmds.length} commands*`,
    `│`,
    ...cmds.map(cmd => {
      const aliases = cmd.alias?.slice(0, 2).join(', ')
      return `│ ▸ *${prefix}${cmd.name}*${aliases ? ` (${aliases})` : ''}\n│   ${cmd.desc || 'No description'}`
    }),
    `│`,
    `│ 💡 Send *${prefix}menu* to go back`,
    `╰⊷ *Powered By ${brand}*`
  ]

  const bodyText = bodyLines.join('\n')

  // Buttons for category — up to 5 commands as quick buttons + back
  const cmdButtons = cmds.slice(0, 4).map(cmd => ({
    label: `${prefix}${cmd.name}`,
    id: `cmd_${cmd.name}`,
    desc: cmd.desc?.slice(0, 50) || ''
  }))

  cmdButtons.push({ label: '🏠 Back to Menu', id: 'menu_back', desc: 'Return to main menu' })

  await sendInteractive(sock, from, msg, imageUrl,
    `${emoji} ${catName}`, bodyText,
    `${cmds.length} commands • ${brand}`, cmdButtons)
}

// ══════════════════════════════════════════
// HANDLE NUMERIC REPLIES (no prefix needed)
// ══════════════════════════════════════════
async function handleNumericReply(sock, from, msg, num, brand, prefix, settings) {
  const session = SESSIONS.get(from)
  if (!session) return false // no active session

  const catList = session.categories
  const idx = parseInt(num) - 1

  if (idx >= 0 && idx < catList.length) {
    const catName = catList[idx]
    await showCategory(sock, from, msg, catName, settings, brand, prefix)
    return true
  }
  return false
}

// ══════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════
export default async function menu(sock, ctx, botSettings) {
  const { msg, from, args, body, isFromMe, sender } = ctx

  // Fetch fresh settings (startup_image, botname, etc.)
  const settings = await fetchSettings(botSettings)
  const brand  = settings?.brand_name || settings?.botname || 'Bot'
  const prefix = settings?.prefix || '.'

  // ── Check if this is a numeric reply to active session ──
  // Works WITHOUT prefix — user just types "1", "2", "3"
  const rawBody = msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text || ''

  const trimmed = rawBody.trim()

  // Handle button responses (id from interactive buttons)
  const buttonId =
    msg?.message?.buttonsResponseMessage?.selectedButtonId ||
    msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg?.message?.templateButtonReplyMessage?.selectedId || ''

  if (buttonId) {
    if (buttonId === 'menu_back') {
      await showMainMenu(sock, from, msg, settings, brand, prefix)
      return
    }
    if (buttonId === 'menu_more') {
      const session = SESSIONS.get(from)
      if (session) {
        const remaining = session.categories.slice(5)
        const imageUrl = settings?.startup_image || null
        const lines = [
          `╭─⌈ 📋 *More Categories* ⌋`,
          `│`,
          ...remaining.map((cat, i) => {
            const emoji = getCategoryEmoji(cat)
            const count = session.catMap[cat]?.length || 0
            return `│ ${i + 6}. ${emoji} *${cat}* (${count} cmds)`
          }),
          `│`,
          `│ Reply with number to explore`,
          `╰⊷ *Powered By ${brand}*`
        ]
        const buttons = remaining.slice(0, 5).map((cat, i) => ({
          label: `${getCategoryEmoji(cat)} ${cat}`,
          id: `menu_cat_${i + 6}`,
          desc: `${session.catMap[cat]?.length || 0} commands`
        }))
        buttons.push({ label: '🏠 Back to Menu', id: 'menu_back', desc: '' })
        await sendInteractive(sock, from, msg, imageUrl, 'More Categories', lines.join('\n'), brand, buttons)
      }
      return
    }
    if (buttonId.startsWith('menu_cat_')) {
      const num = buttonId.replace('menu_cat_', '')
      await handleNumericReply(sock, from, msg, num, brand, prefix, settings)
      return
    }
    if (buttonId.startsWith('cmd_')) {
      const cmdName = buttonId.replace('cmd_', '')
      await sock.sendMessage(from, {
        text: `💡 To use this command:\n*${prefix}${cmdName}*`
      }, { quoted: msg })
      return
    }
  }

  // ── Pure number reply (no prefix) — check active session ──
  if (/^\d+$/.test(trimmed) && trimmed.length <= 3) {
    const handled = await handleNumericReply(sock, from, msg, trimmed, brand, prefix, settings)
    if (handled) return
    // No session — fall through to show menu
  }

  // ── React ──
  try {
    await sock.sendMessage(from, { react: { text: '📋', key: msg.key } })
  } catch {}

  // ── Show main menu ──
  await showMainMenu(sock, from, msg, settings, brand, prefix)
}