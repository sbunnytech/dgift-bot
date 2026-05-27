// commands/group/onlyadmins.js
export const name = 'onlyadmins'
export const alias = ['adminsonly', 'lockgroup', 'groupadmins']
export const category = 'Group'
export const desc = 'Toggle only admins can send messages in group. Usage: onlyadmins on/off'

async function getBrandName(botSettings) {
  if (!botSettings.supabase) return 'Bot'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
 .from('b_settings')
 .select('brand_name, botname')
 .eq('id', instanceId)
 .maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

function getErrorMessage(err) {
  const msg = err.message?.toLowerCase() || ''

  if (msg.includes('not-authorized') || msg.includes('forbidden')) {
    return 'I need to be an admin to change group settings. Make me admin first.'
  }
  if (msg.includes('rate-limit')) {
    return 'Too many requests. Try again in a few minutes.'
  }
  if (msg.includes('timeout')) {
    return 'WhatsApp is temporarily unavailable. Try again later.'
  }
  return 'Failed to update group settings. Reason: ' + err.message
}

export default async function onlyadmins(sock, { msg, from, isGroup, args }, botSettings) {
  try {
    if (!isGroup) {
      return await sock.sendMessage(from, {
        text: '> This command only works in groups.'
      }, { quoted: msg })
    }

    if (!botSettings.supabase) {
      return await sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)
    const action = args[0]?.toLowerCase()

    // Get current status from DB
    const { data: settings } = await botSettings.supabase
   .from('b_settings')
   .select('onlyadmins')
   .eq('id', from)
   .maybeSingle()

    const currentValue = settings?.onlyadmins || false

    // Show status if no action
    if (!action) {
      await sock.sendMessage(from, { react: { text: '🔐', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ ONLY ADMINS MODE ⌋
│ Status: ${currentValue? 'ON ✅' : 'OFF ❌'}
│
│ Usage:
│ ${botSettings.prefix}onlyadmins on
│ ${botSettings.prefix}onlyadmins off
│
│ When ON, only admins can send messages.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Parse action
    const newValue = ['on', 'enable', '1', 'true'].includes(action)

    // Check if already set
    if (newValue === currentValue) {
      await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `> Only Admins mode is already ${action}`
      }, { quoted: msg })
    }

    // Update WhatsApp group setting
    try {
      await sock.groupSettingUpdate(from, newValue? 'announcement' : 'not_announcement')
    } catch (err) {
      const errorMsg = getErrorMessage(err)
      return await sock.sendMessage(from, {
        text: `╭─⌈ UPDATE FAILED ⌋
│ ${errorMsg}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Save to database
    const { error } = await botSettings.supabase
   .from('b_settings')
   .upsert({
      id: from,
      onlyadmins: newValue,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

    if (error) {
      await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
      return await sock.sendMessage(from, { text: `> Database error: ${error.message}` }, { quoted: msg })
    }

    // Update live memory
    botSettings.onlyadmins = newValue

    await sock.sendMessage(from, { react: { text: newValue? '🔒' : '🔓', key: msg.key } })
    await sock.sendMessage(from, {
      text: `╭─⌈ SETTINGS UPDATED ⌋
│ Only Admins Mode: ${newValue? 'ON 🔒' : 'OFF 🔓'}
│
│ ${newValue
 ? 'Only admins can send messages now.'
  : 'Everyone can send messages now.'}
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error('[ONLYADMINS ERROR]', err)
    await sock.sendMessage(from, {
      text: '> An unexpected error occurred. Check console for details.'
    }, { quoted: msg })
  }
}