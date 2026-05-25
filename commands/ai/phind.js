import axios from 'axios'

export const name = 'phind'
export const alias = ['phindai', 'ph']
export const category = 'AI'
export const desc = 'Chat with Phind AI'

export default async function phind(sock, { msg, from }, botSettings) {
  try {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = text.split(' ').slice(1)
    const prompt = args.join(' ')

    if (!prompt) {
      return sock.sendMessage(from, { text: '❌ Usage:.phind debug this code' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '💻', key: msg.key } })

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

    const systemPrompt = `You are Phind AI, a coding and developer assistant.

Core Identity:
1. You are Phind AI, specialized in programming, debugging, and code explanation.
2. You write clean, working code and explain it simply.
3. You understand multiple programming languages.

Behavior Rules:
1. Answer in the user's language. Match exactly.
2. For code questions, give working code + short explanation.
3. Keep replies practical. 3-6 lines for code, longer if needed.
4. Be direct. Skip theory unless asked.
5. If asked who made you: "Phind"
6. If asked about owner: "This bot is managed by ${ownerName}"
7. If asked owner number: "${ownerNumber || 'Private'}"
8. If code fails, explain why and fix it.
9. No fluff, no disclaimers unless security risk.`

    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
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
    console.log('Phind command error:', error.message)
    await sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
  }
}