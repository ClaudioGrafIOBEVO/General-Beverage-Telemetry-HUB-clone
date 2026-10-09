import React, { useState } from 'react';
import { Coffee, Shield, Lock, User, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, Sun, Moon, ShieldCheck } from 'lucide-react';
import { AuthUser } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PrivacyPolicyModal } from './PrivacyPolicyModal';
import { PortalBrandLogo } from './PortalBrandLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Inserisci sia nome utente che password.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Accesso non riuscito. Verifica le credenziali.');
        setIsLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('vending_auth_token', data.token);
        localStorage.setItem('vending_auth_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('vending_auth_token', data.token);
        sessionStorage.setItem('vending_auth_user', JSON.stringify(data.user));
      }

      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError('Errore di connessione con il server. Verifica la rete.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden transition-colors ${
      isLight ? 'bg-slate-100 text-slate-800' : 'bg-slate-950 text-slate-100'
    }`}>
      {/* Top corner theme toggle */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          title={isLight ? 'Attiva Tema Scuro' : 'Attiva Tema Chiaro'}
          className={`p-2.5 rounded-2xl border transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm ${
            isLight
              ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
          }`}
        >
          {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          <span className="hidden sm:inline">{isLight ? 'Tema Chiaro' : 'Tema Scuro'}</span>
        </button>
      </div>

      {/* Background glow and decorative elements */}
      {isLight ? (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-white px-5 py-2.5 rounded-2xl shadow-md border border-slate-200 mb-4 transition-transform hover:scale-105">
            <PortalBrandLogo size="lg" className="h-12 sm:h-14" />
          </div>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            General Beverage Telemetry Hub
          </h1>
          <p className={`text-sm mt-1.5 max-w-sm mx-auto font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            Portale Ufficiale di Gestione Flotta &bull; <strong className="text-emerald-600 dark:text-emerald-400">io sano</strong> &amp; <strong className="text-emerald-600 dark:text-emerald-400">io bevo</strong>
          </p>
        </div>

        {/* Login Card */}
        <div className={`rounded-3xl p-6 sm:p-8 border shadow-xl backdrop-blur-xl transition-all ${
          isLight
            ? 'bg-white/95 border-slate-300 shadow-slate-300/60 text-slate-800'
            : 'bg-slate-900/90 border-slate-800 shadow-2xl text-slate-100'
        }`}>
          <div className={`flex items-center justify-between pb-5 border-b mb-6 ${
            isLight ? 'border-slate-300' : 'border-slate-800'
          }`}>
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
              <h2 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Accesso Riservato</h2>
            </div>
            <span className={`text-[11px] font-mono font-medium px-2.5 py-1 rounded-md border ${
              isLight ? 'bg-slate-100 text-slate-800 border-slate-400' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              HTTPS TLS / Cifrato
            </span>
          </div>

          {error && (
            <div className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
              isLight
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Nome Utente (Username)
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none ${
                  isLight ? 'text-slate-400' : 'text-slate-400'
                }`}>
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Es. Claudio Graf, admin, tecnico..."
                  autoComplete="username"
                  required
                  className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'
                      : 'bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'
                      : 'bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  id="btn-toggle-show-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute inset-y-0 right-0 pr-3.5 flex items-center transition-colors cursor-pointer ${
                    isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`rounded text-amber-500 focus:ring-amber-500/30 ${
                    isLight ? 'border-slate-400 bg-white' : 'border-slate-700 bg-slate-950'
                  }`}
                />
                <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Resta connesso (Ricordami)</span>
              </label>
            </div>

            <button
              type="submit"
              id="btn-submit-login"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-500/25 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticazione in corso...</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Accedi alla Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Access Pills */}
          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
            <span className={`block text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-center ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Accesso Rapido Selezionando Profilo:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setUsername('Claudio Graf');
                  setPassword('ClaudioIoBevo1@');
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors text-center cursor-pointer ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                }`}
              >
                👑 Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('tecnico');
                  setPassword('tech2026');
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors text-center cursor-pointer ${
                  isLight
                    ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800'
                    : 'bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/30 text-sky-300'
                }`}
              >
                🔧 Tecnico
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('operatore');
                  setPassword('vending2026');
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors text-center cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                }`}
              >
                ☕ Operatore
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('cliente');
                  setPassword('cliente2026');
                }}
                className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors text-center cursor-pointer ${
                  isLight
                    ? 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800'
                    : 'bg-teal-500/10 hover:bg-teal-500/20 border-teal-500/30 text-teal-300'
                }`}
                title="Cliente Referente Sede (vede solo il cruscotto della propria struttura)"
              >
                🏢 Cliente Sede
              </button>
            </div>
          </div>
        </div>

        {/* Security badge & Privacy footer */}
        <div className="mt-6 space-y-2 text-center">
          <div className={`text-xs flex items-center justify-center gap-2 font-medium ${
            isLight ? 'text-slate-700' : 'text-slate-500'
          }`}>
            <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-500'}`} />
            <span>Protezione Crittografica &amp; Telemetria Moduli GB-CLOUD Attiva</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-[11px] flex-wrap">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className={`hover:underline flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Informativa Privacy &amp; Cookie (GDPR)</span>
            </button>
            <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>&bull;</span>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Privacy
            </a>
            <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>&bull;</span>
            <a
              href="/cookie-policy"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Cookie
            </a>
            <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>&bull;</span>
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Termini
            </a>
          </div>
        </div>

        {/* Modal Informativa Privacy GDPR */}
        <PrivacyPolicyModal
          isOpen={showPrivacyModal}
          onClose={() => setShowPrivacyModal(false)}
        />
      </div>
    </div>
  );
};

