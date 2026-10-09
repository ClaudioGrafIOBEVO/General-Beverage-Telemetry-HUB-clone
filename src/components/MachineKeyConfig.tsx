import React, { useState, useEffect } from 'react';
import { VendingMachine } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  MATRIX_KEYS,
  MATRIX_PRODUCT_ROWS,
  MATRIX_FUNCTION_ROW,
  normalizeMatrixKey,
  resolveKeyDetails,
  MatrixKeyDefinition,
} from '../utils/keypadMapping';
import {
  Server,
  Coffee,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Sliders,
  MapPin,
  Flame,
  CupSoda,
  Droplets,
  Zap,
  Cable,
  Play,
  Copy,
  Download,
  Search,
  Check,
  Tag,
  Euro,
  Monitor,
  ArrowRight,
  RotateCcw,
  Scale,
  ToggleLeft,
  ToggleRight,
  Activity,
  Hash,
  Info,
} from 'lucide-react';

interface MachineKeyConfigProps {
  initialMachineId?: string;
  onMachineChanged?: (machineId: string) => void;
}

// Preset library of beverage recipes for quick assignment
export const PRESET_BEVERAGES = [
  { name: 'Caffè Espresso', code: 'P01', icon: Coffee, desc: 'Espresso corto italiano', category: 'Caffè', price: 0.0, color: 'amber' },
  { name: 'Caffè Lungo', code: 'P02', icon: Coffee, desc: 'Caffè lungo equilibrato', category: 'Caffè', price: 0.0, color: 'amber' },
  { name: 'Caffè Macchiato', code: 'P03', icon: Coffee, desc: 'Espresso con goccia di latte', category: 'Latte', price: 0.0, color: 'amber' },
  { name: 'Cappuccino Schiumato', code: 'P04', icon: CupSoda, desc: 'Caffè e latte cremoso', category: 'Latte', price: 0.0, color: 'emerald' },
  { name: 'Mocaccino / Cioccolato', code: 'P05', icon: Flame, desc: 'Caffè, latte e cioccolato', category: 'Cioccolato', price: 0.0, color: 'orange' },
  { name: 'Latte Caldo Macchiato', code: 'P06', icon: Coffee, desc: 'Latte caldo vellutato', category: 'Latte', price: 0.0, color: 'amber' },
  { name: 'Cioccolata Calda Densa', code: 'P07', icon: Sparkles, desc: 'Cioccolato intenso', category: 'Cioccolato', price: 0.0, color: 'emerald' },
  { name: 'Tè Caldo al Limone', code: 'P08', icon: Droplets, desc: 'Infuso aromatico al limone', category: 'Tè & Infusi', price: 0.0, color: 'cyan' },
  { name: 'Caffè Americano XL', code: 'P09', icon: Zap, desc: 'Tazza grande 180ml', category: 'Caffè', price: 0.0, color: 'yellow' },
  { name: 'Ginseng Cremoso', code: 'P10', icon: Coffee, desc: 'Estratto di radice di ginseng', category: 'Speciale', price: 0.0, color: 'amber' },
  { name: 'Orzo Naturale Tostato', code: 'P11', icon: Coffee, desc: 'Infuso d\'orzo 100% naturale', category: 'Speciale', price: 0.0, color: 'amber' },
  { name: 'Acqua Calda / Tisana', code: 'P12', icon: Droplets, desc: 'Solo acqua a 93°C per filtri', category: 'Tè & Infusi', price: 0.0, color: 'cyan' },
  { name: 'Espresso Decaffeinato', code: 'P13', icon: Coffee, desc: 'Miscela senza caffeina', category: 'Caffè', price: 0.0, color: 'amber' },
  { name: 'Cappuccino Decaffeinato', code: 'P14', icon: CupSoda, desc: 'Cappuccino senza caffeina', category: 'Latte', price: 0.0, color: 'emerald' },
  { name: 'Tè Verde Bio', code: 'P15', icon: Droplets, desc: 'Infuso foglie tè verde', category: 'Tè & Infusi', price: 0.0, color: 'emerald' },
  { name: 'Tisana ai Frutti di Bosco', code: 'P16', icon: Sparkles, desc: 'Infuso fruttato rilassante', category: 'Tè & Infusi', price: 0.0, color: 'rose' },
  { name: 'Latte Caldo Semplice', code: 'P17', icon: Coffee, desc: 'Puro latte intero vaporizzato', category: 'Latte', price: 0.0, color: 'amber' },
  { name: 'Ginseng Amaro', code: 'P18', icon: Coffee, desc: 'Ginseng senza zuccheri aggiunti', category: 'Speciale', price: 0.0, color: 'amber' },
];

export const MachineKeyConfig: React.FC<MachineKeyConfigProps> = ({
  initialMachineId,
  onMachineChanged,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>(initialMachineId || '');
  const [keyMapping, setKeyMapping] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  const [copySourceMachineId, setCopySourceMachineId] = useState<string>('');
  const [enableCalAndConsumption, setEnableCalAndConsumption] = useState<boolean>(false);
  const [isTogglingMode, setIsTogglingMode] = useState<boolean>(false);

  // 12 product keys definitions (P1..P12)
  const productKeysList = MATRIX_KEYS.filter((k) => k.isProduct);

  // Fetch machines list
  const fetchMachines = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/machines');
      if (res.ok) {
        const data: VendingMachine[] = await res.json();
        setMachines(data);
        if (data.length > 0) {
          const current = data.find((m) => m.id === selectedMachineId) || data[0];
          setSelectedMachineId(current.id);
          initMappingForMachine(current);
        }
      }
    } catch {
      setStatusMessage({ text: 'Errore nel caricamento delle macchine', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const initMappingForMachine = (machine: VendingMachine) => {
    const existing = machine.keyMapping || {};
    const initialMap: Record<string, string> = {};
    productKeysList.forEach((k) => {
      const resolved = resolveKeyDetails(k.key, machine);
      initialMap[k.key] = existing[k.key] || resolved.associatedProduct || k.defaultProduct;
    });
    setKeyMapping(initialMap);
    setEnableCalAndConsumption(
      machine.enableCalibrationAndConsumption !== undefined
        ? Boolean(machine.enableCalibrationAndConsumption)
        : Boolean(machine.config?.enableCalibrationAndConsumption)
    );
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    if (initialMachineId) {
      setSelectedMachineId(initialMachineId);
      const m = machines.find((mach) => mach.id === initialMachineId);
      if (m) initMappingForMachine(m);
    }
  }, [initialMachineId, machines]);

  const handleMachineSelect = (mId: string) => {
    setSelectedMachineId(mId);
    onMachineChanged?.(mId);
    const m = machines.find((mach) => mach.id === mId);
    if (m) initMappingForMachine(m);
    setStatusMessage(null);
  };

  const handleKeyAssignmentChange = (key: string, productName: string) => {
    const canonicalKey = normalizeMatrixKey(key);
    setKeyMapping((prev) => ({
      ...prev,
      [canonicalKey]: productName,
    }));
  };

  const handleToggleCalibrationMode = async (forceValue?: boolean) => {
    if (!selectedMachineId) return;
    const targetVal = forceValue !== undefined ? forceValue : !enableCalAndConsumption;
    setIsTogglingMode(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/machines/${selectedMachineId}/calibration-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetVal }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnableCalAndConsumption(targetVal);
        setMachines((prev) =>
          prev.map((m) =>
            m.id === selectedMachineId
              ? {
                  ...m,
                  enableCalibrationAndConsumption: targetVal,
                  config: { ...m.config, enableCalibrationAndConsumption: targetVal },
                }
              : m
          )
        );
        setStatusMessage({
          text: data.message || `Gestione Taratura e Consumi ${targetVal ? 'ABILITATA' : 'DISABILITATA'} per ${currentMachine?.name || selectedMachineId}`,
          type: 'success',
        });
      } else {
        setStatusMessage({ text: data.error || 'Errore durante aggiornamento modalità macchina', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Errore di connessione al server', type: 'error' });
    } finally {
      setIsTogglingMode(false);
    }
  };

  const handleSaveMapping = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/machines/${selectedMachineId}/keymap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyMapping,
          enableCalibrationAndConsumption: enableCalAndConsumption,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStatusMessage({
          text: data.message || `Configurazione salvata con successo per ${currentMachine?.name || selectedMachineId}!`,
          type: 'success',
        });
        // Update local machines state
        setMachines((prev) =>
          prev.map((m) =>
            m.id === selectedMachineId
              ? {
                  ...m,
                  keyMapping,
                  enableCalibrationAndConsumption: enableCalAndConsumption,
                  config: { ...m.config, enableCalibrationAndConsumption: enableCalAndConsumption },
                }
              : m
          )
        );
      } else {
        const err = await res.json();
        setStatusMessage({ text: err.error || 'Errore durante il salvataggio della configurazione', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Errore di connessione al server', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (!window.confirm('Vuoi ripristinare i nomi dei 12 prodotti ai valori predefiniti di fabbrica?')) {
      return;
    }
    const defaultMap: Record<string, string> = {};
    productKeysList.forEach((k) => {
      defaultMap[k.key] = k.defaultProduct;
    });
    setKeyMapping(defaultMap);
    setStatusMessage({
      text: 'Nomi dei prodotti ripristinati ai valori standard di fabbrica. Clicca "Salva Configurazione Prodotti" per confermare sul distributore.',
      type: 'success',
    });
  };

  const handleCopyFromMachine = async () => {
    if (!copySourceMachineId) return;
    try {
      const res = await fetch(`/api/machines/${selectedMachineId}/copy-keymap-from/${copySourceMachineId}`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        const sourceM = machines.find((m) => m.id === copySourceMachineId);
        if (sourceM) {
          const newMap: Record<string, string> = { ...(sourceM.keyMapping || {}) };
          productKeysList.forEach((k) => {
            if (!newMap[k.key]) newMap[k.key] = k.defaultProduct;
          });
          setKeyMapping(newMap);
        }
        setStatusMessage({
          text: data.message || `Configurazione copiata da ${sourceM?.name || copySourceMachineId}!`,
          type: 'success',
        });
      } else {
        const err = await res.json();
        setStatusMessage({ text: err.error || 'Errore nella copia dei prodotti', type: 'error' });
      }
    } catch {
      setStatusMessage({ text: 'Errore di connessione', type: 'error' });
    }
  };

  // Test dispense single product directly
  const handleTestDispense = async (canonicalKey: string, productName: string) => {
    setTestingKey(canonicalKey);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: canonicalKey,
          deviceId: selectedMachineId,
          isCaraffa: false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          text: `[TEST EROGATO] Tasto ${canonicalKey}: "${productName}" erogato con successo sul distributore '${currentMachine?.name || selectedMachineId}'!`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: `Errore test erogazione: ${data.error || 'Impossibile erogare'}`,
          type: 'error',
        });
      }
    } catch {
      setStatusMessage({ text: 'Errore di connessione durante il test di erogazione', type: 'error' });
    } finally {
      setTestingKey(null);
    }
  };

  const currentMachine = machines.find((m) => m.id === selectedMachineId);

  // Filtered keys
  const filteredKeys = productKeysList.filter((k) => {
    const val = keyMapping[k.key] || k.defaultProduct;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      k.key.toLowerCase().includes(term) ||
      val.toLowerCase().includes(term) ||
      k.wirePins.toLowerCase().includes(term) ||
      String(k.productNum).includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER & CONTROLS */}
      <div className={`border rounded-3xl p-5 sm:p-6 shadow-md space-y-4 ${
        isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/10 shadow-xl backdrop-blur-xl'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-sm ${
              isLight ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-amber-500/20 border-amber-400/30 text-amber-400 shadow-amber-500/20'
            }`}>
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  Configurazione Prodotti Distributore &amp; Assegnazione Nomi
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${
                  isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                }`}>
                  12 Selezioni P1 - P12
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                Assegna o modifica il nome di ciascuna bevanda erogata dal distributore. I nomi configurati appariranno sul display LCD, nei log di telemetria e nei report di consumo.
              </p>
            </div>
          </div>

          {/* Machine selector dropdown */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className={`flex items-center gap-2 border rounded-2xl px-3 py-2 text-xs shadow-sm ${
              isLight ? 'bg-slate-50 border-slate-300' : 'bg-black/40 border-white/15'
            }`}>
              <Server className={`w-4 h-4 shrink-0 ${isLight ? 'text-blue-700' : 'text-blue-400'}`} />
              <label className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Distributore:</label>
              <select
                id="select-machine-product-config"
                value={selectedMachineId}
                onChange={(e) => handleMachineSelect(e.target.value)}
                className={`bg-transparent font-bold focus:outline-none cursor-pointer ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                    {m.name} ({m.serialNumber || m.id})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchMachines}
              className={`p-2.5 rounded-2xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-300 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'
              }`}
              title="Ricarica elenco distributori"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Selected Machine Details Bar */}
        {currentMachine && (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border rounded-2xl p-3.5 text-xs shadow-sm ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/10'
          }`}>
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-600' : 'text-rose-400'}`} />
              <div className="truncate">
                <span className={`block text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ubicazione Impianto:</span>
                <span className={`font-bold truncate ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{currentMachine.location}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Cpu className={`w-4 h-4 shrink-0 ${isLight ? 'text-blue-700' : 'text-blue-400'}`} />
              <div className="truncate">
                <span className={`block text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Modulo IoT Telemetria:</span>
                <span className={`font-mono font-bold truncate ${isLight ? 'text-blue-900' : 'text-blue-300'}`}>
                  {currentMachine.assignedDeviceMac ? `MAC: ${currentMachine.assignedDeviceMac}` : 'Nessun modulo associato'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Layers className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <div className="truncate">
                <span className={`block text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Modello Erogatore:</span>
                <span className={`font-bold truncate ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>{currentMachine.model}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Cable className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <div>
                <span className={`block text-[10px] font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Interfaccia Elettronica:</span>
                <span className={`font-mono font-bold ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>Matrice 4x4 Optoisolata (8 Fili)</span>
              </div>
            </div>
          </div>
        )}

        {/* FLAG PROGRAMMAZIONE: GESTIONE TARATURA E CONSUMI SULLA SINGOLA MACCHINA */}
        {currentMachine && (
          <div
            id="machine-calibration-consumption-flag-panel"
            className={`border rounded-2xl p-4 transition-all ${
              enableCalAndConsumption
                ? isLight
                  ? 'bg-emerald-50/80 border-emerald-300 shadow-sm'
                  : 'bg-emerald-950/30 border-emerald-500/40'
                : isLight
                  ? 'bg-slate-50 border-slate-300 shadow-sm'
                  : 'bg-slate-900/40 border-slate-700/60'
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${
                    enableCalAndConsumption
                      ? isLight ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-black'
                      : isLight ? 'bg-slate-700 text-white' : 'bg-slate-700 text-slate-200'
                  }`}>
                    <Scale className="w-4 h-4" />
                  </div>
                  <h3 className={`text-sm font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Gestione Taratura e Consumi su {currentMachine.name} (Matr. {currentMachine.serialNumber})
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      enableCalAndConsumption
                        ? isLight
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isLight
                          ? 'bg-blue-100 text-blue-900 border border-blue-300'
                          : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {enableCalAndConsumption ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        Taratura & Consumi Abilitati
                      </>
                    ) : (
                      <>
                        <Activity className="w-3 h-3" />
                        Sola Rilevazione Battute
                      </>
                    )}
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  {enableCalAndConsumption
                    ? 'La macchina calcola i grammi per erogazione, i tempi delle coclee e controlla lo scarico scorte e livelli per i 6 contenitori.'
                    : 'La telemetria funziona regolarmente sulle battute (conteggio erogazioni, matrice tasti, totalizzatori e allarmi) senza richiedere taratura o calcolo grammature.'}
                </p>
              </div>

              {/* Toggle Switch Button */}
              <div className="flex items-center gap-3 shrink-0 self-start lg:self-center">
                <button
                  type="button"
                  id="toggle-calibration-mode-btn"
                  onClick={() => handleToggleCalibrationMode()}
                  disabled={isTogglingMode}
                  className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50 ${
                    enableCalAndConsumption
                      ? isLight
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
                      : isLight
                        ? 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isTogglingMode ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : enableCalAndConsumption ? (
                    <ToggleRight className="w-5 h-5 text-white drop-shadow" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 opacity-60" />
                  )}
                  <span>
                    {enableCalAndConsumption ? 'Disabilita Taratura (Torna a Sola Battuta)' : 'Abilita Gestione Taratura e Consumi'}
                  </span>
                </button>
              </div>
            </div>

            {/* Explanatory cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10 text-[11px]">
              <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                !enableCalAndConsumption
                  ? isLight ? 'bg-blue-50/90 border-blue-300 text-blue-950 font-medium' : 'bg-blue-950/30 border-blue-500/40 text-blue-200'
                  : isLight ? 'bg-white/60 border-slate-200 text-slate-600' : 'bg-black/20 border-white/5 text-slate-400'
              }`}>
                <Hash className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="font-bold block">Telemetria Battute (Sempre Attiva e Garantita)</span>
                  Ogni pressione tasto viene registrata istantaneamente: conteggio battute, totali per bevanda, orario, seriale e report statistici senza blocchi.
                </div>
              </div>

              <div className={`p-2.5 rounded-xl border flex items-start gap-2 ${
                enableCalAndConsumption
                  ? isLight ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-medium' : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                  : isLight ? 'bg-white/60 border-slate-200 text-slate-600' : 'bg-black/20 border-white/5 text-slate-400'
              }`}>
                <Scale className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <span className="font-bold block">Modulo Taratura & Consumi (Grammi e Stock)</span>
                  Attiva la scheda di pesatura grammi/secondo per le 6 coclee, calcola il consumo polveri a ogni erogazione e sincronizza i livelli dei contenitori.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center justify-between border backdrop-blur-md transition-all ${
              statusMessage.type === 'success'
                ? isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : isLight
                  ? 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              ) : (
                <AlertCircle className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 font-bold ml-2 cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}
      </div>

      {/* QUICK UTILITIES & SAVE BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search filter */}
        <div className="relative flex-1 max-w-sm">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
          <input
            type="text"
            placeholder="Cerca prodotto per nome o codice tasto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border focus:outline-none ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                : 'bg-white/5 border-white/10 text-white focus:border-blue-400'
            }`}
          />
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy from other machine dropdown */}
          {machines.length > 1 && (
            <div className="flex items-center gap-1.5">
              <select
                value={copySourceMachineId}
                onChange={(e) => setCopySourceMachineId(e.target.value)}
                className={`text-xs border rounded-xl px-2.5 py-2 font-medium focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                    : 'bg-slate-900 border-white/15 text-slate-300'
                }`}
              >
                <option value="">Copia da altro distributore...</option>
                {machines
                  .filter((m) => m.id !== selectedMachineId)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleCopyFromMachine}
                disabled={!copySourceMachineId}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1 cursor-pointer transition-all ${
                  !copySourceMachineId
                    ? 'opacity-40 cursor-not-allowed border-transparent'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                }`}
                title="Clona i nomi dei prodotti da un altro distributore"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copia</span>
              </button>
            </div>
          )}

          {/* Reset button */}
          <button
            type="button"
            onClick={handleResetToDefault}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Ripristina i 12 prodotti ai valori predefiniti della tabella standard"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Predefiniti</span>
          </button>

          {/* Export JSON modal toggle */}
          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
            }`}
            title="Visualizza / Esporta configurazione in formato JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">JSON</span>
          </button>

          {/* Main Save Button */}
          <button
            type="button"
            id="btn-save-products-config"
            onClick={handleSaveMapping}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-600/30 border border-amber-500/50 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Salvataggio...' : 'Salva Configurazione Prodotti'}</span>
          </button>
        </div>
      </div>

      {/* 12 PRODUCT CARDS GRID (P1 to P12) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Elenco Selezioni Erogabili (Slot 1 - 12)
            </h3>
          </div>
          <span className={`text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Mostrati {filteredKeys.length} di 12 prodotti
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredKeys.map((k) => {
            const currentVal = keyMapping[k.key] || k.defaultProduct;
            const matchedPreset = PRESET_BEVERAGES.find((p) => p.name.toLowerCase() === currentVal.toLowerCase());
            const IconComponent = matchedPreset?.icon || k.icon;
            const isTestingThis = testingKey === k.key;

            return (
              <div
                key={k.key}
                id={`card-product-slot-${k.key}`}
                className={`border rounded-2xl p-4 transition-all duration-200 shadow-md space-y-3 relative group ${
                  isLight
                    ? 'bg-white border-slate-300 hover:border-amber-500 hover:shadow-lg'
                    : 'bg-white/5 border-white/10 hover:border-amber-500/40 backdrop-blur-xl'
                }`}
              >
                {/* Header: Slot Badge & Physical Key Hardware Info */}
                <div className={`flex items-center justify-between border-b pb-2.5 ${
                  isLight ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center font-mono font-bold text-sm shadow-sm ${
                      isLight
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-400/30 text-amber-300'
                    }`}>
                      {k.key}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          Selezione #{k.productNum}
                        </span>
                        <span className={`text-[10px] font-mono px-1 rounded border ${
                          isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white/10 text-slate-300 border-white/10'
                        }`}>
                          {k.code}
                        </span>
                      </div>
                      <span className={`text-[10px] block font-mono font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Matrice: {k.wirePins}
                      </span>
                    </div>
                  </div>

                  {/* Inline Test Dispense Button */}
                  <button
                    type="button"
                    onClick={() => handleTestDispense(k.key, currentVal)}
                    disabled={isTestingThis}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 transition-all cursor-pointer ${
                      isTestingThis
                        ? 'bg-blue-600 text-white animate-pulse'
                        : isLight
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                    }`}
                    title="Eroga una dose di prova su questo distributore per testare il nome e il rele"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isTestingThis ? 'Test...' : 'Test'}</span>
                  </button>
                </div>

                {/* Product Name Assignment Input Field */}
                <div className="space-y-1.5">
                  <label className={`block text-[11px] font-semibold flex items-center justify-between ${
                    isLight ? 'text-slate-800' : 'text-slate-300'
                  }`}>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3 text-amber-500" />
                      <span>Nome Prodotto Erogato:</span>
                    </span>
                    <span className={`text-[9px] font-semibold px-1 rounded ${
                      isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      Modificabile
                    </span>
                  </label>
                  <input
                    type="text"
                    id={`input-product-name-${k.key}`}
                    value={currentVal}
                    onChange={(e) => handleKeyAssignmentChange(k.key, e.target.value)}
                    placeholder="Es. Caffè Espresso, Ginseng, Tè..."
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none transition-colors ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-600 focus:ring-1 focus:ring-amber-600/20 shadow-sm'
                        : 'bg-black/40 border-white/15 text-white focus:border-amber-400'
                    }`}
                  />
                </div>

                {/* Quick Recipe Presets Dropdown */}
                <div className="space-y-1">
                  <label className={`block text-[10px] font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Assegna rapido da ricettario:
                  </label>
                  <select
                    id={`select-preset-${k.key}`}
                    value={matchedPreset ? matchedPreset.name : ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        handleKeyAssignmentChange(k.key, e.target.value);
                      }
                    }}
                    className={`w-full border rounded-xl px-2.5 py-1.5 text-[11px] focus:outline-none cursor-pointer ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-800 font-medium focus:border-blue-600 shadow-xs'
                        : 'bg-slate-900/90 border-white/10 text-slate-300 focus:border-blue-400'
                    }`}
                  >
                    <option value="">-- Seleziona una ricetta predefinita --</option>
                    {PRESET_BEVERAGES.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* LCD Display 16x2 Real-time Preview */}
                <div className="space-y-1 pt-1">
                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}>
                    <Monitor className="w-3 h-3 text-cyan-600" />
                    <span>Anteprima Display LCD 16x2:</span>
                  </span>
                  <div className={`p-2 rounded-xl border font-mono text-[11px] leading-tight select-none shadow-inner ${
                    isLight
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80 shadow-black/20'
                      : 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30'
                  }`}>
                    <div className="flex justify-between text-[9px] opacity-80 border-b border-emerald-800/50 pb-0.5 mb-1">
                      <span>GB-VEND LCD</span>
                      <span>16x2 MATRIX</span>
                    </div>
                    <div className="truncate font-bold">
                      SEL: {k.code} {k.key}
                    </div>
                    <div className="truncate font-semibold text-emerald-200">
                      &gt; {currentVal || 'PRODOTTO'} &lt;
                    </div>
                  </div>
                </div>

                {/* Technical Pin Mapping Details */}
                <div className={`text-[10px] pt-1 flex items-center justify-between border-t ${
                  isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
                }`}>
                  <span>Fili PLC: Pin {k.wireA} &bull; Pin {k.wireB}</span>
                  <span className="font-semibold text-amber-600">Optoisolato</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SPECIAL FUNCTION KEYS TABLE (CARAFFA, STOP, LINGUA) */}
      <div className={`border rounded-3xl p-5 shadow-md space-y-3 ${
        isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/10 shadow-xl backdrop-blur-xl'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className={`w-4 h-4 ${isLight ? 'text-blue-700' : 'text-blue-400'}`} />
            <h3 className={`text-sm font-bold uppercase tracking-wider ${isLight ? 'text-slate-950' : 'text-white'}`}>
              Tasti di Funzione di Sistema (Riga 4 Matrice)
            </h3>
          </div>
          <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Tasti riservati dal firmware per il controllo del ciclo
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {MATRIX_FUNCTION_ROW.map((fk) => (
            <div
              key={fk.key}
              className={`p-3 rounded-2xl border flex items-center gap-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                fk.key === 'CARAFFA'
                  ? isLight ? 'bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                  : fk.key === 'STOP'
                  ? isLight ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
                  : isLight ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
              }`}>
                {fk.key}
              </div>
              <div className="min-w-0">
                <span className={`text-xs font-bold block ${isLight ? 'text-slate-900' : 'text-white'}`}>{fk.label}</span>
                <span className={`text-[10px] block font-mono font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{fk.wirePins}</span>
                <span className={`text-[10px] block ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>{fk.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JSON EXPORT MODAL */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-4 ${
            isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-white/15'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Download className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Mappa Prodotti JSON &bull; {currentMachine?.name}
                </h3>
              </div>
              <button
                onClick={() => setShowJsonModal(false)}
                className={`p-1 rounded-lg text-lg leading-none cursor-pointer ${
                  isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                &times;
              </button>
            </div>

            <textarea
              readOnly
              rows={12}
              value={JSON.stringify(keyMapping, null, 2)}
              className={`w-full p-3 rounded-2xl font-mono text-xs border focus:outline-none ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-800'
                  : 'bg-black/50 border-white/10 text-emerald-400'
              }`}
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(keyMapping, null, 2));
                  setStatusMessage({ text: 'Configurazione JSON copiata negli appunti!', type: 'success' });
                  setShowJsonModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copia JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                }`}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
