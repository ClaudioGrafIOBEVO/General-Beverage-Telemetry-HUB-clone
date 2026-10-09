import React, { useState, useEffect } from 'react';
import { X, KeyRound, User, Shield, UserPlus, Trash2, Check, AlertCircle, RefreshCw, Lock, Server, Terminal, Copy, ExternalLink, Play, ShieldCheck, Cookie, FileText, CheckCircle2, Database, Sliders, Plus, Save, RotateCcw, Sparkles } from 'lucide-react';
import { AuthUser, UserRole, RolePermissionDefinition, Customer } from '../types';
import { useTheme } from '../context/ThemeContext';

interface UserMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onLogout: () => void;
  onOpenDatabaseManager?: () => void;
  onRolesUpdated?: () => void;
  rolePermissions?: RolePermissionDefinition[];
  customers?: Customer[];
}

export const UserMenuModal: React.FC<UserMenuModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onOpenDatabaseManager,
  onRolesUpdated,
  rolePermissions,
  customers = [],
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'users' | 'roles' | 'vps' | 'privacy'>('profile');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };
  
  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Users management state (Admin only)
  const [usersList, setUsersList] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operatore');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserCustomerId, setNewUserCustomerId] = useState('');
  const [userCustomerDraft, setUserCustomerDraft] = useState<Record<string, string>>({});
  const [userActionMsg, setUserActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [updatingRoleId, setUpdatingRoleId] = useState<string | null>(null);

  // Per-user granular permission overrides
  const [expandedUserPermsId, setExpandedUserPermsId] = useState<string | null>(null);
  const [userPermsDraft, setUserPermsDraft] = useState<Record<string, string[]>>({});
  const [savingUserPermsId, setSavingUserPermsId] = useState<string | null>(null);

  // Roles & Permissions matrix state (Admin only)
  const [rolesList, setRolesList] = useState<RolePermissionDefinition[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleActionMsg, setRoleActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [roleFormState, setRoleFormState] = useState<Record<string, RolePermissionDefinition>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  // New custom role state
  const [showNewRoleForm, setShowNewRoleForm] = useState(false);
  const [newCustomRoleId, setNewCustomRoleId] = useState('');
  const [newCustomRoleName, setNewCustomRoleName] = useState('');
  const [newCustomRoleDesc, setNewCustomRoleDesc] = useState('');
  const [newCustomRoleColor, setNewCustomRoleColor] = useState('sky');
  const [newCustomRoleTabs, setNewCustomRoleTabs] = useState<string[]>(['dashboard', 'data']);

  // Fetch users when tab changes to 'users'
  const fetchUsers = async () => {
    if (currentUser.role !== 'admin') return;
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('vending_auth_token') || sessionStorage.getItem('vending_auth_token') || '';
      const res = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsersList(data.users);
      }
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    setRolesLoading(true);
    try {
      const res = await fetch('/api/auth/roles');
      const data = await res.json();
      if (data.success && Array.isArray(data.roles)) {
        setRolesList(data.roles);
        const map: Record<string, RolePermissionDefinition> = {};
        data.roles.forEach((r: RolePermissionDefinition) => {
          map[r.id] = { ...r };
        });
        setRoleFormState(map);
      }
    } catch {
      // ignore
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRoles();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'users' && currentUser.role === 'admin') {
      fetchUsers();
    }
    if (isOpen && activeTab === 'roles' && currentUser.role === 'admin') {
      fetchRoles();
    }
  }, [isOpen, activeTab, currentUser.role]);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'La nuova password e la conferma non coincidono.' });
      return;
    }

    if (newPassword.length < 4) {
      setPwdMsg({ type: 'error', text: 'La nuova password deve contenere almeno 4 caratteri.' });
      return;
    }

    setPwdLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          oldPassword,
          newPassword,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setPwdMsg({ type: 'error', text: data.error || 'Impossibile modificare la password.' });
      } else {
        setPwdMsg({ type: 'success', text: 'Password aggiornata con successo!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setPwdMsg({ type: 'error', text: 'Errore durante la modifica della password.' });
    } finally {
      setPwdLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserActionMsg(null);

    if (!newUsername.trim() || !newName.trim() || !newUserPass.trim()) {
      setUserActionMsg({ type: 'error', text: 'Compila tutti i campi obbligatori.' });
      return;
    }

    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim(),
          password: newUserPass.trim(),
          role: newUserRole,
          email: newUserEmail.trim(),
          customerId: newUserCustomerId || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setUserActionMsg({ type: 'error', text: data.error || 'Errore creazione utente.' });
      } else {
        setUserActionMsg({ type: 'success', text: `Utente '${data.user.name}' creato con successo!` });
        setNewUsername('');
        setNewName('');
        setNewUserPass('');
        setNewUserEmail('');
        setNewUserCustomerId('');
        fetchUsers();
      }
    } catch {
      setUserActionMsg({ type: 'error', text: 'Errore di connessione.' });
    }
  };

  const handleRoleChange = async (userId: string, userName: string, newRole: UserRole) => {
    setUserActionMsg(null);
    setUpdatingRoleId(userId);
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUserActionMsg({ type: 'error', text: data.error || `Impossibile cambiare ruolo a '${userName}'` });
      } else {
        setUserActionMsg({ type: 'success', text: `Ruolo di '${userName}' aggiornato a '${newRole.toUpperCase()}' con successo!` });
        fetchUsers();
      }
    } catch {
      setUserActionMsg({ type: 'error', text: 'Errore di connessione durante la modifica del ruolo' });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare l'utente '${name}'?`)) return;
    try {
      const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || 'Errore eliminazione utente');
      }
    } catch {
      alert('Errore di connessione');
    }
  };

  // Toggle user permissions drawer
  const handleToggleUserPermsExpand = (user: AuthUser) => {
    if (expandedUserPermsId === user.id) {
      setExpandedUserPermsId(null);
    } else {
      setExpandedUserPermsId(user.id);
      const roleDef = rolesList.find((r) => r.id === user.role);
      const initialTabs = Array.isArray(user.customAllowedTabs) && user.customAllowedTabs.length > 0
        ? [...user.customAllowedTabs]
        : roleDef?.allowedTabs
        ? [...roleDef.allowedTabs]
        : ['dashboard', 'data'];
      setUserPermsDraft((prev) => ({
        ...prev,
        [user.id]: initialTabs,
      }));
    }
  };

  // Toggle individual tab for specific user
  const handleToggleTabForUser = (userId: string, tabId: string) => {
    setUserPermsDraft((prev) => {
      const current = prev[userId] || [];
      const updated = current.includes(tabId)
        ? current.filter((t) => t !== tabId)
        : [...current, tabId];
      return {
        ...prev,
        [userId]: updated,
      };
    });
  };

  // Quick preset: Rendi visibile SOLO il cruscotto
  const handleSetOnlyDashboard = (userId: string) => {
    setUserPermsDraft((prev) => ({
      ...prev,
      [userId]: ['dashboard'],
    }));
  };

  // Save specific user permissions (or reset to role default)
  const handleSaveUserCustomPerms = async (user: AuthUser, resetToRoleDefault = false) => {
    setSavingUserPermsId(user.id);
    setUserActionMsg(null);
    try {
      const selectedCustomerId = userCustomerDraft[user.id] !== undefined
        ? userCustomerDraft[user.id]
        : (user.customerId || '');

      const payload = resetToRoleDefault
        ? { customAllowedTabs: null, customerId: selectedCustomerId }
        : {
            customAllowedTabs: userPermsDraft[user.id] || [],
            customerId: selectedCustomerId,
          };

      const res = await fetch(`/api/auth/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUserActionMsg({ type: 'error', text: data.error || 'Errore salvataggio permessi utente' });
      } else {
        setUserActionMsg({
          type: 'success',
          text: resetToRoleDefault
            ? `Permessi di '${user.name}' ripristinati al default del ruolo '${user.role}'`
            : `Permessi specifici di '${user.name}' salvati con successo!`,
        });
        await fetchUsers();
        onRolesUpdated?.();
      }
    } catch {
      setUserActionMsg({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSavingUserPermsId(null);
    }
  };

  // Toggle a tab in roleFormState
  const handleToggleTabForRole = (roleId: string, tabId: string) => {
    setRoleFormState((prev) => {
      const current = prev[roleId];
      if (!current) return prev;
      const tabs = current.allowedTabs || [];
      const newTabs = tabs.includes(tabId)
        ? tabs.filter((t) => t !== tabId)
        : [...tabs, tabId];
      return {
        ...prev,
        [roleId]: {
          ...current,
          allowedTabs: newTabs,
        },
      };
    });
  };

  // Toggle boolean action permission
  const handleToggleActionForRole = (roleId: string, actionKey: keyof RolePermissionDefinition) => {
    setRoleFormState((prev) => {
      const current = prev[roleId];
      if (!current) return prev;
      return {
        ...prev,
        [roleId]: {
          ...current,
          [actionKey]: !current[actionKey],
        },
      };
    });
  };

  // Save role permissions
  const handleSaveRole = async (roleId: string) => {
    const roleData = roleFormState[roleId];
    if (!roleData) return;
    setSavingRoleId(roleId);
    setRoleActionMsg(null);
    try {
      const res = await fetch(`/api/auth/roles/${roleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roleData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRoleActionMsg({ type: 'error', text: data.error || 'Errore salvataggio permessi ruolo' });
      } else {
        setRoleActionMsg({ type: 'success', text: `Permessi del ruolo '${roleData.name}' salvati con successo!` });
        await fetchRoles();
        onRolesUpdated?.();
      }
    } catch {
      setRoleActionMsg({ type: 'error', text: 'Errore di connessione' });
    } finally {
      setSavingRoleId(null);
    }
  };

  // Create custom role
  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleActionMsg(null);
    if (!newCustomRoleId.trim() || !newCustomRoleName.trim()) {
      setRoleActionMsg({ type: 'error', text: 'Identificatore e Nome ruolo sono obbligatori' });
      return;
    }
    try {
      const res = await fetch('/api/auth/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newCustomRoleId.trim(),
          name: newCustomRoleName.trim(),
          description: newCustomRoleDesc.trim(),
          badgeColor: newCustomRoleColor,
          allowedTabs: newCustomRoleTabs,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRoleActionMsg({ type: 'error', text: data.error || 'Errore creazione nuovo ruolo' });
      } else {
        setRoleActionMsg({ type: 'success', text: `Nuovo ruolo '${data.role.name}' creato!` });
        setNewCustomRoleId('');
        setNewCustomRoleName('');
        setNewCustomRoleDesc('');
        setNewCustomRoleTabs(['dashboard', 'data']);
        setShowNewRoleForm(false);
        await fetchRoles();
        onRolesUpdated?.();
      }
    } catch {
      setRoleActionMsg({ type: 'error', text: 'Errore di connessione' });
    }
  };

  // Delete custom role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Sei sicuro di voler eliminare il ruolo '${roleName}'? Gli utenti associati verranno riassegnati a Operatore Macchina.`)) return;
    setRoleActionMsg(null);
    try {
      const res = await fetch(`/api/auth/roles/${roleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRoleActionMsg({ type: 'error', text: data.error || 'Impossibile eliminare il ruolo' });
      } else {
        setRoleActionMsg({ type: 'success', text: `Ruolo '${roleName}' eliminato con successo.` });
        await fetchRoles();
        await fetchUsers();
        onRolesUpdated?.();
      }
    } catch {
      setRoleActionMsg({ type: 'error', text: 'Errore di connessione' });
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className={`border rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
        isLight
          ? 'bg-white border-slate-300 text-slate-800'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isLight ? 'border-slate-300 bg-slate-100' : 'border-slate-800 bg-slate-950/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isLight ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-500/20 border-amber-500/30 text-amber-400'
            }`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Profilo &amp; Gestione Accessi
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                Connesso come <span className={`font-semibold ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>{currentUser.name}</span> ({currentUser.username})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className={`flex border-b px-6 overflow-x-auto ${
          isLight ? 'border-slate-300 bg-slate-50' : 'border-slate-800 bg-slate-950/20'
        }`}>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? isLight ? 'border-amber-600 text-amber-800 font-bold' : 'border-amber-500 text-amber-400 font-bold'
                : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Info Profilo
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'password'
                ? isLight ? 'border-amber-600 text-amber-800 font-bold' : 'border-amber-500 text-amber-400 font-bold'
                : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Cambia Password
          </button>
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'users'
                    ? isLight ? 'border-amber-600 text-amber-800 font-bold' : 'border-amber-500 text-amber-400 font-bold'
                    : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Gestione Account Flotta
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'roles'
                    ? isLight ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-emerald-500 text-emerald-400 font-bold'
                    : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ruoli &amp; Matrice Accessi</span>
              </button>
              <button
                onClick={() => setActiveTab('vps')}
                className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'vps'
                    ? isLight ? 'border-blue-600 text-blue-800 font-bold' : 'border-blue-500 text-blue-400 font-bold'
                    : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>Aggiorna VPS</span>
              </button>
              {onOpenDatabaseManager && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenDatabaseManager();
                  }}
                  className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 border-transparent text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium whitespace-nowrap`}
                >
                  <Database className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Apri Gestione DB SQL</span>
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'privacy'
                ? isLight ? 'border-emerald-600 text-emerald-800 font-bold' : 'border-emerald-500 text-emerald-400 font-bold'
                : isLight ? 'border-transparent text-slate-700 hover:text-slate-950 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy &amp; Cookie</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
                }`}>
                  <span className={`text-[11px] font-bold block uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    Ruolo Assegnato
                  </span>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Shield className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                    <span className={`text-sm font-bold uppercase ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentUser.role}</span>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
                }`}>
                  <span className={`text-[11px] font-bold block uppercase tracking-wider ${
                    isLight ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    Username
                  </span>
                  <span className={`text-sm font-mono font-bold mt-1.5 block ${
                    isLight ? 'text-amber-800' : 'text-amber-300'
                  }`}>
                    {currentUser.username}
                  </span>
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${
                isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex justify-between text-xs">
                  <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Nome Completo:</span>
                  <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentUser.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Email:</span>
                  <span className={`font-mono ${isLight ? 'text-slate-900 font-medium' : 'text-white'}`}>{currentUser.email || 'Non specificata'}</span>
                </div>
                {currentUser.lastLoginAt && (
                  <div className="flex justify-between text-xs">
                    <span className={isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}>Ultimo Accesso:</span>
                    <span className={`font-mono ${isLight ? 'text-slate-800 font-medium' : 'text-slate-300'}`}>
                      {new Date(currentUser.lastLoginAt).toLocaleString('it-IT')}
                    </span>
                  </div>
                )}
              </div>

              <div className={`pt-4 border-t flex justify-end ${isLight ? 'border-slate-300' : 'border-slate-800'}`}>
                <button
                  onClick={onLogout}
                  className={`px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                  }`}
                >
                  Disconnetti da questo dispositivo
                </button>
              </div>
            </div>
          )}

          {/* CHANGE PASSWORD TAB */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {pwdMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    pwdMsg.type === 'success'
                      ? isLight ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : isLight ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  {pwdMsg.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span className="font-semibold">{pwdMsg.text}</span>
                </div>
              )}

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  Password Attuale
                </label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Inserisci la password attuale"
                  required
                  className={`w-full px-3.5 py-2 rounded-xl text-xs transition-all focus:outline-none focus:border-amber-500 ${
                    isLight
                      ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'
                      : 'bg-slate-950 border border-slate-700 text-white placeholder-slate-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    Nuova Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Almeno 4 caratteri"
                    required
                    className={`w-full px-3.5 py-2 rounded-xl text-xs transition-all focus:outline-none focus:border-amber-500 ${
                      isLight
                        ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'
                        : 'bg-slate-950 border border-slate-700 text-white placeholder-slate-500'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                    Conferma Nuova Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti nuova password"
                    required
                    className={`w-full px-3.5 py-2 rounded-xl text-xs transition-all focus:outline-none focus:border-amber-500 ${
                      isLight
                        ? 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'
                        : 'bg-slate-950 border border-slate-700 text-white placeholder-slate-500'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{pwdLoading ? 'Salvataggio...' : 'Salva Nuova Password'}</span>
                </button>
              </div>
            </form>
          )}

          {/* ADMIN USER MANAGEMENT TAB */}
          {activeTab === 'users' && currentUser.role === 'admin' && (
            <div className="space-y-6">
              {/* Add New User */}
              <div className={`p-4 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <h4 className={`text-xs font-bold flex items-center gap-2 mb-3 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <UserPlus className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                  <span>Crea Nuovo Account Utente</span>
                </h4>

                {userActionMsg && (
                  <div
                    className={`mb-3 p-2.5 rounded-lg text-xs flex items-center gap-2 border ${
                      userActionMsg.type === 'success'
                        ? isLight ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : isLight ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    <span className="font-semibold">{userActionMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Username *</label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="es. mario.rossi"
                        required
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Nome e Cognome *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="es. Mario Rossi"
                        required
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Password *</label>
                      <input
                        type="password"
                        value={newUserPass}
                        onChange={(e) => setNewUserPass(e.target.value)}
                        placeholder="Password iniziale"
                        required
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Ruolo Accesso</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => {
                          const r = e.target.value as UserRole;
                          setNewUserRole(r);
                          if (r === 'cliente' && customers.length > 0 && !newUserCustomerId) {
                            setNewUserCustomerId(customers[0].id);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      >
                        {rolesList.length > 0 ? (
                          rolesList.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="operatore">Operatore Macchina</option>
                            <option value="tecnico">Tecnico Installatore / Hardware</option>
                            <option value="gestore">Responsabile Operativo / Gestore Flotta</option>
                            <option value="cliente">Cliente / Referente Sede</option>
                            <option value="viewer">Viewer (Sola Lettura)</option>
                            <option value="admin">Amministratore (Super Admin)</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>
                        🏢 Cliente Associato {newUserRole === 'cliente' && <span className="text-emerald-700 font-bold">*</span>}
                      </label>
                      <select
                        value={newUserCustomerId}
                        onChange={(e) => setNewUserCustomerId(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      >
                        <option value="">-- Nessun cliente (Tutta la flotta) --</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-slate-400'}`}>Email (Opzionale)</label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="mario@azienda.it"
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-amber-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Aggiungi Utente</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Users List */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Utenti Registrati ({usersList.length})
                  </h4>
                  <button
                    onClick={fetchUsers}
                    className={`text-xs flex items-center gap-1 transition-colors font-medium ${
                      isLight ? 'text-slate-700 hover:text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <RefreshCw className={`w-3 h-3 ${usersLoading ? 'animate-spin' : ''}`} />
                    <span>Aggiorna</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {usersList.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isMainAdmin = u.username.toLowerCase() === 'admin' || u.username.toLowerCase() === 'claudio graf';
                    const isUpdating = updatingRoleId === u.id;
                    const hasCustomPerms = Array.isArray(u.customAllowedTabs) && u.customAllowedTabs.length > 0;
                    const isExpanded = expandedUserPermsId === u.id;
                    const isSavingPerms = savingUserPermsId === u.id;
                    const currentTabsDraft = userPermsDraft[u.id] || u.customAllowedTabs || [];

                    return (
                      <div
                        key={u.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          isExpanded
                            ? isLight ? 'bg-emerald-50/30 border-emerald-300 shadow-md ring-1 ring-emerald-300' : 'bg-emerald-950/20 border-emerald-700/60 shadow-md ring-1 ring-emerald-700/60'
                            : isLight ? 'bg-white border-slate-300' : 'bg-slate-950/50 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isLight ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {u.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className={`text-xs font-bold ${isLight ? 'text-slate-950' : 'text-white'}`}>{u.name}</span>
                                <span className={`text-[10px] font-mono font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>@{u.username}</span>
                                {isSelf && (
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                    isLight ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    TU
                                  </span>
                                )}
                                {hasCustomPerms && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    isLight ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50'
                                  }`}>
                                    Permessi Custom ({u.customAllowedTabs?.length})
                                  </span>
                                )}
                                {u.customerId && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                    isLight ? 'bg-teal-50 text-teal-800 border-teal-200' : 'bg-teal-950/40 text-teal-300 border-teal-700/50'
                                  }`}>
                                    🏢 {customers.find((c) => c.id === u.customerId)?.name || u.customerId}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] font-medium ${isLight ? 'text-slate-700' : 'text-slate-500'}`}>
                                {u.email ? u.email : 'Nessuna email'} &bull; Ultimo login:{' '}
                                {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('it-IT') : 'Mai'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                            {/* Role Selector */}
                            <div className="flex items-center gap-1.5">
                              <label className={`text-[10px] font-semibold uppercase ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                Ruolo:
                              </label>
                              <select
                                value={u.role}
                                disabled={isUpdating || (isSelf && u.role === 'admin')}
                                onChange={(e) => handleRoleChange(u.id, u.name, e.target.value as UserRole)}
                                title={isSelf && u.role === 'admin' ? 'Non puoi declassare il tuo stesso account mentre sei loggato' : 'Modifica il ruolo di questo utente'}
                                className={`text-xs font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                                  u.role === 'admin'
                                    ? isLight
                                      ? 'bg-amber-50 text-amber-900 border-amber-400 focus:ring-amber-400'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 focus:ring-amber-400'
                                    : u.role === 'tecnico'
                                    ? isLight
                                      ? 'bg-sky-50 text-sky-900 border-sky-400 focus:ring-sky-400'
                                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40 focus:ring-sky-400'
                                    : u.role === 'gestore'
                                    ? isLight
                                      ? 'bg-indigo-50 text-indigo-900 border-indigo-400 focus:ring-indigo-400'
                                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 focus:ring-indigo-400'
                                    : u.role === 'operatore'
                                    ? isLight
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-400 focus:ring-emerald-400'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 focus:ring-emerald-400'
                                    : u.role === 'cliente'
                                    ? isLight
                                      ? 'bg-emerald-50 text-emerald-900 border-emerald-400 focus:ring-emerald-400'
                                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 focus:ring-emerald-400'
                                    : isLight
                                    ? 'bg-slate-100 text-slate-800 border-slate-300 focus:ring-slate-400'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 focus:ring-slate-500'
                                } ${isUpdating ? 'opacity-50 cursor-wait' : ''}`}
                              >
                                {rolesList.length > 0 ? (
                                  rolesList.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value="admin">Amministratore (Super Admin)</option>
                                    <option value="tecnico">Tecnico Installatore / Hardware</option>
                                    <option value="gestore">Responsabile Operativo / Gestore Flotta</option>
                                    <option value="operatore">Operatore Macchina</option>
                                    <option value="cliente">Cliente / Referente Sede</option>
                                    <option value="viewer">Viewer (Sola Lettura)</option>
                                  </>
                                )}
                              </select>
                            </div>

                            {/* Custom Permissions Button */}
                            {u.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserPermsExpand(u)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isExpanded
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : hasCustomPerms
                                    ? isLight
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                      : 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50 hover:bg-emerald-900/60'
                                    : isLight
                                    ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                                title={hasCustomPerms ? 'Modifica permessi specifici di questo utente' : 'Personalizza schede visibili per questo utente'}
                              >
                                <Sliders className="w-3 h-3 text-emerald-500" />
                                <span>{hasCustomPerms ? `Custom (${u.customAllowedTabs?.length})` : 'Accessi'}</span>
                              </button>
                            )}

                            {/* Delete Button */}
                            {!isMainAdmin && !isSelf && (
                              <button
                                onClick={() => handleDeleteUser(u.id, u.name)}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                  isLight 
                                    ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50' 
                                    : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40'
                                }`}
                                title={`Elimina utente '${u.name}'`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Per-User Granular Access Drawer */}
                        {isExpanded && u.role !== 'admin' && (
                          <div className={`mt-3 pt-3 border-t space-y-3 ${
                            isLight ? 'border-emerald-200/80 bg-emerald-50/50 -mx-3 -mb-3 p-3 rounded-b-2xl' : 'border-emerald-800/40 bg-emerald-950/20 -mx-3 -mb-3 p-3 rounded-b-2xl'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div>
                                <span className={`text-xs font-bold flex items-center gap-1.5 ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>
                                  <Sliders className="w-3.5 h-3.5" />
                                  <span>Permessi Individuali per {u.name}</span>
                                </span>
                                <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {hasCustomPerms
                                    ? 'Questo utente usa permessi personalizzati che sovrascrivono il default del suo ruolo.'
                                    : `Attualmente eredita i permessi standard del ruolo '${u.role}'. Puoi personalizzarli qui sotto:`}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleSetOnlyDashboard(u.id)}
                                  className="px-2.5 py-1 text-xs rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold transition-all cursor-pointer flex items-center gap-1"
                                  title="Rende visibile esclusivamente il cruscotto a questo utente"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-500" />
                                  <span>Solo Cruscotto</span>
                                </button>

                                {hasCustomPerms && (
                                  <button
                                    type="button"
                                    disabled={isSavingPerms}
                                    onClick={() => handleSaveUserCustomPerms(u, true)}
                                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1"
                                    title="Rimuovi le eccezioni e torna ai permessi predefiniti del ruolo"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Ripristina Default Ruolo</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={isSavingPerms}
                                  onClick={() => handleSaveUserCustomPerms(u, false)}
                                  className="px-3 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <Save className={`w-3 h-3 ${isSavingPerms ? 'animate-spin' : ''}`} />
                                  <span>{isSavingPerms ? 'Salvataggio...' : 'Salva per questo Utente'}</span>
                                </button>
                              </div>
                            </div>

                            {/* Customer Association in Drawer */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 pb-1 border-b border-inherit">
                              <label className={`text-[11px] font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                                🏢 Cliente / Struttura Associata:
                              </label>
                              <select
                                value={userCustomerDraft[u.id] !== undefined ? userCustomerDraft[u.id] : (u.customerId || '')}
                                onChange={(e) => setUserCustomerDraft((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                className={`text-xs px-2.5 py-1 rounded-lg border focus:outline-none focus:border-amber-500 ${
                                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                                }`}
                              >
                                <option value="">-- Nessun cliente specifico (Accesso generale) --</option>
                                {customers.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.code})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                              {[
                                { id: 'dashboard', label: '📊 Dashboard' },
                                { id: 'machines', label: '☕ Macchine e Moduli' },
                                { id: 'customers', label: '🏢 Clienti & Sedi' },
                                { id: 'data', label: '📈 Dati & Statistiche' },
                                { id: 'programming', label: '🧪 Programmazione Ricette' },
                                { id: 'ota', label: '📡 Aggiornamento OTA' },
                                { id: 'touch-panel', label: '📱 Display Touch 10.1"' },
                                { id: 'opta-lab', label: '🔬 Opta RS-485 Lab' },
                                { id: 'database', label: '🗄️ Gestione DB SQL' },
                              ].map((tab) => {
                                const isChecked = (currentTabsDraft || []).includes(tab.id);
                                return (
                                  <label
                                    key={tab.id}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer ${
                                      isChecked
                                        ? isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-semibold' : 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200 font-semibold'
                                        : isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleTabForUser(u.id, tab.id)}
                                      className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>{tab.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ROLES & PERMISSIONS MATRIX TAB */}
          {activeTab === 'roles' && currentUser.role === 'admin' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    <Sliders className="w-4 h-4 text-emerald-500" />
                    <span>Matrice Ruoli &amp; Autorizzazioni Portale</span>
                  </h4>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Configura quali schede della Navbar e quali funzioni operative può visualizzare e utilizzare ciascun ruolo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={fetchRoles}
                    disabled={rolesLoading}
                    className={`p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isLight ? 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-slate-300'
                    }`}
                    title="Ricarica configurazione ruoli"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rolesLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Aggiorna</span>
                  </button>

                  <button
                    onClick={() => setShowNewRoleForm(!showNewRoleForm)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuovo Ruolo</span>
                  </button>
                </div>
              </div>

              {roleActionMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                    roleActionMsg.type === 'success'
                      ? isLight ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                      : isLight ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                  }`}
                >
                  <span className="font-semibold">{roleActionMsg.text}</span>
                </div>
              )}

              {/* Form: Nuovo Ruolo Personalizzato */}
              {showNewRoleForm && (
                <form onSubmit={handleCreateRoleSubmit} className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/40'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200/40">
                    <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-emerald-900' : 'text-emerald-300'}`}>
                      Crea Nuovo Ruolo Personalizzato
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewRoleForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Chiudi
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        Codice ID (univoco, min. 2 lettere) *
                      </label>
                      <input
                        type="text"
                        value={newCustomRoleId}
                        onChange={(e) => setNewCustomRoleId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                        placeholder="es. installatore_esterno"
                        required
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono focus:outline-none focus:border-emerald-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        Nome Visualizzato *
                      </label>
                      <input
                        type="text"
                        value={newCustomRoleName}
                        onChange={(e) => setNewCustomRoleName(e.target.value)}
                        placeholder="es. Installatore Esterno"
                        required
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500 ${
                          isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-[11px] font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      Descrizione Ruolo
                    </label>
                    <input
                      type="text"
                      value={newCustomRoleDesc}
                      onChange={(e) => setNewCustomRoleDesc(e.target.value)}
                      placeholder="Descrizione delle mansioni o livello di accesso"
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-emerald-500 ${
                        isLight ? 'bg-white border border-slate-300 text-slate-900' : 'bg-slate-900 border border-slate-700 text-white'
                      }`}
                    />
                  </div>

                  <div>
                    <label className={`block text-[11px] font-medium mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                      Schede Navbar Abilitate per questo Ruolo:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'dashboard', label: '📊 Dashboard' },
                        { id: 'machines', label: '☕ Macchine e Moduli' },
                        { id: 'customers', label: '🏢 Clienti & Sedi' },
                        { id: 'data', label: '📈 Dati & Statistiche' },
                        { id: 'programming', label: '🧪 Programmazione Ricette' },
                        { id: 'ota', label: '📡 Aggiornamento OTA' },
                        { id: 'touch-panel', label: '📱 Display Touch 10.1"' },
                        { id: 'opta-lab', label: '🔬 Opta RS-485 Lab' },
                        { id: 'database', label: '🗄️ Gestione DB SQL' },
                      ].map((tab) => {
                        const isChecked = newCustomRoleTabs.includes(tab.id);
                        return (
                          <label
                            key={tab.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer select-none transition-all ${
                              isChecked
                                ? isLight ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900 font-semibold' : 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200 font-semibold'
                                : isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setNewCustomRoleTabs((prev) =>
                                  isChecked ? prev.filter((t) => t !== tab.id) : [...prev, tab.id]
                                );
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{tab.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewRoleForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Salva e Aggiungi Ruolo</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Lista Ruoli Configurate */}
              <div className="space-y-4">
                {rolesList.map((role) => {
                  const formData = roleFormState[role.id] || role;
                  const isSaving = savingRoleId === role.id;
                  const isSystem = role.isSystem || ['admin', 'tecnico', 'gestore', 'operatore', 'cliente', 'viewer'].includes(role.id);
                  const isAdmin = role.id === 'admin';

                  return (
                    <div
                      key={role.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      {/* Role Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            role.id === 'admin'
                              ? isLight ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : role.id === 'tecnico'
                              ? isLight ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              : role.id === 'gestore'
                              ? isLight ? 'bg-indigo-100 text-indigo-800 border border-indigo-300' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : role.id === 'operatore'
                              ? isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : role.id === 'cliente'
                              ? isLight ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isLight ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {role.id}
                          </span>

                          <input
                            type="text"
                            value={formData.name}
                            disabled={isAdmin}
                            onChange={(e) => {
                              const newName = e.target.value;
                              setRoleFormState((prev) => ({
                                ...prev,
                                [role.id]: {
                                  ...formData,
                                  name: newName,
                                },
                              }));
                            }}
                            className={`text-sm font-bold px-2 py-0.5 rounded border focus:outline-none focus:border-emerald-500 ${
                              isLight ? 'bg-slate-50 border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-700 text-white'
                            }`}
                          />

                          {isSystem && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Sistema)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {!isSystem && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRole(role.id, role.name)}
                              className="p-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Elimina questo ruolo personalizzato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isSaving || isAdmin}
                            onClick={() => handleSaveRole(role.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                              isAdmin
                                ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-600'
                                : isLight
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                            }`}
                            title={isAdmin ? 'L\'amministratore mantiene sempre accesso a tutte le sezioni' : 'Salva modifiche permessi per questo ruolo'}
                          >
                            <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                            <span>{isSaving ? 'Salvataggio...' : 'Salva Permessi'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Role Description */}
                      <div className="mt-2.5 mb-3">
                        <input
                          type="text"
                          value={formData.description || ''}
                          placeholder="Descrizione sintetica del ruolo"
                          onChange={(e) => {
                            const newDesc = e.target.value;
                            setRoleFormState((prev) => ({
                              ...prev,
                              [role.id]: {
                                ...formData,
                                description: newDesc,
                              },
                            }));
                          }}
                          className={`w-full text-xs px-2.5 py-1 rounded-lg border focus:outline-none focus:border-emerald-500 ${
                            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                        />
                      </div>

                      {/* Matrix of Tabs */}
                      <div className="space-y-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          Schede Navbar Visibili:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'dashboard', label: '📊 Dashboard' },
                            { id: 'machines', label: '☕ Macchine e Moduli' },
                            { id: 'customers', label: '🏢 Clienti & Sedi' },
                            { id: 'data', label: '📈 Dati & Statistiche' },
                            { id: 'programming', label: '🧪 Programmazione Ricette' },
                            { id: 'ota', label: '📡 Aggiornamento OTA' },
                            { id: 'touch-panel', label: '📱 Display Touch 10.1"' },
                            { id: 'opta-lab', label: '🔬 Opta RS-485 Lab' },
                            { id: 'database', label: '🗄️ Gestione DB SQL' },
                          ].map((tab) => {
                            const allowed = isAdmin || (formData.allowedTabs || []).includes(tab.id);
                            return (
                              <label
                                key={tab.id}
                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs select-none transition-all ${
                                  isAdmin
                                    ? 'opacity-80 cursor-not-allowed bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300'
                                    : allowed
                                    ? isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold cursor-pointer' : 'bg-emerald-900/20 border-emerald-500/40 text-emerald-200 font-semibold cursor-pointer'
                                    : isLight ? 'bg-slate-50 border-slate-200 text-slate-500 cursor-pointer' : 'bg-slate-900/60 border-slate-800 text-slate-500 cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={allowed}
                                  disabled={isAdmin}
                                  onChange={() => handleToggleTabForRole(role.id, tab.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>{tab.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Special Capabilities */}
                      {!isAdmin && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-white/5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                            Permessi Operativi Speciali:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(formData.canEditMachines)}
                                onChange={() => handleToggleActionForRole(role.id, 'canEditMachines')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Modifica parametri distributori</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(formData.canEditRecipes)}
                                onChange={() => handleToggleActionForRole(role.id, 'canEditRecipes')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Modifica ricette e dosaggi</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(formData.canUploadFirmware)}
                                onChange={() => handleToggleActionForRole(role.id, 'canUploadFirmware')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Caricamento ed esecuzione OTA Firmware</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(formData.canControlOptaLab)}
                                onChange={() => handleToggleActionForRole(role.id, 'canControlOptaLab')}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className={isLight ? 'text-slate-700' : 'text-slate-300'}>Controllo relè / comandi Opta RS-485</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {activeTab === 'vps' && currentUser.role === 'admin' && (
            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                isLight ? 'bg-blue-50/80 border-blue-200 text-blue-950' : 'bg-blue-950/30 border-blue-500/30 text-blue-200'
              }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-400'
                }`}>
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">Aggiornamento Continuo via GitHub</h4>
                  <p className={`text-xs mt-0.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Puoi sincronizzare e aggiornare la tua VPS direttamente da GitHub senza dover digitare comandi ogni volta.
                  </p>
                </div>
              </div>

              {/* SEZIONE GITHUB AUTOMATICA */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className={`text-xs font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                      Metodo 1 (Consigliato): GitHub Actions (100% Automatico)
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    File .github/workflows/deploy.yml pronto
                  </span>
                </div>
                <p className={`text-[11px] leading-relaxed ${isLight ? 'text-emerald-900/80' : 'text-emerald-200/80'}`}>
                  Il file di workflow è già inserito nel progetto. A ogni <strong>git push</strong> su GitHub, il server si aggiorna e si riavvia automaticamente.
                  Basta andare nelle <strong>Settings del tuo repository GitHub → Secrets and variables → Actions</strong> e aggiungere 3 segreti:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                  <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-emerald-200' : 'bg-black/50 border-emerald-500/20'}`}>
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">VPS_HOST</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate">IP pubblico VPS</div>
                  </div>
                  <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-emerald-200' : 'bg-black/50 border-emerald-500/20'}`}>
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">VPS_USER</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate">root (o tuo utente)</div>
                  </div>
                  <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-emerald-200' : 'bg-black/50 border-emerald-500/20'}`}>
                    <div className="text-[10px] text-slate-500 font-sans font-semibold">VPS_SSH_KEY</div>
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold truncate">Chiave SSH privata</div>
                  </div>
                </div>
              </div>

              {/* SEZIONE GITHUB WEBHOOK */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      Metodo 2: GitHub Webhook (Senza chiavi SSH)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('https://api.iobevoservice.it/api/git/webhook', 'webhook')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  >
                    {copiedKey === 'webhook' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'webhook' ? 'Copiato!' : 'Copia URL'}</span>
                  </button>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Su GitHub vai in <strong>Settings → Webhooks → Add webhook</strong>. Inserisci questo URL come <em>Payload URL</em> e tipo <em>application/json</em>. Ad ogni push GitHub ordina alla VPS di aggiornarsi.
                </p>
                <div className={`p-2.5 rounded-xl font-mono text-xs overflow-x-auto select-all border ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/60 border-white/10 text-blue-400'
                }`}>
                  http://IP_DELLA_TUA_VPS:3000/api/git/webhook
                </div>
              </div>

              {/* SEZIONE COMANDO DA TERMINALE VIA GIT */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className={`text-xs font-bold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                      Metodo 3: Aggiornamento da terminale in 1 solo comando (npm run git-update)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('npm run git-update', 'gitup')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    {copiedKey === 'gitup' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'gitup' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-emerald-900/80' : 'text-emerald-300/80'}`}>
                  Esegue in sequenza <code>git pull</code>, <code>npm install</code>, compilazione <code>npm run build</code> e riavvio di PM2:
                </p>
                <div className={`p-2.5 rounded-xl font-mono text-xs overflow-x-auto select-all border ${
                  isLight ? 'bg-white border-emerald-200 text-slate-900' : 'bg-black/60 border-emerald-500/20 text-emerald-300'
                }`}>
                  npm run git-update
                </div>
              </div>

              {/* Trovare la cartella del progetto sulla VPS */}
              <div className={`p-4 rounded-2xl border space-y-2 ${
                isLight ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Come trovare la cartella esatta del progetto sulla tua VPS
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('find / -name "server.ts" 2>/dev/null', 'find')}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer"
                  >
                    {copiedKey === 'find' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey === 'find' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-amber-900/80' : 'text-amber-300/80'}`}>
                  Se ricevi <em>&ldquo;No such file or directory&rdquo;</em>, la cartella del tuo progetto ha un nome o percorso diverso (ad es. <code>/root/...</code>, <code>/home/ubuntu/...</code>).
                  Esegui questo comando per localizzarla all&apos;istante:
                </p>
                <div className={`p-2 rounded-lg font-mono text-xs overflow-x-auto select-all border ${
                  isLight ? 'bg-white border-amber-200 text-slate-900' : 'bg-black/60 border-amber-500/30 text-amber-300'
                }`}>
                  find / -name &quot;server.ts&quot; 2&gt;/dev/null
                </div>
              </div>

              {/* One-Liner Script (Standard Update) */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                      1. Aggiornamento Automatico Standard
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('cd /var/www/vending-iot && ./update_vps.sh', 'std')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedKey === 'std' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'std' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Esegue backup del DB, build di produzione e riavvio PM2 mantenendo le tue macchine attuali:
                </p>
                <div className={`p-2.5 rounded-xl font-mono text-xs overflow-x-auto select-all border ${
                  isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/60 border-white/10 text-emerald-400'
                }`}>
                  cd /var/www/vending-iot &amp;&amp; ./update_vps.sh
                </div>
              </div>

              {/* Clean Slate Update (--reset-blank) */}
              <div className={`p-4 rounded-2xl border space-y-2.5 ${
                isLight ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    <span className={`text-xs font-bold ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>
                      2. Aggiornamento con Azzeramento Flotta (Partenza da Zero)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('cd /var/www/vending-iot && ./update_vps.sh --reset-blank', 'blank')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {copiedKey === 'blank' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'blank' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-amber-900/80' : 'text-amber-200/70'}`}>
                  Elimina tutti i distributori demo o di test per partire completamente da zero (con backup salvato in <code>data/backups/</code>):
                </p>
                <div className={`p-2.5 rounded-xl font-mono text-xs overflow-x-auto select-all border ${
                  isLight ? 'bg-white border-amber-200 text-slate-900' : 'bg-black/60 border-amber-500/20 text-amber-300'
                }`}>
                  cd /var/www/vending-iot &amp;&amp; ./update_vps.sh --reset-blank
                </div>
              </div>

              {/* Manual Steps Grid */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                    3. Comandi Manuali Singoli (per controllo passo-passo)
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('git pull && npm install && npm run build && pm2 restart all', 'allmanual')}
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold border transition-colors ${
                      isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {copiedKey === 'allmanual' ? 'Copiato!' : 'Copia sequenza'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[10px] text-slate-500 mb-0.5 font-sans">Build di Produzione:</div>
                    <code>npm run build</code>
                  </div>
                  <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[10px] text-slate-500 mb-0.5 font-sans">Riavvio PM2:</div>
                    <code>pm2 restart all</code>
                  </div>
                  <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[10px] text-slate-500 mb-0.5 font-sans">Controllo Log Live:</div>
                    <code>pm2 logs --lines 50</code>
                  </div>
                  <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-slate-200' : 'bg-black/40 border-white/5'}`}>
                    <div className="text-[10px] text-slate-500 mb-0.5 font-sans">Test Salute API:</div>
                    <code>curl -s http://127.0.0.1:3000/api/health</code>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRIVACY & COOKIE TAB */}
          {activeTab === 'privacy' && (
            <div className="space-y-5 text-xs leading-relaxed">
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  isLight
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                    : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <strong className="block font-bold mb-0.5">Piattaforma Conforme al GDPR (Regolamento UE 2016/679)</strong>
                  Questa applicazione è un portale B2B per la gestione, telemetria e manutenzione remota della flotta di distributori automatici.
                  Non contiene banner pubblicitari, né profilazione commerciale o tracciamento verso terze parti.
                </div>
              </div>

              {/* Cookie e Storage */}
              <div className="space-y-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Cookie className="w-3.5 h-3.5 text-amber-500" />
                  Cookie Policy &amp; Dati Salvati nel Browser (Web Storage)
                </h4>
                <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-amber-50/60 border-amber-300 text-amber-950' : 'bg-amber-950/20 border-amber-500/30 text-amber-200'}`}>
                  <p className="font-semibold mb-2">Vengono utilizzati esclusivamente <strong>Storage Tecnici Essenziali</strong>:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-amber-200' : 'bg-black/40 border-amber-500/20'}`}>
                      <span className="font-bold text-amber-700 dark:text-amber-400">vending_auth_token</span>
                      <p className="font-sans text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Mantiene attiva la sessione autenticata di lavoro.</p>
                    </div>
                    <div className={`p-2 rounded-lg border ${isLight ? 'bg-white border-amber-200' : 'bg-black/40 border-amber-500/20'}`}>
                      <span className="font-bold text-amber-700 dark:text-amber-400">vending_theme</span>
                      <p className="font-sans text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">Salva la preferenza grafica (Modalità Chiara o Scura).</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] font-sans text-slate-600 dark:text-slate-300">
                    Nessun cookie di terze parti (zero Google Analytics, zero Meta Pixel). In base alla normativa sui cookie (Direttiva ePrivacy e Linee Guida Garante Privacy), per i cookie tecnici non è richiesto consenso preventivo.
                  </p>
                </div>
              </div>

              {/* Trattamento Dati Personali */}
              <div className="space-y-2">
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Lock className="w-3.5 h-3.5 text-blue-500" />
                  Dati Personali &amp; Account Tecnici
                </h4>
                <div className={`p-3.5 rounded-xl border space-y-2 ${isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950/40 border-slate-800 text-slate-300'}`}>
                  <p>
                    I dati trattati comprendono nome, username, ruolo, indirizzo email del personale autorizzato e timestamp degli accessi tecnici.
                  </p>
                  <p>
                    I log delle macchine (matricola, erogazioni, dosaggi e tarature dei motori) sono dati tecnici industriali telemetrici non riconducibili all&apos;identità dei consumatori finali.
                  </p>
                </div>
              </div>

              {/* Diritti degli Utenti */}
              <div className="space-y-1.5">
                <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Diritti dell&apos;Interessato (Artt. 15-22 GDPR)
                </h4>
                <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
                  Ciascun utente della flotta può richiedere in qualsiasi momento all&apos;Amministratore la consultazione, rettifica, esportazione o cancellazione del proprio account di accesso.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

