import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// Globalny system powiadomień (toasty) i potwierdzeń (modal) w stylu aplikacji.
// Zastępuje surowe przeglądarkowe alert()/confirm().
const DialogContext = createContext(null);

let idSeq = 0;

// Heurystyka typu dla przejętych alert() — żeby kolor pasował do treści.
function inferType(message) {
    const m = (message || '').toString().toLowerCase();
    if (/(pomyślnie|wysłane|stworzon|utworzon|zaktualizowan|wyczyszczon|zapisano|sukces|gotowe)/.test(m)) return 'success';
    if (/(błąd|błed|nie udało|nie można|nie znaleziono|identyczne|musisz|musi|wpisz|wymagan|problem|niepoprawn)/.test(m)) return 'error';
    return 'info';
}

const TOAST_STYLES = {
    success: { border: 'border-green-500/30', icon: <CheckCircle2 size={18} className="text-green-500" /> },
    error:   { border: 'border-red-500/30',   icon: <AlertTriangle size={18} className="text-red-500" /> },
    info:    { border: 'border-white/10',      icon: <Info size={18} className="text-gray-300" /> },
};

function ToastCard({ toast, onClose }) {
    const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
    return (
        <div className={`pointer-events-auto bg-[#0f0f0f] border ${style.border} rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-4 flex items-start gap-3 animate-in slide-in-from-right-8 fade-in duration-300`}>
            <div className="shrink-0 mt-0.5">{style.icon}</div>
            <p className="flex-1 text-xs font-bold text-gray-200 leading-relaxed break-words">{toast.message}</p>
            <button onClick={onClose} className="shrink-0 text-gray-600 hover:text-white transition-colors">
                <X size={14} />
            </button>
        </div>
    );
}

export function DialogProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const resolveRef = useRef(null);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((message, type = 'info') => {
        const id = ++idSeq;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => removeToast(id), 4500);
    }, [removeToast]);

    // confirm(message, { danger, confirmText, cancelText, title }) => Promise<boolean>
    const confirm = useCallback((message, opts = {}) => {
        return new Promise((resolve) => {
            resolveRef.current = resolve;
            setConfirmState({
                message: typeof message === 'string' ? message : (message?.message ?? ''),
                title: opts.title || (opts.danger ? 'Czy na pewno?' : 'Potwierdzenie'),
                confirmText: opts.confirmText || (opts.danger ? 'Usuń' : 'Potwierdź'),
                cancelText: opts.cancelText || 'Anuluj',
                danger: !!opts.danger,
            });
        });
    }, []);

    const closeConfirm = useCallback((result) => {
        const r = resolveRef.current;
        resolveRef.current = null;
        setConfirmState(null);
        if (r) r(result);
    }, []);

    // Przejmujemy globalne alert() → ładny toast, bez ruszania setek wywołań.
    useEffect(() => {
        const original = window.alert;
        window.alert = (message) => toast(message, inferType(message));
        return () => { window.alert = original; };
    }, [toast]);

    return (
        <DialogContext.Provider value={{ toast, confirm }}>
            {children}

            {/* TOASTY */}
            <div className="fixed top-24 right-4 z-[6000] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
                {toasts.map(t => (
                    <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
                ))}
            </div>

            {/* POTWIERDZENIE */}
            {confirmState && (
                <div
                    className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => closeConfirm(false)}
                >
                    <div
                        className="bg-[#0f0f0f] text-white w-full max-w-md rounded-[2rem] border border-white/10 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)] animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-5">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${confirmState.danger ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                                <AlertTriangle size={18} />
                            </div>
                            <h3 className="text-lg font-black italic uppercase tracking-tighter">{confirmState.title}</h3>
                        </div>
                        <p className="text-sm text-gray-300 font-medium leading-relaxed mb-8">{confirmState.message}</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => closeConfirm(false)}
                                className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-300 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all"
                            >
                                {confirmState.cancelText}
                            </button>
                            <button
                                onClick={() => closeConfirm(true)}
                                className={`flex-1 py-4 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all text-white ${confirmState.danger ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
                            >
                                {confirmState.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    );
}

export const useDialog = () => useContext(DialogContext);
