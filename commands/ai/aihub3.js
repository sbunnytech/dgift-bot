import axios from 'axios'

export const name = 'aihub3'
export const alias = [
  'aihub3',
  'story','poem','joke','quote','facts','recipe','plan','email','logo','chat'
]
export const category = 'AI'
export const desc = 'AI HUB PART 3 — 10 commands with Smart OpenRouter Key'

// Store conversations in Map - auto clean after 30 min
const conversations = new Map()

function getBrandName(botSettings) {
  return botSettings?.brand_name || botSettings?.botname || 'Bot'
}

function getQuotedText(msg) {
  const q = msg?.message?.extendedTextMessage?.contextInfo
  return (
    q?.quotedMessage?.conversation ||
    q?.quotedMessage?.extendedTextMessage?.text ||
    q?.quotedMessage?.imageMessage?.caption ||
    null
  )
}

async function rct(sock, msg, emoji) {
  try { await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }) } catch {}
}

// Auto clean old conversations every 30 min
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of conversations.entries()) {
    if (now - data.time > 30 * 60 * 1000) {
      conversations.delete(key)
    }
  }
}, 30 * 60 * 1000)

async function callAPI(endpoints) {
  for (const fn of endpoints) {
    try {
      const result = await fn()
      if (result && typeof result === 'string' && result.length > 5) return result
    } catch {}
  }
  return null
}

const OR_KEY = process.env.OPENROUTER_API_KEY
const OR_HEADERS = OR_KEY? { 'Authorization': `Bearer ${OR_KEY}`, 'HTTP-Referer': 'https://wa.bot' } : null

// 21. STORY
async function cmd_story(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Write%20a%20short%20story%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Write creative short story about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'anthropic/claude-3-sonnet', messages: [{role: 'system', content: system}, {role: 'user', content: `Write story about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'anthropic/claude-3-sonnet:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Write story about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-70B-Instruct', {inputs: `Write story: ${prompt}`})).data?.[0]?.generated_text,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.3-70b-versatile', messages: [{role: 'system', content: system}, {role: 'user', content: `Write creative story about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 22. POEM
async function cmd_poem(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Write%20a%20poem%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Write poem about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini', messages: [{role: 'system', content: system}, {role: 'user', content: `Write poem about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Write poem about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Poem about: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `Write poem about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 23. JOKE
async function cmd_joke(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Tell%20a%20funny%20joke%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Tell joke about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-70b-instruct', messages: [{role: 'system', content: system}, {role: 'user', content: `Funny joke about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Joke about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Joke about: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `Tell funny joke about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 24. QUOTE
async function cmd_quote(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Inspirational%20quote%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Give inspirational quote about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini', messages: [{role: 'system', content: system}, {role: 'user', content: `Quote about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Quote about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Quote about: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `Inspirational quote about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 25. FACTS
async function cmd_facts(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Give%205%20interesting%20facts%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Give 5 facts about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-70b-instruct', messages: [{role: 'system', content: system}, {role: 'user', content: `5 facts about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Facts about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct', {inputs: `5 facts about: ${prompt}`})).data?.[0]?.generated_text,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-70b-versatile', messages: [{role: 'system', content: system}, {role: 'user', content: `Give 5 interesting facts about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 26. RECIPE
async function cmd_recipe(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Recipe%20for%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Recipe for: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-70b-instruct', messages: [{role: 'system', content: system}, {role: 'user', content: `Give recipe for: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Recipe: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Recipe for: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `Recipe for: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 27. PLAN
async function cmd_plan(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Create%20a%20plan%20for%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Create detailed plan for: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini', messages: [{role: 'system', content: system}, {role: 'user', content: `Plan for: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Plan for: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct', {inputs: `Create plan for: ${prompt}`})).data?.[0]?.generated_text,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-70b-versatile', messages: [{role: 'system', content: system}, {role: 'user', content: `Create step by step plan for: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 28. EMAIL
async function cmd_email(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Write%20professional%20email%20about%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Write professional email about: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini', messages: [{role: 'system', content: system}, {role: 'user', content: `Email about: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Email: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Email about: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `Write professional email about: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 29. LOGO
async function cmd_logo(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/Logo%20design%20ideas%20for%3A%20${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: `Logo design ideas for: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-70b-instruct', messages: [{role: 'system', content: system}, {role: 'user', content: `Creative logo ideas for: ${prompt}`}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'meta-llama/llama-3.1-8b-instruct:free', messages: [{role: 'system', content: system}, {role: 'user', content: `Logo ideas for: ${prompt}`}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api.deepai.org/api/text-generator', new URLSearchParams({text: `Logo ideas for: ${prompt}`}), {headers: {'api-key': 'quickstart-QUdJIGlzIGF3ZXNvbWU'}})).data?.output,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: `5 logo design ideas for: ${prompt}`}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

// 30. CHAT
async function cmd_chat(prompt, system) {
  const apis = [
    async () => (await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?system=${encodeURIComponent(system)}`)).data,
    async () => (await axios.post('https://api.together.xyz/v1/chat/completions', {model: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]})).data?.choices?.[0]?.message?.content,
    async () => OR_HEADERS? (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini', messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]}, {headers: OR_HEADERS})).data?.choices?.[0]?.message?.content : null,
    async () => (await axios.post('https://openrouter.ai/api/v1/chat/completions', {model: 'openai/gpt-4o-mini:free', messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]})).data?.choices?.[0]?.message?.content,
    async () => (await axios.post('https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3-8B-Instruct', {inputs: prompt})).data?.[0]?.generated_text,
    async () => (await axios.post('https://api.groq.com/openai/v1/chat/completions', {model: 'llama-3.1-8b-instant', messages: [{role: 'system', content: system}, {role: 'user', content: prompt}]}, {headers: {'Authorization': `Bearer ${process.env.GROQ_API_KEY}`}, timeout: 20000})).data?.choices?.[0]?.message?.content
  ]
  return callAPI(apis)
}

export default async function executeAutonomousCommand(sock, { msg, from, sender }, botSettings) {
  try {
    const prefix = botSettings?.prefix?? botSettings?.bot_prefix?? '.'
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || ''

    if (!body ||!body.startsWith(prefix)) return

    const trimmed = body.slice(prefix.length).trim()
    const parts = trimmed.split(/\s+/)
    const cmd = parts[0]?.toLowerCase()?? ''
    const args = parts.slice(1)
    const argText = args.join(' ').trim()

    const brandName = getBrandName(botSettings)
    const quoted = getQuotedText(msg)
    const input = quoted || argText
    const userId = sender || from

    // MENU - BOX kama aihub.js
    if (['aihub3'].includes(cmd)) {
      await sock.sendMessage(from, { react: { text: '🎨', key: msg.key } })
      const menuText = `╭─⌈ 🎨 *AI HUB PART 3* ⌋
│ 📋 *Available Commands (prefix: ${prefix})*
│ 📖 ${prefix}story <topic> — Write story
│ 🎭 ${prefix}poem <topic> — Write poem
│ 😂 ${prefix}joke <topic> — Funny joke
│ 💬 ${prefix}quote <topic> — Inspirational quote
│ 📊 ${prefix}facts <topic> — 5 interesting facts
│ 🍳 ${prefix}recipe <dish> — Cooking recipe
│ 📅 ${prefix}plan <goal> — Create plan
│ 📧 ${prefix}email <topic> — Write email
│ 🎨 ${prefix}logo <brand> — Logo ideas
│ 💭 ${prefix}chat <message> — General chat
╰⊷ *Powered By ${brandName}*`
      return await sock.sendMessage(from, { text: menuText }, { quoted: msg })
    }

    if (!input) {
      return sock.sendMessage(from, { text: `❌ Usage: ${prefix}${cmd} <your message>` }, { quoted: msg })
    }

    const system = `You are AI assistant for ${brandName}. User: ${msg.pushName || 'User'}. Reply in user's language. Be creative and helpful.`

    await rct(sock, msg, '🧠')
    let result = null

        if (cmd === 'story') result = await cmd_story(input, system)
    else if (cmd === 'poem') result = await cmd_poem(input, system)
    else if (cmd === 'joke') result = await cmd_joke(input, system)
    else if (cmd === 'quote') result = await cmd_quote(input, system)
    else if (cmd === 'facts') result = await cmd_facts(input, system)
    else if (cmd === 'recipe') result = await cmd_recipe(input, system)
    else if (cmd === 'plan') result = await cmd_plan(input, system)
    else if (cmd === 'email') result = await cmd_email(input, system)
    else if (cmd === 'logo') result = await cmd_logo(input, system)
    else if (cmd === 'chat') result = await cmd_chat(input, system)

    if (!result) {
      await rct(sock, msg, '❌')
      return sock.sendMessage(from, { text: '> AI unavailable right now. Try again later.' }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: result }, { quoted: msg })
    await rct(sock, msg, '✅').catch(() => {})

  } catch (err) {
    console.error('[AIHUB3 ERROR]', err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Command error occurred.' }, { quoted: msg })
  }
}