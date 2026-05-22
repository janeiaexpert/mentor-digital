const { createClient } = require('@supabase/supabase-js')

let client = null

function getClient() {
  if (client) return client

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  if (supabaseUrl && supabaseKey) {
    client = createClient(supabaseUrl, supabaseKey)
  }
  return client
}

module.exports = { getClient }
