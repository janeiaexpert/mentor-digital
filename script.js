const STORAGE_KEY = 'mentor_digital_tarefas';
const CONFIG_KEY = 'mentor_digital_config';
const TELEGRAM_KEY = 'mentor_digital_telegram';
const API_BASE = '/api';

let tarefas = [];
let filtroAtual = 'todas';
let termoBusca = '';

const elements = {
  taskForm: document.getElementById('taskForm'),
  taskList: document.getElementById('taskList'),
  editModal: document.getElementById('editModal'),
  editForm: document.getElementById('editForm'),
  editId: document.getElementById('editId'),
  editTitle: document.getElementById('editTitle'),
  editCategory: document.getElementById('editCategory'),
  editPriority: document.getElementById('editPriority'),
  editDesc: document.getElementById('editDesc'),
  cancelEdit: document.getElementById('cancelEdit'),
  searchInput: document.getElementById('searchInput'),
  filterTabs: document.getElementById('filterTabs'),
  statTotal: document.getElementById('statTotal'),
  statPendente: document.getElementById('statPendente'),
  statConcluida: document.getElementById('statConcluida'),
  statProgresso: document.getElementById('statProgresso'),
  btnCustomize: document.getElementById('btnCustomize'),
  customizePanel: document.getElementById('customizePanel'),
  closeCustomize: document.getElementById('closeCustomize'),
  themeOptions: document.getElementById('themeOptions'),
  fontOptions: document.getElementById('fontOptions'),
  telegramChatId: document.getElementById('telegramChatId'),
  btnTestTelegram: document.getElementById('btnTestTelegram'),
  btnSaveTelegram: document.getElementById('btnSaveTelegram'),
  telegramStatus: document.getElementById('telegramStatus'),
  statusDot: document.querySelector('.status-dot'),
};

const api = {
  async request(method, path, body) {
    try {
      const opts = { method, headers: { 'Content-Type': 'application/json' } }
      if (body) opts.body = JSON.stringify(body)
      const res = await fetch(API_BASE + path, opts)
      if (!res.ok) throw new Error('API error: ' + res.status)
      return method === 'DELETE' ? true : await res.json()
    } catch (e) {
      throw e
    }
  },
  list() { return this.request('GET', '/tasks') },
  create(data) { return this.request('POST', '/tasks', { ...data, source: 'web' }) },
  update(id, data) { return this.request('PATCH', '/tasks?id=' + id, data) },
  remove(id) { return this.request('DELETE', '/tasks?id=' + id) },
}

function carregarTelegram() {
  try {
    const dados = localStorage.getItem(TELEGRAM_KEY);
    return dados ? JSON.parse(dados) : { chatId: '' };
  } catch {
    return { chatId: '' };
  }
}

function salvarTelegram(data) {
  localStorage.setItem(TELEGRAM_KEY, JSON.stringify(data));
  atualizarStatusTelegram();
}

function atualizarStatusTelegram() {
  const data = carregarTelegram();
  const conectado = !!data.chatId;
  if (elements.statusDot) {
    elements.statusDot.className = 'status-dot ' + (conectado ? 'online' : 'offline');
    const label = document.querySelector('#telegramStatus span:last-child');
    if (label) label.textContent = conectado ? 'Conectado' : 'Desconectado';
  }
}

async function enviarTelegram(mensagem) {
  const data = carregarTelegram();
  if (!data.chatId) return;
  try {
    await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: data.chatId, message: mensagem }),
    });
  } catch {}
}

function notificarTelegram(tipo, tarefa) {
  const icons = { adicionada: '➕', concluida: '✅', desfeita: '↩️', excluida: '🗑️' };
  const icon = icons[tipo] || '📌';
  const prioridade = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' };
  const categoria = { diaria: '📅 Diária', semanal: '📆 Semanal', mensal: '📋 Mensal' };
  const texto = `${icon} <b>Tarefa ${tipo}</b>\n\n📌 ${tarefa.titulo}\n📂 ${categoria[tarefa.categoria]}\n🏷 ${prioridade[tarefa.prioridade]}${tarefa.descricao ? '\n📝 ' + tarefa.descricao : ''}`;
  enviarTelegram(texto);
}

function salvarCache() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tarefas))
}

function carregarCache() {
  try {
    const dados = localStorage.getItem(STORAGE_KEY)
    tarefas = dados ? JSON.parse(dados) : []
  } catch {
    tarefas = []
  }
}

async function carregarTarefas() {
  try {
    const dados = await api.list()
    tarefas = dados || []
    salvarCache()
  } catch {
    carregarCache()
  }
  renderizar()
}

async function adicionarTarefa(titulo, descricao, categoria, prioridade) {
  try {
    const task = await api.create({ titulo, descricao, categoria, prioridade })
    tarefas.unshift({
      id: task.id,
      titulo: task.titulo,
      descricao: task.descricao || '',
      categoria: task.categoria,
      prioridade: task.prioridade,
      concluida: task.concluida,
      criadaEm: task.criadaEm,
    })
  } catch {
    tarefas.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      titulo,
      descricao,
      categoria,
      prioridade,
      concluida: false,
      criadaEm: new Date().toISOString(),
    })
  }
  salvarCache()
  notificarTelegram('adicionada', tarefas.find(t => t.titulo === titulo && t.categoria === categoria) || tarefas[tarefas.length - 1])
  renderizar()
}

async function editarTarefa(id, titulo, descricao, categoria, prioridade) {
  const idx = tarefas.findIndex(t => t.id === id)
  if (idx === -1) return
  try {
    const task = await api.update(id, { titulo, descricao, categoria, prioridade })
    tarefas[idx] = {
      id: task.id,
      titulo: task.titulo,
      descricao: task.descricao || '',
      categoria: task.categoria,
      prioridade: task.prioridade,
      concluida: task.concluida,
      criadaEm: task.criadaEm,
    }
  } catch {
    tarefas[idx].titulo = titulo
    tarefas[idx].descricao = descricao
    tarefas[idx].categoria = categoria
    tarefas[idx].prioridade = prioridade
  }
  salvarCache()
  renderizar()
}

async function toggleConcluida(id) {
  const tarefa = tarefas.find(t => t.id === id)
  if (!tarefa) return
  tarefa.concluida = !tarefa.concluida
  try {
    await api.update(id, { concluida: tarefa.concluida })
  } catch {
  }
  salvarCache()
  notificarTelegram(tarefa.concluida ? 'concluida' : 'desfeita', tarefa)
  renderizar()
}

async function removerTarefa(id) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return
  const removida = tarefas.find(t => t.id === id)
  try {
    await api.remove(id)
  } catch {
  }
  tarefas = tarefas.filter(t => t.id !== id)
  salvarCache()
  if (removida) notificarTelegram('excluida', removida)
  renderizar()
}

function tarefasFiltradas() {
  let lista = tarefas;
  if (filtroAtual !== 'todas') {
    lista = lista.filter(t => t.categoria === filtroAtual);
  }
  if (termoBusca.trim()) {
    const termo = termoBusca.trim().toLowerCase();
    lista = lista.filter(t =>
      t.titulo.toLowerCase().includes(termo) ||
      (t.descricao && t.descricao.toLowerCase().includes(termo))
    );
  }
  return lista.sort((a, b) => {
    const pr = { alta: 0, media: 1, baixa: 2 };
    if (a.concluida !== b.concluida) return a.concluida ? 1 : -1;
    return pr[a.prioridade] - pr[b.prioridade];
  });
}

function atualizarDashboard() {
  const total = tarefas.length;
  const concluidas = tarefas.filter(t => t.concluida).length;
  const pendentes = total - concluidas;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : 0;
  elements.statTotal.textContent = total;
  elements.statPendente.textContent = pendentes;
  elements.statConcluida.textContent = concluidas;
  elements.statProgresso.textContent = progresso + '%';
}

function renderizar() {
  const lista = tarefasFiltradas();
  atualizarDashboard();
  if (lista.length === 0) {
    elements.taskList.innerHTML = '<p class="empty-msg">Nenhuma tarefa encontrada. Crie sua primeira tarefa acima!</p>';
    return;
  }
  elements.taskList.innerHTML = lista.map(tarefa => {
    const concluidaClass = tarefa.concluida ? 'concluida' : '';
    const checkedClass = tarefa.concluida ? 'checked' : '';
    const prioridadeClass = 'prioridade-' + tarefa.prioridade;
    const catLabels = { diaria: 'Diária', semanal: 'Semanal', mensal: 'Mensal' };
    const priLabels = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
    return `
      <div class="task-item ${concluidaClass} ${prioridadeClass}">
        <div class="task-check ${checkedClass}" data-id="${tarefa.id}">${tarefa.concluida ? '&#10003;' : ''}</div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(tarefa.titulo)}</div>
          ${tarefa.descricao ? `<div class="task-desc">${escapeHtml(tarefa.descricao)}</div>` : ''}
          <div class="task-meta">
            <span class="tag tag-${tarefa.categoria}">${catLabels[tarefa.categoria]}</span>
            <span class="tag tag-${tarefa.prioridade}">${priLabels[tarefa.prioridade]}</span>
          </div>
        </div>
        <div class="task-actions">
          <button class="btn-icon" data-edit="${tarefa.id}" title="Editar">&#9998;</button>
          <button class="btn-icon" data-delete="${tarefa.id}" title="Excluir">&#10005;</button>
        </div>
      </div>
    `;
  }).join('');
  elements.taskList.querySelectorAll('.task-check').forEach(el => {
    el.addEventListener('click', () => toggleConcluida(el.dataset.id));
  });
  elements.taskList.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', () => abrirModal(el.dataset.edit));
  });
  elements.taskList.querySelectorAll('[data-delete]').forEach(el => {
    el.addEventListener('click', () => removerTarefa(el.dataset.delete));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function abrirModal(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;
  elements.editId.value = tarefa.id;
  elements.editTitle.value = tarefa.titulo;
  elements.editDesc.value = tarefa.descricao || '';
  elements.editCategory.value = tarefa.categoria;
  elements.editPriority.value = tarefa.prioridade;
  elements.editModal.classList.add('active');
}

function fecharModal() {
  elements.editModal.classList.remove('active');
}

function carregarConfig() {
  try {
    const dados = localStorage.getItem(CONFIG_KEY);
    return dados ? JSON.parse(dados) : { tema: 'padrao', fonte: 'padrao' };
  } catch {
    return { tema: 'padrao', fonte: 'padrao' };
  }
}

function salvarConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function aplicarTema(tema) {
  document.body.classList.toggle('theme-personalizado', tema === 'personalizado');
  elements.themeOptions.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === tema);
  });
}

function aplicarFonte(fonte) {
  document.body.classList.remove('fonte-serif', 'fonte-arial');
  if (fonte !== 'padrao') {
    document.body.classList.add('fonte-' + fonte);
  }
  elements.fontOptions.querySelectorAll('.font-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.font === fonte);
  });
}

function aplicarConfig(config) {
  aplicarTema(config.tema);
  aplicarFonte(config.fonte);
}

let config = carregarConfig();
let telegramConfig = carregarTelegram();

if (elements.telegramChatId) {
  elements.telegramChatId.value = telegramConfig.chatId;

  elements.btnSaveTelegram.addEventListener('click', () => {
    const chatId = elements.telegramChatId.value.trim();
    if (!chatId) return;
    salvarTelegram({ chatId });
    alert('Configuração salva!');
  });

  elements.btnTestTelegram.addEventListener('click', async () => {
    const chatId = elements.telegramChatId.value.trim();
    if (!chatId) { alert('Informe um Chat ID primeiro.'); return; }
    salvarTelegram({ chatId });
    const msg = '🔔 <b>Mentor Digital</b>\nConexão estabelecida com sucesso! ✅';
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: msg }),
      });
      if (res.ok) {
        alert('Mensagem enviada! Verifique seu Telegram.');
      } else {
        const err = await res.json();
        alert('Erro: ' + (err.error || 'Falha ao enviar'));
      }
    } catch {
      alert('Erro de conexão com o servidor.');
    }
  });
}

atualizarStatusTelegram();

elements.btnCustomize.addEventListener('click', () => {
  elements.customizePanel.classList.toggle('customize-hidden');
});

elements.closeCustomize.addEventListener('click', () => {
  elements.customizePanel.classList.add('customize-hidden');
});

elements.themeOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.theme-btn');
  if (!btn) return;
  config.tema = btn.dataset.theme;
  salvarConfig(config);
  aplicarConfig(config);
});

elements.fontOptions.addEventListener('click', (e) => {
  const btn = e.target.closest('.font-btn');
  if (!btn) return;
  config.fonte = btn.dataset.font;
  salvarConfig(config);
  aplicarConfig(config);
});

elements.taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const titulo = document.getElementById('taskTitle').value.trim();
  const descricao = document.getElementById('taskDesc').value.trim();
  const categoria = document.getElementById('taskCategory').value;
  const prioridade = document.getElementById('taskPriority').value;
  if (!titulo) return;
  adicionarTarefa(titulo, descricao, categoria, prioridade);
  elements.taskForm.reset();
  document.getElementById('taskTitle').focus();
});

elements.editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = elements.editId.value;
  const titulo = elements.editTitle.value.trim();
  const descricao = elements.editDesc.value.trim();
  const categoria = elements.editCategory.value;
  const prioridade = elements.editPriority.value;
  if (!id || !titulo) return;
  editarTarefa(id, titulo, descricao, categoria, prioridade);
  fecharModal();
});

elements.cancelEdit.addEventListener('click', fecharModal);
elements.editModal.addEventListener('click', (e) => {
  if (e.target === elements.editModal) fecharModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') fecharModal();
});

elements.filterTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  elements.filterTabs.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filtroAtual = btn.dataset.filter;
  renderizar();
});

elements.searchInput.addEventListener('input', (e) => {
  termoBusca = e.target.value;
  renderizar();
});

carregarTarefas();
aplicarConfig(config);
