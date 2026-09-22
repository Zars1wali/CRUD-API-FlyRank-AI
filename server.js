require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");
const db = require("./db");

const app = express();
app.use(express.json());


app.get("/", (req, res) => {
  res.json({
    name: "CRUD API FlyRank AI",
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
app.get("/tasks", async (req, res) => {
  try {
    let sql = "SELECT * FROM tasks";
    const conditions = [];
    const params = [];

    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      conditions.push(`title ILIKE $${params.length}`);
    }

    if (req.query.done !== undefined) {
      const isDone = req.query.done === "true" || req.query.done === "1";
      params.push(isDone);
      conditions.push(`done = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    if (req.query.sort === "title") {
      sql += " ORDER BY title ASC";
    } else {
      sql += " ORDER BY id ASC";
    }

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/tasks/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    return res.status(404).json({ error: "Task not found" });
  }
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

db.initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Swagger UI at http://localhost:${PORT}/docs`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
