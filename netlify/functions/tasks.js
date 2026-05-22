const { listTasks, createTask, updateTask, deleteTask } = require('./lib/supabase')
const { sendMessage } = require('./lib/telegram')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  try {
    const path = event.path.replace(/^\/api\/?/, '').replace(/\/$/, '')
    const segments = path.split('/').filter(Boolean)

    if (event.httpMethod === 'GET') {
      const data = await listTasks()
      return { statusCode: 200, headers, body: JSON.stringify(data || []) }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)
      if (!body.titulo?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'titulo is required' }) }
      }
      const data = await createTask({
        titulo: body.titulo.trim(),
        descricao: body.descricao?.trim() || '',
        categoria: body.categoria || 'diaria',
        prioridade: body.prioridade || 'media',
      })

      if (body.source === 'web') {
        const chatId = process.env.TELEGRAM_CHAT_ID
        if (chatId && data && data.length > 0) {
          const t = Array.isArray(data) ? data[0] : data
          const catLabels = { diaria: '📅 Diária', semanal: '📆 Semanal', mensal: '📋 Mensal' }
          const priLabels = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
          const text = [
            '✅ <b>Nova tarefa criada!</b>',
            '',
            `<b>${esc(t.titulo)}</b>`,
            t.descricao ? esc(t.descricao) : '',
            '',
            `${catLabels[t.categoria] || t.categoria} | ${priLabels[t.prioridade] || t.prioridade}`,
          ].filter(Boolean).join('\n')
          await sendMessage(chatId, text)
        }
      }

      const task = Array.isArray(data) ? data[0] : data
      return { statusCode: 201, headers, body: JSON.stringify(task || data) }
    }

    if (event.httpMethod === 'PATCH' && segments.length === 1) {
      const id = segments[0]
      const body = JSON.parse(event.body)
      const updates = {}
      if (body.titulo !== undefined) updates.titulo = body.titulo.trim()
      if (body.descricao !== undefined) updates.descricao = body.descricao.trim()
      if (body.categoria !== undefined) updates.categoria = body.categoria
      if (body.prioridade !== undefined) updates.prioridade = body.prioridade
      if (body.concluida !== undefined) {
        updates.concluida = body.concluida
        updates.concluida_em = body.concluida ? new Date().toISOString() : null
      }
      const data = await updateTask(id, updates)
      const task = Array.isArray(data) ? data[0] : data
      return { statusCode: 200, headers, body: JSON.stringify(task || data) }
    }

    if (event.httpMethod === 'DELETE' && segments.length === 1) {
      await deleteTask(segments[0])
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) }
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) }
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) }
  }
}

function esc(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
