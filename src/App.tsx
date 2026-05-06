import { createContext, useContext, useEffect, useState } from "react";
import { User, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./services/firebase";
import { LogIn, LogOut, Loader2, ScanFace, UserPlus, FileBarChart, Menu, X, Users, Info } from "lucide-react";
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
  const [profilePopupOpen, setProfilePopupOpen] = useState(false);

  const handleAboutClick = () => {
    window.open('/About/about.html', '_blank');
  };

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
        <img src="/logo.png" alt="MC Attendance Box" className="w-14 h-14 object-contain mb-4" />
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100/50 flex flex-col items-center max-w-sm w-full">
          <img src="/logo.png" alt="MC Attendance Box" className="w-20 h-20 sm:w-24 sm:h-24 object-contain mb-5 sm:mb-6" />
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2 tracking-tight">MC Attendance Box</h1>
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
            <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 sticky top-0 z-30 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="MC Attendance Box" className="w-8 h-8 rounded-lg object-contain" />
                  <span className="font-semibold text-gray-900 text-sm">MC Attendance Box</span>
                </div>
                <button 
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className={`p-2.5 rounded-xl transition-all duration-200 ${
                    sidebarOpen 
                      ? "bg-gray-900 text-white rotate-90" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  }`}
                  aria-label="Toggle menu"
                >
                  <div className="relative w-5 h-5">
                    {sidebarOpen ? (
                      <X className="w-5 h-5 absolute inset-0" />
                    ) : (
                      <div className="flex flex-col justify-center items-center gap-1.5 w-full h-full">
                        <span className="w-5 h-0.5 bg-current rounded-full"></span>
                        <span className="w-5 h-0.5 bg-current rounded-full"></span>
                        <span className="w-3.5 h-0.5 bg-current rounded-full"></span>
                      </div>
                    )}
                  </div>
                </button>
              </div>
              
              {/* Mobile Dropdown Menu */}
              {sidebarOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-lg mt-1 py-2 z-50">
                  <nav className="space-y-1 px-2">
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
                    <NavItem 
                      active={false} 
                      onClick={() => { handleAboutClick(); closeSidebar(); }} 
                      icon={<Info className="w-5 h-5" />}
                    >
                      About
                    </NavItem>
                  </nav>
                  <div className="border-t border-gray-100 mt-2 pt-2 px-4">
                    <button
                      onClick={() => {
                        setProfilePopupOpen(!profilePopupOpen);
                      }}
                      className="w-full flex items-center gap-3 mb-2 p-2 -mx-2 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <img 
                        src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} 
                        alt="Profile" 
                        className="w-8 h-8 rounded-full ring-2 ring-gray-100" 
                      />
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </button>
                    
                    {/* Mobile Profile Popup */}
                    {profilePopupOpen && (
                      <div className="py-2 bg-gray-50 rounded-xl px-2">
                        <button
                          onClick={() => { handleLogout(); setProfilePopupOpen(false); setSidebarOpen(false); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                        <button
                          onClick={() => setProfilePopupOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </header>

            {/* Mobile Overlay */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/50 z-20 md:hidden"
                onClick={closeSidebar}
              />
            )}

            {/* Sidebar - Desktop only */}
            <aside className={`
              hidden md:flex fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-100 flex-col h-screen
            `}>
              <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
                <img src="/logo.png" alt="MC Attendance Box" className="w-9 h-9 rounded-xl object-contain" />
                <span className="font-semibold text-gray-900 tracking-tight text-base">MC Attendance Box</span>
              </div>
              
              <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
                <NavItem 
                  active={view === "dashboard"} 
                  onClick={() => setView("dashboard")} 
                  icon={<FileBarChart className="w-5 h-5" />}
                >
                  Dashboard
                </NavItem>
                <NavItem 
                  active={view === "scanner"} 
                  onClick={() => setView("scanner")} 
                  icon={<ScanFace className="w-5 h-5" />}
                >
                  Scanner
                </NavItem>
                <NavItem 
                  active={view === "register"} 
                  onClick={() => setView("register")} 
                  icon={<UserPlus className="w-5 h-5" />}
                >
                  Register
                </NavItem>
                <NavItem 
                  active={view === "students"} 
                  onClick={() => setView("students")} 
                  icon={<Users className="w-5 h-5" />}
                >
                  Students
                </NavItem>
                <NavItem 
                  active={false} 
                  onClick={handleAboutClick} 
                  icon={<Info className="w-5 h-5" />}
                >
                  About
                </NavItem>
              </nav>

              <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setProfilePopupOpen(!profilePopupOpen)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                >
                  <img 
                    src={user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName}`} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full ring-2 ring-gray-100" 
                  />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.displayName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </button>
                
                {/* Profile Popup */}
                {profilePopupOpen && (
                  <div className="mt-2 py-2 bg-white border border-gray-100 rounded-xl shadow-lg">
                    <button
                      onClick={() => { handleLogout(); setProfilePopupOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors text-sm font-medium"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                    <button
                      onClick={() => setProfilePopupOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Main Content */}
            <main className="md:ml-64 flex-1 min-h-screen">
              <div className="h-full">
                {view === "dashboard" && <Dashboard />}
                {view === "scanner" && <Scanner />}
                {view === "register" && <Register />}
                {view === "students" && <Students />}
              </div>
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