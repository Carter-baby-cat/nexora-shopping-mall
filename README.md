# Nexora Shopping Mall

A full-stack e-commerce platform built with React, TypeScript, and Spring Boot, featuring high-concurrency flash sales, distributed idempotency, asynchronous order processing, and Elasticsearch-powered product search.

## Features

- **User & Merchant Management** — Authentication, product management, and role-based access.
- **Shopping & Checkout** — Product browsing, search, cart management, and price validation.
- **Order & Payment** — Order lifecycle management, balance payments, and automatic cancellation of unpaid orders.
- **Flash Sales** — High-concurrency ordering with overselling prevention and asynchronous processing.
- **Product Search** — Keyword search, autocomplete, and category/brand filtering.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Java 17, Spring Boot, Spring Security, MyBatis-Plus |
| Database & Cache | MySQL, Redis |
| Messaging | RabbitMQ |
| Search | Elasticsearch, Canal |

## Technical Highlights

- **High-Concurrency Flash Sales:** Redis Lua scripts for atomic stock reservation, RabbitMQ for asynchronous order processing, and failure compensation.
- **Idempotency:** Redis-based request deduplication, database unique constraints, and SHA-256 request fingerprints.
- **Inventory Consistency:** Conditional SQL updates, distributed locks, and post-transaction Redis compensation.
- **Search Synchronization:** Canal-based MySQL Binlog consumption for asynchronous Elasticsearch indexing.