import React, { useState, useMemo, useRef } from 'react';
import { Customer, CustomerSite, VendingMachine, KeyLog } from '../types';
import { useTheme } from '../context/ThemeContext';
import { downloadCsvFile } from '../utils/csvExporter';
import { CustomerDashboardView } from './CustomerDashboardView';
import { PortalBrandLogo } from './PortalBrandLogo';
import {
  Building2,
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  Phone,
  Mail,
  User,
  Server,
  Hash,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Barcode,
  Layers,
  Sparkles,
  ArrowRight,
  LayoutDashboard,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

interface CustomerManagerProps {
  customers: Customer[];
  machines: VendingMachine[];
  keyLogs?: KeyLog[];
  onRefresh: () => void;
  onSelectMachineForData: (machineId: string) => void;
  onSelectMachineForFleet: (machineId: string) => void;
}

export const CustomerManager: React.FC<CustomerManagerProps> = ({
  customers,
  machines,
  keyLogs = [],
  onRefresh,
  onSelectMachineForData,
  onSelectMachineForFleet,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dashboardCustomer, setDashboardCustomer] = useState<Customer | null>(null);
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Record<string, boolean>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Modal States
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [targetCustomerIdForSite, setTargetCustomerIdForSite] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<{ customerId: string; site: CustomerSite } | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'customer' | 'site' | 'all_customers';
    customerId: string;
    siteId?: string;
    name: string;
  } | null>(null);

  // Form states for Customer
  const [customerForm, setCustomerForm] = useState({
    code: '',
    name: '',
    logoUrl: '',
    vatNumber: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: '',
    zipCode: '',
    notes: '',
    initialSiteName: 'Sede Principale',
    initialSiteAddress: '',
  });

  // Form states for Site
  const [siteForm, setSiteForm] = useState({
    name: '',
    address: '',
    city: '',
    province: '',
    zipCode: '',
    floorRoom: 'Piano Terra',
    contactPerson: '',
    phone: '',
    notes: '',
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Toggle expansion
  const toggleExpand = (customerId: string) => {
    setExpandedCustomerIds((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  // Open modal to create customer
  const handleOpenCreateCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({
      code: `CLI-${String(customers.length + 1).padStart(2, '0')}`,
      name: '',
      logoUrl: '',
      vatNumber: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      province: '',
      zipCode: '',
      notes: '',
      initialSiteName: 'Sede Principale',
      initialSiteAddress: '',
    });
    setIsCustomerModalOpen(true);
  };

  // Open modal to edit customer
  const handleOpenEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({
      code: c.code || '',
      name: c.name,
      logoUrl: c.logoUrl || '',
      vatNumber: c.vatNumber || '',
      contactPerson: c.contactPerson || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      city: c.city || '',
      province: c.province || '',
      zipCode: c.zipCode || '',
      notes: c.notes || '',
      initialSiteName: '',
      initialSiteAddress: '',
    });
    setIsCustomerModalOpen(true);
  };

  // Open modal to create site
  const handleOpenCreateSite = (customerId: string) => {
    const parentCustomer = customers.find((c) => c.id === customerId);
    setTargetCustomerIdForSite(customerId);
    setEditingSite(null);
    setSiteForm({
      name: '',
      address: parentCustomer?.address || '',
      city: parentCustomer?.city || '',
      province: parentCustomer?.province || '',
      zipCode: parentCustomer?.zipCode || '',
      floorRoom: 'Piano Terra',
      contactPerson: parentCustomer?.contactPerson || '',
      phone: parentCustomer?.phone || '',
      notes: '',
    });
    setIsSiteModalOpen(true);
  };

  // Open modal to edit site
  const handleOpenEditSite = (customerId: string, site: CustomerSite) => {
    setTargetCustomerIdForSite(customerId);
    setEditingSite({ customerId, site });
    setSiteForm({
      name: site.name,
      address: site.address,
      city: site.city,
      province: site.province,
      zipCode: site.zipCode || '',
      floorRoom: site.floorRoom || 'Piano Terra',
      contactPerson: site.contactPerson || '',
      phone: site.phone || '',
      notes: site.notes || '',
    });
    setIsSiteModalOpen(true);
  };

  // Submit Customer (Create or Update)
  const handleSubmitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name.trim()) {
      showStatus('La ragione sociale del cliente è obbligatoria', 'error');
      return;
    }

    try {
      if (editingCustomer) {
        // Update
        const res = await fetch(`/api/customers/${editingCustomer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(customerForm),
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Cliente '${customerForm.name}' aggiornato con successo!`);
          setIsCustomerModalOpen(false);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante il salvataggio', 'error');
        }
      } else {
        // Create
        const payload = {
          ...customerForm,
          initialSite: customerForm.initialSiteName
            ? {
                name: customerForm.initialSiteName,
                address: customerForm.initialSiteAddress || customerForm.address,
                city: customerForm.city,
                province: customerForm.province,
                zipCode: customerForm.zipCode,
              }
            : undefined,
        };
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Cliente '${customerForm.name}' inserito con successo!`);
          setIsCustomerModalOpen(false);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante la creazione', 'error');
        }
      }
    } catch {
      showStatus('Errore di connessione col server', 'error');
    }
  };

  // Submit Site (Create or Update)
  const handleSubmitSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm.name.trim()) {
      showStatus('Il nome della sede è obbligatorio', 'error');
      return;
    }

    const customerId = targetCustomerIdForSite;
    if (!customerId) return;

    try {
      if (editingSite) {
        // Update
        const res = await fetch(`/api/customers/${customerId}/sites/${editingSite.site.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(siteForm),
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Sede '${siteForm.name}' aggiornata con successo!`);
          setIsSiteModalOpen(false);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante il salvataggio', 'error');
        }
      } else {
        // Create
        const res = await fetch(`/api/customers/${customerId}/sites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(siteForm),
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Sede '${siteForm.name}' creata con successo!`);
          setIsSiteModalOpen(false);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante la creazione', 'error');
        }
      }
    } catch {
      showStatus('Errore di connessione col server', 'error');
    }
  };

  // Execute Delete Customer or Site
  const handleExecuteDelete = async () => {
    if (!deleteConfirm) return;

    try {
      if (deleteConfirm.type === 'all_customers') {
        const res = await fetch('/api/customers', {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          showStatus('Anagrafica clienti svuotata con successo!');
          setDeleteConfirm(null);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante lo svuotamento', 'error');
        }
      } else if (deleteConfirm.type === 'customer') {
        const res = await fetch(`/api/customers/${deleteConfirm.customerId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Cliente '${deleteConfirm.name}' rimosso con successo!`);
          setDeleteConfirm(null);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante l\'eliminazione', 'error');
        }
      } else if (deleteConfirm.type === 'site' && deleteConfirm.siteId) {
        const res = await fetch(`/api/customers/${deleteConfirm.customerId}/sites/${deleteConfirm.siteId}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (data.success) {
          showStatus(`Sede '${deleteConfirm.name}' rimossa con successo!`);
          setDeleteConfirm(null);
          onRefresh();
        } else {
          showStatus(data.error || 'Errore durante l\'eliminazione', 'error');
        }
      }
    } catch {
      showStatus('Errore di connessione col server', 'error');
    }
  };

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchCode = c.code.toLowerCase().includes(q);
      const matchVat = (c.vatNumber || '').toLowerCase().includes(q);
      const matchCity = (c.city || '').toLowerCase().includes(q);
      const matchPerson = (c.contactPerson || '').toLowerCase().includes(q);
      const matchSites = (c.sites || []).some(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q)
      );
      return matchName || matchCode || matchVat || matchCity || matchPerson || matchSites;
    });
  }, [customers, searchQuery]);

  // Overall stats
  const totalSites = useMemo(() => {
    return customers.reduce((acc, c) => acc + (c.sites?.length || 0), 0);
  }, [customers]);

  const assignedMachinesCount = useMemo(() => {
    return machines.filter((m) => Boolean(m.customerId)).length;
  }, [machines]);

  const uniqueProvinces = useMemo(() => {
    const setP = new Set<string>();
    customers.forEach((c) => {
      if (c.province) setP.add(c.province.toUpperCase());
      c.sites?.forEach((s) => {
        if (s.province) setP.add(s.province.toUpperCase());
      });
    });
    return Array.from(setP);
  }, [customers]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      'Codice Cliente',
      'Ragione Sociale',
      'Partita IVA',
      'Città',
      'Provincia',
      'Referente',
      'Telefono',
      'Email',
      'ID Sede',
      'Nome Sede',
      'Indirizzo Sede',
      'Città Sede',
      'Matricole Assegnate',
    ];

    const rows: (string | number | null | undefined)[][] = [];

    customers.forEach((c) => {
      const customerMachines = machines.filter(
        (m) =>
          m.customerId === c.id ||
          (m.locationDetails?.company || '').toLowerCase() === c.name.toLowerCase()
      );
      if (!c.sites || c.sites.length === 0) {
        rows.push([
          c.code,
          c.name,
          c.vatNumber || '',
          c.city || '',
          c.province || '',
          c.contactPerson || '',
          c.phone || '',
          c.email || '',
          '',
          '',
          '',
          '',
          customerMachines.map((m) => m.serialNumber).join('; '),
        ]);
      } else {
        c.sites.forEach((s) => {
          const siteMachines = customerMachines.filter((m) => m.customerSiteId === s.id);
          rows.push([
            c.code,
            c.name,
            c.vatNumber || '',
            c.city || '',
            c.province || '',
            c.contactPerson || '',
            c.phone || '',
            c.email || '',
            s.id,
            s.name,
            s.address,
            s.city,
            siteMachines.map((m) => `#${m.serialNumber} (${m.name})`).join('; '),
          ]);
        });
      }
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvFile(`database_clienti_${dateStr}.csv`, headers, rows);
    showStatus(`Export CSV generato con successo (${rows.length} righe)!`);
  };

  // If user selected a customer to view their dedicated dashboard
  if (dashboardCustomer) {
    const currentCust = customers.find((c) => c.id === dashboardCustomer.id) || dashboardCustomer;
    return (
      <CustomerDashboardView
        customer={currentCust}
        machines={machines}
        keyLogs={keyLogs}
        onBack={() => setDashboardCustomer(null)}
        onRefresh={onRefresh}
        onSelectMachine={(mId) => onSelectMachineForData(mId)}
        onUpdateCustomerLogo={async (cId, newLogo) => {
          setDashboardCustomer((prev) => (prev ? { ...prev, logoUrl: newLogo } : null));
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : 'bg-rose-600 text-white border-rose-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* HEADER WITH TITLE & ACTIONS */}
      <div
        className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-3xl p-6 border transition-all ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs flex items-center shrink-0">
              <PortalBrandLogo size="xs" className="h-7 w-auto" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-xl font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Clienti &amp; Sedi Operative
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    isLight
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  }`}
                >
                  {customers.length} Clienti
                </span>
              </div>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Anagrafica clienti, sedi di installazione impianti e monitoraggio distributori associati.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className={`px-3.5 py-2 border rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
            }`}
            title="Esporta anagrafica clienti e sedi in formato CSV"
          >
            <Download className="w-4 h-4 text-emerald-500" />
            <span>Esporta CSV</span>
          </button>

          <button
            onClick={handleOpenCreateCustomer}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Nuovo Cliente</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div
          className={`border rounded-2xl p-4.5 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Clienti Gestori Registrati</span>
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className={`text-2xl font-extrabold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {customers.length}
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Aziende clienti e partner di erogazione
          </div>
        </div>

        {/* Metric 2 */}
        <div
          className={`border rounded-2xl p-4.5 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Sedi &amp; Stabilimenti</span>
            <MapPin className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl font-extrabold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            {totalSites}
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Punti operativi e aree ristoro configurate
          </div>
        </div>

        {/* Metric 3 */}
        <div
          className={`border rounded-2xl p-4.5 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Distributori Assegnati</span>
            <Server className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-2xl font-extrabold ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            {assignedMachinesCount} / {machines.length}
          </div>
          <div className={`text-[11px] mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Macchine con matricola associata a cliente
          </div>
        </div>

        {/* Metric 4 */}
        <div
          className={`border rounded-2xl p-4.5 transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900/60 border-white/10 shadow-lg'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Copertura Territoriale</span>
            <Layers className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-2xl font-extrabold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
            {uniqueProvinces.length} Province
          </div>
          <div className={`text-[11px] mt-1 font-mono ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            {uniqueProvinces.join(', ') || 'Nessuna provincia'}
          </div>
        </div>
      </div>

      {/* SEARCH BAR & FILTERS */}
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-white/10'
        }`}
      >
        <div className="relative w-full sm:w-96">
          <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
          <input
            type="text"
            placeholder="Cerca cliente per nome, codice, P.IVA, città o sede..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full text-xs rounded-xl pl-9 pr-3 py-2 border transition-all ${
              isLight
                ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white'
                : 'bg-black/40 border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500'
            }`}
          />
        </div>

        <div className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          Mostrati <strong className={isLight ? 'text-slate-900' : 'text-white'}>{filteredCustomers.length}</strong> di {customers.length} clienti
        </div>
      </div>

      {/* CUSTOMERS LIST CARDS */}
      <div className="space-y-4">
        {filteredCustomers.length === 0 ? (
          <div
            className={`text-center py-16 rounded-3xl border ${
              isLight ? 'bg-white border-slate-200' : 'bg-slate-900/50 border-white/10'
            }`}
          >
            <Building2 className="w-12 h-12 mx-auto mb-3 text-slate-400 opacity-50" />
            <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Nessun cliente trovato
            </h3>
            <p className={`text-xs mt-1 max-w-sm mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {searchQuery
                ? 'Nessun risultato corrisponde alla ricerca inserita. Prova con altri termini.'
                : 'Il database clienti è attualmente vuoto. Inserisci il primo cliente con il pulsante "Nuovo Cliente".'}
            </p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomerIds[customer.id] ?? true;
            // Get machines assigned to this customer
            const customerMachines = machines.filter(
              (m) =>
                m.customerId === customer.id ||
                (m.locationDetails?.company || '').toLowerCase() === customer.name.toLowerCase()
            );

            return (
              <div
                key={customer.id}
                className={`border rounded-3xl overflow-hidden transition-all shadow-sm ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-slate-300'
                    : 'bg-slate-900/80 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Customer Card Header */}
                <div
                  className={`p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${
                    isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div
                      className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 overflow-hidden ${
                        isLight
                          ? 'bg-white border-slate-200 text-emerald-700 shadow-sm'
                          : 'bg-slate-800 border-white/10 text-emerald-300'
                      }`}
                    >
                      {customer.logoUrl ? (
                        <img
                          src={customer.logoUrl}
                          alt={customer.name}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-emerald-500" />
                      )}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className={`text-base font-bold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {customer.name}
                        </h2>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                          isLight ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white/10 text-slate-300 border-white/10'
                        }`}>
                          {customer.code}
                        </span>
                        {customer.vatNumber && (
                          <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                            P.IVA: <strong>{customer.vatNumber}</strong>
                          </span>
                        )}
                      </div>

                      <div className={`text-xs mt-1 flex flex-wrap items-center gap-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {customer.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            {customer.address}, {customer.city} ({customer.province})
                          </span>
                        )}
                        {customer.contactPerson && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {customer.contactPerson}
                          </span>
                        )}
                        {customer.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {customer.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Stats Badges */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      }`}
                    >
                      {customer.sites?.length || 0} Sedi
                    </span>

                    <span
                      className={`px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                        isLight
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      }`}
                    >
                      {customerMachines.length} Distributori
                    </span>

                    <button
                      onClick={() => setDashboardCustomer(customer)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer ${
                        isLight
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-200'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
                      }`}
                      title="Apri Cruscotto Dedicato Cliente"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      <span>Cruscotto</span>
                    </button>

                    <button
                      onClick={() => handleOpenCreateSite(customer.id)}
                      className={`p-2 border rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                      }`}
                      title="Aggiungi Sede Operativa"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="hidden sm:inline">Aggiungi Sede</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditCustomer(customer)}
                      className={`p-2 border rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                      }`}
                      title="Modifica Cliente"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                    </button>

                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          type: 'customer',
                          customerId: customer.id,
                          name: customer.name,
                        })
                      }
                      className="p-2 border rounded-xl text-xs font-medium bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700 transition-all cursor-pointer"
                      title="Elimina Cliente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => toggleExpand(customer.id)}
                      className={`p-2 border rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-600'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                      }`}
                      title={isExpanded ? 'Comprimi' : 'Espandi'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Customer Details: Sedi & Distributori */}
                {isExpanded && (
                  <div className="p-5 space-y-4">
                    {/* Customer Notes */}
                    {customer.notes && (
                      <div
                        className={`text-xs p-3 rounded-2xl border ${
                          isLight ? 'bg-amber-50/50 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                        }`}
                      >
                        <strong>Note Gestione:</strong> {customer.notes}
                      </div>
                    )}

                    {/* Sedi List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          Sedi Operative &amp; Impianti ({customer.sites?.length || 0})
                        </h4>
                      </div>

                      {(!customer.sites || customer.sites.length === 0) ? (
                        <div className={`p-4 rounded-2xl border text-center text-xs ${
                          isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/5 text-slate-400'
                        }`}>
                          Nessuna sede configurata per questo cliente. Clicca &quot;Aggiungi Sede&quot; per registrare la prima installazione.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {customer.sites.map((site) => {
                            // Find machines assigned specifically to this site
                            const siteMachines = customerMachines.filter(
                              (m) => m.customerSiteId === site.id
                            );

                            return (
                              <div
                                key={site.id}
                                className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                                  isLight
                                    ? 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
                                    : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                                }`}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                                        isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                                      }`}>
                                        <MapPin className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <h5 className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                          {site.name}
                                        </h5>
                                        <span className={`text-[10px] block ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                                          {site.address}, {site.city} ({site.province}) {site.zipCode}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Action buttons for site */}
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleOpenEditSite(customer.id, site)}
                                        className={`p-1.5 rounded-lg border text-xs cursor-pointer ${
                                          isLight ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/10 hover:bg-white/15 border-white/10 text-slate-200'
                                        }`}
                                        title="Modifica Sede"
                                      >
                                        <Edit2 className="w-3 h-3 text-blue-500" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          setDeleteConfirm({
                                            type: 'site',
                                            customerId: customer.id,
                                            siteId: site.id,
                                            name: site.name,
                                          })
                                        }
                                        className="p-1.5 rounded-lg border text-xs bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700 cursor-pointer"
                                        title="Elimina Sede"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Site details */}
                                  <div className={`mt-2.5 text-[11px] space-y-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                    {site.floorRoom && (
                                      <div>
                                        <strong>Piano / Reparto:</strong> {site.floorRoom}
                                      </div>
                                    )}
                                    {site.contactPerson && (
                                      <div>
                                        <strong>Referente in loco:</strong> {site.contactPerson} {site.phone ? `(${site.phone})` : ''}
                                      </div>
                                    )}
                                    {site.notes && (
                                      <div className={`italic text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {site.notes}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Installed machines in this site */}
                                <div className={`mt-3 pt-3 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                                      Distributori Installati ({siteMachines.length})
                                    </span>
                                  </div>

                                  {siteMachines.length === 0 ? (
                                    <span className={`text-[11px] italic ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                                      Nessun distributore assegnato a questa specifica sede.
                                    </span>
                                  ) : (
                                    <div className="space-y-1.5">
                                      {siteMachines.map((m) => (
                                        <div
                                          key={m.id}
                                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                                            isLight ? 'bg-white border-emerald-200 text-slate-800' : 'bg-black/30 border-emerald-500/20 text-slate-200'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2 truncate">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono font-bold text-[10px] border ${
                                              isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                            }`}>
                                              <Barcode className="w-3 h-3" />
                                              #{m.serialNumber}
                                            </span>
                                            <span className="font-semibold truncate">{m.name}</span>
                                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium border ${
                                              m.model === 'Ristosano'
                                                ? isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                                : m.model === 'Big 5'
                                                ? isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                                : isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                            }`}>
                                              {m.model}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                              onClick={() => onSelectMachineForData(m.id)}
                                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                                              title="Vedi telemetria in tempo reale di questa macchina"
                                            >
                                              <span>Dati</span>
                                              <ArrowRight className="w-2.5 h-2.5" />
                                            </button>

                                            <button
                                              onClick={() => onSelectMachineForFleet(m.id)}
                                              className={`px-2 py-1 border rounded-lg text-[10px] font-semibold cursor-pointer ${
                                                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-white/10 hover:bg-white/15 border-white/15 text-slate-200'
                                              }`}
                                              title="Configura macchina nel pannello flotta"
                                            >
                                              Macchina
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL: CREATE / EDIT CUSTOMER */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            className={`border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingCustomer ? 'Modifica Anagrafica Cliente' : 'Registra Nuovo Cliente'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inserisci i dettagli fiscali e operativi dell&apos;azienda cliente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(false)}
                className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer ${
                  isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                ✕ Chiudi
              </button>
            </div>

            <form onSubmit={handleSubmitCustomer} className="space-y-4">
              {/* Logo Aziendale Section */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <ImageIcon className="w-4 h-4" /> Logo Aziendale (per il Cruscotto Cliente)
                  </label>
                  {customerForm.logoUrl && (
                    <button
                      type="button"
                      onClick={() => setCustomerForm({ ...customerForm, logoUrl: '' })}
                      className="text-[11px] text-rose-500 hover:underline cursor-pointer font-semibold"
                    >
                      Rimuovi Logo
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Logo Preview Box */}
                  <div className="w-16 h-16 rounded-xl border bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                    {customerForm.logoUrl ? (
                      <img
                        src={customerForm.logoUrl}
                        alt="Logo Preview"
                        className="w-full h-full object-contain p-1"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              setCustomerForm({ ...customerForm, logoUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                          isLight
                            ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Carica Logo da File</span>
                      </button>
                      <span className="text-[11px] text-slate-400 hidden sm:inline">PNG, JPG, SVG</span>
                    </div>

                    <input
                      type="url"
                      placeholder="Oppure incolla URL logo (https://...)"
                      value={customerForm.logoUrl?.startsWith('data:') ? '' : customerForm.logoUrl}
                      onChange={(e) => setCustomerForm({ ...customerForm, logoUrl: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-1.5 border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold mb-1">
                    Ragione Sociale Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. IVS Italia S.p.A."
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Codice Cliente
                  </label>
                  <input
                    type="text"
                    placeholder="CLI-01"
                    value={customerForm.code}
                    onChange={(e) => setCustomerForm({ ...customerForm, code: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Partita IVA / Codice Fiscale
                  </label>
                  <input
                    type="text"
                    placeholder="IT00892830164"
                    value={customerForm.vatNumber}
                    onChange={(e) => setCustomerForm({ ...customerForm, vatNumber: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Referente Aziendale
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Dott. Marco Ferretti"
                    value={customerForm.contactPerson}
                    onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Telefono / Centralino
                  </label>
                  <input
                    type="text"
                    placeholder="+39 035 600111"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Email Contatto
                  </label>
                  <input
                    type="email"
                    placeholder="gestione@azienda.it"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              {/* Sede Legale */}
              <div className="border-t pt-3 space-y-3">
                <span className="text-xs font-bold text-blue-600 block">Indirizzo Sede Legale</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Via / Piazza e Numero Civico"
                      value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2 border ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Città (es. Milano)"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2 border ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Provincia (Sigla, es. MI)"
                      maxLength={4}
                      value={customerForm.province}
                      onChange={(e) => setCustomerForm({ ...customerForm, province: e.target.value.toUpperCase() })}
                      className={`w-full text-xs rounded-xl px-3 py-2 border font-mono uppercase ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                      }`}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="CAP (es. 20157)"
                      maxLength={5}
                      value={customerForm.zipCode}
                      onChange={(e) => setCustomerForm({ ...customerForm, zipCode: e.target.value })}
                      className={`w-full text-xs rounded-xl px-3 py-2 border font-mono ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Prima sede operativa if creating */}
              {!editingCustomer && (
                <div className="border-t pt-3 space-y-3">
                  <span className="text-xs font-bold text-emerald-600 block">
                    Prima Sede Operativa Iniziale (Opzionale)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Nome Sede (es. Sede Operativa Milano - Torre A)"
                        value={customerForm.initialSiteName}
                        onChange={(e) => setCustomerForm({ ...customerForm, initialSiteName: e.target.value })}
                        className={`w-full text-xs rounded-xl px-3 py-2 border ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Indirizzo Sede Operativa (se diverso)"
                        value={customerForm.initialSiteAddress}
                        onChange={(e) => setCustomerForm({ ...customerForm, initialSiteAddress: e.target.value })}
                        className={`w-full text-xs rounded-xl px-3 py-2 border ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Note &amp; Informazioni Aggiuntive
                </label>
                <textarea
                  rows={2}
                  placeholder="Dettagli contrattuali, note di accesso o istruzioni speciali..."
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  className={`w-full text-xs rounded-xl px-3 py-2 border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer ${
                    isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  {editingCustomer ? 'Salva Modifiche' : 'Crea Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT SITE */}
      {isSiteModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            className={`border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                  isLight ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                }`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingSite ? 'Modifica Sede Operativa' : 'Aggiungi Sede Operativa'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Definisci l&apos;indirizzo e il referente per questo punto installazione
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSiteModalOpen(false)}
                className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer ${
                  isLight ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                ✕ Chiudi
              </button>
            </div>

            <form onSubmit={handleSubmitSite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nome Sede / Stabilimento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Sede Direzionale Milano - Torre A"
                  value={siteForm.name}
                  onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                  className={`w-full text-xs rounded-xl px-3 py-2 border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Indirizzo (Via e Civico) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Via Stephenson 73"
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                  className={`w-full text-xs rounded-xl px-3 py-2 border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold mb-1">Città</label>
                  <input
                    type="text"
                    placeholder="Milano"
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold mb-1">Provincia</label>
                  <input
                    type="text"
                    placeholder="MI"
                    maxLength={4}
                    value={siteForm.province}
                    onChange={(e) => setSiteForm({ ...siteForm, province: e.target.value.toUpperCase() })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono uppercase ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold mb-1">CAP</label>
                  <input
                    type="text"
                    placeholder="20157"
                    maxLength={5}
                    value={siteForm.zipCode}
                    onChange={(e) => setSiteForm({ ...siteForm, zipCode: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border font-mono ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Piano / Reparto / Stanza
                </label>
                <input
                  type="text"
                  placeholder="Es. Piano Terra - Reception & Break Room"
                  value={siteForm.floorRoom}
                  onChange={(e) => setSiteForm({ ...siteForm, floorRoom: e.target.value })}
                  className={`w-full text-xs rounded-xl px-3 py-2 border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Referente in loco</label>
                  <input
                    type="text"
                    placeholder="Sig. Roberto Bianchi"
                    value={siteForm.contactPerson}
                    onChange={(e) => setSiteForm({ ...siteForm, contactPerson: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Telefono</label>
                  <input
                    type="text"
                    placeholder="+39 02 884729"
                    value={siteForm.phone}
                    onChange={(e) => setSiteForm({ ...siteForm, phone: e.target.value })}
                    className={`w-full text-xs rounded-xl px-3 py-2 border ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Note sulla sede</label>
                <textarea
                  rows={2}
                  placeholder="Istruzioni di accesso per i manutentori o orari..."
                  value={siteForm.notes}
                  onChange={(e) => setSiteForm({ ...siteForm, notes: e.target.value })}
                  className={`w-full text-xs rounded-xl px-3 py-2 border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-black/40 border-white/15 text-white'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsSiteModalOpen(false)}
                  className={`px-4 py-2 border rounded-xl text-xs font-semibold cursor-pointer ${
                    isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  {editingSite ? 'Salva Modifiche' : 'Aggiungi Sede'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRM DELETE */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div
            className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold">
                {deleteConfirm.type === 'all_customers'
                  ? 'Svuotare intera Anagrafica Clienti?'
                  : `Eliminare ${deleteConfirm.type === 'customer' ? 'il cliente' : 'la sede'}?`}
              </h3>
              <p className="text-xs text-slate-500">
                {deleteConfirm.type === 'all_customers' ? (
                  <>Stai per eliminare <strong>tutti i clienti</strong> presenti nel database. Tutte le macchine verranno impostate su &apos;Non Assegnato&apos;.</>
                ) : (
                  <>Stai per rimuovere definitivamente <strong>&quot;{deleteConfirm.name}&quot;</strong> dal database. Le macchine associate verranno scollegate.</>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 px-4 py-2.5 border rounded-xl text-xs font-semibold cursor-pointer ${
                  isLight ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                onClick={handleExecuteDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 cursor-pointer"
              >
                Sì, Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
