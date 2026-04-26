# KlusRaak

> Marketplace MVP that connects clients with vetted craftsmen ("vakmannen") on demand.
> Dien een klus in en de eerste beschikbare vakman in de buurt neemt hem aan.

This repo is a production-ready, minimal-but-scalable MVP scaffolded as a real
startup would: a typed Node.js API, a relational database with migrations, a
mobile-first web client, and a Docker setup that runs the whole stack with one
command.

---

## 1. Architecture

```
                ┌──────────────────────────┐
                │        Web client        │
                │ HTML / CSS / vanilla JS  │
                │  (mobile-first SPA)      │
                └────────────┬─────────────┘
                             │ HTTPS / JSON
                             ▼
                ┌──────────────────────────┐
                │   Node.js API (Express)  │
                │  - Layered: route →      │
                │    controller → service  │
                │  - Zod validation        │
                │  - JWT auth (access +    │
                │    refresh)              │
                │  - Pino structured logs  │
                └────┬─────────────────┬───┘
                     │                 │
                     ▼                 ▼
          ┌────────────────┐   ┌──────────────────┐
          │  PostgreSQL    │   │   Object store   │
          │  via Prisma    │   │  (S3-compatible, │
          │                │   │   stubbed local) │
          └────────────────┘   └──────────────────┘
```

### Why these choices

| Concern        | Choice                          | Why                                                                 |
| -------------- | ------------------------------- | ------------------------------------------------------------------- |
| Language       | TypeScript                      | Type-safety pays off the moment the team grows past one engineer.   |
| API framework  | Express 4                       | Mature, lightweight, easy to host anywhere (AWS, Fly, Render).      |
| ORM            | Prisma                          | Migrations, type-safe queries, swap providers without rewrites.     |
| DB             | PostgreSQL                      | Relational data, transactions, JSONB for flexibility.               |
| Auth           | JWT (access + refresh)          | Stateless, horizontally scalable, mobile-friendly.                  |
| Validation     | Zod                             | Single source of truth for request shape **and** TS types.          |
| Frontend       | Vanilla HTML/CSS/JS             | No build step for MVP; trivial to migrate to React later.           |
| Realtime       | HTTP polling (sockets-ready)    | Simpler ops; `notifications` + `messages` endpoints exist already.  |
| Containers     | Docker Compose                  | One command to run API + DB locally and in CI.                      |

### Scalability notes

- **Stateless API.** Sessions live in the JWT, so the API scales horizontally
  behind a load balancer. Refresh tokens are stored hashed in the DB so they
  can be revoked.
- **Database as the bottleneck.** All heavy reads (job feed, profile)
  paginate by default and use indexed columns (`status`, `categoryId`,
  `createdAt`).
- **Layered code.** `routes → controllers → services → prisma` makes it
  trivial to extract a service into its own deployable later (e.g.
  `messaging-service`).
- **Real-time path.** `messages` and `notifications` are tables today; flip
  the polling client to a Socket.io / Server-Sent-Events transport without
  changing the data model.
- **Object storage.** Uploaded photos go through a thin `storage` adapter
  that today writes to disk and tomorrow writes to S3.

---

## 2. File structure

```
.
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma           # DB schema
│   │   └── seed.ts                 # Seed categories + demo users
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts              # Validated env vars
│   │   │   └── prisma.ts           # Prisma singleton
│   │   ├── middleware/
│   │   │   ├── auth.ts             # JWT auth guard + role guard
│   │   │   ├── error.ts            # Central error handler
│   │   │   └── validate.ts         # Zod request validator
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── categories/
│   │   │   ├── jobs/
│   │   │   ├── messages/
│   │   │   └── reviews/
│   │   ├── utils/
│   │   │   ├── AppError.ts
│   │   │   ├── asyncHandler.ts
│   │   │   ├── jwt.ts
│   │   │   └── password.ts
│   │   ├── app.ts                  # Express app factory
│   │   └── server.ts               # HTTP entrypoint
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   └── public/
│       ├── index.html              # Single HTML, multi-screen SPA
│       ├── css/styles.css
│       └── js/
│           ├── api.js              # API client
│           ├── store.js            # In-memory auth + state
│           ├── router.js           # Screen router
│           ├── screens.js          # All screen handlers
│           └── app.js              # Bootstrap
├── docker-compose.yml              # Postgres + API
├── .gitignore
└── README.md
```

---

## 3. Database schema

Entities, all keyed by `cuid` strings, soft-deletable where it matters.

| Table             | Purpose                                                       |
| ----------------- | ------------------------------------------------------------- |
| `User`            | Account: email, hashed password, role (`CLIENT`/`CRAFTSMAN`). |
| `CraftsmanProfile`| 1-1 with User; KvK, bio, hourly rate, verified flag.          |
| `Category`        | Job categories (electrical, plumbing, …).                     |
| `Job`             | A posted klus. Has status state-machine.                      |
| `JobAssignment`   | The acceptance: which craftsman took which job.               |
| `Message`         | Chat between client and assigned craftsman, scoped to a job.  |
| `Review`          | One review per `(job, fromUser)` pair.                        |
| `Notification`    | Per-user inbox for system events.                             |
| `RefreshToken`    | Hashed refresh tokens for logout/rotation.                    |

Job status state-machine: `OPEN → ASSIGNED → IN_PROGRESS → COMPLETED`,
or `OPEN/ASSIGNED → CANCELLED`. Transitions are enforced in the service
layer.

---

## 4. API endpoints

All responses are JSON. Auth is `Authorization: Bearer <accessToken>`.

### Auth
| Method | Path                  | Auth | Purpose                          |
| ------ | --------------------- | ---- | -------------------------------- |
| POST   | `/api/auth/register`  | -    | Create account (client/craftsman)|
| POST   | `/api/auth/login`     | -    | Get access + refresh tokens      |
| POST   | `/api/auth/refresh`   | -    | Rotate access token              |
| POST   | `/api/auth/logout`    | user | Invalidate refresh token         |
| GET    | `/api/auth/me`        | user | Current user + profile           |

### Users
| Method | Path                      | Auth      | Purpose                       |
| ------ | ------------------------- | --------- | ----------------------------- |
| PATCH  | `/api/users/me`           | user      | Update name, phone, avatar    |
| PATCH  | `/api/users/me/craftsman` | craftsman | Update craftsman profile      |
| GET    | `/api/users/:id`          | user      | Public profile + rating       |

### Categories
| Method | Path                  | Auth | Purpose                          |
| ------ | --------------------- | ---- | -------------------------------- |
| GET    | `/api/categories`     | -    | List categories                  |

### Jobs
| Method | Path                          | Auth      | Purpose                            |
| ------ | ----------------------------- | --------- | ---------------------------------- |
| GET    | `/api/jobs`                   | craftsman | Open feed, filtered by category    |
| POST   | `/api/jobs`                   | client    | Post a new klus                    |
| GET    | `/api/jobs/me`                | user      | My jobs (as client or craftsman)   |
| GET    | `/api/jobs/:id`               | user      | Job detail + assignment            |
| PATCH  | `/api/jobs/:id`               | client    | Edit while still OPEN              |
| POST   | `/api/jobs/:id/accept`        | craftsman | Accept open job (atomic)           |
| POST   | `/api/jobs/:id/start`         | craftsman | Mark IN_PROGRESS                   |
| POST   | `/api/jobs/:id/complete`      | craftsman | Mark COMPLETED                     |
| POST   | `/api/jobs/:id/cancel`        | client    | Cancel before completion           |

### Messages
| Method | Path                          | Auth | Purpose                          |
| ------ | ----------------------------- | ---- | -------------------------------- |
| GET    | `/api/jobs/:id/messages`      | user | Thread for a job                 |
| POST   | `/api/jobs/:id/messages`      | user | Send message                     |

### Reviews
| Method | Path                          | Auth | Purpose                          |
| ------ | ----------------------------- | ---- | -------------------------------- |
| POST   | `/api/jobs/:id/reviews`       | user | Review counterparty after job    |
| GET    | `/api/users/:id/reviews`      | -    | Public reviews for a user        |

---

## 5. UI architecture

The web client is a single `index.html` with multiple `.sc` (screen) sections,
toggled by a tiny client-side router. Every screen is mobile-first and follows
the dark/orange brand from the original landing.

Screen graph:

```
    ┌─ home (public)
    ├─ login / register
    │     │
    │     ▼
    ├─ dashboard ── (CLIENT)  ── new-job ── job-detail ── chat
    │            └ (CRAFTSMAN) ── feed     ── job-detail ── chat
    └─ profile
```

State lives in `store.js` (auth + cached lists). All HTTP goes through
`api.js`, which transparently retries with the refresh token on 401.

---

## 6. Running it

```bash
# 1. Start Postgres + API
docker compose up -d

# 2. Apply schema and seed demo data
docker compose exec api npm run db:setup

# 3. Open the frontend
#    Any static server works; the simplest:
cd frontend/public && python3 -m http.server 5173
# → http://localhost:5173
```

Demo accounts created by the seed:

| Role       | Email                  | Password    |
| ---------- | ---------------------- | ----------- |
| Client     | `klant@klusraak.nl`    | `Demo1234!` |
| Craftsman  | `vakman@klusraak.nl`   | `Demo1234!` |

---

## 7. Roadmap (post-MVP)

- Replace polling with Socket.io for chat + live job feed.
- Stripe Connect for escrowed payments to craftsmen.
- Geo search (PostGIS) for "nearest open klussen".
- Mobile app (React Native) — reuse the API as-is.
- Admin dashboard for KvK verification and dispute resolution.
