// observers/menureply.js
export default async function menureply(sock, { msg, from, sender }, botSettings) {
  try {
    if (msg.key.fromMe) return
    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) return

    const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage
    const quotedText = quotedMsg.conversation || quotedMsg.imageMessage?.caption || ''
    
    // Angalia kama reply ni ya menu message yetu - inabidi iwe na "Choose a category"
    if (!quotedText.includes('Choose a category') && !quotedText.includes('Reply with number')) return

    const body = msg.message.extendedTextMessage.text.trim()
    const choice = parseInt(body)

    // Hifadhi categories za mwisho kwenye memory
    if (!botSettings.lastMenuCategories || !botSettings.lastMenuFrom || botSettings.lastMenuFrom !== from) {
      return sock.sendMessage(from, { text: '> Menu expired. Send menu again.' }, { quoted: msg })
    }

    const categories = botSettings.lastMenuCategories
    if (isNaN(choice) || choice < 1 || choice > categories.length) {
      return sock.sendMessage(from, { text: `> Invalid number. Reply 1-${categories.length}` }, { quoted: msg })
    }

    const selectedCat = categories[choice - 1]
    const commands = botSettings.lastMenuCommands[selectedCat] || []
    const prefix = botSettings.prefix || '!'
    const catEmoji = botSettings.lastMenuEmojis[selectedCat] || '📁'

    await sock.sendMessage(from, { react: { text: '📂', key: msg.key } })

    let cmdList = `╭──⌈ ${catEmoji} ${selectedCat} ⌋\n`
    commands.sort().forEach(cmd => {
      cmdList += `│ ${prefix}${cmd}\n`
    })
    cmdList += `╰────────────────\n\n*Total: ${commands.length} commands*`

    await sock.sendMessage(from, { text: cmdList }, { quoted: msg })

  } catch (err) {
    console.error('[MENUREPLY ERROR]', err.message)
  }
}