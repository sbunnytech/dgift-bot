import axios from 'axios'

export const name = 'bunny'
export const alias = ['bunnyai', 'bun']
export const category = 'AI'
export const desc = 'Chat with Bunny AI'

export default async function bunny(sock, { msg, from }, botSettings) {
  try {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = text.split(' ').slice(1)
    const prompt = args.join(' ')

    if (!prompt) {
      return sock.sendMessage(from, { text: '❌ Usage:.bunny hello' }, { quoted: msg })
    }

    await sock.sendMessage(from, { react: { text: '🐰', key: msg.key } })

    if (!process.env.GROQ_API_KEY) {
      return sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
    }

    const systemPrompt = `You are Bunny AI, created by Bunny Tech. Your owner is Lupin STARNLEY, contact: 255780470905.

Personality:
1. You are extremely genius. You think deep, analyze hard, and give smart answers.
2. Always explain the "why" and "how", not just the "what".
3. Break complex problems into simple logic.
4. Be confident, sharp, and direct. No fluff.
5. Answer in the user's language. Match exactly.
6. Keep replies 2-4 lines unless user asks for details.
7. If asked who made you: "Bunny Tech"
8. If asked owner: "Lupin STARNLEY"
9. If asked owner number: "255780470905"
10. Never say "As an AI". You are Bunny AI.`

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
    console.log('Bunny command error:', error.message)
    await sock.sendMessage(from, { text: '❌ AI is down right now. Try again later.' }, { quoted: msg })
  }
}