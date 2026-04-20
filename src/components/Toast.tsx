import { useState, createContext, useContext, ReactNode } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ToastConfig {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastContextType {
  showToast: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const showToast = (message: string, variant: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const variantStyles = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-900 text-white'
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`${variantStyles[toast.variant]} px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-bottom-5 cursor-pointer`}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: (() => Promise<void>) | null;
  variant?: 'danger' | 'warning' | 'success';
}

interface ConfirmDialogContextType {
  showConfirm: (options: { title: string; message: string; onConfirm: () => Promise<void>; variant?: 'danger' | 'warning' | 'success' }) => void;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | null>(null);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmDialogState>({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'danger'
  });

  const showConfirm = (options: { title: string; message: string; onConfirm: () => Promise<void>; variant?: 'danger' | 'warning' | 'success' }) => {
    setState({ open: true, ...options });
  };

  const handleClose = () => {
    setState({ open: false, title: '', message: '', onConfirm: null });
  };

  const handleConfirm = async () => {
    if (state.onConfirm) {
      await state.onConfirm();
      handleClose();
    }
  };

  const variantStyles = {
    danger: {
      iconBg: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700',
      icon: <AlertTriangle className="w-6 h-6" />
    },
    warning: {
      iconBg: 'bg-orange-100 text-orange-600',
      button: 'bg-orange-600 hover:bg-orange-700',
      icon: <AlertTriangle className="w-6 h-6" />
    },
    success: {
      iconBg: 'bg-green-100 text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
      icon: <CheckCircle className="w-6 h-6" />
    }
  };

  const styles = variantStyles[state.variant || 'danger'];

  return (
    <ConfirmDialogContext.Provider value={{ showConfirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm mx-4 shadow-2xl animate-in zoom-in-95 fade-in">
            <div className={`w-12 h-12 ${styles.iconBg} rounded-2xl flex items-center justify-center mb-4`}>
              {styles.icon}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{state.title}</h3>
            <p className="text-gray-600 mb-6">{state.message}</p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`flex-1 px-4 py-3 rounded-xl ${styles.button} text-white transition-colors font-medium`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}