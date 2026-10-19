# Shopping Mall

Full-stack e-commerce project with a front-end/back-end separated architecture, covering user authentication, products, cart, orders, and payment, with dedicated designs for flash-sale (seckill), search, and idempotency.

| Directory | Description |
| --- | --- |
| `shopping-mall/` | Backend — Java 17 / Spring Boot 3 |
| `shopping-mall-fe/` | Frontend — React + TypeScript + Vite |

---

# Backend (`shopping-mall/`)

A front-end/back-end separated e-commerce backend covering user authentication, products, cart, orders, and payment, with dedicated designs for flash-sale (seckill), search, and idempotency.

## Features

### Accounts & Authentication
- Register and sign in as a **buyer** or **merchant**
- Session auto-refresh — no repeated re-login while browsing
- Buyers can view their balance and **top up** (recharge)

### Browsing & Search
- Product listing with **grid / list** views and pagination
- **Keyword search** with real-time **search suggestions** (autocomplete)
- Filter by **category** and **brand** (aggregated facets)
- Product detail: image gallery, price, stock, and status (ONLINE / SOLD_OUT / OFFLINE)

### Cart
- Add to cart, change quantity, remove items
- Select specific items for checkout, or select all
- **Price validation** at checkout — the user is prompted to re-confirm if a price changed

### Orders & Payment
- Place normal orders
- Pay with **account balance**
- Order list and order details
- Cancel pending orders
- Unpaid orders are **auto-cancelled after 24 hours**, releasing reserved stock

### Flash Sale (Seckill)
- Limited-time flash-sale products, **one per customer**
- Flash-sale items carry a **"FLASH SALE" badge** and show the sale end time so buyers can spot them instantly
- Orders are queued and processed asynchronously — fast response, no waiting
- Guarantees **no overselling** and **no duplicate orders** under high concurrency

### Merchant Console
- Publish products (with **image upload**)
- Edit product details and adjust stock
- Put products **on/off shelf**
- View own product list
- Sold-out products are **marked automatically**

## Tech Stack

| Category | Technology |
| --- | --- |
| Language / Framework | Java 17, Spring Boot 3.5.16, Maven |
| Web | Spring Web, Spring Security, WebSocket |
| ORM | MyBatis-Plus 3.5.12 |
| Storage | MySQL (primary business data), Redis (cache / cart / seckill / idempotency / distributed lock) |
| Message Queue | RabbitMQ (async seckill order processing) |
| Search | Elasticsearch + Canal (MySQL binlog sync to ES) |
| Auth | JWT (jjwt 0.12.6), BCrypt |
| Object Storage | AWS S3 (product images) |
| Others | Bean Validation, Lombok, Hutool, spring-dotenv, SpringDoc OpenAPI |

## Business Modules

| Module | Package | Description |
| --- | --- | --- |
| user | `com.me.user` | Register, login, logout, balance query, recharge |
| item | `com.me.item` | Product publish / edit / on-off shelf, search, suggestions, state machine |
| cart | `com.me.cart` | Redis cart, checkout price validation |
| order | `com.me.order` | Normal orders, seckill orders, order cancellation, auto-cancel on timeout |
| payment | `com.me.payment` | Balance payment, payment records |

Cross-cutting support: `config` (Security / RabbitMQ / ES / WebSocket / AWS), `security` (JWT filter, user details), `constant` (Redis / MySQL constants), `response` (unified response), `exception` (global exception handling), `es` (ES document & initializer), `canal` (binlog sync), `mq` (messages & consumers), `task` (scheduled tasks).

## Architecture & Data Flow

- **MySQL** stores primary business data: users, items, orders, payments, balances.
- **Redis** handles high-concurrency and transient data: cart (Hash), seckill stock & window, idempotency keys, distributed locks.
- **Elasticsearch** powers product search; **Canal** subscribes to the MySQL `item` table binlog and syncs changes asynchronously (eventual consistency).
- **RabbitMQ** carries asynchronous seckill order persistence to smooth traffic spikes.
- **AWS S3** stores product images.

Key flows:

- **Normal order**: cart → checkout price validation → `Idempotency-Key` + request fingerprint → conditional UPDATE to decrement stock (prevent overselling) → create order.
- **Seckill order**: Redis Lua atomic stock pre-deduction → send MQ → return `orderNo` → consumer asynchronously decrements MySQL stock and creates the order → restores Redis stock on failure.
- **Payment**: idempotency (keyed by `orderId`) → buyer debit, seller credit, and order `PENDING → PAID` in a single transaction.
- **Cancel order**: distributed lock serialization → transaction updates status and restores MySQL stock → restores Redis seckill stock after commit.
- **Search**: write MySQL → Canal consumes binlog → index to ES → search via ES (bool query + aggregations).

## Design Highlights

- **Dual-token auth**: access token in request header (short-lived), refresh token in an `httpOnly` cookie (`SameSite=Lax`), transparently refreshed by `JwtAuthenticationFilter`.
- **Recharge idempotency**: Redis `setIfAbsent` (keyed by `userId:uuid`) + the `uuid` unique constraint on `RechargeRecord`, two layers preventing double crediting.
- **Order idempotency**: normal orders bind the `Idempotency-Key` to a SHA-256 fingerprint of the request content to distinguish retry from duplicate order.
- **Overselling prevention**: stock decrement uses conditional `UPDATE ... WHERE stock >= quantity`; zero affected rows means failure.
- **Seckill async + compensation**: Redis Lua pre-deduction + MQ persistence + failure compensation restoring stock + idempotency status (SUCCESS / FAILED) closed loop.
- **Cancel order**: distributed lock + conditional UPDATE (`WHERE status = PENDING`) double guarantee, stock restored at most once.

## Database Tables

`src/main/resources/schema.sql` defines 9 tables:

- `users` (unique username)
- `authorities` (user role: `ROLE_USER` / `ROLE_MERCHANT`)
- `account` (balance)
- `item` (product, with `status` / `is_seckill` / `end_time`)
- `orders` (order, unique `order_no`)
- `order_item` (order line items)
- `payment` (payment record, unique `order_id`)
- `payment_item` (payment line items, split by seller)
- `recharge_record` (recharge record, unique `uuid`)

Item state machine: `ONLINE` → `SOLD_OUT` (marked by a scheduled task, auto-recoverable) → `OFFLINE` (merchant-initiated).
Order state machine: `PENDING` → `PAID` / `CANCELLED`.

## Requirements & Configuration

Dependencies: JDK 17, MySQL, Redis, RabbitMQ, Elasticsearch, Canal (optional, for search sync), AWS S3 (optional, for image upload).

Configuration is injected via environment variables (`application.yml` provides defaults; `spring-dotenv` supports a `.env` file):

| Variable | Default | Description |
| --- | --- | --- |
| `SERVER_PORT` | `8086` | Server port |
| `DATABASE_HOST` / `DATABASE_PORT` / `DATABASE_NAME` | `localhost` / `3306` / `shopping_mall` | MySQL connection |
| `DATABASE_USERNAME` / `DATABASE_PASSWORD` | `root` / (see yml) | MySQL credentials |
| `DATABASE_INIT` | `always` | Run `schema.sql` on startup |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | Redis connection |
| `RABBITMQ_HOST` / `RABBITMQ_PORT` | `localhost` / `5672` | RabbitMQ connection |
| `ELASTICSEARCH_HOST` / `ELASTICSEARCH_PORT` | `localhost` / `9200` | ES connection |
| `JWT_SECRET` | — | JWT signing secret (required) |
| `AWS_S3_*` | — | S3 image upload (optional) |
| `canal.*` | `localhost:11111` | Canal connection |

> In production, always override the database password and `JWT_SECRET` via environment variables.

## Build & Run

```bash
# Build
mvn clean package

# Run
mvn spring-boot:run
# or
java -jar target/shopping-mall-0.0.1-SNAPSHOT.jar
```

After startup, OpenAPI docs are provided by SpringDoc — open Swagger UI to browse the API.

## API Overview

**User `/user`**

| Method | Path | Description |
| --- | --- | --- |
| POST | `/user/register` | Register (public) |
| POST | `/user/login` | Login (public) |
| POST | `/user/logout` | Logout |
| POST | `/user/recharge` | Recharge (requires idempotency uuid) |
| GET | `/user/balance` | Query balance |

**Item `/item`**

| Method | Path | Description |
| --- | --- | --- |
| POST | `/item/add` | Publish item (merchant) |
| GET | `/item/search/list` | Search (ES, with category/brand aggregations) |
| GET | `/item/suggest` | Search suggestions |
| GET | `/item/{itemId}` | Item detail |
| PUT | `/item/update` | Edit item (merchant) |
| PATCH | `/item/stock` | Adjust stock (merchant) |
| DELETE | `/item/offline` | Take offline (merchant) |
| GET | `/item/merchant/list` | Merchant item list |

**Cart `/cart`**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/cart/list` | Cart list |
| POST | `/cart/add` | Add to cart |
| PUT | `/cart/update` | Update quantity |
| DELETE | `/cart/delete` | Remove item |
| POST | `/cart/checkout` | Checkout price validation |

**Order `/order`**

| Method | Path | Description |
| --- | --- | --- |
| GET | `/order/list` | Order list |
| POST | `/order/create` | Create normal order (requires `Idempotency-Key`) |
| POST | `/order/create/seckill` | Create seckill order (requires `Idempotency-Key`) |
| POST | `/order/cancel` | Cancel order |
| GET | `/order/{orderId}/items` | Order line items |

**Payment `/pay`**

| Method | Path | Description |
| --- | --- | --- |
| POST | `/pay?orderId=` | Pay with balance |

## Project Structure

```
src/main/java/com/me/
├── ShoppingMallApplication.java
├── config/          # Security / RabbitMQ / ES / WebSocket / AWS config
├── security/        # JwtUtil, JwtAuthenticationFilter, LoginUser, AuthorityType
├── constant/        # RedisConstant, MySQLConstant
├── response/        # Unified response Result, ResultWriter
├── exception/       # Global exception handling
├── util/
├── user/            # User / auth / recharge
├── item/            # Item / search
├── cart/            # Cart
├── order/           # Order (normal / seckill / cancel)
├── payment/         # Payment
├── es/              # Elasticsearch document & initializer
├── canal/           # binlog sync to ES
├── mq/              # Seckill messages & consumers
└── task/            # Scheduled tasks (sold-out marking, timeout cancellation)
```

---

# Frontend (`shopping-mall-fe/`)

React + TypeScript + Vite single-page application. This directory is the frontend project root; do not scaffold another app under it.

## Setup

```sh
npm install
cp .env.example .env
npm run dev
```

The Vite server proxies `/user`, `/item`, `/cart`, `/order`, and `/pay` to `VITE_API_TARGET` (defaults to `http://localhost:8086`). Keep this API target local and do not commit credentials.

## Checks

```sh
npm run typecheck
npm run build
```

## Routes

The guest homepage is `/`. Buyer and merchant flows use role-aware routes defined in `src/app/router.tsx`. The homepage remains public; an authenticated visit redirects to the matching role home.

UI references and backend contracts remain in the sibling `design/frontend/` and `design/backend/` folders. Real API request shapes are documented in `design/frontend/module-design/` and checked against backend controllers.
