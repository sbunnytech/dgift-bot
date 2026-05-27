// commands/group/gctime.js
export const name = 'gctime'
export const alias = ['grouptime', 'opentime', 'closetime']
export const category = 'Group'
export const desc = 'Set group open/close time. Only admins can chat during close time'

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
  if (msg.includes('invalid')) {
    return 'Invalid time format. Use HH:MM format like 22:00'
  }
  if (msg.includes('rate-limit')) {
    return 'Too many requests. Try again in a few minutes.'
  }
  return 'Failed to update group time. Reason: ' + err.message
}

function isValidTime(time) {
  if (!time ||!time.match(/^\d{2}:\d{2}$/)) return false
  const [h, m] = time.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

export default async function gctime(sock, { msg, from }, botSettings) {
  try {
    if (!from.endsWith('@g.us')) {
      return await sock.sendMessage(from, { text: '> This command only works in groups.' }, { quoted: msg })
    }
    if (!botSettings.supabase) {
      return await sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()

    // Get current settings
    const { data: settings } = await botSettings.supabase
.from('b_settings')
.select('gctime_enabled, gctime_open, gctime_close')
.eq('id', from)
.maybeSingle()

    const isEnabled = settings?.gctime_enabled || false
    const openTime = settings?.gctime_open || '06:00'
    const closeTime = settings?.gctime_close || '22:00'

    // No args - show status
    if (!action) {
      return await sock.sendMessage(from, {
        text: `╭─⌈ ⏰ *Group Time Control* ⌋
│ Status: ${isEnabled? 'ON ✅' : 'OFF ❌'}
│ Open: ${openTime}
│ Close: ${closeTime}
│
│ Usage:
│ ${botSettings.prefix}gctime on/off
│ ${botSettings.prefix}gctime 22:00 06:00
│ ${botSettings.prefix}gctime reset
│
│ Only admins can chat during close time.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // ON/OFF toggle
    if (action === 'on' || action === 'off' || action === 'enable' || action === 'disable') {
      const newValue = ['on', 'enable', '1'].includes(action)

      if (newValue === isEnabled) {
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        return await sock.sendMessage(from, {
          text: `╭─⌈ GROUP TIME ⌋
│ Status already set to ${action.toUpperCase()}
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      const { error } = await botSettings.supabase.from('b_settings').upsert({
        id: from,
        gctime_enabled: newValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

      if (error) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return await sock.sendMessage(from, {
          text: `╭─⌈ DATABASE ERROR ⌋
│ ${error.message}
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: newValue? '✅' : '❌', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ ⏰ *Group Time* ⌋
│ Status: ${newValue? 'ON ✅' : 'OFF ❌'}
│
│ ${newValue? 'Group will auto close/open at set time.' : 'Group time control disabled.'}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // RESET to default
    if (action === 'reset' || action === 'default') {
      const { error } = await botSettings.supabase.from('b_settings').upsert({
        id: from,
        gctime_enabled: false,
        gctime_close: '22:00',
        gctime_open: '06:00',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

      if (error) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return await sock.sendMessage(from, {
          text: `╭─⌈ DATABASE ERROR ⌋
│ ${error.message}
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '♻️', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ RESET SUCCESS ⌋
│ Group time reset to default
│ Open: 06:00
│ Close: 22:00
│ Status: OFF
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Set custom time format: gctime 22:00 06:00
    if (isValidTime(action)) {
      const close = action
      const open = args[1]

      if (!isValidTime(open)) {
        return await sock.sendMessage(from, {
          text: `╭─⌈ INVALID FORMAT ⌋
│ Usage: ${botSettings.prefix}gctime 22:00 06:00
│ Format: HH:MM HH:MM
│ Example: ${botSettings.prefix}gctime 23:00 05:00
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      const { error } = await botSettings.supabase.from('b_settings').upsert({
        id: from,
        gctime_enabled: true,
        gctime_close: close,
        gctime_open: open,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })

      if (error) {
        await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
        return await sock.sendMessage(from, {
          text: `╭─⌈ DATABASE ERROR ⌋
│ ${error.message}
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return await sock.sendMessage(from, {
        text: `╭─⌈ TIME UPDATED ⌋
│ Group Close: ${close}
│ Group Open: ${open}
│ Status: ON ✅
│
│ Settings saved successfully.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Invalid input
    return await sock.sendMessage(from, {
      text: `╭─⌈ INVALID COMMAND ⌋
│ Usage:
│ ${botSettings.prefix}gctime on/off
│ ${botSettings.prefix}gctime 22:00 06:00
│ ${botSettings.prefix}gctime reset
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (err) {
    console.error('[GCTIME ERROR]', err)
    await sock.sendMessage(from, {
      text: `╭─⌈ ERROR ⌋
│ ${getErrorMessage(err)}
╰⊷ *Powered By ${brandName || 'Bot'}*`
    }, { quoted: msg })
  }
}