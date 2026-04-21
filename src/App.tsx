import { createContext, useContext, useEffect, useState } from "react";
import { User, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { LogIn, LogOut, Loader2, ScanFace, UserPlus, FileBarChart, Menu, X, Users } from "lucide-react";
import Dashboard from "./components/Dashboard";
import Scanner from "./components/Scanner";
import Register from "./components/Register";
import Students from "./components/Students";
import { ToastProvider, ConfirmDialogProvider } from "./components/Toast";

export const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

type ViewState = "dashboard" | "scanner" | "register" | "students";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewState>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const closeSidebar = () => setSidebarOpen(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-gray-900/20">
          <ScanFace className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100/50 flex flex-col items-center max-w-sm w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center mb-5 sm:mb-6 shadow-lg shadow-gray-900/20">
            <ScanFace className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2 tracking-tight">MC Attendance</h1>
          <p className="text-gray-500 text-sm text-center mb-8 sm:mb-10">
            Face scanning attendance system for modern classrooms
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl py-3.5 px-6 font-medium transition-all hover:shadow-xl hover:shadow-gray-900/20 hover:-translate-y-0.5 active:translate-y-0 text-sm sm:text-base"
          >
            <LogIn className="w-5 h-5" />
            Sign in with Google
          </button>
          <p className="text-xs text-gray-400 mt-6 text-center">
            Secure authentication powered by Firebase
          </p>
        </div>
      </div>
    );
  }

return (
    <AuthContext.Provider value={{ user, loading }}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 font-sans">
            {/* Mobile Header */}
            <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                  <ScanFace className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900 text-sm">MC Attendance</span>
              </div>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </header>

            {/* Mobile Overlay */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-30 md:hidden"
                onClick={closeSidebar}
              />
            )}

            {/* Sidebar */}
            <aside className={`
              fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 flex flex-col transform transition-transform duration-200 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0
            `}>
              <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center shadow-lg shadow-gray-900/20">
                  <ScanFace className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-gray-900 tracking-tight text-base">MC Attendance</span>
              </div>
              
              <nav className="flex-1 p-4 space-y-1.5">
                <NavItem 
                  active={view === "dashboard"} 
                  onClick={() => { setView("dashboard"); closeSidebar(); }} 
                  icon={<FileBarChart className="w-5 h-5" />}
                >
                  Dashboard
                </NavItem>
                <NavItem 
                  active={view === "scanner"} 
                  onClick={() => { setView("scanner"); closeSidebar(); }} 
                  icon={<ScanFace className="w-5 h-5" />}
                >
                  Scanner
                </NavItem>
                <NavItem 
                  active={view === "register"} 
                  onClick={() => { setView("register"); closeSidebar(); }} 
                  icon={<UserPlus className="w-5 h-5" />}
                >
                  Register
                </NavItem>
                <NavItem 
                  active={view === "students"} 
                  onClick={() => { setView("students"); closeSidebar(); }} 
                  icon={<Users className="w-5 h-5" />}
                >
                  Students
                </NavItem>
              </nav>

              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-white border border-gray-100 shadow-sm">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full ring-2 ring-gray-100" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl py-2.5 px-3 transition-all text-sm font-medium border border-transparent hover:border-gray-200 shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 min-h-screen pb-20">
              {view === "dashboard" && <Dashboard />}
              {view === "scanner" && <Scanner />}
              {view === "register" && <Register />}
              {view === "students" && <Students />}
            </main>

            {/* Footer - Fixed at bottom */}
            <footer className="fixed bottom-0 left-0 right-0 md:left-64 border-t border-gray-100 bg-white/90 backdrop-blur-md px-6 py-3 z-20">
              <div className="text-center text-sm text-gray-500 max-w-5xl mx-auto">
                <span className="font-medium text-gray-700">Made by Afnan</span>
                <span className="mx-2 text-gray-300">•</span>
                <span>
                  Contact:{" "}
                  <a 
                    href="https://wa.me/+8801607030311" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    WhatsApp +880 1607-030311
                  </a>
                </span>
              </div>
            </footer>
          </div>
        </ConfirmDialogProvider>
      </ToastProvider>
    </AuthContext.Provider>
  );
}

function NavItem({ children, icon, active, onClick }: { children: React.ReactNode, icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}