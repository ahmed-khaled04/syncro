# Syncro - Real-time Collaborative Code Editor

<div align="center">

![Syncro](https://img.shields.io/badge/Syncro-Collaborative%20Editor-blueviolet)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green)
![React](https://img.shields.io/badge/React-Frontend-blue)
![Yjs](https://img.shields.io/badge/Yjs-CRDT-orange)

A modern, real-time collaborative code editor built with React, Node.js, and Yjs. Write code together with friends in real-time, manage rooms, share invites, and track file activity all in one place.

</div>

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ Features

### Core Editing

- **Real-time Collaboration** - Multiple users editing the same file simultaneously with live cursor tracking
- **Multi-language Support** - JavaScript, Python, C++, HTML with syntax highlighting via CodeMirror
- **File Explorer** - Organize code into folders and files within rooms
- **Tab Management** - Open multiple files with unsaved changes indicators

### Rooms & Sharing

- **Room Management** - Create private or public collaborative rooms
- **Invite System** - Generate time-limited invite links for room access
- **Join Requests** - Request access to private rooms with owner approval
- **Room Ownership** - Full control over room settings and permissions

### User Features

- **Friend System** - Add friends and see their online/room status
- **Authentication** - Secure signup/login with JWT tokens
- **Activity Tracking** - View who's viewing/editing each file
- **User Awareness** - See active users and their cursor positions in real-time

### Data Management

- **Snapshot History** - Save and restore file snapshots
- **Export Project** - Download entire room as ZIP archive
- **Persistent Storage** - PostgreSQL backend for all data

---

## 🛠 Tech Stack

### Frontend

- **React 19** - UI framework
- **Vite** - Build tool & dev server
- **Tailwind CSS** - Utility-first styling
- **Socket.IO Client** - Real-time communication
- **Yjs** - Conflict-free replicated data structure (CRDT)
- **CodeMirror** - Advanced code editor
- **React Router** - Client-side routing

### Backend

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Socket.IO** - WebSocket server
- **PostgreSQL** - Primary database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Yjs** - CRDT implementation

### DevOps

- **Nodemon** - Development auto-reload
- **ESLint** - Code linting
- **Tailwind CLI** - CSS processing

---

## 📁 Project Structure

```
Syncro/
├── backend/                    # Node.js backend
│   ├── app.js                 # Express app initialization
│   ├── server.js              # Server entry point
│   ├── package.json
│   ├── config/
│   │   ├── cors.js            # CORS configuration
│   │   └── env.js             # Environment variables
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── persistence/
│   │   ├── db.js              # Database connection
│   │   ├── friendsRepo.js      # Friend relationships data access
│   │   ├── inviteRepo.js       # Invite tokens data access
│   │   └── snapshotRepo.js     # File snapshots data access
│   ├── routes/
│   │   ├── auth.js            # Auth endpoints (signup, login)
│   │   ├── friends.js         # Friend management endpoints
│   │   └── rooms.js           # Room management endpoints
│   ├── rooms/
│   │   ├── roomConnections.js # Active WebSocket connections
│   │   ├── roomStore.js       # In-memory room state
│   │   └── ydocStore.js       # Yjs document store
│   └── sockets/
│       ├── index.js           # Socket.IO server setup
│       └── handlers/
│           ├── friendsHandlers.js    # Friend activity socket events
│           ├── roomHandlers.js       # Room management socket events
│           └── yjsHandlers.js        # Yjs sync socket events
│
├── frontend/                   # React frontend
│   ├── index.html             # HTML entry point
│   ├── package.json
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── public/
│   │   ├── favicon.svg        # App icon
│   │   └── vite.svg
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Main router
│       ├── index.css          # Global styles
│       ├── api/               # API client layer
│       │   ├── auth.js        # Auth API calls
│       │   ├── client.js      # HTTP client setup
│       │   ├── friends.js     # Friends API calls
│       │   ├── rooms.js       # Rooms API calls
│       │   └── services/      # Business logic
│       ├── assets/            # Static assets
│       ├── components/
│       │   ├── AppIcon.jsx         # Reusable brand icon
│       │   ├── CollabEditor.jsx    # Code editor component
│       │   ├── CommandPalette.jsx  # Quick search interface
│       │   ├── DialogComponents.jsx # Reusable dialogs
│       │   ├── EditorHeader.jsx    # Editor top bar
│       │   ├── FileExplorer.jsx    # File tree sidebar
│       │   ├── FriendsPanel.jsx    # Friends management
│       │   ├── JoinRequestsPanel.jsx # Join request UI
│       │   ├── OnlineUsers.jsx     # Active user list
│       │   ├── SnapshotPanel.jsx   # Version history
│       │   ├── TabsBar.jsx         # Open files tabs
│       ├── config/
│       │   └── socket.js      # Socket.IO client config
│       ├── constants/
│       │   └── langs.js       # Language definitions
│       ├── context/
│       │   ├── auth.js        # Auth context logic
│       │   ├── auth.jsx       # Auth context provider
│       │   └── AuthContext.jsx # Auth context component
│       ├── hooks/
│       │   ├── useAuth.js          # Auth hook
│       │   ├── useFileActivity.js  # File activity tracking
│       │   ├── useRoomLanguage.js  # Room language state
│       │   ├── useSocket.js        # Socket connection hook
│       │   └── useYjsSync.js       # Yjs document sync
│       ├── pages/
│       │   ├── LandingPage.jsx    # Welcome page
│       │   ├── AuthPage.jsx       # Login/signup
│       │   ├── Dashboard.jsx      # Room overview
│       │   ├── RoomPage.jsx       # Main editor
│       │   ├── InvitePage.jsx     # Invite acceptance
│       │   └── JoinPage.jsx       # Quick join form
│       ├── utils/
│       │   ├── languageDetector.js # Language detection from filename
│       │   └── projectExporter.js  # ZIP export functionality
│       └── public/
│           └── favicon.svg

```

---

## 🚀 Installation

### Prerequisites

- **Node.js** v18+
- **npm** or **yarn**
- **PostgreSQL** 12+

### Backend Setup

```bash
cd backend
npm install

# Create .env file
cat > .env << EOF
DB_USER=postgres
DB_PASS=yourpassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=syncro
JWT_SECRET=your-secret-key-here
PORT=5000
EOF

# Initialize database
npm run db:init

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install

# Create environment config
cat > .env.local << EOF
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
EOF

# Start development server
npm run dev

# Build for production
npm run build
```

---

## 🎯 Getting Started

### 1. Start the Backend

```bash
cd backend
npm run dev
```

Server runs on `http://localhost:5000`

### 2. Start the Frontend

```bash
cd frontend
npm run dev
```

App runs on `http://localhost:5173`

### 3. Create an Account

- Navigate to the landing page
- Click "Login" and choose "Sign up"
- Enter email, name, and password
- Confirm signup

### 4. Create Your First Room

- Click "+ Create Room" on the dashboard
- Set room name, description, and language
- Set privacy (public/private)
- Start editing!

### 5. Invite Others

- Click "Invite" button in the editor
- Choose expiration time or no expiry
- Share the generated link
- Invited users can join directly

---

## 🏗 Architecture

### Real-time Synchronization

```
┌─────────────────────────────────────────────────────┐
│                   Socket.IO Server                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────────┐      ┌──────────────────┐   │
│  │ Yjs Document     │◄─────►│ Client Awareness │   │
│  │ (CRDT)           │       │ (Cursor/State)   │   │
│  └──────────────────┘       └──────────────────┘   │
│           ▲                           ▲             │
│           │                           │             │
│   ┌───────┴───────────────────────────┴──────┐     │
│   │    Room Connection Manager               │     │
│   │  (routes updates to active clients)      │     │
│   └───────────────────────────────────────────┘     │
│                                                     │
│   ┌──────────────────────────────────────────┐     │
│   │    PostgreSQL Persistence Layer          │     │
│   │  (snapshots, users, rooms, friends)      │     │
│   └──────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘

         ▼              ▼              ▼
    ┌────────┐     ┌────────┐     ┌────────┐
    │Client 1│     │Client 2│     │Client 3│
    │(Yjs)   │     │(Yjs)   │     │(Yjs)   │
    └────────┘     └────────┘     └────────┘
```

### State Management

**Backend:**

- Room state in memory for quick access
- Yjs documents stored in-memory with periodic snapshots
- PostgreSQL for permanent storage

**Frontend:**

- React Context for auth state
- Yjs for collaborative state
- Socket.IO for real-time updates
- Custom hooks managing component-specific state

---

## 🔌 API Documentation

### Authentication Endpoints

#### Signup

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}

Response: { userId, token, user: {...} }
```

#### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}

Response: { userId, token, user: {...} }
```

### Room Endpoints

#### Get My Rooms

```http
GET /api/rooms/my-rooms
Authorization: Bearer <token>

Response: { rooms: [...] }
```

#### Create Room

```http
POST /api/rooms/create
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Room Name",
  "description": "Optional description",
  "language": "js",
  "isPublic": true
}

Response: { room: {...}, roomId: "..." }
```

#### Join Room

```http
POST /api/rooms/:roomId/join
Authorization: Bearer <token>

{
  "inviteToken": "optional-token"
}

Response: { success: true }
```

### Friends Endpoints

#### Send Friend Request

```http
POST /api/friends/request
Authorization: Bearer <token>

{
  "recipientId": 123
}

Response: { success: true }
```

#### Get Friend Requests

```http
GET /api/friends/incoming
Authorization: Bearer <token>

Response: { requests: [...] }
```

#### Accept Request

```http
POST /api/friends/request/:requestId/accept
Authorization: Bearer <token>

Response: { success: true }
```

---

## 🗄 Database Schema

### Users Table

```sql
id | email | password_hash | name | created_at
```

### Rooms Table

```sql
id | owner_id | name | description | language | is_public | created_at
```

### Room Members Table

```sql
room_id | user_id | joined_at
```

### Friends Table

```sql
user_id | friend_id | created_at
```

### Friend Requests Table

```sql
id | sender_id | recipient_id | status | created_at
```

### Invites Table

```sql
id | room_id | token | expires_at | created_by | created_at
```

### Snapshots Table

```sql
id | room_id | file_id | content | created_by | created_at
```

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Use ESLint for code quality
- Follow the existing project structure
- Write meaningful commit messages
- Test features locally before submitting PR

---

## 📝 Environment Variables

### Backend (.env)

```env
# Database
DB_USER=postgres
DB_PASS=password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=syncro

# Server
PORT=5000
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend (.env.local)

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🐛 Troubleshooting

**Issue:** WebSocket connection fails

- Ensure backend server is running
- Check `VITE_SOCKET_URL` matches backend address
- Verify CORS is properly configured

**Issue:** File changes not syncing

- Refresh the page
- Check browser console for errors
- Ensure you have edit permissions

**Issue:** Database connection error

- Verify PostgreSQL is running
- Check `.env` database credentials
- Ensure database exists: `createdb syncro`

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors

Developed with ❤️ as a collaborative coding platform

---

## 🙏 Acknowledgments

- [Yjs](https://docs.yjs.dev/) - CRDT implementation
- [CodeMirror](https://codemirror.net/) - Code editor
- [Socket.IO](https://socket.io/) - Real-time communication
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

<div align="center">

**Made with 💜 | Syncro - Code Together in Real-Time**

</div>
