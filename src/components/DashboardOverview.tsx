import React, { useState, useEffect, useMemo } from 'react';
import { KeyLog, ServerStats, VendingMachine, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';
import { normalizeMatrixKey } from '../utils/keypadMapping';
import { PortalBrandLogo } from './PortalBrandLogo';
import {
  Server,
  Activity,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  BarChart3,
  Layers,
  Building2,
  MapPin,
  Plus,
  ShieldCheck,
} from 'lucide-react';

interface DashboardOverviewProps {
  logs: KeyLog[];
  stats: ServerStats | null;
  serverOnline: boolean;
  mqttOnline: boolean;
  onNavigateToMachines?: () => void;
  onNavigateToData?: () => void;
  onNavigateToProgramming?: () => void;
  onNavigateToDatabase?: () => void;
  onSelectMachineForKeymap?: (machineId: string) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  logs,
  stats,
  serverOnline,
  mqttOnline,
  onNavigateToMachines,
  onNavigateToData,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchFleetData = async () => {
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/customers').catch(() => null),
      ]);

      if (mRes.ok) {
        const mData = await mRes.json();
        setMachines(Array.isArray(mData) ? mData : (mData.machines || []));
      }
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        setCustomers(Array.isArray(cData) ? cData : (cData.customers || []));
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
    const interval = setInterval(fetchFleetData, 8000);
    return () => clearInterval(interval);
  }, []);

  // Compute model metrics
  const modelStats = {
    ristosano: machines.filter((m) => m.model === 'Ristosano'),
    big5: machines.filter((m) => m.model === 'Big 5'),
    asia: machines.filter((m) => m.model === 'Asia'),
  };

  const onlineMachinesCount = machines.filter(
    (m) => m.status === 'ONLINE' || m.status === 'DISPENSING'
  ).length;

  // Filter valid logs (exclude raw standalone CARAFFA keypress)
  const validLogs = useMemo(() => {
    return logs.filter((l) => l.key !== 'CARAFFA' && normalizeMatrixKey(l.key) !== 'CARAFFA');
  }, [logs]);

  const recentLogs = useMemo(() => {
    return validLogs.slice(0, 6);
  }, [validLogs]);

  // Erogazioni registrate oggi (calcolato strettamente sul giorno solare corrente 00:00 - 23:59 locale)
  const todayDispensesCount = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return validLogs.filter((log) => {
      if (!log.timestamp) return false;
      const d = new Date(log.timestamp);
      if (isNaN(d.getTime())) return false;
      return d >= todayStart && d <= todayEnd;
    }).length;
  }, [validLogs]);

  // Dosi Totali cumulative della flotta (somma dei contatori a bordo macchina + battute registrate)
  const totalCumulativeDispenses = useMemo(() => {
    const machinesTotal = machines.reduce(
      (sum, m) => sum + (m.supplies?.totalDispenses || (m as any).totalPresses || 0),
      0
    );
    const serverFleetTotal = stats?.totalFleetDispenses || 0;
    const logsTotal = stats?.totalKeypresses ?? validLogs.length;
    return Math.max(machinesTotal, serverFleetTotal, logsTotal);
  }, [machines, stats?.totalFleetDispenses, stats?.totalKeypresses, validLogs.length]);

  // Numero di bevande/tasti unici erogati
  const uniqueBeveragesCount = useMemo(() => {
    const set = new Set<string>();
    validLogs.forEach((l) => {
      const label = l.productName || l.keyLabel || l.key;
      if (label) set.add(label);
    });
    return set.size > 0 ? set.size : (stats?.uniqueKeys || 12);
  }, [validLogs, stats?.uniqueKeys]);

  // Total customer sites count
  const totalSitesCount = customers.reduce((acc, c) => acc + (c.sites?.length || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER - OPERATOR CLEAN */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 shadow-sm border transition-colors ${
          isLight
            ? 'bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border-slate-200'
            : 'bg-gradient-to-r from-slate-900 via-blue-950/70 to-slate-900 border-white/10 shadow-2xl backdrop-blur-md'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Brand Logo Container */}
              <div className="bg-white px-3 py-1 rounded-xl shadow-xs border border-slate-200/90 inline-flex items-center">
                <PortalBrandLogo size="sm" className="h-7 w-auto" />
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                Portale Operatore
              </span>
              <span
                className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                  isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Telemetria Attiva
              </span>
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Dashboard Telemetria &amp; Distributori
            </h1>
            <p className={`text-sm max-w-2xl ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Panoramica operativa della flotta distributori, stato dei consumi e monitoraggio in tempo reale delle erogazioni.
            </p>
          </div>

          {/* Quick Action Navigation Buttons */}
          {(onNavigateToMachines || onNavigateToData) && (
            <div className="flex flex-wrap items-center gap-3">
              {onNavigateToMachines && (
                <button
                  onClick={onNavigateToMachines}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all duration-200 shadow-md shadow-blue-600/25 cursor-pointer hover:scale-[1.02]"
                >
                  <Server className="w-4 h-4" />
                  <span>Gestione Distributori</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {onNavigateToData && (
                <button
                  onClick={onNavigateToData}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-xs border transition-all duration-200 cursor-pointer hover:scale-[1.02] ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-amber-500" />
                  <span>Erogazioni &amp; Consumi</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Empty State Banner if 0 machines */}
      {machines.length === 0 && (
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isLight
              ? 'bg-blue-50/70 border-blue-200 text-blue-950 shadow-xs'
              : 'bg-blue-950/30 border-blue-500/30 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Nessun distributore configurato</h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Aggiungi il tuo primo distributore per iniziare a monitorare le erogazioni e i consumi.
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateToMachines}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Aggiungi Distributore</span>
          </button>
        </div>
      )}

      {/* TOP KPI CARDS - OPERATOR ORIENTED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Distributori Totali */}
        <div
          className={`rounded-2xl p-5 border transition-all ${
            isLight
              ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              : 'bg-slate-900/80 border-white/10 shadow-lg hover:border-blue-500/40 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Distributori Flotta
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isLight ? 'bg-slate-100 border-slate-200 text-slate-700' : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Server className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {machines.length}
            </span>
            <span className={`text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {onlineMachinesCount} In Linea
            </span>
          </div>
          <div
            className={`mt-3 text-[11px] flex items-center justify-between border-t pt-2 font-mono ${
              isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
            }`}
          >
            <span>Ristosano: {modelStats.ristosano.length}</span>
            <span>Big 5: {modelStats.big5.length}</span>
            <span>Asia: {modelStats.asia.length}</span>
          </div>
        </div>

        {/* Card 2: Erogazioni Registrate */}
        <div
          className={`rounded-2xl p-5 border transition-all ${
            isLight
              ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              : 'bg-slate-900/80 border-white/10 shadow-lg hover:border-slate-700 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Erogazioni Registrate
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isLight ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {totalCumulativeDispenses.toLocaleString('it-IT')}
            </span>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Dosi Totali Cumulate
            </span>
          </div>
          <div
            className={`mt-3 text-[11px] flex items-center justify-between border-t pt-2 font-mono ${
              isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
            }`}
          >
            <span>
              Oggi ({new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}):{' '}
              <strong className={isLight ? 'text-emerald-700 font-bold' : 'text-emerald-400 font-bold'}>
                {todayDispensesCount} {todayDispensesCount === 1 ? 'dose' : 'dosi'}
              </strong>
            </span>
            <span>Bevande attive: {uniqueBeveragesCount}</span>
          </div>
        </div>

        {/* Card 3: Clienti & Punti Ristoro */}
        <div
          className={`rounded-2xl p-5 border transition-all ${
            isLight
              ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              : 'bg-slate-900/80 border-white/10 shadow-lg hover:border-slate-700 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Clienti &amp; Sedi
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-extrabold font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {customers.length}
            </span>
            <span className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
              Aziende Clienti
            </span>
          </div>
          <div
            className={`mt-3 text-[11px] flex items-center justify-between border-t pt-2 font-mono ${
              isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
            }`}
          >
            <span>Sedi operative: {totalSitesCount}</span>
            <span>Installazioni attive: {machines.filter((m) => Boolean(m.customerId)).length}</span>
          </div>
        </div>

        {/* Card 4: Stato Servizio Operativo */}
        <div
          className={`rounded-2xl p-5 border transition-all ${
            isLight
              ? 'bg-white border-slate-200 shadow-sm'
              : 'bg-slate-900/80 border-white/10 shadow-lg backdrop-blur-md'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Stato Servizio Hub
            </span>
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                serverOnline
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Sistema Centrale:</span>
              <span
                className={`font-bold flex items-center gap-1.5 ${
                  serverOnline ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : 'text-rose-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-600 animate-pulse' : 'bg-rose-500'}`} />
                {serverOnline ? 'Operativo' : 'Non raggiungibile'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>Flotta Connessa:</span>
              <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {onlineMachinesCount} su {machines.length} attivi
              </span>
            </div>
          </div>
          <div
            className={`mt-2 text-[10px] pt-1.5 border-t ${
              isLight ? 'border-slate-100 text-slate-500' : 'border-white/5 text-slate-400'
            }`}
          >
            Sincronizzazione in tempo reale attiva
          </div>
        </div>
      </div>

      {/* THREE EXCLUSIVE MACHINE MODELS BREAKDOWN */}
      <div
        className={`rounded-3xl p-6 border space-y-4 transition-all ${
          isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
        }`}
      >
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${
          isLight ? 'border-slate-200' : 'border-white/10'
        }`}>
          <div>
            <h2 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Layers className="w-5 h-5 text-emerald-500" />
              Parco Distributori per Modello
            </h2>
            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Riepilogo e stato operativo per i modelli: <strong>Ristosano</strong>, <strong>Big 5</strong> e <strong>Asia</strong>.
            </p>
          </div>
          <button
            onClick={onNavigateToMachines}
            className={`text-xs flex items-center gap-1 font-semibold transition-colors ${
              isLight ? 'text-emerald-600 hover:text-emerald-800' : 'text-emerald-300 hover:text-white'
            }`}
          >
            <span>Gestisci Distributori</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Model 1: Ristosano */}
          <div
            className={`rounded-2xl p-4 space-y-3 border transition-all ${
              isLight
                ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300'
                : 'bg-black/40 border-emerald-500/30 hover:border-emerald-500/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${
                    isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                  }`}
                >
                  R
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Ristosano</h3>
                  <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Distributore Bevande
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${
                  isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {modelStats.ristosano.length} Impianti
              </span>
            </div>

            <div className="text-xs space-y-1.5 pt-1">
              {modelStats.ristosano.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] border ${
                    isLight ? 'bg-white border-emerald-100 text-slate-800 shadow-2xs' : 'bg-white/5 border-transparent text-white'
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold block truncate">{m.name}</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Matr. #{m.serialNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                      m.status === 'ONLINE' || m.status === 'DISPENSING'
                        ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        m.status === 'ONLINE' || m.status === 'DISPENSING' ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}
                    />
                    {m.status === 'ONLINE' ? 'In linea' : m.status === 'DISPENSING' ? 'Erogazione' : 'Disconnesso'}
                  </span>
                </div>
              ))}
              {modelStats.ristosano.length === 0 && (
                <p className={`text-[11px] italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Nessun distributore Ristosano registrato
                </p>
              )}
            </div>
          </div>

          {/* Model 2: Big 5 */}
          <div
            className={`rounded-2xl p-4 space-y-3 border transition-all ${
              isLight
                ? 'bg-blue-50/40 border-blue-200 hover:border-blue-300'
                : 'bg-black/40 border-blue-500/30 hover:border-blue-500/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${
                    isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-400/40 text-blue-300'
                  }`}
                >
                  B5
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Big 5</h3>
                  <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Distributore Bevande
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${
                  isLight ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                }`}
              >
                {modelStats.big5.length} Impianti
              </span>
            </div>

            <div className="text-xs space-y-1.5 pt-1">
              {modelStats.big5.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] border ${
                    isLight ? 'bg-white border-blue-100 text-slate-800 shadow-2xs' : 'bg-white/5 border-transparent text-white'
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold block truncate">{m.name}</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Matr. #{m.serialNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                      m.status === 'ONLINE' || m.status === 'DISPENSING'
                        ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        m.status === 'ONLINE' || m.status === 'DISPENSING' ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}
                    />
                    {m.status === 'ONLINE' ? 'In linea' : m.status === 'DISPENSING' ? 'Erogazione' : 'Disconnesso'}
                  </span>
                </div>
              ))}
              {modelStats.big5.length === 0 && (
                <p className={`text-[11px] italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Nessun distributore Big 5 registrato
                </p>
              )}
            </div>
          </div>

          {/* Model 3: Asia */}
          <div
            className={`rounded-2xl p-4 space-y-3 border transition-all ${
              isLight
                ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                : 'bg-black/40 border-amber-500/30 hover:border-amber-500/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center font-bold text-xs ${
                    isLight ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                  }`}
                >
                  A
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Asia</h3>
                  <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Distributore Bevande
                  </span>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold font-mono border ${
                  isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                }`}
              >
                {modelStats.asia.length} Impianti
              </span>
            </div>

            <div className="text-xs space-y-1.5 pt-1">
              {modelStats.asia.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] border ${
                    isLight ? 'bg-white border-amber-100 text-slate-800 shadow-2xs' : 'bg-white/5 border-transparent text-white'
                  }`}
                >
                  <div className="truncate mr-2">
                    <span className="font-semibold block truncate">{m.name}</span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Matr. #{m.serialNumber}
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shrink-0 ${
                      m.status === 'ONLINE' || m.status === 'DISPENSING'
                        ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        m.status === 'ONLINE' || m.status === 'DISPENSING' ? 'bg-emerald-600' : 'bg-slate-400'
                      }`}
                    />
                    {m.status === 'ONLINE' ? 'In linea' : m.status === 'DISPENSING' ? 'Erogazione' : 'Disconnesso'}
                  </span>
                </div>
              ))}
              {modelStats.asia.length === 0 && (
                <p className={`text-[11px] italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  Nessun distributore Asia registrato
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TWO COLUMN GRID: RECENT DISPENSES & OPERATOR FLEET STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT DISPENSES */}
        <div
          className={`rounded-3xl p-6 border space-y-4 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-500" />
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Ultime Erogazioni in Tempo Reale
              </h3>
            </div>
            <button
              onClick={onNavigateToData}
              className={`text-xs flex items-center gap-1 font-semibold transition-colors ${
                isLight ? 'text-amber-700 hover:text-amber-900' : 'text-amber-300 hover:text-white'
              }`}
            >
              <span>Vedi storico completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {recentLogs.map((log) => {
              const canonicalKey = normalizeMatrixKey(log.key);
              const isCaraffaDose = Boolean(
                log.isCaraffa ||
                log.doseType === 'CARAFFA' ||
                (log.productName && log.productName.toLowerCase().includes('caraffa')) ||
                (log.keyLabel && log.keyLabel.toLowerCase().includes('erogazione caraffa'))
              );

              return (
                <div
                  key={log.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                      : 'bg-black/40 border-white/5 hover:border-white/20 text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold text-xs shrink-0 ${
                        isCaraffaDose
                          ? isLight ? 'bg-cyan-100 text-cyan-900 border-cyan-300' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      <Coffee className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold block ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {log.productName || log.keyLabel || `Bevanda ${canonicalKey}`}
                        </span>
                        {isCaraffaDose && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${
                              isLight ? 'bg-cyan-100 text-cyan-900 border-cyan-300' : 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50'
                            }`}
                          >
                            Caraffa
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {log.machineName || log.deviceId} &bull; Matr. #{log.machineSerialNumber || '104829'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-[11px] font-semibold block ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                      {new Date(log.timestamp).toLocaleDateString([], { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}

            {recentLogs.length === 0 && (
              <div className={`text-center py-8 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Nessuna erogazione recente registrata.
              </div>
            )}
          </div>
        </div>

        {/* OPERATOR FLEET QUICK VIEW (REPLACING TECHNICAL WATCHDOG/MAC PANEL) */}
        <div
          className={`rounded-3xl p-6 border space-y-4 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
          }`}
        >
          <div className={`flex items-center justify-between border-b pb-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-600" />
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Stato Operativo Impianti
              </h3>
            </div>
            <button
              onClick={onNavigateToMachines}
              className={`text-xs flex items-center gap-1 font-semibold transition-colors ${
                isLight ? 'text-blue-700 hover:text-blue-900' : 'text-blue-400 hover:text-white'
              }`}
            >
              <span>Vedi tutti gli impianti</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {machines.slice(0, 5).map((m) => {
              const cust = customers.find((c) => c.id === m.customerId);
              const site = cust?.sites?.find((s) => s.id === m.customerSiteId);

              return (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-800'
                      : 'bg-black/40 border-white/5 hover:border-white/20 text-white'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {m.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                          isLight ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        #{m.serialNumber}
                      </span>
                    </div>
                    <div className={`text-[11px] truncate flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {cust ? `${cust.name}${site ? ` • ${site.name}` : ''}` : m.location || 'Magazzino'}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        m.status === 'ONLINE' || m.status === 'DISPENSING'
                          ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          m.status === 'ONLINE' || m.status === 'DISPENSING' ? 'bg-emerald-600' : 'bg-slate-400'
                        }`}
                      />
                      {m.status === 'ONLINE' ? 'In linea' : m.status === 'DISPENSING' ? 'Erogazione' : 'Disconnesso'}
                    </span>
                  </div>
                </div>
              );
            })}

            {machines.length === 0 && (
              <div className={`text-center py-8 text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                Nessun distributore configurato.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
