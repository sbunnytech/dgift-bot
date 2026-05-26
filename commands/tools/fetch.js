// commands/tools/fetch.js
import { exec } from 'child_process'
import { promisify } from 'util'
import http from 'http'
import https from 'https'

const execAsync = promisify(exec)

export const name = 'fetch'
export const alias = ['get', 'http', 'curl']
export const category = 'Tools'
export const desc = 'Fetch data from URL with 50 fallbacks'

export default async function fetchCmd(sock, { msg, from, sender }, botSettings) {
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
    text: `> Fetching ${method} ${url}... Trying 50 methods`
  }, { quoted: msg })

  const timeout = 15000
  let result = null
  let methodUsed = 'none'

  // Fallback chain: 20 API methods + 30 system methods
  const fetchers = [
    // 1-20 API fallbacks
    async () => { methodUsed = 'fetch'; return await globalFetch(url, method, timeout) },
    async () => { methodUsed = 'undici'; return await tryImport('undici', async (m) => m.fetch(url, { method, signal: AbortSignal.timeout(timeout) })) },
    async () => { methodUsed = 'node-fetch'; return await tryImport('node-fetch', async (m) => m.default(url, { method, timeout })) },
    async () => { methodUsed = 'axios'; return await tryImport('axios', async (m) => m({ url, method, timeout })) },
    async () => { methodUsed = 'got'; return await tryImport('got', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'got-scraping'; return await tryImport('got-scraping', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'ky'; return await tryImport('ky', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'superagent'; return await tryImport('superagent', async (m) => m(method, url).timeout(timeout)) },
    async () => { methodUsed = 'request-promise'; return await tryImport('request-promise', async (m) => m({ url, method, timeout, resolveWithFullResponse: true })) },
    async () => { methodUsed = 'bent'; return await tryImport('bent', async (m) => m(method)(url)) },
    async () => { methodUsed = 'urllib'; return await tryImport('urllib', async (m) => m.request(url, { method, timeout })) },
    async () => { methodUsed = 'got@11'; return await tryImport('got', async (m) => m.extend({ timeout }) (url, { method })) },
    async () => { methodUsed = 'node-fetch@2'; return await tryImport('node-fetch@2', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'got@12'; return await tryImport('got', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'wretch'; return await tryImport('wretch', async (m) => m(url).method(method).timeout(timeout).fetch()) },
    async () => { methodUsed = 'redaxios'; return await tryImport('redaxios', async (m) => m({ url, method, timeout })) },
    async () => { methodUsed = 'ofetch'; return await tryImport('ofetch', async (m) => m(url, { method, timeout })) },
    async () => { methodUsed = 'unfetch'; return await tryImport('unfetch', async (m) => m(url, { method })) },
    async () => { methodUsed = 'isomorphic-fetch'; return await tryImport('isomorphic-fetch', async () => fetch(url, { method })) },
    async () => { methodUsed = 'make-fetch-happen'; return await tryImport('make-fetch-happen', async (m) => m(url, { method, timeout })) },

    // 21-50 System fallbacks
    async () => { methodUsed = 'https-native'; return await httpsGet(url, method, timeout) },
    async () => { methodUsed = 'http-native'; return await httpGet(url, method, timeout) },
    async () => { methodUsed = 'curl'; return await execFetch(`curl -s -L -m 15 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-HEAD'; return await execFetch(`curl -s -I -m 15 "${url}"`) },
    async () => { methodUsed = 'wget'; return await execFetch(`wget -qO- --timeout=15 "${url}"`) },
    async () => { methodUsed = 'wget-HEAD'; return await execFetch(`wget --spider -S --timeout=15 "${url}" 2>&1`) },
    async () => { methodUsed = 'curl-k'; return await execFetch(`curl -k -s -L -m 15 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-H-UA'; return await execFetch(`curl -s -L -m 15 -H "User-Agent: DGIFT-BOT" -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-compressed'; return await execFetch(`curl -s -L -m 15 --compressed -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-http2'; return await execFetch(`curl -s -L -m 15 --http2 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-http1.1'; return await execFetch(`curl -s -L -m 15 --http1.1 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-proxy'; return await execFetch(`curl -s -L -m 15 -x socks5://localhost:9050 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-dump'; return await execFetch(`curl -s -D -o /dev/null -m 15 "${url}"`) },
    async () => { methodUsed = 'wget-no-check'; return await execFetch(`wget -qO- --no-check-certificate --timeout=15 "${url}"`) },
    async () => { methodUsed = 'curl-resolve'; return await execFetch(`curl -s -L -m 15 --resolve example.com:443:1.1.1.1 "${url}"`) },
    async () => { methodUsed = 'curl-max-time'; return await execFetch(`curl -s -L --max-time 15 -X ${method} "${url}"`) },
    async () => { methodUsed = 'curl-retry'; return await execFetch(`curl -s -L --retry 2 --retry-delay 1 -m 15 "${url}"`) },
    async () => { methodUsed = 'curl-fail'; return await execFetch(`curl -s -f -L -m 15 "${url}"`) },
    async () => { methodUsed = 'curl-silent'; return await execFetch(`curl -sSL -m 15 "${url}"`) },
    async () => { methodUsed = 'curl-v'; return await execFetch(`curl -v -s -L -m 15 "${url}" 2>&1`) },
    async () => { methodUsed = 'wget-timeout'; return await execFetch(`wget -qO- --timeout=15 --tries=1 "${url}"`) },
    async () => { methodUsed = 'wget-user-agent'; return await execFetch(`wget -qO- --user-agent="DGIFT-BOT" --timeout=15 "${url}"`) },
    async () => { methodUsed = 'curl-range'; return await execFetch(`curl -s -L -m 15 -r 0-4000 "${url}"`) },
    async () => { methodUsed = 'curl-head-nofollow'; return await execFetch(`curl -s -I -m 15 --no-location "${url}"`) },
    async () => { methodUsed = 'curl-verbose'; return await execFetch(`curl -v -s -L -m 15 "${url}" 2>&1`) },
    async () => { methodUsed = 'wget-debug'; return await execFetch(`wget -d -qO- --timeout=15 "${url}" 2>&1`) },
    async () => { methodUsed = 'curl-libcurl'; return await execFetch(`curl -s -L -m 15 --libcurl - "${url}"`) },
    async () => { methodUsed = 'curl-trace'; return await execFetch(`curl --trace-ascii -s -L -m 15 "${url}"`) },
    async () => { methodUsed = 'wget-spider'; return await execFetch(`wget --spider -S --timeout=15 "${url}" 2>&1`) },
    async () => { methodUsed = 'curl-fail-early'; return await execFetch(`curl -s -f --fail-early -L -m 15 "${url}"`) }
  ]

  for (const fetcher of fetchers) {
    try {
      result = await fetcher()
      if (result && (result.status || result.statusCode || result.body!== undefined)) break
    } catch (e) {
      continue
    }
  }

  if (!result) {
    return sock.sendMessage(from, {
      text: `> ❌ All 50 methods failed. URL unreachable or blocked.`
    }, { quoted: msg })
  }

  const status = result.status || result.statusCode || 200
  const statusText = result.statusText || 'OK'
  const headers = result.headers || {}
  const body = method!== 'HEAD'? (result.body || result.data || '').toString() : ''
  const bodySize = Buffer.byteLength(body, 'utf8')
  const timeTaken = result.time || 0

  const bodyTrim = body.length > 4000? body.substring(0, 4000) + '\n\n[...truncated]' : body
  const statusEmoji = status >= 200 && status < 300? '✅' : status >= 400? '❌' : '⚠️'

  const caption =
`╭─⌈ 🌐 *FETCH RESULT* ⌋
│ URL: ${url}
│ Method: ${method}
│ Used: ${methodUsed}
│ Status: ${statusEmoji} ${status} ${statusText}
│ Time: ${timeTaken}ms
│ Size: ${(bodySize / 1024).toFixed(2)} KB
╰─────────────────

${bodyTrim? `╭─⌈ 📄 *BODY* ⌋\n${bodyTrim}\n╰─────────────────` : ''}`

  await sock.sendMessage(from, {
    text: caption,
    edit: loadingMsg.key
  })

  await sock.sendMessage(from, { react: { text: '✅', key: loadingMsg.key } }).catch(() => {})
}

// Helper functions
async function globalFetch(url, method, timeout) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  const start = Date.now()
  const res = await fetch(url, { method, signal: controller.signal })
  clearTimeout(id)
  const body = await res.text()
  return { status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers.entries()), body, time: Date.now() - start }
}

async function tryImport(pkg, fn) {
  try {
    const mod = await import(pkg)
    const start = Date.now()
    const res = await fn(mod)
    const body = typeof res.text === 'function'? await res.text() : res.body || res.data || ''
    return { status: res.status || res.statusCode, body, time: Date.now() - start }
  } catch { return null }
}

async function httpsGet(url, method, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const req = https.request(url, { method }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data, time: Date.now() - start }))
    })
    req.setTimeout(timeout, () => req.destroy())
    req.on('error', reject)
    req.end()
  })
}

async function httpGet(url, method, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const req = http.request(url, { method }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data, time: Date.now() - start }))
    })
    req.setTimeout(timeout, () => req.destroy())
    req.on('error', reject)
    req.end()
  })
}

async function execFetch(cmd) {
  const start = Date.now()
  const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 })
  const output = stdout || stderr
  return { status: 200, body: output, time: Date.now() - start }
}