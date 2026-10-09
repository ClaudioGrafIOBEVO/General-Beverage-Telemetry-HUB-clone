import React, { useState } from 'react';
import { Shield, Lock, User, Eye, EyeOff, KeyRound, CheckCircle2, AlertCircle, Sun, Moon, ShieldCheck, HeadphonesIcon } from 'lucide-react';
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
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-300 ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      
      {/* === LATO SINISTRO: BRAND E VALORE (Visibile solo su Desktop) === */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 flex-col justify-between p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <PortalBrandLogo size="xl" variant="full" showSubtitle={true} className="brightness-0 invert" />
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold tracking-tight mb-4">Gestione Flotta Intelligente</h1>
          <p className="text-lg text-slate-300 leading-relaxed">
            Monitoraggio in tempo reale, telemetria avanzata e controllo totale dei tuoi distributori con i moduli <strong className="text-emerald-400">GB-CLOUD</strong>.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>Crittografia end-to-end e conformità GDPR</span>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-500">
          © {new Date().getFullYear()} General Beverage. Tutti i diritti riservati.
        </div>
      </div>

      {/* === LATO DESTRO: FORM DI LOGIN === */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        
        <div className="absolute top-6 right-6 z-20">
          <button
            type="button"
            onClick={toggleTheme}
            title={isLight ? 'Attiva Tema Scuro' : 'Attiva Tema Chiaro'}
            className={`p-2.5 rounded-full border transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm ${
              isLight ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {isLight ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        </div>

        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-4">
              <PortalBrandLogo size="lg" />
            </div>
            <h2 className="text-xl font-bold">General Beverage Telemetry Hub</h2>
          </div>

          <div className={`rounded-2xl p-6 sm:p-8 border shadow-sm transition-all ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-lg font-bold">Accesso Riservato</h2>
              </div>
              <span className={`text-[10px] font-mono font-medium px-2 py-1 rounded-md border flex items-center gap-1 ${
                isLight ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}>
                <Lock className="w-3 h-3" /> TLS Cifrato
              </span>
            </div>

            {error && (
              <div className={`mb-5 p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                isLight ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="font-semibold">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Nome Utente
                </label>
                <div className="relative">
                  <User className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Es. admin, tecnico, operatore"
                    autoComplete="username"
                    required
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      isLight ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className={`w-full pl-10 pr-11 py-2.5 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 ${
                      isLight ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400' : 'bg-slate-950 border border-slate-800 text-white placeholder-slate-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors cursor-pointer ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'}`}
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
                    className="rounded text-emerald-600 focus:ring-emerald-500/30 border-slate-300 dark:border-slate-700 dark:bg-slate-950"
                  />
                  <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Resta connesso</span>
                </label>
                <a href="mailto:assistenza@iobevoservice.it" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                  <HeadphonesIcon className="w-3.5 h-3.5" />
                  Hai bisogno di aiuto?
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 cursor-pointer"
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

            <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 text-center">
              <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Non hai ancora le credenziali di accesso?
              </p>
              <a 
                href="mailto:commerciale@iobevoservice.it?subject=Richiesta%20accesso%20demo%20Telemetry%20Hub"
                className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/50 text-xs font-bold hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
              >
                Richiedi accesso demo o assistenza
              </a>
            </div>
          </div>

          <div className="mt-8 space-y-3 text-center">
            <div className={`text-[11px] flex items-center justify-center gap-1.5 font-medium ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Protezione Crittografica & Telemetria GB-CLOUD Attiva</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] flex-wrap text-slate-400">
              <button type="button" onClick={() => setShowPrivacyModal(true)} className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline flex items-center gap-1 cursor-pointer">
                <ShieldCheck className="w-3 h-3" /> Privacy & Cookie
              </button>
              <span>•</span>
              <a href="/terms" className="hover:text-slate-600 dark:hover:text-slate-300 hover:underline">Termini di servizio</a>
            </div>
          </div>
        </div>
      </div>

      <PrivacyPolicyModal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)} />
    </div>
  );
};
