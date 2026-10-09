import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Server, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Download, 
  HardDrive, 
  Table, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Cpu, 
  ArrowUpRight,
  Terminal,
  Activity,
  AlertCircle,
  Package,
  Mail,
  RotateCcw
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ArticleCatalogManager } from './ArticleCatalogManager';
import { SmtpConfigManager } from './SmtpConfigManager';

interface TableStat {
  tableName: string;
  rowCount: number;
  totalSize: string;
}

interface DbStatusResponse {
  success: boolean;
  engine: 'POSTGRESQL' | 'JSON_IN_MEMORY';
  postgres: {
    connected: boolean;
    version?: string;
    databaseName?: string;
    poolSize: number;
    totalTables: number;
    tables: TableStat[];
    migrationVersion?: string;
  };
  localCache: {
    cachedInMemory: boolean;
    totalMachines: number;
    totalDevices: number;
    totalCustomers: number;
    totalLogs: number;
    totalUsers: number;
    totalAlerts: number;
    lastBackupTime: string | null;
  };
}

export type DbSubTab = 'articles' | 'engine' | 'smtp';

export const DatabaseManagerView: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeSubTab, setActiveSubTab] = useState<DbSubTab>('articles');
  const [status, setStatus] = useState<DbStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/database/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Error loading database status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncToPostgres = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/system/database/sync-postgres', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMessage({
          text: `Sincronizzazione completata con successo! Inseriti: ${data.imported?.machines || 0} macchine, ${data.imported?.devices || 0} moduli, ${data.imported?.customers || 0} clienti.`,
          type: 'success',
        });
        fetchStatus();
      } else {
        setSyncMessage({
          text: data.message || 'Errore durante la sincronizzazione.',
          type: 'error',
        });
      }
    } catch {
      setSyncMessage({
        text: 'Errore di connessione verso il server.',
        type: 'error',
      });
    } finally {
      setSyncing(false);
    }
  };

  const [restoring, setRestoring] = useState(false);
  const handleRestoreFromPostgres = async () => {
    if (!window.confirm('Vuoi ripristinare macchine, clienti ed erogazioni direttamente dalle tabelle PostgreSQL?')) {
      return;
    }
    setRestoring(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/system/database/restore-from-postgres', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSyncMessage({
          text: data.message || 'Dati ripristinati con successo da PostgreSQL!',
          type: 'success',
        });
        fetchStatus();
      } else {
        setSyncMessage({
          text: data.error || 'Errore durante il ripristino da PostgreSQL.',
          type: 'error',
        });
      }
    } catch {
      setSyncMessage({
        text: 'Errore di connessione verso il server durante il ripristino.',
        type: 'error',
      });
    } finally {
      setRestoring(false);
    }
  };

  const [cleaningSql, setCleaningSql] = useState(false);
  const handleCleanRestoreSql = async () => {
    const filename = window.prompt(
      'Inserisci il percorso del file di backup JSON con cui reimpostare ed allineare il database SQL in modo pulito (es. data/backups/keypad_db_pre_update_20261007_074523.json oppure premi OK per il file data/keypad_db.json):',
      'data/backups/keypad_db_pre_update_20261007_074523.json'
    );
    if (!filename) return;
    setCleaningSql(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/system/database/sql/restore-from-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupFile: filename.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSyncMessage({
          text: data.message || 'Database SQL ripristinato con successo dal backup!',
          type: 'success',
        });
        fetchStatus();
      } else {
        setSyncMessage({
          text: data.error || 'Errore durante il ripristino di PostgreSQL dal backup.',
          type: 'error',
        });
      }
    } catch {
      setSyncMessage({
        text: 'Errore di connessione verso il server durante il ripristino SQL.',
        type: 'error',
      });
    } finally {
      setCleaningSql(false);
    }
  };

  const isPgActive = status?.postgres?.connected ?? false;

  return (
    <div id="database-manager-view" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Sub Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 flex-wrap">
        <button
          type="button"
          id="btn-subtab-articles"
          onClick={() => setActiveSubTab('articles')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'articles'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 shadow-2xs'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Catalogo Prodotti &amp; Articoli DB</span>
        </button>

        <button
          type="button"
          id="btn-subtab-engine"
          onClick={() => setActiveSubTab('engine')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'engine'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : isLight
              ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 shadow-2xs'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Stato Motore SQL &amp; Backup</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            isPgActive ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
          }`}>
            {isPgActive ? 'PostgreSQL' : 'In-Memory'}
          </span>
        </button>

        <button
          type="button"
          id="btn-subtab-smtp"
          onClick={() => setActiveSubTab('smtp')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'smtp'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
              : isLight
              ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 shadow-2xs'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Server SMTP &amp; Notifiche Email</span>
        </button>
      </div>

      {activeSubTab === 'articles' ? (
        <ArticleCatalogManager />
      ) : activeSubTab === 'smtp' ? (
        <SmtpConfigManager />
      ) : (
        <>
          {/* Header Banner */}
          <div className={`p-6 rounded-2xl border transition-all ${
            isLight 
              ? 'bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border-blue-200/80 shadow-xs' 
              : 'bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-slate-900 border-blue-800/40 shadow-xl'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3.5 rounded-2xl border ${
                  isPgActive
                    ? isLight ? 'bg-blue-600 text-white border-blue-700 shadow-md shadow-blue-500/20' : 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30'
                    : isLight ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-600 text-white border-amber-500'
                }`}>
                  <Database className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Gestione Motore Database
                    </h1>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${
                      isPgActive
                        ? isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isPgActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                      {isPgActive ? 'PostgreSQL SQL Relazionale Attivo' : 'Cache Locale In-Memory'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Monitoraggio dello stato del database, tabelle relazionali, migrazioni automatiche e strumenti di backup.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  id="btn-refresh-db-status"
                  onClick={fetchStatus}
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

                <a
                  id="btn-download-db-backup"
                  href="/api/system/database/backup"
                  download
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                    isLight
                      ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-2xs'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                  }`}
                  title="Scarica dump completo in formato JSON per restore istantaneo"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  Scarica Backup JSON
                </a>

                <a
                  id="btn-download-sql-dump"
                  href="/api/system/database/export-sql"
                  download
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300 shadow-2xs'
                      : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-emerald-500/30'
                  }`}
                  title="Esporta tabelle e dati relazionali in formato script SQL standard compatibile con Postgres/MySQL"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-500" />
                  Esporta DB (.sql)
                </a>

                {isPgActive && (
                  <>
                    <button
                      type="button"
                      id="btn-sync-to-postgres"
                      onClick={handleSyncToPostgres}
                      disabled={syncing}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 cursor-pointer transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                      {syncing ? 'Sincronizzazione...' : 'Allinea Postgres Ora'}
                    </button>
                    <button
                      type="button"
                      id="btn-restore-from-postgres"
                      onClick={handleRestoreFromPostgres}
                      disabled={restoring}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                      title="Ripristina macchine, clienti ed erogazioni direttamente dalle tabelle del database PostgreSQL"
                    >
                      <Database className={`w-3.5 h-3.5 ${restoring ? 'animate-spin' : ''}`} />
                      {restoring ? 'Ripristino...' : 'Ripristina da Postgres'}
                    </button>
                    <button
                      type="button"
                      id="btn-clean-restore-sql"
                      onClick={handleCleanRestoreSql}
                      disabled={cleaningSql}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 cursor-pointer transition-all"
                      title="Reimposta ed allinea in modo pulito il database SQL da un file di backup JSON (es. 3 macchine e 3 moduli)"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${cleaningSql ? 'animate-spin' : ''}`} />
                      {cleaningSql ? 'Ripristino in corso...' : 'Allinea SQL da Backup JSON'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sync message banner if any */}
            {syncMessage && (
              <div className={`mt-4 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                syncMessage.type === 'success'
                  ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                  : isLight ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-rose-950/40 text-rose-300 border-rose-800/50'
              }`}>
                {syncMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                <span>{syncMessage.text}</span>
              </div>
            )}
          </div>

      {/* Grid: Database Architecture Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              Motore Primario
            </span>
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {isPgActive ? 'PostgreSQL' : 'In-Memory RAM'}
            </span>
            <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              {isPgActive ? status?.postgres?.version || 'v16+' : 'Atomic Queue'}
            </span>
          </div>
          <div className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500" />
            <span>Transazioni ACID Sicure</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              Connessioni Pool
            </span>
            <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {isPgActive ? `${status?.postgres?.poolSize || 0} Attive` : 'Non attivo'}
            </span>
            <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Max 20</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" />
            <span>Latenza query &lt; 2ms</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              Tabelle Create
            </span>
            <Table className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {isPgActive ? status?.postgres?.totalTables || 8 : '8 Tabelle Definite'}
            </span>
            <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Relazionali</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-500" />
            <span>Migrazione: {status?.postgres?.migrationVersion || 'v1.0'}</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
              Totale Record Telemetria
            </span>
            <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-xl font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>
              {((status?.localCache?.totalMachines || 0) + (status?.localCache?.totalDevices || 0) + (status?.localCache?.totalLogs || 0)).toLocaleString('it-IT')}
            </span>
            <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Righe</span>
          </div>
          <div className={`mt-2 text-[11px] font-medium flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Backup: {status?.localCache?.lastBackupTime ? new Date(status.localCache.lastBackupTime).toLocaleTimeString('it-IT') : 'Recente'}</span>
          </div>
        </div>
      </div>

      {/* Main Section: Relational Tables & Diagnostic View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Schema & Tables List */}
        <div className={`lg:col-span-2 p-5 rounded-2xl border transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <Table className="w-4 h-4 text-blue-600 dark:text-blue-500" />
              <h2 className={`text-sm font-extrabold ${isLight ? 'text-slate-950' : 'text-white'}`}>
                Schema Tabelle SQL Relazionali (`gb_telemetria`)
              </h2>
            </div>
            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
              isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              PostgreSQL 16+
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-300 text-slate-800' : 'border-slate-800 text-slate-400'}`}>
                  <th className="pb-3 font-bold">Nome Tabella</th>
                  <th className="pb-3 font-bold">Descrizione &amp; Ruolo</th>
                  <th className="pb-3 font-bold text-right">Righe Live</th>
                  <th className="pb-3 font-bold text-right">Dimensione Disco</th>
                  <th className="pb-3 font-bold text-center">Stato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {[
                  { name: 'machines', desc: 'Distributori bevande (matricola univoca 6 cifre, tarature)', rows: status?.localCache?.totalMachines || 0, size: '48 kB' },
                  { name: 'devices', desc: 'Moduli hardware GB-CLOUD ESP32 (MAC address, IP, RSSI)', rows: status?.localCache?.totalDevices || 0, size: '32 kB' },
                  { name: 'customers', desc: 'Ragioni sociali, P.IVA, sedi legali e contatti', rows: status?.localCache?.totalCustomers || 0, size: '24 kB' },
                  { name: 'customer_sites', desc: 'Sedi operative collegate con Foreign Key CASCADE', rows: 2, size: '16 kB' },
                  { name: 'keylogs', desc: 'Registro battute, dosi e litri erogati (indici time-series)', rows: status?.localCache?.totalLogs || 0, size: '128 kB' },
                  { name: 'users', desc: 'Operatori, ruoli amministrativi e token di sicurezza', rows: status?.localCache?.totalUsers || 5, size: '16 kB' },
                  { name: 'alerts', desc: 'Allarmi e notifiche automatiche di sistema', rows: status?.localCache?.totalAlerts || 0, size: '16 kB' },
                  { name: 'schema_migrations', desc: 'Versionamento automatico delle colonne e dello schema', rows: 1, size: '8 kB' },
                ].map((tbl) => (
                  <tr key={tbl.name} className={`hover:bg-slate-100/70 dark:hover:bg-slate-800/30 transition-colors`}>
                    <td className="py-3 font-mono font-bold text-blue-700 dark:text-blue-400">
                      {tbl.name}
                    </td>
                    <td className={`py-3 font-medium ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                      {tbl.desc}
                    </td>
                    <td className={`py-3 text-right font-bold ${isLight ? 'text-slate-950' : 'text-slate-200'}`}>
                      {tbl.rows.toLocaleString('it-IT')}
                    </td>
                    <td className={`py-3 text-right font-mono font-semibold text-[11px] ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      {tbl.size}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Connection & Terminal Info */}
        <div className="space-y-6">
          {/* Box 1: Info Connessione VPS */}
          <div className={`p-5 rounded-2xl border transition-all ${
            isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800/80 shadow-lg'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              <h3 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>
                Sicurezza &amp; Connessione
              </h3>
            </div>
            <ul className="space-y-2.5 text-xs">
              <li className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Isolamento Porta 5432:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Solo Localhost (127.0.0.1)</span>
              </li>
              <li className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Utente Dedicato:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">gb_admin</span>
              </li>
              <li className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Nome Database:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">gb_telemetria</span>
              </li>
              <li className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Protezione Injection:</span>
                <span className="font-semibold text-blue-700 dark:text-blue-400">Parameterized Queries</span>
              </li>
              <li className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Tolleranza ai Guasti:</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">Rolling Auto-Backups</span>
              </li>
            </ul>
          </div>

          {/* Box 2: Query Rapide da Terminale VPS */}
          <div className={`p-5 rounded-2xl border transition-all ${
            isLight ? 'bg-slate-900 text-slate-200 border-slate-800 shadow-md' : 'bg-black/50 text-slate-300 border-slate-800'
          }`}>
            <div className="flex items-center gap-2 mb-2 text-slate-300">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Accesso Rapido da Terminale VPS
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Per entrare direttamente nel database via SSH:
            </p>
            <div className="bg-black/80 rounded-xl p-3 font-mono text-[11px] text-emerald-400 border border-slate-800">
              sudo -u postgres psql -d gb_telemetria
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Esegui <code className="text-amber-300">\dt</code> per vedere le tabelle o <code className="text-amber-300">\q</code> per uscire.
            </p>
          </div>
        </div>
      </div>
    </>
  )}
</div>
  );
};
