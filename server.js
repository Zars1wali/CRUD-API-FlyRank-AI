const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");

const Database = require("better-sqlite3");

const app = express();
app.use(express.json());

// Initialize SQLite database
const db = new Database("tasks.db");

// Create tasks table if it doesn't already exist
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  );
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
    endpoints: ["/tasks"],
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/tasks", (req, res) => {
  res.json(tasks);
});

app.get("/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(task);
});

app.post("/tasks", (req, res) => {
  if (!req.body.title || req.body.title.trim() === "") {
    return res.status(400).json({ error: "Title is required and cannot be empty" });
  }
  const task = { id: nextId++, title: req.body.title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.put("/tasks/:id", (req, res) => {
  const task = tasks.find((t) => t.id === parseInt(req.params.id));
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  if (req.body.title !== undefined && req.body.title.trim() === "") {
    return res.status(400).json({ error: "Title cannot be empty" });
  }
  if (req.body.title !== undefined) task.title = req.body.title.trim();
  if (req.body.done !== undefined) task.done = req.body.done;
  res.json(task);
});

app.delete("/tasks/:id", (req, res) => {
  const index = tasks.findIndex((t) => t.id === parseInt(req.params.id));
  if (index === -1) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  tasks.splice(index, 1);
  res.status(204).send();
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger UI at http://localhost:${PORT}/docs`);
});
