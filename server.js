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

app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// Statistics endpoint computed with SQL aggregate functions
app.get("/stats", async (req, res) => {
  try {
    const statsResult = await db.query(`
      SELECT
        COUNT(*)::int AS total,
        COALESCE(SUM(CASE WHEN done = TRUE THEN 1 ELSE 0 END), 0)::int AS completed,
        COALESCE(SUM(CASE WHEN done = FALSE THEN 1 ELSE 0 END), 0)::int AS pending
      FROM tasks;
    `);
    const stats = statsResult.rows[0];
    res.json({
      total: stats.total,
      completed: stats.completed,
      pending: stats.pending,
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
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

app.post("/tasks", async (req, res) => {
  if (!req.body || !req.body.title || typeof req.body.title !== "string" || req.body.title.trim() === "") {
    return res.status(400).json({ error: "Title is required and cannot be empty" });
  }
  const title = req.body.title.trim();
  try {
    const result = await db.query(
      "INSERT INTO tasks (title, done) VALUES ($1, $2) RETURNING *",
      [title, false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/tasks/:id", async (req, res) => {
  try {
    const existing = await db.query("SELECT * FROM tasks WHERE id = $1", [req.params.id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    const task = existing.rows[0];

    if (req.body.title !== undefined && (typeof req.body.title !== "string" || req.body.title.trim() === "")) {
      return res.status(400).json({ error: "Title cannot be empty" });
    }

    const newTitle = req.body.title !== undefined ? req.body.title.trim() : task.title;
    const newDone = req.body.done !== undefined ? Boolean(req.body.done) : task.done;

    const result = await db.query(
      "UPDATE tasks SET title = $1, done = $2 WHERE id = $3 RETURNING *",
      [newTitle, newDone, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    return res.status(404).json({ error: "Task not found" });
  }
});

app.delete("/tasks/:id", async (req, res) => {
  try {
    const result = await db.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.status(204).send();
  } catch (err) {
    return res.status(404).json({ error: "Task not found" });
  }
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
