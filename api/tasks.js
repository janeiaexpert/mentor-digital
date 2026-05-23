const { listTasks, createTask, updateTask, deleteTask } = require('./lib/supabase')
const { sendMessage } = require('./lib/telegram')

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(204).end()

  try {
    const id = req.query.id || null

    if (req.method === 'GET' && !id) {
      const data = await listTasks()
      return res.json(data || [])
    }

    if (req.method === 'POST' && !id) {
      const body = req.body
      if (!body.titulo?.trim()) return res.status(400).json({ error: 'titulo is required' })
      const result = await createTask({
        titulo: body.titulo.trim(),
        descricao: body.descricao?.trim() || '',
        categoria: body.categoria || 'diaria',
        prioridade: body.prioridade || 'media',
      })
      const task = Array.isArray(result) ? result[0] : result

      if (body.source === 'web') {
        const chatId = process.env.TELEGRAM_CHAT_ID
        if (chatId && task) {
          const catLabels = { diaria: '📅 Diária', semanal: '📆 Semanal', mensal: '📋 Mensal' }
          const priLabels = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
          const text = [
            '✅ <b>Nova tarefa criada!</b>', '',
            `<b>${esc(task.titulo)}</b>`,
            task.descricao ? esc(task.descricao) : '', '',
            `${catLabels[task.categoria] || task.categoria} | ${priLabels[task.prioridade] || task.prioridade}`,
          ].filter(Boolean).join('\n')
          await sendMessage(chatId, text)
        }
      }

      return res.status(201).json(task || result)
    }

    if (req.method === 'PATCH' && id) {
      const body = req.body
      const updates = {}
      if (body.titulo !== undefined) updates.titulo = body.titulo.trim()
      if (body.descricao !== undefined) updates.descricao = body.descricao.trim()
      if (body.categoria !== undefined) updates.categoria = body.categoria
      if (body.prioridade !== undefined) updates.prioridade = body.prioridade
      if (body.concluida !== undefined) {
        updates.concluida = body.concluida
        updates.concluida_em = body.concluida ? new Date().toISOString() : null
      }
      const result = await updateTask(id, updates)
      const task = Array.isArray(result) ? result[0] : result
      return res.json(task || result)
    }

    if (req.method === 'DELETE' && id) {
      await deleteTask(id)
      return res.json({ success: true })
    }

    return res.status(404).json({ error: 'Not found' })
  } catch (error) {
    console.error('tasks error:', error)
    return res.status(500).json({ error: error.message })
  }
}
