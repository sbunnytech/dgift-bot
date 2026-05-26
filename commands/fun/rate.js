// commands/fun/rate.js
export const name = 'rate'
export const alias = ['rating', 'howmuch']
export const category = 'Fun'
export const desc = 'Rate anything from 0 to 100'

const ratings = [
  'Trash 🗑️', 'Mid 💀', 'Meh 🤷', 'Okay 👍',
  'Good 🔥', 'Great 😎', 'Amazing 🤯', 'Legendary 👑'
]

function getRatingText(score) {
  if (score < 10) return ratings[0]
  if (score < 25) return ratings[1]
  if (score < 40) return ratings[2]
  if (score < 55) return ratings[3]
  if (score < 70) return ratings[4]
  if (score < 85) return ratings[5]
  if (score < 95) return ratings[6]
  return ratings[7]
}

export default async function rate(sock, { msg, from, args }, botSettings) {
  try {
    const brandName = botSettings?.brand_name || botSettings?.botname || 'System'

    if (!args.length) {
      return sock.sendMessage(from, {
        text: `> ❌ Usage: ${botSettings.prefix}rate your crush\n> Example: ${botSettings.prefix}rate me`
      }, { quoted: msg })
    }

    const target = args.join(' ')
    const score = Math.floor(Math.random() * 101)
    const ratingText = getRatingText(score)

    const filled = Math.floor(score / 10)
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)

    await sock.sendMessage(from, {
      text: `╭─⌈ 📊 RATING SYSTEM ⌋
│ Target: ${target}
│ ${bar} ${score}%
│ Result: ${ratingText}
│
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

  } catch (error) {
    console.error('[RATE ERROR]', error)
    await sock.sendMessage(from, {
      text: '> ❌ Rating failed. Try again.'
    }, { quoted: msg }).catch(() => {})
  }
}