// commands/settings/aicfg.js
export const name = 'aicfg'
export const alias = ['aiconfig', 'aisett', 'ai']
export const category = 'Settings'
export const desc = 'Control AI: on/off, prompt, model for this instance'

export default async function aicfg(sock, { msg, from }, botSettings) {
  try {
    if (!botSettings.supabase ||!botSettings.instance_id) {
      return sock.sendMessage(from, { text: '> Database connection not ready.' }, { quoted: msg })
    }

    const instanceId = botSettings.instance_id
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
    const args = body.trim().split(' ')
    const subCommand = args[1]?.toLowerCase()
    const value = args.slice(2).join(' ').trim()

    const { data: settings } = await botSettings.supabase
     .from('b_settings')
     .select('ai_on, ai_prompt, ai_model, botname, brand_name')
     .eq('id', instanceId)
     .maybeSingle()

    const aiOn = settings?.ai_on || false
    const aiPrompt = settings?.ai_prompt || 'Not set'
    const aiModel = settings?.ai_model || 'deepseek/deepseek-chat'
    const botname = settings?.botname || 'Bot'
    const brandName = settings?.brand_name || botname

    // Hakuna subcommand = onyesha status + msaada
    if (!subCommand) {
      return await sock.sendMessage(from, {
        text: `╭─⌈ 🤖 *AI Control Panel* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ Status: ${aiOn? 'ON ✅' : 'OFF ❌'}
│ Model: ${aiModel}
│ Prompt: ${aiPrompt.substring(0, 80)}${aiPrompt.length > 80? '...' : ''}
│
│ Usage:
│ ${botSettings.prefix}aicfg on
│ ${botSettings.prefix}aicfg off
│ ${botSettings.prefix}aicfg prompt <your prompt here>
│ ${botSettings.prefix}aicfg model <model-name>
│
│ Examples:
│ ${botSettings.prefix}aicfg prompt You are Juma, phone seller...
│ ${botSettings.prefix}aicfg model anthropic/claude-3.5-sonnet
│ ${botSettings.prefix}aicfg model google/gemini-2.0-flash-exp
│
│ Variables: {botname} {owner_name} {owner_number} {brand_name}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // ON / OFF
    if (subCommand === 'on' || subCommand === 'off' || subCommand === 'enable' || subCommand === 'disable') {
      const newValue = ['on', 'enable'].includes(subCommand)

      if (newValue === aiOn) {
        return await sock.sendMessage(from, { text: `> AI is already ${subCommand === 'on'? 'ON' : 'OFF'}` }, { quoted: msg })
      }

      const { error } = await botSettings.supabase
       .from('b_settings')
       .upsert({ id: instanceId, ai_on: newValue, updated_at: new Date().toISOString() }, { onConflict: 'id' })

      if (error) return sock.sendMessage(from, { text: `> DB Error: ${error.message}` }, { quoted: msg })

      botSettings.ai_on = newValue

      return await sock.sendMessage(from, {
        text: `╭─⌈ ✅ *AI Status Updated* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ AI Status: ${newValue? 'ON ✅' : 'OFF ❌'}
│
│ ${newValue? 'AI will now reply to messages.' : 'AI stopped replying.'}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // PROMPT
    if (subCommand === 'prompt') {
      if (!value) {
        return await sock.sendMessage(from, {
          text: `╭─⌈ 📝 *Current AI Prompt* ⌋
│ ${aiPrompt}
│
│ Usage: ${botSettings.prefix}aicfg prompt <new prompt>
│ Variables: {botname} {owner_name} {owner_number} {brand_name}
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      const { error } = await botSettings.supabase
       .from('b_settings')
       .upsert({ id: instanceId, ai_prompt: value, updated_at: new Date().toISOString() }, { onConflict: 'id' })

      if (error) return sock.sendMessage(from, { text: `> DB Error: ${error.message}` }, { quoted: msg })

      botSettings.ai_prompt = value

      return await sock.sendMessage(from, {
        text: `╭─⌈ ✅ *Prompt Updated* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ Status: Applied instantly
│
│ New Prompt:
│ ${value.substring(0, 200)}${value.length > 200? '...' : ''}
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // MODEL
    if (subCommand === 'model') {
      if (!value) {
        return await sock.sendMessage(from, {
          text: `╭─⌈ 🧠 *Current AI Model* ⌋
│ ${aiModel}
│
│ Usage: ${botSettings.prefix}aicfg model <model-name>
│ Examples:
│ anthropic/claude-3.5-sonnet
│ openai/gpt-4o-mini
│ google/gemini-2.0-flash-exp
│ deepseek/deepseek-chat
│ meta-llama/llama-3.3-70b-instruct
│
│ Any OpenRouter model works. Change applies instantly.
╰⊷ *Powered By ${brandName}*`
        }, { quoted: msg })
      }

      if (value === aiModel) {
        return await sock.sendMessage(from, { text: `> Model is already set to ${aiModel}` }, { quoted: msg })
      }

      const { error } = await botSettings.supabase
       .from('b_settings')
       .upsert({ id: instanceId, ai_model: value, updated_at: new Date().toISOString() }, { onConflict: 'id' })

      if (error) return sock.sendMessage(from, { text: `> DB Error: ${error.message}` }, { quoted: msg })

      botSettings.ai_model = value

      return await sock.sendMessage(from, {
        text: `╭─⌈ ✅ *Model Updated* ⌋
│ Bot: ${botname}
│ Instance: ${instanceId}
│ Old Model: ${aiModel}
│ New Model: ${value}
│ Status: Applied instantly
│
│ AI will now use new model for all replies.
╰⊷ *Powered By ${brandName}*`
      }, { quoted: msg })
    }

    // Subcommand isiyo julikana
    return await sock.sendMessage(from, { text: `> Invalid subcommand. Use: on, off, prompt, model\nType ${botSettings.prefix}aicfg for help` }, { quoted: msg })

  } catch (err) {
    console.error(`[AICFG CMD ERROR]`, err.message)
    await sock.sendMessage(from, { text: '> Failed. Check database.' }, { quoted: msg })
  }
}