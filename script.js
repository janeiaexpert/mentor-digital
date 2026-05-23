const API_BASE = '/api';
const TELEGRAM_KEY = 'mentor_digital_telegram';
const CONFIG_KEY = 'mentor_digital_config';

let tarefas = [];
let filtroAtual = 'todas';
let termoBusca = '';

const $ = id => document.getElementById(id);
const el = {
  taskForm: $('taskForm'), taskList: $('taskList'),
  editModal: $('editModal'), editForm: $('editForm'),
  editId: $('editId'), editTitle: $('editTitle'),
  editCategory: $('editCategory'), editPriority: $('editPriority'),
  editDesc: $('editDesc'), cancelEdit: $('cancelEdit'),
  searchInput: $('searchInput'), filterTabs: $('filterTabs'),
  statTotal: $('statTotal'), statPendente: $('statPendente'),
  statConcluida: $('statConcluida'), statProgresso: $('statProgresso'),
  cmdInput: $('cmdInput'), cmdSend: $('cmdSend'),
  cmdSuggestions: $('cmdSuggestions'), cmdFeedback: $('cmdFeedback'),
  telegramChatId: $('telegramChatId'),
  btnTestTelegram: $('btnTestTelegram'), btnSaveTelegram: $('btnSaveTelegram'),
  telegramStatus: $('telegramStatus'), statusDot: document.querySelector('.status-dot'),
  btnCustomize: $('btnCustomize'), customizePanel: $('customizePanel'),
  closeCustomize: $('closeCustomize'), themeOptions: $('themeOptions'), fontOptions: $('fontOptions'),
};

const api = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) throw new Error('API error: ' + res.status);
    return method === 'DELETE' ? true : await res.json();
  },
  list() { return this.request('GET', '/tasks'); },
  create(data) { return this.request('POST', '/tasks', { ...data, source: 'web' }); },
  update(id, data) { return this.request('PATCH', '/tasks?id=' + id, data); },
  remove(id) { return this.request('DELETE', '/tasks?id=' + id); },
};

function carregarTelegram() {
  try { return JSON.parse(localStorage.getItem(TELEGRAM_KEY)) || { chatId: '' }; }
  catch { return { chatId: '' }; }
}
function salvarTelegram(data) {
  localStorage.setItem(TELEGRAM_KEY, JSON.stringify(data));
  atualizarStatusTelegram();
}
function atualizarStatusTelegram() {
  const data = carregarTelegram();
  const conectado = !!data.chatId;
  if (el.statusDot) {
    el.statusDot.className = 'status-dot ' + (conectado ? 'online' : 'offline');
    const label = el.telegramStatus?.querySelector('span:last-child');
    if (label) label.textContent = conectado ? 'Conectado' : 'Desconectado';
  }
}

async function enviarTelegram(mensagem) {
  const data = carregarTelegram();
  if (!data.chatId) return;
  try { await fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: data.chatId, message: mensagem }) }); }
  catch {}
}

async function carregarTarefas() {
  try { tarefas = await api.list() || []; }
  catch { tarefas = []; }
  renderizar();
}

async function adicionarTarefa(titulo, descricao, categoria, prioridade) {
  try {
    const task = await api.create({ titulo, descricao, categoria, prioridade });
    tarefas.unshift({ id: task.id, titulo: task.titulo, descricao: task.descricao || '', categoria: task.categoria, prioridade: task.prioridade, concluida: task.concluida, criadaEm: task.criadaEm });
  } catch {
    tarefas.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), titulo, descricao, categoria, prioridade, concluida: false, criadaEm: new Date().toISOString() });
  }
  renderizar();
}

async function editarTarefa(id, titulo, descricao, categoria, prioridade) {
  const idx = tarefas.findIndex(t => t.id === id);
  if (idx === -1) return;
  try {
    const task = await api.update(id, { titulo, descricao, categoria, prioridade });
    tarefas[idx] = { id: task.id, titulo: task.titulo, descricao: task.descricao || '', categoria: task.categoria, prioridade: task.prioridade, concluida: task.concluida, criadaEm: task.criadaEm };
  } catch {
    Object.assign(tarefas[idx], { titulo, descricao, categoria, prioridade });
  }
  renderizar();
}

async function toggleConcluida(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;
  tarefa.concluida = !tarefa.concluida;
  try { await api.update(id, { concluida: tarefa.concluida }); } catch {}
  renderizar();
}

async function removerTarefa(id) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
  try { await api.remove(id); } catch {}
  tarefas = tarefas.filter(t => t.id !== id);
  renderizar();
}

function tarefasFiltradas() {
  let lista = tarefas;
  if (filtroAtual !== 'todas') lista = lista.filter(t => t.categoria === filtroAtual);
  if (termoBusca.trim()) {
    const termo = termoBusca.trim().toLowerCase();
    lista = lista.filter(t => t.titulo.toLowerCase().includes(termo) || (t.descricao && t.descricao.toLowerCase().includes(termo)));
  }
  const pr = { alta: 0, media: 1, baixa: 2 };
  return lista.sort((a, b) => (a.concluida !== b.concluida ? (a.concluida ? 1 : -1) : pr[a.prioridade] - pr[b.prioridade]));
}

function atualizarDashboard() {
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida).length;
  el.statTotal.textContent = total;
  el.statPendente.textContent = total - concluidas;
  el.statConcluida.textContent = concluidas;
  el.statProgresso.textContent = total > 0 ? Math.round((concluidas / total) * 100) + '%' : '0%';
}

function esc(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; }

function renderizar() {
  const lista = tarefasFiltradas();
  atualizarDashboard();
  if (lista.length === 0) {
    el.taskList.innerHTML = '<p class="empty-msg">Nenhuma tarefa encontrada.</p>';
    return;
  }
  const catLabels = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };
  const priLabels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  el.taskList.innerHTML = lista.map(t => `
    <div class="task-item ${t.concluida ? 'concluida' : ''} prioridade-${t.prioridade}">
      <div class="task-check ${t.concluida ? 'checked' : ''}" data-id="${t.id}">${t.concluida ? '&#10003;' : ''}</div>
      <div class="task-content">
        <div class="task-title">${esc(t.titulo)}</div>
        ${t.descricao ? `<div class="task-desc">${esc(t.descricao)}</div>` : ''}
        <div class="task-meta">
          <span class="tag tag-${t.categoria}">${catLabels[t.categoria]}</span>
          <span class="tag tag-${t.prioridade}">${priLabels[t.prioridade]}</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="btn-icon" data-edit="${t.id}" title="Editar">&#9998;</button>
        <button class="btn-icon" data-delete="${t.id}" title="Excluir">&#10005;</button>
      </div>
    </div>
  `).join('');
  el.taskList.querySelectorAll('.task-check').forEach(el2 => el2.addEventListener('click', () => toggleConcluida(el2.dataset.id)));
  el.taskList.querySelectorAll('[data-edit]').forEach(el2 => el2.addEventListener('click', () => abrirModal(el2.dataset.edit)));
  el.taskList.querySelectorAll('[data-delete]').forEach(el2 => el2.addEventListener('click', () => removerTarefa(el2.dataset.delete)));
}

function abrirModal(id) {
  const t = tarefas.find(x => x.id === id);
  if (!t) return;
  el.editId.value = t.id; el.editTitle.value = t.titulo;
  el.editDesc.value = t.descricao || '';
  el.editCategory.value = t.categoria; el.editPriority.value = t.prioridade;
  el.editModal.classList.add('active');
}
function fecharModal() { el.editModal.classList.remove('active'); }

function carregarConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || { tema: 'padrao', fonte: 'padrao' }; }
  catch { return { tema: 'padrao', fonte: 'padrao' }; }
}
function salvarConfig(c) { localStorage.setItem(CONFIG_KEY, JSON.stringify(c)); }
function aplicarConfig(c) {
  document.body.classList.toggle('theme-personalizado', c.tema === 'personalizado');
  el.themeOptions.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === c.tema));
  document.body.classList.remove('fonte-serif', 'fonte-arial');
  if (c.fonte !== 'padrao') document.body.classList.add('fonte-' + c.fonte);
  el.fontOptions.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font === c.fonte));
}

const config = carregarConfig();
const telegramConfig = carregarTelegram();
if (el.telegramChatId) el.telegramChatId.value = telegramConfig.chatId;

// ─── Event listeners ───────────────────

el.taskForm.addEventListener('submit', e => {
  e.preventDefault();
  const titulo = $('taskTitle').value.trim();
  if (!titulo) return;
  adicionarTarefa(titulo, $('taskDesc').value.trim(), $('taskCategory').value, $('taskPriority').value);
  el.taskForm.reset(); $('taskTitle').focus();
});

el.editForm.addEventListener('submit', e => {
  e.preventDefault();
  const id = el.editId.value, titulo = el.editTitle.value.trim();
  if (!id || !titulo) return;
  editarTarefa(id, titulo, el.editDesc.value.trim(), el.editCategory.value, el.editPriority.value);
  fecharModal();
});
el.cancelEdit.addEventListener('click', fecharModal);
el.editModal.addEventListener('click', e => { if (e.target === el.editModal) fecharModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

el.filterTabs.addEventListener('click', e => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  el.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtual = btn.dataset.filter;
  renderizar();
});

el.searchInput.addEventListener('input', e => { termoBusca = e.target.value; renderizar(); });

el.btnSaveTelegram?.addEventListener('click', () => {
  const chatId = el.telegramChatId.value.trim();
  if (!chatId) return;
  salvarTelegram({ chatId });
  alert('Configuração salva!');
});
el.btnTestTelegram?.addEventListener('click', async () => {
  const chatId = el.telegramChatId.value.trim();
  if (!chatId) { alert('Informe um Chat ID primeiro.'); return; }
  salvarTelegram({ chatId });
  const msg = '🔔 <b>Mentor Digital</b>\nConexão estabelecida com sucesso! ✅';
  try {
    const res = await fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId, message: msg }) });
    if (res.ok) alert('Mensagem enviada! Verifique seu Telegram.');
    else { const err = await res.json(); alert('Erro: ' + (err.error || 'Falha ao enviar')); }
  } catch { alert('Erro de conexão com o servidor.'); }
});

el.btnCustomize?.addEventListener('click', () => el.customizePanel.classList.toggle('active'));
el.closeCustomize?.addEventListener('click', () => el.customizePanel.classList.remove('active'));
el.themeOptions?.addEventListener('click', e => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  config.tema = btn.dataset.theme; salvarConfig(config); aplicarConfig(config);
});
el.fontOptions?.addEventListener('click', e => {
  const btn = e.target.closest('.font-btn');
  if (!btn) return;
  config.fonte = btn.dataset.font; salvarConfig(config); aplicarConfig(config);
});

atualizarStatusTelegram();
aplicarConfig(config);
carregarTarefas();

// ─── Command bar ────────────────────────

const COMMANDS = [
  { cmd: '/add', desc: 'Título | Desc | categoria | prioridade' },
  { cmd: '/list', desc: 'Listar todas as tarefas' },
  { cmd: '/done', desc: '<id ou título> — Concluir' },
  { cmd: '/delete', desc: '<id ou título> — Excluir' },
  { cmd: '/excluir', desc: '<id ou título> — Excluir' },
  { cmd: '/ask', desc: '<pergunta> — Assistente IA' },
  { cmd: '/stats', desc: 'Ver estatísticas' },
  { cmd: '/help', desc: 'Mostrar ajuda' },
];

if (el.cmdInput) {
  el.cmdInput.addEventListener('input', () => {
    const val = el.cmdInput.value;
    if (val.startsWith('/')) {
      const term = val.toLowerCase();
      const matches = COMMANDS.filter(c => c.cmd.startsWith(term));
      renderSuggestions(matches);
    } else {
      el.cmdSuggestions.classList.remove('show');
    }
  });

  el.cmdInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); executeCommand(el.cmdInput.value.trim()); }
    if (e.key === 'Escape') el.cmdSuggestions.classList.remove('show');
  });

  el.cmdSend.addEventListener('click', () => executeCommand(el.cmdInput.value.trim()));
  document.addEventListener('click', e => { if (!e.target.closest('.cmd-bar')) el.cmdSuggestions.classList.remove('show'); });
}

function renderSuggestions(matches) {
  el.cmdSuggestions.innerHTML = '';
  if (matches.length === 0) { el.cmdSuggestions.classList.remove('show'); return; }
  matches.forEach(m => {
    const div = document.createElement('div');
    div.className = 'cmd-suggestion-item';
    div.innerHTML = `<span class="cmd-key">${m.cmd}</span> <span class="cmd-desc">${m.desc}</span>`;
    div.addEventListener('click', () => { el.cmdInput.value = m.cmd + ' '; el.cmdInput.focus(); el.cmdSuggestions.classList.remove('show'); });
    el.cmdSuggestions.appendChild(div);
  });
  el.cmdSuggestions.classList.add('show');
}

function showFeedback(msg, type = 'info') {
  el.cmdFeedback.textContent = msg;
  el.cmdFeedback.className = 'cmd-feedback show ' + type;
  setTimeout(() => el.cmdFeedback.classList.remove('show'), 5000);
}

async function executeCommand(text) {
  el.cmdSuggestions.classList.remove('show');
  el.cmdFeedback.classList.remove('show');
  if (!text.startsWith('/')) return;

  if (/^\/(list|tasks)$/i.test(text)) {
    showFeedback(`📋 ${tarefas.length} tarefas (${tarefas.filter(t => !t.concluida).length} pendentes, ${tarefas.filter(t => t.concluida).length} concluídas)`, 'info');
    return;
  }
  if (/^\/help$/i.test(text)) {
    showFeedback(COMMANDS.map(c => `${c.cmd} — ${c.desc}`).join('\n'), 'info');
    return;
  }
  if (/^\/stats$/i.test(text)) {
    const total = tarefas.length, concluidas = tarefas.filter(t => t.concluida).length;
    showFeedback(`📊 Total: ${total} | Pendentes: ${total - concluidas} | Concluídas: ${concluidas} | Progresso: ${total > 0 ? Math.round((concluidas / total) * 100) : 0}%`, 'info');
    return;
  }

  const addMatch = text.match(/^\/add\s+(.+?)(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+?))?(?:\s*\|\s*(.+?))?$/i);
  if (addMatch) {
    const titulo = addMatch[1]?.trim();
    if (!titulo) { showFeedback('❌ Informe um título', 'error'); return; }
    const desc = addMatch[2]?.trim() || '';
    const cat = ['diaria', 'semanal', 'mensal'].includes(addMatch[3]?.trim()) ? addMatch[3].trim() : 'diaria';
    const pri = ['alta', 'media', 'baixa'].includes(addMatch[4]?.trim()) ? addMatch[4].trim() : 'media';
    await adicionarTarefa(titulo, desc, cat, pri);
    showFeedback(`✅ "${titulo}" criada!`, 'success');
    $('taskTitle').value = ''; $('taskDesc').value = '';
    return;
  }

  const doneMatch = text.match(/^\/done\s+(.+)/i);
  if (doneMatch) {
    const term = doneMatch[1].trim();
    const t = tarefas.find(t => t.id.startsWith(term) || t.titulo.toLowerCase().includes(term.toLowerCase()));
    if (!t) { showFeedback('❌ Tarefa não encontrada', 'error'); return; }
    await toggleConcluida(t.id);
    showFeedback(`✅ "${t.titulo}" ${t.concluida ? 'concluída' : 'reativada'}!`, 'success');
    return;
  }

  const delMatch = text.match(/^\/(?:delete|remove|excluir|exclua)\s+(.+)/i);
  if (delMatch) {
    const term = delMatch[1].trim();
    const t = tarefas.find(t => t.id.startsWith(term) || t.titulo.toLowerCase().includes(term.toLowerCase()));
    if (!t) { showFeedback('❌ Tarefa não encontrada', 'error'); return; }
    await removerTarefa(t.id);
    showFeedback(`🗑️ "${t.titulo}" excluída!`, 'success');
    return;
  }

  const askMatch = text.match(/^\/ask\s+(.+)/i);
  if (askMatch) {
    const pergunta = askMatch[1].trim();
    showFeedback('🤔 Pensando...', 'info');
    try {
      const res = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: pergunta }) });
      const data = await res.json();
      showFeedback(data.reply || 'Sem resposta', 'info');
    } catch { showFeedback('❌ Erro ao consultar agente', 'error'); }
    return;
  }

  showFeedback('❓ Comando não reconhecido. Use /help', 'error');
}
