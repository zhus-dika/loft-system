const { Pool } = require('pg')

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'loft_system',
  password: 'qwerty',
  post: 5432
})

module.exports = pool
