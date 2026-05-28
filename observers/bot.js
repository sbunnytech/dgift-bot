// observers/freechat.js
import axios from 'axios'

const chatMemory = new Map() // chatId -> { history: [], timeout: NodeJS.Timeout }
const MEMORY_TTL = 10 * 60 * 1000 // 10 min

function getMemory(chatId) {
  if (!chatMemory.has(chatId)) {
    chatMemory.set(chatId, { history: [], timeout: null })
  }

  const mem = chatMemory.get(chatId)

  if (mem.timeout) clearTimeout(mem.timeout)
  mem.timeout = setTimeout(() => {
    chatMemory.delete(chatId)
    console.log(`[FREECHAT] Memory cleared for ${chatId}`)
  }, MEMORY_TTL)

  return mem
}

async function isChatbotOn(botSettings) {
  if (!botSettings?.supabase || !botSettings?.instance_id) return false
  
  try {
    const { data } = await botSettings.supabase
      .from('b_settings')
      .select('chatbot_on, botname, owner_name, owner_number')
      .eq('id', botSettings.instance_id)
      .maybeSingle()
    
    return {
      on: data?.chatbot_on === true,
      botname: data?.botname || 'Bot',
      owner_name: data?.owner_name || 'Owner',
      owner_number: data?.owner_number || ''
    }
  } catch (e) {
    console.log('[FREECHAT] DB error:', e.message)
    return { on: false }
  }
}

export default async function freechat(sock, { msg, from, isProtected, isFromMe }, botSettings) {
  try {
    // Skip kama ni protected user, bot mwenyewe, au hakuna message
    if (isProtected || isFromMe || !msg?.message) return
    if (!process.env.GROQ_API_KEY) return

    // Check toggle kutoka DB
    const config = await isChatbotOn(botSettings)
    if (!config.on) return

    const text = (
      msg.message?.conversation || 
      msg.message?.extendedTextMessage?.text || 
      msg.message?.imageMessage?.caption || 
      ''
    ).trim()

    if (!text) return
    if (text.startsWith(botSettings.prefix)) return // usijibu command

    // React
    await sock.sendMessage(from, { react: { text: '💬', key: msg.key } }).catch(() => {})

    // Memory per chat - group id kwa group, user id kwa DM
    const mem = getMemory(from)

    // Build messages
    const messages = [
      {
        role: 'system',
        content: `You are ${config.botname}, a friendly WhatsApp assistant created by ${config.owner_name}.
Rules:
1. Reply in the user's language. Match their tone.
2. Keep replies short, 2-3 lines max unless asked for details.
3. Be natural, direct, helpful.
4. Never say "As an AI". You are ${config.botname}.
5. If asked who made you: ${config.owner_name}
6. If asked your number: ${config.owner_number || 'Private'}
7. No long disclaimers.`
      },
      ...mem.history,
      { role: 'user', content: text }
    ]

    // Call Groq
    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: messages,
        temperature: 0.8,
        max_tokens: 400
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        timeout: 20000
      }
    )

    const reply = res.data?.choices?.[0]?.message?.content || '❌ AI failed'

    // Save to memory
    mem.history.push({ role: 'user', content: text })
    mem.history.push({ role: 'assistant', content: reply })

    // Keep last 10 messages only
    if (mem.history.length > 10) {
      mem.history = mem.history.slice(-10)
    }

    // Send reply
    await sock.sendMessage(from, { text: reply }, { quoted: msg })
    console.log(`[FREECHAT] Replied to ${from}`)

  } catch (error) {
    console.log('[FREECHAT ERROR]', error.message)
  }
}