// commands/group/setgcname.js
export const name = 'setgcname'
export const alias = ['setgc', 'changegcname', 'groupname']
export const category = 'Group'
export const desc = 'Change the group name. Bot must be admin.'

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
    return 'I need to be an admin to change the group name.'
  }
  if (msg.includes('rate-limit')) {
    return 'Too many changes. Wait a few minutes before trying again.'
  }
  if (msg.includes('invalid') || msg.includes('bad request')) {
    return 'Invalid group name. Max 25 characters, no empty names.'
  }
  if (msg.includes('timeout')) {
    return 'WhatsApp is temporarily unavailable. Try again later.'
  }

  return 'Failed to change group name. Reason: ' + err.message
}

export default async function setgcname(sock, { msg, from, sender, isGroup, groupMetadata, args }, botSettings) {
  try {
    if (!isGroup) {
      return await sock.sendMessage(from, {
        text: '> This command only works in groups.'
      }, { quoted: msg })
    }

    const brandName = await getBrandName(botSettings)
    const newName = args.join(' ').trim()

    if (!newName) {
      return await sock.sendMessage(from, {
        text: `╭─⌈ CHANGE GROUP NAME ⌋
│ Usage: ${botSettings.prefix}setgcname New Group Name
│ Max 25 characters.
│
│ Current name: ${groupMetadata.subject}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    if (newName.length > 25) {
      return await sock.sendMessage(from, {
        text: `> Group name is too long. Max 25 characters. Yours is ${newName.length}.`
      }, { quoted: msg })
    }

    if (newName === groupMetadata.subject) {
      return await sock.sendMessage(from, {
        text: '> Group name is already set to that.'
      }, { quoted: msg })
    }

    try {
      await sock.groupUpdateSubject(from, newName)

      await sock.sendMessage(from, {
        text: `╭─⌈ GROUP NAME CHANGED ⌋
│ Old: ${groupMetadata.subject}
│ New: ${newName}
│ Changed by: @${sender.split('@')[0]}
╰⊷ *Powered By ${brandName}*`,
        mentions: [sender]
      }, { quoted: msg })

    } catch (err) {
      const errorMsg = getErrorMessage(err)

      await sock.sendMessage(from, {
        text: `╭─⌈ CHANGE FAILED ⌋
│ ${errorMsg}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

  } catch (err) {
    console.error('[SETGCNAME ERROR]', err)
    await sock.sendMessage(from, {
      text: '> An unexpected error occurred.'
    }, { quoted: msg })
  }
}