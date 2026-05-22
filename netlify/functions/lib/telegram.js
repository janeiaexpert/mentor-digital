const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

async function sendMessage(chatId, text, parseMode = 'HTML') {
  if (!TELEGRAM_TOKEN || !chatId) return null

  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: String(chatId),
        text,
        parse_mode: parseMode,
      }),
    })
    return await res.json()
  } catch (err) {
    console.error('Telegram send error:', err)
    return null
  }
}

async function setWebhook(url) {
  if (!TELEGRAM_TOKEN) return null

  try {
    const res = await fetch(`${API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    return await res.json()
  } catch (err) {
    console.error('Telegram webhook setup error:', err)
    return null
  }
}

module.exports = { sendMessage, setWebhook }
