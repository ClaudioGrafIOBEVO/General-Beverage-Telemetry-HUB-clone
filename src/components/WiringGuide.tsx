import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  Cpu,
  AlertTriangle,
  CheckCircle,
  Zap,
  Cable,
  ShieldAlert,
  Sliders,
  Sparkles,
  Layers,
  ArrowRight,
  Calculator,
  Flame,
  Radio,
  Check,
  Info
} from 'lucide-react';

export const WiringGuide: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [selectedPin, setSelectedPin] = useState<number | null>(null);

  // Active Board Selector (Freenove ESP32-S3 vs Freenove S2 vs WROOM-32)
  const [selectedBoard, setSelectedBoard] = useState<'freenove_s3' | 'freenove_s2' | 'wroom32'>('freenove_s3');

  // Connection Topology Mode (Parallelo vs In Serie / Gateway vs Diretto)
  const [topologyMode, setTopologyMode] = useState<'parallel_sniff' | 'series_gateway' | 'full_direct'>('parallel_sniff');

  // 12V Voltage Shifting Active Tab
  const [voltageMethod, setVoltageMethod] = useState<'opto' | 'divider' | 'dry_passive'>('opto');

  // Interactive Voltage Divider Calculator state
  const [inputVin, setInputVin] = useState<number>(12);
  const [resistorR1, setResistorR1] = useState<number>(10000); // 10 kOhm
  const [resistorR2, setResistorR2] = useState<number>(3900);  // 3.9 kOhm

  // Calculated values
  const calculatedVout = (inputVin * resistorR2) / (resistorR1 + resistorR2);
  const currentDrawMa = (inputVin / (resistorR1 + resistorR2)) * 1000;
  const powerR1Mw = Math.pow(currentDrawMa / 1000, 2) * resistorR1 * 1000;
  const powerR2Mw = Math.pow(currentDrawMa / 1000, 2) * resistorR2 * 1000;

  const isVoutSafe = calculatedVout >= 3.0 && calculatedVout <= 3.5;
  const isVoutDangerous = calculatedVout > 3.6;
  const isVoutLow = calculatedVout < 2.8;

  const PINS_DATA = [
    { num: 1, label: 'R1 (Riga 1)', color: 'bg-indigo-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 4' : selectedBoard === 'freenove_s2' ? 'GPIO 1' : 'GPIO 19', keys: '1, 2, 3, A', desc: 'Prima riga superiore della membrana (Prodotti 1-4)' },
    { num: 2, label: 'R2 (Riga 2)', color: 'bg-indigo-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 5' : selectedBoard === 'freenove_s2' ? 'GPIO 2' : 'GPIO 18', keys: '4, 5, 6, B', desc: 'Seconda riga della membrana (Prodotti 5-8)' },
    { num: 3, label: 'R3 (Riga 3)', color: 'bg-indigo-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 6' : selectedBoard === 'freenove_s2' ? 'GPIO 3' : 'GPIO 5', keys: '7, 8, 9, C', desc: 'Terza riga della membrana (Prodotti 9-12)' },
    { num: 4, label: 'R4 (Riga 4)', color: 'bg-indigo-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 7' : selectedBoard === 'freenove_s2' ? 'GPIO 4' : 'GPIO 17', keys: '*, 0 (14 Tasti)', desc: 'Quarta riga con 2 tasti fisici: CARAFFA (*) e STOP (0)' },
    { num: 5, label: 'C1 (Col 1)', color: 'bg-emerald-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 8' : selectedBoard === 'freenove_s2' ? 'GPIO 5' : 'GPIO 16', keys: '1, 4, 7, *', desc: 'Prima colonna da sinistra' },
    { num: 6, label: 'C2 (Col 2)', color: 'bg-emerald-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 9' : selectedBoard === 'freenove_s2' ? 'GPIO 6' : 'GPIO 4', keys: '2, 5, 8, 0', desc: 'Seconda colonna' },
    { num: 7, label: 'C3 (Col 3)', color: 'bg-emerald-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 10' : selectedBoard === 'freenove_s2' ? 'GPIO 7' : 'GPIO 23', keys: '3, 6, 9', desc: 'Terza colonna prodotti' },
    { num: 8, label: 'C4 (Col 4)', color: 'bg-emerald-500', targetGpio: selectedBoard === 'freenove_s3' ? 'GPIO 11' : selectedBoard === 'freenove_s2' ? 'GPIO 8' : 'GPIO 22', keys: 'A, B, C', desc: 'Quarta colonna prodotti' },
  ];

  const getWiresForBoard = () => {
    if (selectedBoard === 'freenove_s3') {
      return [
        { filo: 1, gpio: 'GPIO 4', pos: 'Header SX - Pin 6 (IO4)', role: 'P10, P11, P12 (Riga 1)' },
        { filo: 2, gpio: 'GPIO 5', pos: 'Header SX - Pin 7 (IO5)', role: 'P7, P8, P9, STOP (Riga 2)' },
        { filo: 3, gpio: 'GPIO 6', pos: 'Header SX - Pin 8 (IO6)', role: 'P4, P5, P6, CARAFFA (Riga 3)' },
        { filo: 4, gpio: 'GPIO 7', pos: 'Header SX - Pin 9 (IO7)', role: 'P1, P2, P3, LINGUA (Riga 4)' },
        { filo: 5, gpio: 'GPIO 8', pos: 'Header DX - Pin 8 (IO8)', role: 'Comune Funzioni (Colonna 1)' },
        { filo: 6, gpio: 'GPIO 9', pos: 'Header DX - Pin 9 (IO9)', role: 'Colonna P3, P6, P9, P12' },
        { filo: 7, gpio: 'GPIO 10', pos: 'Header DX - Pin 10 (IO10)', role: 'Colonna P2, P5, P8, P11' },
        { filo: 8, gpio: 'GPIO 11', pos: 'Header DX - Pin 11 (IO11)', role: 'Colonna P1, P4, P7, P10' },
      ];
    }
    if (selectedBoard === 'freenove_s2') {
      return [
        { filo: 1, gpio: 'GPIO 1', pos: 'Header SX - Pin 3 (IO1)', role: 'P10, P11, P12 (Riga 1)' },
        { filo: 2, gpio: 'GPIO 2', pos: 'Header SX - Pin 4 (IO2)', role: 'P7, P8, P9, STOP (Riga 2)' },
        { filo: 3, gpio: 'GPIO 3', pos: 'Header SX - Pin 5 (IO3)', role: 'P4, P5, P6, CARAFFA (Riga 3)' },
        { filo: 4, gpio: 'GPIO 4', pos: 'Header SX - Pin 6 (IO4)', role: 'P1, P2, P3, LINGUA (Riga 4)' },
        { filo: 5, gpio: 'GPIO 5', pos: 'Header SX - Pin 7 (IO5)', role: 'Comune Funzioni (Colonna 1)' },
        { filo: 6, gpio: 'GPIO 6', pos: 'Header SX - Pin 8 (IO6)', role: 'Colonna P3, P6, P9, P12' },
        { filo: 7, gpio: 'GPIO 7', pos: 'Header SX - Pin 9 (IO7)', role: 'Colonna P2, P5, P8, P11' },
        { filo: 8, gpio: 'GPIO 8', pos: 'Header SX - Pin 10 (IO8)', role: 'Colonna P1, P4, P7, P10' },
      ];
    }
    return [
      { filo: 1, gpio: 'GPIO 19', pos: '8° pin da alto DX', role: 'P10, P11, P12' },
      { filo: 2, gpio: 'GPIO 18', pos: '9° pin da alto DX', role: 'P7, P8, P9, STOP' },
      { filo: 3, gpio: 'GPIO 5',  pos: '10° pin da alto DX', role: 'P4, P5, P6, CARAFFA' },
      { filo: 4, gpio: 'GPIO 17', pos: '11° pin da alto DX', role: 'P1, P2, P3, LINGUA' },
      { filo: 5, gpio: 'GPIO 16', pos: '12° pin da alto DX', role: 'Comune Funzioni' },
      { filo: 6, gpio: 'GPIO 4',  pos: '13° pin da alto DX', role: 'Colonna P3, P6, P9, P12' },
      { filo: 7, gpio: 'GPIO 23', pos: '2° pin da alto DX (G23)', role: 'Colonna P2, P5, P8, P11' },
      { filo: 8, gpio: 'GPIO 22', pos: '3° pin da alto DX (G22)', role: 'Colonna P1, P4, P7, P10' },
    ];
  };

  return (
    <div id="wiring-guide-container" className={`space-y-6 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
      {/* VERIFIED HARDWARE MAP & TESTED PINOUT BANNER (15 TASTI: 12 PRODOTTI + 3 FUNZIONI) */}
      <div className={`border rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden transition-all ${
        isLight
          ? 'bg-white border-slate-300 shadow-md text-slate-800'
          : 'bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border-slate-700 backdrop-blur-xl'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-3 pb-4 border-b ${
          isLight ? 'border-slate-300' : 'border-slate-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <CheckCircle className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 uppercase tracking-wider">
                  Configurazione Ufficiale Freenove S3
                </span>
                <span className="text-xs text-blue-400 font-mono font-bold">
                  {selectedBoard === 'freenove_s3' ? '⚡ Freenove ESP32-S3 WROOM-1 (Dual-Core LX7 + Dual Type-C)' : selectedBoard === 'freenove_s2' ? '🍓 Freenove ESP32-S2 (USB Type-C)' : 'ESP-WROOM-32 (38 Pin)'}
                </span>
              </div>
              <h2 className={`text-lg font-bold mt-1 flex items-center gap-2 ${isLight ? 'text-slate-950' : 'text-white'}`}>
                Mappatura Reale Tastiera Distributore (15 Tasti Verificati)
              </h2>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                {selectedBoard === 'freenove_s3'
                  ? 'Configurazione consigliata per Freenove ESP32-S3 WROOM-1: i fili 1..8 del cavo piatto tastiera sono collegati in ordine sequenziale sui pin GPIO 4..11.'
                  : selectedBoard === 'freenove_s2'
                  ? 'Configurazione per Freenove ESP32-S2: i fili 1..8 del cavo piatto tastiera sono collegati su GPIO 1..8.'
                  : 'Pinout collaudato con 15 tasti (12 prodotti + 3 funzioni) senza blocchi o brownout.'}
              </p>
            </div>
          </div>
          
          {/* Board Selector Tabs */}
          <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-emerald-500/30">
            <button
              onClick={() => setSelectedBoard('freenove_s3')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedBoard === 'freenove_s3'
                  ? 'bg-emerald-500/35 text-emerald-300 border border-emerald-400/70 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              ⚡ Freenove ESP32-S3
            </button>
            <button
              onClick={() => setSelectedBoard('freenove_s2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedBoard === 'freenove_s2'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              🍓 Freenove S2
            </button>
            <button
              onClick={() => setSelectedBoard('wroom32')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedBoard === 'wroom32'
                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/60 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              ESP32 Base (38 Pin)
            </button>
          </div>
        </div>

        {/* 8 Wires Pinout Grid */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              Assegnazione Cavo Piatto 8 Poli &rarr; Pin {selectedBoard === 'freenove_s3' ? 'Freenove ESP32-S3 (Fili 1..8 &rarr; GPIO 4..11)' : selectedBoard === 'freenove_s2' ? 'Freenove ESP32-S2 (Fili 1..8 &rarr; GPIO 1..8)' : 'ESP32'}
            </h3>
            <span className="text-[11px] text-emerald-300 font-mono">
              {selectedBoard === 'freenove_s3' ? 'Dual Type-C • 240MHz Xtensa Dual-Core LX7 • Vector Ext • 8MB Flash' : selectedBoard === 'freenove_s2' ? 'USB Type-C • 240MHz LX7' : 'Mappatura Verificata'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {getWiresForBoard().map((item) => (
              <div
                key={item.filo}
                className="bg-black/40 border border-emerald-500/30 rounded-xl p-3 text-center transition-all hover:border-emerald-400/60 hover:bg-black/60 shadow-sm"
              >
                <div className="text-[10px] uppercase font-bold text-slate-400">Filo {item.filo}</div>
                <div className="text-sm font-black font-mono text-emerald-300 mt-0.5">{item.gpio}</div>
                <div className="text-[10px] text-slate-300 font-medium mt-1 leading-tight">{item.pos}</div>
                <div className="text-[9px] text-emerald-400/80 mt-1.5 border-t border-white/10 pt-1 font-mono">{item.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Matrix Contacts Table */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" /> Matrice dei Contatti Verificati (Fili Chiusi dal Tasto)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            {/* Colonna U5 (Filo 5) */}
            <div className="bg-black/30 border border-slate-700 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-200 border-b border-white/10 pb-1 flex items-center justify-between">
                <span>Colonna U5 (Filo 5)</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">U5</span>
              </div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P1 (Espresso)</span><span className="text-white font-bold">U1 + U5</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P2 (Caffè Lungo)</span><span className="text-white font-bold">U2 + U5</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P3 (Macchiato)</span><span className="text-white font-bold">U3 + U5</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">LINGUA</span><span className="text-blue-400 font-bold">U4 + U5</span></div>
            </div>

            {/* Colonna U6 (Filo 6) */}
            <div className="bg-black/30 border border-slate-700 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-200 border-b border-white/10 pb-1 flex items-center justify-between">
                <span>Colonna U6 (Filo 6)</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">U6</span>
              </div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P4 (Cappuccino)</span><span className="text-white font-bold">U1 + U6</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P5 (Mocaccino)</span><span className="text-white font-bold">U2 + U6</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P6 (Latte Caldo)</span><span className="text-white font-bold">U3 + U6</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">CARAFFA</span><span className="text-cyan-400 font-bold">U4 + U6</span></div>
            </div>

            {/* Colonna U7 (Filo 7) */}
            <div className="bg-black/30 border border-slate-700 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-200 border-b border-white/10 pb-1 flex items-center justify-between">
                <span>Colonna U7 (Filo 7)</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">U7</span>
              </div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P7 (Cioccolata)</span><span className="text-white font-bold">U1 + U7</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P8 (Tè Limone)</span><span className="text-white font-bold">U2 + U7</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P9 (Americano)</span><span className="text-white font-bold">U3 + U7</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">STOP</span><span className="text-rose-400 font-bold">U4 + U7</span></div>
            </div>

            {/* Colonna U8 (Filo 8) */}
            <div className="bg-black/30 border border-slate-700 rounded-xl p-3 space-y-1.5">
              <div className="text-[11px] font-bold text-slate-200 border-b border-white/10 pb-1 flex items-center justify-between">
                <span>Colonna U8 (Filo 8)</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">U8</span>
              </div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P10 (Ginseng)</span><span className="text-white font-bold">U1 + U8</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P11 (Orzo)</span><span className="text-white font-bold">U2 + U8</span></div>
              <div className="flex justify-between py-0.5 font-mono"><span className="text-slate-300">P12 (Acqua Calda)</span><span className="text-white font-bold">U3 + U8</span></div>
              <div className="text-[10px] text-emerald-400 pt-1 border-t border-white/10 flex items-center justify-between">
                <span>Tabella U1..U8</span>
                <span className="font-bold">15/15 OK</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Anti-Reset Notice */}
        <div className="mt-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 flex items-start gap-2.5 text-xs text-slate-200">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <strong>Metodo di Scansione Protetto:</strong> L&apos;ESP32 mantiene tutti i pin ad alta impedenza con <code>INPUT_PULLUP</code> a 3.3V e porta a massa (<code>OUTPUT LOW</code>) un solo filo alla volta per leggere la chiusura del contatto. Questo elimina del tutto il rischio di cortocircuito tra pin in caso di tasti premuti contemporaneamente e impedisce i reset della CPU (brownout e strapping pins).
          </div>
        </div>

        {/* Fixed Direct Wiring Confirmation */}
        <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-200">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-emerald-300 font-bold">Cablaggio Diretto 1:1 Fisso e Standardizzato:</strong> Il cablaggio hardware è definitivo con mappatura diretta 1-a-1 tra le uscite optoisolate U1..U8 e i fili della matrice. Tutte le inversioni software sono state eliminate: ogni comando attiva esattamente i fototransistor designati (es. CARAFFA = U4 + U6, STOP = U4 + U7, LINGUA = U4 + U5).
          </div>
        </div>
      </div>
      {/* EXPLANATION: PARALLELO VS IN SERIE / GATEWAY TOPOLOGY */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/70 to-blue-950/30 border-2 border-indigo-500/40 rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Topologia di Collegamento: In Parallelo o In Serie (Gateway)?
              </h2>
              <p className="text-xs text-indigo-200/90 mt-0.5">
                Come si interfacciano fisicamente i pin dell&apos;ESP32 rispetto alla Scheda Madre originale del distributore e alla Tastiera a 12V.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Guida all&apos;Architettura Hardware
          </span>
        </div>

        {/* Mode Selector Tabs */}
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Mode A: In Parallelo */}
            <button
              onClick={() => setTopologyMode('parallel_sniff')}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                topologyMode === 'parallel_sniff'
                  ? 'bg-indigo-600/20 border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] ring-2 ring-indigo-400/40'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-indigo-400" /> OPZIONE A: Collegamento IN PARALLELO
                </span>
                <span className="text-[10px] bg-indigo-500/20 text-indigo-200 px-2 py-0.5 rounded border border-indigo-500/30 font-semibold">
                  Sniffing / Telemetria Pura
                </span>
              </div>
              <div className="font-bold text-sm text-white">Tastiera &rarr; Scheda Madre (e ESP32 in parallelo)</div>
              <p className="text-[11px] text-slate-300 mt-1">
                La tastiera <strong>resta collegata alla scheda madre originale</strong>. L&apos;ESP32 si mette in parallelo ad alta impedenza solo per &quot;ascoltare&quot; la selezione e trasmettere al Cloud.
              </p>
            </button>

            {/* Mode B: In Serie / Gateway */}
            <button
              onClick={() => setTopologyMode('series_gateway')}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                topologyMode === 'series_gateway'
                  ? 'bg-blue-600/20 border-blue-400 ring-2 ring-blue-400/40'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-blue-400" /> OPZIONE B: In Serie (Gateway Master)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-semibold">
                  Controllo Totale + Display
                </span>
              </div>
              <div className="font-bold text-sm text-white">Tastiera &rarr; ESP32 &rarr; Scheda Madre / PLC</div>
              <p className="text-[11px] text-slate-300 mt-1">
                La tastiera si collega <strong>esclusivamente all&apos;ESP32</strong>. L&apos;ESP32 valida la richiesta, aggiorna l&apos;LCD e attiva i pin di comando (trigger) verso la scheda macchina.
              </p>
            </button>
          </div>

          {/* ACTIVE TOPOLOGY DIAGRAM & EXPLANATION */}
          {topologyMode === 'parallel_sniff' && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 text-xs space-y-3.5">
              <div className="font-bold text-sm text-indigo-300 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                Dettaglio Architettura IN PARALLELO (&quot;Sniffing dei Segnali a 12V&quot;)
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2 text-slate-300 leading-relaxed">
                  <p>
                    In questa modalità, <strong>NON modifichi il funzionamento originale del distributore</strong>. Il cavo della tastiera resta innestato sulla scheda madre della macchina.
                  </p>
                  <p>
                    Tramite sdoppiatori o morsetti a &quot;T&quot;, prelevi gli 8 fili della tastiera e li colleghi agli ingressi del <strong>Modulo Optoisolatore PC817</strong>. Le uscite del modulo vanno all&apos;ESP32.
                  </p>
                  <div className="p-3 rounded-lg bg-black/40 border border-indigo-500/20 text-[11px] space-y-1">
                    <strong className="text-white block">Ruolo dei pin dell&apos;ESP32:</strong>
                    <div>&bull; <strong>Tutti i pin sono INPUT ad alta impedenza:</strong> l&apos;ESP32 non inietta corrente e non interferisce con la scheda madre.</div>
                    <div>&bull; Quando un cliente preme &quot;1 - Espresso&quot;, la macchina originale eroga normalmente il caffè. Contemporaneamente l&apos;ESP32 rileva l&apos;impulso a 12V (convertito a 3.3V dall&apos;optoisolatore) e invia l&apos;evento al server Cloud.</div>
                  </div>
                </div>

                {/* ASCII Diagram Parallelo */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <div className="text-indigo-400 font-bold mb-1">SCHEMA CABLAGGIO IN PARALLELO (TAPPING):</div>
                  <pre className="text-indigo-200 leading-tight">
{`+-----------------------+
|  TASTIERA A MEMBRANA  | (14 Tasti, segnali a 12V)
+-----------------------+
           |
           | (Cavo a nastro 8 Pin a 12V)
           +---------------------------------------+
           |                                       | (Derivazione / T-Tap)
           ▼                                       ▼
+-----------------------+              +-----------------------+
| SCHEDA MADRE MACCHINA |              | MODULO OPTOISOLATORE  |
|  (Gestisce pompe,     |              | 8-CH PC817 (12V->3.3V)|
|   caldaia, erogazione)|              +-----------------------+
+-----------------------+                          |
   (Funziona normalmente)                          ▼
                                       +-----------------------+
                                       | ESP32 (Solo INPUT)    |
                                       | Legge i tasti premuti |
                                       | e invia telemetria    |
                                       | WiFi al Cloud Database|
                                       +-----------------------+`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {topologyMode === 'series_gateway' && (
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700 text-xs space-y-3.5">
              <div className="font-bold text-sm text-blue-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                Dettaglio Architettura IN SERIE / GATEWAY (&quot;ESP32 Master Interfaccia&quot;)
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-2 text-slate-300 leading-relaxed">
                  <p>
                    In questa modalità, l&apos;ESP32 funge da <strong>Gateway Intelligente</strong>. Il cavo della tastiera non va più alla scheda madre, ma entra nell&apos;ESP32.
                  </p>
                  <p>
                    L&apos;ESP32 legge il tasto premuto, aggiorna il display LCD 20x4, applica funzioni avanzate (es. Tasto Caraffa o Tasto Stop Emergenza), e poi comanda la scheda madre/PLC tramite uscite digitali di trigger optoisolate.
                  </p>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-[11px] space-y-1">
                    <strong className="text-white block">Ruolo dei pin dell&apos;ESP32:</strong>
                    <div>&bull; <strong>8 Pin come INPUT:</strong> leggono la tastiera a membrana (Righe/Colonne).</div>
                    <div>&bull; <strong>4..8 Pin come OUTPUT:</strong> inviano impulsi di selezione (Trigger / Relè) alla scheda originale o al PLC per avviare la preparazione.</div>
                  </div>
                </div>

                {/* ASCII Diagram In Serie */}
                <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <div className="text-blue-400 font-bold mb-1">SCHEMA CABLAGGIO IN SERIE (GATEWAY):</div>
                  <pre className="text-slate-300 leading-tight">
{`+-----------------------+
|  TASTIERA A MEMBRANA  | (14 Tasti)
+-----------------------+
           |
           ▼
+-----------------------+
| ADATTATORE 12V / 3.3V | (Optoisolatori PC817 o Contatti a Secco)
+-----------------------+
           | (8 Pin Input)
           ▼
+-----------------------+       +-----------------------+
|  ESP32 MICROGATEWAY   | <===> | DISPLAY LCD 20x4 I2C  |
|                       |       | &quot;Preparazione...&quot;     |
| 1. Legge selezione    |       +-----------------------+
| 2. Invia dati al Cloud|
| 3. Attiva uscite      |
+-----------------------+
           | (Uscite Trigger Optoisolate / Relè)
           ▼
+-----------------------+
| SCHEDA MADRE / PLC    |
| (Esegue riscaldamento,|
|  pompa ed erogazione) |
+-----------------------+`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CRITICAL 12V WARNING BANNER & INTERFACING SOLUTION HUB */}
      <div className="bg-gradient-to-br from-rose-950/40 via-slate-900/60 to-amber-950/30 border-2 border-rose-500/50 rounded-2xl p-5 md:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-44 h-44 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/20">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-wide">
                  ATTENZIONE CRITICA: Segnali Tastiera a 12V DC &harr; ESP32 (3.3V Logic)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  Pericolo Sovratensione: Max 3.3V su ESP32
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-1 max-w-4xl leading-relaxed">
                I GPIO dell&apos;ESP32 operano a <strong>3.3V</strong> (limite massimo tollerabile: <strong>3.6V</strong>).
                Collegare direttamente linee a <strong>12V DC</strong> dalla tastiera o dalla scheda distributore <strong>brucerà istantaneamente i pin dell&apos;ESP32</strong>.
                È obbligatorio interporre un modulo di adattamento di livello.
              </p>
            </div>
          </div>
        </div>

        {/* 3 Interfacing Solutions Selector */}
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" /> Seleziona il Metodo di Adattamento 12V &rarr; 3.3V:
            </span>
            <span className="text-[11px] text-slate-400">Clicca su una soluzione per visualizzare schema e componenti</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Method 1: Optoisolator (PC817) */}
            <button
              onClick={() => setVoltageMethod('opto')}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                voltageMethod === 'opto'
                  ? 'bg-blue-500/20 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-400/40'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-blue-400" /> Soluzione 1 (CONSIGLIATA)
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-200 px-2 py-0.5 rounded border border-slate-700 font-semibold">
                  Isolamento 2.5 kV
                </span>
              </div>
              <div className="font-bold text-sm text-white">Modulo Optoisolatore 8-CH (PC817)</div>
              <p className="text-[11px] text-slate-300 mt-1">
                Isolamento galvanico totale tra i 12V del distributore e i 3.3V dell&apos;ESP32. Immunità completa ai disturbi elettromagnetici dei motori.
              </p>
            </button>

            {/* Method 2: Resistor Voltage Divider */}
            <button
              onClick={() => setVoltageMethod('divider')}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                voltageMethod === 'divider'
                  ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-amber-400/40'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-400" /> Soluzione 2 (Economica)
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-semibold">
                  Partitore + Zener
                </span>
              </div>
              <div className="font-bold text-sm text-white">Partitore Resistivo (R1=10k + R2=3.9k)</div>
              <p className="text-[11px] text-slate-300 mt-1">
                Riduce 12V a 3.36V con solo 2 resistori per linea (8 canali) + Diodo Zener 3.3V di clamp di sicurezza.
              </p>
            </button>

            {/* Method 3: Dry Passive Membrane Keypad */}
            <button
              onClick={() => setVoltageMethod('dry_passive')}
              className={`p-4 rounded-xl border text-left transition-all relative ${
                voltageMethod === 'dry_passive'
                  ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_20px_rgba(168,85,247,0.3)] ring-2 ring-emerald-400/40'
                  : 'bg-black/30 border-white/10 hover:border-white/20 hover:bg-black/40'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" /> Soluzione 3 (Tastiera Isolata)
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                  Contatti Puri a Secco
                </span>
              </div>
              <div className="font-bold text-sm text-white">Membrana Passiva Scollegata da 12V</div>
              <p className="text-[11px] text-slate-300 mt-1">
                Se il cavo a nastro della tastiera è staccato dalla vecchia scheda a 12V ed è collegato SOLO all&apos;ESP32 (3.3V diretto).
              </p>
            </button>
          </div>

          {/* ACTIVE METHOD DETAILS & CIRCUIT SCHEMATICS */}
          {voltageMethod === 'opto' && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-700 text-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="font-bold text-sm text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-400" />
                  Schema di Collegamento con Modulo Optoisolatore 8-Canali (PC817 / EL817)
                </div>
                <span className="text-[11px] font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                  Standard Industriale Erogatori
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Circuit Details */}
                <div className="space-y-3">
                  <p className="text-slate-300 leading-relaxed">
                    Il modulo optoisolatore 8 canali separa galvanicamente la linea a 12V della macchina da quella a 3.3V dell&apos;ESP32.
                    Ogni canale dispone di un fotoaccoppiatore PC817 con resistore di limitazione corrente per i 12V.
                  </p>

                  <div className="bg-black/50 p-3.5 rounded-xl border border-slate-800 font-mono text-[11px] space-y-2">
                    <div className="text-amber-400 font-bold uppercase tracking-wider">Mappatura Pin Modulo Optoisolatore:</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                        <strong className="text-white block mb-1">LATO INGRESSO (12V Distributore):</strong>
                        <div>&bull; <strong>IN1 .. IN8</strong>: Collegati agli 8 fili della tastiera (R1..R4, C1..C4)</div>
                        <div>&bull; <strong>COM (GND 12V)</strong>: Collegato alla massa 12V del distributore</div>
                      </div>
                      <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                        <strong className="text-white block mb-1">LATO USCITA (3.3V ESP32):</strong>
                        <div>&bull; <strong>VCC</strong>: Collegato al pin <strong>3V3</strong> dell&apos;ESP32</div>
                        <div>&bull; <strong>GND</strong>: Collegato al <strong>GND</strong> dell&apos;ESP32</div>
                        <div>&bull; <strong>OUT1..OUT8</strong>: Verso GPIO 13, 12, 14, 27, 26, 25, 33, 32</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200">
                    <strong className="block font-semibold mb-0.5 text-white">Vantaggio Chiave:</strong>
                    I disturbi elettromagnetici ad alta tensione causati da pompe 230V, elettrovalvole e macinacaffè rimangono confinati nel circuito a 12V senza ripercuotersi sull&apos;ESP32.
                  </div>
                </div>

                {/* Visual ASCII / SVG Schematic */}
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <div className="text-blue-400 font-bold mb-2 flex items-center justify-between">
                    <span>SCHEMA ELETTRICO SINGOLO CANALE (PC817)</span>
                    <span className="text-[10px] text-slate-500">1 di 8 canali</span>
                  </div>
                  <pre className="text-slate-300 leading-tight">
{`+12V Keypad Wire --------[ 1.2kΩ ]---+
                                    |
                                  +---+ (Pin 1 Anode)
                                  |   |
                             [LED]|   | PC817 OPTOCOUPLER
                                  |   |
                                  +---+ (Pin 2 Cathode)
                                    |
12V GND Machine --------------------+

=================== BARRIERA OTTICA ISOLAMENTO 2.5kV ===================

ESP32 3.3V VCC --------[ 10kΩ Pull-Up ]---+
                                           |
                                         +---+ (Pin 4 Collector)
                                         | / |
                               [PHOTO-T] |/  |
                                         |\\  |
                                         +---+ (Pin 3 Emitter)
                                           |
ESP32 GPIO (13,12,14,27,26,25,33,32) <----+
                                           |
ESP32 GND ---------------------------------+`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {voltageMethod === 'divider' && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/80 border border-amber-500/30 text-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="font-bold text-sm text-amber-300 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  Calcolatore Interattivo Partitore Resistivo &amp; Diodo Zener di Clamp
                </div>
                <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  Formula: Vout = Vin × R2 / (R1 + R2)
                </span>
              </div>

              {/* Interactive Calculator Section */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left: Inputs */}
                <div className="lg:col-span-5 space-y-3 bg-black/40 p-4 rounded-xl border border-slate-800">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" /> Parametri di Ingresso:
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Tensione di Ingresso Segnale (Vin):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.5"
                        min="5"
                        max="24"
                        value={inputVin}
                        onChange={(e) => setInputVin(parseFloat(e.target.value) || 12)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="font-mono text-amber-300 font-bold text-sm">Volt</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Resistore Superiore R1 (High-Side):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="100"
                        min="100"
                        max="100000"
                        value={resistorR1}
                        onChange={(e) => setResistorR1(parseInt(e.target.value) || 10000)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="font-mono text-slate-300 font-bold text-xs">Ω ({(resistorR1 / 1000).toFixed(1)}kΩ)</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">Resistore Inferiore R2 (Low-Side a GND):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="100"
                        min="100"
                        max="100000"
                        value={resistorR2}
                        onChange={(e) => setResistorR2(parseInt(e.target.value) || 3900)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="font-mono text-slate-300 font-bold text-xs">Ω ({(resistorR2 / 1000).toFixed(1)}kΩ)</span>
                    </div>
                  </div>

                  {/* Preset Values */}
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1.5">Preset Standard Consigliati (Serie E24):</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => { setInputVin(12); setResistorR1(10000); setResistorR2(3900); }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-200 border border-slate-700 text-left font-mono"
                      >
                        12V &rarr; 10k + 3.9k (3.37V)
                      </button>
                      <button
                        onClick={() => { setInputVin(12); setResistorR1(27000); setResistorR2(10000); }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 border border-slate-700 text-left font-mono"
                      >
                        12V &rarr; 27k + 10k (3.24V)
                      </button>
                      <button
                        onClick={() => { setInputVin(12); setResistorR1(12000); setResistorR2(4700); }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 border border-slate-700 text-left font-mono"
                      >
                        12V &rarr; 12k + 4.7k (3.38V)
                      </button>
                      <button
                        onClick={() => { setInputVin(24); setResistorR1(22000); setResistorR2(3300); }}
                        className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-200 border border-slate-700 text-left font-mono"
                      >
                        24V &rarr; 22k + 3.3k (3.13V)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Realtime Calculations & Safety Verdict */}
                <div className="lg:col-span-7 space-y-3 flex flex-col justify-between">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {/* Vout Display */}
                    <div className={`p-3.5 rounded-xl border col-span-2 sm:col-span-1 ${
                      isVoutDangerous
                        ? 'bg-rose-500/20 border-rose-500/60 text-rose-200'
                        : isVoutSafe
                        ? 'bg-blue-500/20 border-blue-400 text-blue-200'
                        : 'bg-yellow-500/20 border-yellow-500/60 text-yellow-200'
                    }`}>
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Tensione Vout Calcolata:</div>
                      <div className="text-2xl font-mono font-bold mt-1">{calculatedVout.toFixed(2)} V</div>
                      <div className="text-[10px] font-semibold mt-0.5">
                        {isVoutDangerous && 'PERICOLO: BRUCIA ESP32!'}
                        {isVoutSafe && 'SICURO PER ESP32 (3.3V OK)'}
                        {isVoutLow && 'ATTENZIONE: TROPPO BASSA (<2.8V)'}
                      </div>
                    </div>

                    {/* Current Draw */}
                    <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Corrente di Linea:</div>
                      <div className="text-xl font-mono font-bold text-blue-400 mt-1">{currentDrawMa.toFixed(2)} mA</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Carico trascurabile sul PLC</div>
                    </div>

                    {/* Power Dissipation */}
                    <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dissipazione R1 (1/4W):</div>
                      <div className="text-xl font-mono font-bold text-amber-300 mt-1">{powerR1Mw.toFixed(1)} mW</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Max tollerabile: 250 mW</div>
                    </div>
                  </div>

                  {/* Visual Schematic Box */}
                  <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-amber-400 font-bold flex items-center justify-between text-xs">
                      <span>SCHEMA ELETTRICO INTERATTIVO PARTITORE (1 CANALE):</span>
                      <span className="text-[10px] text-amber-300/80 font-mono">Vout: {calculatedVout.toFixed(2)}V</span>
                    </div>

                    {/* Rich SVG / Visual Layout of the Voltage Divider */}
                    <div className="p-3 bg-black/60 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-[11px]">
                      {/* Left: Input 12V */}
                      <div className="flex flex-col items-center p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-center min-w-[130px]">
                        <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">FILO TASTIERA</span>
                        <span className="text-base font-bold mt-0.5 text-white">+{inputVin}V</span>
                        <span className="text-[9px] text-amber-300/80">Segnale 12V Macchina</span>
                      </div>

                      {/* Arrow / Line to R1 */}
                      <div className="flex items-center text-amber-400 font-bold">──────►</div>

                      {/* Resistor R1 */}
                      <div className="flex flex-col items-center p-2.5 rounded-lg bg-slate-900 border border-amber-400/50 text-center min-w-[140px] shadow-lg shadow-amber-500/5">
                        <div className="text-[10px] text-amber-400 font-bold uppercase">R1 (SUPERIORE)</div>
                        <div className="text-sm font-bold text-white mt-0.5">{(resistorR1 / 1000).toFixed(1)} kΩ</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-800" title="Marrone"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-black border border-white/40" title="Nero"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Arancione"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" title="Oro"></span>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1">Dissipa: {powerR1Mw.toFixed(1)} mW</span>
                      </div>

                      {/* Junction Node */}
                      <div className="flex flex-col items-center p-2.5 rounded-lg bg-slate-900 border-2 border-blue-400 text-slate-200 text-center min-w-[150px]">
                        <span className="text-[10px] uppercase tracking-wider text-blue-400 font-bold">NODO CENTRALE</span>
                        <span className="text-base font-bold text-white mt-0.5">{calculatedVout.toFixed(2)} V</span>
                        <div className="w-full mt-1 pt-1 border-t border-white/10 text-[10px] text-blue-300 font-bold flex items-center justify-center gap-1">
                          <span>► PIN GPIO ESP32</span>
                        </div>
                      </div>

                      {/* Down / Right: Resistor R2 to GND */}
                      <div className="flex flex-col items-center p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-center min-w-[140px]">
                        <div className="text-[10px] text-slate-300 font-bold uppercase">R2 (A MASSA)</div>
                        <div className="text-sm font-bold text-white mt-0.5">{(resistorR2 / 1000).toFixed(1)} kΩ</div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Arancione"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-white text-black font-bold" title="Bianco"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600" title="Rosso"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" title="Oro"></span>
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1">Verso GND Comune</span>
                      </div>

                      {/* Arrow to GND */}
                      <div className="flex items-center text-slate-400 font-bold">──────►</div>

                      {/* Common GND */}
                      <div className="flex flex-col items-center p-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-center min-w-[130px]">
                        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">GND COMUNE (0V)</span>
                        <span className="text-xs font-bold text-white mt-0.5">GND ESP32</span>
                        <span className="text-[9px] text-slate-400">+ GND 12V Macchina</span>
                      </div>
                    </div>

                    <pre className="text-amber-200/90 leading-tight font-mono text-[11px] bg-black/40 p-2.5 rounded-lg border border-slate-800">
{`SCHEMA ELETTRICO AS-BUILT:
Filo Tastiera 12V ──────[ R1 = ${(resistorR1 / 1000).toFixed(1)}kΩ ]──────┬──────► Verso Pin ESP32 (${calculatedVout.toFixed(2)}V Sicuro)
(es. Pin 1)                                  │
                                     [ R2 = ${(resistorR2 / 1000).toFixed(1)}kΩ ]
                                             │
GND COMUNE ──────────────────────────────────┴──────► GND ESP32 + GND 12V Macchina`}
                    </pre>
                  </div>

                  {/* 8-Channel Physical Wiring Table for Resistors */}
                  <div className="bg-black/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-white font-bold text-xs flex items-center justify-between">
                      <span>MAPPATURA COMPLETA DEI 16 RESISTORI (8 CANALI PARTITORE):</span>
                      <span className="text-[10px] text-slate-400 font-normal">8 coppie identiche R1+R2</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[11px] text-slate-300 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 text-[10px]">
                            <th className="pb-1.5 font-semibold">Canale</th>
                            <th className="pb-1.5 font-semibold">Filo Tastiera 12V</th>
                            <th className="pb-1.5 font-semibold">R1 (10 kΩ)</th>
                            <th className="pb-1.5 font-semibold text-blue-400">⚡ Modulo Freenove S3</th>
                            <th className="pb-1.5 font-semibold text-amber-300">🍓 Modulo Freenove S2</th>
                            <th className="pb-1.5 font-semibold">Modulo ESP32 Base</th>
                            <th className="pb-1.5 font-semibold">R2 (3.9 kΩ)</th>
                            <th className="pb-1.5 font-semibold">Massa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 1</td>
                            <td className="py-1 text-white">Pin 1 (Riga 1)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 1</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 4 (Pin 6)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 1</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 19</td>
                            <td className="py-1 text-slate-300">Nodo 1 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 2</td>
                            <td className="py-1 text-white">Pin 2 (Riga 2)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 2</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 5 (Pin 7)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 2</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 18</td>
                            <td className="py-1 text-slate-300">Nodo 2 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 3</td>
                            <td className="py-1 text-white">Pin 3 (Riga 3)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 3</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 6 (Pin 8)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 3</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 5</td>
                            <td className="py-1 text-slate-300">Nodo 3 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 4</td>
                            <td className="py-1 text-white">Pin 4 (Riga 4)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 4</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 7 (Pin 9)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 4</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 17</td>
                            <td className="py-1 text-slate-300">Nodo 4 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 5</td>
                            <td className="py-1 text-white">Pin 5 (Colonna 1)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 5</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 8 (IO8)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 5</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 16</td>
                            <td className="py-1 text-slate-300">Nodo 5 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 6</td>
                            <td className="py-1 text-white">Pin 6 (Colonna 2)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 6</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 9 (IO9)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 6</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 4</td>
                            <td className="py-1 text-slate-300">Nodo 6 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 7</td>
                            <td className="py-1 text-white">Pin 7 (Colonna 3)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 7</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 10 (IO10)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 7</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 23</td>
                            <td className="py-1 text-slate-300">Nodo 7 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-amber-300 font-bold">CH 8</td>
                            <td className="py-1 text-white">Pin 8 (Colonna 4)</td>
                            <td className="py-1 text-amber-200">10kΩ &rarr; Nodo 8</td>
                            <td className="py-1 text-blue-400 font-bold font-mono">GPIO 11 (IO11)</td>
                            <td className="py-1 text-amber-300 font-mono">GPIO 8</td>
                            <td className="py-1 text-slate-300 font-mono">GPIO 22</td>
                            <td className="py-1 text-slate-300">Nodo 8 &rarr; GND</td>
                            <td className="py-1 text-slate-400">GND Comune</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200 space-y-1">
                    <strong className="block font-semibold text-amber-100">Regola d&apos;Oro per il Montaggio:</strong>
                    <div>&bull; <strong>GND Comune obbligatorio:</strong> Unisci sempre il polo negativo GND a 12V del distributore con il pin GND dell&apos;ESP32.</div>
                    <div>&bull; <strong>Test preliminare col tester:</strong> Prima di innestare i cavetti sui GPIO dell&apos;ESP32, premi i tasti e verifica che la tensione misurata tra ciascun nodo centrale e GND sia sempre compresa tra <strong>3.0V e 3.4V</strong> (mai sopra 3.6V).</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {voltageMethod === 'dry_passive' && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/30 text-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="font-bold text-sm text-emerald-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Tastiera a Membrana Passiva a Secco (Solo se Scollegata dal Circuito 12V)
                </div>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Nessun Adattatore Richiesto
                </span>
              </div>

              <div className="space-y-3 text-slate-300 leading-relaxed">
                <p>
                  Se hai fisicamente <strong>rimosso o scollegato il cavo a nastro a 8 pin</strong> dalla vecchia scheda madre a 12V del distributore,
                  la membrana a 14 tasti diventa un semplice insieme di <strong>interruttori meccanici a secco (dry contacts)</strong> senza alcuna tensione applicata.
                </p>

                <div className="p-3.5 rounded-xl bg-black/40 border border-slate-800 space-y-2">
                  <strong className="text-white block">Come verificare con il Tester (Multimetro):</strong>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                    <li>Scollega il connettore 8 pin della tastiera.</li>
                    <li>Imposta il multimetro in modalità <strong>Continuità / Ohm (Buzzer)</strong>.</li>
                    <li>Puntale rosso su Pin 1 (Riga 1) e puntale nero su Pin 5 (Colonna 1).</li>
                    <li>Il tester deve suonare <strong>esclusivamente quando premi il tasto &apos;1&apos; (Espresso)</strong>. A riposo la resistenza deve essere infinita (circuito aperto).</li>
                    <li>Se la misura rispetta questa condizione, puoi collegare i pin <strong>direttamente all&apos;ESP32</strong> attivando i pull-up interni a 3.3V via software!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overview Banner & 8-Pin Interactive Decoder */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cable className="w-5 h-5 text-blue-400" />
              Piedinatura Tastiera 14 Tasti Fisici (Connettore 8 Pin) &harr; ESP32
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Mappatura delle 4 Righe e 4 Colonne per i 12 prodotti diretti + Tasto CARAFFA (*) + Tasto STOP (0).
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-400/20 backdrop-blur-sm">
            Tastiera 14 Tasti (12 Prodotti + Caraffa + Stop)
          </span>
        </div>

        {/* Visual 8-Pin Ribbon Cable Interactive Decoder */}
        <div className="mt-6">
          <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" /> Connettore a Nastro 8 Pin (Faccia Frontale)
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {PINS_DATA.map((pin) => (
              <button
                key={pin.num}
                onClick={() => setSelectedPin(selectedPin === pin.num ? null : pin.num)}
                className={`p-3.5 rounded-xl border text-left transition-all duration-150 relative overflow-hidden ${
                  selectedPin === pin.num
                    ? 'bg-blue-500/20 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-400/30'
                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-mono text-slate-400 font-bold">PIN {pin.num}</span>
                  <span className={`w-2.5 h-2.5 rounded-full ${pin.color}`}></span>
                </div>
                <div className="font-bold text-xs text-white">{pin.label}</div>
                <div className="font-mono text-[11px] text-amber-300 mt-1 font-semibold">
                  &rarr; {pin.targetGpio}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Tasti: {pin.keys}</div>
              </button>
            ))}
          </div>

          {/* Selected Pin Details Callout */}
          {selectedPin !== null && (
            <div className="mt-4 p-4 rounded-xl bg-black/30 backdrop-blur-md border border-blue-400/30 text-xs flex items-start gap-3 shadow-lg">
              <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 shrink-0 border border-blue-400/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold text-white">
                  Dettagli Pin {selectedPin}: {PINS_DATA[selectedPin - 1].label} &rarr; {PINS_DATA[selectedPin - 1].targetGpio}
                </div>
                <p className="text-slate-300 mt-0.5">{PINS_DATA[selectedPin - 1].desc}</p>
                <div className="mt-2 text-blue-300 font-mono text-[11px]">
                  Controlla i tasti: {PINS_DATA[selectedPin - 1].keys}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Beverage Dispenser Actuators & PLC Interface */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="font-bold text-sm text-white flex items-center justify-between border-b border-white/10 pb-3">
          <span className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Architettura Industriale: Scheda ESP32 Telemetria IoT &harr; Scheda Master PLC Macchina
          </span>
          <span className="text-[11px] font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
            PLC Master + ESP32 Telemetria
          </span>
        </div>

        {/* Dual Architecture Explanation */}
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-400/20 text-xs text-blue-200">
          <div className="font-bold text-white flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-blue-400" />
            Suddivisione dei Ruoli Hardware:
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 text-[11px] text-slate-300">
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/10">
              <strong className="text-amber-300 block mb-0.5">1. Scheda Master (PLC Industriale):</strong>
              Gestisce tutta la <strong>logica di funzionamento e potenza</strong>: riscaldamento caldaia PID, pompa 15-bar, macinacaffè 24V, elettrovalvole, mixer polveri, sgancio bicchiere, galleggianti e allarmi di sicurezza.
            </div>
            <div className="p-2.5 rounded-lg bg-black/30 border border-white/10">
              <strong className="text-blue-300 block mb-0.5">2. Scheda ESP32 (Telemetria IoT &amp; Keypad Gateway):</strong>
              Acquisisce la <strong>tastiera a 14 tasti</strong> (adattando i segnali 12V), aggiorna il display LCD 20x4, invia la selezione al PLC (tramite optoisolatori o bus seriale) e trasmette tutta la <strong>telemetria real-time al Cloud/Database via WiFi</strong>.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* LCD 20x4 I2C */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
            <div className="font-bold text-blue-300 flex items-center gap-1.5">
              <span>Display LCD 20x4 I2C</span>
            </div>
            <p className="text-[11px] text-slate-300">Interfaccia operatore frontale: stato macchina, selezione e messaggi PLC.</p>
            <div className="font-mono text-[10px] space-y-0.5 text-slate-400 border-t border-white/10 pt-1.5">
              <div>SDA &rarr; <strong className="text-white">GPIO 21</strong></div>
              <div>SCL &rarr; <strong className="text-white">GPIO 22</strong></div>
              <div>VCC &rarr; <strong className="text-white">5V (Vin)</strong></div>
              <div>GND &rarr; <strong className="text-white">GND</strong></div>
            </div>
          </div>

          {/* Uscite Comandi ESP32 -> PLC */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <span>Uscite Trigger ESP32 &rarr; Ingressi PLC</span>
            </div>
            <p className="text-[11px] text-slate-300">Linee di selezione e trigger verso la scheda PLC (Optoisolate).</p>
            <div className="font-mono text-[10px] space-y-0.5 text-slate-400 border-t border-white/10 pt-1.5">
              <div>Strobe Start &rarr; <strong className="text-white">GPIO 19</strong></div>
              <div>Caraffa Mode &rarr; <strong className="text-white">GPIO 18</strong></div>
              <div>Stop Emergenza &rarr; <strong className="text-white">GPIO 5</strong></div>
              <div>Selezione BCD &rarr; <strong className="text-white">GPIO 17, 16, 4, 0</strong></div>
            </div>
          </div>

          {/* Ingressi Stato PLC -> ESP32 */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>Ingressi Telemetria da PLC</span>
            </div>
            <p className="text-[11px] text-slate-300">Lettura dello stato operativo generato dal PLC.</p>
            <div className="font-mono text-[10px] space-y-0.5 text-slate-400 border-t border-white/10 pt-1.5">
              <div>PLC Ready (Pronto) &rarr; <strong className="text-white">GPIO 34</strong></div>
              <div>PLC Busy (Erogazione) &rarr; <strong className="text-white">GPIO 35</strong></div>
              <div>PLC Alarm (Allarme) &rarr; <strong className="text-white">GPIO 39</strong></div>
              <div>Optoisolatore di livello 12V/24V &rarr; 3.3V safe</div>
            </div>
          </div>

          {/* Buzzer & Telemetria WiFi */}
          <div className="p-3.5 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
            <div className="font-bold text-blue-400 flex items-center gap-1.5">
              <span>Buzzer &amp; WiFi Telemetry</span>
            </div>
            <p className="text-[11px] text-slate-300">Feedback sonoro e trasmissione dati continua verso il Database Cloud.</p>
            <div className="font-mono text-[10px] space-y-0.5 text-slate-400 border-t border-white/10 pt-1.5">
              <div>Buzzer Acustico &rarr; <strong className="text-white">GPIO 2</strong> (PWM)</div>
              <div>Modulo WiFi &rarr; <strong className="text-white">Antenna ESP32</strong></div>
              <div>Cloud Protocol &rarr; <strong className="text-blue-300">HTTPS REST + SSE</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Two column info: GPIO Safe Matrix & Principles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
        {/* Safe vs Dangerous GPIO on ESP32 */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="font-bold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Guida ai GPIO dell&apos;ESP32 (Cosa usare e cosa evitare)
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 backdrop-blur-sm">
              <div className="font-semibold text-blue-300 flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-4 h-4" /> GPIO Raccomandati per Tastiera 4x4
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-white font-mono">GPIO 13, 14, 27, 26, 25, 33, 32, 19, 21, 22, 23</strong>
                <br />
                Supportano sia OUTPUT che INPUT con resistenze di pull-up interne attivabili da software (<code className="text-blue-300 bg-black/30 px-1 py-0.5 rounded border border-white/10">INPUT_PULLUP</code>).
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4" /> Pin di Strapping (Attenzione all&apos;avvio)
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-white font-mono">GPIO 0, GPIO 2, GPIO 12, GPIO 15</strong>
                <br />
                Se mantenuti a livello logico basso durante il boot possono impedire il flash del firmware o causare boot-loop. È preferibile non usarli per le righe/colonne se possibile.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-sm">
              <div className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4" /> Pin Solo Input (NON usare per Righe!)
              </div>
              <p className="text-slate-300 leading-relaxed">
                <strong className="text-white font-mono">GPIO 34, 35, 36 (VP), 39 (VN)</strong>
                <br />
                Questi pin non hanno transistor di pilotaggio di uscita né resistenze di pull-up interne. Non possono essere utilizzati come uscite per pilotare le righe della matrice.
              </p>
            </div>
          </div>
        </div>

        {/* How Matrix Keypad Works (Theory & FAQs) */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="font-bold text-sm text-white flex items-center gap-2 border-b border-white/10 pb-3">
            <Cpu className="w-4 h-4 text-blue-400" />
            Come Funziona la Scansione Tastiera con Segnali 12V
          </div>

          <div className="space-y-3.5 text-slate-300 leading-relaxed">
            <div>
              <strong className="text-white block mb-1">1. Perché la tastiera è alimentata a 12V?</strong>
              <p className="text-slate-400">
                Nei distributori automatici e nei quadri industriali, i 12V (o 24V) sono scelti per garantire alta immunità ai disturbi elettromagnetici su cavi lunghi. L&apos;ESP32 tuttavia riceve solo 3.3V.
              </p>
            </div>

            <div>
              <strong className="text-white block mb-1">2. Logica dei Segnali tramite Optoisolatore PC817:</strong>
              <p className="text-slate-400">
                Quando si usa un modulo PC817, il fototransistor in uscita chiude verso GND quando il tasto a 12V viene premuto. Il pin GPIO dell&apos;ESP32 legge quindi un livello <code className="text-emerald-300 bg-black/30 px-1 py-0.5 rounded border border-white/10">LOW (0V)</code> quando il tasto è premuto e <code className="text-blue-300 bg-black/30 px-1 py-0.5 rounded border border-white/10">HIGH (3.3V)</code> a riposo.
              </p>
            </div>

            <div>
              <strong className="text-white block mb-1">3. Check-list di Verifica Finale prima di Accendere:</strong>
              <ul className="list-disc list-inside space-y-1 text-slate-400 mt-1">
                <li><strong className="text-slate-200">Test col Multimetro:</strong> Misura con il tester tra ciascun filo in ingresso all&apos;ESP32 e GND: la tensione <strong>non deve MAI superare 3.3V</strong> quando premi i tasti.</li>
                <li><strong className="text-slate-200">GND Comune:</strong> Se usi il partitore resistivo, il GND a 12V della macchina e il GND dell&apos;ESP32 devono essere uniti insieme. Se usi gli optoisolatori PC817, i GND rimangono isolati.</li>
                <li><strong className="text-slate-200">Debounce Software:</strong> Con segnali industriali a 12V, imposta il debounce tra 30ms e 50ms per evitare false letture dovute ai rimbalzi meccanici.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
