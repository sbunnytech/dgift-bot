// commands/fun/react.js

export const name = 'react'

export const alias = [
  'reaction',
  'emoji',
  'emojireact',
  'funreact',
  'reacts',
  'emojiwave',
  'emojiattack',
  'emojifun',
  'animate',
  'animation'
]

export const category = 'Fun'

export const desc =
  'Ultimate emoji reaction engine with 150 animated reactions using message edits.'

// ======================================================
// REACTION DATABASE
// ======================================================

const REACTIONS = {
  love: {
    alias: ['heart', 'romance'],
    emojis: [
      '❤️','💖','💘','💕','💞',
      '💓','💗','😍','🥰','😘',
      '💋','💝','💟','❣️','❤️'
    ]
  },

  angry: {
    alias: ['mad', 'rage'],
    emojis: [
      '😡','🤬','👿','💢','🔥',
      '😤','⚡','💥','☠️','👹',
      '😠','🩸','⚔️','💀','🤬'
    ]
  },

  happy: {
    alias: ['joy', 'smile'],
    emojis: [
      '😄','😁','😆','🤣','😂',
      '😊','🥳','🎉','✨','🌈',
      '😎','💃','🕺','🎊','😄'
    ]
  },

  cry: {
    alias: ['sad', 'tears'],
    emojis: [
      '😢','😭','💔','🥀','🌧️',
      '😞','😔','😿','🫠','💧',
      '😩','😫','🖤','☔','😭'
    ]
  },

  drink: {
    alias: ['sip', 'thirsty'],
    emojis: [
      '🥤','😋','🧃','🥛','☕',
      '😛','🧋','🍹','😋','🥤',
      '😛','🧃','☕','🍹','😋'
    ]
  },

  fire: {
    alias: ['burn', 'flame'],
    emojis: [
      '🔥','💥','⚡','☄️','🌋',
      '🔥','💣','🚀','🧨','💢',
      '😈','👹','🔥','💥','⚡'
    ]
  },

  dance: {
    alias: ['party', 'boogie'],
    emojis: [
      '💃','🕺','🎶','🎵','🥳',
      '🎉','✨','🪩','🎊','😎',
      '🔥','💥','💃','🕺','🎶'
    ]
  },

  sleep: {
    alias: ['nap', 'tired'],
    emojis: [
      '😴','💤','🛌','🌙','⭐',
      '😪','🥱','🛏️','☁️','🌌',
      '😴','💤','🛌','🌙','⭐'
    ]
  },

  laugh: {
    alias: ['lol', 'lmao'],
    emojis: [
      '😂','🤣','😹','💀','😭',
      '😆','😁','🤣','😂','😹',
      '💀','😭','🤣','😂','😆'
    ]
  },

  eat: {
    alias: ['food', 'hungry'],
    emojis: [
      '🍔','🍕','🍟','🌭','🍗',
      '🍖','🥩','🍜','🍣','🍩',
      '🍪','🍰','🍫','😋','🍕'
    ]
  }
}

// ======================================================
// RANDOM EXTRA REACTIONS
// ======================================================

const EXTRA_EMOJIS = [
  '🌀','⚡','🌟','💫','✨',
  '🎯','🎮','👑','🧠','💎',
  '🐉','🦾','👾','🤖','🎭',
  '🪐','🌈','☄️','🌪️','🌊',
  '🌋','🔥','💥','🚀','🛸',
  '🦄','🐺','🦊','🐯','🦁',
  '🐲','👻','☠️','👹','😈',
  '😎','🥶','🥵','🤯','🫨',
  '💀','❤️','💔','💖','💕',
  '🎉','🎊','🎵','🎶','🪩'
]

// ======================================================
// HELPERS
// ======================================================

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function findReaction(query) {
  query = query?.toLowerCase()

  const entries = Object.entries(REACTIONS)

  for (const [name, data] of entries) {
    if (name === query) {
      return {
        name,
        ...data
      }
    }

    if (data.alias.includes(query)) {
      return {
        name,
        ...data
      }
    }
  }

  return null
}

function buildMenu(prefix) {
  let txt = `╭─⌈ 🎭 *REACTION ENGINE* ⌋
│
│ *Commands*
│ ${prefix}react <type>
│ ${prefix}react random
│ ${prefix}react list
│ ${prefix}react speed <slow/fast>
│
│ *Reaction Types*
`

  for (const name of Object.keys(REACTIONS)) {
    txt += `│ ✦ ${name}\n`
  }

  txt += `│
│ *Examples*
│ ${prefix}react love
│ ${prefix}react angry
│ ${prefix}react dance
│ ${prefix}react random
╰────────────────`

  return txt
}

// ======================================================
// MAIN
// ======================================================

export default async function react(
  sock,
  { msg, from, args },
  botSettings
) {
  try {
    const prefix = botSettings.prefix || '.'

    const type = args[0]?.toLowerCase()

    // ==================================================
    // MENU
    // ==================================================

    if (!type) {
      await sock.sendMessage(from, {
        react: {
          text: '🎭',
          key: msg.key
        }
      })

      return await sock.sendMessage(
        from,
        {
          text: buildMenu(prefix)
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // LIST
    // ==================================================

    if (type === 'list') {
      let txt = `╭─⌈ 🎭 *REACTION LIST* ⌋
│
`

      for (const [name, data] of Object.entries(REACTIONS)) {
        txt += `│ ✦ ${name}\n`
        txt += `│ Alias: ${data.alias.join(', ')}\n`
        txt += `│ Emojis: ${data.emojis.length}\n│\n`
      }

      txt += `╰────────────────`

      return await sock.sendMessage(
        from,
        { text: txt },
        { quoted: msg }
      )
    }

    // ==================================================
    // RANDOM
    // ==================================================

    let reactionData

    if (type === 'random') {
      const keys = Object.keys(REACTIONS)
      const randomType = randomChoice(keys)

      reactionData = {
        name: randomType,
        ...REACTIONS[randomType]
      }
    }

    else {
      reactionData = findReaction(type)
    }

    if (!reactionData) {
      return await sock.sendMessage(
        from,
        {
          text:
            '> Unknown reaction type.\nUse `.react list`'
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // START REACTION
    // ==================================================

    await sock.sendMessage(from, {
      react: {
        text: '✨',
        key: msg.key
      }
    })

    // ==================================================
    // BUILD FINAL EMOJI SEQUENCE
    // ==================================================

    const finalSequence = []

    // Main emojis
    for (const emoji of reactionData.emojis) {
      finalSequence.push(emoji)
    }

    // Add random bonus emojis
    for (let i = 0; i < 135; i++) {
      finalSequence.push(
        randomChoice(EXTRA_EMOJIS)
      )
    }

    // Total 150
    const sequence = finalSequence.slice(0, 150)

    // ==================================================
    // EDIT LOOP
    // ==================================================

    for (let i = 0; i < sequence.length; i++) {
      try {
        await sleep(1200)

        await sock.sendMessage(from, {
          text: sequence[i],
          edit: msg.key
        })

      } catch (err) {
        console.log(
          `[REACT EDIT ERROR]`,
          err.message
        )
      }
    }

  } catch (error) {
    console.error(
      '[REACT ENGINE ERROR]',
      error.message
    )

    try {
      await sock.sendMessage(from, {
        react: {
          text: '❌',
          key: msg.key
        }
      })
    } catch {}
  }
}