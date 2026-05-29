// commands/settings/setowner.js
export const name = 'setowner'
export const alias = ['owner', 'setownername', 'setownernumber']
export const category = 'Settings'
export const desc = 'Change bot owner number and name'

export default async function setowner(sock, { msg, from, sender }, botSettings) {
  try {
    // Angalia kama database ipo
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '👑', key: msg.key } })

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const newNumber = args[0]?.replace(/[^0-9]/g, '')
    const newName = args.slice(1).join(' ').trim()

    // Chukua settings za sasa
    const { data: settings } = await botSettings.supabase
    .from('b_settings')
    .select('owner_number, owner_name, botname')
    .eq('id', 'DGIFT_DEFAULT')
    .maybeSingle()

    const currentNumber = settings?.owner_number || 'Not set'
    const currentName = settings?.owner_name || 'Not set'
    const botname = settings?.botname || 'Bot'

    // Onyesha status kama hakuna input mpya
    if (!newNumber &&!newName) {
      await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ 👑 *Owner Settings* ⌋
│ Current Number: ${currentNumber}
│ Current Name: ${currentName}
│ Bot: ${botname}
│
│ Usage:
│ ${botSettings.prefix || '.'}setowner 2557xxxxxxxx Arnold
│ ${botSettings.prefix || '.'}setowner 2557xxxxxxxx
│ ${botSettings.prefix || '.'}setowner Arnold
╰⊷ *${botname}*`
      }, { quoted: msg })
    }

    const updateData = {
      updated_at: new Date().toISOString()
    }

    if (newNumber) updateData.owner_number = newNumber
    if (newName) updateData.owner_name = newName

    // Sasisha database
    const { error } = await botSettings.supabase
    .from('b_settings')
    .update(updateData)
    .eq('id', 'DGIFT_DEFAULT')

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    // Sasisha live memory
    if (newNumber) botSettings.owner_number = newNumber
    if (newName) botSettings.owner_name = newName

    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ ✅ *Owner Updated* ⌋
│ Old Number: ${currentNumber}
│ New Number: ${newNumber || currentNumber}
│ Old Name: ${currentName}
│ New Name: ${newName || currentName}
│ Status: Applied instantly
│
╰⊷ *${botname}*`
    }, { quoted: msg })

  } catch (err) {
    console.error(`[SETOWNER ERROR]`, err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed to update owner.' }, { quoted: msg })
  }
}