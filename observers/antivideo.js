// observers/antivideosending.js
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

export default async function antivideosending(sock, { msg, from, sender }, botSettings) {
  try {
    if (msg.key.fromMe) return
    if (!botSettings?.supabase) return

    const { data: settings } = await botSettings.supabase
  .from('b_settings')
  .select('anti_video_sending')
  .eq('id', 'DGIFT_DEFAULT')
  .maybeSingle()

    if (!settings?.anti_video_sending) return

    const msgType = Object.keys(msg.message || {})[0]
    if (msgType === 'videoMessage' &&!msg.message.videoMessage?.ptt) {
      const brandName = await getBrandName(botSettings)

      await sock.sendMessage(from, { delete: msg.key }).catch(() => {})

      await sock.sendMessage(from, {
        text: `╭─⌈ 🚫 *AntiVideo Activated* ⌋
│ Action: Message deleted
│
│ Reason: Video sending is not allowed
╰⊷ *Powered By ${brandName}*`,
        mentions: [sender]
      }).catch(() => {})

      console.log(`[ANTIVIDEO] Deleted video from ${sender} in ${from}`)
    }

  } catch (err) {
    console.log('[ANTIVIDEO ERROR]', err.message)
  }
}