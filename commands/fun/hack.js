// commands/fun/hacks.js
export const name = 'hacks'
export const alias = ['hack', 'hacker', 'fakehack']
export const category = 'Fun'
export const desc = 'Simulate hacking progress bar 10% to 100%'

const stages = [
  { percent: 10, text: 'Connecting to target...' },
  { percent: 20, text: 'Bypassing firewall...' },
  { percent: 30, text: 'Injecting payload...' },
  { percent: 40, text: 'Accessing database...' },
  { percent: 50, text: 'Extracting data...' },
  { percent: 60, text: 'Decrypting files...' },
  { percent: 70, text: 'Uploading backdoor...' },
  { percent: 80, text: 'Covering traces...' },
  { percent: 90, text: 'Finalizing exploit...' },
  { percent: 100, text: 'Access granted!' }
]

function buildBar(percent, brandName) {
  const filled = Math.floor(percent / 10)
  const empty = 10 - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  
  if (percent === 100) {
    return `╭─⌈ 💀 SYSTEM BREACH COMPLETE ⌋
│ ${bar} ${percent}%
│ ${stages[9].text}
│
│ Target compromised successfully
╰⊷ *Powered By ${brandName}*`
  }
  
  const currentStage = stages[Math.floor((percent - 1) / 10)]
  return `╭─⌈ 🔒 HACKING IN PROGRESS ⌋
│ ${bar} ${percent}%
│ ${currentStage.text}
│
│ Do not close this chat
╰⊷ *Powered By ${brandName}*`
}

export default async function hacks(sock, { msg, from, args }, botSettings) {
  try {
    const brandName = botSettings?.brand_name || botSettings?.botname || 'System'
    const target = args.join(' ') || 'Unknown Target'

    // Send initial message
    const { key } = await sock.sendMessage(from, {
      text: `╭─⌈ 🔒 INITIATING HACK ⌋
│ Target: ${target}
│ █░░░░░ 0%
│ Initializing...
│
╰⊷ *Powered By ${brandName}*`
    }, { quoted: msg })

    // Edit message through stages
    for (const stage of stages) {
      await new Promise(r => setTimeout(r, 1200)) // 1.2s delay
      
      try {
        await sock.sendMessage(from, {
          text: buildBar(stage.percent, brandName),
          edit: key
        })
      } catch (err) {
        console.log('[HACKS] Edit failed:', err.message)
        break
      }
    }

  } catch (error) {
    console.error('[HACKS ERROR]', error)
    await sock.sendMessage(from, {
      text: '❌ Hack simulation failed.'
    }, { quoted: msg }).catch(() => {})
  }
}