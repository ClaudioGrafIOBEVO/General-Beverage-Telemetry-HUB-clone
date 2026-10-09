import React, { useState } from 'react';
import { KeyLog, ServerStats, VendingMachine, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { LiveMonitor } from './LiveMonitor';
import { KeypadSimulator } from './KeypadSimulator';
import {
  BarChart3,
  Activity,
  Cpu,
  Layers,
  Search,
  Filter,
  Download,
  Trash2,
  PieChart,
  TrendingUp,
  Sliders,
  Sparkles,
  Barcode,
  Building2,
  MapPin,
  ChevronDown,
  Wifi,
  Coffee,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface DataAnalyticsViewProps {
  logs: KeyLog[];
  stats: ServerStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClearLogs: () => Promise<void>;
  onKeyLogged: (log: KeyLog) => void;
  selectedMachineId: string;
  onMachineChanged: (machineId: string) => void;
  machines?: VendingMachine[];
  customers?: Customer[];
}

export const DataAnalyticsView: React.FC<DataAnalyticsViewProps> = ({
  logs,
  stats,
  isLoading,
  onRefresh,
  onClearLogs,
  onKeyLogged,
  selectedMachineId,
  onMachineChanged,
  machines = [],
  customers = [],
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [dataSubTab, setDataSubTab] = useState<'logs' | 'simulator'>('logs');

  // Find currently active machine or default to first
  const activeMachine =
    machines.find(
      (m) =>
        m.serialNumber === selectedMachineId ||
        m.id === selectedMachineId ||
        m.deviceId === selectedMachineId
    ) || machines[0] || null;

  // Find linked customer and site
  const linkedCustomer = activeMachine
    ? customers.find((c) => c.id === activeMachine.customerId) || null
    : null;

  const linkedSite =
    linkedCustomer && activeMachine
      ? linkedCustomer.sites.find((s) => s.id === activeMachine.customerSiteId) || null
      : null;

  // Machine count stats from logs (escludendo la pressione del tasto CARAFFA)
  const validLogs = logs.filter((l) => l.key !== 'CARAFFA');
  const machineLogsCount = activeMachine
    ? validLogs.filter(
        (l) =>
          l.machineSerialNumber === activeMachine.serialNumber ||
          l.deviceId === activeMachine.deviceId ||
          l.machineName === activeMachine.name
      ).length
    : validLogs.length;

  return (
    <div className="space-y-6">
      {/* 1. PROMINENT MACHINE, CLIENT & SITE CONTEXT BANNER */}
      <div
        id="machine-context-banner"
        className={`rounded-3xl p-5 border transition-all shadow-md ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50/90 via-white to-blue-50/90 border-emerald-200/80 text-slate-800'
            : 'bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-blue-950/40 border-emerald-500/30 text-white shadow-xl backdrop-blur-md'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Machine Matricola & Name */}
          <div className="flex items-start sm:items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl border flex flex-col items-center justify-center shrink-0 shadow-sm ${
                isLight
                  ? 'bg-emerald-600 border-emerald-700 text-white'
                  : 'bg-emerald-600/30 border-emerald-400/40 text-emerald-300'
              }`}
            >
              <Barcode className="w-6 h-6" />
              <span className="text-[9px] font-mono font-black uppercase tracking-wider">MATR.</span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-xl text-base font-mono font-black tracking-wider border shadow-xs ${
                    isLight
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                      : 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                  }`}
                >
                  #{activeMachine?.serialNumber || '104829'}
                </span>

                <span
                  className={`text-base font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}
                >
                  {activeMachine?.name || 'Distributore Bevande'}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold border ${
                    isLight
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {activeMachine?.model || 'Ristosano'}
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ONLINE
                </span>
              </div>

              {/* IoT Device ID & Dispenses */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={`inline-flex items-center gap-1 font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Modulo Hardware:
                  <strong className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                    {activeMachine?.deviceId || 'Modulo Associato'}
                  </strong>
                </span>
                <span className={isLight ? 'text-slate-400' : 'text-slate-600'}>•</span>
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Erogazioni Registrate:{' '}
                  <strong className="text-emerald-600 font-bold">{machineLogsCount}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Customer & Site Details Box */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div
              className={`p-3.5 rounded-2xl border min-w-[260px] max-w-md ${
                isLight ? 'bg-white/90 border-slate-200 shadow-xs' : 'bg-black/30 border-white/10'
              }`}
            >
              <div className="space-y-1.5">
                {/* Cliente */}
                <div className="flex items-center gap-2">
                  <Building2
                    className={`w-4 h-4 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}
                  />
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider block ${
                        isLight ? 'text-blue-700' : 'text-blue-300'
                      }`}
                    >
                      Cliente Intestatario
                    </span>
                    <span
                      className={`font-bold text-sm truncate block ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}
                    >
                      {linkedCustomer?.name || activeMachine?.location || 'IVS Italia S.p.A.'}
                    </span>
                  </div>
                </div>

                {/* Sede Operativa */}
                <div className="flex items-start gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                  <MapPin
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isLight ? 'text-emerald-600' : 'text-emerald-400'
                    }`}
                  />
                  <div className="min-w-0">
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider block ${
                        isLight ? 'text-emerald-700' : 'text-emerald-400'
                      }`}
                    >
                      Sede Operativa Distributore
                    </span>
                    <span
                      className={`font-semibold text-xs truncate block ${
                        isLight ? 'text-slate-800' : 'text-slate-200'
                      }`}
                    >
                      {linkedSite?.name || 'Sede Direzionale Milano - Torre A'}
                    </span>
                    <span
                      className={`text-[11px] truncate block ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {linkedSite?.address
                        ? `${linkedSite.address}, ${linkedSite.city || ''} ${
                            linkedSite.province ? `(${linkedSite.province})` : ''
                          }`
                        : 'Via Stephenson 73, Milano (MI)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Switch Machine Dropdown */}
            {machines.length > 0 && (
              <div className="flex flex-col justify-center">
                <label
                  htmlFor="quick-switch-machine-select"
                  className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Cambia Distributore
                </label>
                <select
                  id="quick-switch-machine-select"
                  value={activeMachine?.serialNumber || selectedMachineId}
                  onChange={(e) => onMachineChanged(e.target.value)}
                  className={`text-xs font-semibold rounded-xl px-3 py-2.5 border transition-all cursor-pointer ${
                    isLight
                      ? 'bg-white border-emerald-300 text-slate-900 shadow-xs hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500'
                      : 'bg-slate-800 border-emerald-500/40 text-white hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400'
                  }`}
                >
                  {machines.map((m) => {
                    const cust = customers.find((c) => c.id === m.customerId);
                    return (
                      <option key={m.id} value={m.serialNumber}>
                        #{m.serialNumber} - {m.name} {cust ? `(${cust.name})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION BAR */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl p-5 border transition-all ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                isLight
                  ? 'bg-amber-100 border-amber-300 text-amber-700'
                  : 'bg-amber-500/20 border-amber-500/30 text-amber-300'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1
                className={`text-xl font-extrabold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}
              >
                Visualizzazione Dati &amp; Consumi
              </h1>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Registro cronologico delle erogazioni, verifica consumi e test della tastiera distributore.
              </p>
            </div>
          </div>
        </div>

        {/* SUB-TABS */}
        <div
          className={`flex items-center gap-1.5 p-1.5 rounded-2xl border shrink-0 ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'
          }`}
        >
          <button
            onClick={() => setDataSubTab('logs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              dataSubTab === 'logs'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 font-bold'
                  : 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-bold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Registro Erogazioni ({logs.length})</span>
          </button>

          <button
            onClick={() => setDataSubTab('simulator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              dataSubTab === 'simulator'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25 font-bold'
                  : 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 font-bold'
                : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Simulatore Erogazione &amp; Tastiera</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: LIVE MONITOR & LOGS TABLE */}
      {dataSubTab === 'logs' && (
        <div className="space-y-6">
          <LiveMonitor
            logs={logs}
            stats={stats}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onClearLogs={onClearLogs}
            machines={machines}
            customers={customers}
            initialMachineFilter="ALL"
          />
        </div>
      )}

      {/* SUB-TAB 2: INTERACTIVE HARDWARE KEYPAD SIMULATOR */}
      {dataSubTab === 'simulator' && (
        <div className="space-y-6">
          <KeypadSimulator
            initialDeviceId={selectedMachineId}
            onKeyLogged={onKeyLogged}
            onBeverageDispensed={onRefresh}
          />
        </div>
      )}
    </div>
  );
};

