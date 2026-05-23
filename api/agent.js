const { sendMessage } = require('./lib/telegram')

const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_KEY = process.env.GROQ_API_KEY
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

async function askGroq(messages) {
  if (!GROQ_KEY) return null
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.7, max_tokens: 1024 }),
  })
  if (!res.ok) { const e = await res.text(); throw new Error(`Groq ${res.status}: ${e}`) }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '(sem resposta)'
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { chatId, message } = req.body

    if (!GROQ_KEY) {
      const msg = '⚠️ Groq não configurado. Defina GROQ_API_KEY nas variáveis de ambiente.'
      if (chatId) await sendMessage(chatId, msg)
      return res.json({ reply: msg })
    }

    const reply = await askGroq([
      { role: 'system', content: 'Você é o assistente Mentor Digital, especialista em produtividade e organização de tarefas. Responda de forma objetiva e amigável em português.' },
      { role: 'user', content: message },
    ])

    if (chatId) await sendMessage(chatId, reply)
    return res.json({ reply })
  } catch (err) {
    console.error('agent error:', err)
    const msg = '❌ Erro ao consultar o agente.'
    if (req.body?.chatId) await sendMessage(req.body.chatId, msg)
    return res.status(500).json({ error: err.message })
  }
}
