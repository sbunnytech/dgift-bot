export const name = 'businessconfig'
export const alias = ['bconfig', 'bc', 'bizconfig']
export const category = 'Settings'
export const desc = 'Control Business AI: on/off, model, scope, special groups/people'

async function getConfig(botSettings) {
  const { data } = await botSettings.supabase
   .from('b_settings')
   .select('ai_on, ai_model, chatbot_scope, allowed_groups, allowed_dms, ai_me, ai_prompt, botname, owner_name, brand_name')
   .eq('id', botSettings.instance_id)
   .maybeSingle()
  return data || {}
}

async function updateConfig(botSettings, update) {
  const { error } = await botSettings.supabase
   .from('b_settings')
   .upsert({ id: botSettings.instance_id, ...update, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  return error
}

function printBox(title, lines, botname) {
  let text = `╭─⌈ 🤖 *${title}* ⌋\n`
  lines.forEach(l => text += `│ ${l}\n`)
  text += `╰⊷ *${botname}*`
  return text
}

export default async function businessconfig(sock, { msg, from, sender, isAdmin }, botSettings) {
  try {
    if (!botSettings.supabase) {
      return sock.sendMessage(from, { text: '> Database not ready' }, { quoted: msg })
    }
    if (!isAdmin) {
      return sock.sendMessage(from, { text: '> Owner/Admin only' }, { quoted: msg })
    }

    const prefix = botSettings.prefix || '.'
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ').slice(1)
    const action = args[0]?.toLowerCase()
    const value = args.slice(1).join(' ')

    const config = await getConfig(botSettings)

    // Kama hakuna action, print all settings
    if (!action) {
      await sock.sendMessage(from, { react: { text: '⚙️', key: msg.key } })
      const lines = [
        `AI Status: ${config.ai_on? 'ON ✅' : 'OFF ❌'}`,
        `Model: ${config.ai_model || 'deepseek/deepseek-chat'}`,
        `Scope: ${config.chatbot_scope || 'global'}`,
        `AI Me Mode: ${config.ai_me? 'ON - Speaks as owner' : 'OFF - Assistant mode'}`,
        `Special Groups: ${config.allowed_groups?.length || 0}`,
        `Special People: ${config.allowed_dms?.length || 0}`,
        ``,
        `Usage:`,
        `${prefix}bc on/off`,
        `${prefix}bc model <model_name>`,
        `${prefix}bc scope <global|dm_only|group_only|special_group_only|special_dm_only>`,
        `${prefix}bc aime <on/off>`,
        `${prefix}bc addgroup <group_jid>`,
        `${prefix}bc delgroup <group_jid>`,
        `${prefix}bc adduser <number>`,
        `${prefix}bc deluser <number>`
      ]
      return sock.sendMessage(from, { text: printBox('Business AI Config', lines, botSettings.botname) }, { quoted: msg })
    }

    // ON/OFF
    if (action === 'on' || action === 'off') {
      const newVal = action === 'on'
      if (config.ai_on === newVal) {
        await sock.sendMessage(from, { react: { text: '⚠️', key: msg.key } })
        return sock.sendMessage(from, { text: `> AI is already ${action}` }, { quoted: msg })
      }
      const err = await updateConfig(botSettings, { ai_on: newVal })
      if (err) throw err
      botSettings.ai_on = newVal
      await sock.sendMessage(from, { react: { text: newVal? '✅' : '❌', key: msg.key } })
      return sock.sendMessage(from, { text: `> Business AI: ${newVal? 'ON ✅' : 'OFF ❌'}` }, { quoted: msg })
    }

    // MODEL
    if (action === 'model') {
      if (!value) return sock.sendMessage(from, { text: `> Usage: ${prefix}bc model deepseek/deepseek-chat` }, { quoted: msg })
      const err = await updateConfig(botSettings, { ai_model: value })
      if (err) throw err
      botSettings.ai_model = value
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> Model set to: ${value}` }, { quoted: msg })
    }

    // SCOPE
    if (action === 'scope') {
      const valid = ['global', 'dm_only', 'group_only', 'special_group_only', 'special_dm_only', 'special_dms_only']
      if (!valid.includes(value)) {
        return sock.sendMessage(from, { text: `> Valid: ${valid.join(', ')}` }, { quoted: msg })
      }
      const err = await updateConfig(botSettings, { chatbot_scope: value })
      if (err) throw err
      botSettings.chatbot_scope = value
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> Scope set to: ${value}` }, { quoted: msg })
    }

    // AI ME MODE
    if (action === 'aime') {
      const newVal = ['on', 'enable', '1'].includes(value)
      const err = await updateConfig(botSettings, { ai_me: newVal })
      if (err) throw err
      botSettings.ai_me = newVal
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> AI Me Mode: ${newVal? 'ON - Speaks as owner' : 'OFF - Assistant'}` }, { quoted: msg })
    }

    // ADD/DEL GROUP
    if (action === 'addgroup') {
      const groups = config.allowed_groups || []
      if (groups.includes(value)) return sock.sendMessage(from, { text: '> Group already added' }, { quoted: msg })
      groups.push(value)
      const err = await updateConfig(botSettings, { allowed_groups: groups })
      if (err) throw err
      botSettings.allowed_groups = groups
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> Group added. Total: ${groups.length}` }, { quoted: msg })
    }
    if (action === 'delgroup') {
      const groups = (config.allowed_groups || []).filter(g => g !== value)
      const err = await updateConfig(botSettings, { allowed_groups: groups })
      if (err) throw err
      botSettings.allowed_groups = groups
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> Group removed. Total: ${groups.length}` }, { quoted: msg })
    }

    // ADD/DEL USER
    if (action === 'adduser') {
      const users = config.allowed_dms || []
      const num = value.replace(/[^0-9]/g, '')
      if (users.includes(num)) return sock.sendMessage(from, { text: '> User already added' }, { quoted: msg })
      users.push(num)
      const err = await updateConfig(botSettings, { allowed_dms: users })
      if (err) throw err
      botSettings.allowed_dms = users
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> User ${num} added. Total: ${users.length}` }, { quoted: msg })
    }
    if (action === 'deluser') {
      const num = value.replace(/[^0-9]/g, '')
      const users = (config.allowed_dms || []).filter(u => u !== num)
      const err = await updateConfig(botSettings, { allowed_dms: users })
      if (err) throw err
      botSettings.allowed_dms = users
      await sock.sendMessage(from, { react: { text: '✅', key: msg.key } })
      return sock.sendMessage(from, { text: `> User ${num} removed. Total: ${users.length}` }, { quoted: msg })
    }

    await sock.sendMessage(from, { text: `> Unknown action. Use ${prefix}bc` }, { quoted: msg })

  } catch (err) {
    console.error('[BUSINESSCONFIG ERROR]', err.message)
    await sock.sendMessage(from, { react: { text: '❌', key: msg.key } })
    await sock.sendMessage(from, { text: '> Failed. Check DB' }, { quoted: msg })
  }
}