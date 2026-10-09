/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { FleetManager } from './components/FleetManager';
import { CustomerManager } from './components/CustomerManager';
import { CustomerDashboardView } from './components/CustomerDashboardView';
import { DataAnalyticsView } from './components/DataAnalyticsView';
import { NodeProgrammingView, ProgrammingSubTab } from './components/NodeProgrammingView';
import { OtaFirmwareView } from './components/OtaFirmwareView';
import { DatabaseManagerView } from './components/DatabaseManagerView';
import { TouchPanelPreview } from './components/TouchPanelPreview';
import { OptaLabView } from './components/OptaLabView';
import { LoginScreen } from './components/LoginScreen';
import { UserMenuModal } from './components/UserMenuModal';
import { PrivacyPolicyModal } from './components/PrivacyPolicyModal';
import { PortalBrandLogo } from './components/PortalBrandLogo';
import { KeyLog, ServerStats, AuthUser, VendingMachine, Customer, RolePermissionDefinition } from './types';
import { ThemeProvider, useTheme } from './context/ThemeContext';

const DEFAULT_SYSTEM_ROLES: RolePermissionDefinition[] = [
  {
    id: 'admin',
    name: 'Amministratore (Super Admin)',
    description: 'Accesso completo e illimitato a tutte le sezioni del portale, gestione account e server VPS.',
    badgeColor: 'amber',
    allowedTabs: ['dashboard', 'machines', 'customers', 'data', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database'],
    canManageUsers: true,
    canUpdateVps: true,
    canEditMachines: true,
    canEditRecipes: true,
    canUploadFirmware: true,
    canControlOptaLab: true,
    canAccessDatabase: true,
    isSystem: true,
  },
  {
    id: 'tecnico',
    name: 'Tecnico Installatore / Hardware',
    description: 'Diagnostica hardware, cablaggi, configurazione moduli ESP32/Opta e aggiornamenti firmware OTA.',
    badgeColor: 'sky',
    allowedTabs: ['dashboard', 'machines', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: true,
    canEditRecipes: true,
    canUploadFirmware: true,
    canControlOptaLab: true,
    canAccessDatabase: true,
    isSystem: true,
  },
  {
    id: 'gestore',
    name: 'Responsabile Operativo / Gestore Flotta',
    description: 'Gestione parco macchine, anagrafica clienti & sedi, statistiche consumi, catalogo articoli e tarature.',
    badgeColor: 'indigo',
    allowedTabs: ['dashboard', 'machines', 'customers', 'data', 'programming', 'database'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: true,
    canEditRecipes: true,
    canUploadFirmware: false,
    canControlOptaLab: false,
    canAccessDatabase: true,
    isSystem: true,
  },
  {
    id: 'operatore',
    name: 'Operatore Macchina',
    description: 'Controllo distributori sul campo, monitoraggio erogazioni, allarmi e simulatore touch panel.',
    badgeColor: 'emerald',
    allowedTabs: ['dashboard', 'machines', 'data', 'touch-panel'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: false,
    canEditRecipes: false,
    canUploadFirmware: false,
    canControlOptaLab: false,
    canAccessDatabase: false,
    isSystem: true,
  },
  {
    id: 'cliente',
    name: 'Cliente / Referente Sede',
    description: 'Consultazione distributori e telemetria consumi della propria struttura (es. Hotel, Mensa).',
    badgeColor: 'emerald',
    allowedTabs: ['dashboard'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: false,
    canEditRecipes: false,
    canUploadFirmware: false,
    canControlOptaLab: false,
    canAccessDatabase: false,
    isSystem: true,
  },
  {
    id: 'viewer',
    name: 'Viewer (Sola Lettura)',
    description: 'Sola visualizzazione della dashboard e statistiche storiche, senza facoltà di inviare comandi.',
    badgeColor: 'slate',
    allowedTabs: ['dashboard', 'data'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: false,
    canEditRecipes: false,
    canUploadFirmware: false,
    canControlOptaLab: false,
    canAccessDatabase: false,
    isSystem: true,
  },
];

function AppContent() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [rolePermissions, setRolePermissions] = useState<RolePermissionDefinition[]>(DEFAULT_SYSTEM_ROLES);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [programmingSubTab, setProgrammingSubTab] = useState<ProgrammingSubTab>('products');
  const [logs, setLogs] = useState<KeyLog[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [mqttOnline, setMqttOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Check if opened directly as a standalone machine kiosk (?kiosk=MACHINE_ID or ?kiosk=true)
  const [isStandaloneKiosk, setIsStandaloneKiosk] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has('kiosk') || params.has('panel') || params.has('touch');
    } catch {
      return false;
    }
  });

  // Extract machine ID from kiosk URL parameter if present
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const kioskVal = params.get('kiosk') || params.get('panel') || params.get('touch');
      if (kioskVal && kioskVal !== 'true') {
        setSelectedMachineId(kioskVal);
      }
      if (params.has('kiosk') || params.has('panel') || params.has('touch')) {
        setIsStandaloneKiosk(true);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch machines list for kiosk mode (operates without requiring admin login)
  useEffect(() => {
    if (isStandaloneKiosk) {
      fetch('/api/machines')
        .then((r) => r.json())
        .then((data) => {
          const list: VendingMachine[] = data.machines || data || [];
          setMachines(list);
          if (list.length > 0) {
            setSelectedMachineId((prev) => {
              if (prev && list.some((m) => m.id === prev || m.serialNumber === prev)) {
                return prev;
              }
              return list[0].id || list[0].serialNumber || '';
            });
          }
        })
        .catch(() => {});
    }
  }, [isStandaloneKiosk]);

  // Check existing auth session on app startup
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('vending_auth_token') || sessionStorage.getItem('vending_auth_token');
      const cachedUser = localStorage.getItem('vending_auth_user') || sessionStorage.getItem('vending_auth_user');

      if (!token && !cachedUser) {
        setAuthChecking(false);
        return;
      }

      // Pre-hydrate from cache immediately for zero-flicker instant loading
      if (cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          setCurrentUser(parsed);
          setAuthChecking(false); // Unblock screen immediately!
        } catch {
          // ignore
        }
      }

      if (token) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.user) {
              setCurrentUser(data.user);
              localStorage.setItem('vending_auth_user', JSON.stringify(data.user));
            } else if (!cachedUser) {
              localStorage.removeItem('vending_auth_token');
              sessionStorage.removeItem('vending_auth_token');
              setCurrentUser(null);
            }
          }
        } catch {
          // Network error or server transient error - keep cached user session
        }
      }

      setAuthChecking(false);
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    localStorage.setItem('vending_auth_token', token);
    localStorage.setItem('vending_auth_user', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('vending_auth_token') || sessionStorage.getItem('vending_auth_token');
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // ignore
    }
    localStorage.removeItem('vending_auth_token');
    localStorage.removeItem('vending_auth_user');
    sessionStorage.removeItem('vending_auth_token');
    sessionStorage.removeItem('vending_auth_user');
    setCurrentUser(null);
    setIsUserMenuOpen(false);
  };

  // Fetch initial data with resilient, non-blocking Settled promises
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        fetch('/api/keylogs?limit=150'),
        fetch('/api/stats'),
        fetch('/api/mqtt/status'),
        fetch('/api/machines'),
        fetch('/api/customers'),
        fetch('/api/auth/roles'),
      ]);

      const [logsRes, statsRes, mqttRes, machinesRes, customersRes, rolesRes] = results;

      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        const logsData = await logsRes.value.json().catch(() => null);
        if (logsData?.logs) setLogs(logsData.logs);
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const statsData = await statsRes.value.json().catch(() => null);
        if (statsData) setStats(statsData);
      }
      if (mqttRes.status === 'fulfilled' && mqttRes.value.ok) {
        const mqttData = await mqttRes.value.json().catch(() => null);
        if (mqttData) setMqttOnline(Boolean(mqttData.connected));
      }
      if (machinesRes.status === 'fulfilled' && machinesRes.value.ok) {
        const machinesData = await machinesRes.value.json().catch(() => null);
        const loadedList: VendingMachine[] = machinesData?.machines || machinesData || [];
        setMachines(loadedList);
        if (loadedList.length > 0) {
          setSelectedMachineId((prev) => prev || loadedList[0].id || loadedList[0].serialNumber || '');
        }
      }
      if (customersRes.status === 'fulfilled' && customersRes.value.ok) {
        const customersData = await customersRes.value.json().catch(() => null);
        setCustomers(customersData?.customers || customersData || []);
      }
      if (rolesRes.status === 'fulfilled' && rolesRes.value.ok) {
        const rolesData = await rolesRes.value.json().catch(() => null);
        if (rolesData?.success && Array.isArray(rolesData.roles)) {
          setRolePermissions(rolesData.roles);
        }
      }
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Enforce role-based and custom user access for active tab
  useEffect(() => {
    if (!currentUser || rolePermissions.length === 0) return;
    if (currentUser.role === 'admin') return;

    const roleDef = rolePermissions.find((r) => r.id === currentUser.role);
    const allowed = Array.isArray(currentUser.customAllowedTabs) && currentUser.customAllowedTabs.length > 0
      ? currentUser.customAllowedTabs
      : roleDef?.allowedTabs || [];

    if (allowed.length > 0 && !allowed.includes(activeTab)) {
      setActiveTab(allowed[0] as ActiveTab);
    }
  }, [currentUser, rolePermissions, activeTab]);

  // Connect to SSE stream for live real-time updates
  useEffect(() => {
    if (!currentUser) return;
    fetchData();

    // Setup EventSource for SSE (Migrated to /api/events)
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');

      eventSource.addEventListener('connected', () => {
        setServerOnline(true);
      });

      eventSource.addEventListener('mqtt-status', (e) => {
        try {
          const status = JSON.parse(e.data);
          setMqttOnline(Boolean(status.connected));
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('new-keylog', (e) => {
        try {
          const newLog: KeyLog = JSON.parse(e.data);
          setLogs((prev) => {
            if (prev.some((l) => l.id === newLog.id)) return prev;
            return [newLog, ...prev];
          });
          // Refresh stats
          fetch('/api/stats')
            .then((r) => r.json())
            .then((s) => setStats(s))
            .catch(() => {});
        } catch (err) {
          console.error('SSE JSON parse error', err);
        }
      });

      eventSource.addEventListener('batch-keylogs', (e) => {
        try {
          const newBatch: KeyLog[] = JSON.parse(e.data);
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const uniqueNew = newBatch.filter((l) => !existingIds.has(l.id));
            return [...uniqueNew, ...prev];
          });
          fetch('/api/stats')
            .then((r) => r.json())
            .then((s) => setStats(s))
            .catch(() => {});
        } catch (err) {
          console.error(err);
        }
      });

      eventSource.addEventListener('caraffa-mode-active', () => {
        fetch('/api/machines')
          .then((r) => r.json())
          .then((d) => setMachines(d.machines || d || []))
          .catch(() => {});
      });

      eventSource.addEventListener('emergency-stop-triggered', () => {
        fetch('/api/machines')
          .then((r) => r.json())
          .then((d) => setMachines(d.machines || d || []))
          .catch(() => {});
      });

      eventSource.addEventListener('language-cycled', () => {
        fetch('/api/machines')
          .then((r) => r.json())
          .then((d) => setMachines(d.machines || d || []))
          .catch(() => {});
      });

      eventSource.addEventListener('logs-cleared', () => {
        setLogs([]);
        fetchData();
      });

      eventSource.addEventListener('machines-updated', () => {
        fetch('/api/machines')
          .then((r) => r.json())
          .then((d) => setMachines(d.machines || d || []))
          .catch(() => {});
      });

      eventSource.addEventListener('devices-updated', () => {
        fetch('/api/machines')
          .then((r) => r.json())
          .then((d) => setMachines(d.machines || d || []))
          .catch(() => {});
      });

      eventSource.addEventListener('device-auto-detected', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const dev = payload.device;
          fetch('/api/machines')
            .then((r) => r.json())
            .then((d) => setMachines(d.machines || d || []))
            .catch(() => {});
          console.log(`[Auto-Discovery] Nuovo Modulo GB-CLOUD rilevato: ${dev?.macAddress} (#${dev?.serialNumber})`);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('customers-updated', () => {
        fetch('/api/customers')
          .then((r) => r.json())
          .then((d) => setCustomers(d.customers || d || []))
          .catch(() => {});
      });

      eventSource.onerror = () => {
        // Fallback to periodic polling if SSE closes
        setServerOnline(true);
      };
    } catch (e) {
      console.warn('SSE not supported, using polling fallback', e);
    }

    // Interval fallback ping every 10s
    const interval = setInterval(fetchData, 10000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [currentUser, fetchData]);

  // Clear logs handler
  const handleClearLogs = async () => {
    try {
      const res = await fetch('/api/keylogs', { method: 'DELETE' });
      if (res.ok) {
        setLogs([]);
        await fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleKeyLogged = (newLog: KeyLog) => {
    setLogs((prev) => {
      if (prev.some((l) => l.id === newLog.id)) return prev;
      return [newLog, ...prev];
    });
    fetch('/api/stats')
      .then((r) => r.json())
      .then((s) => setStats(s))
      .catch(() => {});
  };

  const handleNavigateToSimulation = (machineId: string) => {
    setSelectedMachineId(machineId);
    setActiveTab('data');
  };

  const handleNavigateToKeymap = (machineId: string) => {
    setSelectedMachineId(machineId);
    setProgrammingSubTab('products');
    setActiveTab('programming');
  };

  const handleNavigateToCode = (machineId: string) => {
    setSelectedMachineId(machineId);
    setProgrammingSubTab('firmware');
    setActiveTab('programming');
  };

  const handleNavigateToTouchPanel = (machineId: string) => {
    setSelectedMachineId(machineId);
    setActiveTab('touch-panel');
  };

  // Dedicated Standalone Kiosk Mode for a Machine (Direct 10.1" customer interface)
  if (isStandaloneKiosk) {
    const kioskMachine = machines.find((m) => m.id === selectedMachineId || m.serialNumber === selectedMachineId) || machines[0] || null;
    return (
      <div className="w-screen h-screen min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-0 m-0 overflow-hidden select-none">
        <TouchPanelPreview
          selectedMachine={kioskMachine}
          machines={machines}
          onSelectMachine={(mId) => {
            setSelectedMachineId(mId);
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('kiosk', mId);
            window.history.replaceState({}, '', newUrl.toString());
          }}
          isStandaloneKiosk={true}
          onExitKiosk={() => {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('kiosk');
            newUrl.searchParams.delete('panel');
            newUrl.searchParams.delete('touch');
            window.history.replaceState({}, '', newUrl.pathname);
            setIsStandaloneKiosk(false);
            setActiveTab('machines');
          }}
        />
      </div>
    );
  }

  // Loading state while checking auth
  if (authChecking) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center gap-3 ${
        isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-950 text-slate-400'
      }`}>
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono">Verifica credenziali di sicurezza...</span>
      </div>
    );
  }

  // Not logged in -> Show Login Screen
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const userRoleDef = rolePermissions.find((r) => r.id === currentUser.role);
  const userAllowedTabs: string[] =
    currentUser.role === 'admin'
      ? ['dashboard', 'machines', 'customers', 'data', 'programming', 'ota', 'touch-panel', 'opta-lab', 'database']
      : Array.isArray(currentUser.customAllowedTabs) && currentUser.customAllowedTabs.length > 0
      ? currentUser.customAllowedTabs
      : userRoleDef?.allowedTabs || ['dashboard'];

  return (
    <div className={`min-h-screen flex flex-col font-sans relative overflow-x-hidden transition-colors duration-200 ${
      isLight
        ? 'bg-[#f8fafc] text-slate-800 selection:bg-blue-500 selection:text-white'
        : 'bg-[#0f172a] text-slate-100 selection:bg-blue-500 selection:text-white'
    }`}>
      {/* Ambient Frosted Glass Background Orbs */}
      {isLight ? (
        <>
          <div className="fixed top-[-120px] left-[-100px] w-[550px] h-[550px] bg-blue-400/10 rounded-full blur-[140px] pointer-events-none -z-0"></div>
          <div className="fixed bottom-[-100px] right-[-100px] w-[650px] h-[650px] bg-emerald-500/10 rounded-full blur-[160px] pointer-events-none -z-0"></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-400/5 rounded-full blur-[150px] pointer-events-none -z-0"></div>
        </>
      ) : (
        <>
          <div className="fixed top-[-120px] left-[-100px] w-[550px] h-[550px] bg-blue-600/15 rounded-full blur-[140px] pointer-events-none -z-0"></div>
          <div className="fixed bottom-[-100px] right-[-100px] w-[650px] h-[650px] bg-emerald-600/15 rounded-full blur-[160px] pointer-events-none -z-0"></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-600/5 rounded-full blur-[150px] pointer-events-none -z-0"></div>
        </>
      )}

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        serverOnline={serverOnline}
        totalLogs={logs.length}
        mqttOnline={mqttOnline}
        currentUser={currentUser}
        rolePermissions={rolePermissions}
        onOpenUserMenu={() => setIsUserMenuOpen(true)}
        onLogout={handleLogout}
        onRefreshApp={fetchData}
      />

      {/* Profile & User Management Modal */}
      {isUserMenuOpen && (
        <UserMenuModal
          isOpen={isUserMenuOpen}
          onClose={() => setIsUserMenuOpen(false)}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenDatabaseManager={() => setActiveTab('database')}
          onRolesUpdated={fetchData}
          rolePermissions={rolePermissions}
          customers={customers}
        />
      )}

      {/* Main Content Area - Full Screen Layout */}
      <main className="relative z-10 flex-1 w-full px-3 sm:px-5 lg:px-6 xl:px-8 py-5 space-y-6">
        {/* PAGE 1: DASHBOARD PRINCIPALE / CRUSCOTTO CLIENTE */}
        {activeTab === 'dashboard' && (
          currentUser.role === 'cliente' ? (
            <CustomerDashboardView
              customer={
                (currentUser.customerId ? customers.find((c) => c.id === currentUser.customerId) : null) ||
                customers[0] || {
                  id: 'CUST-001',
                  code: 'CLI-01',
                  name: currentUser.name || 'Cliente Selezionato',
                  sites: [],
                  createdAt: new Date().toISOString(),
                }
              }
              machines={
                currentUser.customerId
                  ? machines.filter((m) => m.customerId === currentUser.customerId)
                  : machines
              }
              keyLogs={
                currentUser.customerId
                  ? logs.filter((l) => {
                      const clientName = customers.find((c) => c.id === currentUser.customerId)?.name;
                      const matchedMachine = machines.find((m) => m.id === l.deviceId || (l as any).machineId === m.id || m.name === l.machineName || m.serialNumber === l.machineSerialNumber);
                      return (
                        l.customerName === clientName ||
                        matchedMachine?.customerId === currentUser.customerId
                      );
                    })
                  : logs
              }
              onRefresh={fetchData}
              onSelectMachine={(mId) => handleNavigateToSimulation(mId)}
            />
          ) : (
            <DashboardOverview
              logs={logs}
              stats={stats}
              serverOnline={serverOnline}
              mqttOnline={mqttOnline}
              onNavigateToMachines={userAllowedTabs.includes('machines') ? () => setActiveTab('machines') : undefined}
              onNavigateToData={userAllowedTabs.includes('data') ? () => setActiveTab('data') : undefined}
              onNavigateToProgramming={userAllowedTabs.includes('programming') ? () => setActiveTab('programming') : undefined}
              onNavigateToDatabase={userAllowedTabs.includes('database') ? () => setActiveTab('database') : undefined}
              onSelectMachineForKeymap={handleNavigateToKeymap}
            />
          )
        )}

        {/* PAGE 2: GESTIONE MACCHINE E MODULI */}
        {activeTab === 'machines' && (
          <FleetManager
            customers={customers}
            onSelectMachineForSimulation={handleNavigateToSimulation}
            onSelectMachineForKeymap={handleNavigateToKeymap}
            onSelectMachineForCode={handleNavigateToCode}
            onSelectMachineForTouchPanel={handleNavigateToTouchPanel}
            onNavigateToCustomers={() => setActiveTab('customers')}
          />
        )}

        {/* PAGE 3: GESTIONE CLIENTI & SEDI OPERATIVE */}
        {activeTab === 'customers' && (
          <CustomerManager
            customers={customers}
            machines={machines}
            keyLogs={logs}
            onRefresh={fetchData}
            onSelectMachineForData={(machineId) => {
              setSelectedMachineId(machineId);
              setActiveTab('data');
            }}
            onSelectMachineForFleet={(machineId) => {
              setSelectedMachineId(machineId);
              setActiveTab('machines');
            }}
          />
        )}

        {/* PAGE 4: VISUALIZZAZIONE DATI */}
        {activeTab === 'data' && (
          <DataAnalyticsView
            logs={logs}
            stats={stats}
            isLoading={isLoading}
            onRefresh={fetchData}
            onClearLogs={handleClearLogs}
            onKeyLogged={handleKeyLogged}
            selectedMachineId={selectedMachineId}
            onMachineChanged={(mId) => setSelectedMachineId(mId)}
            machines={machines}
            customers={customers}
          />
        )}

        {/* PAGE 5: PROGRAMMAZIONE DEI MODULI */}
        {activeTab === 'programming' && (
          <NodeProgrammingView
            selectedMachineId={selectedMachineId}
            onMachineChanged={(mId) => setSelectedMachineId(mId)}
            initialSubTab={programmingSubTab}
          />
        )}

        {/* PAGE OTA: AGGIORNAMENTO FIRMWARE OTA CLOUD */}
        {activeTab === 'ota' && (
          <OtaFirmwareView
            initialMachineId={selectedMachineId}
          />
        )}

        {/* PAGE 6: GESTIONE DATABASE SQL */}
        {activeTab === 'database' && (
          <DatabaseManagerView />
        )}

        {/* PAGE 7: ANTEPRIMA TOUCH PANEL PC 10.1" (DWIN DMG10600C101_32WTC) */}
        {activeTab === 'touch-panel' && (
          <TouchPanelPreview
            onBackToDashboard={() => setActiveTab('dashboard')}
            selectedMachine={machines.find((m) => m.id === selectedMachineId) || machines[0] || null}
            machines={machines}
            onSelectMachine={(mId) => setSelectedMachineId(mId)}
            isStandaloneKiosk={false}
          />
        )}

        {/* PAGE 8: ARDUINO OPTA R&D LAB (SPAZIO PROGETTO SEPARATO) */}
        {activeTab === 'opta-lab' && (
          <OptaLabView />
        )}
      </main>

      {/* Footer */}
      <footer className={`relative z-10 py-4 text-xs mt-auto border-t transition-colors ${
        isLight
          ? 'bg-white/90 border-slate-200 text-slate-600 shadow-xs'
          : 'bg-black/30 backdrop-blur-md border-white/5 text-slate-400'
      }`}>
        <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2 py-0.5 rounded-lg border border-slate-200/90 shadow-2xs flex items-center">
              <PortalBrandLogo size="xs" className="h-6 w-auto" />
            </div>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-slate-300'}`}>General Beverage Telemetry Hub</span>
            <span>&bull;</span>
            <span>Modelli Certificati: <strong className={isLight ? 'text-emerald-700' : 'text-emerald-300'}>Ristosano</strong>, <strong className={isLight ? 'text-blue-700' : 'text-blue-300'}>Big 5</strong>, <strong className={isLight ? 'text-amber-700' : 'text-amber-300'}>Asia</strong></span>
          </div>
          <div className={`text-[11px] flex items-center gap-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <span className={isLight ? 'text-blue-600 font-semibold' : 'text-blue-400'}>Firmware: v1.4.2</span>
            <span>&bull;</span>
            <span>Broker MQTT HiveMQ Live &bull; Matrice 4x4 Optoisolata</span>
            <span>&bull;</span>
            <button
              type="button"
              onClick={() => setIsPrivacyModalOpen(true)}
              className={`hover:underline font-medium cursor-pointer transition-colors ${
                isLight ? 'text-slate-700 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Privacy &amp; Cookie Policy
            </button>
            <span>&bull;</span>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Privacy
            </a>
            <span>&bull;</span>
            <a
              href="/cookie-policy"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Cookie
            </a>
            <span>&bull;</span>
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className={`hover:underline ${isLight ? 'text-slate-600 hover:text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Termini
            </a>
          </div>
        </div>
      </footer>

      {/* Modal Privacy & Cookie Policy Globale */}
      <PrivacyPolicyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}


