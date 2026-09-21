const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
app.use(express.json());

// Initialize SQLite database
const db = new Database(path.join(__dirname, "tasks.db"));

// Create tasks table and indexes if they do not already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
  CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
`);

// Seed three example tasks only if the table is empty
const countResult = db.prepare("SELECT COUNT(*) AS count FROM tasks").get();
if (countResult.count === 0) {
  const insertTask = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const seedTasks = [
    { title: "Buy groceries", done: 0 },
    { title: "Walk the dog", done: 1 },
    { title: "Read a book", done: 0 },
  ];
  const seedTransaction = db.transaction((items) => {
    for (const item of items) {
      insertTask.run(item.title, item.done);
    }
  });
  seedTransaction(seedTasks);
}

app.get("/", (req, res) => {
  res.json({
    name: "Task API",
    version: "1.0",
    endpoints: ["/tasks", "/tasks/:id", "/health", "/stats"],
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Statistics endpoint computed with SQL aggregate functions
app.get("/stats", (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) AS pending
    FROM tasks
  `).get();

  res.json({
    total: stats.total,
    completed: stats.completed || 0,
    pending: stats.pending || 0,
  });
});

// List tasks with optional SQL search, status filter, and sorting
app.get("/tasks", (req, res) => {
  let query = "SELECT * FROM tasks";
  const conditions = [];
  const params = [];

  if (req.query.search) {
    conditions.push("title LIKE ?");
    params.push(`%${req.query.search}%`);
  }

  if (req.query.done !== undefined) {
    const isDone = req.query.done === "true" || req.query.done === "1";
    conditions.push("done = ?");
    params.push(isDone ? 1 : 0);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  if (req.query.sort === "title") {
    query += " ORDER BY title COLLATE NOCASE ASC";
  } else {
    query += " ORDER BY id ASC";
  }

  const rows = db.prepare(query).all(...params);
  const tasks = rows.map((task) => ({
    id: task.id,
    title: task.title,
    done: Boolean(task.done),
  }));
  res.json(tasks);
});

app.get("/tasks/:id", (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.json({
    id: task.id,
    title: task.title,
    done: Boolean(task.done),
  });
});

app.post("/tasks", (req, res) => {
  if (!req.body || !req.body.title || req.body.title.trim() === "") {
    return res.status(400).json({ error: "Title is required and cannot be empty" });
  }
  const title = req.body.title.trim();
  const stmt = db.prepare("INSERT INTO tasks (title, done) VALUES (?, ?)");
  const info = stmt.run(title, 0);
  res.status(201).json({
    id: Number(info.lastInsertRowid),
    title: title,
    done: false,
  });
});

app.put("/tasks/:id", (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  if (req.body.title !== undefined && (typeof req.body.title !== "string" || req.body.title.trim() === "")) {
    return res.status(400).json({ error: "Title cannot be empty" });
  }
  const newTitle = req.body.title !== undefined ? req.body.title.trim() : task.title;
  const newDone = req.body.done !== undefined ? (req.body.done ? 1 : 0) : task.done;

  db.prepare("UPDATE tasks SET title = ?, done = ? WHERE id = ?").run(newTitle, newDone, task.id);

  res.json({
    id: task.id,
    title: newTitle,
    done: Boolean(newDone),
  });
});

app.delete("/tasks/:id", (req, res) => {
  const info = db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: "Task not found" });
  }
  res.status(204).send();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI at http://localhost:${PORT}/docs`);
});
