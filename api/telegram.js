export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Token não configurado' });
  }

  if (req.method === 'GET') {
    const webhookUrl = `https://${req.headers.host}/api/telegram`;
    const url = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`;
    const r = await fetch(url);
    const data = await r.json();
    return res.status(200).json(data);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (body.chatId) {
    const { message, chatId } = body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId é obrigatório' });
    }
    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      });
      const data = await response.json();
      return res.status(response.ok ? 200 : 400).json(data);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (body.message && body.message.text) {
    const { message } = body;
    const chatId = message.chat.id;
    const nome = message.from.first_name || 'usuário';
    const text = message.text;

    if (text === '/start') {
      const reply = `👋 Olá ${nome}! Bem-vindo ao <b>Mentor Digital</b>\n\nSuas notificações de tarefas chegarão aqui automaticamente.`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
      });
    } else {
      const reply = `Olá ${nome}! Eu sou o assistente do <b>Mentor Digital</b> 🤖\n\nComandos disponíveis:\n/start - Ver mensagem de boas-vindas`;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: reply, parse_mode: 'HTML' }),
      });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Formato inválido' });
}
