const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mentor_digital_secret_key_2026';

const db = new Database(path.join(__dirname, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    senha TEXT NOT NULL,
    criado_em TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS tarefas (
    id TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    categoria TEXT NOT NULL DEFAULT 'diaria',
    prioridade TEXT NOT NULL DEFAULT 'media',
    concluida INTEGER NOT NULL DEFAULT 0,
    criada_em TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ erro: 'Token nao fornecido' });
  try {
    const decoded = jwt.verify(header.replace('Bearer ', ''), JWT_SECRET);
    req.usuarioId = decoded.id;
    next();
  } catch {
    res.status(401).json({ erro: 'Token invalido' });
  }
}

app.post('/api/registrar', async (req, res) => {
  try {
    const { email, nome, senha } = req.body;
    if (!email || !nome || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
    if (senha.length < 4) return res.status(400).json({ erro: 'Senha deve ter no minimo 4 caracteres' });

    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existente) return res.status(400).json({ erro: 'Email ja cadastrado' });

    const hash = await bcrypt.hash(senha, 10);
    const result = db.prepare('INSERT INTO usuarios (email, nome, senha) VALUES (?, ?, ?)').run(email, nome, hash);

    const token = jwt.sign({ id: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: result.lastInsertRowid, email, nome } });
  } catch (err) {
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: 'Preencha email e senha' });

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!usuario) return res.status(401).json({ erro: 'Email ou senha incorretos' });

    const valida = await bcrypt.compare(senha, usuario.senha);
    if (!valida) return res.status(401).json({ erro: 'Email ou senha incorretos' });

    const token = jwt.sign({ id: usuario.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome } });
  } catch {
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

app.get('/api/me', auth, (req, res) => {
  const usuario = db.prepare('SELECT id, email, nome FROM usuarios WHERE id = ?').get(req.usuarioId);
  if (!usuario) return res.status(404).json({ erro: 'Usuario nao encontrado' });
  res.json(usuario);
});

app.get('/api/tarefas', auth, (req, res) => {
  const tarefas = db.prepare('SELECT * FROM tarefas WHERE usuario_id = ? ORDER BY concluida ASC, CASE prioridade WHEN "alta" THEN 0 WHEN "media" THEN 1 ELSE 2 END').all(req.usuarioId);
  res.json(tarefas.map(t => ({ ...t, concluida: !!t.concluida })));
});

app.post('/api/tarefas', auth, (req, res) => {
  const { titulo, descricao, categoria, prioridade } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'Titulo obrigatorio' });

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  db.prepare('INSERT INTO tarefas (id, usuario_id, titulo, descricao, categoria, prioridade) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.usuarioId, titulo, descricao || '', categoria || 'diaria', prioridade || 'media');

  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(id);
  res.json({ ...tarefa, concluida: !!tarefa.concluida });
});

app.put('/api/tarefas/:id', auth, (req, res) => {
  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuarioId);
  if (!tarefa) return res.status(404).json({ erro: 'Tarefa nao encontrada' });

  const { titulo, descricao, categoria, prioridade, concluida } = req.body;
  db.prepare('UPDATE tarefas SET titulo = ?, descricao = ?, categoria = ?, prioridade = ?, concluida = ? WHERE id = ?')
    .run(titulo ?? tarefa.titulo, descricao ?? tarefa.descricao, categoria ?? tarefa.categoria, prioridade ?? tarefa.prioridade, concluida !== undefined ? (concluida ? 1 : 0) : tarefa.concluida, req.params.id);

  const updated = db.prepare('SELECT * FROM tarefas WHERE id = ?').get(req.params.id);
  res.json({ ...updated, concluida: !!updated.concluida });
});

app.delete('/api/tarefas/:id', auth, (req, res) => {
  const tarefa = db.prepare('SELECT * FROM tarefas WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuarioId);
  if (!tarefa) return res.status(404).json({ erro: 'Tarefa nao encontrada' });
  db.prepare('DELETE FROM tarefas WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Tarefa excluida' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Mentor Digital rodando em http://localhost:${PORT}`);
});
