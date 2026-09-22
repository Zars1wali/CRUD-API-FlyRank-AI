const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Setup database
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE
    )
  `);

  const countRes = await pool.query('SELECT COUNT(*) FROM tasks');
  if (parseInt(countRes.rows[0].count) === 0) {
    await pool.query("INSERT INTO tasks (title, done) VALUES ('Buy groceries', false), ('Walk the dog', true), ('Read a book', false)");
  }
}
init();

app.get('/tasks', async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks');
  res.json(result.rows);
});

app.get('/tasks/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(result.rows[0]);
});

app.post('/tasks', async (req, res) => {
  const { title } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const result = await pool.query('INSERT INTO tasks (title, done) VALUES ($1, false) RETURNING *', [title]);
  res.status(201).json(result.rows[0]);
});

app.put('/tasks/:id', async (req, res) => {
  const { title, done } = req.body;
  const result = await pool.query('UPDATE tasks SET title = COALESCE($1, title), done = COALESCE($2, done) WHERE id = $3 RETURNING *', [title, done, req.params.id]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(result.rows[0]);
});

app.delete('/tasks/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.status(204).send();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
