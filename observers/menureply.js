// observers/menureply.js
export default async function menureply(sock, { msg, from, sender }, botSettings) {
  try {
    // 1. fromMe check IMEONDOLEWA - bot sasa inasoma messages zake pia

    // 2. Safe access kwa message body
    const body = msg?.message?.extendedTextMessage?.text?.trim() ||
                 msg?.message?.conversation?.trim() || ''

    // 3. Angalia kama ni namba tu
    const choice = parseInt(body)
    if (isNaN(choice)) return

    // 4. Angalia kama kuna menu iliyohifadhiwa - IMEBAKI
    if (!botSettings?.lastMenuCategories ||!Array.isArray(botSettings.lastMenuCategories)) {
      return sock.sendMessage(from, { text: '> Menu expired. Send `menu` again.' }, { quoted: msg }).catch(() => {})
    }

    // 5. Angalia kama reply ni ya chat hii - IMEBAKI
    if (botSettings.lastMenuFrom && botSettings.lastMenuFrom!== from) {
      return sock.sendMessage(from, { text: '> Menu expired. Send `menu` again.' }, { quoted: msg }).catch(() => {})
    }

    const categories = botSettings.lastMenuCategories
    const commandsMap = botSettings.lastMenuCommands || {}
    const emojisMap = botSettings.lastMenuEmojis || {}

    // 6. Validate namba - IMEBAKI
    if (choice < 1 || choice > categories.length) {
      return sock.sendMessage(from, { text: `> Invalid number. Send 1-${categories.length}` }, { quoted: msg }).catch(() => {})
    }

    // 7. Chukua category
    const selectedCat = categories[choice - 1]
    const commands = commandsMap[selectedCat] || []
    const prefix = botSettings.prefix || '!'
    const catEmoji = emojisMap[selectedCat] || '📁'

    // 8. React
    try {
      await sock.sendMessage(from, { react: { text: '📂', key: msg.key } })
    } catch {}

    // 9. Build command list
    let cmdList = `╭──⌈ ${catEmoji} ${selectedCat} ⌋\n`
    commands.sort().forEach(cmd => {
      cmdList += `│ ${prefix}${cmd}\n`
    })
    cmdList += `╰────────────────\n\n*Total: ${commands.length} commands*`

    // 10. Tuma
    await sock.sendMessage(from, { text: cmdList }, { quoted: msg }).catch(async () => {
      await sock.sendMessage(from, { text: cmdList }).catch(() => {})
    })

  } catch (err) {
    console.error('[MENUREPLY CRASH]', err.message)
    try {
      await sock.sendMessage(from, { text: '> Error loading category. Send `menu` again.' }, { quoted: msg })
    } catch {}
  }
}