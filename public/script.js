const API = '';
const CONFIG_KEY = 'mentor_digital_config';

let tarefas = [];
let filtroAtual = 'todas';
let termoBusca = '';
let usuario = null;

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
  userName: document.getElementById('userName'),
  userArea: document.getElementById('userArea'),
  btnLogout: document.getElementById('btnLogout'),
};

function getToken() {
  return localStorage.getItem('token');
}

async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, { ...options, headers });
  const json = await res.json();
  if (!res.ok) throw new Error(json.erro || 'Erro na requisicao');
  return json;
}

async function carregarTarefas() {
  try {
    tarefas = await api('/api/tarefas');
  } catch {
    tarefas = [];
  }
}

async function adicionarTarefa(titulo, descricao, categoria, prioridade) {
  const tarefa = await api('/api/tarefas', {
    method: 'POST',
    body: JSON.stringify({ titulo, descricao, categoria, prioridade }),
  });
  tarefas.push(tarefa);
  renderizar();
}

async function editarTarefa(id, titulo, descricao, categoria, prioridade) {
  const updated = await api('/api/tarefas/' + id, {
    method: 'PUT',
    body: JSON.stringify({ titulo, descricao, categoria, prioridade }),
  });
  const idx = tarefas.findIndex(t => t.id === id);
  if (idx !== -1) tarefas[idx] = updated;
  renderizar();
}

async function toggleConcluida(id) {
  const tarefa = tarefas.find(t => t.id === id);
  if (!tarefa) return;
  const updated = await api('/api/tarefas/' + id, {
    method: 'PUT',
    body: JSON.stringify({ concluida: !tarefa.concluida }),
  });
  const idx = tarefas.findIndex(t => t.id === id);
  if (idx !== -1) tarefas[idx] = updated;
  renderizar();
}

async function removerTarefa(id) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
  await api('/api/tarefas/' + id, { method: 'DELETE' });
  tarefas = tarefas.filter(t => t.id !== id);
  renderizar();
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

elements.btnLogout.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = '/login.html';
});

elements.taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo = document.getElementById('taskTitle').value.trim();
  const descricao = document.getElementById('taskDesc').value.trim();
  const categoria = document.getElementById('taskCategory').value;
  const prioridade = document.getElementById('taskPriority').value;
  if (!titulo) return;
  await adicionarTarefa(titulo, descricao, categoria, prioridade);
  elements.taskForm.reset();
  document.getElementById('taskTitle').focus();
});

elements.editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = elements.editId.value;
  const titulo = elements.editTitle.value.trim();
  const descricao = elements.editDesc.value.trim();
  const categoria = elements.editCategory.value;
  const prioridade = elements.editPriority.value;
  if (!id || !titulo) return;
  await editarTarefa(id, titulo, descricao, categoria, prioridade);
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

async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  try {
    usuario = await api('/api/me');
    if (elements.userName) elements.userName.textContent = usuario.nome;
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    window.location.href = '/login.html';
    return;
  }

  await carregarTarefas();
  aplicarConfig(config);
  renderizar();
}

init();
