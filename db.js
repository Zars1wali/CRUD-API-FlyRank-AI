require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  const client = await pool.connect();
  try {
    // Create tasks table and indexes if they do not exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
      CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
    `);

    // Seed three example tasks only if the table is empty
    const res = await client.query("SELECT COUNT(*) AS count FROM tasks;");
    const count = parseInt(res.rows[0].count, 10);

    if (count === 0) {
      await client.query(`
        BEGIN;
        INSERT INTO tasks (title, done) VALUES
          ('Buy groceries', false),
          ('Walk the dog', true),
          ('Read a book', false);
        COMMIT;
      `);
      console.log("Database initialized and 3 example tasks seeded.");
    }
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  initDb,
};
