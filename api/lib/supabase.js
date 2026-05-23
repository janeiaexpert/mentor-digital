const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function query(method, path, body) {
  const url = `${supabaseUrl}/rest/v1/${path}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

function listTasks() {
  return query('GET', 'tasks?order=criada_em.desc')
}

function getTask(id) {
  return query('GET', `tasks?id=like.${id}*&id:cast=text&select=*`)
}

function createTask(data) {
  return query('POST', 'tasks', data)
}

function updateTask(id, data) {
  return query('PATCH', `tasks?id=like.${id}*&id:cast=text`, data)
}

function deleteTask(id) {
  return query('DELETE', `tasks?id=like.${id}*&id:cast=text`)
}

module.exports = { listTasks, getTask, createTask, updateTask, deleteTask }
