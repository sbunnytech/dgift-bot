// commands/tools/fetch.js
export const name = 'fetch'
export const alias = ['get', 'http', 'curl']
export const category = 'Tools'
export const desc = 'Fetch data from URL with method, headers and timeout'

export default async function fetchCmd(sock, { msg, from, sender }, botSettings) {
  try {
    await sock.sendMessage(from, { react: { text: '🌐', key: msg.key } })

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = text.split(' ').slice(1)

    if (!args[0]) {
      return sock.sendMessage(from, {
        text: `> Usage: ${botSettings.prefix}fetch <url> [method]
> Example: ${botSettings.prefix}fetch https://api.github.com/users/username
> Methods: GET, POST, HEAD. Default: GET`
      }, { quoted: msg })
    }

    const url = args[0]
    const method = (args[1] || 'GET').toUpperCase()
    const allowedMethods = ['GET', 'POST', 'HEAD']

    if (!allowedMethods.includes(method)) {
      return sock.sendMessage(from, {
        text: `> ❌ Invalid method. Use: GET, POST, HEAD`
      }, { quoted: msg })
    }

    const loadingMsg = await sock.sendMessage(from, {
      text: `> Fetching ${method} ${url}...`
    }, { quoted: msg })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15s timeout

    const startTime = Date.now()
    const res = await fetch(url, {
      method: method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'DGIFT-BOT/1.0'
      }
    }).catch(err => {
      clearTimeout(timeout)
      throw err
    })

    clearTimeout(timeout)
    const timeTaken = Date.now() - startTime

    const status = res.status
    const statusText = res.statusText
    const headers = Object.fromEntries(res.headers.entries())
    const contentType = headers['content-type'] || 'unknown'

    let body = ''
    let bodySize = 0

    if (method!== 'HEAD') {
      const textBody = await res.text()
      bodySize = Buffer.byteLength(textBody, 'utf8')

      // Limit body to 4000 chars to avoid WA limit
      body = textBody.length > 4000
       ? textBody.substring(0, 4000) + '\n\n[...truncated]'
        : textBody
    }

    const statusEmoji = status >= 200 && status < 300? '✅' : status >= 400? '❌' : '⚠️'

    const caption =
`╭─⌈ 🌐 *FETCH RESULT* ⌋
│ URL: ${url}
│ Method: ${method}
│ Status: ${statusEmoji} ${status} ${statusText}
│ Time: ${timeTaken}ms
│ Size: ${(bodySize / 1024).toFixed(2)} KB
│ Type: ${contentType}
╰─────────────────

╭─⌈ 📋 *HEADERS* ⌋
${Object.entries(headers).slice(0, 8).map(([k, v]) => `│ ${k}: ${v}`).join('\n')}
╰─────────────────

${body? `╭─⌈ 📄 *BODY* ⌋\n${body}\n╰─────────────────` : ''}`

    await sock.sendMessage(from, {
      text: caption,
      edit: loadingMsg.key
    })

    await sock.sendMessage(from, { react: { text: '✅', key: loadingMsg.key } }).catch(() => {})

  } catch (e) {
    console.error('[FETCH ERROR]', e.message)

    let errorMsg = '> ❌ Fetch failed'
    if (e.name === 'AbortError') {
      errorMsg = '> ❌ Request timeout after 15s'
    } else if (e.cause?.code === 'ENOTFOUND') {
      errorMsg = '> ❌ Domain not found'
    } else if (e.message.includes('fetch failed')) {
      errorMsg = '> ❌ Connection failed'
    }

    await sock.sendMessage(from, { text: errorMsg }, { quoted: msg })
  }
}