import React, { useState, useEffect } from 'react';
import { VendingMachine, Esp32Device, MachineLocation, Esp32DiagnosticLog, Customer, CustomerSite, CalibrationTemplate } from '../types';
import { STANDARD_CALIBRATION_TEMPLATES } from '../data/calibrationTemplates';
import { useTheme } from '../context/ThemeContext';
import { downloadCsvFile } from '../utils/csvExporter';
import {
  Server,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Cpu,
  MapPin,
  Wifi,
  Thermometer,
  Coffee,
  Droplets,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Flame,
  Settings,
  ShieldCheck,
  Activity,
  X,
  Play,
  Code,
  Search,
  Sliders,
  Building2,
  Radio,
  Unlink,
  Link,
  Lock,
  Hash,
  FileText,
  Clock,
  Layers,
  ChevronRight,
  HardDrive,
  Check,
  Zap,
  Gauge,
  Terminal,
  Download,
  Key,
  Compass,
  Users,
  Scale,
  Tablet,
} from 'lucide-react';
import { MATRIX_KEYS } from '../utils/keypadMapping';
import { MachineCalibrationView } from './MachineCalibrationView';

interface FleetManagerProps {
  onSelectMachineForSimulation?: (machineId: string) => void;
  onSelectMachineForKeymap?: (machineId: string) => void;
  onSelectMachineForCode?: (machineId: string) => void;
  onSelectMachineForTouchPanel?: (machineId: string) => void;
  onNavigateToCustomers?: () => void;
  customers?: Customer[];
}

export const FleetManager: React.FC<FleetManagerProps> = ({
  onSelectMachineForSimulation,
  onSelectMachineForKeymap,
  onSelectMachineForCode,
  onSelectMachineForTouchPanel,
  onNavigateToCustomers,
  customers: propCustomers,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [activeTab, setActiveTab] = useState<'machines' | 'devices' | 'calibration'>('machines');
  const [selectedCalibrationMachineId, setSelectedCalibrationMachineId] = useState<string>('');
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [devices, setDevices] = useState<Esp32Device[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(propCustomers || []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals state
  const [showMachineModal, setShowMachineModal] = useState<boolean>(false);
  const [editingMachine, setEditingMachine] = useState<VendingMachine | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<VendingMachine | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  const [showDeviceModal, setShowDeviceModal] = useState<boolean>(false);
  const [editingDevice, setEditingDevice] = useState<Esp32Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Esp32Device | null>(null);

  // Discovery, Diagnostics & WiFi Provisioning States
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoverySubnet, setDiscoverySubnet] = useState<string>('192.168.1');
  const [diagnosticsDevice, setDiagnosticsDevice] = useState<Esp32Device | null>(null);
  const [provisioningDevice, setProvisioningDevice] = useState<Esp32Device | null>(null);
  const [provSsid, setProvSsid] = useState<string>('');
  const [provPassword, setProvPassword] = useState<string>('');
  const [provStaticIp, setProvStaticIp] = useState<string>('');
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);

  // Bench Testing (Collaudo Standalone Senza Macchina)
  const [benchTestDevice, setBenchTestDevice] = useState<Esp32Device | null>(null);
  const [benchTestDurationMs, setBenchTestDurationMs] = useState<number>(400);
  const [benchTestingKey, setBenchTestingKey] = useState<string | null>(null);
  const [benchTestRecentResult, setBenchTestRecentResult] = useState<{
    timestamp: string;
    message: string;
    key: string;
    wireA?: number;
    wireB?: number;
    durationMs?: number;
    success: boolean;
  } | null>(null);

  const [quickPairMachine, setQuickPairMachine] = useState<VendingMachine | null>(null);
  const [refillingId, setRefillingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Machine Form States
  const [formId, setFormId] = useState('');
  const [formSerialNumber, setFormSerialNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('Ristosano');
  const [formElectronicBoard, setFormElectronicBoard] = useState('Scheda Controller Ristosano');
  const [formAssignedMac, setFormAssignedMac] = useState('');

  // Mandatory Customer & Site Association
  const [formCustomerId, setFormCustomerId] = useState<string>('');
  const [formCustomerSiteId, setFormCustomerSiteId] = useState<string>('');

  // Location Details
  const [formCompany, setFormCompany] = useState('');
  const [formSite, setFormSite] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formZipCode, setFormZipCode] = useState('');
  const [formProvince, setFormProvince] = useState('');
  const [formFloorRoom, setFormFloorRoom] = useState('');
  const [formLocationNotes, setFormLocationNotes] = useState('');
  // Parameters
  const [formIp, setFormIp] = useState('192.168.1.150');
  const [formSsid, setFormSsid] = useState('Azienda_WiFi_IoT');
  const [formDebounceMs, setFormDebounceMs] = useState(30);
  const [formTargetTemp, setFormTargetTemp] = useState(93.0);
  const [formOptoDurationMs, setFormOptoDurationMs] = useState(400);
  const [formCaraffaMult, setFormCaraffaMult] = useState(3.0);
  const [formKeyMapping, setFormKeyMapping] = useState<Record<string, string>>({});
  const [formEnableCalibrationAndConsumption, setFormEnableCalibrationAndConsumption] = useState<boolean>(false);
  const [calibrationTemplates, setCalibrationTemplates] = useState<CalibrationTemplate[]>(STANDARD_CALIBRATION_TEMPLATES);
  const [formCalibrationTemplateId, setFormCalibrationTemplateId] = useState<string>('template-ristosano-std');

  // Device Form States (GB-CLOUD MODULE)
  const [devMac, setDevMac] = useState('');
  const [devSerialNumber, setDevSerialNumber] = useState('');
  const [devDeviceId, setDevDeviceId] = useState('');
  const [devBoardModel, setDevBoardModel] = useState('GB-CLOUD Controller Board (38-Pin + Modulo Opto)');
  const [devFirmware, setDevFirmware] = useState('v3.2.0-PRO-MATRIX');
  const [devIp, setDevIp] = useState('192.168.1.145');
  const [devSsid, setDevSsid] = useState('Azienda_WiFi_IoT');
  const [devVoltage, setDevVoltage] = useState<'12v_opto' | '24v_opto' | '3v3_direct'>('12v_opto');
  const [devOptoDurationMs, setDevOptoDurationMs] = useState(400);
  const [devDebounceMs, setDevDebounceMs] = useState(30);
  const [devOptoPins, setDevOptoPins] = useState('19, 21, 22, 23');
  const [devMatrixRowPins, setDevMatrixRowPins] = useState({ r1: 13, r2: 12, r3: 14, r4: 27 });
  const [devMatrixColPins, setDevMatrixColPins] = useState({ c1: 26, c2: 25, c3: 33, c4: 32 });
  const [devBuzzerPin, setDevBuzzerPin] = useState(18);
  const [devRelayPin, setDevRelayPin] = useState(5);
  const [devAssignedMachineId, setDevAssignedMachineId] = useState<string>('');
  const [devNotes, setDevNotes] = useState('');
  const [testingOptoMac, setTestingOptoMac] = useState<string | null>(null);
  const [pingingMac, setPingingMac] = useState<string | null>(null);
  const [togglingStatusMac, setTogglingStatusMac] = useState<string | null>(null);

  // Watchdog & Heartbeat Tuning States
  const [heartbeatTimeoutSec, setHeartbeatTimeoutSec] = useState<number>(45);
  const [isUpdatingTimeout, setIsUpdatingTimeout] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [statusReport, setStatusReport] = useState<any | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const fetchHeartbeatTimeout = async () => {
    try {
      const res = await fetch('/api/config/heartbeat-timeout');
      if (res.ok) {
        const data = await res.json();
        if (data.heartbeatTimeoutSec) {
          setHeartbeatTimeoutSec(data.heartbeatTimeoutSec);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleUpdateHeartbeatTimeout = async (sec: number) => {
    setIsUpdatingTimeout(true);
    try {
      const res = await fetch('/api/config/heartbeat-timeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heartbeatTimeoutSec: sec }),
      });
      if (res.ok) {
        const data = await res.json();
        setHeartbeatTimeoutSec(data.heartbeatTimeoutSec || sec);
        showToast(`Timeout Watchdog impostato a ${sec}s! I moduli silenziosi diverranno offline dopo ${sec}s.`);
        await fetchData();
      } else {
        showToast('Errore durante l\'aggiornamento del timeout', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    } finally {
      setIsUpdatingTimeout(false);
    }
  };

  const handleForceCheckStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/devices/check-status', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setStatusReport(data);
        showToast(`Verifica completata: ${data.onlineCount}/${data.totalCount} moduli online (soglia ${data.timeoutSec}s)`);
        await fetchData();
      } else {
        showToast('Errore durante la verifica stato', 'error');
      }
    } catch {
      showToast('Errore di rete durante la verifica', 'error');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleToggleDeviceStatus = async (mac: string, targetStatus: string) => {
    setTogglingStatusMac(mac);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(mac)}/toggle-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        showToast(`Stato dispositivo [${mac}] forzato su ${targetStatus}`);
        await fetchData();
      } else {
        showToast('Impossibile aggiornare lo stato', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    } finally {
      setTogglingStatusMac(null);
    }
  };

  const handleExportMachinesCsv = () => {
    const headers = [
      'Matricola',
      'Nome Distributore',
      'Modello',
      'Stato',
      'Cliente Gestore',
      'Sede Operativa',
      'Indirizzo',
      'Città',
      'Provincia',
      'Modulo Hardware MAC',
      'IP Address',
      'Erogazioni Totali',
      'Taratura Consumi',
      'Ultima Telemetria',
    ];

    const rows = machines.map((m) => {
      const matchedCustomer = customers.find((c) => c.id === m.customerId)
        || (m.locationDetails?.company ? customers.find((c) => c.name.toLowerCase() === m.locationDetails?.company.toLowerCase()) : null);
      const matchedSite = matchedCustomer?.sites?.find((s) => s.id === m.customerSiteId)
        || matchedCustomer?.sites?.find((s) => s.name.toLowerCase() === (m.locationDetails?.site || '').toLowerCase());

      return [
        m.serialNumber,
        m.name,
        m.model || 'Ristosano',
        m.status,
        matchedCustomer ? matchedCustomer.name : (m.locationDetails?.company || 'Non Assegnato'),
        matchedSite ? matchedSite.name : (m.locationDetails?.site || 'Nessuna Sede'),
        m.locationDetails?.address || '',
        m.locationDetails?.city || '',
        m.locationDetails?.province || '',
        m.assignedDeviceMac || '',
        m.ipAddress || '',
        m.supplies?.totalDispenses || 0,
        m.enableCalibrationAndConsumption ? 'ATTIVA' : 'DISATTIVA',
        m.lastTelemetryAt || '',
      ];
    });

    const dateStr = new Date().toISOString().split('T')[0];
    downloadCsvFile(`distributori_flotta_${dateStr}.csv`, headers, rows);
    showToast(`Esportati ${rows.length} distributori in CSV!`);
  };

  const getHeartbeatAge = (lastHeartbeatAt?: string) => {
    if (!lastHeartbeatAt) return { text: 'Nessun segnale', seconds: 999999, isFresh: false };
    const pingMs = new Date(lastHeartbeatAt).getTime();
    const diffSec = Math.max(0, Math.round((now - pingMs) / 1000));
    const isFresh = diffSec <= heartbeatTimeoutSec;
    if (diffSec < 60) {
      return { text: `${diffSec}s fa`, seconds: diffSec, isFresh };
    }
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return { text: `${mins}m ${secs}s fa`, seconds: diffSec, isFresh };
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [resM, resD, resC, resT] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/devices'),
        fetch('/api/customers'),
        fetch('/api/calibration-templates').catch(() => null),
      ]);
      if (resM.ok) {
        const dataM = await resM.json();
        setMachines(dataM || []);
      }
      if (resD.ok) {
        const dataD = await resD.json();
        setDevices(dataD || []);
      }
      if (resC.ok) {
        const dataC = await resC.json();
        const listC: Customer[] = dataC.customers || dataC || [];
        setCustomers(listC);
      }
      if (resT && resT.ok) {
        const dataT = await resT.json();
        if (Array.isArray(dataT) && dataT.length > 0) {
          setCalibrationTemplates(dataT);
        }
      }
    } catch (err) {
      console.error('Error fetching fleet data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (propCustomers && propCustomers.length > 0) {
      setCustomers(propCustomers);
    }
  }, [propCustomers]);

  useEffect(() => {
    fetchData();
    fetchHeartbeatTimeout();

    // 1-second interval for real-time heartbeat age counter
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    // SSE updates listener
    let sse: EventSource | null = null;
    try {
      sse = new EventSource('/api/stream');
      sse.addEventListener('machines-updated', (e) => {
        try {
          const updated = JSON.parse(e.data);
          setMachines(updated);
        } catch {
          // ignore
        }
      });
      sse.addEventListener('devices-updated', (e) => {
        try {
          const updatedDevs = JSON.parse(e.data);
          setDevices(updatedDevs);
        } catch {
          // ignore
        }
      });
      sse.addEventListener('device-auto-detected', (e) => {
        try {
          const payload = JSON.parse(e.data);
          const dev = payload.device;
          showToast(`Nuovo Modulo GB-CLOUD programmato rilevato in rete: ${dev?.deviceId || ''} (MAC: ${dev?.macAddress || ''}, Matricola: #${dev?.serialNumber || ''})`, 'success');
          fetchData();
        } catch {
          // ignore
        }
      });
      sse.addEventListener('customers-updated', (e) => {
        try {
          const updatedCust = JSON.parse(e.data);
          const listC = updatedCust.customers || updatedCust || [];
          setCustomers(listC);
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    return () => {
      clearInterval(timer);
      if (sse) sse.close();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Customer selection helper for machine modal
  const handleSelectCustomer = (customerId: string) => {
    setFormCustomerId(customerId);
    if (!customerId) {
      setFormCustomerSiteId('');
      setFormCompany('');
      setFormSite('');
      setFormAddress('');
      setFormCity('');
      setFormZipCode('');
      setFormProvince('');
      setFormFloorRoom('');
      setFormLocationNotes('');
      return;
    }
    const selectedCust = customers.find((c) => c.id === customerId);
    if (selectedCust) {
      const sites = selectedCust.sites || [];
      const firstSite = sites.length > 0 ? sites[0] : null;
      setFormCustomerSiteId(firstSite ? firstSite.id : '');
      setFormCompany(selectedCust.name);

      if (firstSite) {
        // I dati di indirizzo vanno presi tassativamente dalla sede operativa
        setFormSite(firstSite.name);
        setFormAddress(firstSite.address || '');
        setFormCity(firstSite.city || '');
        setFormZipCode(firstSite.zipCode || '');
        setFormProvince(firstSite.province ? firstSite.province.toUpperCase() : '');
        setFormFloorRoom(firstSite.floorRoom || 'Piano 1 - Area Break');
        setFormLocationNotes(firstSite.notes || (firstSite.contactPerson ? `Referente: ${firstSite.contactPerson}${firstSite.phone ? ' - Tel: ' + firstSite.phone : ''}` : ''));
      } else {
        // Nel caso in cui il cliente non abbia ancora sedi registrate
        setFormSite('Sede Operativa');
        setFormAddress(selectedCust.address || '');
        setFormCity(selectedCust.city || '');
        setFormZipCode(selectedCust.zipCode || '');
        setFormProvince(selectedCust.province ? selectedCust.province.toUpperCase() : '');
        setFormFloorRoom('Piano 1 - Area Break');
        setFormLocationNotes(selectedCust.notes || '');
      }
    }
  };

  const handleSelectSite = (siteId: string) => {
    setFormCustomerSiteId(siteId);
    const selectedCust = customers.find((c) => c.id === formCustomerId);
    if (selectedCust) {
      const site = selectedCust.sites?.find((s) => s.id === siteId);
      if (site) {
        // Prendi sempre i dati fisici di indirizzo dalla sede operativa selezionata
        setFormSite(site.name);
        setFormAddress(site.address || '');
        setFormCity(site.city || '');
        setFormZipCode(site.zipCode || '');
        setFormProvince(site.province ? site.province.toUpperCase() : '');
        if (site.floorRoom) {
          setFormFloorRoom(site.floorRoom);
        }
        if (site.notes) {
          setFormLocationNotes(site.notes);
        } else if (site.contactPerson) {
          setFormLocationNotes(`Referente: ${site.contactPerson}${site.phone ? ' - Tel: ' + site.phone : ''}`);
        }
      }
    }
  };

  // Handle refill single machine
  const handleRefill = async (id: string) => {
    setRefillingId(id);
    try {
      const res = await fetch(`/api/machines/${id}/refill`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Serbatoi riforniti al 100%');
        await fetchData();
      } else {
        showToast('Errore durante il rifornimento', 'error');
      }
    } catch {
      showToast('Errore di connessione', 'error');
    } finally {
      setRefillingId(null);
    }
  };

  // Open Machine Modal for Add
  const handleOpenAddMachine = () => {
    setEditingMachine(null);
    const nextNum = machines.length + 1;
    const random6Digits = String(Math.floor(100000 + Math.random() * 900000));
    setFormSerialNumber(random6Digits);
    setFormId(`GB-DIST-${random6Digits}`);
    setFormName(`Distributore ${String(nextNum).padStart(2, '0')}: Nuovo Impianto`);
    setFormModel('Ristosano');
    setFormElectronicBoard('Scheda Controller Ristosano');
    
    // Do NOT preselect any device: creating a machine is completely independent of hardware modules
    setFormAssignedMac('');

    // Customer Selection defaults to empty (Stock / Magazzino)
    setFormCustomerId('');
    setFormCustomerSiteId('');
    setFormCompany('In Magazzino (Non Assegnata)');
    setFormSite('Magazzino Centrale');
    setFormAddress('Magazzino Centrale');
    setFormCity('');
    setFormZipCode('');
    setFormProvince('');
    setFormFloorRoom('Reparto Collaudo / Magazzino');
    setFormLocationNotes('');

    setFormIp(`192.168.1.${140 + nextNum}`);
    setFormSsid('Azienda_WiFi_IoT');
    setFormDebounceMs(30);
    setFormTargetTemp(93.0);
    setFormOptoDurationMs(400);
    setFormCaraffaMult(3.0);
    setFormCalibrationTemplateId('template-ristosano-std');

    const defaultKeys: Record<string, string> = {};
    MATRIX_KEYS.filter((k) => k.isProduct).forEach((k) => {
      defaultKeys[k.key] = k.defaultProduct;
    });
    setFormKeyMapping(defaultKeys);
    setFormEnableCalibrationAndConsumption(false);

    setShowMachineModal(true);
  };

  // Open Machine Modal for Edit
  const handleOpenEditMachine = (m: VendingMachine) => {
    setEditingMachine(m);
    setFormId(m.id);
    const rawDigits = (m.serialNumber || '').replace(/\D/g, '');
    const clean6Digits = rawDigits.length === 6 ? rawDigits : (rawDigits.length > 0 ? rawDigits.slice(-6).padStart(6, '0') : '104829');
    setFormSerialNumber(clean6Digits);
    setFormName(m.name);
    setFormModel(m.model);
    setFormElectronicBoard(m.electronicBoard || 'Scheda Controller Ristosano');
    setFormAssignedMac(m.assignedDeviceMac || m.macAddress || '');

    // Customer & Site linkage (remain empty if in magazzino)
    const currentCust = m.customerId ? customers.find((c) => c.id === m.customerId) : null;
    const currentSite = currentCust?.sites?.find((s) => s.id === m.customerSiteId)
      || currentCust?.sites?.[0]
      || null;

    setFormCustomerId(currentCust ? currentCust.id : '');
    setFormCustomerSiteId(currentSite ? currentSite.id : '');

    const defaultKeys: Record<string, string> = {};
    MATRIX_KEYS.filter((k) => k.isProduct).forEach((k) => {
      defaultKeys[k.key] = k.defaultProduct;
    });
    setFormKeyMapping(m.keyMapping || defaultKeys);
    setFormEnableCalibrationAndConsumption(
      m.enableCalibrationAndConsumption !== undefined
        ? Boolean(m.enableCalibrationAndConsumption)
        : Boolean(m.config?.enableCalibrationAndConsumption)
    );

    const loc = m.locationDetails;
    setFormCompany(loc?.company || currentCust?.name || '');
    setFormSite(loc?.site || currentSite?.name || 'Sede Operativa');
    setFormAddress(loc?.address || currentSite?.address || '');
    setFormCity(loc?.city || currentSite?.city || '');
    setFormZipCode(loc?.zipCode || currentSite?.zipCode || '');
    setFormProvince(loc?.province || currentSite?.province || '');
    setFormFloorRoom(loc?.floorRoom || m.location || '');
    setFormLocationNotes(m.notes || loc?.notes || currentSite?.notes || '');

    setFormIp(m.ipAddress || '192.168.1.100');
    setFormSsid(m.config?.wifiSsid || 'Azienda_WiFi_IoT');
    setFormDebounceMs(m.config?.debounceMs || 30);
    setFormTargetTemp(m.config?.boilerTargetTemp || 93.0);
    setFormOptoDurationMs(m.config?.optoTriggerDurationMs || 400);
    setFormCaraffaMult(m.config?.caraffaMultiplier || 3.0);
    setFormCalibrationTemplateId('');
    setShowMachineModal(true);
  };

  // Quick Toggle Calibration & Consumption Mode for a Machine
  const handleQuickToggleCalibrationMode = async (machine: VendingMachine) => {
    const currentVal = Boolean(machine.enableCalibrationAndConsumption ?? machine.config?.enableCalibrationAndConsumption);
    const targetVal = !currentVal;
    try {
      const res = await fetch(`/api/machines/${machine.id}/calibration-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetVal }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Modalità macchina aggiornata: ${targetVal ? 'Taratura abilitata' : 'Sola battuta'}`);
        await fetchData();
      } else {
        showToast(data.error || 'Errore durante aggiornamento modalità', 'error');
      }
    } catch {
      showToast('Errore di connessione', 'error');
    }
  };

  // Save Machine (Create or Update)
  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanAssignedMac = formAssignedMac ? formAssignedMac.trim().toUpperCase() : null;

    let linkedCust = formCustomerId ? customers.find((c) => c.id === formCustomerId) : null;
    let locationDetails: MachineLocation;
    let locationSummary = 'Magazzino / Non Assegnata';

    if (linkedCust) {
      locationDetails = {
        company: linkedCust.name,
        site: formSite.trim() || 'Sede Operativa',
        address: formAddress.trim(),
        city: formCity.trim(),
        zipCode: formZipCode.trim(),
        province: formProvince.trim().toUpperCase(),
        floorRoom: formFloorRoom.trim(),
        notes: formLocationNotes.trim(),
      };
      locationSummary = `${locationDetails.company} - ${locationDetails.site}, ${locationDetails.floorRoom || locationDetails.address}`;
    } else {
      locationDetails = {
        company: 'In Magazzino (Non Assegnata)',
        site: 'Deposito / Preparazione',
        address: formAddress.trim() || 'Magazzino Centrale',
        city: formCity.trim() || 'Sede',
        zipCode: formZipCode.trim() || '00000',
        province: formProvince.trim().toUpperCase() || 'MI',
        floorRoom: formFloorRoom.trim(),
        notes: formLocationNotes.trim(),
      };
    }

    const digits = formSerialNumber.replace(/\D/g, '');
    // Il numero di matricola a 6 cifre non può MAI essere modificato una volta creato!
    const cleanSerialNumber = editingMachine 
      ? editingMachine.serialNumber
      : (digits.length === 6 ? digits : (digits.length > 0 ? digits.slice(-6).padStart(6, '0') : String(Math.floor(100000 + Math.random() * 900000))));

    const payload = {
      id: formId,
      serialNumber: cleanSerialNumber,
      name: formName.trim(),
      notes: formLocationNotes.trim(),
      model: formModel,
      electronicBoard: formElectronicBoard,
      customerId: linkedCust ? linkedCust.id : null,
      customerSiteId: linkedCust ? (formCustomerSiteId || linkedCust.sites[0]?.id || null) : null,
      location: locationSummary,
      locationDetails,
      assignedDeviceMac: cleanAssignedMac,
      calibrationTemplateId: formCalibrationTemplateId || undefined,
      ipAddress: formIp,
      keyMapping: formKeyMapping,
      enableCalibrationAndConsumption: formEnableCalibrationAndConsumption,
      config: {
        debounceMs: Number(formDebounceMs),
        isFreeDispense: true,
        caraffaMultiplier: Number(formCaraffaMult),
        boilerTargetTemp: Number(formTargetTemp),
        optoTriggerDurationMs: Number(formOptoDurationMs),
        wifiSsid: formSsid,
        enableCalibrationAndConsumption: formEnableCalibrationAndConsumption,
      },
    };

    try {
      const url = editingMachine ? `/api/machines/${editingMachine.id}` : '/api/machines';
      const method = editingMachine ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Distributore salvato con successo!');
        setShowMachineModal(false);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore durante il salvataggio', 'error');
      }
    } catch {
      showToast('Errore di connessione con il server', 'error');
    }
  };

  // Delete Machine
  const handleDeleteMachine = async () => {
    if (!machineToDelete) return;
    try {
      const res = await fetch(`/api/machines/${machineToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Distributore '${machineToDelete.name}' eliminato`);
        setMachineToDelete(null);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore eliminazione', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    }
  };

  // Reset entire fleet to start from zero
  const handleResetFleetBlank = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/fleet/reset-blank', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Tutti gli impianti sono stati azzerati con successo');
        setShowResetConfirm(false);
        await fetchData();
      } else {
        showToast(data.error || 'Errore durante azzeramento', 'error');
      }
    } catch {
      showToast('Errore di rete durante azzeramento', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  // Helper to ensure 6-digit serial starting with 5
  const formatModuleSerial = (raw?: string): string => {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 6 && digits.startsWith('5')) return digits;
    if (digits.length === 5) return '5' + digits;
    if (digits.length === 6 && !digits.startsWith('5')) return '5' + digits.slice(1);
    if (digits.length > 6) return '5' + digits.slice(-5);
    if (digits.length > 0) return ('5' + digits).padEnd(6, '0').slice(0, 6);
    return '5' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  };

  // Open Device Modal for Add
  const handleOpenAddDevice = () => {
    setEditingDevice(null);
    const nextNum = devices.length + 1;
    // Generate sample MAC format
    const hex = (val: number) => val.toString(16).padStart(2, '0').toUpperCase();
    const newSerial = '5' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    setDevMac(`24:6F:28:${hex(nextNum + 10)}:${hex(Math.floor(Math.random() * 255))}:${hex(Math.floor(Math.random() * 255))}`);
    setDevSerialNumber(newSerial);
    setDevDeviceId(`GB-CLOUD MODULE ${newSerial}`);
    setDevBoardModel('GB-CLOUD Controller Board (38-Pin + Modulo Opto)');
    setDevFirmware('v3.2.0-PRO-MATRIX');
    setDevIp(`192.168.1.${140 + nextNum}`);
    setDevSsid('Azienda_WiFi_IoT');
    setDevVoltage('12v_opto');
    setDevOptoDurationMs(400);
    setDevDebounceMs(30);
    setDevOptoPins('19, 21, 22, 23');
    setDevMatrixRowPins({ r1: 13, r2: 12, r3: 14, r4: 27 });
    setDevMatrixColPins({ c1: 26, c2: 25, c3: 33, c4: 32 });
    setDevBuzzerPin(18);
    setDevRelayPin(5);
    setDevAssignedMachineId('');
    setDevNotes('Modulo GB-CLOUD con tastiera a membrana e uscite optoisolate integrato sul distributore.');
    setShowDeviceModal(true);
  };

  // Open Device Modal for Edit
  const handleOpenEditDevice = (dev: Esp32Device) => {
    setEditingDevice(dev);
    setDevMac(dev.macAddress);
    const rawSerial = dev.serialNumber || (dev.deviceId.startsWith('GB-CLOUD MODULE ') ? dev.deviceId.replace('GB-CLOUD MODULE ', '').trim() : '');
    const existingSerial = formatModuleSerial(rawSerial);
    setDevSerialNumber(existingSerial);
    setDevDeviceId(`GB-CLOUD MODULE ${existingSerial}`);
    setDevBoardModel(dev.boardModel || 'GB-CLOUD Controller Board (38-Pin + Modulo Opto)');
    setDevFirmware(dev.firmwareVersion);
    setDevIp(dev.ipAddress);
    setDevSsid(dev.wifiSsid);
    setDevVoltage(dev.hardwareConfig?.voltageLevel || '12v_opto');
    setDevOptoDurationMs(dev.hardwareConfig?.optoTriggerDurationMs || 400);
    setDevDebounceMs(dev.hardwareConfig?.debounceMs || 30);
    setDevOptoPins(dev.hardwareConfig?.optoOutputPins ? dev.hardwareConfig.optoOutputPins.join(', ') : '19, 21, 22, 23');
    if (dev.hardwareConfig?.matrixPins) {
      setDevMatrixRowPins({
        r1: dev.hardwareConfig.matrixPins.row1 ?? 13,
        r2: dev.hardwareConfig.matrixPins.row2 ?? 12,
        r3: dev.hardwareConfig.matrixPins.row3 ?? 14,
        r4: dev.hardwareConfig.matrixPins.row4 ?? 27,
      });
      setDevMatrixColPins({
        c1: dev.hardwareConfig.matrixPins.col1 ?? 26,
        c2: dev.hardwareConfig.matrixPins.col2 ?? 25,
        c3: dev.hardwareConfig.matrixPins.col3 ?? 33,
        c4: dev.hardwareConfig.matrixPins.col4 ?? 32,
      });
    }
    setDevBuzzerPin(dev.hardwareConfig?.buzzerPin ?? 18);
    setDevRelayPin(dev.hardwareConfig?.relayPin ?? 5);
    setDevAssignedMachineId(dev.assignedMachineId || '');
    setDevNotes(dev.notes || '');
    setShowDeviceModal(true);
  };

  // Save Device
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const optoPinsParsed = devOptoPins
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((n) => !isNaN(n) && n >= 0 && n <= 39);

    // Serial number a 6 cifre non modificabile dopo la creazione
    const targetSerial = editingDevice?.serialNumber || formatModuleSerial(devSerialNumber);
    const targetDeviceId = `GB-CLOUD MODULE ${targetSerial}`;

    const payload = {
      macAddress: devMac.trim().toUpperCase(),
      serialNumber: targetSerial,
      deviceId: targetDeviceId,
      boardModel: devBoardModel,
      firmwareVersion: devFirmware.trim(),
      ipAddress: devIp.trim(),
      wifiSsid: devSsid.trim(),
      assignedMachineId: devAssignedMachineId || null,
      hardwareConfig: {
        debounceMs: Number(devDebounceMs),
        optoTriggerDurationMs: Number(devOptoDurationMs),
        voltageLevel: devVoltage,
        matrixPins: {
          row1: Number(devMatrixRowPins.r1),
          row2: Number(devMatrixRowPins.r2),
          row3: Number(devMatrixRowPins.r3),
          row4: Number(devMatrixRowPins.r4),
          col1: Number(devMatrixColPins.c1),
          col2: Number(devMatrixColPins.c2),
          col3: Number(devMatrixColPins.c3),
          col4: Number(devMatrixColPins.c4),
        },
        optoOutputPins: optoPinsParsed.length > 0 ? optoPinsParsed : [19, 21, 22, 23],
        buzzerPin: Number(devBuzzerPin),
        relayPin: Number(devRelayPin),
      },
      notes: devNotes.trim(),
    };

    try {
      const url = editingDevice ? `/api/devices/${encodeURIComponent(editingDevice.macAddress)}` : '/api/devices';
      const method = editingDevice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Modulo GB-CLOUD salvato con successo!');
        setShowDeviceModal(false);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore salvataggio dispositivo', 'error');
      }
    } catch {
      showToast('Errore di connessione', 'error');
    }
  };

  // Live Test Opto Trigger on ESP32
  const handleTestOptoTrigger = async (mac: string, pin: number = 19, durationMs: number = 400) => {
    setTestingOptoMac(mac);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(mac)}/test-opto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, durationMs }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Impulso optoisolato inviato a GPIO ${pin} (${durationMs}ms)`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore test uscita opto', 'error');
      }
    } catch {
      showToast('Errore di connessione durante il test opto', 'error');
    } finally {
      setTimeout(() => setTestingOptoMac(null), 800);
    }
  };

  // Bench Test Key Trigger for Standalone ESP32 modules (senza macchina)
  const handleRunBenchTestKey = async (mac: string, key: string, customDuration?: number) => {
    setBenchTestingKey(key);
    const dur = customDuration || benchTestDurationMs || 400;
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(mac)}/test-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, durationMs: dur }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBenchTestRecentResult({
          timestamp: new Date().toLocaleTimeString(),
          message: data.message || `Impulso ${key} inviato con successo`,
          key,
          wireA: data.wireA,
          wireB: data.wireB,
          durationMs: dur,
          success: true,
        });
        showToast(data.message || `Comando ${key} inviato al modulo via MQTT`);
      } else {
        setBenchTestRecentResult({
          timestamp: new Date().toLocaleTimeString(),
          message: data.error || 'Errore test tasto',
          key,
          success: false,
        });
        showToast(data.error || 'Errore test tasto', 'error');
      }
    } catch {
      showToast('Errore di connessione durante il test tasto', 'error');
    } finally {
      setTimeout(() => setBenchTestingKey(null), 600);
    }
  };

  // Heartbeat Ping Test
  const handlePingHeartbeat = async (mac: string, deviceId: string) => {
    setPingingMac(mac);
    try {
      const res = await fetch('/api/devices/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macAddress: mac, deviceId }),
      });
      if (res.ok) {
        showToast(`Heartbeat verificato con successo per Modulo [${mac}]`);
        await fetchData();
      } else {
        showToast('Errore durante il ping heartbeat', 'error');
      }
    } catch {
      showToast('Errore di rete durante il ping', 'error');
    } finally {
      setTimeout(() => setPingingMac(null), 600);
    }
  };

  // Run Network Discovery (mDNS / ARP Scan)
  const handleRunDiscovery = async () => {
    setIsDiscovering(true);
    try {
      const res = await fetch('/api/devices/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subnet: discoverySubnet }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Scansione completata: ${data.discovered?.length || 0} Moduli GB-CLOUD rilevati in rete!`);
        await fetchData();
      } else {
        showToast('Errore durante la scansione di rete', 'error');
      }
    } catch {
      showToast('Errore di connessione durante la scansione', 'error');
    } finally {
      setIsDiscovering(false);
    }
  };

  // Open WiFi Provisioning Modal
  const handleOpenProvisioning = (dev: Esp32Device) => {
    setProvisioningDevice(dev);
    setProvSsid(dev.wifiSsid || 'Azienda_WiFi_IoT');
    setProvPassword('');
    setProvStaticIp(dev.ipAddress || '192.168.1.145');
  };

  // Submit WiFi Provisioning
  const handleSubmitProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provisioningDevice) return;
    setIsProvisioning(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(provisioningDevice.macAddress)}/provision-wifi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ssid: provSsid.trim(),
          password: provPassword,
          staticIp: provStaticIp.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || `Provisioning Wi-Fi completato per ${provisioningDevice.macAddress}!`);
        setProvisioningDevice(null);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore durante il provisioning', 'error');
      }
    } catch {
      showToast('Errore di comunicazione col dispositivo', 'error');
    } finally {
      setIsProvisioning(false);
    }
  };

  // Delete Device
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(deviceToDelete.macAddress)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Modulo GB-CLOUD [${deviceToDelete.macAddress}] eliminato`);
        setDeviceToDelete(null);
        await fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Errore eliminazione modulo', 'error');
      }
    } catch {
      showToast('Errore di rete', 'error');
    }
  };

  // Quick Pair Device to Machine
  const handleQuickPairSubmit = async (macAddress: string | null) => {
    if (!quickPairMachine) return;
    try {
      const res = await fetch(`/api/machines/${quickPairMachine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedDeviceMac: macAddress }),
      });

      if (res.ok) {
        showToast(macAddress ? `Modulo [${macAddress}] abbinato a '${quickPairMachine.name}'` : 'Modulo GB-CLOUD scollegato dal distributore');
        setQuickPairMachine(null);
        await fetchData();
      } else {
        showToast('Errore durante l\'abbinamento', 'error');
      }
    } catch {
      showToast('Errore di connessione', 'error');
    }
  };

  // Filtered lists
  const filteredMachines = machines.filter((m) => {
    const loc = m.locationDetails;
    const matchQuery =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.serialNumber && m.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.assignedDeviceMac && m.assignedDeviceMac.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.electronicBoard && m.electronicBoard.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc && loc.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc && loc.site.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (loc && loc.city.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ONLINE' && (m.status === 'ONLINE' || m.status === 'DISPENSING')) ||
      m.status === statusFilter;

    return matchQuery && matchStatus;
  });

  const filteredDevices = devices.filter((d) => {
    const matchQuery =
      d.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.boardModel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.assignedMachineId && d.assignedMachineId.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ONLINE' && d.status === 'ONLINE') ||
      (statusFilter === 'UNASSIGNED' && d.status === 'UNASSIGNED') ||
      d.status === statusFilter;

    return matchQuery && matchStatus;
  });

  const totalOnlineMachines = machines.filter((m) => m.status === 'ONLINE' || m.status === 'DISPENSING').length;
  const totalDispenses = machines.reduce((acc, m) => acc + (m.supplies?.totalDispenses || 0), 0);
  const totalDevicesOnline = devices.filter((d) => d.status === 'ONLINE').length;
  const totalSpareDevices = devices.filter((d) => !d.assignedMachineId).length;

  return (
    <div id="fleet-manager-container" className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl flex items-center gap-3 text-sm font-medium animate-in fade-in slide-in-from-top-4 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-emerald-900/30'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40 shadow-rose-900/30'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Banner & Stats */}
      <div className={`rounded-3xl p-6 border transition-all duration-200 relative overflow-hidden ${
        isLight
          ? 'bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border-slate-200 shadow-sm'
          : 'bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-indigo-950/40 border-blue-500/20 backdrop-blur-md shadow-xl'
      }`}>
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
          isLight ? 'bg-blue-100/60' : 'bg-blue-600/10'
        }`}></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-lg ${
                isLight
                  ? 'bg-blue-100/80 border-blue-200 text-blue-700 shadow-blue-500/10'
                  : 'bg-blue-500/20 border-blue-400/30 text-blue-400 shadow-blue-500/10'
              }`}>
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h2 className={`text-xl sm:text-2xl font-bold tracking-tight ${
                  isLight ? 'text-slate-900' : 'text-white'
                }`}>
                  Gestione Distributori &amp; Impianti
                </h2>
                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-blue-300/90'}`}>
                  Monitoraggio della flotta distributori bevande, associazione clienti, sedi operative e stato erogazioni.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="refresh-fleet-btn"
              onClick={fetchData}
              disabled={isLoading}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Aggiorna Dati</span>
            </button>

            {activeTab === 'machines' && (
              <button
                id="export-machines-csv-btn"
                onClick={handleExportMachinesCsv}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
                title="Esporta anagrafica e stato macchine in formato CSV con codifica Excel UTF-8"
              >
                <Download className="w-4 h-4 text-emerald-500" />
                <span>Esporta CSV</span>
              </button>
            )}

            {activeTab === 'devices' && (
              <button
                id="discover-devices-btn"
                onClick={handleRunDiscovery}
                disabled={isDiscovering}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                    : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                }`}
                title="Esegui scansione per rilevare moduli connessi nella rete"
              >
                <Compass className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'} ${isDiscovering ? 'animate-spin' : ''}`} />
                <span>{isDiscovering ? 'Scansione in corso...' : 'Rileva Moduli in Rete'}</span>
              </button>
            )}

            {activeTab === 'machines' ? (
              <button
                id="add-machine-btn"
                onClick={handleOpenAddMachine}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuovo Distributore</span>
              </button>
            ) : (
              <button
                id="add-device-btn"
                onClick={handleOpenAddDevice}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuovo Modulo Hardware</span>
              </button>
            )}
          </div>
        </div>

        {/* Fleet KPI Grid - Operator Friendly */}
        <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t ${
          isLight ? 'border-slate-200/80' : 'border-white/10'
        }`}>
          <div className={`rounded-2xl p-3.5 border transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-black/30 border-white/5'
          }`}>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Distributori Flotta</div>
            <div className={`text-2xl font-bold mt-1 font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{machines.length}</div>
            <div className={`text-[11px] mt-0.5 font-medium flex items-center gap-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{totalOnlineMachines} operativi &amp; in linea</span>
            </div>
          </div>
          <div className={`rounded-2xl p-3.5 border transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-black/30 border-white/5'
          }`}>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Clienti Associati</div>
            <div className={`text-2xl font-bold mt-1 font-mono flex items-center gap-2 ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
              <Building2 className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              {machines.filter((m) => Boolean(m.customerId)).length}
            </div>
            <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Impianti collocati presso sedi</div>
          </div>
          <div className={`rounded-2xl p-3.5 border transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-black/30 border-white/5'
          }`}>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Erogazioni Totali</div>
            <div className={`text-2xl font-bold mt-1 font-mono ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>{totalDispenses}</div>
            <div className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Dosi servite registrate</div>
          </div>
          <div className={`rounded-2xl p-3.5 border transition-all ${
            isLight ? 'bg-white border-slate-200 shadow-sm hover:border-slate-300' : 'bg-black/30 border-white/5'
          }`}>
            <div className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Taratura &amp; Consumi</div>
            <div className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
              <Scale className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
              <span>{machines.filter((m) => Boolean(m.enableCalibrationAndConsumption ?? m.config?.enableCalibrationAndConsumption)).length} Impianti Attivi</span>
            </div>
            <div className={`text-[11px] mt-0.5 font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Monitoraggio grammature</div>
          </div>
        </div>
      </div>

      {/* Navigation View Switcher (Macchine vs Dispositivi ESP32) */}
      <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 border rounded-2xl p-2.5 transition-all ${
        isLight
          ? 'bg-white border-slate-200 shadow-sm'
          : 'bg-white/5 border-white/10 backdrop-blur-md'
      }`}>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('machines')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'machines'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Distributori &amp; Impianti ({machines.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Moduli Hardware ({devices.length})</span>
          </button>
          <button
            id="tab-calibration-btn"
            onClick={() => setActiveTab('calibration')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'calibration'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : isLight
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>Taratura &amp; Consumi</span>
          </button>
        </div>

        {/* Filter & Search */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
              isLight ? 'text-slate-400' : 'text-slate-400'
            }`} />
            <input
              type="text"
              placeholder={activeTab === 'machines' ? "Cerca matricola, gestore, città, PLC..." : "Cerca MAC address, board, IP..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500/50 transition-all ${
                isLight
                  ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white'
                  : 'bg-black/40 border-white/10 text-white placeholder-slate-500'
              }`}
            />
          </div>

          <div className="flex items-center gap-1">
            {['ALL', 'ONLINE', activeTab === 'machines' ? 'STANDBY' : 'UNASSIGNED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  statusFilter === st
                    ? isLight
                      ? 'bg-slate-800 text-white'
                      : 'bg-white/20 text-white'
                    : isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400'
                }`}
              >
                {st === 'ALL' ? 'Tutti' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DISTRIBUTORI BEVANDE (FLEET VIEW WITH LOCATION & SERIAL NUMBER) */}
      {/* ========================================================================= */}
      {activeTab === 'machines' && (
        <>
          {filteredMachines.length === 0 ? (
            <div className={`p-12 text-center border rounded-3xl space-y-4 ${
              isLight ? 'bg-white border-slate-200 shadow-sm text-slate-800' : 'bg-slate-900/60 border-white/10 text-slate-200'
            }`}>
              <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/20 text-blue-400'
              }`}>
                <Server className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold">
                  {machines.length === 0 ? 'Nessun distributore presente (Partenza da zero)' : 'Nessun distributore corrisponde ai filtri'}
                </h3>
                <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  {machines.length === 0
                    ? 'Tutti gli impianti generati automaticamente sono stati eliminati. Il sistema è ora pulito e pronto: clicca sul pulsante per registrare il tuo primo distributore reale.'
                    : 'Modifica i parametri di ricerca o il filtro per visualizzare gli altri distributori.'}
                </p>
              </div>
              {machines.length === 0 && (
                <button
                  onClick={handleOpenAddMachine}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Registra Primo Impianto / Distributore</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredMachines.map((m) => {
            const isDispensing = m.status === 'DISPENSING';
            const isOnline = m.status === 'ONLINE' || isDispensing;

            const loc = m.locationDetails;
            const cleanMac = m.assignedDeviceMac ? m.assignedDeviceMac.trim().toUpperCase() : null;
            const pairedDevice = m.assignedDevice || (cleanMac ? devices.find((d) => d.macAddress?.trim().toUpperCase() === cleanMac) : null);

            const matchedCustomer = customers.find((c) => c.id === m.customerId) 
              || (loc?.company ? customers.find((c) => c.name.toLowerCase() === loc.company.toLowerCase()) : null);
            const matchedSite = matchedCustomer?.sites?.find((s) => s.id === m.customerSiteId)
              || matchedCustomer?.sites?.find((s) => s.name.toLowerCase() === (loc?.site || '').toLowerCase());

            return (
              <div
                key={m.id}
                id={`machine-card-${m.id}`}
                className={`border rounded-3xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between space-y-4 relative group ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-slate-200/50 hover:border-blue-300 hover:shadow-md'
                    : 'bg-gradient-to-b from-[#131d33] to-[#0f172a] border-white/10 hover:border-blue-500/40 shadow-xl'
                }`}
              >
                {/* Header: Name, Serial Number, Status, Actions */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      {/* Serial Number & ID Badge */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Serial Number Badge */}
                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 border ${
                          isLight
                            ? 'text-amber-800 bg-amber-50 border-amber-300'
                            : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                        }`}>
                          <Hash className={`w-3 h-3 ${isLight ? 'text-amber-600' : 'text-amber-400'}`} />
                          Matr. #{m.serialNumber || 'N/D'}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                          isLight
                            ? 'text-teal-700 bg-teal-50 border-teal-200'
                            : 'text-teal-300 bg-teal-500/15 border-teal-500/30'
                        }`}>
                          {m.model || 'Ristosano'}
                        </span>
                        {matchedCustomer && (
                          <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                            isLight
                              ? 'text-cyan-800 bg-cyan-50 border-cyan-300'
                              : 'text-cyan-300 bg-cyan-950/50 border-cyan-800/60'
                          }`}>
                            {matchedCustomer.code}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            isDispensing
                              ? isLight
                                ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : isOnline
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isLight
                              ? 'bg-slate-100 text-slate-600 border-slate-300'
                              : 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isDispensing ? 'bg-amber-500 animate-ping' : isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          ></span>
                          {isOnline ? 'In linea' : 'Disconnesso'}
                        </span>

                        {/* Calibration & Consumption Mode Badge with Quick Toggle */}
                        {(() => {
                          const isCalEnabled = Boolean(m.enableCalibrationAndConsumption ?? m.config?.enableCalibrationAndConsumption);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickToggleCalibrationMode(m);
                              }}
                              title={`Clicca per ${isCalEnabled ? 'disabilitare la taratura (torna a sola battuta)' : 'abilitare la gestione taratura e consumi'}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                                isCalEnabled
                                  ? isLight
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                                  : isLight
                                    ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                                    : 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25'
                              }`}
                            >
                              {isCalEnabled ? (
                                <>
                                  <Scale className="w-2.5 h-2.5" />
                                  Taratura &amp; Consumi
                                </>
                              ) : (
                                <>
                                  <Activity className="w-2.5 h-2.5" />
                                  Sola Battuta
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>

                      <h3 className={`text-base font-bold mt-1.5 transition-colors line-clamp-1 ${
                        isLight ? 'text-slate-900 group-hover:text-blue-600' : 'text-white group-hover:text-blue-300'
                      }`}>
                        {m.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditMachine(m)}
                        title="Modifica ubicazione e parametri"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                            : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setMachineToDelete(m)}
                        title="Elimina distributore"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                          isLight
                            ? 'bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600'
                            : 'bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Complete Location Box */}
                  <div className={`rounded-2xl p-3 space-y-1.5 text-xs border ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                  }`}>
                    <div className="flex items-center justify-between font-semibold">
                      <span className={`flex items-center gap-1.5 truncate ${
                        isLight ? 'text-blue-700' : 'text-blue-300'
                      }`}>
                        <Building2 className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                        {matchedCustomer ? (
                          <span className="truncate flex items-center gap-1.5">
                            <span className="truncate">{matchedCustomer.name}</span>
                          </span>
                        ) : (
                          <span className="truncate">{loc?.company || 'Società di Ristorazione'}</span>
                        )}
                      </span>
                      <span className={`text-[11px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {loc?.city ? `${loc.city} (${loc.province || 'IT'})` : ''}
                      </span>
                    </div>

                    <div className="text-[11px] space-y-0.5 font-mono">
                      <div className={`flex items-center gap-1 truncate ${isLight ? 'text-slate-700 font-medium' : 'text-slate-300'}`}>
                        <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                        <span className="truncate">{matchedSite?.name || loc?.site || 'Sede Principale'} &bull; {loc?.floorRoom || loc?.address || m.location}</span>
                      </div>
                      {loc?.address && (
                        <div className={`text-[10px] truncate pl-4 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                          {loc.address}, {loc.zipCode} {loc.city}
                        </div>
                      )}
                    </div>

                    {(loc?.notes || m.notes) && (
                      <div className={`text-[10px] rounded-lg px-2 py-1 flex items-start gap-1 border ${
                        isLight
                          ? 'text-amber-800 bg-amber-50 border-amber-200'
                          : 'text-amber-300/80 bg-amber-500/5 border-amber-500/10'
                      }`}>
                        <FileText className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{loc?.notes || m.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hardware Node & Pairing info - Operator Clean */}
                <div className={`rounded-2xl p-3 text-[11px] space-y-2 border ${
                  isLight
                    ? 'bg-blue-50/50 border-blue-200'
                    : 'bg-blue-950/30 border-blue-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 font-semibold ${
                      isLight ? 'text-blue-800' : 'text-blue-300'
                    }`}>
                      <Radio className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                      Modulo Hardware
                    </span>
                    <button
                      onClick={() => setQuickPairMachine(m)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                        isLight
                          ? 'text-blue-800 bg-white hover:bg-blue-100 border-blue-300'
                          : 'text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30'
                      }`}
                    >
                      <Link className="w-2.5 h-2.5" />
                      {m.assignedDeviceMac ? 'Cambia Modulo' : 'Collega Modulo'}
                    </button>
                  </div>

                  {m.assignedDeviceMac ? (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5 font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Modulo Collegato</span>
                      </span>
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                        isLight
                          ? 'text-slate-800 bg-white border-slate-300'
                          : 'text-slate-200 bg-slate-900 border-white/10'
                      }`}>
                        {m.assignedDeviceMac}
                      </span>
                    </div>
                  ) : (
                    <div className={`text-[11px] rounded-xl p-2 flex items-center justify-between border ${
                      isLight
                        ? 'text-amber-800 bg-amber-50 border-amber-200'
                        : 'text-amber-400/90 bg-amber-500/10 border-amber-500/20'
                    }`}>
                      <span>Nessun modulo collegato</span>
                      <button
                        onClick={() => setQuickPairMachine(m)}
                        className={`text-[10px] font-bold underline cursor-pointer ${isLight ? 'text-amber-700' : 'text-amber-300'}`}
                      >
                        Associa ora
                      </button>
                    </div>
                  )}
                </div>

                {/* Operator Actions (4 clean buttons: Simula, Prodotti, Taratura, Display Touch) */}
                <div className={`pt-2 border-t grid grid-cols-2 sm:grid-cols-4 gap-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  <button
                    onClick={() => onSelectMachineForSimulation?.(m.id)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                      isLight
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border-blue-500/30'
                    }`}
                    title="Simula o effettua un'erogazione di test"
                  >
                    <Play className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    <span>Eroga Prova</span>
                  </button>
                  <button
                    onClick={() => onSelectMachineForKeymap?.(m.id)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                      isLight
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                    }`}
                    title="Configura e assegna i nomi dei prodotti (P1 - P12)"
                  >
                    <Coffee className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                    <span>Prodotti</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCalibrationMachineId(m.id);
                      setActiveTab('calibration');
                    }}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                      isLight
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="Taratura dosaggi, grammature coclee e consumi"
                  >
                    <Scale className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <span>Taratura</span>
                  </button>
                  <button
                    onClick={() => onSelectMachineForTouchPanel?.(m.id)}
                    className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition-all hover:scale-[1.02] cursor-pointer ${
                      isLight
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="Apri l'interfaccia Touch 10.1 per il distributore"
                  >
                    <Tablet className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
                    <span>Touch 10.1&quot;</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  )}

      {/* ========================================================================= */}
      {/* TAB 2: DISPOSITIVI ESP32 (HARDWARE NODES INVENTORY & MAC MANAGEMENT) */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-5">
          {/* WATCHDOG & HEARTBEAT TUNING CONTROLS */}
          <div className={`rounded-3xl p-5 border shadow-xl transition-all duration-200 ${
            isLight
              ? 'bg-white border-slate-200 shadow-slate-200/50'
              : 'bg-gradient-to-r from-cyan-950/60 via-slate-900/90 to-blue-950/60 border-cyan-500/30 shadow-2xl backdrop-blur-md'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${
                    isLight
                      ? 'bg-cyan-50 border-cyan-200 text-cyan-600'
                      : 'bg-cyan-500/20 border-cyan-400/40 text-cyan-400'
                  }`}>
                    <Activity className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold flex items-center gap-2 ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      Watchdog Heartbeat &amp; Riconoscimento Stato Online/Offline
                      <span className={`text-[10px] font-mono border px-2 py-0.5 rounded-full font-semibold ${
                        isLight
                          ? 'bg-slate-100 text-slate-800 border-slate-300'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}>
                        Soglia Attiva: {heartbeatTimeoutSec}s
                      </span>
                    </h3>
                    <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Il server controlla i moduli ogni 3 secondi. Se un Modulo non invia ping per oltre <strong className={isLight ? 'text-slate-900 font-semibold' : 'text-white'}>{heartbeatTimeoutSec}s</strong> o invia il segnale MQTT Last-Will, passa istantaneamente a <strong>OFFLINE</strong>.
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Protezione Rete Attiva: Auto-creazione da broker pubblico disabilitata. I moduli si aggiungono solo manualmente.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMEOUT PRESETS & VERIFY ACTIONS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex items-center gap-1 border p-1 rounded-2xl ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-black/40 border-white/10'
                }`}>
                  <span className={`text-[10px] px-2 font-semibold ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Taratura Timeout:</span>
                  {[
                    { sec: 15, label: '15s (Istantaneo)' },
                    { sec: 30, label: '30s (Veloce)' },
                    { sec: 45, label: '45s (Consigliato)' },
                    { sec: 60, label: '60s (Standard)' },
                    { sec: 120, label: '120s' },
                  ].map((preset) => (
                    <button
                      key={preset.sec}
                      onClick={() => handleUpdateHeartbeatTimeout(preset.sec)}
                      disabled={isUpdatingTimeout}
                      className={`text-xs px-2.5 py-1.5 rounded-xl font-mono font-semibold transition-all ${
                        heartbeatTimeoutSec === preset.sec
                          ? 'bg-blue-600 text-white shadow-md font-bold'
                          : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-white'
                          : 'text-slate-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleForceCheckStatus}
                  disabled={isCheckingStatus}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border text-xs font-semibold transition-all hover:scale-[1.02] ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300 shadow-sm'
                      : 'bg-white/10 hover:bg-white/15 text-slate-200 border-white/10'
                  }`}
                  title="Forza il controllo immediato della reattività di tutti i Moduli GB-CLOUD"
                >
                  <Activity className={`w-3.5 h-3.5 text-blue-600 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>{isCheckingStatus ? 'Verifica...' : 'Verifica Moduli Adesso'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* DEVICE CARDS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDevices.map((dev) => {
            const isAssigned = !!dev.assignedMachineId;
            const pairedMachine = dev.assignedMachineId
              ? machines.find((m) => m.id?.trim().toUpperCase() === dev.assignedMachineId?.trim().toUpperCase())
              : null;
            const isTestingOpto = testingOptoMac === dev.macAddress;
            const isPinging = pingingMac === dev.macAddress;
            const isToggling = togglingStatusMac === dev.macAddress;
            const hbInfo = getHeartbeatAge(dev.lastHeartbeatAt);

            return (
              <div
                key={dev.macAddress}
                id={`device-card-${dev.macAddress.replace(/:/g, '')}`}
                className={`border rounded-3xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between space-y-4 relative group ${
                  isLight
                    ? 'bg-white border-slate-200 shadow-slate-200/50 hover:border-cyan-300 hover:shadow-md'
                    : 'bg-gradient-to-b from-[#131d33] to-[#0f172a] border-cyan-500/20 hover:border-cyan-400/50 shadow-xl'
                }`}
              >
                <div className="space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm border ${
                          isLight
                            ? 'text-cyan-900 bg-cyan-50 border-cyan-200'
                            : 'text-cyan-300 bg-cyan-950/80 border-cyan-400/30'
                        }`}>
                          {dev.macAddress}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            dev.status === 'ONLINE'
                              ? isLight
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : isAssigned
                              ? isLight
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : isLight
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              dev.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : isAssigned ? 'bg-rose-500' : 'bg-amber-500'
                            }`}
                          ></span>
                          {isAssigned ? dev.status : 'DI SCORTA (LIBERO)'}
                        </span>
                      </div>
                      <h3 className={`text-base font-bold mt-1.5 flex items-center gap-1.5 ${
                        isLight ? 'text-slate-900' : 'text-white'
                      }`}>
                        <Radio className={`w-4 h-4 ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                        {dev.deviceId}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handlePingHeartbeat(dev.macAddress, dev.deviceId)}
                        disabled={isPinging}
                        title="Invia ping diagnostico heartbeat immediato"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isLight
                            ? 'bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700'
                            : 'bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300'
                        }`}
                      >
                        <Activity className={`w-4 h-4 ${isPinging ? 'animate-spin text-emerald-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleOpenEditDevice(dev)}
                        title="Modifica parametri Modulo"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                            : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeviceToDelete(dev)}
                        title="Elimina modulo"
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isLight
                            ? 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600'
                            : 'bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* REAL-TIME HEARTBEAT STATUS BAR */}
                  <div className={`flex items-center justify-between border rounded-2xl px-3 py-2 text-xs ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${hbInfo.isFresh ? 'bg-emerald-500 animate-ping' : 'bg-rose-500'}`} />
                      <span className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Ultimo Ping / Heartbeat:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${
                        hbInfo.isFresh
                          ? isLight ? 'text-emerald-700 font-extrabold' : 'text-emerald-300 font-extrabold'
                          : isLight ? 'text-rose-700' : 'text-rose-300'
                      }`}>
                        {hbInfo.text}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold tracking-wide uppercase ${
                        dev.status === 'ONLINE'
                          ? isLight
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                          : isAssigned
                          ? isLight
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
                          : isLight
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-amber-950/60 text-amber-300 border-amber-700/60'
                      }`}>
                        ● Stato Reale: {dev.status}
                      </span>
                    </div>
                  </div>

                  {/* Device Specs & Network */}
                  <div className={`border rounded-2xl p-3 text-xs space-y-2 font-mono ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                  }`}>
                    <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>Modello Scheda:</span>
                      <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>{dev.boardModel}</span>
                    </div>
                    <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>Optoisolamento:</span>
                      <span className={`font-bold px-1.5 py-0.5 rounded border ${
                        isLight
                          ? 'text-amber-800 bg-amber-50 border-amber-200'
                          : 'text-amber-300 bg-amber-500/10 border-amber-500/20'
                      }`}>
                        {dev.hardwareConfig?.voltageLevel === '24v_opto' ? '24V DC Opto (Distributore)' : dev.hardwareConfig?.voltageLevel === '12v_opto' ? '12V DC Opto' : '3.3V Diretto'}
                      </span>
                    </div>
                    <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span className="flex items-center gap-1">
                        <Wifi className={`w-3 h-3 ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                        IP &amp; WiFi:
                      </span>
                      <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>{dev.ipAddress} ({dev.wifiSsid})</span>
                    </div>
                    <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>GPIO Opto Out:</span>
                      <span className={`font-semibold ${isLight ? 'text-cyan-800' : 'text-cyan-300'}`}>
                        {dev.hardwareConfig?.optoOutputPins?.join(', ') || '19, 21, 22, 23'} ({dev.hardwareConfig?.optoTriggerDurationMs || 400}ms)
                      </span>
                    </div>
                    <div className={`flex items-center justify-between ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>Firmware:</span>
                      <span className={isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400'}>{dev.firmwareVersion}</span>
                    </div>

                    {/* Real-time Hardware Telemetry Bar */}
                    <div className={`pt-2 border-t grid grid-cols-3 gap-2 text-[10px] ${
                      isLight ? 'border-slate-200' : 'border-white/5'
                    }`}>
                      <div className={`p-1.5 rounded-lg text-center ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5'}`}>
                        <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Free Heap</span>
                        <span className={`font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-300'}`}>
                          {dev.telemetry?.freeHeap ? `${Math.round(dev.telemetry.freeHeap / 1024)} KB` : (dev.freeHeap ? `${Math.round(dev.freeHeap / 1024)} KB` : '234 KB')}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-lg text-center ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5'}`}>
                        <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Temp Caldaia</span>
                        <span className={`font-bold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                          {dev.telemetry?.boilerTemp ? `${dev.telemetry.boilerTemp.toFixed(1)}°C` : '93.2°C'}
                        </span>
                      </div>
                      <div className={`p-1.5 rounded-lg text-center ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5'}`}>
                        <span className={`block text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Uptime</span>
                        <span className={`font-bold ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                          {dev.telemetry?.uptimeSec ? `${Math.floor(dev.telemetry.uptimeSec / 3600)}h ${Math.floor((dev.telemetry.uptimeSec % 3600) / 60)}m` : (dev.uptimeSec ? `${Math.floor(dev.uptimeSec / 3600)}h ${Math.floor((dev.uptimeSec % 3600) / 60)}m` : '12h 45m')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Assignment Status Box */}
                  <div className={`border rounded-2xl p-3 text-xs space-y-1.5 ${
                    isLight ? 'bg-blue-50/40 border-blue-200' : 'bg-slate-900/60 border-white/10'
                  }`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      Associazione Distributore Bevande
                    </div>
                    {isAssigned && pairedMachine ? (
                      <div className="space-y-1">
                        <div className={`flex items-center justify-between font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                          <span className="truncate">{pairedMachine.name}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                            isLight
                              ? 'text-amber-800 bg-amber-100 border-amber-300'
                              : 'text-amber-400 bg-amber-500/10'
                          }`}>
                            {pairedMachine.serialNumber}
                          </span>
                        </div>
                        <div className={`text-[11px] flex items-center gap-1 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          <Building2 className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                          <span className="truncate">{pairedMachine.locationDetails?.company} &bull; {pairedMachine.locationDetails?.site}</span>
                        </div>
                      </div>
                    ) : (
                      <div className={`py-2 px-2.5 rounded-xl border flex items-start gap-2 ${
                        isLight
                          ? 'bg-amber-50 border-amber-200/80 text-amber-950'
                          : 'bg-amber-500/10 border-amber-500/20 text-amber-200'
                      }`}>
                        <Radio className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" />
                        <div className="text-[11px] leading-tight space-y-0.5">
                          <div className="font-bold flex items-center gap-1">
                            <span>Modulo Standalone (Libero)</span>
                          </div>
                          <p className="opacity-90">
                            Le battute ricevute da questo modulo vengono registrate in tempo reale come <strong>Pulsante 1, Pulsante 2, ...</strong> finché non viene abbinato a un distributore dal portale.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {dev.notes && (
                    <div className={`text-[10px] border rounded-xl px-2.5 py-1.5 ${
                      isLight ? 'text-slate-600 bg-slate-50 border-slate-200' : 'text-slate-400 bg-white/5 border-white/5'
                    }`}>
                      {dev.notes}
                    </div>
                  )}
                </div>

                {/* Device Actions */}
                <div className={`pt-2 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                  {/* Standalone Collaudo Banco Trigger Button */}
                  <button
                    onClick={() => {
                      setBenchTestDevice(dev);
                      setBenchTestRecentResult(null);
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                      isLight
                        ? 'bg-gradient-to-r from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 text-emerald-800 border-emerald-300'
                        : 'bg-gradient-to-r from-emerald-950/50 to-teal-950/50 hover:from-emerald-900/60 hover:to-teal-900/60 text-emerald-300 border-emerald-500/30'
                    }`}
                    title="Collauda i tasti della matrice (P1..P12, STOP, CARAFFA, LINGUA) senza alcuna macchina associata"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    <span>🧪 Collaudo Banco (Test Tasti Matrice)</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleTestOptoTrigger(dev.macAddress, dev.hardwareConfig?.optoOutputPins?.[0] || 19, dev.hardwareConfig?.optoTriggerDurationMs || 400)}
                      disabled={isTestingOpto}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        isLight
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                      }`}
                      title="Simula un impulso su uscita optoisolata GPIO 19"
                    >
                      <Flame className={`w-3.5 h-3.5 ${isTestingOpto ? 'animate-bounce text-amber-500' : 'text-amber-500'}`} />
                      <span>{isTestingOpto ? 'Trigger...' : 'Test Opto'}</span>
                    </button>

                    <button
                      onClick={() => handleOpenProvisioning(dev)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        isLight
                          ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/30'
                      }`}
                      title="Provisioning Wi-Fi guidato e assegnazione IP statico"
                    >
                      <Wifi className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                      <span>Provisioning WiFi</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDiagnosticsDevice(dev)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                        isLight
                          ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border-teal-200'
                          : 'bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border-teal-500/30'
                      }`}
                      title="Apri log diagnostici, heap memory e metriche di stato"
                    >
                      <Terminal className={`w-3.5 h-3.5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
                      <span>Log Diagnostici</span>
                    </button>

                    {isAssigned ? (
                      <button
                        onClick={async () => {
                          await fetch(`/api/devices/${encodeURIComponent(dev.macAddress)}/pair`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ machineId: null }),
                          });
                          showToast(`Modulo [${dev.macAddress}] scollegato e reso disponibile come scorta`);
                          await fetchData();
                        }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          isLight
                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                        }`}
                        title="Scollega da distributore"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>Scollega</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenEditDevice(dev)}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          isLight
                            ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border-cyan-300'
                            : 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border-cyan-500/30'
                        }`}
                        title="Associa a una macchina"
                      >
                        <Link className="w-3.5 h-3.5" />
                        <span>Assegna</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TARATURA DOSAGGI, GRAMMATURE & RICONCILIAZIONE MERCE CONSEGNATA */}
      {/* ========================================================================= */}
      {activeTab === 'calibration' && (
        <MachineCalibrationView
          machines={machines}
          selectedMachineId={selectedCalibrationMachineId || (machines.length > 0 ? machines[0].id : '')}
          onMachineChange={setSelectedCalibrationMachineId}
          onRefreshMachines={fetchData}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURAZIONE COMPLETA DISTRIBUTORE (MATRICOLA, UBICAZIONE, HW) */}
      {/* ========================================================================= */}
      {showMachineModal && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/15 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shadow-md ${
                  isLight
                    ? 'bg-blue-100/80 border-blue-200 text-blue-700'
                    : 'bg-blue-500/20 border-blue-400/30 text-blue-400'
                }`}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {editingMachine ? `Modifica Distributore: ${editingMachine.name}` : 'Nuovo Distributore nella Flotta'}
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Matricola (6 cifre), ubicazione dettagliata, scheda elettronica e associazione Modulo GB-CLOUD
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMachineModal(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMachine} className="space-y-5">
              {/* SECTION 1: Identificazione & Matricola */}
              <div className={`space-y-3 border rounded-2xl p-4 ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-black/30 border-white/10'
              }`}>
                <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  isLight ? 'text-blue-600' : 'text-blue-400'
                }`}>
                  <Hash className="w-3.5 h-3.5" />
                  1. Dati Identificativi &amp; Modello Distributore
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={`block text-xs font-semibold flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        <span>Numero di Matricola <span className="text-amber-500 font-normal">(6 Cifre) *</span></span>
                        {editingMachine && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                            <Lock className="w-2.5 h-2.5" /> Bloccata
                          </span>
                        )}
                      </label>
                      {!editingMachine && (
                        <button
                          type="button"
                          onClick={() => {
                            const newSerial = String(Math.floor(100000 + Math.random() * 900000));
                            setFormSerialNumber(newSerial);
                            setFormId(`GB-DIST-${newSerial}`);
                          }}
                          className={`text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
                            isLight
                              ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                              : 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20'
                          }`}
                          title="Genera matricola a 6 cifre casuale"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Genera 6 Cifre
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        readOnly={!!editingMachine}
                        disabled={!!editingMachine}
                        maxLength={6}
                        pattern="[0-9]{6}"
                        placeholder="104829"
                        value={formSerialNumber}
                        onChange={(e) => {
                          if (editingMachine) return;
                          const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                          setFormSerialNumber(val);
                          setFormId(`GB-DIST-${val}`);
                        }}
                        className={`w-full border rounded-xl px-3 py-2 text-sm font-mono tracking-wider focus:outline-none ${
                          editingMachine
                            ? (isLight
                                ? 'bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed shadow-inner'
                                : 'bg-black/60 border-white/10 text-slate-400 cursor-not-allowed')
                            : (isLight
                                ? 'bg-white border-amber-400 text-amber-900 focus:border-amber-500 shadow-sm'
                                : 'bg-black/50 border-amber-500/40 text-amber-300 focus:border-amber-400')
                        }`}
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold flex items-center gap-1">
                        {editingMachine ? (
                          <span className={`text-[10px] font-medium flex items-center gap-1 px-1.5 py-0.5 rounded ${
                            isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'
                          }`}>
                            <Lock className="w-3 h-3 text-amber-500" /> Immutabile
                          </span>
                        ) : formSerialNumber.length === 6 ? (
                          <span className={`${isLight ? 'text-emerald-600' : 'text-emerald-400'} flex items-center gap-0.5`}>
                            <CheckCircle2 className="w-3 h-3" /> 6/6
                          </span>
                        ) : (
                          <span className={isLight ? 'text-amber-600' : 'text-amber-400/80'}>
                            {formSerialNumber.length}/6
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`text-[10px] mt-1 flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {editingMachine ? (
                        <>
                          <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>La matricola identifica in modo univoco e permanente l&apos;impianto: <strong>non può essere modificata</strong> una volta creata.</span>
                        </>
                      ) : (
                        'Identificativo matricolare obbligatorio a 6 cifre (es. 104829)'
                      )}
                    </p>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      ID Macchina (Sistema)
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingMachine}
                      value={formId}
                      onChange={(e) => setFormId(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none disabled:opacity-60 ${
                        isLight
                          ? 'bg-white border-slate-300 text-blue-700 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-blue-300 focus:border-blue-500'
                      }`}
                    />
                    <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Formato standard: GB-DIST-{formSerialNumber || 'matricola'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Nome Distributore / Impianto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Es. Distributore 01: Sede Centrale - Bar & Reception"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Modello Macchina
                    </label>
                    <select
                      value={formModel}
                      onChange={(e) => {
                        const newModel = e.target.value;
                        setFormModel(newModel);
                        if (newModel === 'Ristosano') setFormElectronicBoard('Scheda Controller Ristosano');
                        else if (newModel === 'Big 5') setFormElectronicBoard('Scheda Controller Big 5');
                        else if (newModel === 'Asia') setFormElectronicBoard('Scheda Controller Asia');
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    >
                      <option value="Ristosano">Ristosano</option>
                      <option value="Big 5">Big 5</option>
                      <option value="Asia">Asia</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Scheda Elettronica Erogatore
                    </label>
                    <select
                      value={formElectronicBoard}
                      onChange={(e) => setFormElectronicBoard(e.target.value)}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    >
                      <option value="Scheda Controller Ristosano">Scheda Controller Ristosano</option>
                      <option value="Scheda Controller Big 5">Scheda Controller Big 5</option>
                      <option value="Scheda Controller Asia">Scheda Controller Asia</option>
                      <option value="Scheda Elettronica Optoisolata Custom">Scheda Elettronica Optoisolata Custom</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Modulo GB-CLOUD Hardware (Opzionale / Facoltativo) */}
              <div className={`space-y-3 border rounded-2xl p-4 ${
                isLight ? 'bg-cyan-50/50 border-cyan-200' : 'bg-black/30 border-cyan-500/20'
              }`}>
                <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isLight ? 'text-cyan-800' : 'text-cyan-300'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Radio className={`w-3.5 h-3.5 ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                    2. Modulo Hardware GB-CLOUD (Opzionale)
                  </span>
                  {formAssignedMac ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                      isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                    }`}>
                      Modulo Selezionato
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                      isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-white/5 text-slate-300 border border-white/10'
                    }`}>
                      Nessun Modulo (Assegnabile in seguito)
                    </span>
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Collega Modulo GB-CLOUD (Facoltativo)
                  </label>
                  <select
                    value={formAssignedMac}
                    onChange={(e) => setFormAssignedMac(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-slate-200 focus:border-blue-400'
                    }`}
                  >
                    <option value="">-- Nessun Modulo Hardware (Opzionale: puoi associarlo in seguito) --</option>
                    {devices.map((d) => (
                      <option key={d.macAddress} value={d.macAddress}>
                        [{d.macAddress}] {d.deviceId} (Matr: #{d.serialNumber || 'N/D'}) {d.assignedMachineId && d.assignedMachineId !== formId ? `(In uso su ${d.assignedMachineId})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className={`text-[10px] mt-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    L&apos;associazione a un modulo hardware è completamente facoltativa. Puoi creare il distributore libero (in magazzino o assegnato al cliente) e associare il modulo in qualsiasi momento da questa scheda o dalla lista moduli.
                  </p>
                </div>
              </div>

              {/* SECTION 3: Ubicazione & Associazione Cliente */}
              <div className={`space-y-3.5 border rounded-2xl p-4 ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-black/30 border-white/10'
              }`}>
                <div className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between ${
                  isLight ? 'text-cyan-700' : 'text-cyan-400'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    3. Cliente Associato &amp; Sede Operativa (Opzionale)
                  </span>
                  {formCustomerId ? (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                      isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                    }`}>
                      Cliente &amp; Sede Assegnati
                    </span>
                  ) : (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                      isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                    }`}>
                      In Magazzino (Non Assegnata)
                    </span>
                  )}
                </div>

                {customers.length === 0 ? (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    isLight ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                  }`}>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1.5">
                      <p className="font-semibold">Nessun cliente registrato in archivio.</p>
                      <p className="text-[11px] opacity-90">
                        Puoi salvare il distributore come <em>&quot;In Magazzino / Non Assegnata&quot;</em>, oppure creare prima un cliente nell&apos;Anagrafica Clienti.
                      </p>
                      {onNavigateToCustomers && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowMachineModal(false);
                            onNavigateToCustomers();
                          }}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Vai ad Anagrafica Clienti
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          Cliente Assegnato (Opzionale)
                        </label>
                        <select
                          value={formCustomerId}
                          onChange={(e) => handleSelectCustomer(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                            isLight
                              ? 'bg-white border-blue-400 text-slate-900 focus:border-blue-600 shadow-sm'
                              : 'bg-black/50 border-blue-500/50 text-white focus:border-blue-400'
                          }`}
                        >
                          <option value="">-- Nessun Cliente (Macchina in Magazzino / Stock) --</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              [{c.code}] {c.name} {c.city ? `- ${c.city}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          Sede Operativa Predefinita (Anagrafica)
                        </label>
                        {(() => {
                          const currentSelectedCustomer = customers.find((c) => c.id === formCustomerId);
                          const sites = currentSelectedCustomer?.sites || [];
                          if (sites.length === 0) {
                            return (
                              <input
                                type="text"
                                placeholder={formCustomerId ? "Sede Principale" : "Es. Magazzino Centrale"}
                                value={formSite}
                                onChange={(e) => setFormSite(e.target.value)}
                                className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                                  isLight
                                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                                    : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                                }`}
                              />
                            );
                          }
                          return (
                            <select
                              value={formCustomerSiteId}
                              onChange={(e) => handleSelectSite(e.target.value)}
                              className={`w-full border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none ${
                                isLight
                                  ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                                  : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                              }`}
                            >
                              {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} {s.city ? `(${s.city})` : ''}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Customer Summary Card if selected */}
                    {formCustomerId && (() => {
                      const cust = customers.find((c) => c.id === formCustomerId);
                      if (!cust) return null;
                      return (
                        <div className={`p-2.5 rounded-xl border text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 ${
                          isLight ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-blue-950/20 border-blue-800/40 text-blue-200'
                        }`}>
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-semibold">Codice:</span>
                            <span className="font-mono font-bold">{cust.code}</span>
                          </div>
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-semibold">P.IVA / CF:</span>
                            <span className="font-mono">{cust.vatNumber || cust.taxCode || 'N/D'}</span>
                          </div>
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-semibold">Contatto:</span>
                            <span className="truncate block font-medium">{cust.contactPerson || 'Ufficio Tecnico'}</span>
                          </div>
                          <div>
                            <span className="opacity-70 block text-[10px] uppercase font-semibold">Recapito:</span>
                            <span className="truncate block font-mono">{cust.phone || cust.email || 'N/D'}</span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Sede Operativa / Posizione Impianto personalizzabile */}
                    <div>
                      <label className={`block text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        <span>Nome Sede / Posizione Impianto *</span>
                        <span className="text-[10px] font-normal opacity-70">Personalizzabile per questo distributore</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Es. Sede Centrale - Reparto Produzione"
                        value={formSite}
                        onChange={(e) => setFormSite(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                            : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                      <div className="sm:col-span-2">
                        <label className={`block text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          <span>Indirizzo Posizione / Sede (Via / Piazza)</span>
                          <span className="text-[10px] font-normal opacity-70">Liberamente modificabile</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Es. Via Stephenson 73"
                          value={formAddress}
                          onChange={(e) => setFormAddress(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                              : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          Piano / Area / Stanza
                        </label>
                        <input
                          type="text"
                          placeholder="Es. Piano Terra Atrio"
                          value={formFloorRoom}
                          onChange={(e) => setFormFloorRoom(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                              : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3.5">
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          Città
                        </label>
                        <input
                          type="text"
                          placeholder="Es. Milano"
                          value={formCity}
                          onChange={(e) => setFormCity(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                              : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          CAP
                        </label>
                        <input
                          type="text"
                          placeholder="Es. 20157"
                          value={formZipCode}
                          onChange={(e) => setFormZipCode(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                              : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                          Provincia (Sigla)
                        </label>
                        <input
                          type="text"
                          maxLength={3}
                          placeholder="Es. MI"
                          value={formProvince}
                          onChange={(e) => setFormProvince(e.target.value.toUpperCase())}
                          className={`w-full border rounded-xl px-3 py-2 text-xs font-mono uppercase focus:outline-none ${
                            isLight
                              ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                              : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                        <span>Note sull&apos;Ubicazione, Manutenzione &amp; Referente Tecnico</span>
                        <span className="text-[10px] font-normal opacity-70">Liberamente modificabili</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Es. Referente: Sig. Rossi tel. 02-887711. Manutenzione programmata ogni lunedì. Macchina accessibile 24/7."
                        value={formLocationNotes}
                        onChange={(e) => setFormLocationNotes(e.target.value)}
                        className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none resize-none ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                            : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                        }`}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* SECTION 4: Parametri Tecnici Avanzati (Collassabile per operatore) */}
              <details className={`border rounded-2xl p-4 transition-all group ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-black/30 border-white/10'
              }`}>
                <summary className={`text-xs font-bold uppercase tracking-wider flex items-center justify-between cursor-pointer select-none ${
                  isLight ? 'text-slate-700 hover:text-slate-900' : 'text-slate-300 hover:text-white'
                }`}>
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-500" />
                    4. Parametri Tecnici Erogazione (Avanzato)
                  </span>
                  <span className="text-[10px] font-normal lowercase tracking-normal text-slate-400 group-open:hidden">
                    (clicca per espandere)
                  </span>
                </summary>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200/50">
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Temp Caldaia (°C)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formTargetTemp}
                      onChange={(e) => setFormTargetTemp(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Impulso Opto (ms)</label>
                    <input
                      type="number"
                      step="50"
                      value={formOptoDurationMs}
                      onChange={(e) => setFormOptoDurationMs(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Debounce (ms)</label>
                    <input
                      type="number"
                      value={formDebounceMs}
                      onChange={(e) => setFormDebounceMs(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[11px] font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Mult. Caraffa</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formCaraffaMult}
                      onChange={(e) => setFormCaraffaMult(Number(e.target.value))}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                </div>
              </details>

              {/* SECTION 4b: Taratura Dosaggi & Contenitori (Strettamente collegata alla matricola) */}
              <div className={`space-y-3 border rounded-2xl p-4 ${
                isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/20'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isLight ? 'text-emerald-700' : 'text-emerald-400'
                  }`}>
                    <Scale className="w-3.5 h-3.5" />
                    <span>4b. Taratura di Partenza (Collegata alla Matricola)</span>
                  </div>
                  {editingMachine && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMachineModal(false);
                        setSelectedCalibrationMachineId(editingMachine.id);
                        setActiveTab('calibration');
                      }}
                      className={`text-[11px] font-semibold underline cursor-pointer flex items-center gap-1 ${
                        isLight ? 'text-emerald-700 hover:text-emerald-800' : 'text-emerald-300 hover:text-emerald-200'
                      }`}
                    >
                      <span>Vedi Taratura Completa</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {editingMachine 
                    ? 'La taratura è strettamente associata alla matricola di questa macchina. Per sovrascrivere o ripristinare i parametri con un modello standard collaudato (6 Contenitori e 7 EV), selezionalo qui sotto:'
                    : 'La taratura della macchina è strettamente associata alla matricola. Seleziona il modello standard da cui partire per pre-impostare i 6 contenitori (motori 40/120/200 RPM), le 7 EV (cc/s: una per contenitore + sola acqua calda) e le durate per i 12 tasti:'}
                </p>

                <div className="space-y-2">
                  <select
                    value={formCalibrationTemplateId}
                    onChange={(e) => setFormCalibrationTemplateId(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none ${
                      isLight
                        ? 'bg-white border-emerald-300 text-slate-900 focus:border-emerald-600 shadow-sm'
                        : 'bg-black/50 border-emerald-500/40 text-white focus:border-emerald-400'
                    }`}
                  >
                    {editingMachine && (
                      <option value="">-- Mantieni Taratura Esistente (Nessuna Modifica) --</option>
                    )}
                    {calibrationTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.modelTarget || (tpl as any).targetModel || 'Standard'}) &bull; {tpl.calibration?.canisters?.length || (tpl as any).canisters?.length || 6} Contenitori, {tpl.calibration?.electrovalves?.length || (tpl as any).electrovalves?.length || 7} EV, {tpl.calibration?.standardProducts?.length || (tpl as any).buttons?.length || 12} Tasti
                      </option>
                    ))}
                  </select>

                  {formCalibrationTemplateId && (
                    <div className={`p-2.5 rounded-xl border text-[11px] ${
                      isLight ? 'bg-white border-emerald-200 text-slate-700' : 'bg-black/30 border-emerald-500/20 text-slate-300'
                    }`}>
                      {(() => {
                        const selTpl = calibrationTemplates.find(t => t.id === formCalibrationTemplateId);
                        if (!selTpl) return null;
                        const canCount = selTpl.calibration?.canisters?.length || (selTpl as any).canisters?.length || 6;
                        const evCount = selTpl.calibration?.electrovalves?.length || (selTpl as any).electrovalves?.length || 7;
                        const prodCount = selTpl.calibration?.standardProducts?.length || (selTpl as any).buttons?.length || 12;
                        const caraffaCount = selTpl.calibration?.caraffaProducts?.length || prodCount;
                        return (
                          <div className="space-y-1">
                            <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5" />
                              <span>{selTpl.name}</span>
                            </div>
                            <div className="text-[10px] opacity-80">{selTpl.description}</div>
                            <div className="flex flex-wrap gap-2 pt-1 text-[10px] font-mono">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                {canCount} Contenitori (40/120/200 RPM)
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                                {evCount} Elettrovalvole (cc/s)
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                {prodCount} Tasti Standard + {caraffaCount} Tasti Caraffa
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 4c: Abilitazione Gestione Taratura e Consumi (FLAG SINGOLA MACCHINA) */}
              <div className={`space-y-3 border rounded-2xl p-4 transition-all ${
                formEnableCalibrationAndConsumption
                  ? isLight
                    ? 'bg-emerald-50/70 border-emerald-300'
                    : 'bg-emerald-950/20 border-emerald-500/30'
                  : isLight
                    ? 'bg-slate-50 border-slate-300'
                    : 'bg-slate-900/30 border-slate-700/50'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    formEnableCalibrationAndConsumption
                      ? isLight ? 'text-emerald-700' : 'text-emerald-400'
                      : isLight ? 'text-slate-700' : 'text-slate-300'
                  }`}>
                    <Scale className="w-3.5 h-3.5" />
                    <span>4c. Gestione Taratura &amp; Consumi (Singola Macchina)</span>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnableCalibrationAndConsumption}
                      onChange={(e) => setFormEnableCalibrationAndConsumption(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    <span className={`ml-2.5 text-xs font-bold ${
                      formEnableCalibrationAndConsumption
                        ? isLight ? 'text-emerald-800' : 'text-emerald-300'
                        : isLight ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {formEnableCalibrationAndConsumption ? 'ABILITATA' : 'DISABILITATA'}
                    </span>
                  </label>
                </div>

                <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {formEnableCalibrationAndConsumption
                    ? 'La gestione taratura e consumi è ATTIVA su questo distributore: il sistema calcolerà le grammature per le erogazioni, monitorerà i livelli dei 6 contenitori e gestirà lo scarico merci.'
                    : 'La gestione taratura e consumi è DISABILITATA: la telemetria funziona regolarmente sulle BATTUTE (conteggio erogazioni, matrice tasti P1-P12, totalizzatori, allarmi e orari) senza blocchi o richieste di taratura.'}
                </p>

                <div className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                  formEnableCalibrationAndConsumption
                    ? isLight ? 'bg-emerald-100/60 border-emerald-200 text-emerald-900' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                    : isLight ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                }`}>
                  {formEnableCalibrationAndConsumption ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span><strong>Taratura &amp; Consumi Abilitati:</strong> Calcolo grammi per erogazione e controllo stock.</span>
                    </>
                  ) : (
                    <>
                      <Activity className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span><strong>Sola Rilevazione Battute:</strong> Telemetria sempre garantita e operativa al 100%.</span>
                    </>
                  )}
                </div>
              </div>

              {/* SECTION 5: Configurazione Prodotti Erogati (P1 - P12) */}
              <div className={`space-y-3 border rounded-2xl p-4 ${
                isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-black/30 border-white/10'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isLight ? 'text-amber-700' : 'text-amber-400'
                  }`}>
                    <Coffee className="w-3.5 h-3.5" />
                    <span>5. Configurazione Prodotti Erogati &amp; Assegnazione Nomi (P1 - P12)</span>
                  </div>
                  {editingMachine && onSelectMachineForKeymap && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMachineModal(false);
                        onSelectMachineForKeymap(editingMachine.id);
                      }}
                      className={`text-[11px] font-semibold underline cursor-pointer flex items-center gap-1 ${
                        isLight ? 'text-blue-700 hover:text-blue-800' : 'text-blue-400 hover:text-blue-300'
                      }`}
                    >
                      <span>Apri Programmazione Avanzata Prodotti</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Assegna o personalizza il nome di ciascuna bevanda erogata dai 12 canali (P1 - P12) di questo distributore:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {MATRIX_KEYS.filter((k) => k.isProduct).map((k) => {
                    const currentName = formKeyMapping[k.key] ?? k.defaultProduct;
                    return (
                      <div
                        key={k.key}
                        className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
                          isLight ? 'bg-white border-slate-300 shadow-xs' : 'bg-black/40 border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                              isLight ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {k.key}
                            </span>
                            <span className={isLight ? 'text-slate-900 font-semibold' : 'text-slate-200'}>Slot #{k.productNum}</span>
                          </span>
                          <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{k.wirePins}</span>
                        </div>
                        <input
                          type="text"
                          value={currentName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormKeyMapping((prev) => ({ ...prev, [k.key]: val }));
                          }}
                          placeholder={k.defaultProduct}
                          className={`w-full border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none transition-colors ${
                            isLight
                              ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-amber-600'
                              : 'bg-black/60 border-white/15 text-white focus:border-amber-400'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className={`flex items-center justify-between gap-3 pt-3 border-t ${
                isLight ? 'border-slate-200' : 'border-white/10'
              }`}>
                <div className="text-[11px]">
                  {!formCustomerId ? (
                    <span className={`flex items-center gap-1 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Macchina creata in Magazzino / Stock (senza cliente assegnato)
                    </span>
                  ) : (
                    <span className={`flex items-center gap-1 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Cliente associato correttamente
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowMachineModal(false)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-600/30"
                  >
                    {editingMachine ? 'Salva Modifiche' : 'Crea Distributore'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRA / MODIFICA DISPOSITIVO ESP32 (BY MAC ADDRESS) */}
      {/* ========================================================================= */}
      {showDeviceModal && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-cyan-500/30 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isLight
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                }`}>
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {editingDevice ? `Configura Modulo GB-CLOUD: ${editingDevice.macAddress}` : 'Registra Nuovo Modulo GB-CLOUD'}
                  </h3>
                  <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Hardware unico con uscite optoisolate integrato sul distributore
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeviceModal(false)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    MAC Address Hardware
                  </label>
                  {editingDevice ? (
                    <div className={`w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold ${
                      isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-900 border-white/10 text-slate-200'
                    }`}>
                      {devMac || editingDevice.macAddress}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Rilevato in automatico dal silicio ESP32 al primo avvio</span>
                    </div>
                  )}
                  <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    1 MAC Address = 1 Modulo Univoco. Non occorre conoscerlo in anticipo.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-xs font-semibold ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      Matricola Modulo (6 Cifre) *
                    </label>
                    {!editingDevice && (
                      <button
                        type="button"
                        onClick={() => {
                          const newSerial = '5' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
                          setDevSerialNumber(newSerial);
                          setDevDeviceId(`GB-CLOUD MODULE ${newSerial}`);
                        }}
                        className={`text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          isLight ? 'text-blue-700 hover:text-blue-900' : 'text-blue-400 hover:text-blue-300'
                        }`}
                      >
                        <RefreshCw className="w-3 h-3" />
                        Rigenera Matricola
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    disabled={!!editingDevice}
                    maxLength={6}
                    placeholder="501824"
                    value={devSerialNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setDevSerialNumber(val);
                      setDevDeviceId(`GB-CLOUD MODULE ${val}`);
                    }}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-mono font-bold tracking-widest focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-slate-200 focus:border-blue-400'
                    }`}
                  />
                  <p className={`text-[10px] mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {editingDevice ? 'Codice univoco a 6 cifre (non modificabile dopo la creazione)' : 'Matricola Modulo a 6 cifre con prefisso obbligatorio \'5\' (es. 5xxxxx)'}
                  </p>
                </div>
              </div>

              {/* GB-CLOUD MODULE Denomination Preview */}
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Nome Dispositivo Univoco (Formato Automatico)
                </label>
                <div className={`flex items-center justify-between border rounded-xl px-3 py-2 text-xs font-mono font-bold ${
                  isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-900'
                    : 'bg-slate-900 border-white/10 text-slate-200'
                }`}>
                  <span className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-500" />
                    GB-CLOUD MODULE {devSerialNumber || '501824'}
                  </span>
                  <span className={`text-[10px] font-sans px-2 py-0.5 rounded-md border font-semibold ${
                    isLight ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    Modulo IoT Certificato
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Modello Scheda Hardware
                  </label>
                  <select
                    value={devBoardModel}
                    onChange={(e) => setDevBoardModel(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                    }`}
                  >
                    <option value="GB-CLOUD Controller Board (38-Pin + Modulo Opto)">GB-CLOUD Controller Board (38-Pin + Modulo Opto)</option>
                    <option value="GB-CLOUD Pro S3 Controller (Dual Type-C / Dual-Core)">GB-CLOUD Pro S3 Controller (Dual Type-C / Dual-Core)</option>
                    <option value="GB-CLOUD Industrial DIN 4CH (Optoisolato)">GB-CLOUD Industrial DIN 4CH (Optoisolato)</option>
                    <option value="GB-CLOUD Standard Controller (38-Pin)">GB-CLOUD Standard Controller (38-Pin)</option>
                    <option value="GB-CLOUD Mini Gateway Board">GB-CLOUD Mini Gateway Board</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Tensione Uscite Optoisolate
                  </label>
                  <select
                    value={devVoltage}
                    onChange={(e) => setDevVoltage(e.target.value as any)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                    }`}
                  >
                    <option value="12v_opto">12V DC Optoisolato (Standard)</option>
                    <option value="24v_opto">24V DC Optoisolato (Impianto Erogatore)</option>
                    <option value="3v3_direct">3.3V Diretto (TTL/Logic Level)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Indirizzo IP Statico
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.1.145"
                    value={devIp}
                    onChange={(e) => setDevIp(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    SSID Wi-Fi IoT
                  </label>
                  <input
                    type="text"
                    placeholder="Azienda_WiFi_IoT"
                    value={devSsid}
                    onChange={(e) => setDevSsid(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                      isLight
                        ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                        : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Hardware Pinout & Opto configuration */}
              <div className={`border rounded-2xl p-3.5 space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/10'
              }`}>
                <div className={`text-xs font-bold flex items-center justify-between ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}>
                  <span>Mappatura Pin GPIO &amp; Uscite Opto</span>
                  <span className={`text-[10px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    Modulo Hardware Univoco
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Impulso Opto (ms)</label>
                    <input
                      type="number"
                      value={devOptoDurationMs}
                      onChange={(e) => setDevOptoDurationMs(Number(e.target.value))}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-amber-300 text-amber-800 focus:border-amber-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-amber-300 focus:border-amber-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Debounce (ms)</label>
                    <input
                      type="number"
                      value={devDebounceMs}
                      onChange={(e) => setDevDebounceMs(Number(e.target.value))}
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>GPIO Uscite Optoisolate (CSV)</label>
                    <input
                      type="text"
                      value={devOptoPins}
                      onChange={(e) => setDevOptoPins(e.target.value)}
                      placeholder="19, 21, 22, 23"
                      className={`w-full border rounded-xl px-2.5 py-1.5 text-xs font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-slate-200 focus:border-blue-400'
                      }`}
                    />
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-3 pt-1 border-t ${
                  isLight ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Righe Matrice (R1, R2, R3, R4)</label>
                    <div className="grid grid-cols-4 gap-1">
                      <input
                        type="number"
                        value={devMatrixRowPins.r1}
                        onChange={(e) => setDevMatrixRowPins({ ...devMatrixRowPins, r1: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-blue-700 shadow-sm'
                            : 'bg-black/50 border-white/10 text-blue-300'
                        }`}
                        title="Riga 1"
                      />
                      <input
                        type="number"
                        value={devMatrixRowPins.r2}
                        onChange={(e) => setDevMatrixRowPins({ ...devMatrixRowPins, r2: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-blue-700 shadow-sm'
                            : 'bg-black/50 border-white/10 text-blue-300'
                        }`}
                        title="Riga 2"
                      />
                      <input
                        type="number"
                        value={devMatrixRowPins.r3}
                        onChange={(e) => setDevMatrixRowPins({ ...devMatrixRowPins, r3: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-blue-700 shadow-sm'
                            : 'bg-black/50 border-white/10 text-blue-300'
                        }`}
                        title="Riga 3"
                      />
                      <input
                        type="number"
                        value={devMatrixRowPins.r4}
                        onChange={(e) => setDevMatrixRowPins({ ...devMatrixRowPins, r4: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-blue-700 shadow-sm'
                            : 'bg-black/50 border-white/10 text-blue-300'
                        }`}
                        title="Riga 4"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>Colonne Matrice (C1, C2, C3, C4)</label>
                    <div className="grid grid-cols-4 gap-1">
                      <input
                        type="number"
                        value={devMatrixColPins.c1}
                        onChange={(e) => setDevMatrixColPins({ ...devMatrixColPins, c1: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                            : 'bg-black/50 border-white/10 text-slate-200'
                        }`}
                        title="Colonna 1"
                      />
                      <input
                        type="number"
                        value={devMatrixColPins.c2}
                        onChange={(e) => setDevMatrixColPins({ ...devMatrixColPins, c2: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                            : 'bg-black/50 border-white/10 text-slate-200'
                        }`}
                        title="Colonna 2"
                      />
                      <input
                        type="number"
                        value={devMatrixColPins.c3}
                        onChange={(e) => setDevMatrixColPins({ ...devMatrixColPins, c3: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                            : 'bg-black/50 border-white/10 text-slate-200'
                        }`}
                        title="Colonna 3"
                      />
                      <input
                        type="number"
                        value={devMatrixColPins.c4}
                        onChange={(e) => setDevMatrixColPins({ ...devMatrixColPins, c4: Number(e.target.value) })}
                        className={`border rounded-lg p-1 text-center font-mono text-xs ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-800 shadow-sm'
                            : 'bg-black/50 border-white/10 text-slate-200'
                        }`}
                        title="Colonna 4"
                      />
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-2 gap-3 pt-2 border-t ${
                  isLight ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>GPIO Buzzer Feedback</label>
                    <input
                      type="number"
                      value={devBuzzerPin}
                      onChange={(e) => setDevBuzzerPin(Number(e.target.value))}
                      className={`w-full border rounded-lg px-2 py-1 text-center font-mono text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-amber-300 text-amber-800 focus:border-amber-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-amber-300 focus:border-amber-400'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block text-[10px] mb-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>GPIO Relè / Status LED</label>
                    <input
                      type="number"
                      value={devRelayPin}
                      onChange={(e) => setDevRelayPin(Number(e.target.value))}
                      className={`w-full border rounded-lg px-2 py-1 text-center font-mono text-xs focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-blue-700 focus:border-blue-500 shadow-sm'
                          : 'bg-black/50 border-white/10 text-blue-300 focus:border-blue-400'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Assegnazione a Distributore
                </label>
                <select
                  value={devAssignedMachineId}
                  onChange={(e) => setDevAssignedMachineId(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                      : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                  }`}
                >
                  <option value="">-- Dispositivo di Scorta / Non Assegnato --</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.serialNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Note di Installazione / Hardware
                </label>
                <textarea
                  rows={2}
                  placeholder="Es. Modulo GB-CLOUD con uscite optoisolate integrato direttamente sul distributore."
                  value={devNotes}
                  onChange={(e) => setDevNotes(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none resize-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                      : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-3 pt-3 border-t ${
                isLight ? 'border-slate-200' : 'border-white/10'
              }`}>
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30"
                >
                  {editingDevice ? 'Salva Modifiche' : 'Registra Modulo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK PAIRING MODAL (1-CLICK MAC ASSIGNMENT) */}
      {/* ========================================================================= */}
      {quickPairMachine && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/10 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <Radio className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Associa Modulo GB-CLOUD</h3>
              </div>
              <button
                onClick={() => setQuickPairMachine(null)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Seleziona il modulo GB-CLOUD da associare al distributore <strong>{quickPairMachine.name}</strong> (Matricola: {quickPairMachine.serialNumber}):
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {devices.map((d) => {
                const isCurrent = quickPairMachine.assignedDeviceMac === d.macAddress;
                return (
                  <div
                    key={d.macAddress}
                    onClick={() => handleQuickPairSubmit(d.macAddress)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      isCurrent
                        ? isLight
                          ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-sm'
                          : 'bg-blue-950/60 border-blue-400/50 shadow-md text-white'
                        : isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                          : 'bg-black/30 hover:bg-white/5 border-white/10 text-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-mono text-xs font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>{d.macAddress}</span>
                        <span className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>({d.deviceId})</span>
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {d.boardModel} &bull; IP: {d.ipAddress}
                        {d.assignedMachineId && d.assignedMachineId !== quickPairMachine.id ? ` (Attualmente su ${d.assignedMachineId})` : ''}
                      </div>
                    </div>
                    {isCurrent && <Check className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />}
                  </div>
                );
              })}
            </div>

            <div className={`flex items-center justify-between pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              {quickPairMachine.assignedDeviceMac && (
                <button
                  type="button"
                  onClick={() => handleQuickPairSubmit(null)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    isLight
                      ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30'
                  }`}
                >
                  Scollega Dispositivo Attuale
                </button>
              )}
              <button
                type="button"
                onClick={() => setQuickPairMachine(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ml-auto transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODALS */}
      {machineToDelete && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-rose-200 text-slate-900'
              : 'bg-[#0f172a]/95 border-rose-500/30 text-white'
          }`}>
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Elimina Distributore</h3>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Sei sicuro di voler eliminare <strong>{machineToDelete.name}</strong> (Matricola: {machineToDelete.serialNumber})? Il Modulo abbinato rimarrà salvato nell&apos;inventario come dispositivo di scorta.
            </p>
            <div className={`flex justify-end gap-2 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <button
                onClick={() => setMachineToDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteMachine}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Elimina Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Blank Confirmation Modal */}
      {showResetConfirm && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-rose-200 text-slate-900'
              : 'bg-[#0f172a]/95 border-rose-500/30 text-white'
          }`}>
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold">Elimina Impianti e Parti da Zero</h3>
            </div>
            <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Sei sicuro di voler eliminare tutti gli impianti e distributori generati automaticamente?
              Questa azione azzera tutti i distributori di test, lo storico erogazioni e i log, permettendoti di <strong>partire da zero</strong> con i tuoi soli distributori fisici.
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                onClick={handleResetFleetBlank}
                disabled={isResetting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isResetting ? 'Eliminazione in corso...' : 'Sì, Elimina e Parti da Zero'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {deviceToDelete && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-rose-200 text-slate-900'
              : 'bg-[#0f172a]/95 border-rose-500/30 text-white'
          }`}>
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Rimuovi Modulo GB-CLOUD</h3>
            </div>
            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Sei sicuro di voler rimuovere il modulo con MAC <strong>{deviceToDelete.macAddress}</strong> ({deviceToDelete.deviceId})?
            </p>
            <div className={`flex justify-end gap-2 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <button
                onClick={() => setDeviceToDelete(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-white/5 hover:bg-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                onClick={handleDeleteDevice}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30"
              >
                Rimuovi Modulo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROVISIONING GUIDATO WI-FI & IP STATICO */}
      {/* ========================================================================= */}
      {provisioningDevice && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-blue-500/30 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isLight
                    ? 'bg-blue-100/80 border-blue-200 text-blue-700'
                    : 'bg-blue-500/20 border-blue-400/30 text-blue-400'
                }`}>
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Provisioning Wi-Fi Modulo</h3>
                  <p className={`text-xs font-mono ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>{provisioningDevice.macAddress}</p>
                </div>
              </div>
              <button
                onClick={() => setProvisioningDevice(null)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProvisioning} className="space-y-4 text-xs">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>SSID Rete Wi-Fi</label>
                <input
                  type="text"
                  required
                  placeholder="Azienda_WiFi_IoT"
                  value={provSsid}
                  onChange={(e) => setProvSsid(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                      : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>Password Wi-Fi WPA2/WPA3</label>
                <input
                  type="password"
                  placeholder="Inserisci password Wi-Fi..."
                  value={provPassword}
                  onChange={(e) => setProvPassword(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                      : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1 flex items-center justify-between ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <span>Indirizzo IP Statico (Opzionale):</span>
                  <span className={`text-[10px] font-normal ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>DHCP se vuoto</span>
                </label>
                <input
                  type="text"
                  placeholder="192.168.1.145"
                  value={provStaticIp}
                  onChange={(e) => setProvStaticIp(e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none font-mono ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 shadow-sm'
                      : 'bg-black/50 border-white/10 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              <div className={`border rounded-xl p-3 text-[11px] space-y-1 ${
                isLight ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-blue-950/40 border-blue-500/20 text-blue-200'
              }`}>
                <p>
                  🚀 I nuovi parametri verranno inviati in tempo reale al Modulo via protocollo di configurazione over-the-air o socket locale.
                </p>
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${
                isLight ? 'border-slate-200' : 'border-white/10'
              }`}>
                <button
                  type="button"
                  onClick={() => setProvisioningDevice(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-blue-600/30"
                >
                  {isProvisioning ? 'Invio credenziali...' : 'Applica Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: COLLAUDO BANCO HARDWARE - TEST MATRICE 15 TASTI (STANDALONE) */}
      {/* ========================================================================= */}
      {benchTestDevice && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto ${
          isLight ? 'bg-slate-900/50' : 'bg-black/85 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[92vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0b1329]/95 backdrop-blur-2xl border-emerald-500/30 text-white'
          }`}>
            {/* Header */}
            <div className={`flex items-start justify-between border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-md ${
                  isLight
                    ? 'bg-emerald-100/80 border-emerald-200 text-emerald-700'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                }`}>
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-bold">Collaudo Banco Hardware</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                      Standalone (Nessuna Macchina)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono opacity-80 mt-0.5">
                    <span>{benchTestDevice.deviceId}</span>
                    <span>&bull;</span>
                    <span>MAC: {benchTestDevice.macAddress}</span>
                    <span>&bull;</span>
                    <span>IP: {benchTestDevice.ipAddress || '192.168.1.150'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setBenchTestDevice(null);
                  setBenchTestRecentResult(null);
                }}
                className={`p-2 rounded-xl border transition-all ${
                  isLight
                    ? 'hover:bg-slate-100 border-slate-200 text-slate-500'
                    : 'hover:bg-white/10 border-white/10 text-slate-400'
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subtitle & Explanation */}
            <div className={`text-xs p-3 rounded-2xl border flex items-start gap-2.5 leading-relaxed ${
              isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
            }`}>
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <strong>Nessuna associazione necessaria:</strong> Il modulo ESP32 può essere collaudato liberamente al banco prova. Cliccando sui pulsanti sottostanti, il server trasmette via MQTT i comandi per attivare le coppie di optoisolatori (Fili 1..4 per Wire A, Fili 5..8 per Wire B) o singoli GPIO.
              </div>
            </div>

            {/* Pulse Duration Selector */}
            <div className={`p-3.5 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                  Durata Impulso Erogazione (ms):
                </span>
                <span className="text-xs font-mono font-bold text-blue-500">{benchTestDurationMs} ms</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {[100, 200, 400, 800, 1200].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => setBenchTestDurationMs(ms)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      benchTestDurationMs === ms
                        ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/30 font-bold'
                        : isLight
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    {ms} ms {ms === 400 && '(Default)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Matrice Bevande: Tasti P1..P12 */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-amber-500" />
                  Matrice Bevande (12 Tasti P1 .. P12)
                </h4>
                <span className="text-[11px] opacity-70">Attiva le coppie opto (Wire A + Wire B)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { num: 1,  key: '1',  wireA: 1, wireB: 5, label: 'Prodotto 1',  char: '1' },
                  { num: 2,  key: '2',  wireA: 2, wireB: 5, label: 'Prodotto 2',  char: '2' },
                  { num: 3,  key: '3',  wireA: 3, wireB: 5, label: 'Prodotto 3',  char: '3' },
                  { num: 4,  key: '4',  wireA: 1, wireB: 6, label: 'Prodotto 4',  char: 'A' },
                  { num: 5,  key: '5',  wireA: 2, wireB: 6, label: 'Prodotto 5',  char: '4' },
                  { num: 6,  key: '6',  wireA: 3, wireB: 6, label: 'Prodotto 6',  char: '5' },
                  { num: 7,  key: '7',  wireA: 1, wireB: 7, label: 'Prodotto 7',  char: '6' },
                  { num: 8,  key: '8',  wireA: 2, wireB: 7, label: 'Prodotto 8',  char: 'B' },
                  { num: 9,  key: '9',  wireA: 3, wireB: 7, label: 'Prodotto 9',  char: '7' },
                  { num: 10, key: '10', wireA: 1, wireB: 8, label: 'Prodotto 10', char: '8' },
                  { num: 11, key: '11', wireA: 2, wireB: 8, label: 'Prodotto 11', char: '9' },
                  { num: 12, key: '12', wireA: 3, wireB: 8, label: 'Prodotto 12', char: 'C' },
                ].map((item) => {
                  const isTestingThis = benchTestingKey === item.key;
                  return (
                    <button
                      key={item.num}
                      type="button"
                      disabled={Boolean(benchTestingKey)}
                      onClick={() => handleRunBenchTestKey(benchTestDevice.macAddress, item.key)}
                      className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                        isTestingThis
                          ? 'ring-2 ring-emerald-500 scale-98 bg-emerald-500/20 border-emerald-500'
                          : isLight
                            ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900 shadow-xs hover:border-blue-300'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white hover:border-emerald-500/40'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="font-bold text-xs">P{item.num} &bull; Tasto [{item.char}]</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {isTestingThis ? 'Invio...' : `U${item.wireA}+U${item.wireB}`}
                        </span>
                      </div>
                      <span className="text-[11px] opacity-75">{item.label}</span>
                      <span className="text-[10px] opacity-50 font-mono mt-0.5">Fili {item.wireA} & {item.wireB}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Funzioni Speciali Matrice (STOP, CARAFFA, LINGUA) */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                Funzioni Speciali Matrice
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* STOP */}
                <button
                  type="button"
                  disabled={Boolean(benchTestingKey)}
                  onClick={() => handleRunBenchTestKey(benchTestDevice.macAddress, 'STOP')}
                  className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                    benchTestingKey === 'STOP'
                      ? 'ring-2 ring-rose-500 scale-98 bg-rose-500/25 border-rose-500'
                      : isLight
                        ? 'bg-rose-50 hover:bg-rose-100/80 border-rose-200 text-rose-900'
                        : 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/30 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-xs">🛑 STOP Emergenza</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-rose-500/20 text-rose-300">
                      U4+U7
                    </span>
                  </div>
                  <span className="text-[11px] opacity-80">Tasto &apos;0&apos; (Prodotto 13)</span>
                  <span className="text-[10px] font-mono opacity-60">Fili 4 e 7</span>
                </button>

                {/* CARAFFA */}
                <button
                  type="button"
                  disabled={Boolean(benchTestingKey)}
                  onClick={() => handleRunBenchTestKey(benchTestDevice.macAddress, 'CARAFFA')}
                  className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                    benchTestingKey === 'CARAFFA'
                      ? 'ring-2 ring-amber-500 scale-98 bg-amber-500/25 border-amber-500'
                      : isLight
                        ? 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-900'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-xs">🏺 CARAFFA</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-amber-500/20 text-amber-300">
                      U4+U6
                    </span>
                  </div>
                  <span className="text-[11px] opacity-80">Tasto &apos;*&apos; (Prodotto 14)</span>
                  <span className="text-[10px] font-mono opacity-60">Fili 4 e 6</span>
                </button>

                {/* LINGUA */}
                <button
                  type="button"
                  disabled={Boolean(benchTestingKey)}
                  onClick={() => handleRunBenchTestKey(benchTestDevice.macAddress, 'LINGUA')}
                  className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all ${
                    benchTestingKey === 'LINGUA'
                      ? 'ring-2 ring-blue-500 scale-98 bg-blue-500/25 border-blue-500'
                      : isLight
                        ? 'bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-900'
                        : 'bg-blue-500/15 hover:bg-blue-500/25 border-blue-500/30 text-blue-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-xs">🌐 LINGUA Display</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold bg-blue-500/20 text-blue-300">
                      U4+U5
                    </span>
                  </div>
                  <span className="text-[11px] opacity-80">Tasto &apos;#&apos; (Prodotto 15)</span>
                  <span className="text-[10px] font-mono opacity-60">Fili 4 e 5</span>
                </button>
              </div>
            </div>

            {/* Test Singolo GPIO Optoisolato */}
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 flex-wrap ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <div>
                <span className="text-xs font-semibold block">Test Impulso Diretto GPIO Optoisolato</span>
                <span className="text-[11px] opacity-75">Invia impulso su singolo pin configurato (Default GPIO 19)</span>
              </div>
              <button
                type="button"
                disabled={testingOptoMac === benchTestDevice.macAddress}
                onClick={() => handleTestOptoTrigger(benchTestDevice.macAddress, benchTestDevice.hardwareConfig?.optoOutputPins?.[0] || 19, benchTestDurationMs)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isLight
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 text-amber-500 ${testingOptoMac === benchTestDevice.macAddress ? 'animate-bounce' : ''}`} />
                <span>{testingOptoMac === benchTestDevice.macAddress ? 'Attivazione...' : `Test GPIO ${benchTestDevice.hardwareConfig?.optoOutputPins?.[0] || 19}`}</span>
              </button>
            </div>

            {/* Ultimo Esito Esecuzione */}
            {benchTestRecentResult && (
              <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 font-mono ${
                benchTestRecentResult.success
                  ? isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : isLight ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}>
                {benchTestRecentResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">[{benchTestRecentResult.timestamp}] {benchTestRecentResult.success ? 'COMANDO INVIATO CON SUCCESSO' : 'ERRORE'}</span>
                    {benchTestRecentResult.durationMs && (
                      <span className="text-[10px] opacity-80">{benchTestRecentResult.durationMs}ms</span>
                    )}
                  </div>
                  <p className="mt-0.5">{benchTestRecentResult.message}</p>
                  {benchTestRecentResult.wireA && benchTestRecentResult.wireB && (
                    <div className="text-[10px] opacity-75 mt-1 font-semibold">
                      &bull; Relè / Opto attivati: Wire A (Filo {benchTestRecentResult.wireA}) + Wire B (Filo {benchTestRecentResult.wireB})
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className={`flex items-center justify-end pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setBenchTestDevice(null);
                  setBenchTestRecentResult(null);
                }}
                className={`px-5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-white/10 hover:bg-white/15 text-white border-white/20'
                }`}
              >
                Chiudi Collaudo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LOG DIAGNOSTICI & METRICHE TELEMETRICHE DETTAGLIATE */}
      {/* ========================================================================= */}
      {diagnosticsDevice && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8 max-h-[90vh] overflow-y-auto ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-emerald-500/30 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-4 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isLight
                    ? 'bg-teal-100/80 border-teal-200 text-teal-700'
                    : 'bg-teal-500/20 border-teal-400/30 text-teal-400'
                }`}>
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Log Diagnostici &amp; Stato Hardware</h3>
                  <p className={`text-xs font-mono ${isLight ? 'text-teal-700' : 'text-teal-300'}`}>
                    {diagnosticsDevice.deviceId} &bull; MAC: {diagnosticsDevice.macAddress}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiagnosticsDevice(null)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className={`border rounded-2xl p-3 text-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
              }`}>
                <span className={`block text-[10px] mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Stato Modulo</span>
                <span className={`font-bold uppercase text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>{diagnosticsDevice.status}</span>
              </div>
              <div className={`border rounded-2xl p-3 text-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
              }`}>
                <span className={`block text-[10px] mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Free RAM (Heap)</span>
                <span className={`font-bold font-mono text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {diagnosticsDevice.telemetry?.freeHeap ? `${Math.round(diagnosticsDevice.telemetry.freeHeap / 1024)} KB` : '184 KB'}
                </span>
              </div>
              <div className={`border rounded-2xl p-3 text-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
              }`}>
                <span className={`block text-[10px] mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Wi-Fi RSSI</span>
                <span className={`font-bold font-mono text-xs ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                  {diagnosticsDevice.telemetry?.rssi ? `${diagnosticsDevice.telemetry.rssi} dBm` : '-62 dBm'}
                </span>
              </div>
              <div className={`border rounded-2xl p-3 text-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/40 border-white/10'
              }`}>
                <span className={`block text-[10px] mb-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Uptime Modulo</span>
                <span className={`font-bold font-mono text-xs ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                  {diagnosticsDevice.telemetry?.uptimeSeconds ? `${Math.floor(diagnosticsDevice.telemetry.uptimeSeconds / 60)}m` : '42m'}
                </span>
              </div>
            </div>

            {/* Terminal Logs Window */}
            <div>
              <div className={`flex items-center justify-between text-xs mb-2 font-semibold ${
                isLight ? 'text-slate-700' : 'text-slate-300'
              }`}>
                <span className="flex items-center gap-1.5">
                  <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-teal-600' : 'text-teal-400'}`} />
                  Console Eventi &amp; Diagnostica Seriale
                </span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Buffer: 40 record</span>
              </div>

              <div className={`border rounded-2xl p-4 font-mono text-[11px] max-h-60 overflow-y-auto space-y-2 ${
                isLight
                  ? 'bg-slate-900 border-slate-300 text-slate-200'
                  : 'bg-black/80 border-white/15 text-slate-300'
              }`}>
                {diagnosticsDevice.diagnosticLogs && diagnosticsDevice.diagnosticLogs.length > 0 ? (
                  diagnosticsDevice.diagnosticLogs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2 border-b border-white/5 pb-1.5 last:border-0">
                      <span className="text-slate-500 shrink-0 text-[10px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span
                        className={`px-1 rounded text-[9px] font-bold shrink-0 ${
                          log.level === 'ERROR'
                            ? 'bg-rose-500/20 text-rose-300'
                            : log.level === 'WARN'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-slate-300 flex-1">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="space-y-1.5 text-slate-400">
                    <div className="text-emerald-400">[BOOT] Modulo GB-CLOUD dual-core initialized. CPU Freq: 240MHz.</div>
                    <div className="text-blue-300">[WIFI] STA Mode active. Connected to &apos;{diagnosticsDevice.wifiSsid}&apos;. RSSI: -62 dBm.</div>
                    <div className="text-teal-300">[OPTO] Uscite optoisolate per simulazione tastiera configurate su GPIO {diagnosticsDevice.hardwareConfig?.optoOutputPins?.join(', ') || '19, 21, 22, 23'}.</div>
                    <div className="text-amber-300">[HEARTBEAT] Telemetry ping inviato. RSSI: -62dBm | FreeHeap: 188.4 KB.</div>
                    <div className="text-slate-400">[KEYPAD] Polling tastiera a membrana 4x4 attivo (Debounce: {diagnosticsDevice.hardwareConfig?.debounceMs || 30}ms).</div>
                  </div>
                )}
              </div>
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setDiagnosticsDevice(null)}
                className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-600/30"
              >
                Chiudi Diagnostica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REPORT VERIFICA STATO & WATCHDOG REAL-TIME */}
      {/* ========================================================================= */}
      {statusReport && (
        <div className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto ${
          isLight ? 'bg-slate-900/50' : 'bg-black/80 backdrop-blur-md'
        }`}>
          <div className={`border rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-4 ${
            isLight
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-[#0f172a]/95 backdrop-blur-2xl border-white/10 text-white'
          }`}>
            <div className={`flex items-center justify-between border-b pb-3 ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                  isLight
                    ? 'bg-slate-100 border-slate-200 text-blue-700'
                    : 'bg-slate-800 border-slate-700 text-blue-400'
                }`}>
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Report Controllo Watchdog Moduli</h3>
                  <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Soglia timeout attiva: <strong>{statusReport.timeoutSec}s</strong> &bull; Moduli Online: <strong>{statusReport.onlineCount}/{statusReport.totalCount}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setStatusReport(null)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {statusReport.devices?.map((dev: any) => (
                <div
                  key={dev.macAddress}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-xs font-mono ${
                    isLight
                      ? 'bg-slate-50 border-slate-200 text-slate-900'
                      : 'bg-black/40 border-white/10 text-white'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{dev.deviceId}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                        isLight ? 'bg-slate-100 text-slate-800 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>{dev.macAddress}</span>
                    </div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      IP: {dev.ipAddress || 'Non assegnato'} &bull; RSSI: {dev.wifiRssi || -60}dBm
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        dev.isOnline
                          ? isLight
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-slate-800 text-slate-200 border-slate-700'
                          : isLight
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${dev.isOnline ? 'bg-emerald-600' : 'bg-rose-500'}`} />
                      {dev.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <div className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {dev.secondsAgo < 9999 ? `${dev.secondsAgo}s fa` : 'Mai ricevuto'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-white/10'
            }`}>
              <button
                type="button"
                onClick={() => setStatusReport(null)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30"
              >
                Chiudi Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
