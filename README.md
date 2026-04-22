<div align="center">

<img src="https://img.shields.io/badge/MC_Attendance_Box-black?style=for-the-badge&labelColor=000000" />

# MC Attendance Box

**Industrial-grade facial recognition attendance system for modern classrooms.**  
Built with React 19, Firebase, and deep learning — zero manual roll calls.

[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![MIT License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

</div>

---

## What it does

MC Attendance Box replaces manual roll calls with a live webcam feed that identifies students by face, marks them present or late automatically, and stores everything in Firestore — per teacher, per month, exportable in seconds.

---

## Features

| | Feature | Description |
|---|---|---|
| 🧠 | **AI Face Recognition** | Deep learning-powered identification via `@vladmandic/face-api` |
| 📷 | **Real-Time Scanning** | Live webcam feed marks attendance as students enter the frame |
| 📋 | **Student Registration** | Enroll students with name, ID, and biometric face capture |
| 📊 | **Monthly Dashboard** | Visual attendance analytics with month navigation |
| ⏱️ | **Late Detection** | Configurable cutoff time — auto-flags latecomers |
| 📤 | **Export** | Download as CSV or copy directly to Google Sheets |
| 🔐 | **Auth** | Google Sign-In via Firebase — each teacher gets isolated storage |
| 📱 | **Responsive** | Optimized for desktop and tablet |

---

## Stack

```
Frontend    →  React 19 + TypeScript
Styling     →  TailwindCSS v4
Face AI     →  @vladmandic/face-api
Backend     →  Firebase (Auth + Firestore)
Build       →  Vite
Icons       →  Lucide React
Dates       →  date-fns
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A Google account (for Firebase)
- A webcam-enabled device

### 1. Clone

```bash
git clone https://github.com/aluukill/MCAttendanceBox
cd MCAttendanceBox
```

### 2. Install

```bash
npm install
```

### 3. Set up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project
2. Enable **Authentication** → Google Sign-In provider
3. Enable **Firestore Database**
4. Download your Firebase config and add it to:

```
config/firebase-applet-config.json
```

5. Set Firestore rules to allow authenticated access

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Usage

**Sign In** — Authenticate with Google. Your data is isolated from other teachers.

**Register Students** — Enter a name and student ID, then capture the student's face via webcam.

**Start Scanning** — Set a late cutoff time (e.g. 9:00 AM). The scanner marks students present or late in real time.

**Dashboard** — Browse monthly attendance, mark unscanned students absent, export to CSV or clipboard.

**Manage Students** — Search, edit, or delete any student record.

---

## Configuration

```ts
// Late cutoff — configurable in Scanner settings
Default: 9:00 AM

// Face match confidence threshold — adjustable in Scanner.tsx
Default: 65%
```

---

## Project Structure

```
src/
├── components/
│   ├── Dashboard.tsx       # Monthly attendance view & analytics
│   ├── Register.tsx        # Student enrollment with face capture
│   ├── Scanner.tsx         # Live face scanning interface
│   ├── Students.tsx        # Student management (CRUD)
│   └── Toast.tsx           # Notification system
├── services/
│   └── firebase.ts         # Firebase setup
├── types/
│   └── types.ts            # TypeScript interfaces
├── utils/
│   ├── face-api-loader.ts  # AI model initialization
│   └── utils.ts            # Helper functions
├── App.tsx                 # Root component
├── main.tsx                # Entry point
└── index.css               # Global styles
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

<div align="center">

MIT License · Built by [Syed Tanvir Islam](https://github.com/aluukill)

</div>