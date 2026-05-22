const { listTasks, createTask, getTask, updateTask, deleteTask } = require('./lib/supabase')
const { sendMessage } = require('./lib/telegram')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const update = JSON.parse(event.body)
    const msg = update.message

    if (!msg?.text) {
      return { statusCode: 200, body: 'OK' }
    }

    const chatId = msg.chat.id
    const text = msg.text.trim()
    const firstName = msg.from?.first_name || 'Usuário'

    if (text.startsWith('/start')) {
      return await cmdStart(chatId, firstName)
    }
    if (text.startsWith('/help')) {
      return await cmdHelp(chatId)
    }
    if (text.startsWith('/stats')) {
      return await cmdStats(chatId)
    }
    if (text.startsWith('/add ')) {
      return await cmdAdd(chatId, text.slice(5).trim())
    }
    if (/^\/(list|tasks)/.test(text)) {
      return await cmdList(chatId)
    }
    if (/^\/(done|complete) /.test(text)) {
      return await cmdDone(chatId, text.split(' ').slice(1).join(' '))
    }
    if (/^\/(delete|remove) /.test(text)) {
      return await cmdDelete(chatId, text.split(' ').slice(1).join(' '))
    }
    if (text === '/add') {
      await sendMessage(chatId, 'Use: /add Título | Descrição | categoria | prioridade\n\nExemplo:\n/add Estudar JS | Revisar closures | diaria | alta')
      return { statusCode: 200, body: 'OK' }
    }

    await sendMessage(chatId, '❓ Comando não reconhecido. Use /help para ver os comandos disponíveis.')
    return { statusCode: 200, body: 'OK' }
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return { statusCode: 200, body: 'OK' }
  }
}

async function cmdStart(chatId, name) {
  const text = [
    `👋 Olá, <b>${esc(name)}</b>! Bem-vindo ao <b>Mentor Digital</b> 🎯`,
    '',
    'Eu sou seu assistente de tarefas. Você pode:',
    '• 📝 <b>Criar tarefas</b> — /add',
    '• 📋 <b>Listar tarefas</b> — /list',
    '• ✅ <b>Concluir</b> — /done id',
    '• ❌ <b>Excluir</b> — /delete id',
    '• 📊 <b>Ver estatísticas</b> — /stats',
    '',
    'Use /help para ajuda completa.',
  ].join('\n')
  await sendMessage(chatId, text)
}

async function cmdHelp(chatId) {
  const text = [
    '📖 <b>Ajuda - Mentor Digital</b>',
    '',
    '<b>Comandos disponíveis:</b>',
    '',
    '📝 <code>/add Título | Descrição | categoria | prioridade</code>',
    '   Criar nova tarefa',
    '   <i>categoria: diaria, semanal, mensal</i>',
    '   <i>prioridade: alta, media, baixa</i>',
    '   Ex: <code>/add Estudar | Revisar capítulo 3 | diaria | alta</code>',
    '',
    '📋 <code>/list</code> ou <code>/tasks</code>',
    '   Listar todas as tarefas',
    '',
    '✅ <code>/done &lt;id&gt;</code>',
    '   Marcar tarefa como concluída',
    '   Ex: <code>/done abc123</code>',
    '',
    '❌ <code>/delete &lt;id&gt;</code>',
    '   Excluir uma tarefa',
    '',
    '📊 <code>/stats</code>',
    '   Ver estatísticas do seu progresso',
    '',
    '💡 <b>Dica:</b> Use o site Mentor Digital para gerenciar suas tarefas com uma interface visual!',
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
      '📊 <b>Suas Estatísticas</b>',
      '',
      `📌 Total: <b>${total}</b>`,
      `⏳ Pendentes: <b>${pendentes}</b>`,
      `✅ Concluídas: <b>${concluidas}</b>`,
      `📈 Progresso: <b>${progresso}%</b>`,
      '',
      bar,
    ].join('\n')
    await sendMessage(chatId, text)
  } catch {
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
      '✅ <b>Tarefa criada com sucesso!</b>',
      '',
      `<b>${esc(task.titulo)}</b>`,
      task.descricao ? esc(task.descricao) : '',
      '',
      `${catLabels[task.categoria] || task.categoria} | ${priLabels[task.prioridade] || task.prioridade}`,
      '',
      `ID: <code>${task.id}</code>`,
    ].filter(Boolean).join('\n')

    await sendMessage(chatId, text)
  } catch (err) {
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
  } catch {
    await sendMessage(chatId, '❌ Erro ao listar tarefas.')
  }
}

async function cmdDone(chatId, id) {
  try {
    const result = await updateTask(id, { concluida: true, concluida_em: new Date().toISOString() })
    const task = Array.isArray(result) ? result[0] : result
    if (!task) throw new Error('Not found')
    await sendMessage(chatId, `✅ <b>Tarefa concluída!</b>\n\n${esc(task.titulo)}`)
  } catch {
    await sendMessage(chatId, `❌ Tarefa não encontrada. Use /list para ver os IDs.`)
  }
}

async function cmdDelete(chatId, id) {
  try {
    const result = await getTask(id)
    const task = Array.isArray(result) ? result[0] : result
    if (!task) throw new Error('Not found')
    await deleteTask(id)
    await sendMessage(chatId, `🗑️ <b>Tarefa excluída:</b> ${esc(task.titulo)}`)
  } catch {
    await sendMessage(chatId, `❌ Tarefa não encontrada. Use /list para ver os IDs.`)
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
  const empty = 10 - filled
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
