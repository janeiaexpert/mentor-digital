const { listTasks, createTask, getTask, updateTask, deleteTask } = require('./lib/supabase')
const { sendMessage } = require('./lib/telegram')

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cleanId(raw) {
  if (!raw) return ''
  return String(raw).replace(/^[\sID:]*/, '').trim().split(/\s+/)[0]
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN
    const webhookUrl = `https://${req.headers.host}/api/telegram`
    const url = `https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`
    const r = await fetch(url)
    const data = await r.json()
    return res.status(200).json(data)
  }

  if (req.method !== 'POST') return res.status(405).end()

  try {
    const body = req.body

    if (body && body.chatId && typeof body.message === 'string') {
      await sendMessage(body.chatId, body.message)
      return res.json({ ok: true })
    }

    const msg = body.message
    if (!msg?.text) return res.status(200).end('OK')

    const chatId = msg.chat.id
    const text = msg.text.trim()
    const firstName = msg.from?.first_name || 'Usuário'

    if (text.startsWith('/start')) {
      await cmdStart(chatId, firstName)
    } else if (text.startsWith('/help')) {
      await cmdHelp(chatId)
    } else if (text.startsWith('/stats')) {
      await cmdStats(chatId)
    } else if (/^\/add\s+/i.test(text)) {
      await cmdAdd(chatId, text.replace(/^\/add\s+/i, '').trim())
    } else if (/^\/(list|tasks)/i.test(text)) {
      await cmdList(chatId)
    } else if (/^\/(done|complete)\s+/i.test(text)) {
      await cmdDone(chatId, cleanId(text.split(/\s+/).slice(1).join(' ')))
    } else if (/^\/(done|complete)$/i.test(text)) {
      await sendMessage(chatId, '❌ Use: /done <id ou título>\n\nEx: /done abc123\n     /done Livro\n\nUse /list para ver as tarefas.')
    } else if (/^\/(delete|remove|excluir|exclua)\s+/i.test(text)) {
      await cmdDelete(chatId, cleanId(text.split(/\s+/).slice(1).join(' ')))
    } else if (/^\/(delete|remove|excluir|exclua)$/i.test(text)) {
      await sendMessage(chatId, '❌ Use: /delete <id ou título>\n\nEx: /delete abc123\n     /delete "estudar top"\n\nUse /list para ver as tarefas.')
    } else if (text === '/add') {
      await sendMessage(chatId, 'Use: /add Título | Descrição | categoria | prioridade\n\nEx: /add Estudar JS | Revisar closures | diaria | alta')
    } else {
      await sendMessage(chatId, '❓ Comando não reconhecido. Use /help para ver os comandos disponíveis. (v3)')
    }

    return res.status(200).end('OK')
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return res.status(200).end('OK')
  }
}

async function cmdStart(chatId, name) {
  const text = [
    `👋 Olá, <b>${esc(name)}</b>! Bem-vindo ao <b>Mentor Digital</b> 🎯`,
    '',
    'Eu sou seu assistente de tarefas.',
    '• 📝 <b>Criar</b> — /add',
    '• 📋 <b>Listar</b> — /list',
    '• ✅ <b>Concluir</b> — /done (ID ou nome)',
    '• ❌ <b>Excluir</b> — /delete (ID ou nome)',
    '• 📊 <b>Estatísticas</b> — /stats',
    '',
    `📌 Seu Chat ID: <code>${chatId}</code>`,
    '',
    '💡 Use este Chat ID no site Mentor Digital para receber notificações.',
    'Use /help para ajuda completa.',
  ].join('\n')
  await sendMessage(chatId, text)
}

async function cmdHelp(chatId) {
  const text = [
    '📖 <b>Ajuda - Mentor Digital</b>',
    '',
    '<b>Comandos:</b>',
    '',
    '📝 <code>/add Título | Desc | cat | pri</code>',
    '   Criar tarefa',
    '   <i>cat: diaria, semanal, mensal</i>',
    '   <i>pri: alta, media, baixa</i>',
    '   Ex: <code>/add Estudar | Revisar cap 3 | diaria | alta</code>',
    '',
    '📋 <code>/list</code> ou <code>/tasks</code>',
    '   Listar todas as tarefas',
    '',
    '✅ <code>/done &lt;id ou título&gt;</code>',
    '   Concluir (por ID ou nome)',
    '   Ex: <code>/done abc123</code> ou <code>/done Livro</code>',
    '',
    '❌ <code>/delete &lt;id ou título&gt;</code>',
    '   Excluir (por ID ou nome)',
    '   <i>Aliases: /excluir, /exclua</i>',
    '',
    '📊 <code>/stats</code>',
     '   Ver estatísticas do progresso',
     '',
     '<i>Mentor Digital v3</i>',
   ].join('\n')
  await sendMessage(chatId, text)
}

async function cmdStats(chatId) {
  try {
    const data = await listTasks()
    const total = data.length
    const concluidas = data.filter(t => t.concluida).length
    const pendentes = total - concluidas
    const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0
    const bar = gerarBarra(progresso)
    const text = [
      '📊 <b>Suas Estatísticas</b>', '',
      `📌 Total: <b>${total}</b>`,
      `⏳ Pendentes: <b>${pendentes}</b>`,
      `✅ Concluídas: <b>${concluidas}</b>`,
      `📈 Progresso: <b>${progresso}%</b>`, '',
      bar,
    ].join('\n')
    await sendMessage(chatId, text)
  } catch (err) {
    console.error('cmdStats error:', err)
    await sendMessage(chatId, '❌ Erro ao consultar tarefas.')
  }
}

async function cmdAdd(chatId, args) {
  const parts = args.split('|').map(s => s.trim())
  const titulo = parts[0]
  if (!titulo) {
    await sendMessage(chatId, '❌ Use: /add Título | Descrição | categoria | prioridade')
    return
  }
  try {
    const result = await createTask({
      titulo,
      descricao: parts[1] || '',
      categoria: ['diaria', 'semanal', 'mensal'].includes(parts[2]) ? parts[2] : 'diaria',
      prioridade: ['alta', 'media', 'baixa'].includes(parts[3]) ? parts[3] : 'media',
    })
    const task = Array.isArray(result) ? result[0] : result
    const catLabels = { diaria: '📅 Diária', semanal: '📆 Semanal', mensal: '📋 Mensal' }
    const priLabels = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }
    const text = [
      '✅ <b>Tarefa criada com sucesso!</b>', '',
      `<b>${esc(task.titulo)}</b>`,
      task.descricao ? esc(task.descricao) : '', '',
      `${catLabels[task.categoria] || task.categoria} | ${priLabels[task.prioridade] || task.prioridade}`, '',
      `ID: <code>${task.id}</code>`,
    ].filter(Boolean).join('\n')
    await sendMessage(chatId, text)
  } catch (err) {
    console.error('cmdAdd error:', err)
    await sendMessage(chatId, '❌ Erro ao criar tarefa.')
  }
}

async function cmdList(chatId) {
  try {
    const data = await listTasks()
    if (!data || data.length === 0) {
      await sendMessage(chatId, '📭 Nenhuma tarefa encontrada. Crie uma com /add')
      return
    }

    const pendentes = data.filter(t => !t.concluida)
    const concluidas = data.filter(t => t.concluida)

    let text = `📋 <b>Suas Tarefas</b> (${data.length} total)`
    text += `\n⏳ ${pendentes.length} pendentes | ✅ ${concluidas.length} concluídas\n`

    if (pendentes.length > 0) {
      text += '\n<b>--- Pendentes ---</b>\n'
      text += pendentes.slice(0, 10).map(t => formatTask(t)).join('\n')
      if (pendentes.length > 10) text += `\n... e mais ${pendentes.length - 10} tarefas pendentes`
    }

    if (concluidas.length > 0) {
      text += '\n<b>--- Concluídas (últimas 5) ---</b>\n'
      text += concluidas.slice(0, 5).map(t => formatTask(t)).join('\n')
    }

    await sendMessage(chatId, text)
  } catch (err) {
    console.error('cmdList error:', err)
    await sendMessage(chatId, '❌ Erro ao listar tarefas.')
  }
}

async function cmdDone(chatId, id) {
  if (!id) {
    await sendMessage(chatId, '❌ Use: /done <id ou título>\n\nEx: /done abc123\n     /done Livro')
    return
  }
  try {
    let res = await getTask(id)
    let task = Array.isArray(res) ? res[0] : res
    if (!task) {
      const todas = await listTasks()
      task = todas.find(t => t.titulo.toLowerCase().includes(id.toLowerCase()))
      if (task) id = task.id
    }
    if (!task) throw new Error('Not found')
    await updateTask(id, { concluida: true, concluida_em: new Date().toISOString() })
    await sendMessage(chatId, `✅ <b>Tarefa concluída!</b>\n\n${esc(task.titulo)}`)
  } catch (err) {
    console.error('cmdDone error:', err)
    await sendMessage(chatId, '❌ Tarefa não encontrada. Use /list para ver os IDs.')
  }
}

async function cmdDelete(chatId, id) {
  if (!id) {
    await sendMessage(chatId, '❌ Use: /delete <id ou título>\n\nEx: /delete abc123\n     /delete "estudar top"')
    return
  }
  try {
    let res = await getTask(id)
    let task = Array.isArray(res) ? res[0] : res
    if (!task) {
      const todas = await listTasks()
      task = todas.find(t => t.titulo.toLowerCase().includes(id.toLowerCase()))
      if (task) id = task.id
    }
    if (!task) throw new Error('Not found')
    await deleteTask(id)
    await sendMessage(chatId, `🗑️ <b>Tarefa excluída:</b> ${esc(task.titulo)}`)
  } catch (err) {
    console.error('cmdDelete error:', err)
    await sendMessage(chatId, '❌ Tarefa não encontrada. Use /list para ver os IDs.')
  }
}

function formatTask(t) {
  const status = t.concluida ? '✅' : '⏳'
  const catLabels = { diaria: '📅', semanal: '📆', mensal: '📋' }
  const priLabels = { alta: '🔴', media: '🟡', baixa: '🟢' }
  const cat = catLabels[t.categoria] || '📌'
  const pri = priLabels[t.prioridade] || '⚪'
  const title = t.titulo.length > 40 ? t.titulo.slice(0, 40) + '…' : t.titulo
  return `${status} <code>${t.id.slice(0, 8)}</code> ${cat} ${pri} <b>${esc(title)}</b>`
}

function gerarBarra(percent) {
  const filled = Math.round(percent / 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${percent}%`
}
