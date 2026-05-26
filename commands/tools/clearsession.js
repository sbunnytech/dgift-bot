// commands/tools/clearsessions.js
import fs from 'fs'
import path from 'path'

export const name = 'clearsessions'
export const alias = ['clearsession', 'delsession', 'resetsession']
export const category = 'Tools'
export const desc = 'Delete session folder and Supabase session data. Bot will require re-auth.'

export default async function clearsessions(sock, { msg, from, sender }, botSettings) {
  let loadingMsg = null
  try {
    const brand = await getBrandName(botSettings)

    await sock.sendMessage(from, { react: { text: '🗑️', key: msg.key } })

    loadingMsg = await sock.sendMessage(from, {
      text: `╭─⌈ 🧹 *CLEARING SESSION* ⌋
│
│ Deleting local session...
│ Deleting Supabase data...
│ Bot will restart for re-auth
│
╰⊷ *Powered By ${brand}*`
    }, { quoted: msg })

    // 1. Delete session folder locally
    const sessionDir = path.resolve('./session')
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true })
      console.log('[CLEARSESSION] Local session folder deleted')
    }

    // 2. Delete session from Supabase
    const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
    if (botSettings.supabase) {
      const { error } = await botSettings.supabase
        .from('bu_sessions')
        .delete()
        .eq('id', instanceId)

      if (error) throw error
      console.log('[CLEARSESSION] Supabase session deleted for', instanceId)
    } else {
      console.log('[CLEARSESSION] No Supabase client, skipping DB delete')
    }

    // 3. Success message
    await sock.sendMessage(from, {
      text: `╭─⌈ ✅ *SESSION CLEARED* ⌋
│
│ Local session: Deleted
│ Supabase session: Deleted
│ Status: Disconnecting in 3s...
│
│ Next: Scan QR or use Pair Code
│ to reconnect your session
│
╰⊷ *Powered By ${brand}*`,
      edit: loadingMsg.key
    })

    await sock.sendMessage(from, { react: { text: '✅', key: loadingMsg.key } }).catch(() => {})

    // 4. Disconnect to trigger reconnect loop
    setTimeout(async () => {
      try {
        if (sock.logout) await sock.logout()
        else if (sock.ws) sock.ws.close()
        else process.exit(1)
      } catch (e) {
        console.error('[CLEARSESSION] Disconnect error:', e.message)
        process.exit(1)
      }
    }, 3000)

  } catch (error) {
    console.error('[CLEARSESSIONS ERROR]', error)
    const brand = await getBrandName(botSettings)

    const errorMsg = `╭─⌈ ❌ *ERROR* ⌋
│
│ Failed to clear sessions
│ Reason: ${error.message}
│
╰⊷ *Powered By ${brand}*`

    if (loadingMsg) {
      await sock.sendMessage(from, { text: errorMsg, edit: loadingMsg.key }).catch(() => {})
    } else {
      await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
    }
  }
}

async function getBrandName(botSettings) {
  if (!botSettings?.supabase) return botSettings?.brand_name || botSettings?.botname || 'DGIFT BOT'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
    .from('b_settings')
    .select('brand_name, botname')
    .eq('id', instanceId)
    .maybeSingle()
  return data?.brand_name || data?.botname || 'DGIFT BOT'
}