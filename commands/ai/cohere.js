import axios from 'axios'

export const name = 'cohere'
export const alias = ['co', 'cohereai']
export const category = 'AI'
export const desc = 'Chat with Cohere AI'

export default async function cohere(sock, { msg, from }, botSettings) {
  try {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = text.split(' ').slice(1)
    const prompt = args.join(' ')

    if (!prompt) {
      return sock.sendMessage(from, { text: '❌ Usage:.cohere write email' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '📝', key: msg.key } })

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
5. If asked about owner: "This bot is managed by ${ownerName}"
6. If asked owner number: "${ownerNumber || 'Private'}"
7. For creative tasks, be helpful but concise.
8. Do not add disclaimers unless legally required.`

    const res = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.6
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
    console.log('Cohere command error:', error.message)
    await sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
  }
}