// commands/ai/cohere.js
export const name = 'cohere'
export const alias = ['co', 'cohereai']
export const category = 'AI'
export const desc = 'Chat with Cohere AI'

async function getBotConfig(botSettings) {
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'

  if (!botSettings.supabase) {
    return { owner_name: 'Owner', owner_number: '' }
  }

  const { data } = await botSettings.supabase
   .from('b_settings')
   .select('owner_name, owner_number')
   .eq('id', instanceId)
   .maybeSingle()

  return {
    owner_name: data?.owner_name || 'Owner',
    owner_number: data?.owner_number || ''
  }
}

export default async function cohere(sock, { msg, from }, botSettings) {
  const prefix = botSettings.prefix

  try {
    // 1. Advanced text extraction
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
    const text = msg.message?.conversation ||
                 msg.message?.extendedTextMessage?.text ||
                 quoted?.conversation ||
                 quoted?.extendedTextMessage?.text ||
                 ''

    if (!text) {
      return sock.sendMessage(from, {
        text: `❌ Usage: ${prefix}cohere write email\nOr reply to a message with ${prefix}cohere`
      }, { quoted: msg })
    }

    // Remove command prefix
    const prompt = text.replace(new RegExp(`^${prefix}cohere\\s*`, 'i'), '').trim()
    if (!prompt) {
      return sock.sendMessage(from, {
        text: `❌ Please provide a message. Usage: ${prefix}cohere write email`
      }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '📝', key: msg.key } }).catch(() => {})

    // 2. Get owner info from DB
    const { owner_name, owner_number } = await getBotConfig(botSettings)

    if (!process.env.GROQ_API_KEY) {
      return sock.sendMessage(from, {
        text: '❌ AI is down right now. Try again later.'
      }, { quoted: msg })
    }

    // 3. System prompt
    const systemPrompt = `You are Cohere AI, a professional writing and communication assistant.

Core Identity:
1. You are Cohere AI, built for clear communication and writing tasks.
2. You excel at emails, essays, summaries, and business content.
3. Your tone is professional, clear, and efficient.

Behavior Rules:
1. Answer in the user's language. Match exactly.
2. Keep replies clean and structured. 2-4 lines for short tasks.
3. Be direct. Avoid fluff and repetition.
4. If asked who made you: "Cohere"
5. If asked about owner: "This bot is managed by ${owner_name}"
6. If asked owner number: "${owner_number || 'Private'}"
7. For creative tasks, be helpful but concise.
8. Do not add disclaimers unless legally required.`

    // 4. Call Groq API with fetch
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6,
        max_tokens: 600
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status} ${res.statusText}`)
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content || '❌ AI failed to respond'

    // 5. Send reply
    await sock.sendMessage(from, { text: reply }, { quoted: msg })

  } catch (error) {
    console.error('[COHERE ERROR]', error)

    let errorMsg = '❌ AI is down right now. Try again later.'
    if (error.name === 'AbortError') {
      errorMsg = '❌ Request timed out. Try again.'
    }

    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } }).catch(() => {})
    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg }).catch(() => {})
  }
}