import os from 'os'
import { getAllCommands } from '../../lib/router.js'

export const name = 'commands'
export const alias = ['menu', 'menu2', 'help']
export const category = 'General'
export const desc = 'Displays the complete system interface panel dynamically categorized with server statistics'

async function getBrandName(botSettings) {
  if (!botSettings?.supabase) return botSettings?.botname || 'Bot'
  const instanceId = botSettings.instance_id || 'DGIFT_DEFAULT'
  const { data } = await botSettings.supabase
    .from('b_settings')
    .select('brand_name, botname')
    .eq('id', instanceId)
    .maybeSingle()
  return data?.brand_name || data?.botname || 'Bot'
}

export default async function executeAutonomousCommand(sock, { msg, from, pushName, sender }, botSettings) {
  try {
    await sock.sendMessage(from, { react: { text: '🌀', key: msg.key } })

    const totalUptimeSeconds = process.uptime()
    const hours = Math.floor(totalUptimeSeconds / 3600)
    const minutes = Math.floor((totalUptimeSeconds % 3600) / 60)
    const seconds = Math.floor(totalUptimeSeconds % 60)
    const uptimeString = `${hours}h ${minutes}m ${seconds}s`

    const totalMemory = os.totalmem()
    const freeMemory = os.freem()
    const usedRatio = (totalMemory - freeMemory) / totalMemory
    const ramBar = '█'.repeat(Math.round(usedRatio * 10)) + '▒'.repeat(10 - Math.round(usedRatio * 10))
    const ramPercent = Math.round(usedRatio * 100)

    const platform = os.platform() === 'linux'? '🐧 Linux' : '🪟 Windows'
    const userIdentity = pushName || sender.split('@')[0]

    const allCommands = getAllCommands()
    const commandCatalog = {}

    for (const cmd of allCommands) {
      const category = (cmd.category || 'Uncategorized').toUpperCase()
      if (!commandCatalog[category]) commandCatalog[category] = []
      commandCatalog[category].push(cmd.name)
    }

    const prefix = botSettings.prefix || '!'
    const botName = botSettings.botname || 'DGIFT BOT'
    const ownerName = botSettings.owner_name || 'Owner'
    const brandName = await getBrandName(botSettings)
    const footerText = `*Powered By ${brandName}*`

    let menuText = `╭──⌈ ${botName} ⌋
│ User: ${userIdentity}
│ Owner: ${ownerName}
│ Prefix: [ ${prefix} ]
│ Platform: ${platform}
│ Uptime: ${uptimeString}
│ RAM: ${ramBar} ${ramPercent}%
╰────────────────\n\n`

    for (const cat of Object.keys(commandCatalog).sort()) {
      menuText += `╭──⌈ ${cat} ⌋\n`
      commandCatalog[cat].sort().forEach(cmd => {
        menuText += `│ ${prefix}${cmd}\n`
      })
      menuText += `╰────────────────\n\n`
    }

    menuText += `${footerText}`

    const imageUrl =
      process.env.IMAGE_URL ||
      botSettings.startup_image ||
      botSettings.menu_url ||
      'https://i.ibb.co/1tM9QHF9/IMG-20260525-WA0076.jpg'

    await sock.sendMessage(from, {
      image: { url: imageUrl },
      caption: menuText
    }, { quoted: msg })

  } catch (e) {
    console.error("Menu Error:", e.message)
    await sock.sendMessage(from, { text: "Menu failed to load. Try again." }, { quoted: msg })
  }
}