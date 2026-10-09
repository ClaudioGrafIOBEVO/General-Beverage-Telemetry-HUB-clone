import React, { useState, useEffect } from 'react';
import { PinRecord, AccessLog } from '../types';
import { ShieldCheck, Plus, Trash2, CheckCircle, XCircle, Lock, Unlock, Key, RefreshCw } from 'lucide-react';
import { playSuccessSound, playErrorSound } from '../utils/audio';
import { useTheme } from '../context/ThemeContext';

export const PinAccessManager: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [pins, setPins] = useState<PinRecord[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Utente');
  const [isDoorUnlocked, setIsDoorUnlocked] = useState(false);
  const [testPinInput, setTestPinInput] = useState('');
  const [testResult, setTestResult] = useState<{ granted: boolean; message: string } | null>(null);

  const fetchPinsAndLogs = async () => {
    try {
      const [pinsRes, accessRes] = await Promise.all([
        fetch('/api/pins'),
        fetch('/api/access-logs'),
      ]);
      if (pinsRes.ok) setPins(await pinsRes.json());
      if (accessRes.ok) setAccessLogs(await accessRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPinsAndLogs();
  }, []);

  const handleAddPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    try {
      const res = await fetch('/api/pins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newCode, name: newName, role: newRole }),
      });
      if (res.ok) {
        setNewCode('');
        setNewName('');
        fetchPinsAndLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePin = async (id: string) => {
    try {
      await fetch(`/api/pins/${id}`, { method: 'DELETE' });
      fetchPinsAndLogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePin = async (id: string) => {
    try {
      await fetch(`/api/pins/${id}/toggle`, { method: 'PATCH' });
      fetchPinsAndLogs();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestPin = async () => {
    if (!testPinInput) return;
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: testPinInput, deviceId: 'WEB-TEST-CONSOLE' }),
      });
      const data = await res.json();
      if (data.granted) {
        playSuccessSound();
        setIsDoorUnlocked(true);
        setTestResult({ granted: true, message: `Accesso autorizzato: ${data.user || 'OK'}` });
        setTimeout(() => setIsDoorUnlocked(false), 3000);
      } else {
        playErrorSound();
        setTestResult({ granted: false, message: 'PIN non valido o disabilitato' });
      }
      setTestPinInput('');
      fetchPinsAndLogs();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="pin-access-manager-container" className="space-y-6">
      {/* Header Banner */}
      <div className={`rounded-3xl p-5 sm:p-6 border transition-all ${
        isLight
          ? 'bg-white border-slate-300 shadow-md text-slate-800'
          : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 border-b ${
          isLight ? 'border-slate-200' : 'border-white/10'
        }`}>
          <div>
            <h2 className={`text-base sm:text-lg font-extrabold flex items-center gap-2 ${
              isLight ? 'text-slate-950' : 'text-white'
            }`}>
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Gestione Controllo Accessi &amp; PIN Sicurezza (Database)
            </h2>
            <p className={`text-xs mt-1 ${
              isLight ? 'text-slate-700 font-medium' : 'text-slate-400'
            }`}>
              Definisci i codici autorizzati memorizzati nel DB per comandare serrature, relè o cancelli tramite il modulo GB-CLOUD.
            </p>
          </div>

          {/* Virtual Relay Status Indicator */}
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
              isDoorUnlocked
                ? isLight
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-800 shadow-sm'
                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.3)]'
                : isLight
                  ? 'bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-black/30 border-white/10 text-slate-400'
            }`}
          >
            {isDoorUnlocked ? <Unlock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Lock className="w-4 h-4 text-slate-500" />}
            <span>Relè Serratura: {isDoorUnlocked ? 'APERTO (3s)' : 'BLOCCATO'}</span>
          </div>
        </div>

        {/* Add PIN Form & Quick Test */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-5">
          {/* Add PIN */}
          <form
            onSubmit={handleAddPin}
            className={`md:col-span-7 rounded-2xl p-4 sm:p-5 space-y-3.5 border ${
              isLight
                ? 'bg-slate-50/90 border-slate-300 shadow-sm'
                : 'bg-white/[0.03] border-white/10 shadow-lg backdrop-blur-md'
            }`}
          >
            <div className={`text-xs font-bold flex items-center gap-1.5 border-b pb-2.5 ${
              isLight ? 'text-slate-900 border-slate-300' : 'text-slate-200 border-white/10'
            }`}>
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Registra Nuovo PIN nel Database
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className={`block font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  Codice PIN:
                </label>
                <input
                  type="text"
                  placeholder="Es. 1234"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 font-mono text-xs font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                      : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  Nome Utente:
                </label>
                <input
                  type="text"
                  placeholder="Es. Mario Rossi"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-500'
                      : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                  }`}
                  required
                />
              </div>

              <div>
                <label className={`block font-bold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  Ruolo:
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      : 'bg-black/30 border-white/15 text-slate-200 focus:border-blue-400'
                  }`}
                >
                  <option value="Admin" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Admin</option>
                  <option value="Operatore" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Operatore</option>
                  <option value="Ospite" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Ospite</option>
                  <option value="Sicurezza" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>Sicurezza</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className={`w-full font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-blue-600/80 hover:bg-blue-600 border border-blue-400/30 text-white'
              }`}
            >
              <Plus className="w-4 h-4" /> Salva PIN nel Database
            </button>
          </form>

          {/* Quick Test Console */}
          <div
            className={`md:col-span-5 rounded-2xl p-4 sm:p-5 space-y-3.5 border ${
              isLight
                ? 'bg-slate-50/90 border-slate-300 shadow-sm'
                : 'bg-white/[0.03] border-white/10 shadow-lg backdrop-blur-md'
            }`}
          >
            <div className={`text-xs font-bold flex items-center gap-1.5 border-b pb-2.5 ${
              isLight ? 'text-slate-900 border-slate-200' : 'text-slate-200 border-white/10'
            }`}>
              <Key className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Test Diretto Verifica PIN
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Digita PIN da testare..."
                value={testPinInput}
                onChange={(e) => setTestPinInput(e.target.value)}
                className={`flex-1 rounded-xl px-3 py-2 text-xs font-mono font-bold border transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500'
                    : 'bg-black/30 border-white/15 text-white focus:border-emerald-400'
                }`}
              />
              <button
                type="button"
                onClick={handleTestPin}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  isLight
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-400/30 text-white'
                }`}
              >
                Verifica
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                  testResult.granted
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                    : isLight
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.granted ? (
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Registered PINs and Access Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        {/* PIN Table */}
        <div className={`lg:col-span-6 rounded-3xl p-5 sm:p-6 border transition-all ${
          isLight
            ? 'bg-white border-slate-300 shadow-md text-slate-800'
            : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
        }`}>
          <div className={`flex items-center justify-between pb-3.5 border-b mb-3.5 ${
            isLight ? 'border-slate-300' : 'border-white/10'
          }`}>
            <span className={`font-extrabold text-sm sm:text-base flex items-center gap-2 ${
              isLight ? 'text-slate-950' : 'text-white'
            }`}>
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> PIN Autorizzati ({pins.length})
            </span>
            <button
              onClick={fetchPinsAndLogs}
              title="Ricarica elenco PIN"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'text-slate-700 hover:text-slate-950 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className={`divide-y max-h-[360px] overflow-y-auto ${
            isLight ? 'divide-slate-200' : 'divide-white/5'
          }`}>
            {pins.length === 0 ? (
              <div className={`text-center py-8 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                Nessun PIN memorizzato nel database
              </div>
            ) : (
              pins.map((pin) => (
                <div key={pin.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-mono font-bold text-sm px-2.5 py-0.5 rounded-lg border ${
                        isLight
                          ? 'text-blue-900 bg-blue-100/80 border-blue-300'
                          : 'text-blue-300 bg-blue-500/20 border-blue-500/30'
                      }`}>
                        {pin.code}
                      </span>
                      <span className={`font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
                        {pin.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-white/5 text-slate-300 border-white/10'
                      }`}>
                        {pin.role}
                      </span>
                    </div>
                    <div className={`text-[11px] mt-1 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      Creato: {new Date(pin.createdAt).toLocaleDateString('it-IT')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTogglePin(pin.id)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                        pin.enabled
                          ? isLight
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-400 hover:bg-emerald-200'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : isLight
                            ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {pin.enabled ? 'Attivo' : 'Disabilitato'}
                    </button>

                    <button
                      onClick={() => handleDeletePin(pin.id)}
                      title="Elimina PIN"
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        isLight
                          ? 'text-rose-700 hover:text-rose-900 hover:bg-rose-50'
                          : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Access Logs History */}
        <div className={`lg:col-span-6 rounded-3xl p-5 sm:p-6 border transition-all ${
          isLight
            ? 'bg-white border-slate-300 shadow-md text-slate-800'
            : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
        }`}>
          <div className={`flex items-center justify-between pb-3.5 border-b mb-3.5 ${
            isLight ? 'border-slate-300' : 'border-white/10'
          }`}>
            <span className={`font-extrabold text-sm sm:text-base flex items-center gap-2 ${
              isLight ? 'text-slate-950' : 'text-white'
            }`}>
              <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" /> Storico Tentativi Accesso ({accessLogs.length})
            </span>
          </div>

          <div className={`divide-y max-h-[360px] overflow-y-auto ${
            isLight ? 'divide-slate-200' : 'divide-white/5'
          }`}>
            {accessLogs.length === 0 ? (
              <div className={`text-center py-8 font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                Nessun tentativo di accesso registrato
              </div>
            ) : (
              accessLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {log.status === 'GRANTED' ? (
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                        isLight
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      }`}>
                        <CheckCircle className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${
                        isLight
                          ? 'bg-rose-100 text-rose-900 border-rose-400'
                          : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      }`}>
                        <XCircle className="w-4 h-4" />
                      </span>
                    )}
                    <div>
                      <div className={`font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
                        {log.status === 'GRANTED'
                          ? `Accesso Concesso: ${log.userName || 'Autorizzato'}`
                          : `Accesso Negato (PIN: ${log.enteredPin})`}
                      </div>
                      <div className={`text-[11px] font-mono font-medium mt-0.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        {new Date(log.timestamp).toLocaleString('it-IT')} &bull; Dispositivo: {log.deviceId}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[11px] px-2.5 py-1 rounded-lg font-bold border shrink-0 ${
                      log.status === 'GRANTED'
                        ? isLight
                          ? 'text-emerald-900 bg-emerald-100 border-emerald-300'
                          : 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                        : isLight
                          ? 'text-rose-900 bg-rose-100 border-rose-300'
                          : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
