# Make a Quote — Discord Bot

> **Cinematic quote cards for Discord.** B&W portrait on the left fading into a dark background, quote text, author name, and who quoted it — all in one image, generated in seconds.

---

## What it looks like

```
┌─────────────────────────────────────────────────────────────┐
│  ████  │                                                     │
│  ████  │  "The only way to do great work                    │
│  B&W   │   is to love what you do."                         │
│  avatar│                                                     │
│  ────  │  — Steve Jobs                                       │
│  fades │  WWDC 2005 #speeches · 12 Jun 2005                 │
│  →     │                              Quoted by Alice  ↙    │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick-start (the short version)

```
1. Create a Discord Application and get the bot token + client ID
2. Enable the Message Content privileged intent
3. git clone https://github.com/finwuh26/makeaquote
4. npm install
5. cp .env.example .env  →  fill in token + client ID
6. npm run deploy         →  register slash commands
7. npm start              →  bot is online
```

---

## Full setup guide (step by step)

### Step 1 — Create a Discord Application

1. Open the **[Discord Developer Portal](https://discord.com/developers/applications)** (you must be logged in to Discord in your browser).
2. Click the blue **"New Application"** button in the top-right.
3. Give it a name — e.g. `Make a Quote` — then click **"Create"**.

---

### Step 2 — Create the Bot and copy its token

1. In the left sidebar click **"Bot"**.
2. Click **"Add Bot"** → **"Yes, do it!"**
3. Under **"TOKEN"**, click **"Reset Token"** → confirm → then click **"Copy"**.
   > ⚠️ **Keep this token secret!** Anyone who has it can control your bot.
   > If it ever leaks, come back here and click "Reset Token" immediately.
4. Paste the token somewhere safe for now (you will add it to `.env` in Step 5).

---

### Step 3 — Copy your Client ID

1. In the left sidebar click **"OAuth2"** → **"General"**.
2. Under **"Client ID"**, click **"Copy"**.
3. Paste it somewhere safe (also needed in `.env`).

---

### Step 4 — Enable the Message Content Intent

> This is required for the reply + @mention feature.  
> Without it the bot still works for slash commands and right-click, just not @mentions.

1. In the left sidebar click **"Bot"**.
2. Scroll down to **"Privileged Gateway Intents"**.
3. Toggle **"Message Content Intent"** → **ON**.
4. Click **"Save Changes"**.

---

### Step 5 — Download and install the bot

You need **Node.js v18 or newer**.  
If you are not sure whether you have it: open a terminal/command prompt and run `node --version`.  
If it says `v18.x` or higher you are good.  If not, download it from [nodejs.org](https://nodejs.org).

```bash
# Clone the repository
git clone https://github.com/finwuh26/makeaquote.git
cd makeaquote

# Install dependencies (this may take a minute)
npm install
```

---

### Step 6 — Set up the .env file

```bash
# Copy the example file
cp .env.example .env
```

Now open `.env` in any text editor (Notepad, VS Code, etc.) and fill it in:

```env
# Paste the bot token from Step 2
DISCORD_TOKEN=paste_your_token_here

# Paste the Client ID from Step 3
CLIENT_ID=paste_your_client_id_here

# Optional: a Guild (server) ID to register commands instantly during testing
# Leave blank to register globally (takes up to 1 hour to propagate)
GUILD_ID=

# Optional: API Ninjas key for live /randomquote categories (https://api-ninjas.com)
# Leave blank to use the built-in fallback quote list
QUOTES_API_KEY=
```

> **Tip:** To find your Guild ID — right-click the server icon in Discord → "Copy Server ID".  
> (You need Developer Mode on: Settings → Advanced → Developer Mode → ON)

---

### Step 7 — Invite the bot to your server

1. In the Developer Portal go to **"OAuth2"** → **"URL Generator"**.
2. Under **Scopes** tick:
   - `bot`
   - `applications.commands`
3. Under **Bot Permissions** tick:
   - `Read Messages / View Channels`
   - `Send Messages`
   - `Attach Files`
   - `Read Message History`
4. Copy the generated URL at the bottom and open it in your browser.
5. Select your server → **"Authorise"** → complete the CAPTCHA.

---

### Step 8 — Deploy the slash commands

Open a terminal in the `makeaquote` folder and run:

```bash
# Register commands globally (shows everywhere — takes up to 1 hour):
npm run deploy

# Or register only to one specific server (instant — good for testing):
GUILD_ID=123456789012345678 npm run deploy
```

> You only need to run this once (or again whenever you add/change a command).

---

### Step 9 — Start the bot

```bash
npm start
```

You should see:
```
  📦 Loaded command: quote
  📦 Loaded command: customquote
  ...
  ✅ Logged in as Make a Quote#1234 (123456789012345678)
```

Your bot is now online. 🎉

---

## How to use it

### Method 1 — Right-click a message
Right-click any message → hover **"Apps"** → click **"Make a Quote"**

### Method 2 — Slash command
```
/quote <message_id>
```
To get a message ID: right-click the message → "Copy Message ID"  
(Developer Mode must be on — see Step 6 tip above)

### Method 3 — Reply + mention
Reply to any message and @mention the bot in your reply.  
The bot will quote the message you replied to.

### Method 4 — Custom quote
```
/customquote text:"Your quote here" author:"Author Name"
```

### Method 5 — Random quote
```
/randomquote
/randomquote category:inspirational
```

---

## Interactive customisation

Every generated quote has three rows of buttons underneath it:

| Row | Controls | What they do |
|---|---|---|
| 1 | Theme dropdown | Dark / Light / Midnight / Ocean / Sunset / Forest |
| 2 | Font buttons | Serif · Sans-serif · Monospace (active = green) |
| 3 | Layout toggles | 👤 Avatar · 🕐 Timestamp · 🏠 Server (green = on, red = off) |

Clicking any button regenerates the image instantly in-place — no new message needed.

---

## Personal & server settings dashboard

Run `/settings user` to open **your personal preferences panel**.  
Changes are saved and applied to every quote you create.

Run `/settings server` *(requires Manage Server permission)* to set **server-wide defaults** and configure the **Quote Redirect** channel.

### Setting up a Quote Redirect channel

All quotes generated on your server can be automatically forwarded to a single channel:

1. Run `/settings server`
2. Click **📢 Set Redirect Channel**
3. Select the channel from the picker
4. Click **← Back to Settings**

Every quote — from any member, via any method — is forwarded there automatically.

---

## Themes

| Name | Look |
|---|---|
| `dark` 🌑 | Very dark navy (default) |
| `light` ☀️ | Off-white |
| `midnight` 🌙 | Pure black |
| `ocean` 🌊 | Deep blue |
| `sunset` 🌅 | Deep purple-pink |
| `forest` 🌲 | Deep green |

---

## All commands

| Command | Description |
|---|---|
| `/quote <message_id>` | Quote a message from the current channel |
| `/customquote <text> <author>` | Create a quote from any text |
| `/randomquote [category]` | Random inspirational quote |
| `/settings user` | Your personal preferences dashboard |
| `/settings server` | Server settings + redirect channel |
| `/help` | Command reference in Discord |

---

## Troubleshooting

**"Unknown interaction" or commands not appearing**
→ You haven't deployed the commands yet. Run `npm run deploy`.  
→ If you used `GUILD_ID`, the commands only show in that server.  
→ Global commands can take up to 1 hour to appear in all servers.

**"Missing permissions" error in Discord**
→ Re-invite the bot using the URL Generator in Step 7 with all the permissions ticked.

**Bot comes online but @mention quoting doesn't work**
→ You didn't enable the **Message Content Intent** in Step 4.  
→ Make sure the toggle is ON and you clicked "Save Changes".

**"Failed to generate the quote image"**
→ The message had no text content (e.g. it was an image-only message).  
→ For `/quote`, make sure the message ID is from a message **in the same channel**.

**Bot is offline after I close my terminal**
→ You need to keep `npm start` running. For a permanent setup, use a process manager:
```bash
npm install -g pm2
pm2 start src/index.js --name makeaquote
pm2 save
pm2 startup   # follow the instructions printed to auto-start on reboot
```

**`npm install` fails with a build error**
→ Make sure you have Node.js v18 or later: `node --version`  
→ Try deleting `node_modules` and `package-lock.json` then running `npm install` again.

---

## Project structure

```
makeaquote/
├── src/
│   ├── index.js                  Bot entry point
│   ├── deploy-commands.js        Command registration script
│   ├── commands/
│   │   ├── quote.js              /quote
│   │   ├── customquote.js        /customquote
│   │   ├── randomquote.js        /randomquote
│   │   ├── settings.js           /settings (+ dashboard panel builders)
│   │   ├── help.js               /help
│   │   └── makeaquote_context.js Right-click → Make a Quote
│   ├── events/
│   │   ├── ready.js              Bot ready
│   │   ├── interactionCreate.js  Slash / button / select handler
│   │   └── messageCreate.js      Reply + @mention handler
│   └── utils/
│       ├── quoteGenerator.js     Canvas image renderer
│       ├── quoteHelpers.js       Sessions, buttons, redirect
│       └── store.js              Per-user / per-server settings (JSON)
├── data/
│   └── settings.json             Auto-created on first run
├── .env.example                  Copy this to .env and fill it in
└── package.json
```
