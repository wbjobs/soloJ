const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

let pool;

async function init() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  await pool.query('SELECT 1');
  console.log('Database connected');

  await createTables();
}

async function createTables() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database schema initialized');
}

function getPool() {
  return pool;
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { init, getPool, query };
