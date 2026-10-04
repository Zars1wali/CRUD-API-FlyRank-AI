# CRUD API FlyRank AI — Auth · Login & Protect (Week 2 / A4)

<div align="center">

[![NodeJS](https://img.shields.io/badge/node.js-%236DA55F.svg?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)](https://expressjs.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PostgreSQL](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Swagger](https://img.shields.io/badge/-Swagger-%23Clojure?style=for-the-badge&logo=swagger&logoColor=white)](https://swagger.io/)
[![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

A production-grade, secure RESTful API built with **Node.js**, **Express**, and **Supabase Auth** as the trusted Identity Provider (IdP). This assignment transitions our API from an open prototype into a gated, production-ready system where every sensitive route verifies cryptographic JSON Web Tokens (JWTs).


---

## ⚡ The Big Idea & The Trust Triangle

Authentication in modern backend architectures relies on a trust triangle between the **Client**, your **Backend Server**, and the **Identity Provider (Supabase Auth)**:

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Server as Backend Server (Express)
    participant Supabase as Supabase Auth (IdP)

    Note over Client,Supabase: 1. Sign Up / Log In Flow
    Client->>Server: POST /auth/signup or /auth/login (email, password)
    Server->>Supabase: supabase.auth.signUp() or signInWithPassword()
    Supabase-->>Server: User object + Signed JWT (access_token & refresh_token)
    Server-->>Client: 201 Created (Signup) / 200 OK with access_token (Login)

    Note over Client,Supabase: 2. Protected Resource Access Flow
    Client->>Server: GET /protected/profile (Authorization: Bearer <token>)
    Server->>Server: Extract token from header
    Server->>Supabase: supabase.auth.getUser(token)
    alt Token is valid
        Supabase-->>Server: User metadata (id, email, created_at)
        Server-->>Client: 200 OK + User Profile JSON
    else Token is missing/malformed
        Server-->>Client: 401 Unauthorized {"error": "Access token required"}
    else Token is invalid/tampered/expired
        Server-->>Client: 401 Unauthorized {"error": "Invalid or expired token"}
    end
```

### The Golden Rule
> **Never store plain passwords and never write custom password-hashing code.**  
> Supabase stores account credentials, hashes passwords with industry-standard cryptography, and signs JWTs. The backend's responsibility is solely to receive tokens, verify signatures against Supabase, and grant or deny access.

---

## 🚀 Quickstart: One Command to Run Everything

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/Zars1wali/CRUD-API-FlyRank-AI.git
cd CRUD-API-FlyRank-AI
npm install

# 2. Configure environment secrets
cp .env.example .env
# Edit .env with your SUPABASE_URL and SUPABASE_KEY (anon key)

# 3. Start the API server
npm start
```

The server starts immediately at **http://localhost:3000** and connects to Supabase Auth.
- **Interactive Swagger Documentation**: [http://localhost:3000/docs](http://localhost:3000/docs)

---

## 🔐 Environment Variables & Secrets Configuration

All sensitive configuration and Identity Provider keys are loaded via environment variables using `dotenv`.

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Description | Example |
| :--- | :--- | :--- |
| `SUPABASE_URL` | Your Supabase Project URL | `https://your-project.supabase.co` |
| `SUPABASE_KEY` | Supabase Public `anon` key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `PORT` | API server listen port | `3000` |
| `DATABASE_URL` | (Optional) PostgreSQL connection string from A3 | `postgres://postgres:dev@localhost:5432/tasks` |

> **Security Guardrail**: `.env` is listed in `.gitignore` and must **never** be committed to version control. Only public `anon` keys are used in client contexts; the `service_role` key is strictly forbidden here as it bypasses Row Level Security.

---

## 🔌 API Endpoint Reference Table

| Route | HTTP Verb | Purpose | Auth Required | Success Status | Error Statuses |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/public/info` | `GET` | Open public information | None | `200 OK` | — |
| `/auth/signup` | `POST` | Register a new user | None | `201 Created` | `400 Bad Request` |
| `/auth/login` | `POST` | Authenticate credentials & get JWT | None | `200 OK` | `400 Bad Request`, `401 Unauthorized` |
| `/auth/logout` | `POST` | Invalidate user session | `Bearer <token>` | `204 No Content`| `401 Unauthorized` |
| `/protected/profile` | `GET` | Retrieve private profile metadata | `Bearer <token>` | `200 OK` | `401 Unauthorized` |
| `/protected/dashboard`| `GET` | Protected user dashboard (middleware test) | `Bearer <token>` | `200 OK` | `401 Unauthorized` |
| `/protected/admin` | `GET` | Admin-only route (**403 demonstration**) | `Bearer <token>` | `200 OK` | `401 Unauthorized`, `403 Forbidden` |

---

## 🛡️ Authentication vs. Authorization (401 vs. 403)

Our API clearly distinguishes between **Authentication** and **Authorization**:

| Concept | Status Code | Meaning | Analogy |
| :--- | :--- | :--- | :--- |
| **Authentication** | `401 Unauthorized` | *"I don't know who you are."* The request is missing a token, the format is malformed, or the token is expired/forged. | Showing up at the building gate without an ID badge. |
| **Authorization** | `403 Forbidden` | *"I know who you are, but you are not allowed in here."* The user presented a valid, verified token, but does not possess the required role (e.g. non-admin attempting to access `/protected/admin`). | An employee with a valid badge trying to enter the CEO's private vault. |

---

## 📸 Interactive Swagger UI with Bearer Authentication

The interactive API documentation is served at `/docs` using `swagger-ui-express` and an OpenAPI 3.0 specification configured with `securitySchemes` for HTTP Bearer JWT:

![Swagger UI with Bearer Auth](swagger-auth-screenshot.png)

### Testing in the Browser
1. Navigate to [http://localhost:3000/docs](http://localhost:3000/docs).
2. Click the **Authorize** button (padlock icon) at the top right.
3. Paste the JWT `access_token` obtained from `POST /auth/login`.
4. Click **Authorize**, then click **Close**.
5. Test any locked route (e.g., `GET /protected/profile` or `GET /protected/dashboard`) with the **Try it out** button!

---

## 🧪 Terminal Verification with `curl`

### 1. Register a New Account (`201 Created`)
```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"student@flyrank.ai","password":"Password123!"}'
```

### 2. Validation Guardrail (`400 Bad Request`)
```bash
curl -i -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"student@flyrank.ai"}'
```

### 3. Log In to Receive JWT (`200 OK`)
```bash
curl -i -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@flyrank.ai","password":"Password123!"}'
```
*Response returns `{ "access_token": "...", "refresh_token": "..." }`.*

### 4. Access Protected Profile with Valid Token (`200 OK`)
```bash
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
```

### 5. Verify Token Rejection with Tampered Token (`401 Unauthorized`)
```bash
# Change a single character in the token:
curl -i http://localhost:3000/protected/profile \
  -H "Authorization: Bearer <TAMPERED_TOKEN>"
```

### 6. Verify 403 Forbidden on Admin Endpoint (`403 Forbidden`)
```bash
curl -i http://localhost:3000/protected/admin \
  -H "Authorization: Bearer <STANDARD_USER_ACCESS_TOKEN>"
```

### 7. End Session (`204 No Content`)
```bash
curl -i -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer <PASTE_YOUR_ACCESS_TOKEN>"
```

---

## 📜 Stage Commit History

This repository demonstrates incremental, verifiable git commits:

```text
* Stage 6: publish to GitHub and write README — then push everything
* Extras: add 403 Forbidden admin route and documentation
* Stage 5: Swagger UI documentation with bearer auth
* Stage 4: auth middleware and logout endpoint
* Stage 3: profile route token verification
* Stage 2: public route and unverified protected route
* Stage 1: signup and login routes working
* Stage 0: setup server and supabase client
```
