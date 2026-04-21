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
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center max-w-sm w-full">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4 sm:mb-6">
            <ScanFace className="w-7 h-7 sm:w-8 sm:h-8 text-gray-800" />
          </div>
          <h1 className="text-xl sm:text-2xl font-medium text-gray-900 mb-2 font-sans tracking-tight">MC Attendance Box</h1>
          <p className="text-gray-500 text-sm text-center mb-6 sm:mb-8">
            Face scanning attendance system. Sign in to continue.
          </p>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full py-3 px-6 font-medium transition-colors text-sm sm:text-base"
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
      <ToastProvider>
        <ConfirmDialogProvider>
          <div className="min-h-screen bg-[#f5f5f5] font-sans">
            {/* Mobile Header */}
            <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-2">
                <ScanFace className="w-5 h-5 text-gray-900" />
                <span className="font-semibold text-gray-900 text-sm">MC Attendance Box</span>
              </div>
              <button 
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
              fixed md:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
              md:translate-x-0
            `}>
              <div className="p-4 border-b border-gray-100 flex items-center gap-3">
                <ScanFace className="w-6 h-6 text-gray-900" />
                <span className="font-semibold text-gray-900 tracking-tight">MC Attendance Box</span>
              </div>
              
              <nav className="flex-1 p-3 space-y-1">
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

              <div className="p-3 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-3 px-2">
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} 
                    alt="Profile" 
                    className="w-9 h-9 rounded-full" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg py-2.5 px-3 transition-colors text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 min-h-screen">
              {view === "dashboard" && <Dashboard />}
              {view === "scanner" && <Scanner />}
              {view === "register" && <Register />}
              {view === "students" && <Students />}

              {/* Footer */}
              <footer className="mt-auto border-t border-gray-200 bg-white px-6 py-4">
                <div className="text-center text-sm text-gray-500">
                  <p className="mb-1">Made by Afnan</p>
                  <p>
                    For any help, contact:{" "}
                    <a 
                      href="https://wa.me/+8801607030311" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      WhatsApp +880 1607-030311
                    </a>
                  </p>
                </div>
              </footer>
            </main>
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