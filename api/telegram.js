export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, chatId } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

  if (!token) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
  }

  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    res.status(response.ok ? 200 : 400).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
