// commands/profile/delpp.js
export const name = 'delpp'
export const alias = ['delppic', 'remove_pp', 'deletepp']
export const category = 'Profile'
export const desc = 'Remove bot profile picture and set to default'

export default async function delpp(sock, { msg, from }, botSettings) {
  const brandName = botSettings?.brand_name || botSettings?.botname || 'Bot'

  try {
    await sock.sendMessage(from, { react: { text: '☝️', key: msg.key } }).catch(() => {})

    // Remove bot profile picture
    await sock.removeProfilePicture(sock.user.id)

    // Confirm
    const caption = `╭─⌈ ✅ *PP REMOVED* ⌋
│ Bot profile picture deleted
│ Profile is now default
╰⊷ *${brandName}*`

    await sock.sendMessage(from, { text: caption }, { quoted: msg })
    await sock.sendMessage(from, { react: { text: '✅', key: msg.key } }).catch(() => {})

  } catch (error) {
    console.error('[DELPP ERROR]', error.message)

    let errorMsg = '> Failed to remove profile picture'

    if (error.message.includes('500')) {
      errorMsg = '> WhatsApp server error. Try again'
    } else if (error.message.includes('403')) {
      errorMsg = '> No permission to remove profile picture'
    } else if (error.message.includes('not-authorized')) {
      errorMsg = '> Not authorized. Check bot session'
    }

    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg }).catch(() => {})
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {})
  }
}