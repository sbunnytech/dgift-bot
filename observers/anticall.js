// observers/anticall.js
export default async function anticall(sock, callEvent, botSettings) {
  try {
    if (!botSettings?.supabase) return
    if (callEvent.status !== 'offer') return // only reject incoming calls

    const { from, id } = callEvent

    const { data: settings } = await botSettings.supabase
      .from('b_settings')
      .select('anticall')
      .eq('id', 'DGIFT_DEFAULT')
      .maybeSingle()

    if (!settings?.anticall) return

    await sock.rejectCall(id, from)
    await sock.sendMessage(from, { 
      text: 'Calls are disabled.\nPlease contact the owner via chat.' 
    })

  } catch (err) {
    console.log('[ANTICALL ERROR]', err.message)
  }
}