# CRUD API FlyRank AI — Containerized PostgreSQL Stack (Week 1 / A3)

A production-grade, containerized RESTful CRUD API for managing tasks, built with **Node.js**, **Express**, **PostgreSQL**, and **Docker Compose**.

This assignment marks the third milestone in our storage ladder:
1. **Assignment 1**: In-Memory Array (`tasks = [...]`) — lost upon process termination.
2. **Assignment 2**: Embedded SQLite (`tasks.db`) — persistent disk file, single-machine embedded storage.
3. **Assignment 3 (This project)**: Enterprise PostgreSQL server running inside an isolated Docker container with named volume persistence, environment-based configuration, and unified multi-container orchestration.

---

## ⚡ One Command to Run Everything

Clone the repository and run:

```bash
cp .env.example .env
docker compose up -d --build
```

That's it! Docker Compose will:
1. Build the Node.js application container from `Dockerfile`.
2. Pull and boot the official `postgres:16-alpine` database image.
3. Attach the persistent named volume (`taskdata`).
4. Wait for PostgreSQL to become fully healthy before launching the API container.
5. Automatically create the `tasks` schema and seed the initial 3 tasks if empty.
6. Expose the API on `http://localhost:3000` and PostgreSQL on `localhost:5432`.

- **Interactive Swagger Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## 🔐 Environment Variables & Secrets

Configuration and database secrets are injected via environment variables. Copy the provided `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Example (Local Dev) | Docker Compose Default |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:dev@localhost:5432/tasks` | `postgres://postgres:dev@db:5432/tasks` |
| `PORT` | API server listen port | `3000` | `3000` |

> **Security Rule**: `.env` is strictly git-ignored to prevent credential leaks. Never commit live passwords to version control.

---

## 📸 Database Verification in Docker

The running PostgreSQL database was inspected inside the container using `psql`:

![PostgreSQL Database Screenshot](postgres-db-screenshot.png)

```text
tasks=# \dt
        List of relations
 Schema | Name  | Type  |  Owner   
--------+-------+-------+----------
 public | tasks | table | postgres
(1 row)

tasks=# SELECT * FROM tasks;
 id |     title     | done 
----+---------------+------
  1 | Buy groceries | f
  2 | Walk the dog  | t
  3 | Read a book   | f
(3 rows)
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `GET` | `/` | API service metadata | `200` |
| `GET` | `/health` | Deep health check (verifies live Postgres `SELECT 1`) | `200`, `500` |
| `GET` | `/stats` | Task statistics aggregated via SQL (`COUNT`, `SUM`) | `200`, `500` |
| `GET` | `/tasks` | List tasks (supports `?search=`, `?done=`, `?sort=`) | `200`, `500` |
| `GET` | `/tasks/:id` | Retrieve a single task by ID | `200`, `404` |
| `POST` | `/tasks` | Create a new task (`{ "title": "..." }`) | `201`, `400` |
| `PUT` | `/tasks/:id` | Update task title and/or done status | `200`, `400`, `404` |
| `DELETE` | `/tasks/:id` | Delete task by ID | `204`, `404` |

### Sample `curl -i` Verification

```text
$ curl -i http://localhost:3000/tasks/1

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 46
Date: Tue, 22 Sep 2026 21:05:00 GMT
Connection: keep-alive

{"id":1,"title":"Buy groceries","done":false}
```

```text
$ curl -i http://localhost:3000/tasks/999

HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8
Content-Length: 27
Date: Tue, 22 Sep 2026 21:05:02 GMT
Connection: keep-alive

{"error":"Task not found"}
```

---

## 🧠 Core Engineering Principles

### 1. Why Volumes Exist (The Mortality Experiment)
Containers are inherently ephemeral. If you run a PostgreSQL container without a volume, create database rows, and execute `docker rm -f <container>`, all written data is permanently destroyed when the container's writable layer is erased. 

Named volumes (`taskdata:/var/lib/postgresql/data`) decouple storage from the container lifecycle. When containers are restarted, destroyed, or upgraded (`docker compose down` then `up`), the volume remains on host disk, guaranteeing 100% data persistence.

### 2. Deep Health Checks
The `GET /health` endpoint does not simply return `{ "status": "ok" }`. It executes `SELECT 1;` against PostgreSQL to confirm real end-to-end database connectivity. In production systems, load balancers and Kubernetes readiness probes use this exact check to avoid routing customer traffic to instances with severed database connections.

### 3. Storage as an Implementation Detail
Throughout Assignments 1, 2, and 3, our storage layer evolved from **In-Memory arrays** to **SQLite files** to a **Containerized PostgreSQL cluster**. 

Yet, external consumers notice zero changes: the HTTP endpoints, JSON schemas, status codes, and error formats remain identical. This proves that clean APIs act as behavioral contracts, making backend storage an interchangeable implementation detail.
