import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Cpu,
  Layers,
  Terminal,
  Activity,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Radio,
  Gauge,
  Thermometer,
  Droplets,
  Flame,
  ArrowRight,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { computePowderSchedule, PowderSchedule } from '../utils/powderPulsing';

interface ChannelCalibration {
  id: number;
  name: string;
  evName: string;
  canisterName: string;
  T_waterSec: number;        // T = tempo totale acqua (sec)
  T1_headSec: number;        // T1 = testa (sec sola acqua)
  T2_tailSec: number;        // T2 = coda (sec sola acqua)
  TonTot_powderSec: number;  // tempo utile marcia coclea (sec)
  targetPulses: number;      // numero impulsi target
  Tmi_ms: number;            // valore minimo impulso (ms)
  mixerPostSec: number;      // post-lavaggio mixer
}

export const OptaLabView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Stato Tab
  const [activeTab, setActiveTab] = useState<'control' | 'registers' | 'sketch'>('control');
  const [copiedSketch, setCopiedSketch] = useState(false);

  // Parametri Caldaia e Riempimento Vaso Aperto
  const [boilerTemp, setBoilerTemp] = useState<number>(92.4);
  const [targetTemp, setTargetTemp] = useState<number>(92.0);
  const [isWaterLevelOk, setIsWaterLevelOk] = useState<boolean>(true);
  const [isFilling, setIsFilling] = useState<boolean>(false);
  const [totalLiters, setTotalLiters] = useState<number>(142.8);
  const [lastFillPulses, setLastFillPulses] = useState<number>(230);
  const [ssrHeatingActive, setSsrHeatingActive] = useState<boolean>(true);

  // 4 Vie con valori esatti da tabella di taratura della macchina
  const [channels, setChannels] = useState<ChannelCalibration[]>([
    {
      id: 1,
      name: 'Via 1 - Caffè Espresso',
      evName: 'EV1 (Acqua Caffè)',
      canisterName: 'Coclea 1 (Caffè Solubile)',
      T_waterSec: 3.5,
      T1_headSec: 0.6,
      T2_tailSec: 0.8,
      TonTot_powderSec: 2.1,
      targetPulses: 3,
      Tmi_ms: 300,
      mixerPostSec: 0.5,
    },
    {
      id: 2,
      name: 'Via 2 - Latte Scremato / Schiuma',
      evName: 'EV2 (Acqua Latte)',
      canisterName: 'Coclea 2 (Latte Polvere)',
      T_waterSec: 6.0,
      T1_headSec: 1.0,
      T2_tailSec: 1.5,
      TonTot_powderSec: 3.5,
      targetPulses: 4,
      Tmi_ms: 300,
      mixerPostSec: 0.8,
    },
    {
      id: 3,
      name: 'Via 3 - Cioccolato Caldo Denso',
      evName: 'EV3 (Acqua Cioccolato)',
      canisterName: 'Coclea 3 (Cioccolato 200 RPM)',
      T_waterSec: 8.5,
      T1_headSec: 1.2,
      T2_tailSec: 1.8,
      TonTot_powderSec: 4.5,
      targetPulses: 5,
      Tmi_ms: 350,
      mixerPostSec: 1.0,
    },
    {
      id: 4,
      name: 'Via 4 - The al Limone',
      evName: 'EV4 (Acqua The)',
      canisterName: 'Coclea 4 (The Solubile Limone)',
      T_waterSec: 7.5,
      T1_headSec: 1.0,
      T2_tailSec: 1.5,
      TonTot_powderSec: 3.8,
      targetPulses: 4,
      Tmi_ms: 300,
      mixerPostSec: 0.8,
    },
  ]);

  // Stato Erogazione Live
  const [dispensingChannel, setDispensingChannel] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const [currentSchedule, setCurrentSchedule] = useState<PowderSchedule | null>(null);

  // Log RS-485
  const [busLogs, setBusLogs] = useState<Array<{ time: string; dir: 'TX' | 'RX'; text: string }>>([
    { time: '12:45:01', dir: 'TX', text: 'ESP32 -> OPTA [Modbus RTU]: Read Input Regs (30001..30008)' },
    { time: '12:45:02', dir: 'RX', text: 'OPTA -> ESP32: Temp=92.4°C, Level=OK, TotalWater=142.8L, Status=READY' },
  ]);

  const addBusLog = (dir: 'TX' | 'RX', text: string) => {
    const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setBusLogs((prev) => [{ time, dir, text }, ...prev.slice(0, 40)]);
  };

  const handleSimulateFillWater = () => {
    if (isFilling) return;
    setIsFilling(true);
    setIsWaterLevelOk(false);
    addBusLog('TX', 'OPTA Event: Livello sceso sotto la soglia -> Apertura EV IN (Relè Espansione O1) & Blocco SSR Resistenze');
    
    setTimeout(() => {
      setIsWaterLevelOk(true);
      setIsFilling(false);
      const addedLiters = 0.45;
      const pulses = Math.round(addedLiters * 1000);
      setTotalLiters((prev) => parseFloat((prev + addedLiters).toFixed(2)));
      setLastFillPulses(pulses);
      addBusLog('RX', `OPTA Event: Sonda Livello Pieno rilevata -> Chiusura EV IN. Flowmeter: ${pulses} impulsi (+${addedLiters}L). Total: ${(totalLiters + addedLiters).toFixed(2)}L`);
    }, 2500);
  };

  const handleStartDispense = (ch: ChannelCalibration) => {
    if (dispensingChannel !== null) return;

    // Calcolo schedulazione con la formula del file di taratura
    const sched = computePowderSchedule(
      ch.T_waterSec,
      ch.T1_headSec,
      ch.T2_tailSec,
      ch.TonTot_powderSec,
      ch.Tmi_ms,
      ch.targetPulses
    );

    setCurrentSchedule(sched);
    setDispensingChannel(ch.id);
    setElapsedMs(0);

    addBusLog('TX', `ESP32 -> OPTA: [CMD_START] Via ${ch.id} | T=${sched.T_totalWaterMs}ms | T1=${sched.T1_headWaterMs}ms | T2=${sched.T2_tailWaterMs}ms | T4=${sched.T4_powderWindowMs}ms | Coclea ${sched.TonTot_powderMs}ms in ${sched.pulseCount} impulsi (Tmi=${sched.Tmi_minPulseMs}ms)`);

    const totalCycleMs = sched.T_totalWaterMs + Math.round(ch.mixerPostSec * 1000);

    const interval = setInterval(() => {
      setElapsedMs((prev) => {
        const next = prev + 50;
        if (next >= totalCycleMs) {
          clearInterval(interval);
          setDispensingChannel(null);
          setCurrentSchedule(null);
          addBusLog('RX', `OPTA -> ESP32: Ciclo Via ${ch.id} terminato regolarmente in ${next}ms.`);
          return 0;
        }
        return next;
      });
    }, 50);
  };

  const handleEmergencyStop = () => {
    setDispensingChannel(null);
    setCurrentSchedule(null);
    setIsFilling(false);
    addBusLog('TX', 'ESP32 -> OPTA: [EMERGENCY STOP] Spegnimento immediato tutte le EV, Coclee e Mixer.');
  };

  const arduinoSketchCode = `/*
 * ==============================================================================
 * ARDUINO OPTA ADVANCED (8A.04) + ESPANSIONI (8A.58 + 8A.26)
 * ALGORITMO DI DOSAGGIO POLVERI A IMPULSI CON VINCOLO Tmi (DA TABELLA TARATURA)
 * ==============================================================================
 *
 * FORMULE DI DOSAGGIO:
 * T   = Tempo Totale Acqua (ms)
 * T1  = Testa: Tempo Iniziale di Sola Acqua (ms)
 * T2  = Coda:  Tempo Finale di Sola Acqua (ms)
 * T4  = Finestra Utile Polvere = T - T1 - T2 (ms)
 * TonTot = Tempo Effettivo Marcia Coclea (ms)
 * Tmi = Valore Minimo Impulso (ms) (se residuo < Tmi viene sommato al precedente)
 * ==============================================================================
 */

#include <ArduinoRS485.h>
#include <ArduinoModbus.h>

// Mappatura Ingressi
const int PIN_FLOWMETER    = A0; // I1: Flussimetro ingresso caldaia
const int PIN_LEVEL_SENSOR = A1; // I2: Sonda livello vaso aperto
const int PIN_TEMP_SENSOR  = A2; // I3: Sonda temperatura NTC / 0..10V

// Struttura Schedulazione Coclea
struct Pulse {
  unsigned long startMs;
  unsigned long durationMs;
};

struct Recipe {
  int channel;
  unsigned long T_waterMs;
  unsigned long T1_headMs;
  unsigned long T2_tailMs;
  unsigned long TonTotMs;
  unsigned long Tmi_ms;
  int targetPulses;
  unsigned long mixerPostMs;
};

// Calcolo dinamico degli impulsi con vincolo Tmi
int calcolaImpulsiCoclea(const Recipe& r, Pulse outPulses[], int maxPulses) {
  unsigned long T4 = (r.T_waterMs > (r.T1_headMs + r.T2_tailMs)) 
                     ? (r.T_waterMs - r.T1_headMs - r.T2_tailMs) : 0;
  if (T4 == 0 || r.TonTotMs == 0) return 0;

  unsigned long clampedTon = min(r.TonTotMs, T4);
  int N = max(1, r.targetPulses);

  // Riduci N se ogni impulso risulterebbe < Tmi
  while (N > 1 && (clampedTon / N) < r.Tmi_ms) {
    N--;
  }
  if (N > maxPulses) N = maxPulses;

  unsigned long baseDur = clampedTon / N;
  unsigned long remainder = clampedTon - (baseDur * N);

  unsigned long durations[8];
  for (int i = 0; i < N; i++) durations[i] = baseDur;

  // Se il resto è inferiore a Tmi, viene allegato all'ultimo impulso
  if (remainder > 0) {
    durations[N - 1] += remainder;
  }

  // Calcolo pause tra impulsi distribuite nello spazio utile T4
  unsigned long totalPause = (T4 > clampedTon) ? (T4 - clampedTon) : 0;
  unsigned long pauseBetween = (N > 1) ? (totalPause / (N - 1)) : 0;

  unsigned long currentStart = r.T1_headMs;
  for (int i = 0; i < N; i++) {
    outPulses[i].startMs = currentStart;
    outPulses[i].durationMs = durations[i];
    currentStart += durations[i] + pauseBetween;
  }

  return N;
}

void setup() {
  Serial.begin(115200);
  ModbusRTUServer.begin(1, 115200, SERIAL_8N1);

  // Uscite EV 1..4 Relè Base
  pinMode(D0, OUTPUT);
  pinMode(D1, OUTPUT);
  pinMode(D2, OUTPUT);
  pinMode(D3, OUTPUT);
}

void loop() {
  ModbusRTUServer.poll();
  // Gestione ciclo non bloccante con millis()
}
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(arduinoSketchCode);
    setCopiedSketch(true);
    setTimeout(() => setCopiedSketch(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className={`p-6 rounded-3xl border transition-all ${
        isLight
          ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-white border-amber-200 shadow-sm'
          : 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/30 shadow-xl'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Arduino Opta R&amp;D Lab &bull; Logica Impulsi Coclea &amp; Caldaia
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 border border-amber-500/30">
                  SPAZIO PROGETTO SEPARATO
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Algoritmo di dosaggio con tempi da tabella di taratura: <strong>T</strong> (acqua totale), <strong>T1</strong> (testa sola acqua), <strong>T2</strong> (coda sola acqua), <strong>T4 = T - T1 - T2</strong> (finestra coclea a impulsi con vincolo <strong>Tmi</strong>).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('control')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'control'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : isLight ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Banco Prova &amp; Dinamica Impulsi
            </button>
            <button
              onClick={() => setActiveTab('registers')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'registers'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : isLight ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Mappa Registri RS-485
            </button>
            <button
              onClick={() => setActiveTab('sketch')}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                activeTab === 'sketch'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : isLight ? 'bg-white text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Sketch C++ Arduino Opta
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'control' && (
        <>
          {/* Box Spiegazione Formula Ingegneristica */}
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
            isLight ? 'bg-blue-50/80 border-blue-200 text-blue-950' : 'bg-blue-950/20 border-blue-500/20 text-blue-200'
          }`}>
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="text-xs">
                <strong>Formula Dinamica Coclea Polvere:</strong> Finestra Utile <span className="font-mono font-bold">T4 = T - T1 - T2</span>. La marcia della coclea <span className="font-mono font-bold">Ton_tot</span> viene divisa in impulsi intervallati da pause all'interno di T4 per prevenire grumi e intasamenti. Se l'ultimo impulso o il resto è inferiore a <span className="font-mono font-bold">Tmi</span>, viene <strong>allegato/sommato all'impulso precedente</strong>.
              </div>
            </div>
          </div>

          {/* Caldaia & Flowmeter Status Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Caldaia Vaso Aperto */}
            <div className={`p-5 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-rose-500" />
                  <h2 className="text-sm font-bold">Caldaia a Vaso Aperto</h2>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  isWaterLevelOk ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-600 border border-rose-500/30 animate-pulse'
                }`}>
                  {isWaterLevelOk ? 'Livello Vaso OK' : 'Livello Vaso Basso'}
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Temperatura Caldaia:</span>
                  <span className="text-lg font-bold font-mono text-rose-500">{boilerTemp.toFixed(1)} °C</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">2x SSR Resistenze:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    isWaterLevelOk && ssrHeatingActive ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}>
                    {isWaterLevelOk && ssrHeatingActive ? 'ATTIVE (PID Sonda I3)' : 'BLOCCATE (Sicurezza Livello I2)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">EV Ingresso Acqua:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[11px] ${isFilling ? 'bg-blue-500/20 text-blue-600 animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                    {isFilling ? 'APERTA (Carico Vaso)' : 'CHIUSA'}
                  </span>
                </div>

                <button
                  onClick={handleSimulateFillWater}
                  disabled={isFilling}
                  className="w-full mt-2 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Droplets className="w-3.5 h-3.5" />
                  <span>{isFilling ? 'Riempimento vaso in corso...' : 'Simula Calo Livello & Ricarica'}</span>
                </button>
              </div>
            </div>

            {/* Flowmeter Ingresso */}
            <div className={`p-5 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-blue-500" />
                  <h2 className="text-sm font-bold">Flowmeter Ingresso (I1)</h2>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Contatore Rete</span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Acqua Totale Caricata:</span>
                  <span className="text-lg font-bold font-mono text-blue-500">{totalLiters.toFixed(2)} Litri</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Impulsi Ultimo Ciclo:</span>
                  <span className="font-mono font-bold">{lastFillPulses} impulsi</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Stato Filtro Anticalcare:</span>
                  <span className="font-bold text-emerald-500">89% Residuo (Soglia 1500L)</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: '11%' }}></div>
                </div>
              </div>
            </div>

            {/* Monitor RS-485 */}
            <div className={`p-5 rounded-3xl border flex flex-col justify-between ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-amber-500" />
                    <h2 className="text-sm font-bold">Monitor Bus RS-485 Modbus</h2>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600">115200 8N1</span>
                </div>

                <div className="mt-2.5 space-y-1 max-h-36 overflow-y-auto font-mono text-[10px] p-2 rounded-xl bg-slate-950 text-slate-200">
                  {busLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-1.5">
                      <span className="text-slate-500">{log.time}</span>
                      <span className={log.dir === 'TX' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>[{log.dir}]</span>
                      <span className="break-all">{log.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
                <button
                  onClick={() => addBusLog('TX', 'ESP32 Ping: Modbus Poll Holding Regs OK')}
                  className="text-xs text-blue-500 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Poll Bus
                </button>
                <button
                  onClick={handleEmergencyStop}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                >
                  Stop Emergenza
                </button>
              </div>
            </div>
          </div>

          {/* Test 4 Vie con Algoritmo Impulsi Dinamico */}
          <div className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
              <div>
                <h2 className="text-base font-bold">Banco Prova 4 Vie: Esecuzione Impulsi Coclea (Taratura Reale)</h2>
                <p className="text-xs text-slate-500">
                  Visualizzazione del timing in tempo reale: la coclea eroga solo durante <strong>T4</strong> spezzata in impulsi anti-intasamento.
                </p>
              </div>

              {dispensingChannel !== null && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-amber-500 animate-pulse font-mono">
                    VIA {dispensingChannel} ATTIVA: {elapsedMs} ms
                  </span>
                  <button
                    onClick={handleEmergencyStop}
                    className="px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
              {channels.map((ch) => {
                const sched = computePowderSchedule(
                  ch.T_waterSec,
                  ch.T1_headSec,
                  ch.T2_tailSec,
                  ch.TonTot_powderSec,
                  ch.Tmi_ms,
                  ch.targetPulses
                );

                const isCurrent = dispensingChannel === ch.id;
                const isWaterOn = isCurrent && elapsedMs < sched.T_totalWaterMs;
                const isMixerOn = isCurrent && elapsedMs < (sched.T_totalWaterMs + Math.round(ch.mixerPostSec * 1000));

                // Verifica se la coclea è in uno dei suoi impulsi attivi
                const isPowderPulseActive = isCurrent && sched.pulses.some(
                  (p) => elapsedMs >= p.startMs && elapsedMs < (p.startMs + p.durationMs)
                );

                return (
                  <div
                    key={ch.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                        : isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-blue-500/15 text-blue-600">VIA {ch.id}</span>
                      <span className="text-xs font-bold">{ch.name.split(' - ')[1]}</span>
                    </div>

                    <div className="text-[11px] text-slate-500 mb-3 space-y-0.5">
                      <div>Valvola: <strong className="text-slate-700 dark:text-slate-300">{ch.evName}</strong></div>
                      <div>Dosatore: <strong className="text-slate-700 dark:text-slate-300">{ch.canisterName}</strong></div>
                    </div>

                    {/* Parametri di Taratura */}
                    <div className="p-2.5 rounded-xl bg-slate-200/50 dark:bg-slate-900/50 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">T (Acqua):</span>
                        <span className="font-bold">{sched.T_totalWaterMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">T1 (Testa):</span>
                        <span className="text-blue-500 font-bold">{sched.T1_headWaterMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">T2 (Coda):</span>
                        <span className="text-blue-500 font-bold">{sched.T2_tailWaterMs} ms</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-300 dark:border-white/10 pt-1">
                        <span className="text-slate-500">T4 (Finestra Polvere):</span>
                        <span className="text-amber-500 font-bold">{sched.T4_powderWindowMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Coclea Marcia:</span>
                        <span className="font-bold">{sched.TonTot_powderMs} ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Impulsi Schedulati:</span>
                        <span className="font-bold text-emerald-500">{sched.pulseCount} treni (Tmi={sched.Tmi_minPulseMs}ms)</span>
                      </div>
                    </div>

                    {/* Timeline Visiva degli Impulsi */}
                    <div className="mt-3">
                      <div className="text-[10px] text-slate-400 mb-1 flex justify-between">
                        <span>Timeline T4:</span>
                        <span>{sched.pulses.map((p, i) => `${p.durationMs}ms`).join(' + ')}</span>
                      </div>
                      <div className="w-full bg-slate-300 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden flex relative">
                        {sched.pulses.map((p, pIdx) => {
                          const widthPct = (p.durationMs / sched.T4_powderWindowMs) * 100;
                          return (
                            <div
                              key={pIdx}
                              style={{ width: `${widthPct}%`, marginRight: sched.pauseBetweenMs > 0 ? '4px' : '0' }}
                              className="bg-amber-500 h-full rounded-xs"
                              title={`Impulso ${pIdx + 1}: ${p.durationMs} ms`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Indicatori Attuatori Fisici */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-200 dark:border-white/10 text-center">
                      <div className={`p-1 rounded text-[10px] font-bold ${isWaterOn ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        EV Acqua
                      </div>
                      <div className={`p-1 rounded text-[10px] font-bold ${isPowderPulseActive ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        Coclea IMP
                      </div>
                      <div className={`p-1 rounded text-[10px] font-bold ${isMixerOn ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                        Mixer
                      </div>
                    </div>

                    <button
                      onClick={() => handleStartDispense(ch)}
                      disabled={dispensingChannel !== null}
                      className={`w-full mt-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        dispensingChannel !== null
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Eroga Test Via {ch.id}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {activeTab === 'registers' && (
        <div className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
          <h2 className="text-base font-bold mb-1">Mappa Registri Modbus RTU per Dinamica a Impulsi (Slave ID: 1)</h2>
          <p className="text-xs text-slate-500 mb-6">
            L'ESP32 passa a Opta i valori <span className="font-mono">T, T1, T2, TonTot, N_pulsi, Tmi</span> desunti direttamente dalla taratura per eseguire la sequenza anti-intasamento a bordo.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">
                Holding Registers &bull; Parametri Dinamica (ESP32 &rarr; Opta)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
                      <th className="py-2">Indirizzo</th>
                      <th className="py-2">Nome Registro</th>
                      <th className="py-2">Unità</th>
                      <th className="py-2">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    <tr><td className="py-2 text-amber-600">40001</td><td>CMD_EXECUTE</td><td>0..2</td><td className="font-sans">0: IDLE, 1: Avvia, 2: Stop</td></tr>
                    <tr><td className="py-2 text-amber-600">40002</td><td>PARAM_CHANNEL</td><td>1..4</td><td className="font-sans">Numero via da erogare</td></tr>
                    <tr><td className="py-2 text-amber-600">40003</td><td>PARAM_T_WATER_MS</td><td>ms</td><td className="font-sans">Tempo totale acqua (T)</td></tr>
                    <tr><td className="py-2 text-amber-600">40004</td><td>PARAM_T1_HEAD_MS</td><td>ms</td><td className="font-sans">Testa pre-bagnatura (T1)</td></tr>
                    <tr><td className="py-2 text-amber-600">40005</td><td>PARAM_T2_TAIL_MS</td><td>ms</td><td className="font-sans">Coda risciacquo (T2)</td></tr>
                    <tr><td className="py-2 text-amber-600">40006</td><td>PARAM_TON_TOT_MS</td><td>ms</td><td className="font-sans">Tempo effettivo coclea (TonTot)</td></tr>
                    <tr><td className="py-2 text-amber-600">40007</td><td>PARAM_TARGET_PULSES</td><td>1..8</td><td className="font-sans">Numero impulsi desiderati</td></tr>
                    <tr><td className="py-2 text-amber-600">40008</td><td>PARAM_TMI_MIN_MS</td><td>ms</td><td className="font-sans">Valore minimo impulso (Tmi)</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-500">
                Input Registers &bull; Stato Real-Time (Opta &rarr; ESP32)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500">
                      <th className="py-2">Indirizzo</th>
                      <th className="py-2">Nome Registro</th>
                      <th className="py-2">Formato</th>
                      <th className="py-2">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono">
                    <tr><td className="py-2 text-emerald-600">30001</td><td>STATUS_SYSTEM</td><td>0..9</td><td className="font-sans">0: Ready, 1: Erogazione, 2: Carico</td></tr>
                    <tr><td className="py-2 text-emerald-600">30002</td><td>CURRENT_TEMP</td><td>Decimi °C</td><td className="font-sans">Temperatura reale caldaia</td></tr>
                    <tr><td className="py-2 text-emerald-600">30003</td><td>LEVEL_SENSOR_OK</td><td>1 / 0</td><td className="font-sans">Stato galleggiante vaso</td></tr>
                    <tr><td className="py-2 text-emerald-600">30004</td><td>TOTAL_WATER_LITERS</td><td>Litri</td><td className="font-sans">Flussimetro ingresso totale</td></tr>
                    <tr><td className="py-2 text-emerald-600">30005</td><td>ACTIVE_PULSE_INDEX</td><td>1..N</td><td className="font-sans">Indice impulso coclea corrente</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sketch' && (
        <div className={`p-6 rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-white/10'}`}>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-white/10">
            <div>
              <h2 className="text-base font-bold">Sketch C++ per Arduino Opta (Algoritmo Impulsi &amp; Caldaia)</h2>
              <p className="text-xs text-slate-500">
                Include la funzione <span className="font-mono">calcolaImpulsiCoclea()</span> che implementa la formula T, T1, T2, T4 e l'allegamento del residuo a Tmi.
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-all"
            >
              {copiedSketch ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSketch ? 'Copiato!' : 'Copia Sketch'}</span>
            </button>
          </div>

          <div className="mt-4 p-4 rounded-2xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto max-h-[500px]">
            <pre>{arduinoSketchCode}</pre>
          </div>
        </div>
      )}
    </div>
  );
};
