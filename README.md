# KnightForge — MERN Stack Edition

A full-featured chess platform built with **MongoDB, Express, React (JSX + Vite 5), and Node.js**.

## Features

- **Real-time multiplayer** — Socket.IO with ELO rating system (K=32)
- **Play vs Stockfish AI** — Easy/Medium/Hard via CDN WebWorker
- **Game analysis** — Import PGN, navigate moves, Stockfish eval bar
- **Puzzles** — Daily puzzle + difficulty-filtered practice set
- **Leaderboard** — Global ratings with live stats
- **Player profiles** — Win/loss/draw charts, rating, game history
- **Auth** — JWT-based register/login
- **Dark/Light mode** — Toggle via sidebar

## Project Structure

```
chess-mern/
├── server/              # Node.js + Express + MongoDB
│   ├── index.js         # Entry point (HTTP + Socket.IO)
│   ├── app.js           # Express app setup
│   ├── models/          # Mongoose schemas
│   │   ├── User.js
│   │   ├── Game.js
│   │   └── Puzzle.js
│   ├── routes/          # REST API routes
│   │   ├── auth.js      # POST /api/auth/login|register, GET /api/auth/me
│   │   ├── games.js     # GET/POST /api/games/*
│   │   ├── users.js     # GET /api/users/:id and /me/stats
│   │   ├── leaderboard.js
│   │   └── puzzles.js
│   ├── middlewares/
│   │   └── auth.js      # JWT verify middleware
│   └── sockets/
│       └── gameSocket.js  # Socket.IO game handler + ELO
│
└── client/              # React 18 + Vite 5 + Tailwind 3
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx          # Router (wouter)
        ├── index.css        # Tailwind + CSS variables
        ├── pages/           # 11 page components
        ├── components/      # ChessBoard, Layout, UI primitives
        ├── hooks/           # useAuth, use-toast
        ├── store/           # Zustand auth store
        └── lib/             # api.js (fetch wrapper), utils.js
```

## Quick Start

### 1. Server

```bash
cd server
npm install
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET
npm start          # or: npm run dev  (uses nodemon)
```

### 2. Client

```bash
cd client
npm install
cp .env.example .env
npm run dev        # Vite dev server at http://localhost:3000
```

### Environment Variables

**`server/.env`**

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default 5000) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |
| `NODE_ENV` | `development` or `production` |

**`client/.env`**

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | API base URL — leave empty to use Vite proxy in dev |

## Production Build

```bash
# Build client
cd client && npm run build

# Serve dist/ as static from Express
# Add to server/app.js:
#   app.use(express.static(path.join(__dirname, '../client/dist')))
#   app.get('*', (req,res) => res.sendFile(...client/dist/index.html))
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Database | MongoDB + Mongoose |
| Backend | Express.js 4 |
| Real-time | Socket.IO 4 |
| Frontend | React 18 |
| Bundler | Vite 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand + TanStack Query v5 |
| Chess logic | chess.js |
| AI engine | Stockfish 10 (CDN WebWorker) |
| Auth | JWT (jsonwebtoken) |
| Routing | wouter |
| Forms | react-hook-form + zod |
