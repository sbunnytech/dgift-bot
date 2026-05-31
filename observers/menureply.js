export default async function menureply(sock, { msg, from, sender }, botSettings) {
  try {
    // 1. Safe access kwa message body
    const body = msg?.message?.extendedTextMessage?.text?.trim() ||
                 msg?.message?.conversation?.trim() || ''

    if (!body) return

    const prefix = botSettings?.prefix || '!'

    // 2. FIX MUHIMU: Kama ina prefix mbele, wacha ipite kwa command handler
    if (body.startsWith(prefix)) return

    // 3. Angalia kama ni namba peke yake tu, sio "7ping"
    if (!/^\d+$/.test(body)) return

    const choice = parseInt(body)
    if (isNaN(choice)) return

    // 4. Angalia kama kuna menu iliyohifadhiwa
    if (!botSettings?.lastMenuCategories ||!Array.isArray(botSettings.lastMenuCategories)) {
      return sock.sendMessage(from, { text: '> Menu expired. Send `menu` again.' }, { quoted: msg }).catch(() => {})
    }

    // 5. Angalia kama reply ni ya chat hii
    if (botSettings.lastMenuFrom && botSettings.lastMenuFrom!== from) {
      return sock.sendMessage(from, { text: '> Menu expired. Send `menu` again.' }, { quoted: msg }).catch(() => {})
    }

    const categories = botSettings.lastMenuCategories
    const commandsMap = botSettings.lastMenuCommands || {}
    const emojisMap = botSettings.lastMenuEmojis || {}

    // 6. Validate namba
    if (choice < 1 || choice > categories.length) {
      return sock.sendMessage(from, { text: `> Invalid number. Send 1-${categories.length}` }, { quoted: msg }).catch(() => {})
    }

    // 7. Chukua category
    const selectedCat = categories[choice - 1]
    const commands = commandsMap[selectedCat] || []
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