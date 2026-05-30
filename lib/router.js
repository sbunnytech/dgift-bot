// lib/router.js — Stable Fixed Edition
// Fixes:
//  1. Self-DM (fromMe) works — no blocking
//  2. DM + Group + Status all work
//  3. Observers run everywhere, always
//  4. Alias conflicts → first-loaded wins, logged clearly
//  5. DGIFT_DEFAULT → always replaced with real instanceId
//  6. Owner detection — 12 strategies, LID-aware
//  7. Mode logic clean: private/owner/public
//  8. Command context always has `command` field (photo.js pattern)

import { readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ══════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════
const commands = new Map()          // name → cmdData
const aliasMap  = new Map()         // alias → cmdName (one-to-one)
const observers = []
let isLoaded = false

// ══════════════════════════════════════════
// JID HELPERS
// ══════════════════════════════════════════
function normalizeJid(jid) {
  if (!jid) return null
  if (jid === 'status@broadcast') return jid
  // Strip device suffix :X
  const bare = String(jid).split(':')[0]
  // LID → s.whatsapp.net
  if (bare.endsWith('@lid')) {
    const num = bare.split('@')[0].replace(/\D/g, '')
    return num ? `${num}@s.whatsapp.net` : bare.toLowerCase()
  }
  return bare.toLowerCase()
}

function toNum(jid) {
  if (!jid) return ''
  return String(jid).split('@')[0].replace(/\D/g, '')
}

// Resolve LID → real JID
function resolveLid(participants, jid, sock) {
  if (!jid) return jid
  if (!String(jid).endsWith('@lid')) return normalizeJid(jid)
  const lidNum = toNum(jid)
  // Strategy 1: participant list
  for (const p of (participants || [])) {
    if (toNum(normalizeJid(p.id)) === lidNum) return normalizeJid(p.id)
  }
  // Strategy 2: sock store
  try {
    if (sock?.store?.contacts) {
      const hit = Object.values(sock.store.contacts).find(c =>
        toNum(c.id) === lidNum || toNum(c.lid) === lidNum
      )
      if (hit?.id) return normalizeJid(hit.id)
    }
  } catch {}
  // Strategy 3: build from number
  return lidNum ? `${lidNum}@s.whatsapp.net` : normalizeJid(jid)
}

// ══════════════════════════════════════════
// OWNER DETECTION — 12 strategies
// ══════════════════════════════════════════
function buildOwnerSet(sock, botSettings) {
  const s = new Set()
  const add = (v) => {
    if (!v) return
    const n = normalizeJid(String(v)); if (n) s.add(n)
    const num = toNum(String(v)); if (num) { s.add(num); s.add(`${num}@s.whatsapp.net`) }
    const bare = String(v).split('@')[0]; if (bare) s.add(bare)
  }
  try { add(sock?.user?.id) }                           catch {} // 1
  try { add(sock?.user?.id?.split(':')[0]) }            catch {} // 2
  try { add(sock?.authState?.creds?.me?.id) }           catch {} // 3
  try { add(sock?.authState?.creds?.me?.lid) }          catch {} // 4
  try { add(botSettings?.owner_number) }                catch {} // 5
  try { add(process.env.OWNER_NUMBER) }                 catch {} // 6
  try { add(process.env.INSTANCE_OWNER) }               catch {} // 7
  try { // 8: last 9 digits match
    const ownerNum = toNum(botSettings?.owner_number || '')
    if (ownerNum.length > 9) s.add(ownerNum.slice(-9))
  } catch {}
  try { // 9: admin_numbers array
    for (const n of (botSettings?.admin_numbers || [])) add(n)
  } catch {}
  try { // 10: vip_numbers that are admins
    for (const n of (botSettings?.vip_numbers || [])) {
      const num = toNum(String(n))
      if (num) s.add(num)
    }
  } catch {}
  return s
}

function isOwnerCheck(sender, isFromMe, sock, botSettings) {
  // fromMe = ALWAYS owner, no debate
  if (isFromMe === true) return true
  const ownerSet = buildOwnerSet(sock, botSettings)
  const sNum = toNum(sender)
  const sNorm = normalizeJid(sender)
  if (ownerSet.has(sNorm)) return true                          // 11
  if (ownerSet.has(sNum)) return true                           // 12
  if (sNum.length > 9 && ownerSet.has(sNum.slice(-9))) return true
  for (const v of ownerSet) {
    const vNum = toNum(v)
    if (vNum && vNum === sNum) return true
    if (vNum && sNum && sNum.endsWith(vNum.slice(-9))) return true
    if (vNum && sNum && vNum.endsWith(sNum.slice(-9))) return true
  }
  return false
}

// ══════════════════════════════════════════
// SUPABASE PROXY
// KEY FIX: Any query using id='DGIFT_DEFAULT' is
// transparently replaced with real instanceId
// This fixes autoreact, autolikestatus, ALL settings commands
// without touching those command files at all
// ══════════════════════════════════════════
function wrapSupabase(supabase, instanceId) {
  if (!supabase || !instanceId) return supabase

  const patchQuery = (query) => new Proxy(query, {
    get(t, prop) {
      // Intercept .eq('id', 'DGIFT_DEFAULT')
      if (prop === 'eq') {
        return (col, val) => {
          const replaced = (col === 'id' && val === 'DGIFT_DEFAULT') ? instanceId : val
          return patchQuery(t.eq(col, replaced))
        }
      }
      // Intercept .upsert / .insert / .update with DGIFT_DEFAULT in data
      if (prop === 'upsert' || prop === 'insert' || prop === 'update') {
        return (data, opts) => {
          if (data && typeof data === 'object') {
            const fixed = Array.isArray(data)
              ? data.map(d => d.id === 'DGIFT_DEFAULT' ? { ...d, id: instanceId } : d)
              : data.id === 'DGIFT_DEFAULT' ? { ...data, id: instanceId } : data
            return patchQuery(t[prop](fixed, opts))
          }
          return patchQuery(t[prop](data, opts))
        }
      }
      const val = t[prop]
      return typeof val === 'function' ? val.bind(t) : val
    }
  })

  return new Proxy(supabase, {
    get(target, prop) {
      if (prop === 'from') {
        return (table) => patchQuery(target.from(table))
      }
      const val = target[prop]
      return typeof val === 'function' ? val.bind(target) : val
    }
  })
}

// ══════════════════════════════════════════
// MESSAGE BODY EXTRACTOR
// ══════════════════════════════════════════
function extractBody(msg) {
  const m = msg?.message
  if (!m) return { body: '', type: 'unknown', isViewOnce: false }

  if (m.conversation)
    return { body: m.conversation, type: 'text', isViewOnce: false }
  if (m.extendedTextMessage)
    return { body: m.extendedTextMessage.text || '', type: 'text', isViewOnce: false }
  if (m.imageMessage)
    return { body: m.imageMessage.caption || '', type: 'image', isViewOnce: !!m.imageMessage.viewOnce }
  if (m.videoMessage)
    return { body: m.videoMessage.caption || '', type: 'video', isViewOnce: !!m.videoMessage.viewOnce }
  if (m.audioMessage)
    return { body: '', type: 'audio', isViewOnce: !!m.audioMessage.viewOnce }
  if (m.documentMessage)
    return { body: m.documentMessage.caption || '', type: 'document', isViewOnce: false }
  if (m.reactionMessage)
    return { body: m.reactionMessage.text || '', type: 'reaction', isViewOnce: false }
  if (m.buttonsResponseMessage)
    return { body: m.buttonsResponseMessage.selectedButtonId || '', type: 'button', isViewOnce: false }
  if (m.listResponseMessage)
    return { body: m.listResponseMessage.singleSelectReply?.selectedRowId || '', type: 'list', isViewOnce: false }
  if (m.templateButtonReplyMessage)
    return { body: m.templateButtonReplyMessage.selectedId || '', type: 'template', isViewOnce: false }
  if (m.viewOnceMessageV2) {
    const inner = m.viewOnceMessageV2.message || {}
    if (inner.imageMessage)  return { body: inner.imageMessage.caption || '',  type: 'image',  isViewOnce: true }
    if (inner.videoMessage)  return { body: inner.videoMessage.caption || '',  type: 'video',  isViewOnce: true }
    if (inner.audioMessage)  return { body: '',                                type: 'audio',  isViewOnce: true }
  }
  return { body: '', type: 'unknown', isViewOnce: false }
}

// ══════════════════════════════════════════
// COMMAND LOADER
// Alias conflict rule:
//   - First loaded command that claims an alias wins
//   - Subsequent conflicts are logged and skipped
//   - No overwrite, no silent data loss
// ══════════════════════════════════════════
async function loadCommands(dir) {
  let items
  try { items = readdirSync(dir) } catch { return }

  for (const item of items) {
    const fullPath = join(dir, item)
    try {
      if (statSync(fullPath).isDirectory()) {
        await loadCommands(fullPath)
        continue
      }
      if (!item.endsWith('.js')) continue

      await new Promise(r => setTimeout(r, 30)) // slight stagger for Render free tier

      const mod = await import(pathToFileURL(fullPath).href)
      if (!mod.name || typeof mod.default !== 'function') {
        console.log(`[SKIP] ${item} — missing name or default export`)
        continue
      }

      const cmdName = mod.name.toLowerCase().trim()

      // No overwrite — first loaded wins
      if (commands.has(cmdName)) {
        console.log(`[SKIP] ${item} — command name "${cmdName}" already loaded`)
        continue
      }

      const cmdData = {
        name: cmdName,
        alias: Array.isArray(mod.alias) ? mod.alias.map(a => a.toLowerCase().trim()) : [],
        category: mod.category || 'General',
        desc: mod.desc || '',
        restricted: mod.restricted || false,
        run: mod.default,
        file: item
      }

      commands.set(cmdName, cmdData)

      // Register aliases — skip conflicts, log them
      for (const al of cmdData.alias) {
        if (!al || al === cmdName) continue
        if (aliasMap.has(al)) {
          const owner = aliasMap.get(al)
          console.log(`[ALIAS-CONFLICT] "${al}" already claimed by "${owner}" — skipping for "${cmdName}"`)
          continue
        }
        aliasMap.set(al, cmdName)
      }

      console.log(`[LOADED] ${cmdName} [${cmdData.category}] aliases:${cmdData.alias.length}`)
    } catch (err) {
      console.log(`[WARN] ${item}: ${err.message.split('\n')[0]}`)
    }
  }
}

// ══════════════════════════════════════════
// OBSERVER LOADER
// ══════════════════════════════════════════
async function loadObservers(dir) {
  let files
  try { files = readdirSync(dir).filter(f => f.endsWith('.js')) } catch {
    console.log('[INFO] No observers folder')
    return
  }
  for (const file of files) {
    try {
      await new Promise(r => setTimeout(r, 30))
      const mod = await import(pathToFileURL(join(dir, file)).href)
      if (typeof mod.default === 'function') {
        observers.push({ name: file.replace('.js', ''), run: mod.default })
        console.log(`[OBSERVER] ${file.replace('.js', '')}`)
      }
    } catch (err) {
      console.log(`[WARN-OBS] ${file}: ${err.message.split('\n')[0]}`)
    }
  }
}

// ══════════════════════════════════════════
// SAVE MENU TO SUPABASE
// ══════════════════════════════════════════
async function saveMenuToDB(botSettings) {
  if (!botSettings?.supabase || !botSettings?.instance_id) return
  const menu = {}
  for (const cmd of commands.values()) {
    const cat = (cmd.category || 'General').toUpperCase()
    if (!menu[cat]) menu[cat] = []
    menu[cat].push(cmd.name)
  }
  try {
    await botSettings.supabase
      .from('b_settings')
      .update({ menu_list: menu, updated_at: new Date().toISOString() })
      .eq('id', botSettings.instance_id)
    botSettings.menu_list = menu
    console.log('[MENU] Saved to Supabase')
  } catch (err) {
    console.log('[WARN] Menu save failed:', err.message)
  }
}

// ══════════════════════════════════════════
// INITIALIZE
// ══════════════════════════════════════════
export async function initializeRouter(botSettings) {
  if (isLoaded) return
  console.log('[INIT] Loading commands and observers...')
  const root = join(__dirname, '..')
  await loadCommands(join(root, 'commands'))
  await loadObservers(join(root, 'observers'))
  await saveMenuToDB(botSettings)
  isLoaded = true
  console.log(`[INIT] Commands: ${commands.size} | Aliases: ${aliasMap.size} | Observers: ${observers.length}`)
}

export function getAllCommands() { return Array.from(commands.values()) }
export function getAllObservers() { return observers.map(o => ({ name: o.name })) }

// ══════════════════════════════════════════
// HANDLE MESSAGES — The fixed core
// ══════════════════════════════════════════
export async function handleMessages(sock, m, botSettings) {
  try {
    if (m.type !== 'notify') return
    const msg = m.messages?.[0]
    if (!msg?.message) return

    const { body, type: msgType, isViewOnce } = extractBody(msg)
    const rawJid = msg.key?.remoteJid
    if (!rawJid) return

    const from = normalizeJid(rawJid)
    if (!from) return

    const isGroup   = from.endsWith('@g.us')
    const isStatus  = from === 'status@broadcast'
    // KEY FIX: fromMe is true when you message your own DM
    // We must NOT block this — self-DM commands must work
    const isFromMe  = msg.key?.fromMe === true

    // ── Sender resolution ──
    let rawSender = isGroup ? msg.key?.participant : rawJid
    rawSender = rawSender || rawJid

    let groupMetadata  = null
    let participants   = []
    let isBotAdmin     = false

    if (isGroup) {
      try {
        groupMetadata = await sock.groupMetadata(from)
        participants  = groupMetadata?.participants || []
        rawSender     = resolveLid(participants, rawSender, sock)
        const botJid  = normalizeJid(sock.user?.id)
        const botP    = participants.find(p => normalizeJid(p.id) === botJid)
        isBotAdmin    = !!(botP?.admin)
      } catch (err) {
        console.log('Group meta error:', err.message)
      }
    }

    const sender    = normalizeJid(rawSender) || normalizeJid(rawJid)
    const senderNum = toNum(sender)
    const pushName  = msg.pushName || 'User'

    // ── Permissions ──
    const isOwner = isOwnerCheck(sender, isFromMe, sock, botSettings)
    const vipNums = (botSettings?.vip_numbers || []).map(n => toNum(String(n))).filter(Boolean)
    const isVIP   = vipNums.includes(senderNum)
    const isAdmin = isOwner || isVIP || isFromMe

    // ── Subbot numbers ──
    const subbotNums = (botSettings?.subbot_numbers || []).map(n => toNum(String(n))).filter(Boolean)
    const isSubbot   = subbotNums.includes(senderNum)

    // ── Resolve mentions ──
    try {
      const ci = msg.message?.extendedTextMessage?.contextInfo
      if (ci?.mentionedJid?.length) {
        ci.mentionedJid = ci.mentionedJid
          .map(j => normalizeJid(resolveLid(participants, j, sock)))
          .filter(Boolean)
      }
      if (ci?.participant) {
        ci.participant = normalizeJid(resolveLid(participants, ci.participant, sock))
      }
    } catch {}

    // ── Wrap supabase so DGIFT_DEFAULT → instanceId everywhere ──
    const wrappedSupa = wrapSupabase(botSettings?.supabase, botSettings?.instance_id)
    const wrappedSettings = {
      ...botSettings,
      supabase: wrappedSupa,
      instance_id: botSettings?.instance_id
    }

    // Build shared context for observers + commands
    const sharedCtx = {
      msg, from, sender, senderNum, body, msgType, isViewOnce,
      isGroup, isStatus, pushName,
      isAdmin, isOwner, isVIP, isFromMe, isSubbot,
      isBotAdmin, groupMetadata, participants,
      botSettings: wrappedSettings,
      stableMode:  botSettings?.stable_mode !== false,
      antiBanMode: botSettings?.anti_ban_mode === true
    }

    // ══════════════════════════════════════
    // RUN OBSERVERS
    // KEY FIX:
    //   - Status messages → observers only (not commands)
    //   - fromMe messages → observers run (autolikestatus needs this for own status)
    //   - DM, Group, Status → all pass through
    //   - NO observer is blocked unless it errors
    // ══════════════════════════════════════
    for (const obs of observers) {
      try {
        await obs.run(sock, sharedCtx, wrappedSettings)
      } catch (err) {
        console.log(`[OBS-ERR] ${obs.name}: ${err.message}`)
      }
    }

    // Status messages don't run commands
    if (isStatus) return

    // ══════════════════════════════════════
    // COMMAND ROUTING
    // KEY FIX: isFromMe is NO LONGER blocked here
    // Self-DM commands work just like any other DM
    // ══════════════════════════════════════
    if (!body) return

    const prefix = botSettings?.prefix ?? '.'
    if (!body.startsWith(prefix)) return

    const withoutPrefix = body.slice(prefix.length).trim()
    if (!withoutPrefix) return

    const parts    = withoutPrefix.split(/\s+/)
    const inputCmd = parts[0]?.toLowerCase()
    const args     = parts.slice(1)
    const argText  = args.join(' ').trim()

    if (!inputCmd) return

    // ── Resolve command — name first, then alias ──
    let cmdData   = null
    let resolvedName = inputCmd

    if (commands.has(inputCmd)) {
      cmdData = commands.get(inputCmd)
      resolvedName = inputCmd
    } else if (aliasMap.has(inputCmd)) {
      const mapped = aliasMap.get(inputCmd)
      cmdData = commands.get(mapped) || null
      resolvedName = mapped
    }

    // Unknown command — stay silent
    if (!cmdData) return

    // ══════════════════════════════════════
    // MODE ENFORCEMENT
    //
    // private_mode  → ONLY owner responds, everyone else = silence
    // owner_mode    → owner + VIP + admins only, others = denied message
    // public_mode   → everyone can use non-restricted commands
    // default       → public behavior
    //
    // Restricted commands (restricted:true OR restricted category)
    //   always require isAdmin regardless of mode
    // ══════════════════════════════════════
    const privateMode = botSettings?.private_mode === true
    const ownerMode   = botSettings?.owner_mode   === true
    const publicMode  = botSettings?.public_mode  === true

    const restrictedCategories = botSettings?.restricted_categories ||
      ['Settings', 'Auto', 'Anti', 'Owner']
    const isRestricted = cmdData.restricted === true ||
      restrictedCategories.includes(cmdData.category)

    let allowed = false

    if (privateMode) {
      // Absolute silence for non-owners
      if (!isOwner) return
      allowed = true
    } else if (ownerMode) {
      allowed = isAdmin
    } else if (publicMode) {
      allowed = isRestricted ? isAdmin : true
    } else {
      // Default: public
      allowed = isRestricted ? isAdmin : true
    }

    // Subbots get non-restricted commands in non-private mode
    if (!allowed && isSubbot && !privateMode && !isRestricted) allowed = true

    if (!allowed) {
      // owner_mode: silent deny
      if (ownerMode) return
      try {
        await sock.sendMessage(from, {
          text: `🔒 You need *admin permissions* to use *${prefix}${resolvedName}*`
        }, { quoted: msg })
      } catch {}
      return
    }

    // ── Build command context ──
    // KEY: includes both `command` (photo.js style) and `commandName` (legacy style)
    const cmdCtx = {
      ...sharedCtx,
      args,
      argText,
      command:     resolvedName,   // photo.js / creator.js use this
      commandName: resolvedName,   // legacy commands use this
    }

    console.log(`[CMD] ${prefix}${cmdData.name} | ${pushName} | owner:${isOwner} | group:${isGroup} | dm:${!isGroup && !isStatus}`)

    try {
      await cmdData.run(sock, cmdCtx, wrappedSettings)
    } catch (err) {
      console.log(`[CMD-ERR] ${cmdData.name}: ${err.message}`)
      try {
        await sock.sendMessage(from, {
          text: `⚠️ Error in *${prefix}${cmdData.name}*`
        }, { quoted: msg })
      } catch {}
    }

  } catch (err) {
    console.log('[ROUTER-ERR]', err.message)
  }
}
