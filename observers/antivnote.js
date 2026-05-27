// observers/antivoicenotes.js
async function getBrandName(botSettings) {
  if (!botSettings?.supabase) return 'Bot'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
 .from('b_settings')
 .select('brand_name, botname')
 .eq('id', instanceId)
 .maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

export default async function antivoicenotes(sock, { msg, from, sender }, botSettings) {
  try {
    if (msg.key.fromMe) return
    if (!botSettings?.supabase) return

    const { data: settings } = await botSettings.supabase
  .from('b_settings')
  .select('anti_voice_notes')
  .eq('id', 'DGIFT_DEFAULT')
  .maybeSingle()

    if (!settings?.anti_voice_notes) return

    const msgType = Object.keys(msg.message || {})[0]
    if (msgType === 'audioMessage' && msg.message.audioMessage?.ptt) {
      const brandName = await getBrandName(botSettings)

      await sock.sendMessage(from, { delete: msg.key }).catch(() => {})

      await sock.sendMessage(from, {
        text: `╭─⌈ 🚫 *AntiVoiceNote Activated* ⌋
│ Action: Message deleted
│
│ Reason: Voice notes are not allowed
╰⊷ *Powered By ${brandName}*`,
        mentions: [sender]
      }).catch(() => {})

      console.log(`[ANTIVOICE] Deleted voice note from ${sender} in ${from}`)
    }

  } catch (err) {
    console.log('[ANTIVOICE ERROR]', err.message)
  }
}