# CRUD API FlyRank AI — SQLite Persistence (Week 3 / A2)

A clean, RESTful CRUD API for managing to-do tasks, built with **Node.js**, **Express**, and **SQLite** (`better-sqlite3`).

This project demonstrates the core architectural principle: **"APIs describe what your application does; databases describe where your application stores its data."** The storage layer has been transitioned from an ephemeral in-memory array to a persistent, disk-backed SQLite database, while preserving 100% of the API contract.

---

## Quickstart

### One Command to Start
```bash
npm install
npm start
```

The server will automatically:
1. Initialize the SQLite database file (`tasks.db`) if it doesn't already exist.
2. Create the `tasks` schema and performance indexes.
3. Automatically seed the initial 3 example tasks if the database is empty.
4. Listen on `http://localhost:3000`.

- **Swagger UI Interactive Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## Why SQLite Was Chosen

1. **Single-File Simplicity**: The entire database resides in a single cross-platform disk file (`tasks.db`). No separate database process, port binding, or user permission management is required.
2. **Zero Configuration**: SQLite requires zero installation or runtime server configuration. The database file is created automatically on application launch.
3. **True Persistence**: Unlike in-memory arrays where data disappears on server reboot, SQLite persists rows directly to disk. Your data survives crashes, updates, and restarts.
4. **ACID-Compliant Transactions**: Offers rock-solid reliability with atomic transactions (`db.transaction`), ensuring multi-row operations either completely succeed or roll back with zero corrupted state.
5. **Synchronous & Fast**: With `better-sqlite3`, queries execute synchronously without unnecessary `async/await` overhead, producing clean and deterministic backend code.

---

## Where the Database File Lives

- **File Path**: `./tasks.db` in the repository root.
- **Git Ignored**: `tasks.db` and its journal/WAL files are explicitly listed in `.gitignore`. Every fresh clone or clean checkout boots into an empty state and automatically creates and seeds its own local database.

---

## Database Schema & Indexing

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0
);

-- Performance indexes for search and filter queries
CREATE INDEX IF NOT EXISTS idx_tasks_done ON tasks(done);
CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title);
```

> **What an index is for**: An index acts like an alphabetical index at the back of a book. Instead of scanning every single row sequentially (full table scan, $O(N)$), SQLite searches a sorted B-tree structure ($O(\log N)$) to instantly locate matching rows by completion status (`done`) or title (`title`).

---

## DB Browser for SQLite Verification

The database file `tasks.db` was inspected and verified using [DB Browser for SQLite](https://sqlitebrowser.org/):

![DB Browser for SQLite Screenshot](db-browser-screenshot.png)

### Example SQL Queries Executed by Hand (Stage 4)

#### Query 1: List all tasks
```sql
SELECT * FROM tasks;
```
**Output:**
```text
(1, 'Buy groceries', 0)
(2, 'Walk the dog', 1)
(3, 'Read a book', 0)
```
*Explanation: Returns every row and column currently stored in the `tasks` table.*

#### Query 2: Filter completed tasks
```sql
SELECT * FROM tasks WHERE done = 1;
```
**Output:**
```text
(2, 'Walk the dog', 1)
```
*Explanation: Filters the rows using a SQL `WHERE` clause, isolating only tasks where `done` equals 1 (true).*

#### Query 3: Count total tasks
```sql
SELECT COUNT(*) FROM tasks;
```
**Output:**
```text
3
```
*Explanation: Evaluates the total number of records directly inside the database engine.*

---

## Endpoints & API Reference

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| GET | `/` | API info (name, version, endpoints) | `200` |
| GET | `/health` | Health check | `200` |
| GET | `/stats` | Aggregate task statistics computed in SQL | `200` |
| GET | `/tasks` | List tasks (supports `?search=`, `?done=`, `?sort=`) | `200` |
| GET | `/tasks/:id` | Get single task by ID | `200`, `404` |
| POST | `/tasks` | Create a new task (`{ "title": "..." }`) | `201`, `400` |
| PUT | `/tasks/:id` | Update task title and/or done status | `200`, `400`, `404` |
| DELETE | `/tasks/:id` | Delete task by ID | `204`, `404` |

### Query Parameters for `GET /tasks`
- **Search by keyword**: `GET /tasks?search=dog` (SQL `WHERE title LIKE '%dog%'`)
- **Filter by status**: `GET /tasks?done=true` or `GET /tasks?done=false` (SQL `WHERE done = ?`)
- **Sort alphabetically**: `GET /tasks?sort=title` (SQL `ORDER BY title COLLATE NOCASE ASC`)

---

## Why Storage is "Just an Implementation Detail"

In Assignment 1, the tasks were stored in a JavaScript variable `let tasks = [...]`. In this assignment, tasks are stored on disk in SQLite via `better-sqlite3`.

The client sends the exact same HTTP requests, receives the exact same JSON payloads, and observes the exact same HTTP status codes:
- Identical automated test suites and curl scripts pass against both versions without altering a single character of client code.
- This demonstrates that an **API is a behavioral contract**. As long as the contract is honored, the storage layer underneath can be swapped from memory to SQLite, to PostgreSQL, or to DynamoDB with zero disruption to the consumer.

---

## Seeding & Atomic Transactions

Multi-step seeding is wrapped inside an atomic transaction:
```javascript
const seedTransaction = db.transaction((items) => {
  for (const item of items) {
    insertTask.run(item.title, item.done);
  }
});
seedTransaction(seedTasks);
```
> **Why transactions matter**: Transactions guarantee **Atomicity** (the 'A' in ACID). If inserting task #3 failed, tasks #1 and #2 would be automatically rolled back rather than leaving a half-seeded or corrupted database.

---

## AI vs Me — Stage 6: The SQLite Rematch

### The Prompt
> "Migrate an existing Express CRUD task API from an in-memory array to a SQLite database using `better-sqlite3`. The database file must be named `tasks.db` and created automatically. Create a table named `tasks` with columns: `id` (integer primary key autoincrement), `title` (text not null), and `done` (boolean/integer default 0). Only if the table is empty, seed three example tasks: 'Buy groceries' (pending), 'Walk the dog' (done), and 'Read a book' (pending). Maintain exact endpoint behavior: GET /tasks, GET /tasks/:id, POST /tasks, PUT /tasks/:id, DELETE /tasks/:id, with 400 for empty or missing title, 404 for unknown IDs, and correct status codes (200, 201, 204). Use parameterized queries for all user input."

---

### Comparison & Code Review (`git diff --no-index server.js ai-version/server.js`)

#### 1. What Did the AI Do Better?
- **Concise Parameter Destructuring**: In `POST /tasks`, the AI concisely extracted `{ title } = req.body` directly rather than referencing `req.body.title`.
- **Direct Default Parameter Values**: In the schema declaration, the AI cleanly specified `done INTEGER DEFAULT 0` and passed `0` directly in the query `INSERT INTO tasks (title, done) VALUES (?, 0)` for creation, simplifying the parameter binding.

#### 2. What Did the AI Get Wrong or Quietly Ignore?
- **Data Type Discrepancy (`done` Boolean vs Integer)**: SQLite does not have a native boolean type and stores booleans as `0` or `1`. The AI returned raw SQLite rows directly in `GET /tasks` (`res.json(tasks)`), returning `{"done": 0}` instead of `{"done": false}`. This quietly violates the API response contract established in Assignment 1 where `done` was a JavaScript boolean. Our hand-built version maps `Boolean(row.done)` to guarantee full backwards compatibility.
- **No Multi-step Transaction for Seeding**: The AI inserted the seed rows with individual `insert.run(...)` calls without wrapping them in a database transaction (`db.transaction`). If an insertion failed midway, the database would be left in an inconsistent, partially-seeded state.
- **Missing Database Indexes**: The AI did not create performance indexes on `done` or `title`, leaving any future search or filter queries subject to full table scans.
- **Dropped Ancillary Endpoints**: The AI completely omitted `GET /`, `GET /health`, and Swagger UI (`/docs`), focusing narrowly only on the CRUD endpoints.
- **Whitespace Validation on Update**: In `PUT /tasks/:id`, the AI updated `newTitle = title !== undefined ? title : task.title` without checking if `title.trim() === ""`, permitting empty whitespace titles to overwrite existing valid titles.

#### 3. What Did My Prompt Forget to Specify — and What Did the AI Silently Decide?
- **Boolean Serialization**: The prompt stated *"done (boolean/integer default 0)"*, which was ambiguous. The AI silently decided to return raw integers (`0`/`1`) rather than converting to booleans in the JSON response layer.
- **Atomic Seeding**: The prompt did not explicitly mention "transaction-wrapped seeding," so the AI took the easiest path and ran sequential unbatched statements.
- **Ancillary Routes & Swagger**: The prompt did not explicitly list the `/` info endpoint, `/health`, or Swagger UI, so the AI treated them as out of scope.

---

### The Rematch Prompt & What Changed
> **Improved Prompt**: "Migrate our Express CRUD Task API to `better-sqlite3` (`tasks.db`). Keep existing `/`, `/health`, and `/docs` routes untouched. In SQLite, store `done` as `0`/`1`, but in all API JSON responses, serialize `done` as a strict JSON boolean (`true`/`false`). Wrap table seeding in an atomic `db.transaction(...)`. Create indexes on `done` and `title`. Reject whitespace-only titles on both POST and PUT with HTTP 400."

**One-sentence result**: When constraints like boolean serialization, transactions, and index creation were explicitly mandated in the prompt, the AI generated production-grade code that matched our hand-built implementation almost line-for-line.
