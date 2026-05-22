const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

const headers = {
  apikey: supabaseKey,
  Authorization: `Bearer ${supabaseKey}`,
  'Content-Type': 'application/json',
}

async function query(method, path, body) {
  const url = `${supabaseUrl}/rest/v1/${path}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const text = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`)
  return text ? JSON.parse(text) : null
}

function listTasks() {
  return query('GET', 'tasks?order=criada_em.desc')
}

function getTask(id) {
  return query('GET', `tasks?id=eq.${id}&select=*`)
}

async function findTaskByPrefix(prefix) {
  const data = await query('GET', `tasks?id=like.${prefix}%&select=id`)
  return Array.isArray(data) && data.length > 0 ? data[0].id : null
}

function createTask(data) {
  return query('POST', 'tasks', data)
}

function updateTask(id, data) {
  return query('PATCH', `tasks?id=eq.${id}`, data)
}

function deleteTask(id) {
  return query('DELETE', `tasks?id=eq.${id}`)
}

module.exports = { listTasks, getTask, findTaskByPrefix, createTask, updateTask, deleteTask }
