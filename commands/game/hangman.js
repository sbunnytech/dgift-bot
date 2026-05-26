// commands/game/hangman.js
export const name = 'hangman'
export const alias = ['hm', 'guessword']
export const category = 'Game'
export const desc = 'Hangman: guess the word before the man hangs.'

const activeGames = new Map()

const wordList = [
  'python', 'javascript', 'whatsapp', 'github', 'supabase',
  'discord', 'telegram', 'matrix', 'react', 'nodejs',
  'banana', 'giraffe', 'computer', 'keyboard', 'diamond'
]

const hangmanStages = [
  `╭─⌈ 😵 *Hangman* ⌋
│
│
│
│
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 😵 *Hangman* ⌋
│ ┌───┐
│ │ │
│ │
│ │
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 😵 *Hangman* ⌋
│ ┌───┐
│ │ │
│ O │
│ │
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 😵 *Hangman* ⌋
│ ┌───┐
│ │ │
│ O │
│ | │
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 😵 *Hangman* ⌋
│ ┌───┐
│ │ │
│ O │
│ /| │
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 😵 *Hangman* ⌋
│ ┌───┐
│ │ │
│ O │
│ /|\\ │
│
╰⊷ *Powered By {brand}*`,

  `╭─⌈ 💀 *Hangman* ⌋
│ ┌───┐
│ │ │
│ O │
│ /|\\ │
│ / \\ │
╰⊷ *Powered By {brand}*`
]

async function getBrandName(botSettings) {
  if (!botSettings.supabase) return 'Bot'

  const { data } = await botSettings.supabase
.from('b_settings')
.select('brand_name, botname')
.eq('id', 'DGIFT_DEFAULT')
.maybeSingle()

  return data?.brand_name || data?.botname || 'Bot'
}

function renderWord(word, guessed) {
  return word.split('').map(letter =>
    guessed.includes(letter)? letter.toUpperCase() : '_'
  ).join(' ')
}

export default async function hangman(sock, { msg, from, sender }, botSettings) {
  try {
    const brandName = await getBrandName(botSettings)
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()

    // HELP
    if (!action) {
      await sock.sendMessage(from, { react: { text: '😵', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 😵 *Hangman* ⌋
│ Guess the word one letter at a time
│ 6 wrong guesses = Game Over
│
│ *Commands:*
│ ${botSettings.prefix}hm start - Start new game
│ ${botSettings.prefix}hm a - Guess letter A
│ ${botSettings.prefix}hm word apple - Guess full word
│ ${botSettings.prefix}hm stop - End game
╰⊷ *Powered By ${brandName}*`
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
      if (activeGames.has(from)) return await sock.sendMessage(from, { text: '> Game already running! Use `.hm a` to guess.' }, { quoted: msg })

      const word = wordList[Math.floor(Math.random() * wordList.length)]

      const gameData = {
        word: word,
        guessed: [],
        wrongGuesses: 0,
        maxWrong: 6,
        msgKey: null
      }

      activeGames.set(from, gameData)
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })

      const display = renderWord(word, [])
      const stage = hangmanStages[0].replace('{brand}', brandName)

      const sent = await sock.sendMessage(from, {
        text: `${stage}
│ Word: ${display}
│ Wrong: 0/6
│ Guessed: -
│ Send a letter: ${botSettings.prefix}hm a`
      }, { quoted: msg })

      gameData.msgKey = sent.key
      return
    }

    // GUESS LETTER OR WORD
    const game = activeGames.get(from)
    if (!game) return await sock.sendMessage(from, { text: '> No game running. Start with `.hm start`' }, { quoted: msg })

    // Guess full word
    if (action === 'word') {
      const guess = args.slice(1).join(' ').toLowerCase()
      if (!guess) return await sock.sendMessage(from, { text: '> Type a word to guess.' }, { quoted: msg })

      if (guess === game.word) {
        activeGames.delete(from)
        const winText = `╭─⌈ 🎉 *YOU WON* ⌋
│ Word: ${game.word.toUpperCase()}
│ You guessed it right!
╰⊷ *Powered By ${brandName}*`

        await sock.sendMessage(from, { react: { text: '🎉', key: msg.key } })
        return await sock.sendMessage(from, { text: winText }, { quoted: msg })
      } else {
        game.wrongGuesses++
      }
    }
    // Guess letter
    else if (action.length === 1 && /^[a-z]$/.test(action)) {
      const letter = action.toLowerCase()

      if (game.guessed.includes(letter)) {
        return await sock.sendMessage(from, { text: `> You already guessed "${letter.toUpperCase()}"` }, { quoted: msg })
      }

      game.guessed.push(letter)

      if (!game.word.includes(letter)) {
        game.wrongGuesses++
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      } else {
        await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      }
    } else {
      return await sock.sendMessage(from, { text: '> Invalid. Send a single letter like `.hm a` or `.hm word apple`' }, { quoted: msg })
    }

    // Check win/lose
    const display = renderWord(game.word, game.guessed)
    const isWon =!display.includes('_')
    const isLost = game.wrongGuesses >= game.maxWrong

    if (isWon) {
      activeGames.delete(from)
      const winText = `╭─⌈ 🎉 *YOU WON* ⌋
│ Word: ${game.word.toUpperCase()}
│ Guesses: ${game.guessed.join(', ').toUpperCase()}
╰⊷ *Powered By ${brandName}*`

      if (game.msgKey) {
        await sock.sendMessage(from, { edit: game.msgKey, text: winText })
      }
      return
    }

    if (isLost) {
      activeGames.delete(from)
      const loseText = `╭─⌈ 💀 *GAME OVER* ⌋
│ Word was: ${game.word.toUpperCase()}
│ Wrong guesses: ${game.wrongGuesses}/6
╰⊷ *Powered By ${brandName}*`

      const stage = hangmanStages[6].replace('{brand}', brandName)
      if (game.msgKey) {
        await sock.sendMessage(from, { edit: game.msgKey, text: `${stage}\n│ ${loseText}` })
      }
      return
    }

    // Continue game
    const stage = hangmanStages[game.wrongGuesses].replace('{brand}', brandName)
    const gameText = `${stage}
│ Word: ${display}
│ Wrong: ${game.wrongGuesses}/6
│ Guessed: ${game.guessed.join(', ').toUpperCase() || '-'}
│ Send next guess: ${botSettings.prefix}hm a`

    if (game.msgKey) {
      await sock.sendMessage(from, { edit: game.msgKey, text: gameText })
    }

  } catch (err) {
    console.error('[HANGMAN ERROR]', err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Game error.' }, { quoted: msg })
  }
}