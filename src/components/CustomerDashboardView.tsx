import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Customer,
  CustomerSite,
  VendingMachine,
  KeyLog,
  ProductOrder,
  ProductOrderItem,
  CanisterCalibration,
  SupportRequest,
  SUPPORT_FAULT_CATEGORIES,
  FaultMacroArea,
} from '../types';
import { useTheme } from '../context/ThemeContext';
import { downloadCsvFile } from '../utils/csvExporter';
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  User,
  Coffee,
  Calendar,
  Clock,
  ArrowLeft,
  Download,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Sparkles,
  BarChart3,
  Layers,
  Activity,
  Trash2,
  Filter,
  RefreshCw,
  Search,
  Wifi,
  ChevronRight,
  ShoppingCart,
  Package,
  Plus,
  Minus,
  Send,
  Receipt,
  Check,
  Truck,
  Droplets,
  Flame,
  Info,
  Wrench,
  Zap,
  AlertOctagon,
  LifeBuoy,
} from 'lucide-react';
import { PortalBrandLogo } from './PortalBrandLogo';
import { findArticleByNameOrType, findArticleByCode, fetchArticles } from '../data/productArticles';

interface CustomerDashboardViewProps {
  customer: Customer;
  machines: VendingMachine[];
  keyLogs?: KeyLog[];
  onBack?: () => void;
  onRefresh?: () => void;
  onSelectMachine?: (machineId: string) => void;
  onUpdateCustomerLogo?: (customerId: string, logoUrl: string | undefined) => Promise<void> | void;
}

// Fallback canisters when machine has no custom calibration yet
const DEFAULT_VENDING_CANISTERS: Array<{
  canisterNumber: number;
  name: string;
  ingredientType: string;
}> = [
  { canisterNumber: 1, name: 'Caffè Solubile / Grani Espresso', ingredientType: 'coffee' },
  { canisterNumber: 2, name: 'Latte Scremato in Polvere', ingredientType: 'milk' },
  { canisterNumber: 3, name: 'Cioccolato Caldo Solubile', ingredientType: 'chocolate' },
  { canisterNumber: 4, name: 'The al Limone Solubile', ingredientType: 'tea' },
  { canisterNumber: 5, name: 'Orzo & Ginseng Solubile', ingredientType: 'solubles' },
  { canisterNumber: 6, name: 'Zucchero Semolato Fine', ingredientType: 'sugar' },
];

export const CustomerDashboardView: React.FC<CustomerDashboardViewProps> = ({
  customer,
  machines,
  keyLogs = [],
  onBack,
  onRefresh,
  onSelectMachine,
  onUpdateCustomerLogo,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Sub-tabs in Customer Dashboard
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'support'>('overview');

  // Filters
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [searchMachineQuery, setSearchMachineQuery] = useState('');

  // Logo upload state
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [customLogoInput, setCustomLogoInput] = useState(customer.logoUrl || '');
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [logoSaveError, setLogoSaveError] = useState<string | null>(null);
  const [logoSaveSuccess, setLogoSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Orders State
  const [orders, setOrders] = useState<ProductOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderSiteId, setOrderSiteId] = useState<string>(customer.sites?.[0]?.id || '');
  const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
  const [orderUnit, setOrderUnit] = useState<'Kg' | 'Confezioni'>('Kg');
  const [orderRequestedDate, setOrderRequestedDate] = useState<string>('');
  const [orderRequesterName, setOrderRequesterName] = useState<string>(customer.contactPerson || '');
  const [orderRequesterPhone, setOrderRequesterPhone] = useState<string>(customer.phone || '');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [orderRecipientEmail, setOrderRecipientEmail] = useState<string>('claudiograf@iobevo.com');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderSubmitSuccess, setOrderSubmitSuccess] = useState<ProductOrder | null>(null);
  const [orderSubmitError, setOrderSubmitError] = useState<string | null>(null);

  // Technical Support Tickets State
  const [supportTickets, setSupportTickets] = useState<SupportRequest[]>([]);
  const [isLoadingSupportTickets, setIsLoadingSupportTickets] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportSiteId, setSupportSiteId] = useState<string>(customer.sites?.[0]?.id || '');
  const [supportSerialNumber, setSupportSerialNumber] = useState<string>('');
  const [supportMacroArea, setSupportMacroArea] = useState<FaultMacroArea>('guasto_elettrico');
  const [supportSpecificIssue, setSupportSpecificIssue] = useState<string>('errore riscaldamento');
  const [supportIssueDescription, setSupportIssueDescription] = useState<string>('');
  const [supportPriority, setSupportPriority] = useState<'NORMALE' | 'ALTA' | 'CRITICA'>('ALTA');
  const [supportRequesterName, setSupportRequesterName] = useState<string>(customer.contactPerson || '');
  const [supportRequesterPhone, setSupportRequesterPhone] = useState<string>(customer.phone || '');
  const [supportRecipientEmail, setSupportRecipientEmail] = useState<string>('claudiograf@iobevo.com');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState<boolean>(false);
  const [supportSubmitSuccess, setSupportSubmitSuccess] = useState<SupportRequest | null>(null);
  const [supportSubmitError, setSupportSubmitError] = useState<string | null>(null);
  const [resendingTicketId, setResendingTicketId] = useState<string | null>(null);
  const [ticketNotification, setTicketNotification] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // SMTP & Resend State
  const [resendingOrderId, setResendingOrderId] = useState<string | null>(null);
  const [resendNotification, setResendNotification] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; defaultRecipient?: string } | null>(null);

  const fetchSmtpStatus = async () => {
    try {
      const res = await fetch('/api/system/smtp');
      if (res.ok) {
        const data = await res.json();
        setSmtpStatus({
          configured: Boolean(data.configured),
          defaultRecipient: data.config?.defaultRecipient,
        });
        if (data.config?.defaultRecipient) {
          setOrderRecipientEmail(data.config.defaultRecipient);
          setSupportRecipientEmail(data.config.defaultRecipient);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch orders on load
  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetch(`/api/orders?customerId=${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // Fetch support tickets on load
  const fetchSupportTickets = async () => {
    setIsLoadingSupportTickets(true);
    try {
      const res = await fetch(`/api/support-requests?customerId=${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        setSupportTickets(data);
      }
    } catch (err) {
      console.error('Failed to load support tickets', err);
    } finally {
      setIsLoadingSupportTickets(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSupportTickets();
    fetchArticles();
    fetchSmtpStatus();
  }, [customer.id]);

  const handleResendOrderEmail = async (orderId: string, recipientEmail?: string) => {
    setResendingOrderId(orderId);
    setResendNotification(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResendNotification({
          id: orderId,
          success: true,
          message: data.message || 'Email reinviata con successo!',
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, emailSent: true, emailError: undefined } : o))
        );
      } else {
        setResendNotification({
          id: orderId,
          success: false,
          message: data.error || "Errore durante l'invio dell'email. Verifica la configurazione SMTP.",
        });
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, emailSent: false, emailError: data.error } : o))
        );
      }
    } catch (err: any) {
      setResendNotification({
        id: orderId,
        success: false,
        message: err.message || 'Errore di connessione con il server',
      });
    } finally {
      setResendingOrderId(null);
    }
  };

  const handleResendSupportEmail = async (ticketId: string, recipientEmail?: string) => {
    setResendingTicketId(ticketId);
    setTicketNotification(null);
    try {
      const res = await fetch(`/api/support-requests/${ticketId}/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTicketNotification({
          id: ticketId,
          success: true,
          message: data.message || 'Email di assistenza reinviata con successo!',
        });
        setSupportTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, emailSent: true, emailError: undefined } : t))
        );
      } else {
        setTicketNotification({
          id: ticketId,
          success: false,
          message: data.error || "Errore durante l'invio dell'email di assistenza. Verifica la configurazione SMTP.",
        });
        setSupportTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, emailSent: false, emailError: data.error } : t))
        );
      }
    } catch (err: any) {
      setTicketNotification({
        id: ticketId,
        success: false,
        message: err.message || 'Errore di connessione con il server',
      });
    } finally {
      setResendingTicketId(null);
    }
  };

  const handleToggleTicketStatus = async (ticketId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'RISOLTO' ? 'IN_GESTIONE' : 'RISOLTO';
    try {
      const res = await fetch(`/api/support-requests/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSupportTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus, resolvedAt: nextStatus === 'RISOLTO' ? new Date().toISOString() : undefined } : t))
        );
      }
    } catch (err) {
      console.error('Failed to update ticket status', err);
    }
  };

  // Machines assigned to this customer
  const customerMachines = useMemo(() => {
    return machines.filter(
      (m) =>
        m.customerId === customer.id ||
        (m.locationDetails?.company || '').toLowerCase() === customer.name.toLowerCase()
    );
  }, [machines, customer]);

  // Distributori presenti nella sede selezionata per la richiesta assistenza tecnica
  const supportSiteMachines = useMemo(() => {
    if (!supportSiteId) return customerMachines;
    const selectedSite = customer.sites?.find((s) => s.id === supportSiteId);
    const matched = customerMachines.filter((m) => {
      if (m.customerSiteId && m.customerSiteId === supportSiteId) return true;
      if (
        selectedSite &&
        m.locationDetails?.site &&
        m.locationDetails.site.trim().toLowerCase() === selectedSite.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });
    return matched.length > 0 ? matched : customerMachines;
  }, [customerMachines, supportSiteId, customer.sites]);

  // Extract products strictly from canister calibration of machines installed in the selected site
  const availableCanisters = useMemo(() => {
    if (!orderSiteId) return [];

    const selectedSite = customer.sites?.find((s) => s.id === orderSiteId);

    // REGOLA RIGIDA: Filtra ESCLUSIVAMENTE i distributori installati nella sede selezionata
    const siteMachines = customerMachines.filter((m) => {
      if (m.customerSiteId && m.customerSiteId === orderSiteId) return true;
      if (
        selectedSite &&
        m.locationDetails?.site &&
        m.locationDetails.site.trim().toLowerCase() === selectedSite.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    // Se non ci sono macchine assegnate a questa specifica sede, non mostrare prodotti casuali o di altre sedi!
    if (siteMachines.length === 0) {
      return [];
    }

    const canisterMap = new Map<string, {
      key: string;
      canisterNumber: number;
      itemCode: string;
      productName: string;
      ingredientType: string;
      packageUnit: string;
      machineNames: string[];
    }>();

    siteMachines.forEach((m) => {
      // Recupera i prodotti dalla taratura della macchina della sede
      const canisters = m.calibration?.canisters;
      if (canisters && Array.isArray(canisters) && canisters.length > 0) {
        canisters.forEach((c) => {
          if (!c.name) return;
          // Recupera il Codice Articolo ufficiale (dalla taratura o da match anagrafica)
          const matchedArt = findArticleByNameOrType(c.name, c.ingredientType);
          const itemCode = c.itemCode || matchedArt?.itemCode || `ART-CAN-0${c.canisterNumber}`;
          const cleanName = c.name.replace(/^Contenitore\s+\d+:\s*/i, '').trim() || c.name;
          const packageUnit = c.packageUnit || matchedArt?.packageUnit || 'Busta 1 Kg';
          const mapKey = `${itemCode}-${cleanName.toLowerCase()}`;
          const machineLabel = `${m.name} (#${m.serialNumber})`;

          if (!canisterMap.has(mapKey)) {
            canisterMap.set(mapKey, {
              key: mapKey,
              canisterNumber: c.canisterNumber || 1,
              itemCode,
              productName: cleanName,
              ingredientType: c.ingredientType || 'solubles',
              packageUnit,
              machineNames: [machineLabel],
            });
          } else {
            const item = canisterMap.get(mapKey)!;
            if (!item.machineNames.includes(machineLabel)) {
              item.machineNames.push(machineLabel);
            }
          }
        });
      }
    });

    return Array.from(canisterMap.values()).sort((a, b) => a.canisterNumber - b.canisterNumber);
  }, [customerMachines, orderSiteId, customer.sites]);

  // Filtered machines based on selected site and search
  const filteredMachines = useMemo(() => {
    return customerMachines.filter((m) => {
      const matchSite = selectedSiteId === 'all' || m.customerSiteId === selectedSiteId;
      const q = searchMachineQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.serialNumber.toLowerCase().includes(q) ||
        (m.location || '').toLowerCase().includes(q);
      return matchSite && matchSearch;
    });
  }, [customerMachines, selectedSiteId, searchMachineQuery]);

  // Machine online/offline stats
  const machineStats = useMemo(() => {
    const total = customerMachines.length;
    const online = customerMachines.filter((m) => m.status === 'ONLINE' || m.status === 'DISPENSING').length;
    const offline = customerMachines.filter((m) => m.status === 'OFFLINE').length;
    const maintenance = customerMachines.filter((m) => m.status === 'MAINTENANCE').length;
    return { total, online, offline, maintenance };
  }, [customerMachines]);

  // Logs for this customer's machines
  const customerMachineIds = useMemo(() => {
    return new Set(customerMachines.map((m) => m.id));
  }, [customerMachines]);

  const customerSerialNumbers = useMemo(() => {
    return new Set(customerMachines.map((m) => m.serialNumber));
  }, [customerMachines]);

  const filteredLogs = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    return keyLogs.filter((log) => {
      const belongs =
        customerMachineIds.has(log.deviceId) ||
        (log.machineSerialNumber && customerSerialNumbers.has(log.machineSerialNumber)) ||
        (log.customerName && log.customerName.toLowerCase() === customer.name.toLowerCase());
      if (!belongs) return false;

      if (selectedSiteId !== 'all') {
        const machine = customerMachines.find(
          (m) => m.id === log.deviceId || m.serialNumber === log.machineSerialNumber
        );
        if (machine && machine.customerSiteId !== selectedSiteId) return false;
      }

      if (dateRange !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        if (isNaN(logTime)) return true;
        if (dateRange === 'today' && now - logTime > oneDay) return false;
        if (dateRange === '7days' && now - logTime > 7 * oneDay) return false;
        if (dateRange === '30days' && now - logTime > 30 * oneDay) return false;
      }

      return true;
    });
  }, [keyLogs, customerMachineIds, customerSerialNumbers, customer.name, selectedSiteId, customerMachines, dateRange]);

  // Consumption by beverage
  const beverageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;

    filteredLogs.forEach((log) => {
      const name = log.productName || log.keyLabel || log.key || 'Erogazione';
      counts[name] = (counts[name] || 0) + 1;
      total += 1;
    });

    const sorted = Object.entries(counts)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { items: sorted, total };
  }, [filteredLogs]);

  // Today count
  const todayDispensesCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return filteredLogs.filter((log) => log.timestamp?.startsWith(todayStr)).length;
  }, [filteredLogs]);

  // Open Order Modal
  const handleOpenOrderModal = () => {
    // Select first site or currently selected filter site
    const initialSite = selectedSiteId !== 'all' ? selectedSiteId : (customer.sites?.[0]?.id || '');
    setOrderSiteId(initialSite);
    setOrderQuantities({});
    setOrderRequestedDate('');
    setOrderRequesterName(customer.contactPerson || '');
    setOrderRequesterPhone(customer.phone || '');
    setOrderNotes('');
    setOrderRecipientEmail(smtpStatus?.defaultRecipient || 'claudiograf@iobevo.com');
    setOrderSubmitError(null);
    setOrderSubmitSuccess(null);
    setIsOrderModalOpen(true);
  };

  // Adjust product quantity
  const handleSetQuantity = (key: string, delta: number) => {
    setOrderQuantities((prev) => {
      const current = prev[key] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [key]: next };
    });
  };

  const handleSetExactQuantity = (key: string, val: number) => {
    setOrderQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  // Total quantity in current order
  const totalOrderItemsCount = useMemo(() => {
    return Object.values(orderQuantities).reduce((acc, q) => acc + q, 0);
  }, [orderQuantities]);

  // Submit Product Order
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderSiteId) {
      setOrderSubmitError('Seleziona la sede di destinazione per la consegna');
      return;
    }

    if (totalOrderItemsCount <= 0) {
      setOrderSubmitError('Inserisci la quantità per almeno un prodotto da ordinare');
      return;
    }

    setIsSubmittingOrder(true);
    setOrderSubmitError(null);

    try {
      const selectedSite = customer.sites?.find((s) => s.id === orderSiteId);

      // Build items payload with itemCode recovered from calibration
      const itemsPayload: ProductOrderItem[] = availableCanisters
        .filter((c) => (orderQuantities[c.key] || 0) > 0)
        .map((c) => ({
          canisterNumber: c.canisterNumber,
          itemCode: c.itemCode,
          productName: c.productName,
          ingredientType: c.ingredientType,
          quantity: orderQuantities[c.key] || 0,
          unit: orderUnit,
          notes: c.machineNames.length > 0 ? `Per macchine: ${c.machineNames.join(', ')}` : undefined,
        }));

      const payload = {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.code,
        siteId: orderSiteId,
        siteName: selectedSite ? selectedSite.name : 'Sede Principale',
        siteAddress: selectedSite ? `${selectedSite.address}, ${selectedSite.city} (${selectedSite.province})` : customer.address,
        requesterName: orderRequesterName.trim() || undefined,
        requesterPhone: orderRequesterPhone.trim() || undefined,
        requestedDeliveryDate: orderRequestedDate || undefined,
        notes: orderNotes.trim() || undefined,
        items: itemsPayload,
        recipientEmail: orderRecipientEmail.trim() || 'claudiograf@iobevo.com',
      };

      const res = await fetch('/api/orders', {
        method: 'PUT' in window ? 'POST' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.order) {
        setOrderSubmitSuccess(data.order);
        setOrders((prev) => [data.order, ...prev]);
      } else {
        setOrderSubmitError(data.error || "Errore durante l'invio dell'ordine");
      }
    } catch (err: any) {
      setOrderSubmitError(err.message || 'Errore di connessione con il server');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Open Technical Support Modal
  const handleOpenSupportModal = (presetSiteId?: string, presetSerial?: string) => {
    const initialSite = presetSiteId || (selectedSiteId !== 'all' ? selectedSiteId : (customer.sites?.[0]?.id || ''));
    setSupportSiteId(initialSite);

    const selectedSite = customer.sites?.find((s) => s.id === initialSite);
    const machinesInSite = customerMachines.filter((m) => {
      if (m.customerSiteId && m.customerSiteId === initialSite) return true;
      if (
        selectedSite &&
        m.locationDetails?.site &&
        m.locationDetails.site.trim().toLowerCase() === selectedSite.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (presetSerial) {
      setSupportSerialNumber(presetSerial);
    } else if (machinesInSite.length > 0) {
      setSupportSerialNumber(machinesInSite[0].serialNumber);
    } else if (customerMachines.length > 0) {
      setSupportSerialNumber(customerMachines[0].serialNumber);
    } else {
      setSupportSerialNumber('');
    }

    setSupportMacroArea('guasto_elettrico');
    setSupportSpecificIssue('Errore riscaldamento');
    setSupportIssueDescription('');
    setSupportPriority('ALTA');
    setSupportRequesterName(customer.contactPerson || '');
    setSupportRequesterPhone(customer.phone || '');
    setSupportRecipientEmail(smtpStatus?.defaultRecipient || 'claudiograf@iobevo.com');
    setSupportSubmitError(null);
    setSupportSubmitSuccess(null);
    setIsSupportModalOpen(true);
  };

  const handleSupportSiteChange = (newSiteId: string) => {
    setSupportSiteId(newSiteId);
    const selectedSite = customer.sites?.find((s) => s.id === newSiteId);
    const machinesInSite = customerMachines.filter((m) => {
      if (m.customerSiteId && m.customerSiteId === newSiteId) return true;
      if (
        selectedSite &&
        m.locationDetails?.site &&
        m.locationDetails.site.trim().toLowerCase() === selectedSite.name.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    });

    if (machinesInSite.length > 0) {
      setSupportSerialNumber(machinesInSite[0].serialNumber);
    } else if (customerMachines.length > 0) {
      setSupportSerialNumber(customerMachines[0].serialNumber);
    } else {
      setSupportSerialNumber('');
    }
  };

  const handleSupportMacroAreaChange = (macro: FaultMacroArea) => {
    setSupportMacroArea(macro);
    const cat = SUPPORT_FAULT_CATEGORIES.find((c) => c.id === macro);
    if (cat && cat.issues.length > 0) {
      setSupportSpecificIssue(cat.issues[0].label);
    }
  };

  // Submit Technical Support Ticket
  const handleSubmitSupportTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportSiteId) {
      setSupportSubmitError('Seleziona la sede in cui è installato il distributore');
      return;
    }
    if (!supportSerialNumber) {
      setSupportSubmitError('Seleziona o indica la matricola del distributore guasto');
      return;
    }
    if (!supportMacroArea || !supportSpecificIssue) {
      setSupportSubmitError('Seleziona la macro area e il tipo di guasto riscontrato');
      return;
    }

    setIsSubmittingSupport(true);
    setSupportSubmitError(null);

    try {
      const selectedSite = customer.sites?.find((s) => s.id === supportSiteId);
      const selectedMachine = customerMachines.find((m) => m.serialNumber === supportSerialNumber);
      const currentMacroCat = SUPPORT_FAULT_CATEGORIES.find((c) => c.id === supportMacroArea);

      const payload = {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.code,
        siteId: supportSiteId,
        siteName: selectedSite ? selectedSite.name : 'Sede Principale',
        siteAddress: selectedSite ? `${selectedSite.address}, ${selectedSite.city} (${selectedSite.province})` : customer.address,
        machineId: selectedMachine?.id,
        serialNumber: supportSerialNumber,
        machineName: selectedMachine?.name,
        machineModel: selectedMachine?.model,
        macroArea: supportMacroArea,
        macroAreaLabel: currentMacroCat?.label || supportMacroArea,
        specificIssue: supportSpecificIssue,
        issueDescription: supportIssueDescription.trim() || undefined,
        priority: supportPriority,
        requesterName: supportRequesterName.trim() || undefined,
        requesterPhone: supportRequesterPhone.trim() || undefined,
        recipientEmail: supportRecipientEmail.trim() || 'claudiograf@iobevo.com',
      };

      const res = await fetch('/api/support-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.ticket) {
        setSupportSubmitSuccess(data.ticket);
        setSupportTickets((prev) => [data.ticket, ...prev]);
      } else {
        setSupportSubmitError(data.error || "Errore durante l'invio della richiesta di assistenza");
      }
    } catch (err: any) {
      setSupportSubmitError(err.message || 'Errore di connessione con il server');
    } finally {
      setIsSubmittingSupport(false);
    }
  };

  // Handle Logo file select & convert to data URL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoSaveError('Seleziona un file immagine valido (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoSaveError("L'immagine è troppo grande (massimo 2 MB consigliati)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomLogoInput(result);
      setLogoSaveError(null);
    };
    reader.onerror = () => {
      setLogoSaveError('Errore durante la lettura del file');
    };
    reader.readAsDataURL(file);
  };

  // Save Logo to Server
  const handleSaveLogo = async () => {
    setIsSavingLogo(true);
    setLogoSaveError(null);
    setLogoSaveSuccess(false);

    try {
      const payload = { logoUrl: customLogoInput.trim() || undefined };
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setLogoSaveSuccess(true);
        if (onUpdateCustomerLogo) {
          await onUpdateCustomerLogo(customer.id, customLogoInput.trim() || undefined);
        }
        if (onRefresh) onRefresh();
        setTimeout(() => {
          setIsLogoModalOpen(false);
          setLogoSaveSuccess(false);
        }, 1200);
      } else {
        setLogoSaveError(data.error || 'Errore durante il salvataggio del logo');
      }
    } catch (err: any) {
      setLogoSaveError(err.message || 'Errore di connessione al server');
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Remove Logo
  const handleRemoveLogo = async () => {
    setIsSavingLogo(true);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl: '' }),
      });
      const data = await res.json();
      if (data.success) {
        setCustomLogoInput('');
        if (onUpdateCustomerLogo) {
          await onUpdateCustomerLogo(customer.id, undefined);
        }
        if (onRefresh) onRefresh();
        setIsLogoModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Export CSV of customer activity
  const handleExportReport = () => {
    const headers = [
      'Timestamp',
      'Codice Cliente',
      'Cliente',
      'Sede Operativa',
      'Matricola Distributore',
      'Nome Distributore',
      'Bevanda Erogata',
      'Codice Tasto',
      'Tipo Dose',
    ];

    const rows = filteredLogs.map((log) => {
      const machine = customerMachines.find(
        (m) => m.id === log.deviceId || m.serialNumber === log.machineSerialNumber
      );
      const site = customer.sites?.find((s) => s.id === machine?.customerSiteId);

      return [
        log.timestamp || '',
        customer.code,
        customer.name,
        site?.name || log.siteName || 'Sede Principale',
        log.machineSerialNumber || machine?.serialNumber || '',
        log.machineName || machine?.name || '',
        log.productName || log.keyLabel || 'Erogazione',
        log.key || '',
        log.isCaraffa ? 'CARAFFA' : 'STANDARD',
      ];
    });

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `report_consumi_${customer.code}_${customer.name.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.csv`;
    downloadCsvFile(fileName, headers, rows);
  };

  const selectedSite = customer.sites?.find((s) => s.id === selectedSiteId);

  // Helper to render canister ingredient badge icon
  const getIngredientIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'coffee':
        return <Coffee className="w-4 h-4 text-amber-500" />;
      case 'milk':
        return <Droplets className="w-4 h-4 text-sky-400" />;
      case 'chocolate':
        return <Flame className="w-4 h-4 text-orange-500" />;
      case 'tea':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      case 'sugar':
        return <Sparkles className="w-4 h-4 text-slate-300" />;
      default:
        return <Package className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Torna all'Elenco Clienti</span>
            </button>
          )}
          <div className="bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs hidden sm:flex items-center">
            <PortalBrandLogo size="xs" className="h-6 w-auto" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
              }`}
              title="Aggiorna Dati"
            >
              <RefreshCw className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Aggiorna</span>
            </button>
          )}

          {/* Nuova Funzione: Ordina Prodotti */}
          <button
            onClick={handleOpenOrderModal}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isLight
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-emerald-200'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/40'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Ordina Rifornimento Prodotti</span>
          </button>

          {/* Nuova Funzione: Richiesta Assistenza Tecnica */}
          <button
            onClick={() => handleOpenSupportModal()}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isLight
                ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white shadow-rose-200'
                : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-950/40'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>Richiedi Assistenza Tecnica</span>
          </button>

          <button
            onClick={handleExportReport}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
            }`}
          >
            <Download className="w-4 h-4" />
            <span className="hidden md:inline">Report Consumi</span>
          </button>
        </div>
      </div>

      {/* Hero Customer Card with Logo */}
      <div
        className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 transition-all shadow-lg ${
          isLight
            ? 'bg-gradient-to-br from-white via-slate-50 to-emerald-50/40 border-slate-200'
            : 'bg-gradient-to-br from-slate-900 via-slate-850 to-emerald-950/20 border-white/10'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Logo & Company Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo Frame */}
            <div className="relative group shrink-0">
              <div
                className={`w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-all shadow-md ${
                  isLight
                    ? 'bg-white border-slate-300 group-hover:border-emerald-400'
                    : 'bg-slate-800/80 border-white/20 group-hover:border-emerald-500/50'
                }`}
              >
                {customer.logoUrl ? (
                  <img
                    src={customer.logoUrl}
                    alt={customer.name}
                    className="w-full h-full object-contain p-2"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <Building2 className="w-10 h-10 text-emerald-400 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Nessun Logo
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Change Logo Button */}
              <button
                onClick={() => {
                  setCustomLogoInput(customer.logoUrl || '');
                  setIsLogoModalOpen(true);
                }}
                className="absolute -bottom-2 -right-2 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-transform hover:scale-105 cursor-pointer"
                title="Carica o Modifica Logo Aziendale"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-emerald-600 text-white shadow-sm">
                  {customer.code}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  Portale Riservato Cliente
                </span>
                {customer.vatNumber && (
                  <span className={`text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    P.IVA: <strong>{customer.vatNumber}</strong>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {customer.name}
              </h1>

              <div className={`flex flex-wrap items-center gap-y-1 gap-x-4 text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {customer.address}, {customer.city} ({customer.province})
                  </span>
                )}
                {customer.contactPerson && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    Ref: <strong>{customer.contactPerson}</strong>
                  </span>
                )}
                {customer.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-emerald-400" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sedi & Distributori Badges */}
          <div className="flex flex-row md:flex-col gap-2 shrink-0">
            <div
              className={`p-3 rounded-2xl border text-center ${
                isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-800/60 border-white/10'
              }`}
            >
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {customer.sites?.length || 0}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Sedi Operative
              </div>
            </div>

            <div
              className={`p-3 rounded-2xl border text-center ${
                isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-800/60 border-white/10'
              }`}
            >
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {customerMachines.length}
              </div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Distributori Attivi
              </div>
            </div>
          </div>
        </div>

        {/* Notes if any */}
        {customer.notes && (
          <div
            className={`mt-5 p-3 rounded-2xl border text-xs ${
              isLight ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
            }`}
          >
            <strong>Note Gestione Contratto:</strong> {customer.notes}
          </div>
        )}
      </div>

      {/* Sub Tabs: Panoramica vs Storico Ordini */}
      <div className="flex items-center border-b border-slate-200 dark:border-white/10 gap-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Panoramica Consumi &amp; Flotta</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'orders'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Ordini &amp; Rifornimenti Sedi</span>
          {orders.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-600 text-white font-mono">
              {orders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'support'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Assistenza Tecnica</span>
          {supportTickets.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-600 text-white font-mono">
              {supportTickets.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Filter Row: Sede selector & Time range */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Site pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Sede:
              </span>
              <button
                onClick={() => setSelectedSiteId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedSiteId === 'all'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isLight
                    ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                Tutte le Sedi ({customerMachines.length})
              </button>

              {(customer.sites || []).map((site) => {
                const siteMachineCount = customerMachines.filter((m) => m.customerSiteId === site.id).length;
                const isSelected = selectedSiteId === site.id;
                return (
                  <button
                    key={site.id}
                    onClick={() => setSelectedSiteId(site.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : isLight
                        ? 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <span>{site.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-300'}`}>
                      {siteMachineCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-1.5 self-end md:self-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Periodo:
              </span>
              {(
                [
                  { id: 'today', label: 'Oggi' },
                  { id: '7days', label: '7 Giorni' },
                  { id: '30days', label: '30 Giorni' },
                  { id: 'all', label: 'Tutto' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setDateRange(item.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    dateRange === item.id
                      ? 'bg-emerald-600 text-white'
                      : isLight
                      ? 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Distributori Attivi */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Distributori Online
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Activity className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {machineStats.online}
                </span>
                <span className="text-sm text-slate-400">/ {machineStats.total} totali</span>
              </div>
              <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                {machineStats.offline > 0 ? (
                  <span className="text-rose-500 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {machineStats.offline} macchina offline
                  </span>
                ) : (
                  <span className="text-emerald-500 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% parco macchine operativo
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Erogazioni nel Periodo */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Erogazioni Periodo
                </span>
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Coffee className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {beverageBreakdown.total.toLocaleString()}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Oggi erogate: <strong className="text-emerald-500">{todayDispensesCount}</strong> porzioni
              </div>
            </div>

            {/* Card 3: Bevanda Più Richiesta */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Top Bevanda
                </span>
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Sparkles className="w-4 h-4" />
                </span>
              </div>
              <div className="text-xl font-bold truncate">
                {beverageBreakdown.items[0]?.name || 'Nessun dato'}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {beverageBreakdown.items[0]
                  ? `${beverageBreakdown.items[0].count} tazze (${beverageBreakdown.items[0].percentage}% del totale)`
                  : 'In attesa di erogazioni'}
              </div>
            </div>

            {/* Card 4: Sedi Operative */}
            <div
              className={`p-5 rounded-2xl border transition-all ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Copertura Sedi
                </span>
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                  <Building2 className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {customer.sites?.length || 0}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                {selectedSite ? `Filtro: ${selectedSite.name}` : 'Tutte le strutture coperte'}
              </div>
            </div>
          </div>

          {/* Main Grid: Machine Fleet & Consumption Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (2 cols): Machine Fleet */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-500" />
                  <span>Distributori del Cliente ({filteredMachines.length})</span>
                </h2>

                {/* Quick search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cerca matricola o locale..."
                    value={searchMachineQuery}
                    onChange={(e) => setSearchMachineQuery(e.target.value)}
                    className={`w-full sm:w-60 pl-8 pr-3 py-1.5 rounded-xl text-xs border transition-all ${
                      isLight
                        ? 'bg-white border-slate-300 focus:border-emerald-500'
                        : 'bg-slate-800/60 border-white/10 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {filteredMachines.length === 0 ? (
                <div
                  className={`p-8 rounded-3xl border text-center ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-white/10'
                  }`}
                >
                  <Coffee className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                  <p className="text-sm font-semibold">Nessun distributore trovato</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedSiteId !== 'all'
                      ? 'Nessun distributore è attualmente assegnato a questa specifica sede.'
                      : 'Nessun distributore è ancora associato a questo cliente.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMachines.map((m) => {
                    const isOnline = m.status === 'ONLINE' || m.status === 'DISPENSING';
                    const site = customer.sites?.find((s) => s.id === m.customerSiteId);

                    return (
                      <div
                        key={m.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between hover:shadow-md ${
                          isLight
                            ? 'bg-white border-slate-200 hover:border-emerald-300'
                            : 'bg-slate-800/40 border-white/10 hover:border-emerald-500/30'
                        }`}
                      >
                        <div>
                          {/* Top status bar */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                                }`}
                              />
                              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                #{m.serialNumber}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                isOnline
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                              }`}
                            >
                              {m.status}
                            </span>
                          </div>

                          {/* Machine Name & Model */}
                          <h3 className="font-bold text-base line-clamp-1">{m.name}</h3>
                          <div className="text-xs text-slate-400 mt-0.5 font-medium">
                            Modello: <strong className="text-slate-600 dark:text-slate-200">{m.model}</strong>
                          </div>

                          {/* Location & Site */}
                          <div className={`mt-3 p-2.5 rounded-xl text-xs space-y-1 ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{site ? site.name : 'Sede Principale'}</span>
                            </div>
                            {m.location && (
                              <div className="text-[11px] text-slate-400 truncate pl-4.5">
                                {m.location}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                            <Wifi className="w-3.5 h-3.5 text-slate-400" />
                            <span>{m.ipAddress || 'IP Connesso'}</span>
                          </div>

                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => handleOpenSupportModal(m.customerSiteId, m.serialNumber)}
                              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-all"
                              title="Richiedi Assistenza Tecnica per questo distributore"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Assistenza</span>
                            </button>

                            {onSelectMachine && (
                              <button
                                onClick={() => onSelectMachine(m.id)}
                                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>Telemetria</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column (1 col): Beverage Consumption Analysis */}
            <div className="space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-500" />
                <span>Consumi per Bevanda</span>
              </h2>

              <div
                className={`p-5 rounded-3xl border space-y-4 ${
                  isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-100 dark:border-white/5">
                  <span>Classifica Prodotti</span>
                  <span>Porzioni ({beverageBreakdown.total})</span>
                </div>

                {beverageBreakdown.items.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Nessuna erogazione registrata per questo cliente nel periodo selezionato.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {beverageBreakdown.items.slice(0, 8).map((item, idx) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <div className="flex items-center gap-2 truncate">
                            <span className="w-4 text-slate-400 font-mono text-[11px]">#{idx + 1}</span>
                            <span className="truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span>{item.count}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.percentage}%)</span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{ width: `${Math.max(item.percentage, 4)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Customer Assistance & Order Call-To-Action */}
              <div
                className={`p-5 rounded-3xl border text-xs space-y-3 ${
                  isLight ? 'bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/20 border-emerald-800/30 text-emerald-200'
                }`}
              >
                <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                  <ShoppingCart className="w-4 h-4" /> Rifornimento Prodotti Solubili
                </div>
                <p className="text-[11px] leading-relaxed">
                  Le scorte nei contenitori sono in esaurimento? Puoi ordinare direttamente i prodotti associati alle tue macchine (caffè, latte, cioccolato, tè, ecc.).
                </p>
                <button
                  onClick={handleOpenOrderModal}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Ordina Ora per le tue Sedi</span>
                </button>
              </div>
            </div>
          </div>

          {/* Recent Key Logs Table */}
          <div className="space-y-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" />
              <span>Ultime Erogazioni Registrate ({filteredLogs.length})</span>
            </h2>

            <div
              className={`rounded-2xl border overflow-hidden ${
                isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nessun evento telemetrico recente registrato per le macchine di questo cliente.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className={`border-b ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                        <th className="py-2.5 px-4 font-semibold">Orario / Data</th>
                        <th className="py-2.5 px-4 font-semibold">Distributore</th>
                        <th className="py-2.5 px-4 font-semibold">Sede</th>
                        <th className="py-2.5 px-4 font-semibold">Bevanda Selezionata</th>
                        <th className="py-2.5 px-4 font-semibold">Tasto Matrice</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Dose</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredLogs.slice(0, 10).map((log) => {
                        const machine = customerMachines.find(
                          (m) => m.id === log.deviceId || m.serialNumber === log.machineSerialNumber
                        );
                        const site = customer.sites?.find((s) => s.id === machine?.customerSiteId);

                        return (
                          <tr key={log.id} className="hover:bg-emerald-50/40 dark:hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-4 font-mono text-slate-500">
                              {log.timestamp ? new Date(log.timestamp).toLocaleString('it-IT') : '-'}
                            </td>
                            <td className="py-2.5 px-4 font-semibold">
                              #{log.machineSerialNumber || machine?.serialNumber || 'N/D'}
                            </td>
                            <td className="py-2.5 px-4 text-slate-500 truncate max-w-[150px]">
                              {site ? site.name : log.siteName || 'Sede Principale'}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-emerald-600 dark:text-emerald-400">
                              {log.productName || log.keyLabel || 'Erogazione'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-slate-400">
                              {log.key}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  log.isCaraffa
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
                                }`}
                              >
                                {log.isCaraffa ? 'CARAFFA' : 'STANDARD'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      ) : activeTab === 'orders' ? (
        /* TAB 2: STORICO ORDINI DEL CLIENTE */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-500" />
                <span>Storico Ordini Rifornimento Prodotti ({orders.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Ordini di materie prime inviati alle sedi con notifica via email e gestione dello stato di consegna.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenOrderModal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Nuovo Ordine Prodotti</span>
              </button>
            </div>
          </div>

          {/* Resend Notification Banner */}
          {resendNotification && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                resendNotification.success
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                  : isLight
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {resendNotification.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span>{resendNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setResendNotification(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {/* SMTP Not Configured Warning Banner */}
          {smtpStatus && !smtpStatus.configured && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLight ? 'bg-amber-50 border-amber-300/80 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Server SMTP non configurato</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Le notifiche email reali non possono essere recapitate finché non configuri le credenziali di posta in <strong>Gestione Database &rarr; Server SMTP</strong>. Puoi comunque usare il pulsante <em>&quot;Apri in Mailto&quot;</em> su ogni ordine per spedirlo tramite il tuo programma di posta predefinito.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoadingOrders ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-2" />
              Caricamento ordini in corso...
            </div>
          ) : orders.length === 0 ? (
            <div
              className={`p-10 rounded-3xl border text-center ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <ShoppingCart className="w-12 h-12 mx-auto text-slate-400 mb-2 opacity-50" />
              <h3 className="text-base font-bold">Nessun ordine registrato</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Non hai ancora effettuato ordini di prodotti per le tue sedi. Clicca su &quot;Nuovo Ordine Prodotti&quot; per richiedere un rifornimento.
              </p>
              <button
                onClick={handleOpenOrderModal}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Effettua il Primo Ordine</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((ord) => (
                <div
                  key={ord.id}
                  className={`p-5 rounded-2xl border space-y-3.5 transition-all shadow-sm ${
                    isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {ord.id}
                      </span>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Registrato il: {new Date(ord.createdAt).toLocaleString('it-IT')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border ${
                          ord.emailSent
                            ? isLight
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isLight
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {ord.emailSent ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Email Inviata</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Email Non Inviata</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Delivery summary */}
                  <div className={`p-2.5 rounded-xl text-xs space-y-1 ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                    <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Destinazione: <strong>{ord.siteName}</strong></span>
                    </div>
                    {ord.siteAddress && (
                      <div className="text-[11px] text-slate-400 pl-4.5">
                        {ord.siteAddress}
                      </div>
                    )}
                    {ord.requestedDeliveryDate && (
                      <div className="text-[11px] text-slate-400 pl-4.5">
                        Data richiesta: <strong>{ord.requestedDeliveryDate}</strong>
                      </div>
                    )}
                    {ord.requesterName && (
                      <div className="text-[11px] text-slate-400 pl-4.5">
                        Referente: <strong>{ord.requesterName}</strong> {ord.requesterPhone ? `(${ord.requesterPhone})` : ''}
                      </div>
                    )}
                  </div>

                  {/* Error banner if email not sent */}
                  {!ord.emailSent && (
                    <div
                      className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                        isLight
                          ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                          : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Notifica non recapitata via SMTP</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        {ord.emailError || 'Server SMTP non configurato. Configura i parametri SMTP in Gestione Database -> Server SMTP per recapitare le email in automatico.'}
                      </p>
                    </div>
                  )}

                  {/* Items List */}
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-white/5 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Prodotti Richiesti ({ord.items.length}):
                    </span>
                    <div className="space-y-1">
                      {ord.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">
                            • {it.productName}
                          </span>
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {it.quantity} {it.unit || 'Kg'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recipient info & Actions */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                    <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>Destinatario: <strong className="font-mono text-slate-700 dark:text-slate-300">{ord.recipientEmail}</strong></span>
                      </div>
                      {ord.lastEmailAttemptAt && (
                        <span className="text-[10px] text-slate-400">
                          Tentativo: {new Date(ord.lastEmailAttemptAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      <button
                        type="button"
                        disabled={resendingOrderId === ord.id}
                        onClick={() => handleResendOrderEmail(ord.id, ord.recipientEmail)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          ord.emailSent
                            ? isLight
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-white/10 hover:bg-white/15 text-slate-200'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        }`}
                      >
                        <RefreshCw className={`w-3 h-3 ${resendingOrderId === ord.id ? 'animate-spin' : ''}`} />
                        <span>{resendingOrderId === ord.id ? 'Invio in corso...' : ord.emailSent ? 'Reinvia Notifica' : 'Reinvia Email Ora'}</span>
                      </button>

                      {/* Mailto Fallback Button */}
                      <a
                        href={`mailto:${ord.recipientEmail}?subject=${encodeURIComponent(`[ORDINE PRODOTTI] - ${ord.customerName} - ${ord.siteName} (${ord.id})`)}&body=${encodeURIComponent(
                          `RIEPILOGO ORDINE RIFORNIMENTO PRODOTTI\nCodice Ordine: ${ord.id}\nCliente: ${ord.customerName}\nSede: ${ord.siteName}\nIndirizzo: ${ord.siteAddress || 'N/D'}\nData richiesta: ${ord.requestedDeliveryDate || 'N/D'}\nReferente: ${ord.requesterName || ''} ${ord.requesterPhone || ''}\nNote: ${ord.notes || '-'}\n\nPRODOTTI:\n` +
                          ord.items.map((it) => `- ${it.productName} (${it.ingredientType || 'ingrediente'}): ${it.quantity} ${it.unit || 'Kg'}`).join('\n') +
                          `\n\nInviato dal Portale Distributori IoT General Beverage`
                        )}`}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                          isLight
                            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                        }`}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Apri in Mailto</span>
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TAB 3: ASSISTENZA TECNICA E SEGNALAZIONE GUASTI */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-rose-500" />
                <span>Richieste di Assistenza Tecnica ({supportTickets.length})</span>
              </h2>
              <p className="text-xs text-slate-400">
                Segnalazione anomalie e guasti (elettrico, idraulico, miscelazione, tastiere) con notifica email immediata al servizio tecnico.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenSupportModal()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Nuova Richiesta Assistenza</span>
              </button>
            </div>
          </div>

          {/* Ticket Notification Banner */}
          {ticketNotification && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                ticketNotification.success
                  ? isLight
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                  : isLight
                  ? 'bg-rose-50 text-rose-900 border-rose-300'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {ticketNotification.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
                <span>{ticketNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setTicketNotification(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {/* SMTP Not Configured Warning Banner */}
          {smtpStatus && !smtpStatus.configured && (
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isLight ? 'bg-amber-50 border-amber-300/80 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Server SMTP non configurato</div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                    Le notifiche email dirette non possono essere inviate automaticamente dal server. Puoi usare il pulsante <em>&quot;Apri in Mailto&quot;</em> su ciascuna richiesta per inviare subito la diagnosi precompilata con il tuo programma di posta locale, oppure impostare la password SMTP in <strong>Gestione Database &rarr; Server SMTP</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isLoadingSupportTickets ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-rose-500 mb-2" />
              Caricamento richieste di assistenza in corso...
            </div>
          ) : supportTickets.length === 0 ? (
            <div
              className={`p-10 rounded-3xl border text-center ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-800/40 border-white/10'
              }`}
            >
              <LifeBuoy className="w-12 h-12 mx-auto text-slate-400 mb-2 opacity-50" />
              <h3 className="text-base font-bold">Nessuna richiesta di assistenza</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Tutti i distributori bevande del cliente risultano attualmente privi di segnalazioni di guasto aperte.
              </p>
              <button
                onClick={() => handleOpenSupportModal()}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white inline-flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Apri Nuova Richiesta Assistenza</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {supportTickets.map((t) => {
                const isResolved = t.status === 'RISOLTO' || t.status === 'CHIUSO';
                const macroColor =
                  t.macroArea === 'guasto_elettrico'
                    ? 'amber'
                    : t.macroArea === 'guasto_idraulico'
                    ? 'blue'
                    : 'purple';

                return (
                  <div
                    key={t.id}
                    className={`p-5 rounded-2xl border space-y-3.5 transition-all shadow-sm ${
                      isLight ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-800/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400">
                            {t.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isResolved
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : t.status === 'IN_GESTIONE'
                                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Segnalato: {new Date(t.createdAt).toLocaleString('it-IT')}
                        </div>
                      </div>

                      {/* Email Sent Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border shrink-0 ${
                          t.emailSent
                            ? isLight
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : isLight
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {t.emailSent ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Email Inviata</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Email Non Inviata</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Sede & Macchina */}
                    <div className={`p-3 rounded-xl text-xs space-y-1.5 ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                      <div className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Sede: <strong>{t.siteName}</strong></span>
                      </div>
                      {t.siteAddress && (
                        <div className="text-[11px] text-slate-400 pl-4.5">
                          {t.siteAddress}
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-white/5 flex-wrap">
                        <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Coffee className="w-3.5 h-3.5 text-slate-400" /> Matricola (SN):
                        </span>
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                          {t.serialNumber}
                        </span>
                        {t.machineName && (
                          <span className="text-[11px] text-slate-500">
                            ({t.machineName})
                          </span>
                        )}
                      </div>
                      {t.requesterName && (
                        <div className="text-[11px] text-slate-400 pt-0.5">
                          Referente sul posto: <strong>{t.requesterName}</strong> {t.requesterPhone ? `(Tel: ${t.requesterPhone})` : ''}
                        </div>
                      )}
                    </div>

                    {/* Guasto Diagnostics Box */}
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        macroColor === 'amber'
                          ? isLight ? 'bg-amber-50/70 border-amber-200' : 'bg-amber-950/20 border-amber-800/40'
                          : macroColor === 'blue'
                          ? isLight ? 'bg-blue-50/70 border-blue-200' : 'bg-blue-950/20 border-blue-800/40'
                          : isLight ? 'bg-purple-50/70 border-purple-200' : 'bg-purple-950/20 border-purple-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          {t.macroArea === 'guasto_elettrico' ? (
                            <Zap className="w-4 h-4 text-amber-500" />
                          ) : t.macroArea === 'guasto_idraulico' ? (
                            <Droplets className="w-4 h-4 text-blue-500" />
                          ) : (
                            <AlertOctagon className="w-4 h-4 text-purple-500" />
                          )}
                          <span className="font-bold uppercase tracking-wider text-[11px]">
                            {t.macroAreaLabel || t.macroArea}
                          </span>
                        </div>
                        {t.priority && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            t.priority === 'CRITICA'
                              ? 'bg-red-600 text-white'
                              : t.priority === 'ALTA'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}>
                            Priorità: {t.priority}
                          </span>
                        )}
                      </div>

                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <span>• {t.specificIssue}</span>
                      </div>

                      {t.issueDescription && (
                        <div className={`p-2 rounded-lg text-[11px] leading-relaxed border ${
                          isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900/60 border-white/10 text-slate-300'
                        }`}>
                          <strong>Note / Descrizione:</strong> {t.issueDescription}
                        </div>
                      )}
                    </div>

                    {/* Email Error Banner if any */}
                    {!t.emailSent && (
                      <div
                        className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                          isLight
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Notifica non recapitata via SMTP</span>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {t.emailError || 'Server SMTP non configurato. Configura i parametri SMTP in Gestione Database -> Server SMTP o usa il pulsante Mailto sotto.'}
                        </p>
                      </div>
                    )}

                    {/* Recipient info & Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2.5">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Destinatario: <strong className="font-mono text-slate-700 dark:text-slate-300">{t.recipientEmail}</strong></span>
                        </div>
                        {t.lastEmailAttemptAt && (
                          <span className="text-[10px] text-slate-400">
                            Invio: {new Date(t.lastEmailAttemptAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                        <button
                          type="button"
                          disabled={resendingTicketId === t.id}
                          onClick={() => handleResendSupportEmail(t.id, t.recipientEmail)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            t.emailSent
                              ? isLight
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                : 'bg-white/10 hover:bg-white/15 text-slate-200'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                          }`}
                        >
                          <RefreshCw className={`w-3 h-3 ${resendingTicketId === t.id ? 'animate-spin' : ''}`} />
                          <span>{resendingTicketId === t.id ? 'Invio in corso...' : t.emailSent ? 'Reinvia Notifica' : 'Reinvia Email Ora'}</span>
                        </button>

                        {/* Mailto Fallback Button */}
                        <a
                          href={`mailto:${t.recipientEmail}?subject=${encodeURIComponent(`[ASSISTENZA TECNICA] - ${t.customerName} - ${t.siteName} - SN ${t.serialNumber} (${t.id})`)}&body=${encodeURIComponent(
                            `RICHIESTA ASSISTENZA TECNICA DISTRIBUTORE\nCodice Ticket: ${t.id}\nCliente: ${t.customerName} (${t.customerCode || 'N/D'})\nSede di Intervento: ${t.siteName}\nIndirizzo: ${t.siteAddress || 'N/D'}\nReferente sul posto: ${t.requesterName || ''} ${t.requesterPhone ? `(Tel: ${t.requesterPhone})` : ''}\n\nDATI DISTRIBUTORE:\nMatricola (SN): ${t.serialNumber}\nNome/Modello: ${t.machineName || ''} ${t.machineModel || ''}\n\nDIAGNOSI GUASTO:\nMacro Area: ${t.macroAreaLabel || t.macroArea}\nDifetto Riscontrato: ${t.specificIssue}\nDescrizione / Note: ${t.issueDescription || '-'}\nPriorità: ${t.priority || 'NORMALE'}\n\nInviato dal Portale Distributori IoT General Beverage`
                          )}`}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                            isLight
                              ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                              : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Apri in Mailto</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleToggleTicketStatus(t.id, t.status)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ml-auto cursor-pointer ${
                            isResolved
                              ? 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                              : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                          }`}
                        >
                          {isResolved ? 'Riapri Ticket' : 'Segna come Risolto'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ORDINA RIFORNIMENTO PRODOTTI */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className={`w-full max-w-2xl rounded-3xl border p-6 space-y-5 shadow-2xl my-6 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f172a] border-white/20 text-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Modulo Ordine Rifornimento Prodotti</h3>
                  <p className="text-xs text-slate-400">
                    Seleziona sede e quantitativi per i contenitori dei tuoi distributori
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {orderSubmitSuccess ? (
              /* Success Screen */
              <div className="py-6 text-center space-y-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                    orderSubmitSuccess.emailSent
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-amber-500/20 text-amber-500'
                  }`}
                >
                  {orderSubmitSuccess.emailSent ? (
                    <Check className="w-8 h-8 stroke-[3]" />
                  ) : (
                    <AlertTriangle className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h4
                    className={`text-xl font-extrabold ${
                      orderSubmitSuccess.emailSent
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {orderSubmitSuccess.emailSent
                      ? 'Ordine Inviato ed Email Notificata!'
                      : 'Ordine Registrato a Sistema'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 font-mono font-bold">
                    Codice Riferimento: {orderSubmitSuccess.id}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border text-xs text-left space-y-2 max-w-md mx-auto ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div><strong>Destinazione:</strong> {orderSubmitSuccess.siteName}</div>
                  <div><strong>Prodotti:</strong> {orderSubmitSuccess.items.length} articoli ordinati</div>

                  {orderSubmitSuccess.emailSent ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Email di notifica inviata con successo a: <strong>{orderSubmitSuccess.recipientEmail}</strong></span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Email non recapitata dal server</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {orderSubmitSuccess.emailError ||
                          'Server SMTP non configurato. Configura i parametri SMTP in Gestione Database -> Server SMTP per recapitare le email automatiche.'}
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        💡 Puoi recapitare subito questo ordine cliccando sul pulsante &quot;Apri Copia Mail (mailto)&quot; sotto per inviarlo dal tuo programma di posta predefinito.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                  <a
                    href={`mailto:${orderSubmitSuccess.recipientEmail}?subject=${encodeURIComponent(
                      `[ORDINE PRODOTTI] - ${customer.name} - ${orderSubmitSuccess.siteName} (${orderSubmitSuccess.id})`
                    )}&body=${encodeURIComponent(
                      `RIEPILOGO ORDINE RIFORNIMENTO PRODOTTI\nCodice Ordine: ${orderSubmitSuccess.id}\nCliente: ${customer.name}\nSede: ${orderSubmitSuccess.siteName}\nIndirizzo: ${orderSubmitSuccess.siteAddress || 'N/D'}\nData richiesta: ${orderSubmitSuccess.requestedDeliveryDate || 'N/D'}\nReferente: ${orderSubmitSuccess.requesterName || ''} ${orderSubmitSuccess.requesterPhone || ''}\nNote: ${orderSubmitSuccess.notes || '-'}\n\nPRODOTTI:\n` +
                      orderSubmitSuccess.items.map((it) => `- ${it.productName} (${it.ingredientType || 'ingrediente'}): ${it.quantity} ${it.unit || 'Kg'}`).join('\n') +
                      `\n\nInviato dal Portale Distributori IoT General Beverage`
                    )}`}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-all ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Apri Copia Mail (mailto)</span>
                  </a>

                  <button
                    onClick={() => {
                      setIsOrderModalOpen(false);
                      setOrderSubmitSuccess(null);
                      setActiveTab('orders');
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition-all"
                  >
                    Visualizza negli Ordini
                  </button>
                </div>
              </div>
            ) : (
              /* Order Form */
              <form onSubmit={handleSubmitOrder} className="space-y-4">
                {/* Step 1: Destination Site */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <MapPin className="w-4 h-4" /> 1. Sede Operativa di Destinazione *
                  </label>
                  <select
                    value={orderSiteId}
                    onChange={(e) => {
                      setOrderSiteId(e.target.value);
                      setOrderQuantities({});
                    }}
                    required
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-emerald-500'
                        : 'bg-slate-800 border-white/15 focus:border-emerald-500 text-white'
                    }`}
                  >
                    {(customer.sites || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.address}, {s.city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Step 2: Canister Products & Quantities */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Package className="w-4 h-4" /> 2. Prodotti dai Contenitori delle Macchine *
                    </label>

                    {/* Unit Toggle */}
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-400 mr-1">Unità:</span>
                      <button
                        type="button"
                        onClick={() => setOrderUnit('Kg')}
                        className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                          orderUnit === 'Kg'
                            ? 'bg-emerald-600 text-white'
                            : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        Kg
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderUnit('Confezioni')}
                        className={`px-2 py-0.5 rounded-lg font-bold cursor-pointer ${
                          orderUnit === 'Confezioni'
                            ? 'bg-emerald-600 text-white'
                            : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        Confezioni
                      </button>
                    </div>
                  </div>

                  {availableCanisters.length === 0 ? (
                    <div className={`p-6 rounded-2xl border text-center space-y-2 ${
                      isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800/40 text-amber-200'
                    }`}>
                      <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
                      <div className="text-xs font-bold">Nessun distributore presente nella sede selezionata</div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        In questa sede non sono presenti distributori con taratura contenitori attiva. I prodotti ordinabili sono strettamente vincolati alle ricette e ai contenitori delle macchine installate presso la sede.
                      </p>
                    </div>
                  ) : (
                    <div className={`rounded-2xl border divide-y overflow-hidden max-h-72 overflow-y-auto ${
                      isLight ? 'bg-slate-50 border-slate-200 divide-slate-200' : 'bg-slate-800/40 border-white/10 divide-white/5'
                    }`}>
                      {availableCanisters.map((c) => {
                        const qty = orderQuantities[c.key] || 0;
                        return (
                          <div key={c.key} className="p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 truncate">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                {getIngredientIcon(c.ingredientType)}
                              </div>
                              <div className="truncate">
                                <div className="text-xs font-bold truncate flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                                    {c.itemCode}
                                  </span>
                                  <span className="truncate">{c.productName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5 truncate">
                                  <span>Contenitore {c.canisterNumber}</span>
                                  {c.machineNames.length > 0 && <span>• {c.machineNames.join(', ')}</span>}
                                  {c.packageUnit && <span className="text-slate-500">• {c.packageUnit}</span>}
                                </div>
                              </div>
                            </div>

                            {/* Stepper controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(c.key, -1)}
                                disabled={qty <= 0}
                                className="w-7 h-7 rounded-lg border flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>

                              <input
                                type="number"
                                min="0"
                                max="999"
                                value={qty || ''}
                                placeholder="0"
                                onChange={(e) => handleSetExactQuantity(c.key, parseInt(e.target.value, 10) || 0)}
                                className={`w-12 h-7 text-center font-bold text-xs rounded-lg border ${
                                  qty > 0
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-white/10 text-slate-300'
                                }`}
                              />

                              <button
                                type="button"
                                onClick={() => handleSetQuantity(c.key, 1)}
                                className="w-7 h-7 rounded-lg border flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>

                              <span className="text-[11px] font-mono font-bold text-slate-400 ml-1 w-7">
                                {orderUnit}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 3: Date & Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Data Consegna Desiderata
                    </label>
                    <input
                      type="date"
                      value={orderRequestedDate}
                      onChange={(e) => setOrderRequestedDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Referente sul Posto
                    </label>
                    <input
                      type="text"
                      placeholder="Nome e Cognome referente"
                      value={orderRequesterName}
                      onChange={(e) => setOrderRequesterName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-slate-400">
                    Note Aggiuntive per la Consegna
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Es. Consegnare al mattino entro le 11:00 presso la reception..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                    }`}
                  />
                </div>

                {/* Email Recipient Input & Status */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Mail className="w-4 h-4 text-emerald-500" />
                      <span>Destinatario Notifica Ordine (Email) *</span>
                    </label>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        smtpStatus?.configured
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {smtpStatus?.configured ? 'SMTP Attivo' : 'SMTP Non Configurato'}
                    </span>
                  </div>
                  <input
                    type="email"
                    required
                    value={orderRecipientEmail}
                    onChange={(e) => setOrderRecipientEmail(e.target.value)}
                    placeholder="claudiograf@iobevo.com"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-emerald-500'
                        : 'bg-slate-800 border-white/15 text-white focus:border-emerald-500'
                    }`}
                  />
                  {!smtpStatus?.configured && (
                    <p className="text-[10.5px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Server SMTP non configurato: potrai inoltrare la notifica con il tuo client di posta locale (mailto) o configurare il server SMTP in Gestione Database.</span>
                    </p>
                  )}
                </div>

                {/* Error message */}
                {orderSubmitError && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{orderSubmitError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10">
                  <div className="text-xs">
                    Totale selezionato: <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">{totalOrderItemsCount}</strong> {orderUnit}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsOrderModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Annulla
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingOrder || totalOrderItemsCount <= 0}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingOrder ? 'Invio in corso...' : 'Invia Ordine'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: RICHIESTA ASSISTENZA TECNICA */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div
            className={`w-full max-w-2xl rounded-3xl border p-6 space-y-5 shadow-2xl my-6 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f172a] border-white/20 text-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-md">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Modulo Richiesta Assistenza Tecnica Distributore</h3>
                  <p className="text-xs text-slate-400">
                    Segnala il guasto per invio automatico notifica email ed intervento del tecnico
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSupportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {supportSubmitSuccess ? (
              /* Success Screen */
              <div className="py-6 text-center space-y-4">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                    supportSubmitSuccess.emailSent
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : 'bg-amber-500/20 text-amber-500'
                  }`}
                >
                  {supportSubmitSuccess.emailSent ? (
                    <Check className="w-8 h-8 stroke-[3]" />
                  ) : (
                    <AlertTriangle className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h4
                    className={`text-xl font-extrabold ${
                      supportSubmitSuccess.emailSent
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {supportSubmitSuccess.emailSent
                      ? 'Richiesta di Assistenza Inviata & Notificata!'
                      : 'Richiesta di Assistenza Registrata a Sistema'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 font-mono font-bold">
                    Codice Riferimento Ticket: {supportSubmitSuccess.id}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-2xl border text-xs text-left space-y-2 max-w-md mx-auto ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div><strong>Sede Intervento:</strong> {supportSubmitSuccess.siteName}</div>
                  <div><strong>Matricola (SN):</strong> <span className="font-mono font-bold bg-rose-100 dark:bg-rose-950 px-2 py-0.5 rounded text-rose-700 dark:text-rose-300">{supportSubmitSuccess.serialNumber}</span></div>
                  <div><strong>Macro Area:</strong> {supportSubmitSuccess.macroAreaLabel}</div>
                  <div><strong>Difetto Riscontrato:</strong> {supportSubmitSuccess.specificIssue}</div>

                  {supportSubmitSuccess.emailSent ? (
                    <div className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 pt-1">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Email inviata con successo via SMTP a: <strong>{supportSubmitSuccess.recipientEmail}</strong></span>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Email non recapitata dal server</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        {supportSubmitSuccess.emailError ||
                          'Server SMTP non configurato. Configura i parametri SMTP in Gestione Database -> Server SMTP per recapitare le email automatiche.'}
                      </p>
                      <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                        💡 Puoi inoltrare subito la segnalazione cliccando su &quot;Apri Copia Mail (mailto)&quot; sotto per aprirla nel tuo programma di posta predefinito.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                  <a
                    href={`mailto:${supportSubmitSuccess.recipientEmail}?subject=${encodeURIComponent(
                      `[ASSISTENZA TECNICA] - ${customer.name} - ${supportSubmitSuccess.siteName} - SN ${supportSubmitSuccess.serialNumber} (${supportSubmitSuccess.id})`
                    )}&body=${encodeURIComponent(
                      `RICHIESTA ASSISTENZA TECNICA DISTRIBUTORE\nCodice Ticket: ${supportSubmitSuccess.id}\nCliente: ${customer.name} (${customer.code || 'N/D'})\nSede di Intervento: ${supportSubmitSuccess.siteName}\nIndirizzo: ${supportSubmitSuccess.siteAddress || 'N/D'}\nReferente sul posto: ${supportSubmitSuccess.requesterName || ''} ${supportSubmitSuccess.requesterPhone ? `(Tel: ${supportSubmitSuccess.requesterPhone})` : ''}\n\nDATI DISTRIBUTORE:\nMatricola (SN): ${supportSubmitSuccess.serialNumber}\nNome/Modello: ${supportSubmitSuccess.machineName || ''} ${supportSubmitSuccess.machineModel || ''}\n\nDIAGNOSI GUASTO:\nMacro Area: ${supportSubmitSuccess.macroAreaLabel || supportSubmitSuccess.macroArea}\nDifetto Riscontrato: ${supportSubmitSuccess.specificIssue}\nDescrizione / Note: ${supportSubmitSuccess.issueDescription || '-'}\nPriorità: ${supportSubmitSuccess.priority || 'NORMALE'}\n\nInviato dal Portale Distributori IoT General Beverage`
                    )}`}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-all ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Apri Copia Mail (mailto)</span>
                  </a>

                  <button
                    onClick={() => {
                      setIsSupportModalOpen(false);
                      setSupportSubmitSuccess(null);
                      setActiveTab('support');
                    }}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md cursor-pointer transition-all"
                  >
                    Visualizza nei Ticket di Assistenza
                  </button>
                </div>
              </div>
            ) : (
              /* Support Request Form */
              <form onSubmit={handleSubmitSupportTicket} className="space-y-4">
                {/* 1. Sede Operativa di Intervento */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <MapPin className="w-4 h-4" /> 1. Sede Operativa di Intervento *
                  </label>
                  <select
                    value={supportSiteId}
                    onChange={(e) => handleSupportSiteChange(e.target.value)}
                    required
                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 focus:border-rose-500'
                        : 'bg-slate-800 border-white/15 focus:border-rose-500 text-white'
                    }`}
                  >
                    {(customer.sites || []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.address}, {s.city}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Matricola Distributore Coinvolto */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <Coffee className="w-4 h-4" /> 2. Matricola Distributore Coinvolto *
                  </label>

                  {supportSiteMachines.length > 0 ? (
                    <select
                      value={supportSerialNumber}
                      onChange={(e) => setSupportSerialNumber(e.target.value)}
                      required
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 focus:border-rose-500'
                          : 'bg-slate-800 border-white/15 focus:border-rose-500 text-white'
                      }`}
                    >
                      {supportSiteMachines.map((m) => (
                        <option key={m.id || m.serialNumber} value={m.serialNumber}>
                          Matricola #{m.serialNumber} — {m.name} ({m.model || 'Distributore'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      placeholder="Inserisci la matricola del distributore (es. 104829)"
                      value={supportSerialNumber}
                      onChange={(e) => setSupportSerialNumber(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                          : 'bg-slate-800 border-white/15 text-white focus:border-rose-500'
                      }`}
                    />
                  )}
                  <span className="text-[10.5px] text-slate-400 block">
                    Elenco filtrato sui distributori assegnati alla sede selezionata.
                  </span>
                </div>

                {/* 3 & 4: Macro Area & Difetto Riscontrato */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Macro Area */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <Zap className="w-4 h-4" /> 3. Macro Area Guasto *
                    </label>
                    <select
                      value={supportMacroArea}
                      onChange={(e) => handleSupportMacroAreaChange(e.target.value as FaultMacroArea)}
                      required
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 focus:border-rose-500'
                          : 'bg-slate-800 border-white/15 focus:border-rose-500 text-white'
                      }`}
                    >
                      <option value="guasto_elettrico">⚡ Guasto Elettrico</option>
                      <option value="guasto_idraulico">💧 Guasto Idraulico</option>
                      <option value="altro">🔧 Altro</option>
                    </select>
                  </div>

                  {/* Dinamico: Difetto Riscontrato in base alla scelta */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                      <AlertOctagon className="w-4 h-4" /> 4. Difetto Riscontrato *
                    </label>
                    <select
                      value={supportSpecificIssue}
                      onChange={(e) => setSupportSpecificIssue(e.target.value)}
                      required
                      className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 focus:border-rose-500'
                          : 'bg-slate-800 border-white/15 focus:border-rose-500 text-white'
                      }`}
                    >
                      {SUPPORT_FAULT_CATEGORIES.find((c) => c.id === supportMacroArea)?.issues.map((opt) => (
                        <option key={opt.id} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 5. Descrizione / Note Aggiuntive Guasto */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-400">
                    5. Dettagli / Note Aggiuntive sul Malfunzionamento
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Descrivi dettagli o codici errore comparsi a display..."
                    value={supportIssueDescription}
                    onChange={(e) => setSupportIssueDescription(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl text-xs border ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                    }`}
                  />
                </div>

                {/* 6. Priorità & Referente sul Posto */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Priorità Intervento
                    </label>
                    <select
                      value={supportPriority}
                      onChange={(e) => setSupportPriority(e.target.value as any)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                      }`}
                    >
                      <option value="NORMALE">Normale</option>
                      <option value="ALTA">Alta (Malfunzionante)</option>
                      <option value="CRITICA">Critica (Macchina Bloccata)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Referente sul Posto
                    </label>
                    <input
                      type="text"
                      placeholder="Nome e cognome"
                      value={supportRequesterName}
                      onChange={(e) => setSupportRequesterName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-slate-400">
                      Recapito Telefonico
                    </label>
                    <input
                      type="tel"
                      placeholder="Tel / Cellulare"
                      value={supportRequesterPhone}
                      onChange={(e) => setSupportRequesterPhone(e.target.value)}
                      className={`w-full px-3 py-2 rounded-xl text-xs border ${
                        isLight ? 'bg-slate-50 border-slate-300' : 'bg-slate-800 border-white/15'
                      }`}
                    />
                  </div>
                </div>

                {/* 8. Destinatario Notifica Assistenza (Email) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Mail className="w-4 h-4 text-rose-500" />
                      <span>Destinatario Notifica Assistenza (Email) *</span>
                    </label>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        smtpStatus?.configured
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {smtpStatus?.configured ? 'SMTP Attivo' : 'SMTP Non Configurato'}
                    </span>
                  </div>
                  <input
                    type="email"
                    required
                    value={supportRecipientEmail}
                    onChange={(e) => setSupportRecipientEmail(e.target.value)}
                    placeholder="claudiograf@iobevo.com"
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:border-rose-500'
                        : 'bg-slate-800 border-white/15 text-white focus:border-rose-500'
                    }`}
                  />
                  {!smtpStatus?.configured && (
                    <p className="text-[10.5px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Server SMTP non configurato: potrai inoltrare subito la scheda guasto con il pulsante Mailto oppure configurare il server SMTP.</span>
                    </p>
                  )}
                </div>

                {/* Error message */}
                {supportSubmitError && (
                  <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{supportSubmitError}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/10">
                  <div className="text-xs text-slate-400">
                    Priorità: <strong className="text-rose-600 dark:text-rose-400 font-bold">{supportPriority}</strong>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsSupportModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Annulla
                    </button>

                    <button
                      type="submit"
                      disabled={isSubmittingSupport}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmittingSupport ? 'Invio in corso...' : 'Invia Richiesta Assistenza'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal: Upload / Change Customer Logo */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div
            className={`w-full max-w-md rounded-3xl border p-6 space-y-5 shadow-2xl ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-white/20'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <h3 className="text-base font-bold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                <span>Logo Aziendale Cliente</span>
              </h3>
              <button
                onClick={() => setIsLogoModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Personalizza il cruscotto di <strong>{customer.name}</strong> caricando il logo ufficiale dell'azienda.
            </p>

            {/* Preview Box */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-slate-800/50">
              {customLogoInput ? (
                <div className="w-32 h-32 rounded-xl bg-white border border-slate-200 p-2 flex items-center justify-center overflow-hidden shadow-inner">
                  <img
                    src={customLogoInput}
                    alt="Anteprima Logo"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 space-y-1">
                  <Building2 className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                  <span className="text-xs font-semibold">Nessun logo selezionato</span>
                </div>
              )}
            </div>

            {/* Action 1: Upload from local file */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Carica File dal Computer (PNG, JPG, SVG)</span>
              </button>
            </div>

            {/* Action 2: Or Paste Image URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">
                Oppure incolla URL immagine web:
              </label>
              <input
                type="url"
                placeholder="https://azienda.it/logo.png"
                value={customLogoInput.startsWith('data:') ? '' : customLogoInput}
                onChange={(e) => {
                  setCustomLogoInput(e.target.value);
                  setLogoSaveError(null);
                }}
                className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 focus:border-emerald-500'
                    : 'bg-slate-800 border-white/10 focus:border-emerald-500'
                }`}
              />
            </div>

            {/* Status messages */}
            {logoSaveError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{logoSaveError}</span>
              </div>
            )}
            {logoSaveSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Logo salvato con successo!</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              {customer.logoUrl ? (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isSavingLogo}
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Rimuovi Logo</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLogoModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSaveLogo}
                  disabled={isSavingLogo}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSavingLogo ? 'Salvataggio...' : 'Salva Logo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
