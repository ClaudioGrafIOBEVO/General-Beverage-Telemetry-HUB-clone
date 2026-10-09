import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { VendingMachine, Esp32Device } from '../types';
import {
  Radio,
  UploadCloud,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Layers,
  Terminal,
  ArrowRight,
  Clock,
  Trash2,
  Download,
  RefreshCw,
  Play,
  HardDrive,
  Wifi,
  Sparkles,
  HelpCircle,
  Check,
  X,
} from 'lucide-react';

interface OtaRelease {
  id: string;
  filename: string;
  version: string;
  description: string;
  sizeBytes: number;
  uploadedAt: string;
  targetBoard: string;
  deploymentsCount: number;
  lastDeployedAt?: string;
}

interface OtaFirmwareViewProps {
  initialMachineId?: string;
}

export const OtaFirmwareView: React.FC<OtaFirmwareViewProps> = ({ initialMachineId }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Data states
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [releases, setReleases] = useState<OtaRelease[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>(initialMachineId || '');
  const [filterOnlineOnly, setFilterOnlineOnly] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [versionTag, setVersionTag] = useState<string>('v2.6.4-STOP-FIX');
  const [releaseNotes, setReleaseNotes] = useState<string>('Fix ritardo tasto STOP (priorità zero e impulso rapido 300ms)');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  // Deploy execution state
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployStep, setDeployStep] = useState<'idle' | 'uploading' | 'dispatching' | 'waiting' | 'in_progress' | 'completed' | 'error'>('idle');
  const [activeDeploymentTarget, setActiveDeploymentTarget] = useState<string>('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ id: string; time: string; text: string; type: 'info' | 'success' | 'warn' | 'error' }>>([]);
  const [notification, setNotification] = useState<{ message: string; success: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);

  const addLog = (text: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setConsoleLogs((prev) => [{ id: Math.random().toString(36).substring(2, 9), time, text, type }, ...prev].slice(0, 50));
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [machRes, devRes, relRes] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/devices'),
        fetch('/api/ota/releases'),
      ]);

      if (machRes.ok) {
        const m = await machRes.json();
        setMachines(m.machines || m || []);
      }
      if (devRes.ok) {
        const d = await devRes.json();
        setDevices(d.devices || d || []);
      }
      if (relRes.ok) {
        const r = await relRes.json();
        setReleases(r.releases || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialMachineId) {
      setSelectedTarget(initialMachineId);
    } else if (machines.length > 0 && !selectedTarget) {
      const firstOnline = machines.find((m) => m.status === 'ONLINE') || machines[0];
      setSelectedTarget(firstOnline.id);
    }
  }, [initialMachineId, machines]);

  // Listen for Live OTA Events from MQTT via SSE
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream');
      es.addEventListener('ota-event', (e) => {
        try {
          const data = JSON.parse(e.data);
          const devId = data.deviceId || data.macAddress || '';
          const action = data.action || data.status || '';

          if (action === 'OTA_STARTING') {
            setDeployStep('in_progress');
            addLog(`[ESP32 ${devId}] Connessione HTTP al Cloud stabilita. Download binario e scrittura Flash avviati!`, 'info');
          } else if (action === 'OTA_PROGRESS' || action.includes('PROGRESS')) {
            const p = data.progress || 50;
            setUploadProgress(p);
            addLog(`[ESP32 ${devId}] Avanzamento Flash: ${p}%`, 'info');
          } else if (action === 'OTA_COMPLETED' || data.status === 'STOPPED' || action === 'COMMAND_ACK') {
            setDeployStep('completed');
            setUploadProgress(100);
            addLog(`[ESP32 ${devId}] Flash completato con successo! Riavvio in corso con nuovo firmware...`, 'success');
          } else if (action === 'OTA_ERROR') {
            setDeployStep('error');
            addLog(`[ESP32 ${devId}] Errore durante l'aggiornamento: ${data.error || 'Download fallito'}`, 'error');
          }
        } catch {
          // ignore
        }
      });

      es.addEventListener('ota-deployed', (e) => {
        try {
          const data = JSON.parse(e.data);
          addLog(`[SERVER CLOUD] Comando OTA_UPDATE inviato via MQTT al broker per target: ${data.deviceName || data.targetDeviceId}`, 'success');
          setDeployStep('waiting');
        } catch {
          // ignore
        }
      });

      es.addEventListener('ota-release-added', () => {
        loadData();
      });
      es.addEventListener('devices-updated', () => {
        loadData();
      });
    } catch {
      // ignore
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  // Filter available targets
  const availableTargets = machines.filter((m) => {
    if (!filterOnlineOnly) return true;
    return m.status === 'ONLINE' || m.status === 'DISPENSING';
  });

  const selectedMachineObj = machines.find((m) => m.id === selectedTarget) || null;

  // File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.bin')) {
        setNotification({ success: false, message: 'Attenzione: seleziona un file compilato con estensione .bin' });
        return;
      }
      setSelectedFile(file);
      addLog(`File '${file.name}' (${(file.size / 1024).toFixed(1)} KB) selezionato e pronto per il caricamento`, 'info');
    }
  };

  // Convert file to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const res = reader.result as string;
        resolve(res);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Upload and Deploy workflow
  const handleUploadAndDeploy = async () => {
    if (!selectedFile) {
      setNotification({ success: false, message: 'Seleziona prima il file .bin compilato dall\'Arduino IDE' });
      return;
    }
    if (!selectedTarget) {
      setNotification({ success: false, message: 'Seleziona il distributore o modulo ESP32 target' });
      return;
    }

    setIsUploading(true);
    setIsDeploying(true);
    setDeployStep('uploading');
    setUploadProgress(15);
    setActiveDeploymentTarget(selectedMachineObj?.name || selectedTarget);

    addLog(`[PASSAGGIO 1] Caricamento del binario '${selectedFile.name}' sul Cloud Portal...`, 'info');

    try {
      const base64Data = await fileToBase64(selectedFile);
      setUploadProgress(40);

      const uploadRes = await fetch('/api/ota/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          version: versionTag,
          description: releaseNotes,
          base64Data,
          targetBoard: 'ESP32 (Standard 38-Pin / NodeMCU)',
        }),
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Errore durante il caricamento del file');
      }

      setUploadProgress(65);
      setDeployStep('dispatching');
      addLog(`[PASSAGGIO 2] Firmware salvato con ID ${uploadData.release.id}. URL binario HTTP generato.`, 'success');

      // Now trigger deployment via MQTT
      addLog(`[PASSAGGIO 3] Trasmissione comando MQTT 'OTA_UPDATE' verso ${selectedMachineObj?.name || selectedTarget}...`, 'info');

      const deployRes = await fetch('/api/ota/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: uploadData.release.id,
          targetDeviceId: selectedTarget,
        }),
      });

      const deployData = await deployRes.json();
      if (!deployRes.ok || !deployData.success) {
        throw new Error(deployData.error || 'Errore durante l\'invio del comando MQTT');
      }

      setUploadProgress(85);
      setDeployStep('waiting');
      addLog(`[PASSAGGIO 4] Pacchetto inviato! L'ESP32 sta effettuando il download da: ${deployData.downloadUrl}`, 'info');
      setNotification({ success: true, message: `Aggiornamento OTA avviato su ${selectedMachineObj?.name || selectedTarget}!` });
      loadData();
    } catch (err: any) {
      setDeployStep('error');
      addLog(`ERRORE: ${err.message}`, 'error');
      setNotification({ success: false, message: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  // Quick Flash an existing release from history
  const handleDeployExisting = async (release: OtaRelease) => {
    if (!selectedTarget) {
      setNotification({ success: false, message: 'Seleziona prima una macchina target nel menu' });
      return;
    }

    setIsDeploying(true);
    setDeployStep('dispatching');
    setActiveDeploymentTarget(selectedMachineObj?.name || selectedTarget);
    addLog(`Avvio re-flash release '${release.version}' (${release.filename}) verso ${selectedMachineObj?.name || selectedTarget}...`, 'info');

    try {
      const res = await fetch('/api/ota/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: release.id,
          targetDeviceId: selectedTarget,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore durante l\'invio del comando');
      }

      setDeployStep('waiting');
      addLog(`Comando inviato! Download del firmware in corso sull'ESP32 (${data.downloadUrl})`, 'success');
      setNotification({ success: true, message: `Re-flash avviato con successo su ${selectedMachineObj?.name || selectedTarget}` });
      loadData();
    } catch (err: any) {
      setDeployStep('error');
      addLog(`ERRORE: ${err.message}`, 'error');
      setNotification({ success: false, message: err.message });
    }
  };

  // Delete release
  const handleDeleteRelease = async (id: string, name: string) => {
    if (!confirm(`Sei sicuro di voler eliminare la release '${name}'?`)) return;
    try {
      const res = await fetch(`/api/ota/releases/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addLog(`Release '${name}' eliminata dal server`, 'info');
        loadData();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className={`rounded-3xl p-6 border transition-all ${
        isLight
          ? 'bg-gradient-to-r from-emerald-50 via-white to-indigo-50 border-emerald-200 shadow-md'
          : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-emerald-500/20 shadow-xl backdrop-blur-md'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-lg shrink-0 ${
              isLight
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            }`}>
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  Aggiornamento Firmware OTA Cloud
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  Over-The-Air HTTP + MQTT
                </span>
              </div>
              <p className={`text-xs sm:text-sm mt-1 max-w-3xl leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Compila il file binario <code className="px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">.bin</code> in locale su Arduino IDE e caricalo qui. Il portale invierà il comando MQTT all&apos;ESP32 ovunque si trovi (anche sotto router 4G) per scaricare e flashare il nuovo firmware senza aprire la macchina.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/api/ota/source-sketch"
              download="esp32_firmware.ino"
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-white/10'
              }`}
            >
              <Download className="w-4 h-4 text-emerald-500" />
              <span>Scarica Sketch C++ (.ino)</span>
            </a>
            <button
              onClick={loadData}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
              }`}
              title="Aggiorna stato macchine e firmware"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-200 ${
          notification.success
            ? isLight ? 'bg-emerald-50 text-emerald-950 border-emerald-300' : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40'
            : isLight ? 'bg-rose-50 text-rose-950 border-rose-300' : 'bg-rose-500/15 text-rose-200 border-rose-500/40'
        }`}>
          <div className="flex items-center gap-2.5">
            {notification.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-70 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP-BY-STEP COMPILATION GUIDE CARD */}
      <div className={`rounded-3xl p-5 border transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-white/10'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <h2 className={`text-xs sm:text-sm font-bold tracking-tight uppercase ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
            Come ottenere il file .bin in 3 passaggi su Arduino IDE
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">1</span>
              <span>Scarica o Apri lo Sketch</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Usa il pulsante <strong>&quot;Scarica Sketch C++ (.ino)&quot;</strong> qui sopra o copia il codice generato dal portale nella cartella del tuo Arduino IDE.
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">2</span>
              <span>Esporta Sketch Compilato</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Nel menu in alto di Arduino IDE clicca: <strong>Sketch &rarr; Esporta sketch compilato</strong> (oppure premi la scorciatoia <kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded">Ctrl + Alt + S</kbd>).
            </p>
          </div>

          <div className={`p-3.5 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'}`}>
            <div className="flex items-center gap-2 mb-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
              <span>Carica il .bin sul Portale</span>
            </div>
            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              Troverai il file <code className="font-mono font-bold text-emerald-600 dark:text-emerald-400">...ino.bin</code> nella cartella dello sketch: selezionalo nel box qui sotto e premi Avvia!
            </p>
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: DEPLOY FORM & LIVE CONSOLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUMN 1: UPLOAD & DEPLOY FORM (7 Cols) */}
        <div className={`lg:col-span-7 rounded-3xl p-6 border space-y-5 transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <UploadCloud className="w-5 h-5 text-emerald-500" />
              <h2 className={`font-bold text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                1. Configura &amp; Carica Firmware
              </h2>
            </div>
            <span className="text-[11px] font-mono text-emerald-500 font-semibold">
              Dimensione max: 8 MB
            </span>
          </div>

          {/* TARGET MACHINE SELECTOR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Seleziona Distributore / Modulo ESP32 Target
              </label>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={filterOnlineOnly}
                  onChange={(e) => setFilterOnlineOnly(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Solo Online ({machines.filter((m) => m.status === 'ONLINE').length})</span>
              </label>
            </div>

            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-all focus:outline-none cursor-pointer ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500 shadow-sm'
                  : 'bg-black/40 border-white/15 text-white focus:border-emerald-400'
              }`}
            >
              <option value="">-- Seleziona un distributore dalla flotta --</option>
              {availableTargets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.status === 'ONLINE' ? '🟢 ONLINE' : '⚪ OFFLINE'} • {m.name} [MAC: {m.assignedDeviceMac || m.macAddress || 'N/D'}]
                </option>
              ))}
            </select>

            {/* Selected Target Card Quick Details */}
            {selectedMachineObj && (
              <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs mt-2 ${
                isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold">{selectedMachineObj.name}</div>
                    <div className="text-[11px] opacity-80 font-mono">
                      MAC: {selectedMachineObj.assignedDeviceMac || 'N/D'} • IP: {selectedMachineObj.ipAddress || '192.168.1.xxx'}
                    </div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedMachineObj.status === 'ONLINE'
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-500/20 text-slate-500'
                }`}>
                  {selectedMachineObj.status}
                </span>
              </div>
            )}
          </div>

          {/* VERSION TAG & NOTES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Tag Versione Firmware
              </label>
              <input
                type="text"
                value={versionTag}
                onChange={(e) => setVersionTag(e.target.value)}
                placeholder="es. v2.6.4-STOP-FIX"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-mono font-semibold transition-all focus:outline-none ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-black/40 border-white/15 text-white focus:border-emerald-400'
                }`}
              />
            </div>
            <div className="space-y-1.5">
              <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                Note di Rilascio / Descrizione
              </label>
              <input
                type="text"
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                placeholder="es. Fix ritardo tasto STOP e matrice opto"
                className={`w-full px-3.5 py-2.5 rounded-2xl border text-xs sm:text-sm font-semibold transition-all focus:outline-none ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500' : 'bg-black/40 border-white/15 text-white focus:border-emerald-400'
                }`}
              />
            </div>
          </div>

          {/* DRAG & DROP ZONE FOR .BIN FILE */}
          <div className="space-y-1.5">
            <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              File Binario Compilato (.bin)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".bin,application/octet-stream"
              className="hidden"
            />

            <div
              ref={dropZoneRef}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  if (!file.name.toLowerCase().endsWith('.bin')) {
                    setNotification({ success: false, message: 'Attenzione: seleziona un file compilato con estensione .bin' });
                    return;
                  }
                  setSelectedFile(file);
                  addLog(`File '${file.name}' (${(file.size / 1024).toFixed(1)} KB) trascinato e pronto`, 'info');
                }
              }}
              className={`p-6 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-200 select-none ${
                selectedFile
                  ? isLight
                    ? 'border-emerald-400 bg-emerald-50/50 text-emerald-950'
                    : 'border-emerald-500/60 bg-emerald-950/20 text-emerald-200'
                  : isLight
                    ? 'border-slate-300 bg-slate-50/50 hover:bg-slate-100/70 hover:border-emerald-400 text-slate-600'
                    : 'border-white/15 bg-black/20 hover:bg-white/5 hover:border-emerald-500/50 text-slate-400'
              }`}
            >
              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <FileCode className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block">{selectedFile.name}</span>
                    <span className="text-xs opacity-75 font-mono">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Pronto per il caricamento
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                    Clicca per cambiare file
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-300'
                  }`}>
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <span className={`font-bold text-sm block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Trascina qui il file .bin oppure clicca per sfogliare
                    </span>
                    <span className="text-xs opacity-70">
                      File esportato da Arduino IDE (es. esp32_firmware.ino.esp32.bin)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ACTION BUTTON */}
          <button
            onClick={handleUploadAndDeploy}
            disabled={!selectedFile || !selectedTarget || isDeploying}
            className={`w-full py-4 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
              !selectedFile || !selectedTarget || isDeploying
                ? 'bg-slate-400 text-slate-200 cursor-not-allowed opacity-60 shadow-none'
                : 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-emerald-600/30 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {isDeploying ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Aggiornamento OTA in Corso...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>Avvia Aggiornamento OTA su {selectedMachineObj?.name || 'Target Selezionato'}</span>
              </>
            )}
          </button>
        </div>

        {/* COLUMN 2: REAL-TIME CONSOLE & MONITOR (5 Cols) */}
        <div className={`lg:col-span-5 rounded-3xl p-6 border space-y-4 flex flex-col transition-all ${
          isLight ? 'bg-slate-950 text-slate-100 border-slate-800 shadow-xl' : 'bg-black/80 text-slate-200 border-white/10 shadow-2xl'
        }`}>
          <div className="flex items-center justify-between border-b pb-3 border-white/10">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold text-sm text-white">Console Eventi OTA Real-Time</h2>
            </div>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              MQTT Live
            </span>
          </div>

          {/* Current Execution State Badge */}
          {deployStep !== 'idle' && (
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Target attivo:</span>
                <span className="font-bold text-emerald-300">{activeDeploymentTarget}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Stato:</span>
                <span className={`font-mono font-bold uppercase text-[11px] ${
                  deployStep === 'completed'
                    ? 'text-emerald-400'
                    : deployStep === 'error'
                      ? 'text-rose-400'
                      : 'text-amber-300 animate-pulse'
                }`}>
                  {deployStep === 'uploading' && 'Caricamento binario sul server...'}
                  {deployStep === 'dispatching' && 'Comando MQTT inviato...'}
                  {deployStep === 'waiting' && 'In attesa risposta ESP32...'}
                  {deployStep === 'in_progress' && 'Scrittura memoria Flash in corso...'}
                  {deployStep === 'completed' && 'Aggiornato con Successo!'}
                  {deployStep === 'error' && 'Errore Aggiornamento'}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    deployStep === 'completed' ? 'bg-emerald-500' : deployStep === 'error' ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${deployStep === 'completed' ? 100 : Math.max(10, uploadProgress)}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Terminal Logs List */}
          <div className="flex-1 min-h-[280px] max-h-[380px] overflow-y-auto space-y-1.5 font-mono text-[11px] p-3 rounded-2xl bg-black/60 border border-white/5">
            {consoleLogs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center">
                <Radio className="w-8 h-8 opacity-40 mb-2" />
                <span>Nessun evento OTA recente</span>
                <span className="text-[10px] opacity-60">I log del broker e dell&apos;ESP32 appariranno qui</span>
              </div>
            ) : (
              consoleLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 leading-tight">
                  <span className="text-slate-500 shrink-0">[{log.time}]</span>
                  <span className={`${
                    log.type === 'success'
                      ? 'text-emerald-400 font-semibold'
                      : log.type === 'error'
                        ? 'text-rose-400 font-semibold'
                        : log.type === 'warn'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                  }`}>
                    {log.text}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setConsoleLogs([])}
            className="text-[10px] text-slate-500 hover:text-slate-300 self-end transition-colors cursor-pointer"
          >
            Pulisci log console
          </button>
        </div>
      </div>

      {/* RELEASES HISTORY & ONE-CLICK RE-FLASH */}
      <div className={`rounded-3xl p-6 border space-y-4 transition-all ${
        isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-white/10'
      }`}>
        <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-emerald-500" />
            <h2 className={`font-bold text-sm sm:text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Storico Versioni Firmware Caricate ({releases.length})
            </h2>
          </div>
          <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Riflash immediato di qualsiasi release con 1 click
          </span>
        </div>

        {releases.length === 0 ? (
          <div className={`text-center py-8 text-xs rounded-2xl border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-black/20 border-white/5 text-slate-400'
          }`}>
            Nessun firmware binario caricato finora. Carica il tuo primo file .bin nel modulo sopra.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Versione</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Nome File .bin</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Dimensione</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Data Caricamento</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Descrizione</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px]">Deploy</th>
                  <th className="py-2.5 px-3 font-semibold uppercase text-[10px] text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {releases.map((rel) => (
                  <tr key={rel.id} className="hover:bg-emerald-500/5 transition-colors">
                    <td className="py-3 px-3 font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {rel.version}
                    </td>
                    <td className="py-3 px-3 font-mono font-medium">
                      {rel.filename}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {(rel.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {new Date(rel.uploadedAt).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className={`py-3 px-3 max-w-xs truncate ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {rel.description || 'Nessuna descrizione'}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                        {rel.deploymentsCount || 0} volte
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDeployExisting(rel)}
                          disabled={!selectedTarget || isDeploying}
                          className="px-2.5 py-1.5 rounded-xl font-bold text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1 shadow-sm cursor-pointer disabled:opacity-40"
                          title="Flasherà questa release sulla macchina selezionata"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Flash su Target</span>
                        </button>
                        <a
                          href={`/api/ota/download/${rel.id}.bin`}
                          download={rel.filename}
                          className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                            isLight ? 'hover:bg-slate-100 text-slate-700 border-slate-300' : 'hover:bg-white/10 text-slate-300 border-white/10'
                          }`}
                          title="Scarica file .bin"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => handleDeleteRelease(rel.id, rel.filename)}
                          className={`p-1.5 rounded-xl border transition-colors cursor-pointer text-rose-500 hover:bg-rose-500/10 ${
                            isLight ? 'border-rose-200' : 'border-rose-500/30'
                          }`}
                          title="Elimina release"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
