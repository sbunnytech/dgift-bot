// commands/game/connect4.js
export const name = 'connect4'
export const alias = ['c4', '4inarow']
export const category = 'Game'
export const desc = 'Connect Four game: drop discs to get 4 in a row.'

const activeGames = new Map()

const ROWS = 6
const COLS = 7

async function getBrandName(botSettings) {
  if (!botSettings.supabase) return 'Bot'

  const { data } = await botSettings.supabase
.from('b_settings')
.select('brand_name, botname')
.eq('id', 'DGIFT_DEFAULT')
.maybeSingle()

  return data?.brand_name || data?.botname || 'Bot'
}

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function renderBoard(board, brandName, showCols = false) {
  const symbols = board.map(row =>
    row.map(cell => {
      if (cell === 'R') return '🔴'
      if (cell === 'Y') return '🟡'
      return '⚪'
    }).join(' ')
  ).join('\n│ ')

  const colNumbers = showCols? `\n│ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣` : ''

  return `╭─⌈ 🎯 *Connect Four* ⌋
│ ${symbols}
╰⊷ *Powered By ${brandName}*${colNumbers}`
}

function dropDisc(board, col, symbol) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      board[r][col] = symbol
      return r
    }
  }
  return null
}

function checkWinner(board, lastRow, lastCol, symbol) {
  // check 4 directions: horizontal, vertical, diag \, diag /
  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diag \
    [1, -1] // diag /
  ]

  for (const [dr, dc] of directions) {
    let count = 1
    for (let i = 1; i < 4; i++) {
      const r = lastRow + dr * i
      const c = lastCol + dc * i
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c]!== symbol) break
      count++
    }
    for (let i = 1; i < 4; i++) {
      const r = lastRow - dr * i
      const c = lastCol - dc * i
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c]!== symbol) break
      count++
    }
    if (count >= 4) return true
  }

  // check draw
  const isFull = board[0].every(cell => cell!== null)
  if (isFull) return 'draw'
  return false
}

function botMove(board) {
  // 1. Try to win
  for (let c = 0; c < COLS; c++) {
    if (board[0][c]!== null) continue
    const r = dropDisc(board, c, 'Y')
    if (r!== null && checkWinner(board, r, c, 'Y') === true) {
      board[r][c] = null
      return c
    }
    board[r][c] = null
  }

  // 2. Block player win
  for (let c = 0; c < COLS; c++) {
    if (board[0][c]!== null) continue
    const r = dropDisc(board, c, 'R')
    if (r!== null && checkWinner(board, r, c, 'R') === true) {
      board[r][c] = null
      return c
    }
    board[r][c] = null
  }

  // 3. Take center column if free
  if (board[ROWS - 1][3] === null) return 3

  // 4. Take random available column
  const available = []
  for (let c = 0; c < COLS; c++) {
    if (board[0][c] === null) available.push(c)
  }
  return available[Math.floor(Math.random() * available.length)]
}

export default async function connect4(sock, { msg, from, sender }, botSettings) {
  try {
    const brandName = await getBrandName(botSettings)

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()

    // HELP
    if (!action) {
      await sock.sendMessage(from, { react: { text: '🎯', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🔴 *Connect Four* ⌋
│ Drop discs to get 4 in a row
│ Horizontally, vertically, or diagonally
│
│ *Commands:*
│ ${botSettings.prefix}c4 start - Play vs Bot
│ ${botSettings.prefix}c4 start @user - Play vs Friend
│ ${botSettings.prefix}c4 move <1-7> - Drop disc
│ ${botSettings.prefix}c4 board - Show board
│ ${botSettings.prefix}c4 stop - End game
│
│ *Columns:* 1 2 3 4 5 6 7
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // SHOW BOARD
    if (action === 'board') {
      const game = activeGames.get(from)
      if (!game) return await sock.sendMessage(from, { text: '> No active game. Start with `.c4 start`' }, { quoted: msg })

      return await sock.sendMessage(from, {
        text: renderBoard(game.board, brandName, true) + `\n│ Turn: ${game.turn === 'R'? '🔴' : '🟡'} @${game.currentPlayer.split('@')[0]}`,
        mentions: [game.currentPlayer]
      }, { quoted: msg })
    }

    // STOP GAME
    if (action === 'stop' || action === 'end') {
      const game = activeGames.get(from)
      if (!game) return await sock.sendMessage(from, { text: '> No active game.' }, { quoted: msg })

      activeGames.delete(from)
      await sock.sendMessage(from, { react: { text: '🛑', key: msg.key } })
      return await sock.sendMessage(from, { text: '> Game stopped.' }, { quoted: msg })
    }

    // START GAME
    if (action === 'start') {
      if (activeGames.has(from)) return await sock.sendMessage(from, { text: '> Game already running! Use `.c4 move <1-7>`' }, { quoted: msg })

      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
      const opponent = mentioned[0] || 'bot'
      const isBot = opponent === 'bot'

      const gameData = {
        board: emptyBoard(),
        turn: 'R',
        playerR: sender,
        playerY: opponent,
        currentPlayer: sender,
        vsBot: isBot,
        msgKey: null,
        lastMove: null
      }

      activeGames.set(from, gameData)
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      const sent = await sock.sendMessage(from, {
        text: renderBoard(gameData.board, brandName, true) +
              `\n│ You: 🔴 | ${isBot? 'Bot: 🟡' : `Opponent: 🟡 @${opponent.split('@')[0]}`}\n│ Turn: 🔴 @${sender.split('@')[0]}\n│ Use: ${botSettings.prefix}c4 move <1-7>`,
        mentions: isBot? [sender] : [sender, opponent]
      }, { quoted: msg })

      gameData.msgKey = sent.key
      return
    }

    // MAKE MOVE
    if (action === 'move' || action === 'm') {
      const col = parseInt(args[1]) - 1
      if (isNaN(col) || col < 0 || col >= COLS) {
        return await sock.sendMessage(from, { text: '> Invalid column. Use 1-7' }, { quoted: msg })
      }

      const game = activeGames.get(from)
      if (!game) return await sock.sendMessage(from, { text: '> No game running. Start with `.c4 start`' }, { quoted: msg })

      if (game.currentPlayer!== sender) {
        return await sock.sendMessage(from, { text: `> Not your turn! Wait for @${game.currentPlayer.split('@')[0]}`, mentions: [game.currentPlayer] }, { quoted: msg })
      }

      if (game.board[0][col]!== null) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return await sock.sendMessage(from, { text: '> Column is full! Pick another.' }, { quoted: msg })
      }

      // Player move
      const symbol = game.turn
      const row = dropDisc(game.board, col, symbol)
      game.lastMove = { row, col, symbol }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      // Update message
      if (game.msgKey) {
        try {
          await sock.sendMessage(from, {
            edit: game.msgKey,
            text: renderBoard(game.board, brandName) + `\n│ Move: ${symbol === 'R'? '🔴' : '🟡'} → Column ${col + 1}`
          })
        } catch (e) {}
      }

      // Check winner
      const result = checkWinner(game.board, row, col, symbol)
      if (result) {
        activeGames.delete(from)
        const winText = result === 'draw'
         ? `╭─⌈ 🤝 *DRAW* ⌋\n${renderBoard(game.board, brandName)}\n│ Board is full!\n╰⊷ *Powered By ${brandName}*`
          : `╭─⌈ 🎉 *WINNER* ⌋\n${renderBoard(game.board, brandName)}\n│ Winner: ${symbol === 'R'? '🔴' : '🟡'} @${sender.split('@')[0]}\n╰⊷ *Powered By ${brandName}*`

        await sock.sendMessage(from, { react: { text: result === 'draw'? '🤝' : '🎉', key: msg.key } })
        return await sock.sendMessage(from, { text: winText, mentions: [sender] }, { quoted: msg })
      }

      // Switch turn
      game.turn = game.turn === 'R'? 'Y' : 'R'
      game.currentPlayer = game.turn === 'R'? game.playerR : game.playerY

      // Bot move
      if (game.vsBot && game.turn === 'Y') {
        await new Promise(r => setTimeout(r, 800))

        const botCol = botMove(game.board)
        const botRow = dropDisc(game.board, botCol, 'Y')
        game.lastMove = { row: botRow, col: botCol, symbol: 'Y' }

        const botResult = checkWinner(game.board, botRow, botCol, 'Y')

        if (game.msgKey) {
          try {
            await sock.sendMessage(from, {
              edit: game.msgKey,
              text: renderBoard(game.board, brandName) + `\n│ Bot: 🟡 → Column ${botCol + 1}`
            })
          } catch (e) {}
        }

        if (botResult) {
          activeGames.delete(from)
          const winText = botResult === 'draw'
           ? `╭─⌈ 🤝 *DRAW* ⌋\n${renderBoard(game.board, brandName)}\n│ Good game!\n╰⊷ *Powered By ${brandName}*`
            : `╭─⌈ 🤖 *BOT WINS* ⌋\n${renderBoard(game.board, brandName)}\n│ Better luck next time!\n╰⊷ *Powered By ${brandName}*`

          return await sock.sendMessage(from, { text: winText }, { quoted: msg })
        }

        game.turn = 'R'
        game.currentPlayer = game.playerR
      }

      return
    }

    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    return await sock.sendMessage(from, { text: '> Invalid. Use: start, move, board, stop' }, { quoted: msg })

  } catch (err) {
    console.error('[CONNECT4 ERROR]', err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Game error.' }, { quoted: msg })
  }
}