# Project name

Web-based Rock-Paper-Scissor game with real-time chatting feature

**Live demo:** [[link](https://capstone-game-ui.vercel.app/)] 
**Stack:** TypeScript · Node.js · Socket.io · MongoDB

## What it does

- Create and stores new accounts
- Creates game rooms that allows two people to join in real-time to engage in game
- Real-time chatting feature in game rooms

## Architecture

This is a three-tier web application: a React single-page client talks to an Express REST API over HTTPS, and the API persists data to a MySQL database through a pooled connection.

```
┌──────────────────────────────────┐
│       Client (Browser)            │
│   React + TypeScript              │
│   - Components, hooks, routing    │
│   - Axios HTTP client             │
└──────────────┬───────────────────┘
               │
               │  HTTPS · JSON · REST
               │  (Axios → /api/*)
               ▼
┌──────────────────────────────────┐
│       Express API Server          │
│   Node.js + TypeScript            │
│   - Route handlers                │
│   - Request validation            │
│   - Business logic                │
│   - Error handling middleware     │
└──────────────┬───────────────────┘
               │
               │  TCP · SQL
               │  (mysql2 connection pool)
               ▼
┌──────────────────────────────────┐
│       MySQL Database              │
│   - Normalized relational schema  │
│   - Indexed foreign keys          │
│   - Persistent storage            │
└──────────────────────────────────┘
```

## What I learned so far

- Separation of concerns. What standard should I use to determine how many APIs to make, which components should be modularized
- Routing different pages
- Encryption, protecting sensitive data
- How to make an intuitive UI?
