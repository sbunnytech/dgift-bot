// observers/autoviewstatus.js
export default async function autoviewstatus(sock, { msg, from, sender }, botSettings) {
  try {
    if (!botSettings?.supabase) return
    if (from !== 'status@broadcast') return // only status
    if (msg.key.fromMe) return // skip my own status

    // Get settings
    const { data: settings } = await botSettings.supabase
      .from('b_settings')
      .select('autoviewstatus')
      .eq('id', 'DGIFT_DEFAULT')
      .maybeSingle()

    if (!settings?.autoviewstatus) return

    // Mark status as read/viewed
    await sock.readMessages([msg.key])

    console.log(`[AUTOVIEWSTATUS] Viewed status from ${sender}`)

  } catch (err) {
    console.log('[AUTOVIEWSTATUS ERROR]', err.message)
  }
}