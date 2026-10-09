import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KeyLog, SupportedLang, BeverageItem, MachineSupplies, VendingMachine, Esp32Device } from '../types';
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
  Coffee,
  CupSoda,
  Volume2,
  VolumeX,
  Sparkles,
  Server,
  Zap,
  Activity,
  Flame,
  Droplets,
  Layers,
  Octagon,
  Languages,
  Wine,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sliders,
  Cpu,
  Radio,
} from 'lucide-react';

interface KeypadSimulatorProps {
  onKeyLogged?: (log: KeyLog) => void;
  onBeverageDispensed?: () => void;
  initialDeviceId?: string;
}

// Multilanguage labels dictionary for the LCD Display & Keypad
const I18N_DICT: Record<SupportedLang, {
  flag: string;
  name: string;
  selectPrompt: string;
  ready: string;
  dispensing: string;
  caraffaActive: string;
  caraffaSubtitle: string;
  emergencyStop: string;
  stopped: string;
  freeVend: string;
  standardDose: string;
  caraffaDose: string;
  cupDrop: string;
  grinding: string;
  pumpBoiler: string;
  completed: string;
  boiler: string;
  langChanged: string;
}> = {
  it: {
    flag: '🇮🇹',
    name: 'Italiano',
    selectPrompt: 'SCEGLI PRODOTTO (P1-P12)',
    ready: 'DISTRIBUTORE PRONTO',
    dispensing: 'EROGAZIONE IN CORSO',
    caraffaActive: '*** MODALITÀ CARAFFA ***',
    caraffaSubtitle: 'Modalità Caraffa',
    emergencyStop: 'STOP EMERGENZA',
    stopped: 'EROGAZIONE INTERROTTA',
    freeVend: 'EROGAZIONE DIRETTA',
    standardDose: 'Tazza Standard',
    caraffaDose: 'Dose Caraffa',
    cupDrop: '1/3: Verifica tazza e avvio dosaggio...',
    grinding: '2/3: Macinazione grani di caffè...',
    pumpBoiler: '3/3: Pompa alta pressione & Boiler 93°C...',
    completed: 'Erogazione completata con successo!',
    boiler: 'BOILER',
    langChanged: 'Lingua impostata: Italiano',
  },
  en: {
    flag: '🇬🇧',
    name: 'English',
    selectPrompt: 'SELECT PRODUCT (P1-P12)',
    ready: 'GB DISPENSER READY',
    dispensing: 'DISPENSING IN PROGRESS',
    caraffaActive: '*** CARAFE MODE ***',
    caraffaSubtitle: 'Carafe Dose (4 Cups)',
    emergencyStop: 'EMERGENCY STOP',
    stopped: 'DISPENSE STOPPED',
    freeVend: 'DIRECT DISPENSE',
    standardDose: 'Standard Cup',
    caraffaDose: 'Carafe Dose',
    cupDrop: '1/3: Cup placed & starting dosage...',
    grinding: '2/3: Grinding coffee beans...',
    pumpBoiler: '3/3: High pressure pump & Boiler 93°C...',
    completed: 'Dispense successfully completed!',
    boiler: 'BOILER',
    langChanged: 'Language set to English',
  },
  de: {
    flag: '🇩🇪',
    name: 'Deutsch',
    selectPrompt: 'PRODUKT WÄHLEN (P1-P12)',
    ready: 'AUTOMAT BEREIT',
    dispensing: 'AUSGABE LÄUFT',
    caraffaActive: '*** KARAFFE MODUS ***',
    caraffaSubtitle: 'Kannen-Dosis (4 Tassen)',
    emergencyStop: 'NOT-HALT',
    stopped: 'AUSGABE GESTOPPT',
    freeVend: 'DIREKTAUSGABE',
    standardDose: 'Standardtasse',
    caraffaDose: 'Kannen-Dosis',
    cupDrop: '1/3: Tasse positioniert & Dosierung...',
    grinding: '2/3: Bohnen werden gemahlen...',
    pumpBoiler: '3/3: Hochdruckpumpe & Boiler 93°C...',
    completed: 'Ausgabe erfolgreich abgeschlossen!',
    boiler: 'BOILER',
    langChanged: 'Sprache auf Deutsch eingestellt',
  },
  fr: {
    flag: '🇫🇷',
    name: 'Français',
    selectPrompt: 'CHOISIR PRODUIT (P1-P12)',
    ready: 'DISTRIBUTEUR PRÊT',
    dispensing: 'DISTRIBUTION EN COURS',
    caraffaActive: '*** MODE CARAFE ***',
    caraffaSubtitle: 'Dose Carafe (4 Tasses)',
    emergencyStop: 'ARRÊT D\'URGENCE',
    stopped: 'DISTRIBUTION ARRÊTÉE',
    freeVend: 'DISTRIBUTION DIRECTE',
    standardDose: 'Tasse Standard',
    caraffaDose: 'Dose Carafe',
    cupDrop: '1/3: Tasse positionnée & dosage démarré...',
    grinding: '2/3: Mouture des grains de café...',
    pumpBoiler: '3/3: Pompe haute pression & Chaudière 93°C...',
    completed: 'Boisson prête à être dégustée!',
    boiler: 'CHAUDIÈRE',
    langChanged: 'Langue configurée: Français',
  },
  es: {
    flag: '🇪🇸',
    name: 'Español',
    selectPrompt: 'ELEGIR PRODUCTO (P1-P12)',
    ready: 'DISTRIBUIDOR LISTO',
    dispensing: 'DISPENSANDO BEBIDA',
    caraffaActive: '*** MODO JARRA ***',
    caraffaSubtitle: 'Dosis Jarra (4 Tazas)',
    emergencyStop: 'PARADA DE EMERGENCIA',
    stopped: 'DISPENSACIÓN DETENIDA',
    freeVend: 'DISPENSACIÓN DIRECTA',
    standardDose: 'Taza Estándar',
    caraffaDose: 'Dosis Jarra',
    cupDrop: '1/3: Taza posicionada & iniciando dosificación...',
    grinding: '2/3: Moliendo café...',
    pumpBoiler: '3/3: Bomba alta presión y Caldera 93°C...',
    completed: '¡Bebida lista para retirar!',
    boiler: 'CALDERA',
    langChanged: 'Idioma configurado: Español',
  },
};

// Re-export for external references
export const KEYPAD_ROWS = MATRIX_PRODUCT_ROWS;
export const KEYPAD_ROW_FUNCTIONS = MATRIX_FUNCTION_ROW;

export const KeypadSimulator: React.FC<KeypadSimulatorProps> = ({ onKeyLogged, onBeverageDispensed, initialDeviceId }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [optoDurationMs, setOptoDurationMs] = useState<number>(400);
  const [currentLang, setCurrentLang] = useState<SupportedLang>('it');
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState(initialDeviceId || '');

  // Vending Machine state (Free dispense / No payment)
  const [isCaraffa, setIsCaraffa] = useState<boolean>(false);
  const [caraffaCountdown, setCaraffaCountdown] = useState<number>(0);
  const caraffaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const caraffaIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [beverages, setBeverages] = useState<BeverageItem[]>([]);
  const [supplies, setSupplies] = useState<MachineSupplies | null>(null);

  // Dispense animation & execution state
  const [dispenseState, setDispenseState] = useState<{
    isDispensing: boolean;
    stepName: string;
    progress: number;
    beverageName: string;
    isCaraffaActive: boolean;
    productKey?: string;
  }>({
    isDispensing: false,
    stepName: '',
    progress: 0,
    beverageName: '',
    isCaraffaActive: false,
  });

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const [lastNotification, setLastNotification] = useState<{ success: boolean; message: string; timestamp: number } | null>(null);

  const t = I18N_DICT[currentLang];

  // Cycle language
  const handleNextLanguage = useCallback(() => {
    const langs: SupportedLang[] = ['it', 'en', 'de', 'fr', 'es'];
    const currentIndex = langs.indexOf(currentLang);
    const nextLang = langs[(currentIndex + 1) % langs.length];
    setCurrentLang(nextLang);
    const nextDict = I18N_DICT[nextLang];
    setLastNotification({
      success: true,
      message: `${nextDict.flag} ${nextDict.langChanged} (${nextDict.name})`,
      timestamp: Date.now(),
    });
  }, [currentLang]);

  // Helper to normalize MAC Address (removes separators, uppercase)
  const cleanMac = (mac?: string | null) => {
    if (!mac) return '';
    return mac.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
  };

  const formatMac = (mac?: string | null) => {
    const c = cleanMac(mac);
    if (c.length === 12) {
      return c.match(/.{1,2}/g)?.join(':') || c;
    }
    return mac?.trim().toUpperCase() || '';
  };

  // Load beverages, supplies, and machines list from API
  const loadData = async () => {
    try {
      const [bevRes, supRes, machRes, devRes] = await Promise.all([
        fetch('/api/beverages'),
        fetch('/api/supplies'),
        fetch('/api/machines'),
        fetch('/api/devices'),
      ]);
      let machList: VendingMachine[] = [];
      let devList: Esp32Device[] = [];
      if (bevRes.ok) setBeverages(await bevRes.json());
      if (supRes.ok) setSupplies(await supRes.json());
      if (devRes.ok) {
        devList = await devRes.json();
        setDevices(devList);
      }
      if (machRes.ok) {
        machList = await machRes.json();
        setMachines(machList);
      }

      // Regole vincolanti:
      // 1. "se macchina e modulo sono associati mostra la macchina"
      // 2. "se modulo libero mostra modulo"
      // 3. "e non mostrare macchina senza modulo"
      const validMachList = machList.filter((m) => cleanMac(m.assignedDeviceMac).length === 12);
      const assignedMacSetInLoad = new Set(validMachList.map((m) => cleanMac(m.assignedDeviceMac)));
      const validFreeDevList = devList.filter((d) => {
        const dMac = cleanMac(d.macAddress);
        return !assignedMacSetInLoad.has(dMac) && !d.assignedMachineId;
      });

      // Auto-select active target hardware
      setSelectedDevice((prev) => {
        if (initialDeviceId) {
          const initMach = validMachList.find((m) => m.id === initialDeviceId || m.serialNumber === initialDeviceId);
          if (initMach) return initMach.id;
          const initDev = validFreeDevList.find(
            (d) =>
              cleanMac(d.macAddress) === cleanMac(initialDeviceId) ||
              d.deviceId.toLowerCase() === initialDeviceId.toLowerCase() ||
              `virtual_dev_${d.macAddress}` === initialDeviceId
          );
          if (initDev) return `virtual_dev_${initDev.macAddress}`;
        }

        if (prev) {
          const cleanPrev = cleanMac(prev.replace('virtual_dev_', ''));
          const isValidMach = validMachList.some((m) => m.id === prev);
          const isValidDev = validFreeDevList.some(
            (d) => `virtual_dev_${d.macAddress}` === prev || cleanMac(d.macAddress) === cleanPrev || d.deviceId.toLowerCase() === prev.toLowerCase()
          );
          if (isValidMach || isValidDev) return prev;
        }

        // Priority 1: First configured vending machine WITH module
        if (validMachList.length > 0) return validMachList[0].id;
        // Priority 2: Detected free hardware module (prefer online, otherwise first detected)
        const onlineFree = validFreeDevList.find((d) => d.status === 'ONLINE' || d.status === 'UNASSIGNED') || validFreeDevList[0];
        if (onlineFree) return `virtual_dev_${onlineFree.macAddress}`;
        return '';
      });
    } catch {
      // ignore network errors in sandbox
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      if (caraffaTimerRef.current) clearTimeout(caraffaTimerRef.current);
      if (caraffaIntervalRef.current) clearInterval(caraffaIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (initialDeviceId) {
      setSelectedDevice(initialDeviceId);
    }
  }, [initialDeviceId]);

  // 1. Distributori con modulo associato:
  // "se macchina e modulo sono associati mostra la macchina"
  // "e non mostrare macchina senza modulo"
  const machinesWithModule = machines.filter((m) => cleanMac(m.assignedDeviceMac).length === 12);

  // Insieme di MAC address attualmente associati ad una macchina
  const assignedMacSet = new Set(machinesWithModule.map((m) => cleanMac(m.assignedDeviceMac)));

  // 2. Moduli hardware liberi (non associati ad alcuna macchina):
  // "se modulo libero mostra modulo"
  const freeModules = devices.filter((d) => {
    const dMac = cleanMac(d.macAddress);
    return !assignedMacSet.has(dMac) && !d.assignedMachineId;
  });

  // Verifica quale macchina o modulo stiamo simulando:
  const selectedMachine = machinesWithModule.find(
    (m) => m.id === selectedDevice || m.serialNumber === selectedDevice
  ) || null;

  const cleanSelectedMac = cleanMac(selectedDevice.replace('virtual_dev_', ''));
  const selectedFreeModule = !selectedMachine
    ? freeModules.find(
        (d) =>
          `virtual_dev_${cleanMac(d.macAddress)}` === selectedDevice ||
          `virtual_dev_${d.macAddress}` === selectedDevice ||
          cleanMac(d.macAddress) === cleanSelectedMac ||
          d.deviceId.toLowerCase() === selectedDevice.toLowerCase()
      ) || null
    : null;

  // Stiamo simulando: 'machine' | 'free_module' | 'none'
  const simulationMode: 'machine' | 'free_module' | 'none' = selectedMachine
    ? 'machine'
    : selectedFreeModule
    ? 'free_module'
    : 'none';

  // Sincronizzazione automatica se selectedDevice punta a una macchina senza modulo o a un ID non valido
  useEffect(() => {
    if (machines.length > 0 || devices.length > 0) {
      if (!selectedMachine && !selectedFreeModule) {
        if (machinesWithModule.length > 0) {
          setSelectedDevice(machinesWithModule[0].id);
        } else if (freeModules.length > 0) {
          const onlineFree = freeModules.find((d) => d.status === 'ONLINE' || d.status === 'UNASSIGNED') || freeModules[0];
          setSelectedDevice(`virtual_dev_${onlineFree.macAddress}`);
        }
      }
    }
  }, [machinesWithModule.length, freeModules.length, selectedMachine, selectedFreeModule]);

  // Se simuliamo una macchina, recupera il modulo collegato
  const linkedDevice = selectedMachine
    ? devices.find((d) => cleanMac(d.macAddress) === cleanMac(selectedMachine.assignedDeviceMac)) || null
    : null;

  // Entità macchina attiva per la simulazione e il rendering dei prodotti
  const activeMachine: VendingMachine | null = selectedMachine
    ? selectedMachine
    : selectedFreeModule
    ? ({
        id: `virtual_dev_${selectedFreeModule.macAddress}`,
        name: `Modulo Standalone ${selectedFreeModule.deviceId || selectedFreeModule.macAddress}`,
        model: 'Collaudo Banco Hardware (Nessuna Macchina)',
        serialNumber: selectedFreeModule.serialNumber || '500000',
        status: (selectedFreeModule.status === 'ONLINE' || selectedFreeModule.status === 'UNASSIGNED') ? 'ONLINE' : 'OFFLINE',
        assignedDeviceMac: selectedFreeModule.macAddress,
        ipAddress: selectedFreeModule.ipAddress || '192.168.1.150',
        location: 'Banco Collaudo Hardware ESP32',
        locationDetails: {
          company: 'Laboratorio Collaudo (Nessuna Macchina)',
          site: 'Banco Prova ESP32',
          address: 'Laboratorio Hardware',
          city: 'Milano',
          zipCode: '20100',
          province: 'MI',
        },
        productsCount: 12,
        totalDispenses: 0,
        boilerTempCelsius: 93.0,
        targetTempCelsius: 93.0,
        totalEarnings: 0,
        createdAt: selectedFreeModule.createdAt || new Date().toISOString(),
        supplies: supplies || undefined,
      } as any)
    : null;

  // Sound generator for buzzer/feedback
  const playBuzzerTone = useCallback((freq = 800, duration = 0.15) => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }, [soundEnabled]);

  // Reset Caraffa state completely (e.g. on timeout expiry, dispense, or manual toggle)
  const resetCaraffaMode = useCallback((notifyTimeout = false) => {
    if (caraffaTimerRef.current) {
      clearTimeout(caraffaTimerRef.current);
      caraffaTimerRef.current = null;
    }
    if (caraffaIntervalRef.current) {
      clearInterval(caraffaIntervalRef.current);
      caraffaIntervalRef.current = null;
    }
    setIsCaraffa(false);
    setCaraffaCountdown(0);

    if (notifyTimeout) {
      playBuzzerTone(550, 0.25);
      setLastNotification({
        success: false,
        message: `[${activeMachine?.name || selectedDevice}] TIMEOUT CARAFFA (10s): Ripristino automatico Monodose standard`,
        timestamp: Date.now(),
      });
    }
  }, [activeMachine, selectedDevice, playBuzzerTone]);

  // Start 10s Caraffa countdown timer with reliable interval & timeout
  const startCaraffaTimer = useCallback((duration = 10) => {
    if (caraffaTimerRef.current) {
      clearTimeout(caraffaTimerRef.current);
      caraffaTimerRef.current = null;
    }
    if (caraffaIntervalRef.current) {
      clearInterval(caraffaIntervalRef.current);
      caraffaIntervalRef.current = null;
    }

    const totalSec = duration >= 100 ? Math.round(duration / 1000) : Math.max(1, Math.round(duration));
    setIsCaraffa(true);
    setCaraffaCountdown(totalSec);

    let remaining = totalSec;
    caraffaIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCaraffaCountdown(remaining);
      } else {
        if (caraffaIntervalRef.current) {
          clearInterval(caraffaIntervalRef.current);
          caraffaIntervalRef.current = null;
        }
      }
    }, 1000);

    caraffaTimerRef.current = setTimeout(() => {
      resetCaraffaMode(true);
    }, totalSec * 1000);
  }, [resetCaraffaMode]);

  // Listen to remote caraffa-modifier events (e.g. from MQTT or physical ESP32)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/stream');
      eventSource.addEventListener('caraffa-modifier', (e) => {
        try {
          const data = JSON.parse(e.data);
          const currentId = activeMachine?.id || selectedDevice;
          const matches = !data.machineId || data.machineId === currentId || data.machineId === selectedDevice;
          if (matches) {
            if (data.isCaraffa === false || data.expired) {
              resetCaraffaMode(Boolean(data.expired));
            } else if (data.isCaraffa === true) {
              // Only start if not already counting down locally
              if (!caraffaTimerRef.current) {
                startCaraffaTimer(data.timeoutSeconds || 10);
              }
            }
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [selectedDevice, activeMachine, resetCaraffaMode, startCaraffaTimer]);

  // Web Audio Synthesizer for feedback
  const playKeyBeep = (key: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const canonical = normalizeMatrixKey(key);
      const frequencies: Record<string, number> = {
        P1: 440, P2: 480, P3: 520, P4: 560,
        P5: 600, P6: 640, P7: 680, P8: 720,
        P9: 760, P10: 800, P11: 840, P12: 880,
        CARAFFA: 950, STOP: 300, LINGUA: 1050,
      };

      osc.frequency.setValueAtTime(frequencies[canonical] || 500, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Audio context might be restricted
    }
  };

  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + i * 0.08 + 0.25);
      });
    } catch {
      // ignore
    }
  };

  const playErrorSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  };

  const btnWirePins = (key: string) => {
    const k = MATRIX_KEYS.find((m) => m.key === key);
    return k?.wirePins || '1-8';
  };

  // Helper di risoluzione target hardware rigoroso
  const getHardwareTarget = useCallback(() => {
    if (simulationMode === 'machine' && selectedMachine) {
      return {
        deviceId: selectedMachine.id,
        machineId: selectedMachine.id,
        displayName: selectedMachine.name,
      };
    }
    if (simulationMode === 'free_module' && selectedFreeModule) {
      return {
        deviceId: `virtual_dev_${selectedFreeModule.macAddress}`,
        machineId: undefined,
        displayName: `Modulo ${selectedFreeModule.deviceId || selectedFreeModule.macAddress}`,
      };
    }
    return {
      deviceId: selectedDevice,
      machineId: undefined,
      displayName: selectedDevice || 'Nessun Dispositivo',
    };
  }, [simulationMode, selectedMachine, selectedFreeModule, selectedDevice]);

  // Emergency / Manual STOP Handler (Zero-Latency Instant Response)
  const handleEmergencyStop = useCallback(() => {
    // 1. Clear all ongoing dispense animation timers immediately
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const target = getHardwareTarget();
    const wasDispensing = dispenseState.isDispensing;

    // 2. Immediate UI state reset (< 1ms)
    setDispenseState({
      isDispensing: false,
      stepName: t.emergencyStop,
      progress: 0,
      beverageName: '',
      isCaraffaActive: false,
    });
    resetCaraffaMode(false);

    // 3. Instant sound feedback
    if (soundEnabled) {
      if (wasDispensing) {
        playErrorSound();
      } else {
        playKeyBeep('STOP');
      }
    }

    // 4. Immediate tactile notification in UI
    setLastNotification({
      success: wasDispensing ? false : true,
      message: wasDispensing
        ? `[${target.displayName}] ${t.emergencyStop}: ${t.stopped}!`
        : `[${target.displayName}] 🛑 STOP Inviato (U4+U7) • ${t.ready}`,
      timestamp: Date.now(),
    });

    // 5. Fire non-blocking STOP request immediately with 300ms crisp pulse
    const stopPayload = {
      deviceId: target.deviceId,
      machineId: target.machineId,
      key: 'STOP',
      keyChar: '0',
      productNumber: 13,
      wireA: 4,
      wireB: 7,
      durationMs: 300,
      reason: wasDispensing ? 'Tasto STOP premuto durante erogazione' : 'Tasto STOP manuale premuto',
    };

    fetch('/api/dispense/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stopPayload),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.log && onKeyLogged) {
          onKeyLogged(data.log);
        }
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(loadData, 500);
      });
  }, [getHardwareTarget, dispenseState.isDispensing, t, resetCaraffaMode, soundEnabled, onKeyLogged]);

  // Perform direct beverage dispense (One-Touch / Free Dispense)
  const triggerDispense = async (canonicalKey: string) => {
    if (dispenseState.isDispensing) return;

    if (simulationMode === 'none') {
      if (soundEnabled) playErrorSound();
      setLastNotification({
        success: false,
        message: 'Nessun distributore con modulo associato o modulo libero disponibile per la simulazione.',
        timestamp: Date.now(),
      });
      return;
    }

    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    const target = getHardwareTarget();
    const caraffaModeActive = isCaraffa;
    resetCaraffaMode(false);

    const resolved = resolveKeyDetails(canonicalKey, activeMachine);
    const productName = resolved.associatedProduct || `Prodotto ${canonicalKey}`;

    // Start Dispensing simulation immediately
    setDispenseState({
      isDispensing: true,
      stepName: caraffaModeActive
        ? `${t.caraffaActive} -> ${t.caraffaSubtitle}`
        : simulationMode === 'free_module'
        ? `Chiusura contatti PC817 (fili ${btnWirePins(canonicalKey)})`
        : t.cupDrop,
      progress: 25,
      beverageName: caraffaModeActive ? `${productName} (${t.caraffaDose})` : productName,
      isCaraffaActive: caraffaModeActive,
      productKey: canonicalKey,
    });

    try {
      const res = await fetch('/api/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: canonicalKey,
          isCaraffa: caraffaModeActive,
          deviceId: target.deviceId,
          machineId: target.machineId,
          durationMs: optoDurationMs,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (soundEnabled) playErrorSound();
        setDispenseState({ isDispensing: false, stepName: '', progress: 0, beverageName: '', isCaraffaActive: false });
        setLastNotification({
          success: false,
          message: data.error || 'Errore durante l\'erogazione',
          timestamp: Date.now(),
        });
        return;
      }

      // Propagate the recorded dispense log immediately to the telemetry view
      if (data.log && onKeyLogged) {
        onKeyLogged(data.log);
      }

      // Step animations
      const t1 = setTimeout(() => {
        setDispenseState((prev) => ({
          ...prev,
          stepName: simulationMode === 'free_module'
            ? `Impulso optoisolatore attivo (${optoDurationMs}ms)`
            : t.grinding,
          progress: 55,
        }));
      }, 1000);

      const t2 = setTimeout(() => {
        setDispenseState((prev) => ({
          ...prev,
          stepName: simulationMode === 'free_module'
            ? 'Rilascio contatto opto PC817 completato'
            : t.pumpBoiler,
          progress: 85,
        }));
      }, 2200);

      const t3 = setTimeout(() => {
        setDispenseState({ isDispensing: false, stepName: '', progress: 100, beverageName: '', isCaraffaActive: false });
        setIsCaraffa(false);
        if (soundEnabled) playSuccessSound();
        setLastNotification({
          success: true,
          message: simulationMode === 'free_module'
            ? `[${target.displayName}] Impulso '${productName}' (${optoDurationMs}ms) inviato con successo!`
            : caraffaModeActive
            ? `[${target.displayName}] ${t.caraffaDose}: '${productName}' ${t.completed}`
            : `[${target.displayName}] '${productName}' ${t.completed}`,
          timestamp: Date.now(),
        });
        if (onBeverageDispensed) onBeverageDispensed();
        loadData();
      }, 3500);

      timeoutsRef.current.push(t1, t2, t3);
    } catch {
      if (soundEnabled) playErrorSound();
      setDispenseState({ isDispensing: false, stepName: '', progress: 0, beverageName: '', isCaraffaActive: false });
      setLastNotification({
        success: false,
        message: 'Errore di connessione con il distributore o modulo hardware',
        timestamp: Date.now(),
      });
    }
  };

  // Physical button press handler
  const handleKeyPress = useCallback(
    async (rawKey: string) => {
      const canonicalKey = normalizeMatrixKey(rawKey);
      setActiveKey(canonicalKey);

      if (soundEnabled) {
        playKeyBeep(canonicalKey);
      }

      setTimeout(() => {
        setActiveKey(null);
      }, 200);

      const target = getHardwareTarget();

      // 1. CARAFFA Key (Modifier / Predisposizione dose Caraffa)
      if (canonicalKey === 'CARAFFA') {
        if (isCaraffa) {
          resetCaraffaMode(false);
          setLastNotification({
            success: true,
            message: `[${target.displayName}] Modalità normale ripristinata (Monodose standard)`,
            timestamp: Date.now(),
          });
          return;
        }

        startCaraffaTimer(10);
        setLastNotification({
          success: true,
          message: `[${target.displayName}] MODALITÀ CARAFFA ATTIVATA (Timeout 10s): Seleziona una bevanda entro 10s`,
          timestamp: Date.now(),
        });

        try {
          fetch('/api/matrix/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: '14',
              deviceId: target.deviceId,
              machineId: target.machineId,
              durationMs: optoDurationMs,
            }),
          }).catch(() => {});
        } catch {
          // ignore
        }
        return;
      }

      // 2. STOP Key (Hardware Emergency Stop)
      if (canonicalKey === 'STOP') {
        await handleEmergencyStop();
        return;
      }

      // 3. LINGUA Key (Language selector)
      if (canonicalKey === 'LINGUA') {
        handleNextLanguage();
        try {
          fetch('/api/matrix/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: '15',
              deviceId: target.deviceId,
              machineId: target.machineId,
              durationMs: optoDurationMs,
            }),
          }).catch(() => {});
        } catch {
          // ignore
        }
        return;
      }

      // 4. Product Keys: P1 .. P12 (triggers dispense with current Caraffa / Monodose modifier)
      triggerDispense(canonicalKey);
    },
    [soundEnabled, optoDurationMs, getHardwareTarget, isCaraffa, onKeyLogged, dispenseState.isDispensing, t, handleNextLanguage, resetCaraffaMode, startCaraffaTimer, triggerDispense, handleEmergencyStop]
  );

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const k = e.key.toUpperCase();

      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        handleKeyPress('STOP');
      } else if (k === ' ' || k === 'C') {
        // Spacebar -> CARAFFA
        e.preventDefault();
        handleKeyPress('CARAFFA');
      } else if (k === 'L') {
        e.preventDefault();
        handleKeyPress('LINGUA');
      } else if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(k)) {
        e.preventDefault();
        handleKeyPress(`P${k}`);
      } else if (k === '0') {
        e.preventDefault();
        handleKeyPress('STOP');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress]);

  return (
    <div className="space-y-4">
      {/* Simulation Mode Banner: Free Module Standalone */}
      {simulationMode === 'free_module' && selectedFreeModule && (
        <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
          isLight
            ? 'bg-cyan-50/90 border-cyan-300 text-cyan-950'
            : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <Radio className={`w-4 h-4 shrink-0 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
            <div>
              <span className="font-bold">Collaudo a Banco Modulo Hardware Libero:</span>
              <span className="ml-1 opacity-90">
                Stai simulando direttamente il modulo <strong>{selectedFreeModule.deviceId || 'ESP32'}</strong> (MAC: <code className="font-mono font-semibold">{selectedFreeModule.macAddress}</code>). Non è associato ad alcuna macchina: la pressione dei tasti invia impulsi reali agli optoisolatori PC817 (fili 1-8, durata {optoDurationMs}ms).
              </span>
            </div>
          </div>
          <span className={`shrink-0 self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
            isLight ? 'bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
          }`}>
            MODULO LIBERO
          </span>
        </div>
      )}

      {/* Empty State Banner if no valid target exists */}
      {simulationMode === 'none' && (
        <div className={`p-6 text-center border-2 border-dashed rounded-3xl space-y-3 ${
          isLight ? 'bg-amber-50 border-amber-300 text-amber-950' : 'bg-amber-950/20 border-amber-500/40 text-amber-200'
        }`}>
          <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
          <div className="space-y-1">
            <h4 className="text-sm font-bold">Nessun Distributore con Modulo o Modulo Libero Rilevato</h4>
            <p className="text-xs opacity-80 max-w-md mx-auto">
              Il simulatore di tastiera mostra esclusivamente <strong>distributori con modulo associato</strong> o <strong>moduli hardware liberi</strong>. Le macchine senza modulo non possono essere simulate.
            </p>
          </div>
        </div>
      )}

      {/* Vending Machine Hardware Panel Card */}
      <div className={`border rounded-3xl p-4 sm:p-6 relative overflow-hidden backdrop-blur-xl transition-colors ${
        isLight
          ? 'bg-white border-slate-300 shadow-xl'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-700/80 shadow-2xl'
      }`}>
        {/* Machine / Free Module Selector Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              simulationMode === 'free_module'
                ? isLight ? 'bg-cyan-100 border border-cyan-300 text-cyan-800' : 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
                : isLight ? 'bg-blue-100 border border-blue-300 text-blue-800' : 'bg-blue-600/20 border border-blue-500/30 text-blue-400'
            }`}>
              {simulationMode === 'free_module' ? <Cpu className="w-4 h-4" /> : <Server className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold tracking-wide ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  {simulationMode === 'machine' && selectedMachine
                    ? selectedMachine.name
                    : simulationMode === 'free_module' && selectedFreeModule
                    ? `Modulo Hardware: ${selectedFreeModule.deviceId || selectedFreeModule.macAddress}`
                    : 'Nessun Dispositivo'}
                </span>
                {simulationMode === 'machine' && selectedMachine && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isLight ? 'bg-emerald-100 text-emerald-900 border-emerald-400' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}>
                    {selectedMachine.status || 'ONLINE'}
                  </span>
                )}
                {simulationMode === 'free_module' && selectedFreeModule && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    isLight ? 'bg-cyan-100 text-cyan-900 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  }`}>
                    MODULO LIBERO
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-mono ${isLight ? 'text-slate-700 font-semibold' : 'text-slate-400'}`}>
                {simulationMode === 'machine' && selectedMachine
                  ? `Matr. #${selectedMachine.serialNumber} • Modulo: ${linkedDevice?.deviceId || 'ESP32'} • MAC: ${selectedMachine.assignedDeviceMac} • IP: ${selectedMachine.ipAddress || linkedDevice?.ipAddress || '192.168.1.150'}`
                  : simulationMode === 'free_module' && selectedFreeModule
                  ? `Matr. #${selectedFreeModule.serialNumber || '500000'} • MAC: ${selectedFreeModule.macAddress} • IP: ${selectedFreeModule.ipAddress || '192.168.1.150'} • FW: ${selectedFreeModule.firmwareVersion || 'v3.2.0'}`
                  : 'Nessun target selezionato'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={
                simulationMode === 'machine' && selectedMachine
                  ? selectedMachine.id
                  : selectedFreeModule
                  ? `virtual_dev_${selectedFreeModule.macAddress}`
                  : selectedDevice
              }
              onChange={(e) => setSelectedDevice(e.target.value)}
              className={`text-xs rounded-xl px-2.5 py-1.5 focus:outline-none font-medium ${
                isLight
                  ? 'bg-slate-100 border border-slate-300 text-slate-900 focus:border-blue-600 shadow-sm'
                  : 'bg-black/50 border border-slate-700 text-slate-200 focus:border-blue-400'
              }`}
            >
              {machinesWithModule.length === 0 && freeModules.length === 0 && (
                <option value="">Nessun dispositivo disponibile per la simulazione</option>
              )}
              {machinesWithModule.length > 0 && (
                <optgroup label="── DISTRIBUTORI CON MODULO ASSOCIATO ──">
                  {machinesWithModule.map((m) => {
                    const linked = devices.find((d) => cleanMac(d.macAddress) === cleanMac(m.assignedDeviceMac));
                    return (
                      <option key={m.id} value={m.id} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                        ☕ {m.name} (#{m.serialNumber}) ── Modulo: {linked?.deviceId || 'ESP32'} ({m.assignedDeviceMac})
                      </option>
                    );
                  })}
                </optgroup>
              )}
              {freeModules.length > 0 && (
                <optgroup label="── MODULI HARDWARE LIBERI (STANDALONE) ──">
                  {freeModules.map((d) => {
                    const virtualId = `virtual_dev_${d.macAddress}`;
                    const isOnline = d.status === 'ONLINE' || d.status === 'UNASSIGNED';
                    return (
                      <option key={virtualId} value={virtualId} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                        {isOnline ? '🟢' : '⚪'} [MODULO LIBERO] {d.deviceId || 'ESP32'} (#{d.serialNumber || '500000'}) ── MAC: {d.macAddress}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>

            {/* Selettore Durata Impulso Opto per Test Banco/Multimetro */}
            <div className="flex items-center" title="Durata chiusura contatti optoisolatori PC817">
              <select
                id="opto-duration-select"
                value={optoDurationMs}
                onChange={(e) => setOptoDurationMs(Number(e.target.value))}
                className={`text-xs px-2.5 py-1.5 rounded-xl border font-mono font-semibold focus:outline-none transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-amber-100/80 border-amber-300 text-amber-900 hover:bg-amber-200/80 focus:border-amber-500 shadow-sm'
                    : 'bg-amber-950/40 border-amber-500/50 text-amber-300 hover:bg-amber-900/60 focus:border-amber-400'
                }`}
              >
                <option value={400}>⚡ 400ms (Normale)</option>
                <option value={1000}>⏱️ 1000ms (1s)</option>
                <option value={2000}>⏱️ 2000ms (2s)</option>
                <option value={4000}>🔬 4000ms (4s Test Tester)</option>
              </select>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-sm'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
              title={soundEnabled ? 'Disattiva Audio Bip' : 'Attiva Audio Bip'}
            >
              {soundEnabled ? <Volume2 className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} /> : <VolumeX className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-slate-500'}`} />}
            </button>
          </div>
        </div>

        {/* 16x2 LCD Matrix Display */}
        <div className={`border-2 rounded-2xl p-3.5 sm:p-4 mb-5 font-mono relative overflow-hidden ${
          isLight
            ? 'bg-[#06180a] border-[#226330] shadow-md'
            : 'bg-[#0b1d0e] border-[#1e4a26] shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]'
        }`}>
          <div className="flex items-center justify-between text-[10px] text-[#55d66c] opacity-90 border-b border-[#1e4a26] pb-1 mb-2">
            <span className="flex items-center gap-1 font-bold">
              <span>● {simulationMode === 'free_module' ? 'TEST MODULO BANCO' : 'LCD 16x2'}</span>
              <span>&bull; {simulationMode === 'free_module' ? (selectedFreeModule?.deviceId || 'ESP32 STANDALONE') : `${t.flag} ${t.name}`}</span>
            </span>
            <span>{simulationMode === 'free_module' ? `MAC: ${selectedFreeModule?.macAddress || 'OK'}` : `${t.boiler}: 93.0°C`}</span>
          </div>

          {/* Row 1 LCD */}
          <div className="text-sm sm:text-base font-bold text-[#62f47b] tracking-wider truncate flex items-center justify-between drop-shadow-[0_0_6px_rgba(98,244,123,0.6)]">
            <span>
              {dispenseState.isDispensing
                ? `${t.dispensing}: ${dispenseState.beverageName}`
                : isCaraffa
                ? `${t.caraffaActive} [${caraffaCountdown}s]`
                : simulationMode === 'free_module'
                ? 'MODULO LIBERO - PRONTO AL TEST'
                : t.selectPrompt}
            </span>
            {dispenseState.isDispensing ? (
              <span className="text-xs animate-pulse text-[#b6ffc3]">{dispenseState.progress}%</span>
            ) : isCaraffa ? (
              <span className="text-xs font-mono text-amber-400 font-bold animate-pulse">{caraffaCountdown}s</span>
            ) : null}
          </div>

          {/* Row 2 LCD */}
          <div className="text-xs text-[#44c45b] mt-1 truncate flex items-center justify-between">
            <span>
              {dispenseState.isDispensing
                ? dispenseState.stepName
                : isCaraffa
                ? `${t.caraffaSubtitle} - Auto-reset Monodose tra ${caraffaCountdown}s`
                : simulationMode === 'free_module'
                ? `Test PC817 (fili 1-8) • Impulso: ${optoDurationMs}ms`
                : `[${t.freeVend}] Premi un tasto (P1-P12)`}
            </span>
            <span className="text-[10px] opacity-80">
              {simulationMode === 'machine' && selectedMachine
                ? selectedMachine.name
                : simulationMode === 'free_module' && selectedFreeModule
                ? selectedFreeModule.deviceId || selectedFreeModule.macAddress
                : selectedDevice}
            </span>
          </div>

          {/* Progress Bar during Dispense */}
          {dispenseState.isDispensing && (
            <div className="w-full bg-[#12361a] h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#62f47b] h-full transition-all duration-500 rounded-full shadow-[0_0_8px_#62f47b]"
                style={{ width: `${dispenseState.progress}%` }}
              />
            </div>
          )}
        </div>

        {/* 15 PHYSICAL KEYS (Rows 1-3 = 12 Products P1..P12, Row 4 = CARAFFA, STOP, LINGUA) */}
        <div className="space-y-4">
          <div className={`flex items-center justify-between text-xs border-b pb-2 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
            <span className={`font-bold flex items-center gap-1.5 uppercase font-mono tracking-wider ${
              isLight ? 'text-amber-900' : 'text-amber-400'
            }`}>
              <Coffee className="w-3.5 h-3.5" /> 12 Tasti Matrice (P1 - P12) + Funzioni Hardware
            </span>
            <span className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              Prodotto evidenziato per ogni tasto
            </span>
          </div>

          {/* Caraffa Active Banner indicator on top of keys */}
          {isCaraffa && (
            <div className={`rounded-2xl p-2.5 sm:px-4 text-xs font-bold flex flex-wrap items-center justify-between gap-2 shadow-lg border transition-all ${
              isLight
                ? 'bg-gradient-to-r from-cyan-100 to-sky-100 border-cyan-400 text-cyan-950 shadow-cyan-100'
                : 'bg-gradient-to-r from-cyan-950/80 to-blue-950/80 border-cyan-400/60 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
            }`}>
              <div className="flex items-center gap-2">
                <Wine className={`w-4 h-4 ${isLight ? 'text-cyan-800' : 'text-cyan-300'} animate-bounce`} />
                <span className="tracking-wider uppercase font-mono text-xs">MODALITÀ CARAFFA ATTIVA</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-xl font-mono text-xs font-bold border flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-white/90 border-cyan-300 text-cyan-950 shadow-sm'
                    : 'bg-black/60 border-cyan-400/50 text-cyan-200'
                }`}>
                  <span>Auto-reset a Monodose:</span>
                  <span className="text-amber-500 dark:text-amber-400 font-black text-sm">{caraffaCountdown}s</span>
                </span>
                <button
                  onClick={() => handleKeyPress('CARAFFA')}
                  className={`text-[11px] px-2.5 py-1 rounded-xl border font-semibold transition-all ${
                    isLight
                      ? 'bg-white border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm'
                      : 'bg-slate-800 border-slate-600 hover:bg-slate-700 text-slate-200'
                  }`}
                  title="Annulla modalità caraffa e torna a Monodose"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          {/* Product Keys Grid (P1 .. P12) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {MATRIX_PRODUCT_ROWS.map((row) =>
              row.map((btn) => {
                const isCurrentActive = activeKey === btn.key;
                const resolved = resolveKeyDetails(btn.key, activeMachine);
                const IconComponent = btn.icon;
                const productName = resolved.associatedProduct;

                let borderStyle = isLight
                  ? 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100 hover:border-slate-400 shadow-sm'
                  : 'border-slate-700/80 bg-slate-900/90 text-slate-200 hover:bg-slate-800/90 shadow-md';

                if (isLight) {
                  if (btn.color === 'amber') {
                    borderStyle = 'border-amber-300 bg-amber-50/90 text-amber-950 hover:bg-amber-100 hover:border-amber-500 shadow-sm';
                  } else if (btn.color === 'emerald') {
                    borderStyle = 'border-emerald-300 bg-emerald-50/90 text-emerald-950 hover:bg-emerald-100 hover:border-emerald-500 shadow-sm';
                  } else if (btn.color === 'orange') {
                    borderStyle = 'border-orange-300 bg-orange-50/90 text-orange-950 hover:bg-orange-100 hover:border-orange-500 shadow-sm';
                  } else if (btn.color === 'yellow') {
                    borderStyle = 'border-yellow-300 bg-yellow-50/90 text-yellow-950 hover:bg-yellow-100 hover:border-yellow-500 shadow-sm';
                  } else if (btn.color === 'cyan') {
                    borderStyle = 'border-cyan-300 bg-cyan-50/90 text-cyan-950 hover:bg-cyan-100 hover:border-cyan-500 shadow-sm';
                  } else if (btn.color === 'rose') {
                    borderStyle = 'border-rose-300 bg-rose-50/90 text-rose-950 hover:bg-rose-100 hover:border-rose-500 shadow-sm';
                  }
                } else {
                  if (btn.color === 'amber') {
                    borderStyle = 'border-amber-500/30 bg-amber-950/20 text-amber-200 hover:bg-amber-900/30 hover:border-amber-400 shadow-md';
                  } else if (btn.color === 'emerald') {
                    borderStyle = 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200 hover:bg-emerald-900/30 hover:border-emerald-400 shadow-md';
                  } else if (btn.color === 'orange') {
                    borderStyle = 'border-orange-500/30 bg-orange-950/20 text-orange-200 hover:bg-orange-900/30 hover:border-orange-400 shadow-md';
                  } else if (btn.color === 'yellow') {
                    borderStyle = 'border-yellow-500/30 bg-yellow-950/20 text-yellow-200 hover:bg-yellow-900/30 hover:border-yellow-400 shadow-md';
                  } else if (btn.color === 'cyan') {
                    borderStyle = 'border-cyan-500/30 bg-cyan-950/20 text-cyan-200 hover:bg-cyan-900/30 hover:border-cyan-400 shadow-md';
                  } else if (btn.color === 'rose') {
                    borderStyle = 'border-rose-500/30 bg-rose-950/20 text-rose-200 hover:bg-rose-900/30 hover:border-rose-400 shadow-md';
                  }
                }

                if (isCaraffa) {
                  borderStyle += isLight ? ' ring-2 ring-cyan-500' : ' ring-1 ring-cyan-500/30';
                }

                if (isCurrentActive) {
                  borderStyle = isLight
                    ? 'border-blue-600 bg-blue-600 text-white scale-95 ring-4 ring-blue-300 shadow-xl'
                    : 'border-white bg-white text-slate-950 scale-95 ring-4 ring-white/50 shadow-2xl';
                }

                return (
                  <button
                    key={btn.key}
                    id={`vending-key-${btn.key}`}
                    onClick={() => handleKeyPress(btn.key)}
                    disabled={dispenseState.isDispensing}
                    className={`h-[78px] rounded-2xl border flex flex-col items-center justify-between p-2 select-none transition-all duration-75 active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed ${borderStyle}`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded border ${
                          isLight
                            ? isCurrentActive ? 'bg-white/20 border-white text-white' : 'bg-slate-800 border-slate-900 text-white'
                            : 'bg-black/40 border-white/10 text-white'
                        }`}>
                          {btn.key}
                        </span>
                        <span className={`text-[9px] font-mono font-semibold ${
                          isLight
                            ? isCurrentActive ? 'text-white/80' : 'text-slate-600'
                            : 'opacity-60'
                        }`}>{btn.wirePins}</span>
                      </div>
                      <IconComponent className={`w-3.5 h-3.5 ${isLight && !isCurrentActive ? 'opacity-90' : 'opacity-80'}`} />
                    </div>

                    {/* Prominent Associated Product Name */}
                    <div className="w-full text-center px-1">
                      <span className={`text-[11px] font-bold tracking-tight block truncate ${
                        isLight
                          ? isCurrentActive ? 'text-white' : 'text-slate-950'
                          : 'text-white drop-shadow-sm'
                      }`}>
                        {productName}
                      </span>
                      <span className={`text-[8.5px] font-mono leading-none ${
                        isCaraffa
                          ? isLight ? 'text-cyan-800 font-bold' : 'text-cyan-300 font-bold'
                          : isLight ? 'text-slate-600 font-medium' : 'text-slate-400'
                      }`}>
                        {simulationMode === 'free_module'
                          ? `Impulso ${optoDurationMs}ms (${btn.wirePins})`
                          : isCaraffa
                          ? t.caraffaDose
                          : 'Eroga Subito'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Row 4: 3 Dedicated Function Keys (CARAFFA, STOP, LINGUA) */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            {/* Tasto CARAFFA */}
            <button
              id="vending-key-CARAFFA"
              onClick={() => handleKeyPress('CARAFFA')}
              className={`h-[68px] rounded-2xl border flex flex-col items-center justify-center p-1.5 select-none transition-all duration-75 active:scale-95 shadow-md ${
                isLight
                  ? isCaraffa
                    ? 'border-cyan-600 bg-cyan-600 text-white ring-2 ring-cyan-400 shadow-lg'
                    : 'border-cyan-300 bg-cyan-50 text-cyan-950 hover:bg-cyan-100 hover:border-cyan-500'
                  : isCaraffa
                  ? 'border-cyan-400 bg-cyan-500/30 text-white ring-2 ring-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'border-cyan-500/40 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/50 hover:border-cyan-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Wine className={`w-4 h-4 ${isLight && !isCaraffa ? 'text-cyan-800' : 'text-cyan-300'}`} />
                <span className="font-mono font-bold text-xs leading-none">[CARAFFA]</span>
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isLight && !isCaraffa ? 'text-cyan-950' : 'text-cyan-200'}`}>
                {isCaraffa ? `ATTIVA (${caraffaCountdown}s)` : 'Modalità Caraffa'}
              </span>
              <span className={`text-[8.5px] font-mono ${isLight && !isCaraffa ? 'text-cyan-800 font-medium' : 'opacity-80'}`}>
                {isCaraffa ? 'Timeout 10s attivo' : 'U4 + U6 (Fili 4-6)'}
              </span>
            </button>

            {/* Tasto STOP */}
            <button
              id="vending-key-STOP"
              onClick={() => handleKeyPress('STOP')}
              className={`h-[68px] rounded-2xl border flex flex-col items-center justify-center p-1.5 select-none transition-all duration-75 active:scale-95 shadow-md ${
                isLight
                  ? 'border-rose-400 bg-rose-50 text-rose-950 hover:bg-rose-100 hover:border-rose-500'
                  : 'border-rose-500/50 bg-rose-950/40 text-rose-200 hover:bg-rose-900/60 hover:border-rose-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Octagon className={`w-4 h-4 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
                <span className="font-mono font-bold text-xs leading-none">[STOP]</span>
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isLight ? 'text-rose-950' : 'text-rose-300'}`}>
                Arresto Emergenza
              </span>
              <span className={`text-[8.5px] font-mono ${isLight ? 'text-rose-800 font-medium' : 'opacity-60'}`}>U4 + U7 (Fili 4-7)</span>
            </button>

            {/* Tasto LINGUA */}
            <button
              id="vending-key-LINGUA"
              onClick={() => handleKeyPress('LINGUA')}
              className={`h-[68px] rounded-2xl border flex flex-col items-center justify-center p-1.5 select-none transition-all duration-75 active:scale-95 shadow-md ${
                isLight
                  ? 'border-blue-300 bg-blue-50 text-blue-950 hover:bg-blue-100 hover:border-blue-500'
                  : 'border-blue-500/50 bg-blue-950/40 text-blue-200 hover:bg-blue-900/60 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{t.flag}</span>
                <span className="font-mono font-bold text-xs leading-none">[LINGUA]</span>
              </div>
              <span className={`text-[10px] font-bold mt-1 ${isLight ? 'text-blue-950' : 'text-blue-200'}`}>
                {t.name} (Cicla)
              </span>
              <span className={`text-[8.5px] font-mono ${isLight ? 'text-blue-800 font-medium' : 'opacity-60'}`}>U4 + U5 (Fili 4-5)</span>
            </button>
          </div>
        </div>

        {/* Footer Notification toast */}
        {lastNotification && (
          <div
            className={`mt-4 p-3 rounded-2xl text-xs flex items-center justify-between border backdrop-blur-md transition-all ${
              lastNotification.success
                ? isLight
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                : isLight
                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {lastNotification.success ? (
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              ) : (
                <AlertTriangle className={`w-4 h-4 shrink-0 ${isLight ? 'text-rose-700' : 'text-rose-400'}`} />
              )}
              <span className="font-semibold">{lastNotification.message}</span>
            </div>
            <span className={`text-[10px] font-mono ml-2 shrink-0 ${isLight ? 'text-slate-600 font-medium' : 'opacity-60'}`}>
              {new Date(lastNotification.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
