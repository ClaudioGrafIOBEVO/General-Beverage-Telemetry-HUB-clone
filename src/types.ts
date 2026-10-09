export interface CustomerSite {
  id: string;
  name: string; // Nome Sede / Stabilimento (es. "Sede Direzionale Milano - Torre A")
  address: string; // Indirizzo (es. "Via Stephenson 73")
  city: string; // Città (es. "Milano")
  province: string; // Sigla Provincia (es. "MI")
  zipCode?: string; // CAP (es. "20157")
  floorRoom?: string; // Piano / Area (es. "Piano Terra - Atrio & Reception")
  contactPerson?: string; // Referente in loco
  phone?: string;
  notes?: string;
}

export interface Customer {
  id: string; // es. "CUST-001"
  code: string; // es. "CLI-01"
  name: string; // Ragione Sociale (es. "IVS Italia S.p.A.")
  logoUrl?: string; // URL o base64 del logo aziendale
  vatNumber?: string; // Partita IVA / Codice Fiscale
  taxCode?: string;
  contactPerson?: string; // Referente Principale
  phone?: string;
  email?: string;
  address?: string; // Sede Legale
  city?: string;
  province?: string;
  zipCode?: string;
  sites: CustomerSite[]; // Sedi operative associate
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  machineCount?: number;
  machines?: Array<{
    id: string;
    serialNumber: string;
    name: string;
    model: string;
    site?: string;
    status: string;
  }>;
}

export interface BeverageItem {
  id: string;
  productNumber: number; // 1 to 12
  key: string; // The 4x4 matrix key assigned: 'P1'..'P12'
  code: string; // Display/MDB code, e.g. 'P01', 'P02', ..., 'P12'
  name: string;
  category: 'coffee' | 'milk' | 'chocolate' | 'tea' | 'cold_drink' | 'special';
  price: number;
  prepTimeSec: number;
  iconName: string;
  description: string;
  available: boolean;
  ingredients: {
    waterMl: number;
    coffeeGrams: number;
    milkPowderGrams: number;
    chocolateGrams: number;
    teaGrams: number;
    sugarGrams: number;
  };
}

export interface MachineSupplies {
  waterLevelLiters: number;
  maxWaterLiters: number;
  coffeeBeansGrams: number;
  maxCoffeeGrams: number;
  milkPowderGrams: number;
  maxMilkGrams: number;
  chocolatePowderGrams: number;
  maxChocolateGrams: number;
  teaPowderGrams: number;
  maxTeaGrams: number;
  sugarGrams: number;
  maxSugarGrams: number;
  cupsCount: number;
  maxCups: number;
  stirrersCount: number;
  maxStirrers: number;
  boilerTempCelsius: number;
  targetTempCelsius: number;
  totalEarnings: number;
  totalDispenses: number;
}

export interface MachineLocation {
  company: string; // Società di ristorazione / Gestore (e.g. "IVS Italia S.p.A.", "GeSA Ristorazione", "Sogeda Beverage")
  site: string; // Sede / Stabilimento / Complesso (e.g. "Sede Direzionale Milano - Torre A", "Stabilimento Produttivo 1")
  address: string; // Via / Piazza e numero civico (e.g. "Via Stephenson 73", "Strada Statale 11, Km 42")
  city: string; // Città (e.g. "Milano", "Torino", "Bologna")
  zipCode: string; // CAP (e.g. "20157")
  province: string; // Sigla Provincia (e.g. "MI", "MB", "TO")
  floorRoom?: string; // Piano / Area / Stanza (e.g. "Piano Terra - Atrio & Reception", "Edificio B, Linea 3")
  notes?: string; // Note aggiuntive (e.g. "Referente: Sig. Rossi tel. 02-887711. Accesso tecnici lun-ven 08:00-18:00")
}

export interface Esp32DiagnosticLog {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  heapFreeBytes?: number;
  uptimeSeconds?: number;
  wifiRssi?: number;
  cpuTempC?: number;
}

export interface Esp32HardwareConfig {
  debounceMs: number;
  optoTriggerDurationMs: number; // Durata impulso uscite optoisolate per simulazione tasti macchina (es. 400ms)
  voltageLevel: '12v_opto' | '24v_opto' | '3v3_direct';
  matrixPins: HardwarePinConfig; // Ingressi Matrice Tastiera a Membrana R1-R4, C1-C4 (o Fili 1-8)
  optoOutputPins?: number[]; // GPIO dedicati alle uscite optoisolate che simulano i tasti della macchina
  buzzerPin?: number;
  relayPin?: number;
  ledStatusPin?: number;
}

export interface Esp32Device {
  macAddress: string; // Identificativo hardware univoco MAC, es. "24:6F:28:B2:1A:80"
  deviceId: string; // Identificativo Modulo GB-CLOUD, es. "GB-CLOUD MODULE 123456"
  serialNumber?: string; // Numero Matricola a 6 cifre del Modulo GB-CLOUD (es. "123456")
  boardModel: string; // es. "GB-CLOUD Controller Board (38-Pin + Modulo Opto)", "ESP32 Opto-Isolated Board"
  firmwareVersion: string; // es. "v3.2.0-OPTO-MATRIX"
  ipAddress: string; // es. "192.168.1.145"
  wifiSsid: string; // es. "Azienda_WiFi_IoT"
  wifiRssi?: number; // es. -58 dBm
  freeHeap?: number; // Memoria RAM libera in bytes (es. 248120)
  uptimeSec?: number; // Tempo di accensione in secondi (es. 86400)
  telemetry?: {
    freeHeap?: number;
    uptimeSec?: number;
    uptimeSeconds?: number;
    wifiRssi?: number;
    rssi?: number;
    boilerTemp?: number;
    lastPing?: string;
  };
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE' | 'UNASSIGNED';
  assignedMachineId?: string | null; // ID del distributore a cui è collegato (es. "ESP32-VENDING-01" o null)
  hardwareConfig: Esp32HardwareConfig;
  diagnosticLogs?: Esp32DiagnosticLog[]; // Log di diagnostica e boot in tempo reale
  lastHeartbeatAt: string;
  createdAt: string;
  notes?: string;
}

export interface VendingMachine {
  id: string; // es. "ESP32-VENDING-01"
  serialNumber: string; // Numero di Matricola a 6 cifre (es. "104829")
  name: string; // es. "Distributore 01: Sede Centrale - Bar & Reception"
  model: string; // es. "Ristosano", "Big 5", "Asia"
  electronicBoard?: string; // Scheda madre distributore, es. "Scheda Controller Ristosano", "Scheda Controller Big 5", "Scheda Controller Asia"
  status: 'ONLINE' | 'STANDBY' | 'DISPENSING' | 'MAINTENANCE' | 'OFFLINE';
  
  // Ubicazione completa
  locationDetails: MachineLocation;
  location: string; // Stringa riassuntiva per visualizzazione rapida
  customerId?: string; // ID cliente associato (es. "CUST-001")
  customerSiteId?: string; // ID sede cliente associata (es. "site-ivs-1")
  
  // Collegamento al modulo unico ESP32 tramite MAC Address
  assignedDeviceMac?: string | null; // es. "24:6F:28:B2:1A:80"
  assignedDevice?: Esp32Device; // Oggetto popolato per le viste UI
  
  // Parametri di rete
  ipAddress?: string;
  macAddress?: string;
  deviceId?: string;
  firmwareVersion?: string;
  telemetry?: {
    freeHeap?: number;
    uptimeSec?: number;
    uptimeSeconds?: number;
    wifiRssi?: number;
    rssi?: number;
    boilerTemp?: number;
    lastPing?: string;
  };

  installationDate?: string;
  lastMaintenanceDate?: string;

  supplies: MachineSupplies;
  beverages?: BeverageItem[];
  keyMapping?: Record<string, string>; // es. { "P1": "Caffè Espresso", "P2": "Caffè Lungo", ... }
  enableCalibrationAndConsumption?: boolean; // Flag: abilita gestione taratura e consumi (se false, telemetria attiva su sole battute)
  calibration?: MachineCalibrationConfig; // Taratura dosaggi, grammature e calibrazione consumi
  config: {
    debounceMs: number;
    isFreeDispense: boolean;
    caraffaMultiplier: number;
    boilerTargetTemp: number;
    optoTriggerDurationMs: number; // Durata impulso uscite opto ESP32 (ms)
    enableCalibrationAndConsumption?: boolean; // Flag replicato in configurazione macchina
    wifiSsid?: string;
  };
  notes?: string; // Note operative / tecniche / ubicazione del distributore
  lastTelemetryAt: string;
  createdAt: string;
}

export type MotorRpmType = 40 | 120 | 200;

export interface ArticleItem {
  itemCode: string; // Codice Articolo univoco (es. "ART-CAF-01", "ART-LAT-01")
  name: string; // Descrizione Commerciale / Prodotto
  ingredientType: 'coffee' | 'milk' | 'chocolate' | 'tea' | 'sugar' | 'solubles' | 'cups' | 'water' | 'syrup' | 'other';
  defaultRpm?: MotorRpmType;
  defaultGramsPerSecond?: number;
  nominalGramsPerDose?: number;
  costPerKg?: number;
  packageUnit?: string; // es. "Kg", "Busta 1 Kg", "Scatola 10x1 Kg"
  description?: string;
  supplier?: string;
  updatedAt?: string;
}

export interface CanisterCalibration {
  id: string; // es. "canister-1" .. "canister-6"
  canisterNumber: number; // 1 to 6
  name: string; // es. "Contenitore 1 - Caffè"
  itemCode?: string; // Codice Articolo dal catalogo (es. "ART-CAF-01")
  packageUnit?: string; // Unità di confezionamento (es. "Kg", "Busta 1 Kg")
  ingredientType: 'coffee' | 'milk' | 'chocolate' | 'tea' | 'sugar' | 'solubles' | 'cups' | 'water' | 'syrup' | 'other';
  motorRpm: MotorRpmType; // Motoriduttore: 40 giri, 120 giri o 200 giri
  gramsPerSecond: number; // Grammi erogati al secondo di motoriduttore (g/s)
  nominalGramsPerDose?: number; // Grammi nominali di riferimento
  measuredGramsPerDose?: number; // Grammi reali rilevati con pesata bilancino
  augerTimeMsPerGram?: number; // Millisecondi per grammo (calcolato o inserito)
  calibrationOffsetPct?: number; // Offset % (+/- %)
  containerCapacityKg: number; // Capacità max serbatoio (Kg)
  currentStockKg: number; // Giacenza residua stimata nel distributore (Kg)
  costPerKg: number; // Costo materia prima al Kg (€/Kg)
  lastCalibrationDate?: string; // Data ultima pesata sul campo
}

export interface ElectrovalveCalibration {
  id: string; // es. "ev-1", "ev-2", "ev-3", "ev-4"
  evNumber: number; // 1, 2, 3, 4
  name: string; // es. "EV1 - Mixer Caffè", "EV2 - Mixer Solubili / Latte", "EV3 - Mixer Cioccolato", "EV4 - Erogazione Acqua Calda"
  flowRateCcPerSec: number; // Portata in cc al secondo (es. 15.0 cc/s)
  description?: string;
}

export interface ButtonCanisterTiming {
  canisterId: string; // "canister-1" .. "canister-6"
  enabled: boolean;
  motorDurationSec: number; // Secondi attivazione motoriduttore coclea
}

export interface ButtonEvTiming {
  evId: string; // "ev-1" .. "ev-4"
  enabled: boolean;
  waterDurationSec: number; // Secondi apertura elettrovalvola
}

export interface BeverageDosageCalibration {
  key: string; // "P1" .. "P12"
  name: string; // es. "Caffè Espresso", "Cappuccino"
  // Quali contenitori funzionano e i secondi per ciascuno
  canisterTimings: ButtonCanisterTiming[];
  // Quali EV funzionano e i secondi di acqua per ciascuna
  evTimings: ButtonEvTiming[];
  // Campi di compatibilità / fallback
  canisterId?: string;
  motorDurationSec?: number;
  waterDurationSec?: number;
  notes?: string;
}

export interface DeliveryReconciliation {
  id: string;
  deliveryDate: string; // Data bolla / DDT consegna
  ddtNumber: string; // Numero Documento di Trasporto / Ricevuta
  operatorName: string; // Operatore / Tecnico di rifornimento
  deliveredItems: {
    coffeeKg: number;
    milkKg: number;
    chocolateKg: number;
    teaKg: number;
    sugarKg: number;
    cupsCount: number;
    stirrersCount: number;
  };
  telemetryExpectedConsumptionKg: {
    coffeeKg: number;
    milkKg: number;
    chocolateKg: number;
    teaKg: number;
    sugarKg: number;
    cupsCount: number;
    stirrersCount: number;
  };
  notes?: string;
  status: 'RECONCILED' | 'PENDING_TELEMETRY' | 'DISCREPANCY';
}

export interface MachineCalibrationConfig {
  lastUpdated: string;
  calibratedBy?: string;
  notes?: string;
  waterFlowCcPerSec: number; // Taratura acqua generale in cc al secondo
  electrovalves?: ElectrovalveCalibration[]; // Le elettrovalvole della macchina
  canisters: CanisterCalibration[]; // Esattamente 6 contenitori
  standardProducts: BeverageDosageCalibration[]; // 12 prodotti bicchiere (P1-P12)
  caraffaProducts: BeverageDosageCalibration[]; // 12 prodotti caraffa (P1-P12) tarabili indipendentemente
  deliveries?: DeliveryReconciliation[];
  keyDosages?: any[]; // Retrocompatibilità
}

export interface CalibrationTemplate {
  id: string;
  name: string;
  description: string;
  modelTarget: 'Ristosano' | 'Big 5' | 'Asia' | 'Universale';
  isSystemStandard?: boolean;
  calibration: MachineCalibrationConfig;
}

export interface DispenseRecord {
  id: string;
  beverageId: string;
  beverageName: string;
  productNumber?: number;
  key: string;
  code: string;
  timestamp: string;
  price: number;
  sugarLevel: number; // 0 to 5
  isCaraffa: boolean; // Dose o modalità caraffa
  doseMultiplier: number; // e.g. 1.0 (standard) or 3.0 (caraffa)
  status: 'COMPLETED' | 'PREPARING' | 'CANCELLED' | 'OUT_OF_STOCK';
  deviceId: string;
  machineName?: string;
  machineSerialNumber?: string; // Matricola a 6 cifre (es. "104829")
  customerName?: string; // Nome Cliente (es. "IVS Italia S.p.A.")
  siteName?: string; // Sede (es. "Sede Direzionale Milano - Torre A")
  prepTimeSec: number;
  coinsInserted: number;
  changeGiven: number;
}

export interface KeyLog {
  id: string;
  key: string; // Canonical key code, e.g. 'P1', 'P2', ..., 'P12', 'CARAFFA', 'STOP', 'LINGUA'
  keyLabel?: string; // Descriptive table name, e.g. 'PRODOTTO 1 (P1)', 'STOP', 'CARAFFA'
  productName?: string; // Associated product name, e.g. 'Caffè Espresso'
  deviceId: string;
  machineName?: string;
  machineSerialNumber?: string; // Matricola a 6 cifre (es. "104829")
  customerName?: string; // Nome Cliente (es. "IVS Italia S.p.A.")
  siteName?: string; // Sede (es. "Sede Direzionale Milano - Torre A")
  timestamp: string;
  eventType: 'pressed' | 'released' | 'held';
  isCaraffa?: boolean;
  doseType?: 'CARAFFA' | 'MONODOSE';
  doseMultiplier?: number;
  calibrationAndConsumptionEnabled?: boolean;
  channel?: string;
  voltage?: number;
  rssi?: number;
  ip?: string;
  rawCode?: number;
  metadata?: Record<string, unknown>;
}

export interface PinRecord {
  id: string;
  code: string;
  name: string;
  role: string;
  enabled: boolean;
  createdAt: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  deviceId: string;
  machineName?: string;
  enteredPin: string;
  status: 'GRANTED' | 'DENIED';
  userName?: string;
}

export interface HardwarePinConfig {
  row1: number; // e.g. 13
  row2: number; // e.g. 12
  row3: number; // e.g. 14
  row4: number; // e.g. 27
  col1: number; // e.g. 26
  col2: number; // e.g. 25
  col3: number; // e.g. 33
  col4: number; // e.g. 32
}

export interface ArduinoSketchSettings {
  ssid: string;
  password: string;
  serverUrl: string;
  deviceId: string;
  macAddress?: string; // MAC Address univoco da incorporare nel firmware (es. 24:6F:28:B2:1A:80)
  targetMacAddress?: string; // MAC Address univoco da incorporare nel firmware (es. 24:6F:28:B2:1A:80)
  boardModel?: string; // es. ESP32 DevKit V1 (38-Pin + Modulo Opto)
  targetBoardModel?: string; // es. ESP32 DevKit V1 (38-Pin + Modulo Opto)
  pins: HardwarePinConfig; // Ingressi Matrice Tastiera a Membrana R1-R4, C1-C4 (o Fili 1-8)
  debounceMs: number;
  holdTimeMs: number;
  sendOnEachPress: boolean;
  pinSubmitChar: '#' | '*' | 'none';
  pinClearChar: '*' | '#' | 'none';
  useBuzzer: boolean;
  buzzerPin: number;
  useRelay: boolean;
  relayPin: number;
  optoOutputPins?: number[]; // Uscite optoisolate per la simulazione pressione tasti
  optoDurationMs?: number; // Durata impulso opto (ms)
  optoTriggerDurationMs?: number; // Durata impulso opto (ms)
  enablePhysicalKeypad?: boolean; // Abilita scansione tastiera a membrana fisica (default: true)
  bridgeOptoOnPhysicalPress?: boolean; // In modalità Gateway (serie), replica la pressione fisica sulle uscite opto (default: false)
  waterPumpPin: number;
  boilerValvePin: number;
  mixerMotorPin: number;
  cupDropServoPin?: number;
  method?: 'rest_http' | 'firebase_rtdb' | 'firebase_firestore' | 'sql_proxy' | string;
  keypadVoltageLevel?: '12v_opto' | '12v_divider' | '3v3_direct';
  invertWiring1to8?: boolean; // Inversione speculare cavo piatto 8 poli (Filo 1 <-> Filo 8)
  mqttBroker?: string; // es. broker.hivemq.com, broker.emqx.io, o IP locale
  mqttPort?: number; // di default 1883
}

export interface ServerStats {
  totalKeypresses: number;
  totalFleetDispenses?: number;
  totalToday?: number;
  uniqueKeys?: number;
  keyCounts: Record<string, number>;
  deviceCounts: Record<string, number>;
  hourBuckets: Record<string, number>;
  registeredPins: number;
  accessAttempts: number;
  recentLog: KeyLog | null;
  totalEarnings?: number;
  totalDispenses?: number;
  popularBeverage?: string;
  totalMachines?: number;
  onlineMachines?: number;
}

export type SupportedLang = 'it' | 'en' | 'de' | 'fr' | 'es';

export type UserRole = 'admin' | 'tecnico' | 'gestore' | 'operatore' | 'cliente' | 'viewer' | string;

export interface RolePermissionDefinition {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
  allowedTabs: string[];
  canManageUsers?: boolean;
  canUpdateVps?: boolean;
  canEditMachines?: boolean;
  canEditRecipes?: boolean;
  canUploadFirmware?: boolean;
  canControlOptaLab?: boolean;
  canAccessDatabase?: boolean;
  isSystem?: boolean;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  customerId?: string; // Se l'utente è un referente cliente, è associato al suo id cliente
  email?: string;
  lastLoginAt?: string;
  createdAt?: string;
  customAllowedTabs?: string[] | null;
}

export interface ApiKey {
  id: string; // es. "key-01"
  name: string; // Nome Partner / Modem (es. "Modem 4G Fornitore Alfa")
  key: string; // Token segreto es. "gb_live_..."
  description?: string;
  createdAt: string;
  lastUsedAt?: string;
  totalCalls: number;
  isActive: boolean;
}

export interface ThirdPartyTelemetryLog {
  id: string;
  timestamp: string;
  apiKeyName?: string;
  endpoint: string;
  serialNumber: string;
  machineName?: string;
  ipAddress?: string;
  productNumber?: number;
  productName?: string;
  status: 'SUCCESS' | 'ERROR';
  message: string;
  payloadSummary?: string;
}

export interface ProductOrderItem {
  canisterNumber?: number;
  itemCode?: string; // Codice Articolo (es. "ART-CAF-01")
  productName: string;
  ingredientType: string;
  quantity: number; // Quantità in Kg o Confezioni
  unit: string; // 'Kg' o 'Confezioni'
  notes?: string;
}

export interface ProductOrder {
  id: string; // es. "ORD-20261006-001"
  customerId: string;
  customerName: string;
  customerCode?: string;
  siteId: string;
  siteName: string;
  siteAddress?: string;
  recipientEmail: string; // "claudiograf@iobevo.com"
  requesterName?: string;
  requesterPhone?: string;
  requestedDeliveryDate?: string;
  notes?: string;
  items: ProductOrderItem[];
  status: 'INVIATO' | 'IN_LAVORAZIONE' | 'SPEDITO' | 'CONSEGNATO' | 'ANNULLATO';
  emailSent: boolean;
  emailError?: string;
  emailMessageId?: string;
  lastEmailAttemptAt?: string;
  createdAt: string;
}

// --- TECHNICAL SUPPORT REQUEST SYSTEM ---
export type FaultMacroArea = 'guasto_elettrico' | 'guasto_idraulico' | 'altro';

export interface SupportFaultOption {
  id: string;
  label: string;
}

export interface SupportFaultCategory {
  id: FaultMacroArea;
  label: string;
  badgeColor: string;
  description: string;
  issues: SupportFaultOption[];
}

export const SUPPORT_FAULT_CATEGORIES: SupportFaultCategory[] = [
  {
    id: 'guasto_elettrico',
    label: 'Guasto Elettrico',
    badgeColor: 'amber',
    description: 'Riscaldamento, alimentazione, relè o scatto salvavita/differenziale',
    issues: [
      { id: 'errore_riscaldamento', label: 'Errore riscaldamento' },
      { id: 'scatta_differenziale', label: 'Scatta differenziale impianto' },
    ],
  },
  {
    id: 'guasto_idraulico',
    label: 'Guasto Idraulico',
    badgeColor: 'blue',
    description: 'Perdite idriche interne, raccordi o gocciolamento beccuccio',
    issues: [
      { id: 'perdita_acqua_macchina', label: 'Perdita di acqua dalla macchina' },
      { id: 'gocciolamento_beccuccio', label: 'Gocciolamento da beccuccio/tubo uscita prodotto' },
    ],
  },
  {
    id: 'altro',
    label: 'Altro',
    badgeColor: 'purple',
    description: 'Gruppo miscelazione, polveri, intasamento o tastiera selezione',
    issues: [
      { id: 'componente_miscelazione', label: 'Danneggiato/smarrito componente gruppo miscelazione' },
      { id: 'intasamento_prodotto', label: 'Intasamento prodotto' },
      { id: 'guasto_tastiera', label: 'Guasto tastiera selezione prodotti' },
      { id: 'contenitore_danneggiato', label: 'Contenitore polvere danneggiato' },
      { id: 'altro_dettaglio', label: 'Altro' },
    ],
  },
];

export interface SupportRequest {
  id: string; // es. "TKT-20261007-001"
  customerId: string;
  customerName: string;
  customerCode?: string;
  siteId: string;
  siteName: string;
  siteAddress?: string;
  machineId?: string;
  serialNumber: string; // Matricola
  machineName?: string;
  machineModel?: string;
  macroArea: FaultMacroArea;
  macroAreaLabel: string;
  specificIssue: string;
  issueDescription?: string;
  priority?: 'NORMALE' | 'ALTA' | 'CRITICA';
  requesterName?: string;
  requesterPhone?: string;
  recipientEmail: string;
  status: 'APERTO' | 'IN_GESTIONE' | 'IN_ATTESA_RICAMBI' | 'RISOLTO' | 'CHIUSO';
  emailSent: boolean;
  emailError?: string;
  emailMessageId?: string;
  lastEmailAttemptAt?: string;
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}
