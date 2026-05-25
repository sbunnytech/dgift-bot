#dgift-bot

<p align="center">
  <img src="https://i.ibb.co/Mdg2Fkd/file-00000000f41871fdb744b8a6b7b612fa.png" alt="DGIFT BOT" width="200"/>
</p>

<p align="center">
  <b>Advanced WhatsApp Bot powered by Baileys + Supabase</b><br>
  QR Code • Pair Code • Auto Reconnect • Realtime Settings • Session Backup
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.11.1-green?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/Baileys-6.7.18-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Supabase-Realtime-3ECF8E?style=for-the-badge&logo=supabase" />
  <img src="https://img.shields.io/badge/License-ISC-yellow?style=for-the-badge" />
</p>

---

📖 Overview

`dgift-bot` is a feature-rich WhatsApp automation bot built with `@whiskeysockets/baileys`. It supports QR scanning, Pair Code login, Supabase cloud session backup, and realtime command prefix updates without restarting.

> **Source Code:** Based on `Bunny MD`  
> **Repository Owner:** Lupin Starnley  
> **Current Build:** dgift-bot by obashjalash-droid

---

✨ Features

| Feature | Status | Description |
| --- | --- | --- |
| **QR + Pair Code** | ✅ | Login via QR scan or 8-digit pairing code |
| **Auto Reconnect** | ✅ | Smart reconnect with exponential backoff |
| **Session Backup** | ✅ | Full session zipped to Supabase `bu_sessions` |
| **Realtime Settings** | ✅ | Change prefix, antilink, autoread live from Supabase |
| **Anti-Bad-MAC** | ✅ | Stable connection, no "bad MAC" errors |
| **Group Admin Tools** | ✅ | tagall, hidetag, kick, promote, demote, antilink |
| **Observers** | ✅ | antidelete, autoview, autogreet, anticall |
| **Express Dashboard** | ✅ | `/pair.html` with Discord-style UI |

---

🚀 Quick Deploy

1. Environment Variables

Create `.env` file:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
PORT=3000
2. Install Dependencies
npm install
3. Database Setup

Run this SQL in Supabase SQL Editor to create required tables + enable Realtime:
-- ============================================
-- DGIFT BOT - COMPLETE DATABASE SETUP
-- ============================================

-- 1. DROP OLD TABLES IF EXIST
DROP TABLE IF EXISTS public.b_settings CASCADE;
DROP TABLE IF EXISTS public.bu_sessions CASCADE;

-- 2. CREATE b_settings TABLE
CREATE TABLE public.b_settings (
  id TEXT PRIMARY KEY DEFAULT 'DGIFT_DEFAULT',
  botname TEXT NOT NULL DEFAULT 'dgift-bot',
  owner_number TEXT NOT NULL DEFAULT '254748548334',
  owner_name TEXT NOT NULL DEFAULT 'obashjalash-droid',
  prefix TEXT NOT NULL DEFAULT '.',
  public_mode BOOLEAN NOT NULL DEFAULT false,
  antilink BOOLEAN NOT NULL DEFAULT false,
  antispam BOOLEAN NOT NULL DEFAULT false,
  autoread BOOLEAN NOT NULL DEFAULT false,
  autotyping BOOLEAN NOT NULL DEFAULT false,
  autoviewstatus BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CREATE bu_sessions TABLE
CREATE TABLE public.bu_sessions (
  id TEXT PRIMARY KEY DEFAULT 'full_session',
  data TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ENABLE RLS + POLICIES
ALTER TABLE public.b_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bu_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for service role" ON public.b_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Enable read for anon" ON public.b_settings
  FOR SELECT TO anon USING (true);

CREATE POLICY "Enable all for service role" ON public.bu_sessions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. INSERT DEFAULT DATA
INSERT INTO public.b_settings (
  id, botname, owner_name, owner_number, prefix,
  public_mode, antilink, antispam, autoread, autotyping, autoviewstatus
) VALUES (
  'DGIFT_DEFAULT', 'dgift-bot', 'obashjalash-droid', '254748548334', '.',
  false, false, false, false, false, false
);

INSERT INTO public.bu_sessions (id, data) 
VALUES ('full_session', NULL);

-- 6. ENABLE REALTIME
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.b_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bu_sessions;

-- 7. AUTO UPDATE TIMESTAMP TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_b_settings_updated_at
  BEFORE UPDATE ON public.b_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bu_sessions_updated_at
  BEFORE UPDATE ON public.bu_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
*After running SQL:* Go to `Database` → `Replication` → Enable `b_settings` and `bu_sessions`.

4. Start Bot
npm start
Visit `http://localhost:3000/pair.html` to connect WhatsApp.

---

📂 Project Structure
dgift-bot/
├── commands/          # All bot commands
├── observers/         # Auto handlers: antidelete, autogreet
├── lib/
│   ├── router.js      # Command loader + message handler
│   └── supabase.js    # Supabase client + realtime
├── public/
│   └── pair.html      # Discord-style pairing UI
├── index.js           # Main bot file
├── package.json
└── README.md
---

⚙️ Configuration

Edit settings live in Supabase `b_settings` table:
Column	Type	Default	Description
`prefix`	TEXT	`.`	Command prefix
`antilink`	BOOLEAN	false	Auto-delete group links
`autoread`	BOOLEAN	false	Mark messages as read
`autoviewstatus`	BOOLEAN	false	Auto view WhatsApp status
Changes apply instantly without restart via Supabase Realtime.

---

🛠️ Commands

Default prefix: `.`
.menu          - Show all commands
.ping          - Check bot speed
.tagall        - Mention all group members
.hidetag       - Hidden tag message
.autoread on   - Enable auto read
---

📝 License

ISC License © 2026

*Credits:*  
Original Source: Bunny MD by Lupin Starnley  
Current Build: dgift-bot by obashjalash-droid

---

📞 Support

- *Owner:* obashjalash-droid
- *WhatsApp:* https://wa.me/254748548334
- *Powered by:* Dgift Bot

<p align="center">
  <b>⭐ Star this repo if you find it useful!</b>
</p>