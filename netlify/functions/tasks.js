const { getClient } = require('./lib/supabase')
const { sendMessage } = require('./lib/telegram')

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

function mapTask(t) {
  return {
    id: t.id,
    titulo: t.titulo,
    descricao: t.descricao || '',
    categoria: t.categoria,
    prioridade: t.prioridade,
    concluida: t.concluida,
    criadaEm: t.criada_em,
    concluidaEm: t.concluida_em,
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  try {
    const supabase = getClient()
    if (!supabase) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.' }) }
    }

    const path = event.path.replace(/^\/api\/?/, '').replace(/\/$/, '')
    const segments = path.split('/').filter(Boolean)

    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('criada_em', { ascending: false })

      if (error) throw error
      return { statusCode: 200, headers, body: JSON.stringify((data || []).map(mapTask)) }
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body)

      if (!body.titulo?.trim()) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'titulo is required' }) }
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          titulo: body.titulo.trim(),
          descricao: body.descricao?.trim() || '',
          categoria: body.categoria || 'diaria',
          prioridade: body.prioridade || 'media',
        })
        .select()
        .single()

      if (error) throw error

      if (body.source === 'web') {
        const chatId = process.env.TELEGRAM_CHAT_ID
        if (chatId) {
          const catLabels = { diaria: '📅 Diária', semanal: '📆 Semanal', mensal: '📋 Mensal' }
          const priLabels = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
          const text = [
            '✅ <b>Nova tarefa criada!</b>',
            '',
            `<b>${esc(data.titulo)}</b>`,
            data.descricao ? esc(data.descricao) : '',
            '',
            `${catLabels[data.categoria] || data.categoria} | ${priLabels[data.prioridade] || data.prioridade}`,
          ].filter(Boolean).join('\n')
          await sendMessage(chatId, text)
        }
      }

      return { statusCode: 201, headers, body: JSON.stringify(mapTask(data)) }
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

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return { statusCode: 200, headers, body: JSON.stringify(mapTask(data)) }
    }

    if (event.httpMethod === 'DELETE' && segments.length === 1) {
      const id = segments[0]

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)

      if (error) throw error
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
