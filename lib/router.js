// =====================================================
// LIBS IMPORT
// =====================================================

import {
  readdirSync,
  statSync,
  existsSync
} from 'fs'

import {
  join,
  dirname
} from 'path'

import {
  fileURLToPath,
  pathToFileURL
} from 'url'

// =====================================================
// NEW LIB ENGINE IMPORTS
// =====================================================

import {
  initializeTheme,
  reloadTheme,
  getTheme,
  getThemeName
} from './themeManager.js'

import {
  formatRuntimeBox as formatBox
} from './boxRuntime.js'

// =====================================================
// PATH
// =====================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// =====================================================
// INSTANCE SAFETY
// =====================================================

const INSTANCE_ID =
  process.env.INSTANCE_ID

if (
  !INSTANCE_ID ||
  INSTANCE_ID.trim() === '' ||
  INSTANCE_ID === 'DGIFT_DEFAULT'
) {
  console.log(
    '[ROUTER] Invalid INSTANCE_ID detected'
  )

  process.exit(1)
}

// =====================================================
// STORAGE
// =====================================================

const commands = new Map()
const aliases = new Map()
const observers = []

let isLoaded = false

// =====================================================
// HELPERS
// =====================================================

function delay(ms = 100) {
  return new Promise(resolve =>
    setTimeout(resolve, ms)
  )
}

function safeArray(arr) {
  return Array.isArray(arr)
    ? arr
    : []
}

function normalizeJid(jid = '') {
  try {

    if (!jid) return null

    if (jid === 'status@broadcast') {
      return jid
    }

    jid = jid.split(':')[0]

    if (jid.endsWith('@lid')) {
      const num = jid
        .replace(/[^0-9]/g, '')

      if (num) {
        return `${num}@s.whatsapp.net`
      }
    }

    return jid.toLowerCase()

  } catch {
    return null
  }
}

function toNumber(jid = '') {
  try {

    if (!jid) return ''

    return jid
      .split('@')[0]
      .replace(/[^0-9]/g, '')

  } catch {
    return ''
  }
}

// =====================================================
// OWNER ENGINE
// =====================================================

function getOwnerVariants(
  sock,
  botSettings = {}
) {
  const variants = new Set()

  try {
    if (sock?.user?.id) {
      variants.add(normalizeJid(sock.user.id))
      variants.add(toNumber(sock.user.id))
      variants.add(sock.user.id.split(':')[0])
    }
  } catch {}

  try {
    if (sock?.authState?.creds?.me?.id) {
      variants.add(
        normalizeJid(
          sock.authState.creds.me.id
        )
      )

      variants.add(
        toNumber(
          sock.authState.creds.me.id
        )
      )
    }
  } catch {}

  try {
    if (sock?.authState?.creds?.me?.lid) {
      variants.add(
        normalizeJid(
          sock.authState.creds.me.lid
        )
      )

      variants.add(
        toNumber(
          sock.authState.creds.me.lid
        )
      )
    }
  } catch {}

  try {
    if (botSettings?.owner_number) {
      const num = toNumber(
        botSettings.owner_number
      )

      if (num) {
        variants.add(num)
        variants.add(`${num}@s.whatsapp.net`)
        variants.add(`${num}@lid`)
      }
    }
  } catch {}

  try {
    if (process.env.OWNER_NUMBER) {
      const num = toNumber(
        process.env.OWNER_NUMBER
      )

      if (num) {
        variants.add(num)
        variants.add(`${num}@s.whatsapp.net`)
      }
    }
  } catch {}

  try {
    safeArray(
      botSettings?.admin_numbers
    ).forEach(v => {
      const num = toNumber(v)

      if (num) {
        variants.add(num)
        variants.add(`${num}@s.whatsapp.net`)
      }
    })
  } catch {}

  return Array
    .from(variants)
    .filter(Boolean)
}

// =====================================================
// LID RESOLVE
// =====================================================

function resolveParticipant(
  participants = [],
  jid = '',
  sock = null
) {
  try {

    if (!jid) return jid

    if (!jid.endsWith('@lid')) {
      return normalizeJid(jid)
    }

    const lidNum = toNumber(jid)

    const found = participants.find(p => {
      const id = normalizeJid(
        p.id || ''
      )

      return (
        toNumber(id) === lidNum
      )
    })

    if (found?.id) {
      return normalizeJid(found.id)
    }

    try {
      const contacts =
        sock?.store?.contacts || {}

      const matched = Object
        .values(contacts)
        .find(c => {
          return (
            toNumber(c?.id || '') === lidNum ||
            toNumber(c?.lid || '') === lidNum
          )
        })

      if (matched?.id) {
        return normalizeJid(
          matched.id
        )
      }

    } catch {}

    return `${lidNum}@s.whatsapp.net`

  } catch {
    return normalizeJid(jid)
  }
}

// =====================================================
// MESSAGE EXTRACTOR
// =====================================================

function extractMessage(msg = {}) {
  try {

    const message =
      msg.message || {}

    let body = ''
    let msgType = 'unknown'
    let isViewOnce = false
    let reaction = null

    if (message.conversation) {
      body = message.conversation
      msgType = 'conversation'
    }

    else if (
      message.extendedTextMessage
    ) {
      body =
        message.extendedTextMessage.text || ''

      msgType =
        'extendedTextMessage'
    }

    else if (
      message.imageMessage
    ) {
      body =
        message.imageMessage.caption || ''

      msgType = 'imageMessage'

      isViewOnce =
        message.imageMessage.viewOnce === true
    }

    else if (
      message.videoMessage
    ) {
      body =
        message.videoMessage.caption || ''

      msgType = 'videoMessage'

      isViewOnce =
        message.videoMessage.viewOnce === true
    }

    else if (
      message.documentMessage
    ) {
      body =
        message.documentMessage.caption || ''

      msgType =
        'documentMessage'
    }

    else if (
      message.audioMessage
    ) {
      body = ''

      msgType =
        'audioMessage'

      isViewOnce =
        message.audioMessage.viewOnce === true
    }

    else if (
      message.reactionMessage
    ) {
      reaction =
        message.reactionMessage

      body =
        reaction.text || ''

      msgType =
        'reactionMessage'
    }

    else if (
      message.viewOnceMessageV2
    ) {
      const inner =
        message.viewOnceMessageV2.message || {}

      if (inner.imageMessage) {
        body =
          inner.imageMessage.caption || ''

        msgType =
          'imageMessage'

        isViewOnce = true
      }

      else if (
        inner.videoMessage
      ) {
        body =
          inner.videoMessage.caption || ''

        msgType =
          'videoMessage'

        isViewOnce = true
      }

      else if (
        inner.audioMessage
      ) {
        body = ''

        msgType =
          'audioMessage'

        isViewOnce = true
      }
    }

    return {
      body,
      msgType,
      isViewOnce,
      reaction
    }

  } catch {

    return {
      body: '',
      msgType: 'unknown',
      isViewOnce: false,
      reaction: null
    }
  }
}

// =====================================================
// SAVE MENU
// =====================================================

async function saveMenuListToDB(
  botSettings
) {
  try {

    if (
      !botSettings?.supabase ||
      !botSettings?.instance_id
    ) {
      return
    }

    if (
      botSettings.instance_id ===
      'DGIFT_DEFAULT'
    ) {
      console.log(
        '[MENU SAVE BLOCKED] Invalid instance'
      )

      return
    }

    const menuObj = {}

    for (const cmd of commands.values()) {
      const cat = (
        cmd.category ||
        'GENERAL'
      ).toUpperCase()

      if (!menuObj[cat]) {
        menuObj[cat] = []
      }

      menuObj[cat].push(cmd.name)
    }

    await botSettings.supabase
      .from('b_settings')
      .upsert({
        id: botSettings.instance_id,
        menu_list: menuObj,
        updated_at:
          new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    botSettings.menu_list =
      menuObj

    console.log(
      `[MENU] Saved for ${botSettings.instance_id}`
    )

  } catch (err) {
    console.log(
      '[MENU SAVE ERROR]',
      err.message
    )
  }
}

// =====================================================
// LOAD COMMANDS
// =====================================================

async function loadCommands(dir) {

  const items = readdirSync(dir)

  for (const item of items) {

    const fullPath =
      join(dir, item)

    const stat =
      statSync(fullPath)

    if (stat.isDirectory()) {
      await loadCommands(fullPath)
      continue
    }

    if (!item.endsWith('.js')) {
      continue
    }

    try {

      await delay(50)

      const imported = await import(
        pathToFileURL(fullPath).href +
        `?update=${Date.now()}`
      )

      if (
        !imported.name ||
        typeof imported.default !== 'function'
      ) {
        console.log(
          `[SKIP] ${item} invalid exports`
        )

        continue
      }

      const cmdName =
        imported.name.toLowerCase()

      const cmdData = {
        name: cmdName,
        alias: safeArray(imported.alias),
        category:
          imported.category ||
          'General',
        desc:
          imported.desc ||
          'No description',
        restricted:
          imported.restricted === true,
        run: imported.default
      }

      commands.set(
        cmdName,
        cmdData
      )

      for (const alias of cmdData.alias) {

        const a =
          alias.toLowerCase()

        if (!aliases.has(a)) {
          aliases.set(a, [])
        }

        const arr =
          aliases.get(a)

        if (!arr.includes(cmdName)) {
          arr.push(cmdName)
        }
      }

      console.log(
        `[OK] ${cmdName} [${cmdData.category}]`
      )

    } catch (err) {

      console.log(
        `[FAILED] ${item}: ${err.message}`
      )
    }
  }
}

// =====================================================
// LOAD OBSERVERS
// =====================================================

async function loadObservers(dir) {
  try {

    const files =
      readdirSync(dir)
        .filter(v =>
          v.endsWith('.js')
        )

    for (const file of files) {
      try {

        await delay(50)

        const imported =
          await import(
            pathToFileURL(
              join(dir, file)
            ).href +
            `?update=${Date.now()}`
          )

        if (
          typeof imported.default !== 'function'
        ) {
          continue
        }

        observers.push({
          name:
            file.replace('.js', ''),
          run:
            imported.default
        })

        console.log(
          `[OK] Observer: ${file}`
        )

      } catch (err) {

        console.log(
          `[OBSERVER ERROR] ${file}:`,
          err.message
        )
      }
    }

  } catch {

    console.log(
      '[INFO] No observers folder'
    )
  }
}

// =====================================================
// INITIALIZE
// =====================================================

export async function initializeRouter(
  botSettings = {}
) {
  try {

    if (isLoaded) {
      return
    }

    console.log(
      `[INIT] Loading router for ${INSTANCE_ID}`
    )

    // =========================================
    // NEW THEME ENGINE
    // =========================================

    await initializeTheme(
      botSettings
    )

    // =========================================
    // LOAD COMMANDS
    // =========================================

    await loadCommands(
      join(
        __dirname,
        '..',
        'commands'
      )
    )

    // =========================================
    // LOAD OBSERVERS
    // =========================================

    await loadObservers(
      join(
        __dirname,
        '..',
        'observers'
      )
    )

    // =========================================
    // SAVE MENU
    // =========================================

    await saveMenuListToDB(
      botSettings
    )

    isLoaded = true

    console.log(
      `[READY] Commands: ${commands.size}`
    )

    console.log(
      `[READY] Observers: ${observers.length}`
    )

    console.log(
      `[READY] Theme: ${getThemeName()}`
    )

  } catch (err) {

    console.log(
      '[INIT ERROR]',
      err.message
    )
  }
}

// =====================================================
// EXPORTS
// =====================================================

export function getAllCommands() {
  return [...commands.values()]
}

export function getAllObservers() {
  return observers.map(v => ({
    name: v.name
  }))
}

// =====================================================
// MAIN HANDLER
// =====================================================

export async function handleMessages(
  sock,
  m,
  botSettings = {}
) {
  try {

    // =========================================
    // LIVE THEME RELOAD
    // =========================================

    if (
      botSettings?.theme_name &&
      botSettings.theme_name !==
      getThemeName()
    ) {
      await reloadTheme(
        botSettings
      )
    }

    if (
      !m ||
      m.type !== 'notify'
    ) {
      return
    }

    const msg =
      m.messages?.[0]

    if (!msg?.message) {
      return
    }

    // =========================================
    // LOOP PROTECTION
    // =========================================

    if (
      msg.key?.id?.startsWith('BAE5') &&
      msg.key?.fromMe
    ) {
      return
    }

    if (
      msg.message?.protocolMessage
    ) {
      return
    }

    const from =
      normalizeJid(
        msg.key.remoteJid
      )

    if (!from) {
      return
    }

    const isGroup =
      from.endsWith('@g.us')

    const isStatus =
      from === 'status@broadcast'

    let sender = isGroup
      ? msg.key.participant
      : from

    sender =
      normalizeJid(sender)

    const pushName =
      msg.pushName || 'User'

    const {
      body,
      msgType,
      isViewOnce,
      reaction
    } = extractMessage(msg)

    // =========================================
    // GROUP
    // =========================================

    let participants = []
    let groupMetadata = null
    let isBotAdmin = false

    if (isGroup) {
      try {

        groupMetadata =
          await sock.groupMetadata(from)

        participants =
          groupMetadata.participants || []

        sender =
          resolveParticipant(
            participants,
            sender,
            sock
          )

        const botData =
          participants.find(
            p =>
              normalizeJid(p.id) ===
              normalizeJid(sock.user?.id)
          )

        isBotAdmin =
          !!botData?.admin

      } catch (err) {

        console.log(
          '[GROUP ERROR]',
          err.message
        )
      }
    }

    // =========================================
    // OWNER DETECTION
    // =========================================

    const ownerVariants =
      getOwnerVariants(
        sock,
        botSettings
      )

    const senderNumber =
      toNumber(sender)

    const isFromMe =
      msg.key.fromMe === true

    let isOwner = false

    try {

      isOwner =
        ownerVariants.includes(sender) ||
        ownerVariants.includes(senderNumber) ||
        ownerVariants.includes(
          toNumber(sender)
        ) ||
        isFromMe

    } catch {}

    const vipNumbers =
      safeArray(
        botSettings?.vip_numbers
      )

    const isVIP =
      vipNumbers.includes(
        senderNumber
      )

    const isAdmin =
      isOwner ||
      isVIP ||
      isFromMe

    // =========================================
    // PROTECTED USERS
    // =========================================

    const protectedNumbers =
      new Set([
        ...ownerVariants.map(v =>
          toNumber(v)
        ),

        ...vipNumbers,

        toNumber(sock.user?.id),

        toNumber(
          sock.authState?.creds?.me?.id
        ),

        toNumber(
          sock.authState?.creds?.me?.lid
        )

      ].filter(Boolean))

    const isProtected =
      protectedNumbers.has(
        senderNumber
      ) ||
      isOwner ||
      isVIP ||
      isFromMe

    // =========================================
    // ACTIVE THEME
    // =========================================

    const activeTheme =
      getTheme()

    const activeThemeName =
      getThemeName()

    // =========================================
    // OBSERVERS
    // =========================================

    for (const observer of observers) {
      try {

        await observer.run(
          sock,
          {
            msg,
            from,
            sender,
            body,
            msgType,
            isViewOnce,
            reaction,
            isGroup,
            isStatus,
            pushName,
            isAdmin,
            isOwner,
            isVIP,
            isFromMe,
            isBotAdmin,
            groupMetadata,
            participants,
            botSettings,
            isProtected,

            protectedNumbers:
              [...protectedNumbers],

            theme:
              activeTheme,

            formatBox,

            themeName:
              activeThemeName
          },

          botSettings
        )

      } catch (err) {

        console.log(
          `[OBSERVER ${observer.name}]`,
          err.message
        )
      }
    }

    // =========================================
    // COMMAND CHECK
    // =========================================

    if (!body) {
      return
    }

    const prefix =
      botSettings?.prefix || '.'

    if (
      !body.startsWith(prefix)
    ) {
      return
    }

    const args = body
      .slice(prefix.length)
      .trim()
      .split(/ +/)

    const providedName =
      args.shift()?.toLowerCase()

    if (!providedName) {
      return
    }

    // =========================================
    // MATCH COMMAND
    // =========================================

    let command = null

    if (
      commands.has(providedName)
    ) {
      command =
        commands.get(
          providedName
        )
    }

    else if (
      aliases.has(providedName)
    ) {
      const first =
        aliases.get(
          providedName
        )?.[0]

      if (first) {
        command =
          commands.get(first)
      }
    }

    if (!command) {
      return
    }

    // =========================================
    // ACCESS CONTROL
    // =========================================

    const restrictedCategories =
      botSettings?.restricted_categories ||
      [
        'Owner',
        'Settings',
        'Auto',
        'Anti'
      ]

    const ownerMode =
      botSettings?.owner_mode === true

    const publicMode =
      botSettings?.public_mode === true

    const privatePublicMode =
      botSettings?.private_public_mode === true

    const isRestricted =
      command.restricted === true ||
      restrictedCategories.includes(
        command.category
      )

    let allowed = true

    if (ownerMode) {
      allowed = isAdmin
    }

    else if (
      privatePublicMode
    ) {
      allowed =
        !isRestricted ||
        isAdmin
    }

    else if (
      publicMode
    ) {
      allowed = true
    }

    if (!allowed) {
      return
    }

    // =========================================
    // CONTEXT
    // =========================================

    const ctx = {
      msg,
      from,
      sender,
      args,
      body,
      pushName,
      msgType,
      isViewOnce,
      reaction,
      isGroup,
      isStatus,
      isAdmin,
      isOwner,
      isVIP,
      isFromMe,
      isBotAdmin,
      groupMetadata,
      participants,
      commandName:
        command.name,

      botSettings,

      isProtected,

      protectedNumbers:
        [...protectedNumbers],

      theme:
        activeTheme,

      formatBox,

      themeName:
        activeThemeName
    }

    console.log(
      `[CMD] ${command.name} | ${pushName} | Theme: ${activeThemeName}`
    )

    // =========================================
    // RUN COMMAND
    // =========================================

    try {

      await command.run(
        sock,
        ctx,
        botSettings
      )

    } catch (err) {

      console.log(
        `[COMMAND ERROR] ${command.name}:`,
        err.message
      )
    }

  } catch (err) {

    console.log(
      '[HANDLE ERROR]',
      err.message
    )
  }
}