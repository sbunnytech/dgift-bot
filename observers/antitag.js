// observers/antitag.js
export default async function antitag(sock, { msg, from, sender }, botSettings) {
  try {
    // Usifanye kitu kama ni message yako mwenyewe
    if (msg.key.fromMe) return

    // Angalia kama database ipo
    if (!botSettings?.supabase) return

    // Chukua setting ya antitag kutoka database
    const { data: settings } = await botSettings.supabase
     .from('b_settings')
     .select('antitag')
     .eq('id', 'DGIFT_DEFAULT')
     .maybeSingle()

    // Kama antitag haiko ON, toka
    if (!settings?.antitag) return

    // Chukua message content
    const messageContent = msg.message?.extendedTextMessage || msg.message?.conversation
    if (!messageContent) return

    // Pata mentions kwenye message
    const mentions = messageContent.contextInfo?.mentionedJid || []

    // Kama hakuna mentions, toka
    if (mentions.length === 0) return

    // Kama mentions zaidi ya 10, futa message
    if (mentions.length > 10) {
      // Futa message
      await sock.sendMessage(from, {
        delete: msg.key
      }).catch(() => {})

      // Tuma warning
      await sock.sendMessage(from, {
        text: `╭─⌈ 🚫 *AntiTag Activated* ⌋
│ Tag limit exceeded: ${mentions.length}/10
│ Action: Message deleted
│
│ Reason: Spamming tags is not allowed
╰⊷ *${botSettings.botname || 'Bot'}*`,
        mentions: [sender]
      }).catch(() => {})

      console.log(`[ANTITAG] Deleted message from ${sender} with ${mentions.length} tags in ${from}`)
    }

  } catch (err) {
    console.log('[ANTITAG ERROR]', err.message)
  }
}