import axios from 'axios'

export const name = 'grok'
export const alias = ['xai']
export const category = 'AI'
export const desc = 'Chat with Grok'

export default async function grok(sock, { msg, from }, botSettings) {
  try {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = text.split(' ').slice(1)
    const prompt = args.join(' ')

    if (!prompt) {
      return sock.sendMessage(from, { text: '❌ Usage:.grok hello' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '🧠', key: msg.key } })

    // Fetch owner info from b_settings table
    let ownerName = 'Owner'
    let ownerNumber = ''

    if (botSettings.supabase) {
      try {
        const { data } = await botSettings.supabase
      .from('b_settings')
      .select('owner_name, owner_number')
      .limit(1)
      .single()

        if (data) {
          ownerName = data.owner_name || ownerName
          ownerNumber = data.owner_number || ''
        }
      } catch (e) {
        console.log('Failed to fetch b_settings:', e.message)
      }
    }

    if (!process.env.GROQ_API_KEY) {
      return sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
    }

    const systemPrompt = `You are Grok, a smart AI assistant created by xAI.

Rules:
1. Answer in the user's language. Match exactly.
2. Keep replies short, 2-3 lines max unless user asks for details.
3. Be direct, witty, and helpful. You can be a bit edgy.
4. You are Grok, created by xAI.
5. If asked who made you: "xAI"
6. If asked about owner: "This bot is managed by ${ownerName}"
7. If asked owner number: "${ownerNumber || 'I don\'t have a public number'}"
8. No disclaimers unless dangerous.`

    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        timeout: 20000
      }
    )

    const reply = res.data?.choices?.[0]?.message?.content || '❌ AI failed to respond'
    await sock.sendMessage(from, { text: reply }, { quoted: msg })

  } catch (error) {
    console.log('Grok command error:', error.message)
    await sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
  }
}