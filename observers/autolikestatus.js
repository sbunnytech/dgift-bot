// observers/autolikestatus.js
const emojis = [
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','❣️','💕','💞','💓','💗','💖','💘','💝',
  '💯','🔥','💥','💢','💦','💨','💫','⭐','🌟','✨','⚡','☀️','🌙','🌈','🌊','🌸','🌺','🌻','🌹',
  '🍀','🍁','🍂','🍃','🌿','🌱','🌴','🌳','🌲','🎄','🎋','🎍','🎎','🎏','🎐','🎑','🎀','🎁','🎊','🎉',
  '🎈','🎂','🍰','🍫','🍬','🍭','🍮','🍯','🍎','🍏','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🍈','🍒','🍑',
  '🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞',
  '🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🥪','🥙','🧆',
  '🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥',
  '🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜',
  '🍯','🥛','🍼','☕','🫖','🍵','🧃','🥤','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊','🥄',
  '🍴','🍽️','🥣','🥡','🥢','🧂','👍','👏','🙌','🙏','💪','👌','🤞','🤟','🤘','🤙','👋','🫶','✌️','🤝'
]

export default async function autolikestatus(sock, { msg, from, sender }, botSettings) {
  try {
    // Quick checks first - no DB call if not needed
    if (!msg?.key) return
    if (from !== 'status@broadcast') return
    if (msg.key.fromMe) return
    if (!msg.key.id) return

    let autolikeEnabled = false
    let instanceId = 'DGIFT_DEFAULT'

    try {
      instanceId = botSettings?.instance_id || 'DGIFT_DEFAULT'
      
      if (botSettings?.supabase) {
        const { data: settings, error } = await botSettings.supabase
          .from('b_settings')
          .select('autolikestatus')
          .eq('id', instanceId)
          .maybeSingle()

        if (!error && settings) {
          autolikeEnabled = !!settings.autolikestatus
        }
      }
    } catch (dbErr) {
      console.log('[AUTOLIKESTATUS] DB check failed, skipping:', dbErr.message)
      return
    }

    if (!autolikeEnabled) return

    // Pick random emoji
    let emoji = '❤️'
    try {
      emoji = emojis[Math.floor(Math.random() * emojis.length)]
    } catch {
      emoji = '❤️'
    }

    // Send reaction with retry logic
    let reacted = false
    try {
      await sock.sendMessage(from, {
        react: { text: emoji, key: msg.key }
      })
      reacted = true
    } catch (err1) {
      console.log('[AUTOLIKESTATUS] First attempt failed:', err1.message)
      
      // Retry once after 2s delay
      try {
        await new Promise(r => setTimeout(r, 2000))
        await sock.sendMessage(from, {
          react: { text: emoji, key: msg.key }
        })
        reacted = true
      } catch (err2) {
        console.log('[AUTOLIKESTATUS] Retry failed:', err2.message)
      }
    }

    if (reacted) {
      console.log(`[AUTOLIKESTATUS] Liked status from ${sender || 'unknown'} with ${emoji}`)
    }

  } catch (err) {
    // Never let observer crash the bot
    console.log('[AUTOLIKESTATUS ERROR]', err?.message || err)
  }
}