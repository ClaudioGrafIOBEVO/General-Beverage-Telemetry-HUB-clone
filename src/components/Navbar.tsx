import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Server, BarChart3, Code, Coffee, LogOut, Sun, Moon, Building2, RefreshCw, CheckCircle2, Clock, Database, Tablet, Cpu, Radio } from 'lucide-react';
import { AuthUser, RolePermissionDefinition } from '../types';
import { useTheme } from '../context/ThemeContext';
import { PortalBrandLogo } from './PortalBrandLogo';

export type ActiveTab = 'dashboard' | 'machines' | 'customers' | 'data' | 'programming' | 'ota' | 'database' | 'touch-panel' | 'opta-lab';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  serverOnline: boolean;
  totalLogs: number;
  mqttOnline?: boolean;
  currentUser?: AuthUser | null;
  rolePermissions?: RolePermissionDefinition[];
  onOpenUserMenu?: () => void;
  onLogout?: () => void;
  onRefreshApp?: () => Promise<void> | void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  serverOnline,
  totalLogs,
  mqttOnline = true,
  currentUser,
  rolePermissions,
  onOpenUserMenu,
  onLogout,
  onRefreshApp,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [appVersion, setAppVersion] = useState<string>('v2.4.0');
  const [currentTime, setCurrentTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [showUpdateSuccess, setShowUpdateSuccess] = useState<boolean>(false);

  // Keep digital clock live
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch initial app info
  useEffect(() => {
    fetch('/api/system/app-info')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.version) {
          setAppVersion(data.version);
          if (data.formattedTime) {
            setLastUpdatedTime(data.formattedTime);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateApp = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    try {
      if (onRefreshApp) {
        await onRefreshApp();
      } else {
        await fetch('/api/system/refresh-app', { method: 'POST' });
      }

      // Refresh app info
      const res = await fetch('/api/system/app-info');
      if (res.ok) {
        const data = await res.json();
        if (data.version) setAppVersion(data.version);
        if (data.formattedTime) setLastUpdatedTime(data.formattedTime);
      } else {
        setLastUpdatedTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }

      setShowUpdateSuccess(true);
      setTimeout(() => setShowUpdateSuccess(false), 2500);
    } catch {
      setLastUpdatedTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } finally {
      setIsUpdating(false);
    }
  };

  const userRoleDef = rolePermissions?.find((r) => r.id === currentUser?.role);
  const defaultRoleTabs: string[] = userRoleDef
    ? userRoleDef.allowedTabs
    : currentUser?.role === 'admin'
    ? ['dashboard', 'machines', 'customers', 'data', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database']
    : currentUser?.role === 'tecnico'
    ? ['dashboard', 'machines', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database']
    : currentUser?.role === 'gestore'
    ? ['dashboard', 'machines', 'customers', 'data', 'programming', 'database']
    : currentUser?.role === 'operatore'
    ? ['dashboard', 'machines', 'data', 'touch-panel']
    : currentUser?.role === 'cliente'
    ? ['dashboard']
    : ['dashboard', 'data'];

  const userAllowedTabs: string[] =
    currentUser?.role === 'admin'
      ? ['dashboard', 'machines', 'customers', 'data', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database']
      : Array.isArray(currentUser?.customAllowedTabs) && currentUser.customAllowedTabs.length > 0
      ? currentUser.customAllowedTabs
      : defaultRoleTabs;

  const isClienteUser = currentUser?.role === 'cliente';

  const ALL_NAV_ITEMS: Array<{
    id: ActiveTab;
    shortLabel: string;
    mediumLabel: string;
    fullLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'dashboard',
      shortLabel: isClienteUser ? 'Cruscotto' : 'Dashboard',
      mediumLabel: isClienteUser ? 'Cruscotto Sede' : 'Dashboard',
      fullLabel: isClienteUser ? 'Cruscotto Sede & Ordini' : 'Dashboard Principale',
      icon: <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />,
    },
    {
      id: 'machines',
      shortLabel: 'Macchine',
      mediumLabel: 'Macchine',
      fullLabel: 'Macchine & Moduli',
      icon: <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />,
    },
    {
      id: 'customers',
      shortLabel: 'Clienti',
      mediumLabel: 'Clienti',
      fullLabel: 'Clienti & Sedi',
      icon: <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />,
    },
    {
      id: 'data',
      shortLabel: 'Dati',
      mediumLabel: 'Telemetria',
      fullLabel: 'Dati Telemetria',
      icon: <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />,
    },
    {
      id: 'programming',
      shortLabel: 'Ricette',
      mediumLabel: 'Ricette',
      fullLabel: 'Programmazione',
      icon: <Coffee className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />,
    },
    {
      id: 'ota',
      shortLabel: 'OTA',
      mediumLabel: 'OTA',
      fullLabel: 'OTA Firmware',
      icon: <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />,
    },
    {
      id: 'touch-panel',
      shortLabel: 'Touch',
      mediumLabel: 'Touch 10.1"',
      fullLabel: 'Display Touch',
      icon: <Tablet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />,
    },
    {
      id: 'opta-lab',
      shortLabel: 'Opta',
      mediumLabel: 'Opta Lab',
      fullLabel: 'Opta RS-485',
      icon: <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />,
    },
    {
      id: 'database',
      shortLabel: 'DB',
      mediumLabel: 'Database',
      fullLabel: 'Gestione DB',
      icon: <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />,
    },
  ];

  const NAV_ITEMS = ALL_NAV_ITEMS.filter((item) => userAllowedTabs.includes(item.id));

  const isLight = theme === 'light';

  return (
    <header className={`${isLight ? 'bg-white/95 border-slate-200 shadow-sm shadow-slate-200/50' : 'bg-slate-900/90 border-white/10 shadow-lg shadow-black/20'} border-b sticky top-0 z-40 backdrop-blur-md transition-colors duration-200`}>
      <div className="w-full px-2.5 sm:px-4 lg:px-6">
        {/* ROW 1: Logo & Identity on Left, Tools & User on Right */}
        <div className="flex items-center justify-between min-h-12 sm:min-h-14 py-1.5 sm:py-2 gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          {/* Logo & Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0">
            {/* Official Logo Badge */}
            <div className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200/90 shadow-xs flex items-center shrink-0 transition-transform hover:scale-[1.02]">
              <PortalBrandLogo size="md" className="h-7 sm:h-8 md:h-9" />
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-black tracking-tight text-xs sm:text-sm lg:text-base leading-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  General Beverage Telemetry Hub
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    serverOnline
                      ? isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : isLight ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                      serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                    }`}
                  ></span>
                  {serverOnline ? 'Sistema Connesso' : 'Disconnesso'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block leading-tight">
                Piattaforma IoT &bull; <strong className="text-emerald-700 dark:text-emerald-400">io sano</strong> &amp; <strong className="text-emerald-700 dark:text-emerald-400">io bevo</strong>
              </span>
            </div>
          </div>

          {/* Tools on Right: Update App + Theme Switcher + User Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Update App Button with Version and Time */}
            <button
              type="button"
              id="btn-update-app"
              onClick={handleUpdateApp}
              disabled={isUpdating}
              title={`Versione: ${appVersion} | Ultimo aggiornamento: ${lastUpdatedTime} | Clicca per aggiornare i dati e lo stato dell'app`}
              className={`group relative flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm ${
                showUpdateSuccess
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/25'
                  : isLight
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-slate-800 border-blue-200/80 hover:border-blue-300'
                  : 'bg-gradient-to-r from-blue-950/50 to-indigo-950/50 hover:from-blue-900/60 hover:to-indigo-900/60 text-slate-100 border-blue-500/30 hover:border-blue-400/50'
              } ${isUpdating ? 'opacity-75 cursor-wait' : ''}`}
            >
              {showUpdateSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-white animate-bounce shrink-0" />
              ) : (
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isUpdating ? 'animate-spin text-blue-500' : isLight ? 'text-blue-600 group-hover:rotate-180' : 'text-blue-400 group-hover:rotate-180'
                  } transition-transform duration-500`}
                />
              )}

              <div className="flex flex-col text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[11px] tracking-tight hidden md:inline">
                    {isUpdating ? 'Aggiornamento...' : showUpdateSuccess ? 'Aggiornato!' : 'Aggiorna App'}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      showUpdateSuccess
                        ? 'bg-white/20 text-white'
                        : isLight
                        ? 'bg-blue-600/10 text-blue-700 border border-blue-200'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'
                    }`}
                  >
                    {appVersion}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] opacity-80 font-mono">
                  <Clock className="w-2.5 h-2.5 inline" />
                  <span>{currentTime}</span>
                </div>
              </div>
            </button>

            {/* Theme Switcher Button */}
            <button
              type="button"
              id="btn-toggle-theme"
              onClick={toggleTheme}
              title={isLight ? 'Attiva Tema Scuro' : 'Attiva Tema Chiaro'}
              className={`p-2 rounded-xl transition-colors cursor-pointer border flex items-center gap-1.5 text-xs font-medium ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300 shadow-sm'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/15'
              }`}
            >
              {isLight ? (
                <>
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="hidden 2xl:inline text-[11px] font-semibold text-slate-700">Chiaro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="hidden 2xl:inline text-[11px] font-semibold text-slate-300">Scuro</span>
                </>
              )}
            </button>

            {/* Current Logged In User Pill & Logout Button */}
            {currentUser && (
              <div className={`flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-2 border-l shrink-0 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <button
                  type="button"
                  id="btn-user-profile-menu"
                  onClick={onOpenUserMenu}
                  title="Gestione Profilo & Password"
                  className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl text-left transition-all group cursor-pointer border ${
                    isLight
                      ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900 shadow-sm'
                      : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-white'
                  }`}
                >
                  <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg border flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                  }`}>
                    {currentUser.username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold transition-colors ${
                        isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-400'
                      }`}>
                        {currentUser.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          currentUser.role === 'admin'
                            ? isLight ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : currentUser.role === 'tecnico'
                            ? isLight ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                            : currentUser.role === 'gestore'
                            ? isLight ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            : currentUser.role === 'operatore'
                            ? isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : currentUser.role === 'cliente'
                            ? isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isLight ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-700 text-slate-300 border border-slate-600'
                        }`}
                      >
                        {userRoleDef?.name || currentUser.role}
                      </span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  id="btn-logout"
                  onClick={onLogout}
                  title="Disconnetti (Logout)"
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-colors cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: ALL BUTTONS IN A SINGLE ROW - NO SCROLLING, FIT PERFECTLY (TUTTI IN FILA SENZA SCORRIMENTO) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 py-1.5 border-t border-slate-200/70 dark:border-white/10 w-full flex-nowrap overflow-hidden">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const isDbTab = item.id === 'database';
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                title={item.fullLabel}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-1.5 px-1 sm:px-2 md:px-2.5 py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] lg:text-xs font-semibold transition-all duration-150 border cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? isLight
                      ? isDbTab
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/30 font-bold ring-1 ring-emerald-500'
                        : 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/30 font-bold ring-1 ring-blue-500'
                      : isDbTab
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/30 font-bold ring-1 ring-emerald-400'
                        : 'bg-blue-600/90 text-white border-blue-400/50 shadow-md shadow-blue-500/25 backdrop-blur-md font-bold ring-1 ring-blue-400'
                    : isLight
                      ? isDbTab
                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'
                        : 'text-slate-600 hover:text-slate-900 bg-slate-50/80 hover:bg-slate-100 border-slate-200/70 hover:border-slate-300'
                      : isDbTab
                        ? 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-800/50 hover:border-emerald-700'
                        : 'text-slate-400 hover:text-slate-200 bg-slate-800/40 hover:bg-slate-800/80 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate hidden xl:inline">{item.fullLabel}</span>
                <span className="truncate hidden sm:inline xl:hidden">{item.mediumLabel}</span>
                <span className="truncate inline sm:hidden">{item.shortLabel}</span>
                {item.id === 'data' && totalLogs > 0 && (
                  <span className={`shrink-0 ml-0.5 px-1 py-0.2 rounded-full text-[9px] font-mono border ${
                    isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-500/30 text-amber-200 border-amber-400/30'
                  }`}>
                    {totalLogs > 999 ? '999+' : totalLogs}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};



