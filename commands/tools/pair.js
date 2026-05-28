// commands/tools/pair.js
export const name = 'pair'
export const alias = ['createbot', 'getbot', 'pairing']
export const category = 'Tools'
export const desc = 'Get your own WhatsApp bot in under 60 seconds'

export default async function pairCommand(sock, { msg, from }, botSettings) {
  try {
    const prefix = botSettings.prefix || '.'
    const botname = botSettings.botname || 'Bot'

    const reply = `╭─⌈ 🤖 *CREATE YOUR OWN BOT* ⌋
│
│ Want your own WhatsApp bot running 24/7?
│ You can have it ready in under 60 seconds! ⚡
│
├─ *STEP 1: BUY ACTIVATION KEY*
│ First, buy your bot activation key here:
│ https://dgift-bot-shops.vercel.app/
│
│ Choose from:
│ • Premium Key - Stable, 24/7 online
│ • Standard Key - Reliable & fast
│ • Basic Key - Perfect to start
│
├─ *STEP 2: GET YOUR BOT*
│ After payment, you'll get instant access to:
│ • Your personal bot panel
│ • Pairing code / QR code
│ • Full setup guide
│ • 24/7 support
│
├─ *STEP 3: DEPLOY*
│ Just fill in some details, connect your number,
│ and boom! Your bot is live.
│
│ ⚠️ IMPORTANT: Buy the activation key FIRST
│ No key = no bot access
│
│ 💡 Why choose us?
│ • Instant activation
│ • Zero coding required
│ • Free updates & features
│ • Direct support from me
│
╰⊷ Click here to start: https://dgift-bot-shops.vercel.app/

Type *${prefix}pair* anytime to see this message again.
Powered by *${botname}*`

    await sock.sendMessage(from, { 
      text: reply,
      linkPreview: {
        url: 'https://dgift-bot-shops.vercel.app/',
        title: 'DGIFT BOT SHOPS - Create Your Bot',
        description: 'Get your own WhatsApp bot in under 60 seconds'
      }
    }, { quoted: msg })

    await sock.sendMessage(from, { react: { text: '🚀', key: msg.key } }).catch(() => {})

  } catch (err) {
    console.error(`[PAIR CMD ERROR]`, err.message)
    await sock.sendMessage(from, { text: '> Failed to load pairing info. Try again later.' }, { quoted: msg })
  }
}