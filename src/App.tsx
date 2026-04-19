import { createContext, useContext, useEffect, useState } from "react";
import { User, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { LogIn, LogOut, Loader2, ScanFace, UserPlus, FileBarChart } from "lucide-react";
import Dashboard from "./components/Dashboard";
import Scanner from "./components/Scanner";
import Register from "./components/Register";

export const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

type ViewState = "dashboard" | "scanner" | "register";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>("dashboard");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center max-w-sm w-full">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <ScanFace className="w-8 h-8 text-gray-800" />
          </div>
          <h1 className="text-2xl font-medium text-gray-900 mb-2 font-sans tracking-tight">Access Control</h1>
          <p className="text-gray-500 text-sm text-center mb-8">
            Industrial face scanning attendance system. Please sign in to authenticate.
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full py-3 px-6 font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
        <div className="min-h-screen bg-[#f5f5f5] font-sans flex flex-col md:flex-row">
          {/* Sidebar */}
          <aside className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <ScanFace className="w-6 h-6 text-gray-900" />
              <span className="font-semibold text-gray-900 tracking-tight">VisionTrack</span>
            </div>
            
            <nav className="flex-1 p-4 space-y-1">
              <NavItem active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<FileBarChart className="w-4 h-4" />}>Dashboard</NavItem>
              <NavItem active={view === "scanner"} onClick={() => setView("scanner")} icon={<ScanFace className="w-4 h-4" />}>Scanner Mode</NavItem>
              <NavItem active={view === "register"} onClick={() => setView("register")} icon={<UserPlus className="w-4 h-4" />}>Register Student</NavItem>
            </nav>

            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center gap-3 mb-4 px-2">
                <img src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} alt="Profile" className="w-8 h-8 rounded-full" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2 px-3 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {view === "dashboard" && <Dashboard />}
            {view === "scanner" && <Scanner />}
            {view === "register" && <Register />}
          </main>
        </div>
    </AuthContext.Provider>
  );
}

function NavItem({ children, icon, active, onClick }: { children: React.ReactNode, icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
