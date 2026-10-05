require("dotenv").config();
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./openapi.json");
const db = require("./db");
const supabase = require("./supabaseClient");

const app = express();
app.use(express.json());

// Catch malformed JSON bodies and return clean JSON 400
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  next(err);
});


const triageRouter = require("./src/routes/triage");

app.get("/", (req, res) => {
  res.json({
    name: "CRUD API FlyRank AI",
    version: "1.0",
    endpoints: [
      "/tasks",
      "/tasks/:id",
      "/health",
      "/stats",
      "/auth/signup",
      "/auth/login",
      "/auth/logout",
      "/public/info",
      "/protected/profile",
      "/protected/dashboard",
      "/triage",
    ],
  });
});

app.use("/triage", triageRouter);


// --- Stage 1: Open auth: Sign Up & Log In ---
app.post("/auth/signup", async (req, res) => {
  const { email, password } = req.body || {};

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password.trim()
  ) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json(data.user);
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (
    !email ||
    !password ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password.trim()
  ) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error || !data.session) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    return res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// --- Stage 2: The public & protected gates ---
app.get("/public/info", (req, res) => {
  res.status(200).json({ message: "Welcome stranger! This info is public." });
});

// --- Stage 4: Reusable Auth Middleware Guard ---
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token required" });
  }

  const token = authHeader.split(" ")[1];
  if (!token || token.trim() === "") {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Stage 4: Reusable protected profile route
app.get("/protected/profile", requireAuth, (req, res) => {
  res.status(200).json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at,
  });
});

// Stage 4 Checkpoint: Second protected route proving middleware reuse
app.get("/protected/dashboard", requireAuth, (req, res) => {
  res.status(200).json({
    message: `Hello ${req.user.email}, welcome to your protected dashboard!`,
    user_id: req.user.id,
    created_at: req.user.created_at,
  });
});

// --- Extras: 403 Forbidden Admin Route (Authentication vs Authorization) ---
app.get("/protected/admin", requireAuth, (req, res) => {
  const isAdmin =
    req.user.app_metadata?.role === "admin" ||
    req.user.user_metadata?.role === "admin" ||
    (req.user.email && req.user.email.endsWith("@admin.com"));

  if (!isAdmin) {
    return res.status(403).json({
      error: "Forbidden: You are authenticated, but you lack admin privileges.",
    });
  }

  return res.status(200).json({
    message: "Welcome to the Admin Console.",
    admin_user: req.user.email,
  });
});

// Stage 4: Logout endpoint (protected)
app.post("/auth/logout", requireAuth, async (req, res) => {
  try {
    await supabase.auth.signOut();
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Internal Server Error" });
  }
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

async function startServer() {
  try {
    await db.initDb();
  } catch (err) {
    console.warn("⚠️ Warning: PostgreSQL initialization skipped or failed. Continuing server launch for Auth endpoints.");
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT} and connected to Supabase`);
    console.log(`Swagger UI at http://localhost:${PORT}/docs`);
  });
}

startServer();

