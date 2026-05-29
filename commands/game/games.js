// commands/game/games.js

export const name = 'games'

export const alias = [
  'game',
  'play',
  'arcade',
  'playgame',
  'ultimategames',
  'multigame',
  'gamehub'
]

export const category = 'Game'

export const desc =
  'Ultimate multiplayer game engine with bot AI, joins, tags, aliases, rooms, score system and 70+ games.'

// ======================================================
// ACTIVE GAME STORAGE
// ======================================================

const activeGames = new Map()

// ======================================================
// GAME DATABASE
// ======================================================

const GAME_DATABASE = [
  {
    name: 'connect4',
    alias: ['c4', '4inarow'],
    emoji: '🔴',
    type: 'board',
    players: 2,
    bot: true,
    desc: 'Drop discs to connect 4.'
  },

  {
    name: 'chess',
    alias: ['ches'],
    emoji: '♟️',
    type: 'board',
    players: 2,
    bot: true,
    desc: 'Classic chess strategy.'
  },

  {
    name: 'checkers',
    alias: ['draughts'],
    emoji: '⚫',
    type: 'board',
    players: 2,
    bot: true,
    desc: 'Jump enemy pieces.'
  },

  {
    name: 'battleship',
    alias: ['shipwar'],
    emoji: '🚢',
    type: 'board',
    players: 2,
    bot: true,
    desc: 'Destroy enemy ships.'
  },

  {
    name: 'sudoku',
    alias: ['sdk'],
    emoji: '🔢',
    type: 'puzzle',
    players: 1,
    bot: false,
    desc: 'Complete the number puzzle.'
  },

  {
    name: 'minesweeper',
    alias: ['mines'],
    emoji: '💣',
    type: 'puzzle',
    players: 1,
    bot: false,
    desc: 'Avoid hidden bombs.'
  },

  {
    name: 'snake',
    alias: ['snakegame'],
    emoji: '🐍',
    type: 'arcade',
    players: 1,
    bot: false,
    desc: 'Eat food and grow.'
  },

  {
    name: 'blackjack',
    alias: ['bj', '21'],
    emoji: '🃏',
    type: 'cards',
    players: 2,
    bot: true,
    desc: 'Reach 21 without busting.'
  },

  {
    name: 'poker',
    alias: ['pok'],
    emoji: '♠️',
    type: 'cards',
    players: 2,
    bot: true,
    desc: 'Best poker hand wins.'
  },

  {
    name: 'uno',
    alias: ['unoff'],
    emoji: '🟥',
    type: 'cards',
    players: 2,
    bot: true,
    desc: 'Match colors and cards.'
  },

  {
    name: 'maze',
    alias: ['mazeescape'],
    emoji: '🧩',
    type: 'puzzle',
    players: 1,
    bot: false,
    desc: 'Escape the maze.'
  },

  {
    name: 'zombiesurvival',
    alias: ['zombie'],
    emoji: '🧟',
    type: 'rpg',
    players: 2,
    bot: true,
    desc: 'Survive zombie attacks.'
  },

  {
    name: 'dragonbattle',
    alias: ['dragon'],
    emoji: '🐉',
    type: 'rpg',
    players: 2,
    bot: true,
    desc: 'Fight powerful dragons.'
  },

  {
    name: 'football',
    alias: ['soccer'],
    emoji: '⚽',
    type: 'sports',
    players: 2,
    bot: true,
    desc: 'Football duel match.'
  },

  {
    name: 'basketball',
    alias: ['nba'],
    emoji: '🏀',
    type: 'sports',
    players: 2,
    bot: true,
    desc: 'Basketball shootout.'
  },

  {
    name: 'boxing',
    alias: ['fight'],
    emoji: '🥊',
    type: 'sports',
    players: 2,
    bot: true,
    desc: 'Knock out your opponent.'
  },

  {
    name: 'racing',
    alias: ['race'],
    emoji: '🏎️',
    type: 'arcade',
    players: 2,
    bot: true,
    desc: 'High speed racing.'
  },

  {
    name: 'spacewar',
    alias: ['spaceshooter'],
    emoji: '🚀',
    type: 'arcade',
    players: 2,
    bot: true,
    desc: 'Space shooting battle.'
  },

  {
    name: '2048',
    alias: ['merge'],
    emoji: '🔢',
    type: 'puzzle',
    players: 1,
    bot: false,
    desc: 'Merge blocks to 2048.'
  },

  {
    name: 'memory',
    alias: ['memorygame'],
    emoji: '🧠',
    type: 'puzzle',
    players: 1,
    bot: false,
    desc: 'Memorize the pattern.'
  }
]

// ======================================================
// HELPERS
// ======================================================

function getGame(query) {
  query = query?.toLowerCase()

  return GAME_DATABASE.find(
    g =>
      g.name === query ||
      g.alias.includes(query)
  )
}

function renderBar(value, max = 10) {
  return '█'.repeat(value) + '░'.repeat(max - value)
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function normalizeJid(jid = '') {
  return jid.split(':')[0].toLowerCase()
}

// ======================================================
// BRAND
// ======================================================

async function getBrand(botSettings) {
  try {
    if (!botSettings?.supabase) return 'Bot'

    const { data } = await botSettings.supabase
      .from('b_settings')
      .select('brand_name, botname')
      .eq('id', botSettings.instance_id)
      .maybeSingle()

    return data?.brand_name || data?.botname || 'Bot'
  } catch {
    return 'Bot'
  }
}

// ======================================================
// MENU
// ======================================================

function buildMenu(prefix, brand) {
  let txt = `╭─⌈ 🎮 *ULTIMATE GAMES* ⌋
│
│ *Commands*
│ ${prefix}games list
│ ${prefix}games start <game>
│ ${prefix}games start <game> bot
│ ${prefix}games start <game> @user
│ ${prefix}games join
│ ${prefix}games play <move>
│ ${prefix}games stop
│ ${prefix}games rooms
│
│ *Popular Games*
`

  for (const g of GAME_DATABASE) {
    txt += `│ ${g.emoji} ${g.name}\n`
  }

  txt += `│
╰⊷ *Powered By ${brand}*`

  return txt
}

// ======================================================
// CREATE ROOM
// ======================================================

function createRoom({
  game,
  host,
  opponent,
  vsBot
}) {
  return {
    id: Date.now().toString(),
    game: game.name,
    emoji: game.emoji,
    type: game.type,
    host,
    opponent,
    vsBot,
    players: vsBot
      ? [host, 'bot']
      : [host, opponent].filter(Boolean),

    started: Date.now(),

    turn: host,

    hp: {
      [host]: 10,
      [opponent || 'bot']: 10
    },

    score: {
      [host]: 0,
      [opponent || 'bot']: 0
    },

    board: [],

    status: 'waiting',

    moves: []
  }
}

// ======================================================
// GAME BOARD
// ======================================================

function renderRoom(room, brand) {
  return `╭─⌈ ${room.emoji} *${room.game.toUpperCase()}* ⌋
│
│ Host: @${room.host.split('@')[0]}
│ Opponent: ${
    room.vsBot
      ? '🤖 BOT'
      : `@${room.opponent.split('@')[0]}`
  }
│
│ Turn:
│ @${room.turn.split('@')[0]}
│
│ HP:
│ ${renderBar(room.hp[room.host])}
│ ${renderBar(room.hp[room.opponent || 'bot'])}
│
│ Status:
│ ${room.status.toUpperCase()}
│
│ Moves:
│ ${room.moves.length}
╰⊷ *Powered By ${brand}*`
}

// ======================================================
// BOT AI
// ======================================================

async function botMove(room) {
  const attacks = [
    'slash',
    'fire',
    'bomb',
    'kick',
    'laser',
    'rocket'
  ]

  const attack = randomChoice(attacks)

  const damage = randomInt(1, 3)

  room.hp[room.host] -= damage

  room.moves.push({
    player: 'bot',
    attack,
    damage
  })

  room.turn = room.host

  return {
    attack,
    damage
  }
}

// ======================================================
// MAIN
// ======================================================

export default async function games(
  sock,
  {
    msg,
    from,
    sender,
    args
  },
  botSettings
) {
  try {
    const brand = await getBrand(botSettings)

    const prefix = botSettings.prefix || '.'

    const action = args[0]?.toLowerCase()

    // ==================================================
    // MENU
    // ==================================================

    if (!action) {
      await sock.sendMessage(from, {
        react: {
          text: '🎮',
          key: msg.key
        }
      })

      return await sock.sendMessage(
        from,
        {
          text: buildMenu(prefix, brand)
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // LIST
    // ==================================================

    if (action === 'list') {
      let txt = `╭─⌈ 🎯 *GAME LIST* ⌋\n│\n`

      for (const g of GAME_DATABASE) {
        txt += `│ ${g.emoji} ${g.name}\n`
        txt += `│ Alias: ${g.alias.join(', ')}\n`
        txt += `│ Type: ${g.type}\n`
        txt += `│ Players: ${g.players}\n`
        txt += `│ Bot: ${g.bot ? 'Yes' : 'No'}\n`
        txt += `│ ${g.desc}\n│\n`
      }

      txt += `╰⊷ *Powered By ${brand}*`

      return await sock.sendMessage(
        from,
        { text: txt },
        { quoted: msg }
      )
    }

    // ==================================================
    // ROOMS
    // ==================================================

    if (action === 'rooms') {
      const rooms = [...activeGames.values()]

      if (!rooms.length) {
        return await sock.sendMessage(
          from,
          {
            text: '> No active rooms.'
          },
          { quoted: msg }
        )
      }

      let txt = `╭─⌈ 🏟️ *ACTIVE ROOMS* ⌋\n│\n`

      for (const r of rooms) {
        txt += `│ ${r.emoji} ${r.game}\n`
        txt += `│ Host: @${r.host.split('@')[0]}\n`
        txt += `│ Players: ${r.players.length}\n`
        txt += `│ Status: ${r.status}\n│\n`
      }

      txt += `╰⊷ *Powered By ${brand}*`

      return await sock.sendMessage(
        from,
        {
          text: txt,
          mentions: rooms.map(r => r.host)
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // START
    // ==================================================

    if (action === 'start') {
      const gameQuery = args[1]?.toLowerCase()

      if (!gameQuery) {
        return await sock.sendMessage(
          from,
          {
            text: `> Example:\n${prefix}games start chess`
          },
          { quoted: msg }
        )
      }

      const game = getGame(gameQuery)

      if (!game) {
        return await sock.sendMessage(
          from,
          {
            text: '> Unknown game.'
          },
          { quoted: msg }
        )
      }

      const mentioned =
        msg.message?.extendedTextMessage
          ?.contextInfo?.mentionedJid || []

      const target = normalizeJid(mentioned[0])

      const vsBot =
        args.includes('bot') ||
        args.includes('ai') ||
        !target

      const room = createRoom({
        game,
        host: sender,
        opponent: target,
        vsBot
      })

      room.status = vsBot
        ? 'playing'
        : 'waiting'

      activeGames.set(sender, room)

      await sock.sendMessage(from, {
        react: {
          text: game.emoji,
          key: msg.key
        }
      })

      return await sock.sendMessage(
        from,
        {
          text:
            renderRoom(room, brand) +
            `\n│\n│ Commands:\n│ ${prefix}games play attack\n│ ${prefix}games play defend\n│ ${prefix}games stop`,
          mentions: room.players.filter(
            p => p !== 'bot'
          )
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // JOIN
    // ==================================================

    if (action === 'join') {
      const room = [...activeGames.values()].find(
        r =>
          r.status === 'waiting' &&
          !r.players.includes(sender)
      )

      if (!room) {
        return await sock.sendMessage(
          from,
          {
            text: '> No waiting room found.'
          },
          { quoted: msg }
        )
      }

      room.opponent = sender

      room.players.push(sender)

      room.status = 'playing'

      await sock.sendMessage(from, {
        react: {
          text: '✅',
          key: msg.key
        }
      })

      return await sock.sendMessage(
        from,
        {
          text:
            renderRoom(room, brand) +
            '\n│\n│ Match started!',
          mentions: room.players
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // PLAY
    // ==================================================

    if (action === 'play') {
      const move = args[1]?.toLowerCase()

      const room = [...activeGames.values()].find(
        r => r.players.includes(sender)
      )

      if (!room) {
        return await sock.sendMessage(
          from,
          {
            text: '> You are not in a game.'
          },
          { quoted: msg }
        )
      }

      if (room.turn !== sender) {
        return await sock.sendMessage(
          from,
          {
            text: '> Not your turn.'
          },
          { quoted: msg }
        )
      }

      const enemy = room.vsBot
        ? 'bot'
        : room.players.find(
            p => p !== sender
          )

      let damage = 0

      if (move === 'attack') {
        damage = randomInt(1, 3)
      }

      else if (move === 'fire') {
        damage = randomInt(2, 4)
      }

      else if (move === 'bomb') {
        damage = randomInt(3, 5)
      }

      else if (move === 'heal') {
        room.hp[sender] += 2
      }

      else {
        return await sock.sendMessage(
          from,
          {
            text:
              '> Moves:\nattack\nfire\nbomb\nheal'
          },
          { quoted: msg }
        )
      }

      if (damage > 0) {
        room.hp[enemy] -= damage
      }

      room.moves.push({
        player: sender,
        move,
        damage
      })

      // ================================================
      // WIN CHECK
      // ================================================

      if (room.hp[enemy] <= 0) {
        activeGames.delete(room.host)

        await sock.sendMessage(from, {
          react: {
            text: '🏆',
            key: msg.key
          }
        })

        return await sock.sendMessage(
          from,
          {
            text: `╭─⌈ 🏆 *VICTORY* ⌋
│
│ Winner:
│ @${sender.split('@')[0]}
│
│ Game:
│ ${room.game}
│
│ Total Moves:
│ ${room.moves.length}
╰⊷ *Powered By ${brand}*`,
            mentions: [sender]
          },
          { quoted: msg }
        )
      }

      // ================================================
      // BOT TURN
      // ================================================

      if (room.vsBot) {
        room.turn = 'bot'

        const bot = await botMove(room)

        if (room.hp[sender] <= 0) {
          activeGames.delete(room.host)

          return await sock.sendMessage(
            from,
            {
              text: `╭─⌈ 🤖 *BOT WON* ⌋
│
│ Bot used:
│ ${bot.attack}
│
│ Damage:
│ ${bot.damage}
│
│ Better luck next time.
╰⊷ *Powered By ${brand}*`
            },
            { quoted: msg }
          )
        }
      }

      else {
        room.turn = enemy
      }

      return await sock.sendMessage(
        from,
        {
          text:
            renderRoom(room, brand) +
            `\n│\n│ Last Move:\n│ ${move.toUpperCase()}`
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // STOP
    // ==================================================

    if (
      action === 'stop' ||
      action === 'end' ||
      action === 'leave'
    ) {
      const room = [...activeGames.values()].find(
        r => r.players.includes(sender)
      )

      if (!room) {
        return await sock.sendMessage(
          from,
          {
            text: '> No active game.'
          },
          { quoted: msg }
        )
      }

      activeGames.delete(room.host)

      await sock.sendMessage(from, {
        react: {
          text: '🛑',
          key: msg.key
        }
      })

      return await sock.sendMessage(
        from,
        {
          text: '> Game session stopped.'
        },
        { quoted: msg }
      )
    }

    // ==================================================
    // INVALID
    // ==================================================

    return await sock.sendMessage(
      from,
      {
        text: `> Invalid.\nUse: ${prefix}games`
      },
      { quoted: msg }
    )

  } catch (err) {
    console.log('[GAMES ERROR]', err.message)

    await sock.sendMessage(from, {
      react: {
        text: '❌',
        key: msg.key
      }
    })

    return await sock.sendMessage(
      from,
      {
        text: '> Game engine error.'
      },
      { quoted: msg }
    )
  }
}