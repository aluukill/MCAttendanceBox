# MC Attendance Box
================================

An industrial-grade facial recognition attendance system designed for modern classrooms. 
MC Attendance Box leverages AI-powered face detection to automate student attendance 
tracking with real-time scanning and comprehensive analytics.

----------------------------------------
KEY FEATURES
----------------------------------------

[AI] AI-Powered Face Recognition
    Advanced facial detection using deep learning models for accurate student identification

[SCAN] Real-Time Scanning
    Live webcam-based attendance marking as students enter the frame

[REG] Student Registration
    Easy enrollment system with face biometric capture

[DASH] Interactive Dashboard
    Comprehensive monthly attendance visualization and analytics

[TIME] Late Tracking
    Configurable late cutoff time with automatic status detection

[EXPORT] Export Options
    Export attendance data to CSV or copy directly to Google Sheets

[DEVICE] Responsive Design
    Works seamlessly on desktop and tablet devices

[LOCK] Secure Authentication
    Google Sign-In powered by Firebase Authentication

----------------------------------------
PREREQUISITES
----------------------------------------

- Node.js 18 or higher
- npm or yarn package manager
- A Google account for Firebase setup
- A webcam-enabled device for face scanning

----------------------------------------
GETTING STARTED
----------------------------------------

1. CLONE THE REPOSITORY
   git clone https://github.com/aluukill/MCAttendanceBox
   cd MCAttendanceBox

2. INSTALL DEPENDENCIES
   npm install

3. SET UP FIREBASE
   - Go to the Firebase Console and create a new project
   - Enable Authentication and select Google Sign-In provider
   - Enable Firestore Database
   - Download your configuration file
   - Add config to config/firebase-applet-config.json
   - Configure Firestore rules to allow authenticated access

4. START THE DEVELOPMENT SERVER
   npm run dev

5. OPEN IN BROWSER
   http://localhost:3000

----------------------------------------
USAGE GUIDE
----------------------------------------

SIGN IN
    Use Google Sign-In to authenticate. Each teacher gets isolated data storage.

REGISTER STUDENTS
    Enter name and student ID, then position the student face in the webcam 
    frame for biometric capture.

START SCANNING
    Set your late cutoff time (e.g., 9:00 AM) and begin real-time attendance 
    scanning. Students are marked as present or late automatically.

VIEW DASHBOARD
    Navigate between months, mark unscanned students as absent, and export 
    data to CSV or copy to clipboard for Google Sheets.

MANAGE STUDENTS
    Search, edit, or delete student records from the Students view.

----------------------------------------
CONFIGURATION
----------------------------------------

LATE CUTOFF TIME
    Default: 9:00 AM
    Configurable in Scanner settings for automatic late detection

FACE MATCHING THRESHOLD
    Default: 65% confidence
    Can be adjusted in Scanner.tsx for sensitivity tuning

----------------------------------------
TECHNOLOGY STACK
----------------------------------------

Frontend:     React 19 with TypeScript
Styling:      TailwindCSS 4
Face Recon:   @vladmandic/face-api
Backend:      Firebase (Authentication + Firestore)
Build Tool:   Vite
Icons:        Lucide React
Date Funcs:    date-fns

----------------------------------------
PROJECT STRUCTURE
----------------------------------------

src/
├── components/
│   ├── Dashboard.tsx    - Attendance dashboard with monthly view
│   ├── Register.tsx    - Student registration with face capture
│   ├── Scanner.tsx     - Real-time face scanning interface
│   ├── Students.tsx    - Student management CRUD
│   └── Toast.tsx       - Notification system
├── services/
│   └── firebase.ts    - Firebase configuration
├── types/
│   └── types.ts      - TypeScript interfaces
├── utils/
│   ├── face-api-loader.ts - AI model loading
│   └── utils.ts           - Utility functions
├── App.tsx              - Main application
├── main.tsx             - Entry point
└── index.css            - Global styles

----------------------------------------
LICENSE
----------------------------------------

This project is licensed under the MIT License - see the LICENSE file for details.

----------------------------------------
AUTHOR
----------------------------------------

Syed Tanvir Islam
GitHub: @aluukill


----------------------------------------
CONTRIBUTING
----------------------------------------

Contributions are welcome! Feel free to submit a Pull Request.