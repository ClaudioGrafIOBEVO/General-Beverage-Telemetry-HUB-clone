import React, { useState, useMemo, useEffect, useRef } from 'react';
import mqtt, { MqttClient } from 'mqtt';
import { KeyLog, ServerStats, VendingMachine, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { downloadCsvFile } from '../utils/csvExporter';
import {
  normalizeMatrixKey,
  resolveKeyDetails,
  MATRIX_KEYS,
  ALL_CANONICAL_KEYS,
  DATA_DISPLAY_KEYS,
} from '../utils/keypadMapping';
import {
  Database,
  Search,
  Filter,
  Trash2,
  Download,
  Activity,
  Wifi,
  Clock,
  Sparkles,
  RefreshCw,
  Usb,
  Radio,
  Globe,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Terminal,
  Cloud,
  Zap,
  Cpu,
  Coffee,
  Flame,
  CupSoda,
  Droplets,
  Wine,
  Octagon,
  Languages,
  Barcode,
  Building2,
  MapPin,
  Server,
  Hash,
  Calendar,
  RotateCcw,
  X,
} from 'lucide-react';

interface LiveMonitorProps {
  logs: KeyLog[];
  stats: ServerStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClearLogs: () => Promise<void>;
  machines?: VendingMachine[];
  customers?: Customer[];
  selectedMachineId?: string;
  initialMachineFilter?: string;
  onMachineChanged?: (machineId: string) => void;
}

export const LiveMonitor: React.FC<LiveMonitorProps> = ({
  logs,
  stats,
  isLoading,
  onRefresh,
  onClearLogs,
  machines = [],
  customers = [],
  selectedMachineId,
  initialMachineFilter = 'ALL',
  onMachineChanged,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<string>('ALL');
  // Default to 'ALL' so when returning to Visualizzazione Dati, all fleet telemetry is visible without ghost filters
  const [selectedMachineFilter, setSelectedMachineFilter] = useState<string>(initialMachineFilter || 'ALL');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<string>('ALL');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [quickDatePreset, setQuickDatePreset] = useState<string>('ALL');
  const [selectedDoseFilter, setSelectedDoseFilter] = useState<'ALL' | 'CARAFFA' | 'MONODOSE'>('ALL');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Helper for quick date preset selection
  const handleDatePresetChange = (preset: string) => {
    setQuickDatePreset(preset);
    const now = new Date();
    const formatYmd = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'ALL') {
      setStartDateFilter('');
      setEndDateFilter('');
    } else if (preset === 'TODAY') {
      const today = formatYmd(now);
      setStartDateFilter(today);
      setEndDateFilter(today);
    } else if (preset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = formatYmd(yesterday);
      setStartDateFilter(yStr);
      setEndDateFilter(yStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      setStartDateFilter(formatYmd(past7));
      setEndDateFilter(formatYmd(now));
    } else if (preset === 'THIS_MONTH') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDateFilter(formatYmd(firstOfMonth));
      setEndDateFilter(formatYmd(now));
    }
  };

  // Helper to clear all active filters
  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedKeyFilter('ALL');
    setSelectedMachineFilter('ALL');
    setSelectedCustomerFilter('ALL');
    setSelectedDoseFilter('ALL');
    setStartDateFilter('');
    setEndDateFilter('');
    setQuickDatePreset('ALL');
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedKeyFilter !== 'ALL' ||
    selectedMachineFilter !== 'ALL' ||
    selectedCustomerFilter !== 'ALL' ||
    selectedDoseFilter !== 'ALL' ||
    startDateFilter !== '' ||
    endDateFilter !== '' ||
    quickDatePreset !== 'ALL';

  // MQTT Remote IoT Cloud states
  const [mqttDeviceId, setMqttDeviceId] = useState('');
  const [isMqttConnected, setIsMqttConnected] = useState(false);
  const [mqttLogs, setMqttLogs] = useState<string[]>([]);
  const [lastMqttPacket, setLastMqttPacket] = useState<any>(null);
  const [mqttHeartbeat, setMqttHeartbeat] = useState<any>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);

  // Auto-sync mqttDeviceId with detected hardware module if currently placeholder or empty
  useEffect(() => {
    fetch('/api/devices')
      .then((r) => (r.ok ? r.json() : []))
      .then((devs: any[]) => {
        if (Array.isArray(devs) && devs.length > 0) {
          const activeDev = devs.find((d) => d.status === 'ONLINE' || d.status === 'UNASSIGNED') || devs[0];
          if (activeDev && activeDev.deviceId) {
            setMqttDeviceId((prev) => {
              if (!prev || prev === 'GB-CLOUD MODULE 501824' || prev.includes('501824')) {
                return activeDev.deviceId;
              }
              return prev;
            });
          }
        }
      })
      .catch(() => {});
  }, []);

  // WebSerial states
  const [isSerialSupported, setIsSerialSupported] = useState(false);
  const [isSerialConnected, setIsSerialConnected] = useState(false);
  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const [showSerialTerminal, setShowSerialTerminal] = useState(false);
  const [lastUsbKey, setLastUsbKey] = useState<string | null>(null);
  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialKeepReadingRef = useRef<boolean>(false);

  // Local Wi-Fi IP Bridge states (http://172.16.1.200)
  const [espIp, setEspIp] = useState('172.16.1.200');
  const [isIpPollingActive, setIsIpPollingActive] = useState(false);
  const [ipBridgeStatus, setIpBridgeStatus] = useState<string | null>(null);
  const [lastIpKey, setLastIpKey] = useState<string | null>(null);
  const lastPressCountRef = useRef<number>(0);
  const ipPollingTimerRef = useRef<any>(null);

  useEffect(() => {
    setIsSerialSupported('serial' in navigator);
  }, []);

  // Connect to Public MQTT Broker (HiveMQ WebSockets Port 8884 wss)
  useEffect(() => {
    const brokerUrl = 'wss://broker.hivemq.com:8884/mqtt';
    const clientId = `WebClient_${Math.random().toString(16).substring(2, 10)}`;

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
      });

      mqttClientRef.current = client;

      client.on('connect', () => {
        setIsMqttConnected(true);
        const topicsToSub: string[] = ['vending/+/telemetry', 'vending/+/dispense', 'vending/+/status'];
        if (mqttDeviceId) {
          topicsToSub.push(
            `vending/${mqttDeviceId}/telemetry`,
            `vending/${mqttDeviceId}/dispense`,
            `vending/${mqttDeviceId}/status`
          );
        }

        client.subscribe(topicsToSub, (err) => {
          if (!err) {
            setMqttLogs((prev) => [
              `[MQTT] Iscritto ai flussi telemetria: ${mqttDeviceId ? `vending/${mqttDeviceId}/* e ` : ''}vending/+/*`,
              ...prev.slice(0, 30),
            ]);
          }
        });
      });

      client.on('message', async (topic, message) => {
        try {
          const payloadStr = message.toString();
          const parsed = JSON.parse(payloadStr);

          setMqttLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${topic} -> ${payloadStr}`, ...prev.slice(0, 40)]);

          if (topic.includes('telemetry')) {
            const canonicalKey = normalizeMatrixKey(parsed.key);
            setLastMqttPacket({ ...parsed, canonicalKey });
            // Nota: La registrazione a DB ed erogazione viene già gestita in tempo reale dal backend server.ts connesso direttamente a HiveMQ
          } else if (topic.includes('status')) {
            setMqttHeartbeat(parsed);
          }
        } catch {
          // ignore non-JSON payloads
        }
      });

      return () => {
        if (client) client.end();
      };
    } catch {
      // ignore
    }
  }, [mqttDeviceId]);

  // Polling for Local GB-CLOUD Wi-Fi HTTP Bridge
  useEffect(() => {
    if (!isIpPollingActive) {
      if (ipPollingTimerRef.current) clearInterval(ipPollingTimerRef.current);
      return;
    }

    const pollEsp = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);

        const res = await fetch(`http://${espIp}/status`, {
          signal: controller.signal,
          mode: 'cors',
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          setIpBridgeStatus(`Connesso: RSSI ${data.wifi_rssi} dBm`);

          if (data.press_count > lastPressCountRef.current && data.last_key) {
            lastPressCountRef.current = data.press_count;
            const canonical = normalizeMatrixKey(data.last_key);
            setLastIpKey(canonical);

            await fetch('/api/keylog', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                key: canonical,
                deviceId: data.device_id || `GB-CLOUD-${espIp.replace(/\./g, '_')}`,
                eventType: 'pressed',
                rssi: data.wifi_rssi,
                ip: espIp,
                metadata: { source: 'WiFi-Local-HTTP-Bridge', press_count: data.press_count },
              }),
            });
          }
        }
      } catch {
        setIpBridgeStatus('In ascolto (nessuna risposta dal Modulo)');
      }
    };

    pollEsp();
    ipPollingTimerRef.current = setInterval(pollEsp, 1000);

    return () => {
      if (ipPollingTimerRef.current) clearInterval(ipPollingTimerRef.current);
    };
  }, [isIpPollingActive, espIp]);

  // WebSerial USB reader loop
  const handleConnectUsb = async () => {
    if (!('serial' in navigator)) {
      alert('La Web Serial API non è supportata da questo browser. Usa Google Chrome o Microsoft Edge.');
      return;
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;
      setIsSerialConnected(true);
      serialKeepReadingRef.current = true;

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      serialReaderRef.current = reader;

      let buffer = '';

      while (serialKeepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            setSerialLogs((prev) => [line, ...prev.slice(0, 100)]);

            if (line.includes('TASTO_PREMUTO:') || line.includes('"key":') || line.includes('KEY:')) {
              let detectedKey = '';
              const matchTasto = line.match(/TASTO_PREMUTO:\s*([A-Za-z0-9_#*]+)/i);
              const matchJson = line.match(/"key"\s*:\s*"([^"]+)"/i);
              const matchSimple = line.match(/KEY:\s*([A-Za-z0-9_#*]+)/i);

              if (matchTasto) detectedKey = matchTasto[1];
              else if (matchJson) detectedKey = matchJson[1];
              else if (matchSimple) detectedKey = matchSimple[1];

              if (detectedKey) {
                const canonical = normalizeMatrixKey(detectedKey);
                setLastUsbKey(canonical);

                fetch('/api/keylog', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    key: canonical,
                    deviceId: 'GB-CLOUD-USB-DIRECT',
                    eventType: 'pressed',
                    rssi: -40,
                    metadata: { source: 'WebSerial-USB-Bridge', rawLine: line },
                  }),
                });
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        console.error('Errore connessione seriale:', err);
      }
      setIsSerialConnected(false);
    }
  };

  const handleDisconnectUsb = async () => {
    serialKeepReadingRef.current = false;
    try {
      if (serialReaderRef.current) {
        await serialReaderRef.current.cancel();
      }
      if (serialPortRef.current) {
        await serialPortRef.current.close();
      }
    } catch (e) {
      console.warn('Chiusura seriale:', e);
    }
    setIsSerialConnected(false);
  };

  // Filter keys list: 'ALL', 'P1'..'P12', 'STOP', 'LINGUA' (la pressione del tasto CARAFFA non deve essere visualizzata)
  const filterOptions = ['ALL', ...DATA_DISPLAY_KEYS];

  // Unique customer names for filter dropdown
  const customerFilterOptions = useMemo(() => {
    const list = new Set<string>();
    logs.forEach((l) => {
      if (l.customerName) list.add(l.customerName);
    });
    customers.forEach((c) => {
      if (c.name) list.add(c.name);
    });
    return Array.from(list);
  }, [logs, customers]);

  // Dose distribution counters for Monodose vs Caraffa
  const doseStats = useMemo(() => {
    let caraffa = 0;
    let monodose = 0;
    logs.forEach((l) => {
      const canonicalKey = normalizeMatrixKey(l.key);
      // La pressione del tasto caraffa singolarmente non deve essere conteggiata o vista
      if (canonicalKey === 'CARAFFA' || l.key === 'CARAFFA') return;
      const isCaraffa = Boolean(
        l.isCaraffa ||
        l.doseType === 'CARAFFA' ||
        (l.productName && l.productName.toLowerCase().includes('caraffa')) ||
        (l.keyLabel && l.keyLabel.toLowerCase().includes('erogazione caraffa'))
      );
      if (isCaraffa) {
        caraffa++;
      } else if (canonicalKey !== 'STOP' && canonicalKey !== 'LINGUA') {
        monodose++;
      }
    });
    return { caraffa, monodose, total: caraffa + monodose };
  }, [logs]);

  // Filtered logs (Database Erogazioni)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return logs.filter((log) => {
      const canonicalKey = normalizeMatrixKey(log.key);
      const product = log.productName || '';
      const label = log.keyLabel || '';
      const isCaraffaDose = Boolean(
        log.isCaraffa ||
        log.doseType === 'CARAFFA' ||
        (log.productName && log.productName.toLowerCase().includes('caraffa')) ||
        (log.keyLabel && log.keyLabel.toLowerCase().includes('erogazione caraffa'))
      );

      // Mostra la pressione del tasto CARAFFA quando si visualizzano tutti i tasti o il filtro CARAFFA
      if ((canonicalKey === 'CARAFFA' || log.key === 'CARAFFA') && selectedKeyFilter !== 'ALL' && selectedKeyFilter !== 'CARAFFA') {
        return false;
      }

      const matchSearch =
        !q ||
        log.deviceId.toLowerCase().includes(q) ||
        (log.machineSerialNumber && log.machineSerialNumber.toLowerCase().includes(q)) ||
        (log.customerName && log.customerName.toLowerCase().includes(q)) ||
        (log.siteName && log.siteName.toLowerCase().includes(q)) ||
        (log.machineName && log.machineName.toLowerCase().includes(q)) ||
        (log.ip && log.ip.includes(q)) ||
        canonicalKey.toLowerCase().includes(q) ||
        product.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q);

      const matchKey =
        selectedKeyFilter === 'ALL' ||
        canonicalKey === selectedKeyFilter ||
        log.key.toUpperCase() === selectedKeyFilter.toUpperCase();

      const matchMachine =
        selectedMachineFilter === 'ALL' ||
        log.machineSerialNumber === selectedMachineFilter ||
        log.deviceId === selectedMachineFilter ||
        log.machineName === selectedMachineFilter;

      const matchCustomer =
        selectedCustomerFilter === 'ALL' ||
        (log.customerName && log.customerName.toLowerCase() === selectedCustomerFilter.toLowerCase());

      const matchDose =
        selectedDoseFilter === 'ALL' ||
        (selectedDoseFilter === 'CARAFFA' && isCaraffaDose) ||
        (selectedDoseFilter === 'MONODOSE' && !isCaraffaDose);

      let matchDate = true;
      if (startDateFilter || endDateFilter) {
        if (log.timestamp) {
          const logDate = new Date(log.timestamp);
          if (!isNaN(logDate.getTime())) {
            const year = logDate.getFullYear();
            const month = String(logDate.getMonth() + 1).padStart(2, '0');
            const day = String(logDate.getDate()).padStart(2, '0');
            const logYmd = `${year}-${month}-${day}`;

            if (startDateFilter && logYmd < startDateFilter) {
              matchDate = false;
            }
            if (endDateFilter && logYmd > endDateFilter) {
              matchDate = false;
            }
          }
        }
      }

      return matchSearch && matchKey && matchMachine && matchCustomer && matchDate && matchDose;
    });
  }, [logs, searchQuery, selectedKeyFilter, selectedMachineFilter, selectedCustomerFilter, selectedDoseFilter, startDateFilter, endDateFilter]);

  // Export handlers
  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vending_telemetry_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCsv = () => {
    const headers = [
      'ID Record',
      'Matricola Distributore',
      'Nome Distributore',
      'Cliente Gestore',
      'Sede Operativa',
      'Tasto Matrice',
      'Nome Tasto',
      'Prodotto Associato',
      'Tipo Dose',
      'Moltiplicatore Dose',
      'Dispositivo Modulo',
      'Timestamp Data Ora',
      'Tipo Evento',
      'Segnale WiFi RSSI',
      'IP Sorgente',
    ];
    const validExportLogs = logs.filter(
      (l) => l.key !== 'CARAFFA' && normalizeMatrixKey(l.key) !== 'CARAFFA'
    );
    const rows = validExportLogs.map((l) => {
      const isCaraffa = Boolean(
        l.isCaraffa ||
        l.doseType === 'CARAFFA' ||
        (l.productName && l.productName.toLowerCase().includes('caraffa'))
      );
      return [
        l.id,
        l.machineSerialNumber ? `#${l.machineSerialNumber}` : '',
        l.machineName || '',
        l.customerName || '',
        l.siteName || '',
        normalizeMatrixKey(l.key),
        l.keyLabel || l.key,
        l.productName || 'Default',
        isCaraffa ? 'CARAFFA' : 'MONODOSE',
        isCaraffa ? '3.0' : '1.0',
        l.deviceId,
        l.timestamp,
        l.eventType,
        l.rssi ?? '',
        l.ip ?? '',
      ];
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvFile(`vending_telemetria_matricole_${dateStr}.csv`, headers, rows);
  };

  const handleConfirmClear = async () => {
    setIsClearing(true);
    try {
      await onClearLogs();
      setShowClearConfirm(false);
    } finally {
      setIsClearing(false);
    }
  };

  // Latest log details for prominent header
  const latestLog = logs[0] || null;
  const latestCanonicalKey = latestLog ? normalizeMatrixKey(latestLog.key) : null;
  const isCaraffaLatest = latestCanonicalKey === 'CARAFFA' || latestLog?.key === 'CARAFFA';
  const isStopLatest = latestCanonicalKey === 'STOP' || latestLog?.key === 'STOP';
  const isLinguaLatest = latestCanonicalKey === 'LINGUA' || latestLog?.key === 'LINGUA';
  const latestProduct = latestLog ? (latestLog.productName || resolveKeyDetails(latestLog.key).associatedProduct) : null;

  return (
    <div id="live-monitor-container" className="space-y-6">
      {/* Top Banner: HIGHLIGHT LATEST KEYPRESS & ASSOCIATED PRODUCT */}
      {latestLog && (
        <div className={`border-2 rounded-3xl p-4 sm:p-5 shadow-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in ${
          isStopLatest
            ? isLight
              ? 'bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 border-red-500/80 shadow-red-500/10'
              : 'bg-gradient-to-r from-red-500/20 via-rose-500/10 to-orange-500/10 border-red-400/60 backdrop-blur-xl shadow-2xl'
            : isCaraffaLatest
            ? isLight
              ? 'bg-gradient-to-r from-amber-50 via-yellow-50 to-cyan-50 border-amber-500/80 shadow-amber-500/10'
              : 'bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-cyan-500/10 border-amber-400/60 backdrop-blur-xl shadow-2xl'
            : isLinguaLatest
            ? isLight
              ? 'bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 border-indigo-500/80 shadow-indigo-500/10'
              : 'bg-gradient-to-r from-indigo-500/20 via-blue-500/10 to-cyan-500/10 border-indigo-400/60 backdrop-blur-xl shadow-2xl'
            : isLight
            ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-blue-50 border-amber-400/80 shadow-amber-500/10'
            : 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-blue-500/10 border-amber-400/40 backdrop-blur-xl shadow-2xl'
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-mono font-black text-white text-base shadow-lg shrink-0 ${
              isStopLatest
                ? 'bg-gradient-to-br from-red-600 to-rose-700 border-red-300 shadow-red-500/40'
                : isCaraffaLatest
                ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-300 shadow-amber-500/40'
                : isLinguaLatest
                ? 'bg-gradient-to-br from-indigo-600 to-blue-700 border-indigo-300 shadow-indigo-500/40'
                : 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-300/80 shadow-amber-500/30'
            }`}>
              {latestCanonicalKey === 'CARAFFA' ? '🏺' : latestCanonicalKey === 'STOP' ? '🛑' : latestCanonicalKey === 'LINGUA' ? '🌐' : latestCanonicalKey}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 ${
                  isStopLatest
                    ? isLight ? 'text-red-800' : 'text-red-300'
                    : isCaraffaLatest
                    ? isLight ? 'text-amber-800' : 'text-amber-300'
                    : isLight ? 'text-amber-800' : 'text-amber-300'
                }`}>
                  <Sparkles className="w-3.5 h-3.5" /> Ultima Lettura Telemetria Live
                </span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {new Date(latestLog.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className={`text-base sm:text-lg font-black flex items-center gap-2 mt-0.5 ${
                isLight ? 'text-slate-900' : 'text-white'
              }`}>
                <span>{isCaraffaLatest ? 'Azione Eseguita:' : isStopLatest ? 'Arresto Eseguito:' : isLinguaLatest ? 'Funzione Eseguita:' : 'Prodotto Erogato:'}</span>
                <span className={`px-2.5 py-0.5 rounded-xl border font-bold ${
                  isStopLatest
                    ? isLight ? 'text-red-900 bg-red-100 border-red-300' : 'text-red-300 bg-red-400/20 border-red-400/40'
                    : isCaraffaLatest
                    ? isLight ? 'text-amber-900 bg-amber-100 border-amber-300' : 'text-amber-300 bg-amber-400/20 border-amber-400/40'
                    : isLinguaLatest
                    ? isLight ? 'text-indigo-900 bg-indigo-100 border-indigo-300' : 'text-indigo-300 bg-indigo-400/20 border-indigo-400/40'
                    : isLight ? 'text-amber-900 bg-amber-100 border-amber-300' : 'text-amber-300 bg-amber-400/15 border-amber-400/30'
                }`}>
                  {latestProduct}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-3 border rounded-2xl px-4 py-2 text-xs ${
            isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-black/40 border-white/10'
          }`}>
            <div>
              <span className={`text-[10px] block ${isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                Distributore Sorgente:
              </span>
              <span className={`font-bold font-mono ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                {latestLog.machineName || latestLog.deviceId}
              </span>
            </div>
            {latestLog.rssi && (
              <span className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                {latestLog.rssi} dBm
              </span>
            )}
          </div>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className={`border rounded-2xl p-5 shadow-sm transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-white shadow-xl'
        }`}>
          <div className={`flex items-center justify-between text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <span className="uppercase tracking-wider font-semibold text-[11px]">Totale Pressioni</span>
            <Database className="w-4 h-4 text-blue-500" />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats?.totalKeypresses ?? logs.length}
          </div>
          <div className={`text-[11px] mt-2 flex items-center gap-1.5 font-medium ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Persistenza DB Attiva
          </div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-white shadow-xl'
        }`}>
          <div className={`flex items-center justify-between text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <span className="uppercase tracking-wider font-semibold text-[11px]">Dispositivi Attivi</span>
            <Wifi className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {stats ? Object.keys(stats.deviceCounts || {}).length : 1}
          </div>
          <div className={`text-[11px] mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Moduli GB-CLOUD Connessi</div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-white shadow-xl'
        }`}>
          <div className={`flex items-center justify-between text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <span className="uppercase tracking-wider font-semibold text-[11px]">Tasto Più Premuto</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono mt-1 ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
            {(() => {
              if (!stats?.keyCounts) return '-';
              const entries = Object.entries(stats.keyCounts) as [string, number][];
              if (entries.length === 0) return '-';
              entries.sort((a, b) => Number(b[1]) - Number(a[1]));
              const canonical = normalizeMatrixKey(entries[0][0]);
              return `${canonical} (${entries[0][1]}x)`;
            })()}
          </div>
          <div className={`text-[11px] mt-2 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Frequenza massima</div>
        </div>

        <div className={`border rounded-2xl p-5 shadow-sm transition-all ${
          isLight ? 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 text-white shadow-xl'
        }`}>
          <div className={`flex items-center justify-between text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <span className="uppercase tracking-wider font-semibold text-[11px]">Ultima Ricezione</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className={`text-sm font-bold font-mono truncate mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {logs[0] ? new Date(logs[0].timestamp).toLocaleTimeString() : 'In attesa...'}
          </div>
          <div className={`text-[11px] mt-2 truncate font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {logs[0] ? `${normalizeMatrixKey(logs[0].key)}: ${logs[0].productName || 'Bevanda'}` : 'Nessun dato'}
          </div>
        </div>
      </div>

      {/* Real-time Hardware & Remote Cloud IoT Bridges (Collassabile per operatore) */}
      <details className={`border rounded-2xl p-4 transition-all group ${
        isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-slate-900/40 border-white/10'
      }`}>
        <summary className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer select-none ${
          isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
        }`}>
          <span className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            Strumenti Diagnostici Avanzati (MQTT, USB Seriale, Polling IP LAN)
          </span>
          <span className="text-[11px] font-normal lowercase tracking-normal text-slate-400 group-open:hidden">
            (opzionale - clicca per aprire)
          </span>
        </summary>

        <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-white/10 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bridge 0: MQTT Remote IoT Cloud */}
        <div className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden transition-all ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-indigo-50 to-slate-50 border-emerald-300'
            : 'bg-gradient-to-r from-emerald-950/50 via-indigo-950/40 to-slate-900/50 border-emerald-500/40'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                  isMqttConnected 
                    ? isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' 
                    : isLight ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-slate-700/30 border-slate-600 text-slate-400'
                }`}>
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className={`text-sm font-bold tracking-wide ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Telemetria Remota MQTT
                    </h3>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      REMOTE IoT
                    </span>
                  </div>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Broker Globale HiveMQ (Zero Firewall / Hotspot 4G)
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isMqttConnected 
                  ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' 
                  : isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isMqttConnected ? '● Cloud Live' : 'Connessione...'}
              </span>
            </div>

            {/* Device ID Config & Status */}
            <div className="mt-3.5 flex items-center gap-2">
              <span className={`text-[11px] font-mono font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Topic:</span>
              <input
                type="text"
                value={mqttDeviceId}
                onChange={(e) => setMqttDeviceId(e.target.value)}
                placeholder="Tutti i moduli rilevati o ID specifico"
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none transition-all ${
                  isLight
                    ? 'bg-white border-emerald-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                    : 'bg-black/40 border-emerald-500/30 text-white focus:border-emerald-400'
                }`}
              />
            </div>

            {/* Last MQTT packet / Heartbeat */}
            {lastMqttPacket && (
              <div className={`mt-2.5 p-2 rounded-xl flex items-center justify-between text-xs border ${
                isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-900' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
              }`}>
                <span className="flex items-center gap-1.5 font-medium truncate">
                  <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  Tasto: <strong className={`font-mono px-1.5 py-0.5 rounded font-bold ${
                    isLight ? 'bg-emerald-200 text-emerald-900' : 'bg-emerald-500/30 text-white'
                  }`}>{lastMqttPacket.canonicalKey || lastMqttPacket.key}</strong>
                  <span className={isLight ? 'text-amber-800 font-semibold' : 'text-amber-300'}>({lastMqttPacket.productName || lastMqttPacket.nomeTasto || 'Prodotto'})</span>
                </span>
                <span className={`text-[10px] font-mono ml-2 whitespace-nowrap ${isLight ? 'text-emerald-800 font-bold' : 'text-emerald-300'}`}>
                  RSSI {lastMqttPacket.rssi || -70}dBm
                </span>
              </div>
            )}

            {mqttHeartbeat && !lastMqttPacket && (
              <div className={`mt-2.5 p-2 rounded-xl flex items-center justify-between text-[11px] border ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-800/40 border-white/5 text-slate-300'
              }`}>
                <span className="flex items-center gap-1.5 font-medium">
                  <Cpu className="w-3 h-3 text-blue-500" />
                  Modulo {mqttHeartbeat.deviceId || 'GB-CLOUD'} ONLINE
                </span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>RAM: {mqttHeartbeat.freeHeap} B</span>
              </div>
            )}
          </div>

          <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[10px] ${
            isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
          }`}>
            <span>Broker: broker.hivemq.com:1883</span>
            <span className={`font-mono font-semibold ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>vending/{mqttDeviceId}/#</span>
          </div>
        </div>

        {/* Bridge 1: WebSerial USB Direct */}
        <div className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
          isLight
            ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-blue-300'
            : 'bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-emerald-900/40 border-blue-500/30'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                  isSerialConnected 
                    ? isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                }`}>
                  <Usb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold tracking-wide flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Bridge Seriale USB
                  </h3>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Lettura diretta cavo USB a 115200 baud
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isSerialConnected 
                  ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-700/60 text-slate-300 border-white/10'
              }`}>
                {isSerialConnected ? '● USB Attivo' : '○ Pronto'}
              </span>
            </div>

            {/* Live USB Keypress Indicator */}
            {lastUsbKey && (
              <div className={`mt-3 p-2.5 rounded-xl flex items-center justify-between text-xs border ${
                isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}>
                <span className="flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Ultimo tasto USB: <strong className={`font-mono px-1.5 py-0.5 rounded font-bold ${
                    isLight ? 'bg-emerald-200 text-emerald-950' : 'bg-emerald-500/30 text-white'
                  }`}>{lastUsbKey}</strong>
                </span>
                <span className={`text-[10px] font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>Registrato</span>
              </div>
            )}
          </div>

          <div className={`flex items-center gap-2 mt-4 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            {isSerialConnected ? (
              <button
                onClick={handleDisconnectUsb}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" /> Disconnetti USB
              </button>
            ) : (
              <button
                onClick={handleConnectUsb}
                className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" /> Connetti USB (1-Click)
              </button>
            )}

            <button
              onClick={() => setShowSerialTerminal(!showSerialTerminal)}
              className={`px-3 py-2 border rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-white/10 hover:bg-white/15 border-white/15 text-slate-200'
              }`}
              title="Apri Console Seriale"
            >
              <Terminal className="w-3.5 h-3.5" /> Console
            </button>
          </div>
        </div>

        {/* Bridge 2: Wi-Fi IP Bridge Rete Locale (172.16.1.200) */}
        <div className={`border rounded-2xl p-5 shadow-sm flex flex-col justify-between transition-all ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-emerald-300'
            : 'bg-gradient-to-r from-emerald-950/40 via-teal-950/30 to-slate-900/40 border-emerald-500/30'
        }`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-inner ${
                  isIpPollingActive 
                    ? isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' 
                    : isLight ? 'bg-teal-100 border-teal-300 text-teal-700' : 'bg-teal-500/20 border-teal-500/50 text-teal-400'
                }`}>
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-sm font-bold tracking-wide flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Bridge Wi-Fi Locale
                  </h3>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Interroga l&apos;IP del Modulo GB-CLOUD sulla LAN locale
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isIpPollingActive 
                  ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300 animate-pulse' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' 
                  : isLight ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-700/60 text-slate-300 border-white/10'
              }`}>
                {isIpPollingActive ? '● Polling Attivo' : '○ Standby'}
              </span>
            </div>

            {/* IP Input bar */}
            <div className="mt-3.5 flex items-center gap-2">
              <span className={`text-xs font-mono font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>IP:</span>
              <input
                type="text"
                value={espIp}
                onChange={(e) => setEspIp(e.target.value)}
                placeholder="172.16.1.200"
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border focus:outline-none transition-all ${
                  isLight
                    ? 'bg-white border-emerald-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
                    : 'bg-black/40 border-white/15 text-white focus:border-teal-400'
                }`}
              />
              <button
                onClick={() => setIsIpPollingActive(!isIpPollingActive)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isIpPollingActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                }`}
              >
                {isIpPollingActive ? 'Stop' : 'Avvia'}
              </button>
            </div>

            {/* Status or last key */}
            {(ipBridgeStatus || lastIpKey) && (
              <div className={`mt-2.5 text-[11px] flex items-center justify-between px-2.5 py-1.5 rounded-lg border truncate ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-black/30 border-white/5 text-slate-300'
              }`}>
                <span className="truncate">{ipBridgeStatus || 'In ascolto...'}</span>
                {lastIpKey && (
                  <span className={`font-semibold font-mono whitespace-nowrap ml-2 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                    {lastIpKey}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] ${
            isLight ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
          }`}>
            <span>Server Web integrato:</span>
            <a 
              href={`http://${espIp}`} 
              target="_blank" 
              rel="noreferrer"
              className={`underline font-mono flex items-center gap-1 text-[11px] ${
                isLight ? 'text-teal-700 hover:text-teal-900 font-semibold' : 'text-teal-300 hover:text-teal-200'
              }`}
            >
              http://{espIp} <Globe className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Live Serial Terminal Console (Inside Diagnostics) */}
      {showSerialTerminal && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-[11px] text-emerald-400 shadow-2xl animate-fade-in mt-4">
          <div className="text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-2 font-bold text-white">
              <Terminal className="w-4 h-4 text-emerald-400" /> Console Monitor Seriale USB (115200 Baud)
            </span>
            <span className="text-slate-400">{serialLogs.length} righe catturate</span>
          </div>
          <div className="h-44 overflow-y-auto space-y-1 mt-2.5 pr-2">
            {serialLogs.length === 0 ? (
              <div className="text-slate-500 italic py-6 text-center">
                In attesa di dati dalla porta seriale USB... Premi un tasto sulla tastiera fisica del distributore!
              </div>
            ) : (
              serialLogs.map((line, idx) => (
                <div key={idx} className="leading-tight break-all">
                  <span className="text-slate-600 select-none">&gt; </span>
                  <span className={line.includes('TASTO') ? 'text-amber-300 font-bold bg-amber-500/20 px-1 rounded' : 'text-emerald-300'}>
                    {line}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  </details>

      {/* Key Frequency Heatmap Grid (P1..P12, STOP, LINGUA) */}
      {stats?.keyCounts && Object.keys(stats.keyCounts).length > 0 && (
        <div className={`border rounded-2xl p-5 shadow-sm space-y-3 transition-all ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 shadow-xl'
        }`}>
          <div className={`text-xs font-semibold uppercase tracking-wider flex items-center justify-between ${
            isLight ? 'text-slate-700' : 'text-slate-300'
          }`}>
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Distribuzione Frequenza Tasti Matrice (P1 - P12, STOP, LINGUA)
            </span>
            <span className={`text-[11px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Database Analytics</span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-14 gap-2">
            {DATA_DISPLAY_KEYS.map((k) => {
              // Aggregate counts matching this canonical key or legacy alias
              let count = stats.keyCounts[k] || 0;
              Object.entries(stats.keyCounts).forEach(([rawKey, val]) => {
                if (rawKey !== k && normalizeMatrixKey(rawKey) === k) {
                  count += Number(val);
                }
              });

              const countList = Object.values(stats.keyCounts) as number[];
              const maxCount = Math.max(...countList, 1);
              const percent = Math.round((count / maxCount) * 100);

              const resolved = resolveKeyDetails(k);

              return (
                <button
                  key={k}
                  onClick={() => setSelectedKeyFilter(selectedKeyFilter === k ? 'ALL' : k)}
                  className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedKeyFilter === k
                      ? isLight
                        ? 'bg-amber-100 border-amber-500 text-amber-900 shadow-md font-bold'
                        : 'bg-amber-500/30 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : isLight
                        ? 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-100'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/10'
                  }`}
                  title={`${k}: ${resolved.associatedProduct || k} (${count} pressioni)`}
                >
                  <span className="font-mono font-bold text-xs">{k}</span>
                  <div className={`w-full h-1.5 rounded-full mt-1.5 overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-white/10'}`}>
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                  <span className={`text-[10px] font-mono mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Database Table Container */}
      <div className={`border rounded-2xl shadow-sm overflow-hidden transition-all ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 backdrop-blur-xl border-white/10 shadow-2xl'
      }`}>
        {/* Table Filters & Actions Header */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'border-slate-200 bg-slate-50/75' : 'border-white/10 bg-white/[0.02]'
        }`}>
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                id="search-keylogs-input"
                type="text"
                placeholder="Cerca Matricola, Cliente, Sede, Tasto, Prodotto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border transition-all ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    : 'bg-black/30 border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400'
                }`}
              />
            </div>

            {/* Filter by Machine / Matricola */}
            <div className="flex items-center gap-1.5">
              <Barcode className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <select
                id="select-machine-filter"
                value={selectedMachineFilter}
                onChange={(e) => {
                  setSelectedMachineFilter(e.target.value);
                }}
                aria-label="Filtra per matricola distributore"
                className={`text-xs rounded-xl px-2.5 py-2 border font-mono transition-all ${
                  isLight
                    ? 'bg-white border-emerald-300 text-slate-900 focus:border-emerald-500'
                    : 'bg-black/30 border-emerald-500/30 text-emerald-200 focus:border-emerald-400'
                }`}
              >
                <option value="ALL">Tutte le Matricole (Tutta la Flotta)</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.serialNumber}>
                    #{m.serialNumber} - {m.name} ({m.model})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Customer */}
            {customerFilterOptions.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Building2 className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                <select
                  id="select-customer-filter"
                  value={selectedCustomerFilter}
                  onChange={(e) => setSelectedCustomerFilter(e.target.value)}
                  aria-label="Filtra per cliente"
                  className={`text-xs rounded-xl px-2.5 py-2 border transition-all ${
                    isLight
                      ? 'bg-white border-blue-300 text-slate-900 focus:border-blue-500'
                      : 'bg-black/30 border-blue-500/30 text-blue-200 focus:border-blue-400'
                  }`}
                >
                  <option value="ALL">Tutti i Clienti</option>
                  {customerFilterOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Quick Preset Filter */}
            <div className="flex items-center gap-1.5">
              <Calendar className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <select
                id="select-date-preset-filter"
                value={quickDatePreset}
                onChange={(e) => handleDatePresetChange(e.target.value)}
                aria-label="Filtra per data"
                className={`text-xs rounded-xl px-2.5 py-2 border transition-all ${
                  quickDatePreset !== 'ALL'
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-bold'
                    : isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                      : 'bg-black/30 border-white/15 text-slate-200 focus:border-emerald-400'
                }`}
              >
                <option value="ALL">Tutte le Date</option>
                <option value="TODAY">Oggi</option>
                <option value="YESTERDAY">Ieri</option>
                <option value="LAST_7_DAYS">Ultimi 7 Giorni</option>
                <option value="THIS_MONTH">Questo Mese</option>
                <option value="CUSTOM">Intervallo Date...</option>
              </select>
            </div>

            {/* Custom Date Range Pickers (shown if custom preset or dates entered) */}
            <div className="flex items-center gap-1.5 text-xs">
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Da:</span>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setQuickDatePreset('CUSTOM');
                  }}
                  className={`text-xs rounded-xl px-2 py-1.5 border font-mono transition-all ${
                    startDateFilter
                      ? isLight
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-bold'
                      : isLight
                        ? 'bg-white border-slate-300 text-slate-700'
                        : 'bg-black/30 border-white/15 text-slate-300'
                  }`}
                />
              </div>

              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>A:</span>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setQuickDatePreset('CUSTOM');
                  }}
                  className={`text-xs rounded-xl px-2 py-1.5 border font-mono transition-all ${
                    endDateFilter
                      ? isLight
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                        : 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 font-bold'
                      : isLight
                        ? 'bg-white border-slate-300 text-slate-700'
                        : 'bg-black/30 border-white/15 text-slate-300'
                  }`}
                />
              </div>
            </div>

            {/* Key Quick Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className={`w-3.5 h-3.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`} />
              <select
                id="select-key-filter"
                value={selectedKeyFilter}
                onChange={(e) => setSelectedKeyFilter(e.target.value)}
                aria-label="Filtra per tasto"
                className={`text-xs rounded-xl px-2.5 py-2 border font-mono transition-all ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    : 'bg-black/30 border-white/15 text-slate-200 focus:border-amber-400'
                }`}
              >
                {filterOptions.map((k) => (
                  <option key={k} value={k} className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                    {k === 'ALL' ? 'Tutti i Tasti' : `Tasto [${k}]`}
                  </option>
                ))}
              </select>
            </div>

            {/* Dose Quick Filter (Mostra solo modalita caraffa / Tutte / Monodose) */}
            <div className="flex items-center gap-1.5">
              <Wine className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-400'}`} />
              <select
                id="select-dose-filter"
                value={selectedDoseFilter}
                onChange={(e) => setSelectedDoseFilter(e.target.value as 'ALL' | 'CARAFFA' | 'MONODOSE')}
                aria-label="Filtra per dose caraffa o monodose"
                className={`text-xs rounded-xl px-2.5 py-2 border font-medium transition-all ${
                  selectedDoseFilter === 'CARAFFA'
                    ? isLight
                      ? 'bg-cyan-100 border-cyan-400 text-cyan-950 font-bold shadow-xs'
                      : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200 font-bold'
                    : isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
                      : 'bg-black/30 border-white/15 text-slate-200 focus:border-amber-400'
                }`}
              >
                <option value="ALL" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                  Tutte le Dosi
                </option>
                <option value="CARAFFA" className={isLight ? 'bg-cyan-50 text-cyan-950 font-bold' : 'bg-slate-900 text-cyan-300 font-bold'}>
                  Mostra solo modalità Caraffa
                </option>
                <option value="MONODOSE" className={isLight ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}>
                  Solo Monodose Standard
                </option>
              </select>
            </div>

            {/* Quick Reset All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  isLight
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                }`}
                title="Ripristina tutti i filtri"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Azzera</span>
              </button>
            )}
          </div>

          {/* Quick Dose Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl border bg-slate-100/80 dark:bg-black/40 border-slate-300 dark:border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDoseFilter('ALL')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer ${
                selectedDoseFilter === 'ALL'
                  ? isLight
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'bg-white/20 text-white shadow-xs'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900'
                    : 'text-slate-400 hover:text-white'
              }`}
            >
              Tutte ({doseStats.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedDoseFilter(selectedDoseFilter === 'MONODOSE' ? 'ALL' : 'MONODOSE')}
              className={`px-2.5 py-1 rounded-xl font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDoseFilter === 'MONODOSE'
                  ? isLight
                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                    : 'bg-amber-500 text-slate-950 shadow-xs font-bold'
                  : isLight
                    ? 'text-amber-800 hover:text-amber-900'
                    : 'text-amber-300 hover:text-amber-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5" />
              <span>Monodose ({doseStats.monodose})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDoseFilter(selectedDoseFilter === 'CARAFFA' ? 'ALL' : 'CARAFFA')}
              className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedDoseFilter === 'CARAFFA'
                  ? isLight
                    ? 'bg-cyan-700 text-white shadow-xs font-black'
                    : 'bg-cyan-400 text-slate-950 shadow-xs font-black'
                  : isLight
                    ? 'text-cyan-800 hover:text-cyan-900'
                    : 'text-cyan-300 hover:text-cyan-200'
              }`}
            >
              <Wine className="w-3.5 h-3.5" />
              <span>Caraffa XL ({doseStats.caraffa})</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              id="refresh-logs-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className={`p-2 border rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
              title="Ricarica dati"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Aggiorna</span>
            </button>

            <button
              id="export-csv-btn"
              onClick={handleExportCsv}
              className={`px-3 py-1.5 border rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-800 font-semibold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
              title="Esporta in CSV"
            >
              <Download className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span>CSV</span>
            </button>

            <button
              id="export-json-btn"
              onClick={handleExportJson}
              className={`px-3 py-1.5 border rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isLight
                  ? 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-800 font-semibold'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
              title="Esporta in JSON"
            >
              <Download className={`w-3.5 h-3.5 ${isLight ? 'text-blue-700' : 'text-blue-400'}`} />
              <span>JSON</span>
            </button>

            <button
              id="clear-db-btn"
              onClick={() => setShowClearConfirm(true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Svuota DB</span>
            </button>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className={`px-4 py-2.5 border-b flex flex-wrap items-center gap-2 text-xs ${
            isLight ? 'bg-amber-50/70 border-slate-200' : 'bg-amber-950/20 border-white/5'
          }`}>
            <span className={`font-semibold flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <Filter className="w-3 h-3" />
              <span>Filtri attivi:</span>
            </span>

            {/* Customer Filter Tag */}
            {selectedCustomerFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                isLight ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
              }`}>
                <Building2 className="w-3 h-3 text-blue-600" />
                <span>Cliente: <strong>{selectedCustomerFilter}</strong></span>
                <button
                  onClick={() => setSelectedCustomerFilter('ALL')}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi filtro cliente"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Machine Filter Tag */}
            {selectedMachineFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                isLight ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                <Barcode className="w-3 h-3 text-emerald-600" />
                <span>Matricola: <strong>#{selectedMachineFilter}</strong></span>
                <button
                  onClick={() => setSelectedMachineFilter('ALL')}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi filtro matricola"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Date Filter Tag */}
            {(startDateFilter || endDateFilter || quickDatePreset !== 'ALL') && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                isLight ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
              }`}>
                <Calendar className="w-3 h-3 text-emerald-600" />
                <span>
                  Data: <strong>
                    {startDateFilter && endDateFilter && startDateFilter === endDateFilter
                      ? startDateFilter
                      : `${startDateFilter || 'inizio'} → ${endDateFilter || 'fine'}`}
                  </strong>
                </span>
                <button
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                    setQuickDatePreset('ALL');
                  }}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi filtro data"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Dose Filter Tag */}
            {selectedDoseFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                selectedDoseFilter === 'CARAFFA'
                  ? isLight
                    ? 'bg-cyan-100 text-cyan-950 border-cyan-300'
                    : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                  : isLight
                    ? 'bg-slate-100 text-slate-900 border-slate-300'
                    : 'bg-white/10 text-slate-200 border-white/20'
              }`}>
                <Wine className="w-3 h-3 text-cyan-600" />
                <span>Dose: <strong>{selectedDoseFilter === 'CARAFFA' ? 'Solo Caraffa' : 'Solo Monodose'}</strong></span>
                <button
                  onClick={() => setSelectedDoseFilter('ALL')}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi filtro dose"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Key Filter Tag */}
            {selectedKeyFilter !== 'ALL' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                isLight ? 'bg-slate-100 text-slate-900 border-slate-300' : 'bg-white/10 text-slate-200 border-white/20'
              }`}>
                <span>Tasto: <strong>[{selectedKeyFilter}]</strong></span>
                <button
                  onClick={() => setSelectedKeyFilter('ALL')}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi filtro tasto"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Search Query Tag */}
            {searchQuery.trim() !== '' && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border font-medium ${
                isLight ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                <Search className="w-3 h-3 text-amber-600" />
                <span>Cerca: &quot;{searchQuery}&quot;</span>
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:opacity-75 p-0.5"
                  title="Rimuovi termine di ricerca"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Count Tag */}
            <span className={`ml-auto font-mono text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <strong>{filteredLogs.length}</strong> su <strong>{logs.length}</strong> record trovati
            </span>

            <button
              onClick={handleClearAllFilters}
              className={`underline text-xs font-semibold hover:opacity-80 transition-opacity ml-1 cursor-pointer ${
                isLight ? 'text-rose-700' : 'text-rose-400'
              }`}
            >
              Azzera tutti i filtri
            </button>
          </div>
        )}

        {/* Database Table with Highlighted Matricola, Cliente and Sede */}
        <div className="overflow-x-auto">
          <table className={`w-full text-left text-xs ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
            <thead className={`font-bold border-b uppercase text-[11px] tracking-wider ${
              isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-white/[0.03] text-slate-300 border-white/10'
            }`}>
              <tr>
                <th className="py-3.5 px-4">Matricola &amp; Distributore</th>
                <th className="py-3.5 px-4">Cliente &amp; Sede Operativa</th>
                <th className="py-3.5 px-4">Tasto Matrice</th>
                <th className="py-3.5 px-4">Prodotto Erogato</th>
                <th className="py-3.5 px-4 text-center">Tipo Dose</th>
                <th className="py-3.5 px-4">Timestamp &amp; Orario</th>
                <th className="py-3.5 px-4">Segnale &amp; Rete</th>
                <th className="py-3.5 px-4 text-right">ID Record</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-mono ${isLight ? 'divide-slate-200' : 'divide-white/5'}`}>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 font-sans">
                    <Database className={`w-8 h-8 mx-auto mb-2 opacity-50 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                    <p className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>Nessuna lettura trovata</p>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Nessun record corrisponde ai filtri selezionati (Cliente, Matricola Macchina, Data o Tasto).
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={handleClearAllFilters}
                        className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Ripristina tutti i filtri</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => {
                  const canonicalKey = normalizeMatrixKey(log.key);
                  const isProduct = canonicalKey.startsWith('P');
                  const isCaraffaDose = Boolean(
                    log.isCaraffa ||
                    log.doseType === 'CARAFFA' ||
                    (log.productName && log.productName.toLowerCase().includes('caraffa')) ||
                    (log.keyLabel && log.keyLabel.toLowerCase().includes('erogazione caraffa'))
                  );
                  const isCaraffa = canonicalKey === 'CARAFFA' || isCaraffaDose;
                  const isStop = canonicalKey === 'STOP';
                  const isLingua = canonicalKey === 'LINGUA';

                  let badgeColor = isLight 
                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold' 
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30';
                  if (isCaraffa) badgeColor = isLight ? 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
                  if (isStop) badgeColor = isLight ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold' : 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                  if (isLingua) badgeColor = isLight ? 'bg-blue-100 text-blue-900 border-blue-300 font-bold' : 'bg-blue-500/20 text-blue-300 border-blue-500/40';

                  // Resolve product name and wire connections
                  const resolved = resolveKeyDetails(canonicalKey);
                  const productName = log.productName || resolved.associatedProduct;

                  const dateObj = new Date(log.timestamp);
                  const timeFormatted = dateObj.toLocaleTimeString();
                  const dateFormatted = dateObj.toLocaleDateString();

                  // Serial number fallback
                  const serialNum = log.machineSerialNumber || '104829';
                  const custName = log.customerName || 'IVS Italia S.p.A.';
                  const siteName = log.siteName || 'Sede Principale';

                  return (
                    <tr
                      key={`${log.id || 'log'}-${log.timestamp || ''}-${idx}`}
                      className={`transition-colors ${
                        isLight
                          ? idx === 0 ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                          : idx === 0 ? 'bg-amber-500/10' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* 1. Matricola & Distributore (PROMINENTLY HIGHLIGHTED) */}
                      <td className="py-2.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-xl border font-mono font-extrabold text-xs shadow-xs ${
                              isLight
                                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                            }`}
                          >
                            <Barcode className="w-3.5 h-3.5 text-emerald-600" />
                            #{serialNum}
                          </span>
                          <div>
                            <span className={`font-bold text-xs block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {log.machineName || 'Distributore Bevande'}
                            </span>
                            <span className={`text-[10px] font-mono block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                              ID: {log.deviceId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Cliente & Sede Operativa (PROMINENTLY HIGHLIGHTED) */}
                      <td className="py-2.5 px-4 font-sans">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <Building2 className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                            <span className={`font-bold text-xs truncate max-w-[200px] ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                              {custName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 pl-0.5">
                            <MapPin className={`w-3 h-3 shrink-0 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
                            <span className={`text-[11px] font-medium truncate max-w-[220px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                              {siteName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Tasto Matrice Badge */}
                      <td className="py-2.5 px-4 font-bold text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center px-2 py-1 rounded-xl border font-mono font-bold text-xs shadow-xs ${badgeColor}`}
                          >
                            {canonicalKey}
                          </span>
                          <span className={`text-[10px] font-mono hidden sm:inline ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            {resolved.wirePins}
                          </span>
                        </div>
                      </td>

                      {/* 4. Prodotto Associato */}
                      <td className="py-2.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
                            isLight
                              ? 'bg-amber-100 border-amber-300 text-amber-800'
                              : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                          }`}>
                            {isCaraffa ? (
                              <Wine className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`} />
                            ) : isStop ? (
                              <Octagon className={`w-3.5 h-3.5 ${isLight ? 'text-rose-700' : 'text-rose-300'}`} />
                            ) : isLingua ? (
                              <Languages className={`w-3.5 h-3.5 ${isLight ? 'text-blue-700' : 'text-blue-300'}`} />
                            ) : (
                              <Coffee className={`w-3.5 h-3.5 ${isLight ? 'text-amber-800' : 'text-amber-300'}`} />
                            )}
                          </div>
                          <div>
                            <span className={`font-bold text-xs block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {productName}
                            </span>
                            <span className={`text-[10px] font-mono block ${isLight ? 'text-amber-800 font-semibold' : 'text-amber-400'}`}>
                              {log.keyLabel || (isProduct ? `Erogazione Prodotto ${canonicalKey}` : 'Comando Hardware')}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 5. Tipo Dose (Caraffa vs Monodose) */}
                      <td className="py-2.5 px-4 font-sans text-center">
                        {isCaraffaDose ? (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold shadow-xs ${
                              isLight
                                ? 'bg-cyan-100 text-cyan-950 border-cyan-300'
                                : 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40'
                            }`}
                          >
                            <Wine className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                            <span>Caraffa</span>
                          </span>
                        ) : isStop || isLingua ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-mono ${
                              isLight
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : 'bg-white/5 text-slate-400 border-white/10'
                            }`}
                          >
                            <span>Hardware</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-medium ${
                              isLight
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-white/5 text-slate-300 border-white/10'
                            }`}
                          >
                            <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Monodose</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Timestamp & Orario */}
                      <td className="py-2.5 px-4 font-sans">
                        <div className={`font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>{timeFormatted}</div>
                        <div className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{dateFormatted}</div>
                      </td>

                      {/* 6. Segnale & Rete */}
                      <td className="py-2.5 px-4 font-sans">
                        <div className="space-y-0.5">
                          {log.rssi !== undefined ? (
                            <span
                              className={`text-xs font-bold block ${
                                log.rssi > -65
                                  ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                                  : log.rssi > -80
                                  ? isLight ? 'text-amber-700' : 'text-amber-400'
                                  : isLight ? 'text-rose-700' : 'text-rose-400'
                              }`}
                            >
                              {log.rssi} dBm
                            </span>
                          ) : (
                            <span className={isLight ? 'text-slate-400' : 'text-slate-500'}>WiFi: -</span>
                          )}
                          <span className={`text-[10px] font-mono block ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            {log.ip || '192.168.1.xxx'}
                          </span>
                        </div>
                      </td>

                      {/* 7. ID Record */}
                      <td className={`py-2.5 px-4 text-right text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {log.id.substring(0, 10)}...
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className={`p-3.5 border-t text-xs flex items-center justify-between ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-black/20 border-white/10 text-slate-400'
        }`}>
          <span className="font-medium">Mostrati {filteredLogs.length} di {logs.length} record memorizzati</span>
          <span className={`flex items-center gap-1.5 font-semibold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Server-Sent Events (SSE) Live Feed Connesso
          </span>
        </div>
      </div>

      {/* Modal Confirmation Clear DB */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-slate-300 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white'
          }`}>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Svuotare il Database?</h3>
              <p className={`text-xs mt-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Stai per eliminare tutti i {logs.length} log delle letture della tastiera dal database. Questa operazione non può essere annullata.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className={`flex-1 border py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                onClick={handleConfirmClear}
                disabled={isClearing}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-lg cursor-pointer"
              >
                {isClearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Conferma Eliminazione</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
