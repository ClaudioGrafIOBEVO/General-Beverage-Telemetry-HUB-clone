import React, { useState, useEffect } from 'react';
import {
  Mail,
  Server,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Info
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SmtpStatusResponse {
  configured: boolean;
  source: 'DATABASE_CONFIG' | 'ENV_VARIABLES' | 'NONE';
  config: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    hasPassword: boolean;
    fromName: string;
    fromEmail: string;
    defaultRecipient: string;
  };
}

export const SmtpConfigManager: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [status, setStatus] = useState<SmtpStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'claudiograf80@gmail.com',
    pass: '',
    fromName: 'General Beverage Portale Ordini',
    fromEmail: 'claudiograf80@gmail.com',
    defaultRecipient: 'claudiograf80@gmail.com',
  });

  // Test send state
  const [testRecipient, setTestRecipient] = useState('claudiograf80@gmail.com');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/smtp');
      if (res.ok) {
        const data: SmtpStatusResponse = await res.json();
        setStatus(data);
        if (data.config) {
          setFormData((prev) => ({
            ...prev,
            enabled: data.config.enabled ?? true,
            host: data.config.host || prev.host,
            port: data.config.port || prev.port,
            secure: data.config.secure ?? prev.secure,
            user: data.config.user || prev.user,
            pass: data.config.hasPassword ? '••••••••••••••••' : '',
            fromName: data.config.fromName || prev.fromName,
            fromEmail: data.config.fromEmail || prev.fromEmail,
            defaultRecipient: data.config.defaultRecipient || prev.defaultRecipient,
          }));
          if (data.config.defaultRecipient) {
            setTestRecipient(data.config.defaultRecipient);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching SMTP config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleApplyPreset = (preset: 'gmail' | 'office365' | 'aruba' | 'brevo') => {
    if (preset === 'gmail') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        fromName: prev.fromName || 'General Beverage Ordini',
      }));
    } else if (preset === 'office365') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp.office365.com',
        port: 587,
        secure: false,
      }));
    } else if (preset === 'aruba') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtps.aruba.it',
        port: 465,
        secure: true,
      }));
    } else if (preset === 'brevo') {
      setFormData((prev) => ({
        ...prev,
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);
    try {
      const res = await fetch('/api/system/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotification({ type: 'success', text: 'Configurazione SMTP salvata con successo!' });
        fetchConfig();
      } else {
        setNotification({ type: 'error', text: data.error || 'Errore durante il salvataggio dei parametri SMTP.' });
      }
    } catch {
      setNotification({ type: 'error', text: 'Errore di connessione verso il server.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testRecipient || !testRecipient.includes('@')) {
      setTestResult({
        success: false,
        message: 'Inserisci un indirizzo email valido (es. tuonome@dominio.it) per eseguire il test.',
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/system/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testRecipient }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: `Email di test recapitata con successo a ${testRecipient}!`,
          details: `Message ID: ${data.messageId}`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Invio fallito. Verifica host, porta, utente e password.',
          details: data.details,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Errore di connessione con il server per il test.',
      });
    } finally {
      setTesting(false);
    }
  };

  const isConfigured = status?.configured ?? false;

  return (
    <div className="space-y-6">
      {/* Banner Notifica Salvataggio */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${
            notification.type === 'success'
              ? isLight
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
              : isLight
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-rose-950/40 text-rose-300 border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          isLight
            ? 'bg-gradient-to-r from-amber-50/70 via-blue-50/40 to-slate-50 border-amber-200/80 shadow-xs'
            : 'bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-900 border-amber-800/30 shadow-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-2xl border ${
                isConfigured
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20'
                  : 'bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-500/20'
              }`}
            >
              <Mail className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Server SMTP &amp; Notifiche Email
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${
                    isConfigured
                      ? isLight
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : isLight
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  {isConfigured ? 'Server SMTP Attivo & Connesso' : 'SMTP Non Configurato (Nessuna email reale)'}
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Configura i parametri del server di posta (Gmail, Office 365, Aruba, Brevo, corporate SMTP) per recapitare
                automaticamente via email le notifiche di <strong>Rifornimento Prodotti Clienti</strong> e gli <strong>Allarmi Distributori</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              type="button"
              onClick={fetchConfig}
              disabled={loading}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-2xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna Stato
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form Configurazione SMTP */}
        <div
          className={`lg:col-span-2 p-6 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Parametri Connessione Server di Posta
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Protocollo Standard RFC 5321 (SMTP / SMTPS)
            </span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mb-6">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-2">
              Compila velocemente con un provider predefinito:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyPreset('gmail')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Google Gmail</span>
                <span className="text-[10px] font-normal opacity-80">(smtp.gmail.com:587)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('office365')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Microsoft 365 / Outlook</span>
                <span className="text-[10px] font-normal opacity-80">(:587)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('aruba')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Aruba Webmail</span>
                <span className="text-[10px] font-normal opacity-80">(:465 SSL)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('brevo')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer transition-all flex items-center gap-1.5"
              >
                <span>Brevo (ex Sendinblue)</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Server SMTP (Host) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="smtp.gmail.com oppure mail.tuodominio.it"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-medium border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Porta SMTP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="587 o 465"
                  value={formData.port}
                  onChange={(e) => {
                    const port = parseInt(e.target.value, 10) || 587;
                    setFormData({ ...formData, port, secure: port === 465 });
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.secure}
                  onChange={(e) => setFormData({ ...formData, secure: e.target.checked })}
                  className="rounded-md accent-blue-600"
                />
                <span>Usa connessione SSL/TLS sicura diretta (Porta 465). Per porta 587 lascia deselezionato (STARTTLS automatico).</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Utente / Email SMTP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. claudiograf80@gmail.com"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password SMTP o Password per le App <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password casella o Password per le App Google"
                    value={formData.pass}
                    onChange={(e) => setFormData({ ...formData, pass: e.target.value })}
                    className={`w-full px-3 py-2 pr-10 rounded-xl text-xs font-mono border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Mittente Visibile
                </label>
                <input
                  type="text"
                  placeholder="General Beverage Portale Ordini"
                  value={formData.fromName}
                  onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Mittente (FROM)
                </label>
                <input
                  type="email"
                  placeholder="es. noreply@iobevo.com o tua@gmail.com"
                  value={formData.fromEmail}
                  onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                  }`}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Destinatario Predefinito per Ordini di Rifornimento Merce
              </label>
              <input
                type="email"
                placeholder="es. claudiograf80@gmail.com, magazzino@iobevo.com"
                value={formData.defaultRecipient}
                onChange={(e) => setFormData({ ...formData, defaultRecipient: e.target.value })}
                className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500'
                    : 'bg-slate-800 border-slate-700 text-white focus:border-blue-500'
                }`}
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Quando un cliente o gestore invia un ordine rifornimento contenitori, questa email riceverà automaticamente la notifica dettagliata con codice ordine e articoli.
              </span>
            </div>

            <div className="pt-4 border-t flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded-md accent-emerald-600"
                />
                <span>Abilita invio automatico email dal server</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 cursor-pointer transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Salva Configurazione SMTP
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Test Connessione & Guida Gmail */}
        <div className="space-y-6">
          {/* Box 1: Test Invio Immediato */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800 shadow-lg'
            }`}
          >
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>
                Test Connessione &amp; Invio
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Invia subito un messaggio di prova reale per verificare le credenziali e verificare che il server SMTP consegni l'email.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email Ricevente per il Test:
                </label>
                <input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="tuaemail@gmail.com"
                  className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-800 border-slate-700 text-white'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleTestSend}
                disabled={testing}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {testing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connessione al server SMTP...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Invia Email di Prova Ora
                  </>
                )}
              </button>

              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    testResult.success
                      ? isLight
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                        : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                      : isLight
                      ? 'bg-rose-50 text-rose-900 border-rose-200'
                      : 'bg-rose-950/40 text-rose-300 border-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.details && (
                    <div className="text-[10px] font-mono opacity-80 break-all">
                      {testResult.details}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Box 2: Guida Rapida per Gmail (Password per le App) */}
          <div
            className={`p-5 rounded-2xl border transition-all ${
              isLight ? 'bg-blue-50/60 border-blue-200 text-slate-800' : 'bg-blue-950/20 border-blue-900/40 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Guida: Se usi Google Gmail
              </h4>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mb-3">
              Google non accetta più la normale password di accesso ma richiede una <strong>Password per le App</strong> a 16 lettere:
            </p>
            <ol className="text-xs space-y-2 list-decimal list-inside text-slate-700 dark:text-slate-300 font-medium">
              <li>
                Accedi al tuo account Google su{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline font-bold inline-flex items-center gap-0.5"
                >
                  myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Crea una nuova password per le app chiamandola ad esempio <em>"Portale Vending"</em>.
              </li>
              <li>
                Copia il codice di 16 caratteri e incollalo nel campo <strong>Password SMTP</strong> qui sopra.
              </li>
            </ol>
            <div className="mt-3 p-2.5 rounded-lg bg-blue-100/60 dark:bg-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Server: <strong>smtp.gmail.com</strong> | Porta: <strong>587</strong> | SSL: <strong>Disattivato</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
