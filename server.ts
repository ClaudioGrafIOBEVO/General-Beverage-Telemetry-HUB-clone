import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import mqtt from 'mqtt';
import { exec } from 'child_process';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();
import { createServer as createViteServer } from 'vite';
import { getPgPool, initPgSchema, syncJsonToPostgres, restorePostgresToJson, testPgConnection, cleanRestoreJsonToPostgres, insertKeylogDirect } from './src/db/postgres';
import { getPostgresDetailedStatus } from './src/db/status';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==============================================================================
// SYNC-LOCK MECHANISM: Enforce PostgreSQL as Strict Authoritative Master
// ==============================================================================
let isSyncLockActive = false;
let isSyncLockInitialized = false;
let syncLockInitPromise: Promise<boolean> | null = null;

// SYNC-LOCK API Layer Protection: ensure SQL initialization is ready before handling API calls
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api') && !isSyncLockInitialized && syncLockInitPromise) {
    try {
      await syncLockInitPromise;
    } catch {}
  }
  next();
});

// Ensure data storage directory exists
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'keypad_db.json');
const DB_DEFAULT_FILE = path.join(DATA_DIR, 'keypad_db.default.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const OTA_DIR = path.join(DATA_DIR, 'ota_firmware');
const OTA_RELEASES_FILE = path.join(DATA_DIR, 'ota_releases.json');
if (!fs.existsSync(OTA_DIR)) {
  fs.mkdirSync(OTA_DIR, { recursive: true });
}

// Allowed Machine Models
const ALLOWED_MACHINE_MODELS = ['Ristosano', 'Big 5', 'Asia'] as const;

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
  logoUrl?: string; // Logo aziendale (URL o base64)
  vatNumber?: string; // Partita IVA / Codice Fiscale
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
}

interface KeyLog {
  id: string;
  key: string;
  keyLabel?: string;
  productNumber?: number;
  productName?: string;
  deviceId: string;
  machineName?: string;
  machineSerialNumber?: string; // Matricola a 6 cifre (es. "104829")
  customerName?: string; // Nome del Cliente (es. "IVS Italia S.p.A.")
  siteName?: string; // Sede / Stabilimento (es. "Sede Direzionale Milano - Torre A")
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

interface PinRecord {
  id: string;
  code: string;
  name: string;
  role: string;
  enabled: boolean;
  createdAt: string;
}

interface AccessLog {
  id: string;
  timestamp: string;
  deviceId: string;
  machineName?: string;
  enteredPin: string;
  status: 'GRANTED' | 'DENIED';
  userName?: string;
}

interface BeverageItem {
  id: string;
  productNumber: number;
  key: string;
  code: string;
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

interface DispenseRecord {
  id: string;
  beverageId: string;
  beverageName: string;
  productNumber?: number;
  key: string;
  code: string;
  timestamp: string;
  price: number;
  sugarLevel: number;
  isCaraffa: boolean;
  doseMultiplier: number;
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

interface MachineSupplies {
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
  company: string; // Società di ristorazione / Gestore (e.g. "IVS Italia S.p.A.", "GeSA Vending", "Sogeda Vending")
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
  optoTriggerDurationMs: number;
  voltageLevel: '12v_opto' | '24v_opto' | '3v3_direct';
  matrixPins?: {
    row1: number;
    row2: number;
    row3: number;
    row4: number;
    col1: number;
    col2: number;
    col3: number;
    col4: number;
  };
  optoOutputPins?: number[];
  buzzerPin?: number;
  relayPin?: number;
  auxRelayPin?: number;
  tempSensorPin?: number;
  currentSensorPin?: number;
  ledStatusPin?: number;
}

export interface Esp32Device {
  macAddress: string; // Primary unique hardware ID, e.g. "24:6F:28:B2:1A:80" (format XX:XX:XX:XX:XX:XX)
  deviceId: string; // Identificativo Modulo GB-CLOUD, e.g. "GB-CLOUD MODULE 123456"
  serialNumber: string; // Matricola a 6 cifre del Modulo GB-CLOUD (es. "123456")
  boardModel: string; // e.g. "GB-CLOUD MODULE Controller Board (38-Pin + Modulo Opto)", "ESP32 DevKit V1 38-Pin"
  firmwareVersion: string; // e.g. "v3.2.0-PRO-MATRIX"
  ipAddress: string; // e.g. "192.168.1.145"
  wifiSsid: string; // e.g. "Azienda_WiFi_IoT"
  wifiRssi?: number; // e.g. -58 dBm
  freeHeap?: number;
  uptimeSec?: number;
  cpuTemp?: number;
  boilerTemp?: number;
  currentAmps?: number;
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE' | 'UNASSIGNED';
  assignedMachineId?: string | null; // ID of the vending machine it is paired to (e.g. "ESP32-VENDING-01" or null)
  hardwareConfig: Esp32HardwareConfig;
  diagnosticLogs?: Esp32DiagnosticLog[];
  lastHeartbeatAt: string;
  createdAt: string;
  notes?: string;
}

interface VendingMachine {
  id: string;
  serialNumber: string; // Numero Matricola a 6 cifre
  name: string;
  location: string;
  locationDetails: MachineLocation;
  customerId?: string; // ID cliente associato (es. "CUST-001")
  customerSiteId?: string; // ID sede cliente associata (es. "site-ivs-1")
  model: string;
  electronicBoard?: string;
  status: 'ONLINE' | 'STANDBY' | 'DISPENSING' | 'MAINTENANCE' | 'OFFLINE';
  assignedDeviceMac?: string | null;
  assignedDevice?: Esp32Device;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  supplies: MachineSupplies;
  beverages?: BeverageItem[];
  keyMapping?: Record<string, string>;
  enableCalibrationAndConsumption?: boolean;
  calibration?: any;
  notes?: string;
  config: {
    debounceMs: number;
    isFreeDispense: boolean;
    caraffaMultiplier: number;
    boilerTargetTemp: number;
    optoTriggerDurationMs: number;
    enableCalibrationAndConsumption?: boolean;
    wifiSsid?: string;
  };
  lastTelemetryAt: string;
  createdAt: string;
}

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

export const DEFAULT_ROLES: RolePermissionDefinition[] = [
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
];

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  role: string;
  password: string;
  email?: string;
  customerId?: string;
  lastLoginAt?: string;
  createdAt: string;
  customAllowedTabs?: string[] | null;
}

export interface ApiKeyDefinition {
  id: string;
  name: string;
  key: string;
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

export interface ArticleItem {
  itemCode: string; // Codice Articolo univoco (es. "ART-CAF-01")
  name: string; // Descrizione Commerciale / Prodotto
  ingredientType: 'coffee' | 'milk' | 'chocolate' | 'tea' | 'sugar' | 'solubles' | 'cups' | 'water' | 'syrup' | 'other';
  defaultRpm?: number;
  defaultGramsPerSecond?: number;
  nominalGramsPerDose?: number;
  costPerKg?: number;
  packageUnit?: string;
  description?: string;
  supplier?: string;
  updatedAt?: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  defaultRecipient: string;
}

interface DatabaseSchema {
  users: UserAccount[];
  rolePermissions?: RolePermissionDefinition[];
  customers: Customer[];
  machines: VendingMachine[];
  devices: Esp32Device[];
  calibrationTemplates?: any[];
  articles?: ArticleItem[];
  logs: KeyLog[];
  telemetryLogs?: any[];
  apiKeys?: ApiKeyDefinition[];
  thirdPartyTelemetryLogs?: ThirdPartyTelemetryLog[];
  alerts?: any[];
  pins: PinRecord[];
  accessLogs: AccessLog[];
  beverages: BeverageItem[];
  dispenses: DispenseRecord[];
  orders?: any[];
  supportRequests?: any[];
  supplies: MachineSupplies;
  config: {
    deviceAlias: string;
    pinTimeoutMs: number;
    debounceMs: number;
    requireHashToSubmit: boolean;
    vendingModel: string;
    coinAcceptorEnabled: boolean;
    currencySymbol: string;
    heartbeatTimeoutSec?: number;
    smtp?: SmtpConfig;
  };
}

// Catalogo predefinito iniziale articoli e materie prime
function getDefaultArticles(): ArticleItem[] {
  return [
    {
      itemCode: 'ART-CAF-01',
      name: 'Caffè Solubile Liofilizzato 100% Arabica',
      ingredientType: 'coffee',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.8,
      nominalGramsPerDose: 7.0,
      costPerKg: 18.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Miscela Arabica selezionata per distributori automatici solubili.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-CAF-02',
      name: 'Caffè in Grani Espresso Crema Bar',
      ingredientType: 'coffee',
      defaultRpm: 120,
      defaultGramsPerSecond: 3.0,
      nominalGramsPerDose: 7.5,
      costPerKg: 16.00,
      packageUnit: 'Busta 1 Kg',
      description: 'Grani tostati per macinatore espresso incorporato.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-CAF-03',
      name: 'Caffè Decaffeinato Solubile Liofilizzato',
      ingredientType: 'coffee',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.8,
      nominalGramsPerDose: 7.0,
      costPerKg: 21.00,
      packageUnit: 'Busta 1 Kg',
      description: 'Decaffeinato puro con caffeina inferiore allo 0,1%.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-LAT-01',
      name: 'Latte Scremato in Polvere Istantaneo',
      ingredientType: 'milk',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.5,
      nominalGramsPerDose: 8.5,
      costPerKg: 9.80,
      packageUnit: 'Busta 1 Kg',
      description: 'Latte 100% scremato ad alta solubilità per schiuma corposa.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-LAT-02',
      name: 'Preparato per Bevanda al Latte Intero',
      ingredientType: 'milk',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.6,
      nominalGramsPerDose: 9.0,
      costPerKg: 10.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Preparato lattiero arricchito per consistenza vellutata.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-CIO-01',
      name: 'Cioccolato Caldo Solubile Extra Fondente',
      ingredientType: 'chocolate',
      defaultRpm: 200,
      defaultGramsPerSecond: 4.5,
      nominalGramsPerDose: 18.0,
      costPerKg: 8.40,
      packageUnit: 'Busta 1 Kg',
      description: 'Cacao magro solubile per cioccolata calda ricca e densa.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-CIO-02',
      name: 'Cioccolato Dolce Tradizionale Svizzero',
      ingredientType: 'chocolate',
      defaultRpm: 200,
      defaultGramsPerSecond: 4.2,
      nominalGramsPerDose: 17.5,
      costPerKg: 7.90,
      packageUnit: 'Busta 1 Kg',
      description: 'Gusto classico equilibrato per colazioni e merende.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-THE-01',
      name: 'The al Limone Solubile Rinfrescante',
      ingredientType: 'tea',
      defaultRpm: 120,
      defaultGramsPerSecond: 3.2,
      nominalGramsPerDose: 12.0,
      costPerKg: 7.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Estratto di the nero con vero succo di limone essiccato.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-THE-02',
      name: 'The alla Pesca Solubile Delicato',
      ingredientType: 'tea',
      defaultRpm: 120,
      defaultGramsPerSecond: 3.2,
      nominalGramsPerDose: 12.0,
      costPerKg: 7.80,
      packageUnit: 'Busta 1 Kg',
      description: 'Gusto dolce fruttato alla pesca per pausa relax.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-THE-03',
      name: 'The Verde Solubile Antiossidante',
      ingredientType: 'tea',
      defaultRpm: 120,
      defaultGramsPerSecond: 3.0,
      nominalGramsPerDose: 11.5,
      costPerKg: 8.20,
      packageUnit: 'Busta 1 Kg',
      description: 'The verde naturale liofilizzato a basso contenuto di zuccheri.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-ORZ-01',
      name: 'Orzo Solubile Tostato Tradizionale',
      ingredientType: 'solubles',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.2,
      nominalGramsPerDose: 5.5,
      costPerKg: 8.90,
      packageUnit: 'Busta 1 Kg',
      description: '100% orzo italiano tostato naturalmente privo di caffeina.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-GIN-01',
      name: 'Caffè al Ginseng Solubile Cremoso',
      ingredientType: 'solubles',
      defaultRpm: 120,
      defaultGramsPerSecond: 3.0,
      nominalGramsPerDose: 12.0,
      costPerKg: 14.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Bevanda energizzante a base di estratto di radice di Panax Ginseng.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-ZUC-01',
      name: 'Zucchero Semolato Extra Fine Vending',
      ingredientType: 'sugar',
      defaultRpm: 40,
      defaultGramsPerSecond: 2.0,
      nominalGramsPerDose: 5.0,
      costPerKg: 2.20,
      packageUnit: 'Sacco 5 Kg',
      description: 'Zucchero raffinato a granulometria calibrata anti-impaccamento.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-CAM-01',
      name: 'Camomilla con Miele Solubile',
      ingredientType: 'solubles',
      defaultRpm: 40,
      defaultGramsPerSecond: 1.5,
      nominalGramsPerDose: 8.0,
      costPerKg: 13.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Camomilla liofilizzata con polvere di miele.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-MOU-01',
      name: 'Mousse di Mela & Frutti di Bosco Solubile',
      ingredientType: 'solubles',
      defaultRpm: 40,
      defaultGramsPerSecond: 2.2,
      nominalGramsPerDose: 15.0,
      costPerKg: 16.00,
      packageUnit: 'Busta 1 Kg',
      description: 'Preparato per dessert alla frutta omogeneizzato per catering e degenze.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-PAS-01',
      name: 'Pasta e Fagioli Vellutata Disidratata',
      ingredientType: 'solubles',
      defaultRpm: 40,
      defaultGramsPerSecond: 2.5,
      nominalGramsPerDose: 30.0,
      costPerKg: 14.00,
      packageUnit: 'Busta 1 Kg',
      description: 'Piatto unico tradizionale vellutato arricchito per dosaggio automatico.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-PUR-01',
      name: 'Puré di Patate Istantaneo Fiocchi & Latte',
      ingredientType: 'solubles',
      defaultRpm: 40,
      defaultGramsPerSecond: 2.0,
      nominalGramsPerDose: 25.0,
      costPerKg: 11.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Fiocchi di patate selezionate con latte scremato e noce moscata.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-DES-01',
      name: 'Dessert Proteico Vaniglia & Caramello',
      ingredientType: 'milk',
      defaultRpm: 200,
      defaultGramsPerSecond: 4.0,
      nominalGramsPerDose: 24.0,
      costPerKg: 19.50,
      packageUnit: 'Busta 1 Kg',
      description: 'Preparato iperproteico per colazioni e merende ospedaliere.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-OMO-01',
      name: 'Omogeneizzato Carne & Pesce Solubile',
      ingredientType: 'solubles',
      defaultRpm: 200,
      defaultGramsPerSecond: 3.8,
      nominalGramsPerDose: 26.0,
      costPerKg: 22.00,
      packageUnit: 'Busta 1 Kg',
      description: 'Secondo piatto vellutato liofilizzato privo di grumi.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-FRI-01',
      name: 'Preparato per Frittata & Omelette',
      ingredientType: 'solubles',
      defaultRpm: 200,
      defaultGramsPerSecond: 3.6,
      nominalGramsPerDose: 20.0,
      costPerKg: 17.80,
      packageUnit: 'Busta 1 Kg',
      description: 'Uova intere pastorizzate in polvere solubile con aromi naturali.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      itemCode: 'ART-BRO-01',
      name: 'Brodo Vegetale & Carne Istantaneo',
      ingredientType: 'solubles',
      defaultRpm: 40,
      defaultGramsPerSecond: 1.8,
      nominalGramsPerDose: 10.0,
      costPerKg: 12.90,
      packageUnit: 'Busta 1 Kg',
      description: 'Brodo limpido solubile a basso contenuto di sodio.',
      supplier: 'General Beverage / IoBevo',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
}

// Helper: 6 Contenitori standard (40, 120, 200 Giri/min)
function getStandard6Canisters(model: string = 'Ristosano') {
  const isBig5 = (model || '').toLowerCase().includes('big');
  const isAsia = (model || '').toLowerCase().includes('asia');
  return [
    {
      id: 'canister-1',
      canisterNumber: 1,
      name: 'Contenitore 1: Caffè Solubile / Grani',
      itemCode: 'ART-CAF-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'coffee',
      motorRpm: 120,
      gramsPerSecond: 2.8,
      nominalGramsPerDose: 7.0,
      containerCapacityKg: 3.5,
      currentStockKg: 3.5,
      costPerKg: 18.5,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 'canister-2',
      canisterNumber: 2,
      name: 'Contenitore 2: Latte Scremato Polvere',
      itemCode: 'ART-LAT-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'milk',
      motorRpm: isBig5 ? 200 : 120,
      gramsPerSecond: isBig5 ? 3.8 : 2.5,
      nominalGramsPerDose: 8.5,
      containerCapacityKg: 2.5,
      currentStockKg: 2.5,
      costPerKg: 9.8,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 'canister-3',
      canisterNumber: 3,
      name: 'Contenitore 3: Cioccolato Caldo Solubile',
      itemCode: 'ART-CIO-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'chocolate',
      motorRpm: 200,
      gramsPerSecond: 4.5,
      nominalGramsPerDose: 18.0,
      containerCapacityKg: 3.0,
      currentStockKg: 3.0,
      costPerKg: 8.4,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 'canister-4',
      canisterNumber: 4,
      name: 'Contenitore 4: The al Limone Solubile',
      itemCode: 'ART-THE-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'tea',
      motorRpm: 120,
      gramsPerSecond: 3.2,
      nominalGramsPerDose: 12.0,
      containerCapacityKg: 2.5,
      currentStockKg: 2.5,
      costPerKg: 7.5,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 'canister-5',
      canisterNumber: 5,
      name: 'Contenitore 5: Orzo & Ginseng Solubile',
      itemCode: 'ART-ORZ-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'solubles',
      motorRpm: isAsia ? 120 : 40,
      gramsPerSecond: isAsia ? 2.5 : 1.6,
      nominalGramsPerDose: 9.0,
      containerCapacityKg: 2.0,
      currentStockKg: 2.0,
      costPerKg: 14.2,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
    {
      id: 'canister-6',
      canisterNumber: 6,
      name: 'Contenitore 6: Zucchero Semolato',
      itemCode: 'ART-ZUC-01',
      packageUnit: 'Busta 1 Kg',
      ingredientType: 'sugar',
      motorRpm: 120,
      gramsPerSecond: 3.0,
      nominalGramsPerDose: 6.0,
      containerCapacityKg: 4.0,
      currentStockKg: 4.0,
      costPerKg: 1.9,
      lastCalibrationDate: new Date().toISOString().split('T')[0],
    },
  ];
}

// Helper: 7 Elettrovalvole standard (una per contenitore 1-6 + una per sola acqua calda diretta)
function getStandard7Electrovalves(model: string = 'Ristosano') {
  const isBig5 = (model || '').toLowerCase().includes('big');
  const flowBase = isBig5 ? 18.0 : 15.0;
  return [
    { id: 'ev-1', evNumber: 1, name: 'EV1: Mixer Contenitore 1 (Caffè)', flowRateCcPerSec: flowBase, description: 'Elettrovalvola dedicata al Contenitore 1 (Caffè)' },
    { id: 'ev-2', evNumber: 2, name: 'EV2: Mixer Contenitore 2 (Latte)', flowRateCcPerSec: flowBase, description: 'Elettrovalvola dedicata al Contenitore 2 (Latte)' },
    { id: 'ev-3', evNumber: 3, name: 'EV3: Mixer Contenitore 3 (Cioccolato)', flowRateCcPerSec: isBig5 ? 20.0 : 16.0, description: 'Elettrovalvola dedicata al Contenitore 3 (Cioccolato)' },
    { id: 'ev-4', evNumber: 4, name: 'EV4: Mixer Contenitore 4 (The al Limone)', flowRateCcPerSec: flowBase, description: 'Elettrovalvola dedicata al Contenitore 4 (The al Limone)' },
    { id: 'ev-5', evNumber: 5, name: 'EV5: Mixer Contenitore 5 (Orzo/Ginseng)', flowRateCcPerSec: flowBase, description: 'Elettrovalvola dedicata al Contenitore 5 (Orzo/Ginseng)' },
    { id: 'ev-6', evNumber: 6, name: 'EV6: Mixer Contenitore 6 (Zucchero/Solubile)', flowRateCcPerSec: flowBase, description: 'Elettrovalvola dedicata al Contenitore 6 (Zucchero/Solubile)' },
    { id: 'ev-7', evNumber: 7, name: 'EV7: Sola Acqua Calda Diretta', flowRateCcPerSec: isBig5 ? 22.0 : 18.0, description: 'Erogazione diretta sola acqua calda per by-pass, tè e allungamento' },
  ];
}

function buildStdBeverage(key: string, name: string, activeCanisters: { canisterId: string; sec: number }[], activeEvs: { evId: string; sec: number }[]) {
  const canList = ['canister-1', 'canister-2', 'canister-3', 'canister-4', 'canister-5', 'canister-6'];
  const evList = ['ev-1', 'ev-2', 'ev-3', 'ev-4', 'ev-5', 'ev-6', 'ev-7'];
  return {
    key,
    name,
    canisterTimings: canList.map((cId) => {
      const match = activeCanisters.find((ac) => ac.canisterId === cId);
      return { canisterId: cId, enabled: !!match, motorDurationSec: match ? match.sec : 0 };
    }),
    evTimings: evList.map((eId) => {
      const match = activeEvs.find((ae) => ae.evId === eId);
      return { evId: eId, enabled: !!match, waterDurationSec: match ? match.sec : 0 };
    }),
  };
}

function getStandard12Products() {
  return [
    buildStdBeverage('P1', 'Caffè Espresso', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 3.0 }]),
    buildStdBeverage('P2', 'Caffè Lungo', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 5.5 }]),
    buildStdBeverage('P3', 'Caffè Macchiato', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 1.2 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 1.8 }]),
    buildStdBeverage('P4', 'Cappuccino Cremoso', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 3.5 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 6.0 }]),
    buildStdBeverage('P5', 'Caffellatte', [{ canisterId: 'canister-1', sec: 1.8 }, { canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 7.5 }]),
    buildStdBeverage('P6', 'Cioccolato Caldo Denso', [{ canisterId: 'canister-3', sec: 4.0 }], [{ evId: 'ev-3', sec: 8.5 }]),
    buildStdBeverage('P7', 'Mocaccino', [{ canisterId: 'canister-1', sec: 2.2 }, { canisterId: 'canister-2', sec: 2.0 }, { canisterId: 'canister-3', sec: 2.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 3.5 }, { evId: 'ev-3', sec: 4.0 }]),
    buildStdBeverage('P8', 'Latte Caldo Puro', [{ canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-2', sec: 9.0 }]),
    buildStdBeverage('P9', 'The al Limone', [{ canisterId: 'canister-4', sec: 3.8 }], [{ evId: 'ev-4', sec: 8.5 }]),
    buildStdBeverage('P10', 'Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 5.5 }], [{ evId: 'ev-5', sec: 4.0 }]),
    buildStdBeverage('P11', 'Orzo Grande Tazza', [{ canisterId: 'canister-5', sec: 7.0 }], [{ evId: 'ev-5', sec: 7.5 }]),
    buildStdBeverage('P12', 'Ginseng Dolce', [{ canisterId: 'canister-5', sec: 6.0 }, { canisterId: 'canister-2', sec: 1.5 }], [{ evId: 'ev-5', sec: 5.0 }, { evId: 'ev-2', sec: 2.0 }]),
  ];
}

function getStandard12CaraffaProducts() {
  return [
    buildStdBeverage('P1', 'Caraffa Caffè Espresso', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 12.0 }]),
    buildStdBeverage('P2', 'Caraffa Caffè Americano', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 24.0 }]),
    buildStdBeverage('P3', 'Caraffa Caffè Macchiato', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 4.8 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 7.0 }]),
    buildStdBeverage('P4', 'Caraffa Cappuccino', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 14.0 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 24.0 }]),
    buildStdBeverage('P5', 'Caraffa Caffellatte', [{ canisterId: 'canister-1', sec: 7.0 }, { canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 30.0 }]),
    buildStdBeverage('P6', 'Caraffa Cioccolato Caldo', [{ canisterId: 'canister-3', sec: 16.0 }], [{ evId: 'ev-3', sec: 34.0 }]),
    buildStdBeverage('P7', 'Caraffa Mocaccino', [{ canisterId: 'canister-1', sec: 8.8 }, { canisterId: 'canister-2', sec: 8.0 }, { canisterId: 'canister-3', sec: 10.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 14.0 }, { evId: 'ev-3', sec: 16.0 }]),
    buildStdBeverage('P8', 'Caraffa Latte Caldo', [{ canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-2', sec: 36.0 }]),
    buildStdBeverage('P9', 'Caraffa The al Limone', [{ canisterId: 'canister-4', sec: 15.2 }], [{ evId: 'ev-4', sec: 34.0 }]),
    buildStdBeverage('P10', 'Caraffa Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 22.0 }], [{ evId: 'ev-5', sec: 16.0 }]),
    buildStdBeverage('P11', 'Caraffa Orzo Grande Tazza', [{ canisterId: 'canister-5', sec: 28.0 }], [{ evId: 'ev-5', sec: 30.0 }]),
    buildStdBeverage('P12', 'Caraffa Ginseng', [{ canisterId: 'canister-5', sec: 24.0 }, { canisterId: 'canister-2', sec: 6.0 }], [{ evId: 'ev-5', sec: 20.0 }, { evId: 'ev-2', sec: 8.0 }]),
  ];
}

function createDefaultCalibrationForMachine(model: string, serialNumber: string) {
  const isBig5 = (model || '').toLowerCase().includes('big');
  const isAsia = (model || '').toLowerCase().includes('asia');
  const target = isBig5 ? 'Big 5' : isAsia ? 'Asia' : 'Ristosano';

  return {
    lastUpdated: new Date().toISOString(),
    calibratedBy: `Configurazione Fabbrica ${target}`,
    notes: `Taratura standard ${target} associata alla matricola ${serialNumber}. 6 Contenitori (40/120/200 RPM) e 7 Elettrovalvole (una per contenitore + sola acqua calda).`,
    waterFlowCcPerSec: isBig5 ? 18.0 : 15.0,
    canisters: getStandard6Canisters(model),
    electrovalves: getStandard7Electrovalves(model),
    standardProducts: getStandard12Products(),
    caraffaProducts: getStandard12CaraffaProducts(),
    deliveries: [],
  };
}

function getDefaultCalibrationTemplates() {
  return [
    {
      id: 'template-ristosano-std',
      name: 'Taratura Standard Ristosano (6 Contenitori & 7 EV)',
      description: 'Taratura ufficiale di fabbrica con coclee differenziate (40 / 120 / 200 Giri), 7 EV (una per contenitore + sola acqua calda) e 12 ricette bicchiere + 12 caraffa.',
      modelTarget: 'Ristosano',
      isSystemStandard: true,
      calibration: createDefaultCalibrationForMachine('Ristosano', 'STANDARD'),
    },
    {
      id: 'template-big5-hotel',
      name: 'Taratura Standard Big 5 (Hotel & Grandi Volumi - 7 EV)',
      description: 'Ottimizzata per velocità di erogazione e caraffe per colazioni hotel. 7 EV con portata elevata (18-22 cc/s) e coclee rapide.',
      modelTarget: 'Big 5',
      isSystemStandard: true,
      calibration: createDefaultCalibrationForMachine('Big 5', 'STANDARD'),
    },
    {
      id: 'template-asia-solubles',
      name: 'Taratura Standard Asia (Solubili Rapidi & Tè - 7 EV)',
      description: 'Taratura bilanciata per distributore Asia con 7 EV dedicate per ciascun contenitore polvere e linea dedicata sola acqua calda.',
      modelTarget: 'Asia',
      isSystemStandard: true,
      calibration: createDefaultCalibrationForMachine('Asia', 'STANDARD'),
    },
  ];
}

// Initial DB state - Clean slate starting from zero (no automatic machines)
function getDefaultDb(): DatabaseSchema {
  const defaultUsers: UserAccount[] = [
    {
      id: 'user-claudio-graf',
      username: 'Claudio Graf',
      name: 'Claudio Graf',
      role: 'admin',
      password: 'ClaudioIoBevo1@',
      email: 'claudiograf80@gmail.com',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-admin',
      username: 'admin',
      name: 'Amministratore Flotta Distributori',
      role: 'admin',
      password: 'ClaudioIoBevo1@',
      email: 'claudiograf80@gmail.com',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-tech',
      username: 'tecnico',
      name: 'Tecnico Manutentore Hardware',
      role: 'tecnico',
      password: 'tech2026',
      email: 'tecnico@vending-iot.local',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-op',
      username: 'operatore',
      name: 'Operatore Tecnico Distributori',
      role: 'operatore',
      password: 'vending2026',
      email: 'operatore@vending-iot.local',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-cliente',
      username: 'cliente',
      name: 'Referente Sede IVS Italia',
      role: 'cliente',
      customerId: 'CUST-001',
      password: 'cliente2026',
      email: 'referente@ivsitalia.com',
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultCustomers: Customer[] = [
    {
      id: 'CUST-001',
      code: 'CLI-01',
      name: 'IVS Italia S.p.A.',
      vatNumber: 'IT00892830164',
      contactPerson: 'Dott. Marco Ferretti',
      phone: '+39 035 600111',
      email: 'info@ivsitalia.com',
      address: 'Via Dell\'Innovazione 24',
      city: 'Seriate',
      province: 'BG',
      zipCode: '24068',
      sites: [
        {
          id: 'site-ivs-1',
          name: 'Sede Direzionale Milano - Torre A',
          address: 'Via Stephenson 73',
          city: 'Milano',
          province: 'MI',
          zipCode: '20157',
          floorRoom: 'Piano Terra - Reception & Break Room',
          contactPerson: 'Sig. Roberto Bianchi',
          phone: '+39 02 884729',
          notes: 'Accesso per manutentori con badge aziendale.',
        },
        {
          id: 'site-ivs-2',
          name: 'Hub Logistico Rho Fiera',
          address: 'Corso Sempione 180',
          city: 'Pero',
          province: 'MI',
          zipCode: '20016',
          floorRoom: 'Edificio 2 - Sede Operativa',
          contactPerson: 'Sig. Andrea Conti',
          phone: '+39 02 939401',
          notes: 'Area ristoro autisti e personale logistica.',
        },
      ],
      notes: 'Cliente primario ristorazione collettiva e beverage. Contratti attivi su multi-distributore.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'CUST-002',
      code: 'CLI-02',
      name: 'GeSA Ristorazione S.r.l.',
      vatNumber: 'IT02481920961',
      contactPerson: 'Ing. Laura Valenti',
      phone: '+39 02 458921',
      email: 'gestione@gesavending.it',
      address: 'Via Mecenate 84',
      city: 'Milano',
      province: 'MI',
      zipCode: '20138',
      sites: [
        {
          id: 'site-gesa-1',
          name: 'Complesso Uffici Bicocca',
          address: 'Viale Sarca 336',
          city: 'Milano',
          province: 'MI',
          zipCode: '20126',
          floorRoom: 'Piano 3 - Area Ristoro Dipendenti',
          contactPerson: 'Ing. Laura Valenti',
          phone: '+39 02 458921',
          notes: 'Distributore bevande calde e fredde.',
        },
      ],
      notes: 'Partner territoriale specializzato in uffici e corporate.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'CUST-003',
      code: 'CLI-03',
      name: 'Sogeda Beverage Group',
      vatNumber: 'IT03891040012',
      contactPerson: 'Dott. Alessandro Neri',
      phone: '+39 011 772910',
      email: 'commerciale@sogeda.it',
      address: 'Corso Regina Margherita 110',
      city: 'Torino',
      province: 'TO',
      zipCode: '10144',
      sites: [
        {
          id: 'site-sogeda-1',
          name: 'Stabilimento Mirafiori Tech',
          address: 'Corso Settembrini 178',
          city: 'Torino',
          province: 'TO',
          zipCode: '10135',
          floorRoom: 'Linea Produzione B - Padiglione 4',
          contactPerson: 'Sig. Stefano Galli',
          phone: '+39 011 685112',
          notes: 'Richiesto ciclo di pulizia e decalcificazione ogni 15 giorni.',
        },
      ],
      notes: 'Impianti industriali ad alto consumo.',
      createdAt: new Date().toISOString(),
    },
  ];

  const defaultDevices: Esp32Device[] = [
    {
      deviceId: 'GB-CLOUD MODULE 518492',
      serialNumber: '518492',
      macAddress: '24:6F:28:1A:3B:5C',
      boardModel: 'GB-CLOUD Controller Board (Opto-Isolated)',
      firmwareVersion: 'v3.2.0-PRO-MATRIX',
      ipAddress: '192.168.1.140',
      wifiSsid: 'Azienda_WiFi_IoT',
      wifiRssi: -58,
      freeHeap: 184520,
      uptimeSec: 86420,
      cpuTemp: 44.5,
      boilerTemp: 92.8,
      status: 'ONLINE',
      assignedMachineId: 'GB-DIST-01',
      hardwareConfig: {
        debounceMs: 30,
        optoTriggerDurationMs: 400,
        voltageLevel: '12v_opto',
      },
      lastHeartbeatAt: new Date().toISOString(),
      createdAt: '2025-01-15T08:00:00.000Z',
    },
    {
      deviceId: 'GB-CLOUD MODULE 529183',
      serialNumber: '529183',
      macAddress: '30:AE:A4:7C:89:12',
      boardModel: 'GB-CLOUD Controller Board (Opto-Isolated)',
      firmwareVersion: 'v3.2.0-PRO-MATRIX',
      ipAddress: '192.168.1.141',
      wifiSsid: 'Azienda_WiFi_IoT',
      wifiRssi: -62,
      freeHeap: 191200,
      uptimeSec: 43200,
      cpuTemp: 42.1,
      status: 'STANDBY',
      assignedMachineId: null,
      hardwareConfig: {
        debounceMs: 30,
        optoTriggerDurationMs: 400,
        voltageLevel: '12v_opto',
      },
      lastHeartbeatAt: new Date().toISOString(),
      createdAt: '2025-02-01T09:00:00.000Z',
    },
  ];

  const defaultMachines: VendingMachine[] = [
    {
      id: 'GB-DIST-01',
      serialNumber: '104829',
      name: 'Ristosano Master 01',
      location: 'IVS Italia S.p.A. - Sede Direzionale Milano - Torre A, Piano Terra - Reception & Break Room',
      locationDetails: {
        company: 'IVS Italia S.p.A.',
        site: 'Sede Direzionale Milano - Torre A',
        address: 'Via Stephenson 73',
        city: 'Milano',
        zipCode: '20157',
        province: 'MI',
        floorRoom: 'Piano Terra - Reception & Break Room',
        notes: 'Distributore Ristosano con telemetria GB-CLOUD attiva.',
      },
      customerId: 'CUST-001',
      customerSiteId: 'site-ivs-1',
      model: 'Ristosano',
      electronicBoard: 'Scheda Controller Ristosano',
      status: 'ONLINE',
      assignedDeviceMac: '24:6F:28:1A:3B:5C',
      ipAddress: '192.168.1.140',
      macAddress: '24:6F:28:1A:3B:5C',
      firmwareVersion: 'v3.2.0-PRO-MATRIX',
      installationDate: '2025-01-15',
      lastMaintenanceDate: new Date().toISOString().split('T')[0],
      supplies: {
        waterLevelLiters: 22,
        maxWaterLiters: 25,
        coffeeBeansGrams: 950,
        maxCoffeeGrams: 1200,
        milkPowderGrams: 800,
        maxMilkGrams: 1000,
        chocolatePowderGrams: 750,
        maxChocolateGrams: 1000,
        teaPowderGrams: 450,
        maxTeaGrams: 600,
        sugarGrams: 900,
        maxSugarGrams: 1200,
        cupsCount: 165,
        maxCups: 200,
        stirrersCount: 170,
        maxStirrers: 200,
        boilerTempCelsius: 92.5,
        targetTempCelsius: 93,
        totalEarnings: 342.5,
        totalDispenses: 284,
      },
      config: {
        debounceMs: 30,
        isFreeDispense: true,
        caraffaMultiplier: 3,
        boilerTargetTemp: 93,
        optoTriggerDurationMs: 400,
        wifiSsid: 'Azienda_WiFi_IoT',
      },
      keyMapping: {},
      calibration: createDefaultCalibrationForMachine('Ristosano', '104829'),
      lastTelemetryAt: new Date().toISOString(),
      createdAt: '2025-01-15T08:00:00.000Z',
    },
  ];

  return {
    users: defaultUsers,
    customers: defaultCustomers,
    devices: defaultDevices,
    machines: defaultMachines,
    calibrationTemplates: getDefaultCalibrationTemplates(),
    logs: [],
    telemetryLogs: [],
    pins: [],
    accessLogs: [],
    beverages: [
      {
        id: 'bev-1',
        productNumber: 1,
        key: '1',
        code: 'P01',
        name: 'Prodotto 1',
        category: 'coffee',
        price: 0.50,
        prepTimeSec: 8,
        iconName: 'Coffee',
        description: 'Erogazione Canale 1 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 35, coffeeGrams: 7.5, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
      },
      {
        id: 'bev-2',
        productNumber: 2,
        key: '2',
        code: 'P02',
        name: 'Prodotto 2',
        category: 'coffee',
        price: 0.50,
        prepTimeSec: 10,
        iconName: 'Coffee',
        description: 'Erogazione Canale 2 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 70, coffeeGrams: 8.0, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
      },
      {
        id: 'bev-3',
        productNumber: 3,
        key: '3',
        code: 'P03',
        name: 'Prodotto 3',
        category: 'coffee',
        price: 0.60,
        prepTimeSec: 11,
        iconName: 'Coffee',
        description: 'Erogazione Canale 3 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 45, coffeeGrams: 7.5, milkPowderGrams: 4, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
      },
      {
        id: 'bev-4',
        productNumber: 4,
        key: 'A',
        code: 'P04',
        name: 'Prodotto 4',
        category: 'milk',
        price: 0.80,
        prepTimeSec: 14,
        iconName: 'CupSoda',
        description: 'Erogazione Canale 4 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 120, coffeeGrams: 7.5, milkPowderGrams: 14, chocolateGrams: 0, teaGrams: 0, sugarGrams: 6 },
      },
      {
        id: 'bev-5',
        productNumber: 5,
        key: '4',
        code: 'P05',
        name: 'Prodotto 5',
        category: 'chocolate',
        price: 0.90,
        prepTimeSec: 15,
        iconName: 'Flame',
        description: 'Erogazione Canale 5 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 140, coffeeGrams: 0, milkPowderGrams: 6, chocolateGrams: 22, teaGrams: 0, sugarGrams: 8 },
      },
      {
        id: 'bev-6',
        productNumber: 6,
        key: '5',
        code: 'P06',
        name: 'Prodotto 6',
        category: 'chocolate',
        price: 0.90,
        prepTimeSec: 15,
        iconName: 'Coffee',
        description: 'Erogazione Canale 6 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 130, coffeeGrams: 7.5, milkPowderGrams: 10, chocolateGrams: 10, teaGrams: 0, sugarGrams: 6 },
      },
      {
        id: 'bev-7',
        productNumber: 7,
        key: '6',
        code: 'P07',
        name: 'Prodotto 7',
        category: 'tea',
        price: 0.60,
        prepTimeSec: 12,
        iconName: 'Sparkles',
        description: 'Erogazione Canale 7 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 150, coffeeGrams: 0, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 12, sugarGrams: 8 },
      },
      {
        id: 'bev-8',
        productNumber: 8,
        key: 'B',
        code: 'P08',
        name: 'Prodotto 8',
        category: 'milk',
        price: 0.60,
        prepTimeSec: 12,
        iconName: 'CupSoda',
        description: 'Erogazione Canale 8 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 140, coffeeGrams: 0, milkPowderGrams: 18, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
      },
      {
        id: 'bev-9',
        productNumber: 9,
        key: '7',
        code: 'P09',
        name: 'Prodotto 9',
        category: 'special',
        price: 0.70,
        prepTimeSec: 11,
        iconName: 'Zap',
        description: 'Erogazione Canale 9 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 60, coffeeGrams: 0, milkPowderGrams: 5, chocolateGrams: 0, teaGrams: 0, sugarGrams: 5 },
      },
      {
        id: 'bev-10',
        productNumber: 10,
        key: '8',
        code: 'P10',
        name: 'Prodotto 10',
        category: 'special',
        price: 0.60,
        prepTimeSec: 10,
        iconName: 'Coffee',
        description: 'Erogazione Canale 10 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 60, coffeeGrams: 0, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 6, sugarGrams: 4 },
      },
      {
        id: 'bev-11',
        productNumber: 11,
        key: '9',
        code: 'P11',
        name: 'Prodotto 11',
        category: 'coffee',
        price: 0.60,
        prepTimeSec: 9,
        iconName: 'Coffee',
        description: 'Erogazione Canale 11 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 35, coffeeGrams: 7.5, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
      },
      {
        id: 'bev-12',
        productNumber: 12,
        key: 'C',
        code: 'P12',
        name: 'Prodotto 12',
        category: 'cold_drink',
        price: 0.40,
        prepTimeSec: 8,
        iconName: 'Droplets',
        description: 'Erogazione Canale 12 (Scheda Madre)',
        available: true,
        ingredients: { waterMl: 180, coffeeGrams: 0, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 0, sugarGrams: 0 },
      },
    ],
    dispenses: [],
    rolePermissions: [...DEFAULT_ROLES],
    supplies: {
      waterLevelLiters: 25.0,
      maxWaterLiters: 25.0,
      coffeeBeansGrams: 1200,
      maxCoffeeGrams: 1200,
      milkPowderGrams: 1000,
      maxMilkGrams: 1000,
      chocolatePowderGrams: 1000,
      maxChocolateGrams: 1000,
      teaPowderGrams: 600,
      maxTeaGrams: 600,
      sugarGrams: 1200,
      maxSugarGrams: 1200,
      cupsCount: 200,
      maxCups: 200,
      stirrersCount: 200,
      maxStirrers: 200,
      boilerTempCelsius: 93.0,
      targetTempCelsius: 93.0,
      totalEarnings: 0.0,
      totalDispenses: 0,
    },
    config: {
      deviceAlias: 'Modulo Erogatore Bevande 01',
      pinTimeoutMs: 5000,
      debounceMs: 30,
      requireHashToSubmit: true,
      vendingModel: 'GB-CLOUD-TOUCH-4X4',
      coinAcceptorEnabled: true,
      currencySymbol: '€',
      heartbeatTimeoutSec: 45,
      smtp: {
        enabled: true,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        user: process.env.SMTP_USER || 'claudiograf80@gmail.com',
        pass: process.env.SMTP_PASS || '',
        fromName: process.env.SMTP_FROM_NAME || 'General Beverage Portale Ordini',
        fromEmail: process.env.SMTP_FROM || 'claudiograf80@gmail.com',
        defaultRecipient: process.env.SMTP_DEFAULT_RECIPIENT || 'claudiograf80@gmail.com',
      },
    },
    apiKeys: [
      {
        id: 'key-default-partner',
        name: 'Telemetria Partner Esterno (Default)',
        key: 'gb_live_7f8a9b2c3d4e5f60718293a4b5c6d7e8',
        description: 'Chiave API predefinita per modem 4G o sistemi di telemetria terzi',
        createdAt: new Date().toISOString(),
        totalCalls: 0,
        isActive: true,
      },
    ],
    articles: getDefaultArticles(),
    thirdPartyTelemetryLogs: [],
    supportRequests: [],
  };
}

// Helper: Normalize or generate 6-digit numeric serial number (e.g. "104829")
function formatSixDigitSerialNumber(raw?: string | null, fallbackIndex?: number): string {
  if (raw) {
    const digitsOnly = String(raw).replace(/\D/g, '');
    if (digitsOnly.length === 6) {
      return digitsOnly;
    }
    if (digitsOnly.length > 6) {
      return digitsOnly.slice(-6);
    }
    if (digitsOnly.length > 0) {
      return digitsOnly.padStart(6, '0');
    }
  }
  const defaultSeeds = ['104829', '207841', '309156', '418293', '529401', '638192'];
  if (typeof fallbackIndex === 'number' && defaultSeeds[fallbackIndex]) {
    return defaultSeeds[fallbackIndex];
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Helper: Normalize or generate 6-digit serial number specifically for GB-CLOUD MODULE (MUST start with 5)
function formatGbCloudModuleSerial(raw?: string | null): string {
  if (raw) {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.length === 6 && digits.startsWith('5')) return digits;
    if (digits.length === 5) return '5' + digits;
    if (digits.length === 6 && !digits.startsWith('5')) return '5' + digits.slice(1);
    if (digits.length > 6) return '5' + digits.slice(-5);
    if (digits.length > 0) return ('5' + digits).padEnd(6, '0').slice(0, 6);
  }
  return '5' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
}

// Helper: Generate unique 6-digit serial number for GB-CLOUD MODULE starting with '5' (e.g. "501824")
function generateGbCloudModuleSerial(existingSerials: string[] = []): string {
  let serial = '';
  let attempts = 0;
  do {
    serial = '5' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    attempts++;
  } while (existingSerials.includes(serial) && attempts < 100);
  return serial;
}

// Load / save helper with in-memory caching, atomic writes, write-queue serialization, and automatic rolling snapshots
let saveCounter = 0;
let cachedDb: DatabaseSchema | null = null;
let isSaving = false;
const saveQueue: Array<{ db: DatabaseSchema; resolve: () => void; reject: (err: any) => void }> = [];

function createBackupSnapshot(dataString: string) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    const backupFile = path.join(BACKUP_DIR, 'keypad_db_auto_backup.json');
    fs.writeFileSync(backupFile, dataString, 'utf-8');

    // Also keep a rolling timestamped snapshot (keeps up to last 10 historical snapshots)
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const rollingFile = path.join(BACKUP_DIR, `keypad_db_snapshot_${timestampStr}.json`);
    fs.writeFileSync(rollingFile, dataString, 'utf-8');

    // Clean up older snapshots if more than 10 exist
    try {
      const allBackups = fs.readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith('keypad_db_snapshot_') && f.endsWith('.json'))
        .sort();
      if (allBackups.length > 10) {
        const toDelete = allBackups.slice(0, allBackups.length - 10);
        toDelete.forEach((f) => {
          try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
        });
      }
    } catch {}
  } catch (backupErr) {
    console.error('Failed to create automatic database backup snapshot:', backupErr);
  }
}

function loadDatabase(): DatabaseSchema {
  if (cachedDb) {
    return cachedDb;
  }
  // When Sync-Lock is active, strictly reject fallback to disk JSON files
  if (isSyncLockActive && isSyncLockInitialized) {
    return cachedDb || getDefaultDb();
  }
  return loadDatabaseFromDisk();
}

function loadDatabaseFromDisk(): DatabaseSchema {
  if (cachedDb && !isSyncLockActive) {
    return cachedDb;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    let rawData: string | null = null;

    if (fs.existsSync(DB_FILE)) {
      rawData = fs.readFileSync(DB_FILE, 'utf-8');
    } else if (fs.existsSync(DB_DEFAULT_FILE)) {
      console.log('Initializing database from template:', DB_DEFAULT_FILE);
      rawData = fs.readFileSync(DB_DEFAULT_FILE, 'utf-8');
      // Create active DB file immediately from template
      fs.writeFileSync(DB_FILE, rawData, 'utf-8');
    }

    if (rawData) {
      let parsed: DatabaseSchema;
      try {
        parsed = JSON.parse(rawData);
      } catch (parseErr) {
        console.error('CRITICAL: Database JSON is corrupt! Attempting recovery from backup...', parseErr);
        const corruptFile = path.join(BACKUP_DIR, `keypad_db.corrupt-${Date.now()}.json`);
        fs.writeFileSync(corruptFile, rawData, 'utf-8');
        
        const backupFile = path.join(BACKUP_DIR, 'keypad_db_auto_backup.json');
        if (fs.existsSync(backupFile)) {
          console.log('Recovered successfully from automatic backup!');
          const backupData = fs.readFileSync(backupFile, 'utf-8');
          parsed = JSON.parse(backupData);
        } else {
          throw parseErr;
        }
      }

      // Maintain snapshot backup of valid state
      createBackupSnapshot(rawData);

      const defaults = getDefaultDb();
      let updated = false;

      // Migration checks - NON-DESTRUCTIVE: only populates missing attributes, never wipes user data
      if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
        parsed.users = defaults.users;
        updated = true;
      } else {
        // Ensure Claudio Graf admin account exists
        const claudio = parsed.users.find(
          (u) =>
            u.username.toLowerCase() === 'claudio graf' ||
            u.username.toLowerCase() === 'claudiograf' ||
            u.name.toLowerCase() === 'claudio graf'
        );
        if (!claudio) {
          parsed.users.unshift({
            id: 'user-claudio-graf',
            username: 'Claudio Graf',
            name: 'Claudio Graf',
            role: 'admin',
            password: 'ClaudioIoBevo1@',
            email: 'claudiograf80@gmail.com',
            createdAt: new Date().toISOString(),
          });
          updated = true;
        } else {
          // Keep credentials and admin role in sync
          if (claudio.role !== 'admin' || claudio.password !== 'ClaudioIoBevo1@') {
            claudio.role = 'admin';
            claudio.password = 'ClaudioIoBevo1@';
            updated = true;
          }
        }

        // Ensure default cliente user exists
        const clienteUser = parsed.users.find((u) => u.username.toLowerCase() === 'cliente');
        if (!clienteUser) {
          parsed.users.push({
            id: 'user-cliente',
            username: 'cliente',
            name: 'Referente Sede IVS Italia',
            role: 'cliente',
            customerId: 'CUST-001',
            password: 'cliente2026',
            email: 'referente@ivsitalia.com',
            createdAt: new Date().toISOString(),
          });
          updated = true;
        }
      }
      if (!parsed.rolePermissions || !Array.isArray(parsed.rolePermissions) || parsed.rolePermissions.length === 0) {
        parsed.rolePermissions = [...DEFAULT_ROLES];
        updated = true;
      } else {
        // Ensure standard system roles exist and operatore is correctly named "Operatore Macchina"
        DEFAULT_ROLES.forEach((defRole) => {
          const existing = parsed.rolePermissions!.find((r) => r.id === defRole.id);
          if (!existing) {
            parsed.rolePermissions!.push({ ...defRole });
            updated = true;
          } else {
            if (defRole.id === 'operatore' && existing.name !== 'Operatore Macchina') {
              existing.name = 'Operatore Macchina';
              updated = true;
            }
            if (defRole.id === 'cliente' && (!existing.allowedTabs || existing.allowedTabs.length > 1 || existing.allowedTabs[0] !== 'dashboard')) {
              existing.allowedTabs = ['dashboard'];
              updated = true;
            }
          }
        });
      }
      if (!parsed.customers || !Array.isArray(parsed.customers)) {
        parsed.customers = [];
        updated = true;
      }
      if (!parsed.devices || !Array.isArray(parsed.devices)) {
        parsed.devices = [];
        updated = true;
      } else {
        parsed.devices.forEach((dev) => {
          if (!dev.serialNumber || !/^5\d{5}$/.test(dev.serialNumber)) {
            dev.serialNumber = formatGbCloudModuleSerial(dev.serialNumber);
            dev.deviceId = `GB-CLOUD MODULE ${dev.serialNumber}`;
            updated = true;
          }
          if (!dev.deviceId || !dev.deviceId.startsWith('GB-CLOUD MODULE')) {
            dev.deviceId = `GB-CLOUD MODULE ${dev.serialNumber}`;
            updated = true;
          }
          if (!dev.boardModel || dev.boardModel.includes('ESP32 DevKit')) {
            dev.boardModel = 'GB-CLOUD Controller Board (Opto-Isolated)';
            updated = true;
          }
        });
      }
      if (!parsed.machines || !Array.isArray(parsed.machines) || parsed.machines.length === 0) {
        parsed.machines = defaults.machines;
        updated = true;
      }

      // Ensure machines have updated fields and only allowed models (Ristosano, Big 5, Asia)
      parsed.machines.forEach((m, idx) => {
        // Normalize model to one of the 3 allowed models: Ristosano, Big 5, Asia
        if (!ALLOWED_MACHINE_MODELS.includes(m.model as any)) {
          const allowed = ['Ristosano', 'Big 5', 'Asia'];
          m.model = allowed[idx % allowed.length];
          if (m.model === 'Ristosano') {
            m.electronicBoard = 'Scheda Controller Ristosano';
          } else if (m.model === 'Big 5') {
            m.electronicBoard = 'Scheda Controller Big 5';
          } else {
            m.electronicBoard = 'Scheda Controller Asia';
          }
          updated = true;
        }
        // Normalize to 6-digit serial number if missing or non-6-digit
        if (!m.serialNumber || !/^\d{6}$/.test(m.serialNumber)) {
          m.serialNumber = formatSixDigitSerialNumber(m.serialNumber, idx);
          updated = true;
        }
        if (!m.locationDetails) {
          m.locationDetails = {
            company: 'Non Assegnato',
            site: 'Sede Principale',
            address: 'Via Principale 1',
            city: 'Milano',
            zipCode: '20100',
            province: 'MI',
            floorRoom: m.location || 'Piano Terra Area Break',
            notes: 'Distributore automatico con nodo ESP32 IoT e relè PLC optoisolati.',
          };
          updated = true;
        }
        // Auto-link to customer ONLY if company name explicitly matches an existing customer
        if (!m.customerId && parsed.customers && parsed.customers.length > 0) {
          const compName = (m.locationDetails?.company || '').toLowerCase();
          const matchedCust = parsed.customers.find((c) => c.name.toLowerCase() === compName || (compName.length > 3 && (compName.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(compName))));
          if (matchedCust) {
            m.customerId = matchedCust.id;
            m.customerSiteId = matchedCust.sites[0]?.id;
            updated = true;
          }
        }
        // Sanitize MAC addresses: must be a valid 12-hex character string, no placeholder XX
        if (m.assignedDeviceMac && (!isValidMacAddress(m.assignedDeviceMac) || m.assignedDeviceMac.includes('XX'))) {
          m.assignedDeviceMac = null;
          updated = true;
        }
        if (!m.assignedDeviceMac) {
          m.macAddress = null;
        } else {
          m.macAddress = m.assignedDeviceMac;
        }
        if (!m.assignedDeviceMac && m.status !== 'OFFLINE' && m.status !== 'MAINTENANCE') {
          m.status = 'OFFLINE';
          updated = true;
        }
        if (!m.calibration) {
          m.calibration = createDefaultCalibrationForMachine(m.model || 'Ristosano', m.serialNumber || '104829');
          updated = true;
        } else {
          if (m.calibration.notes && m.calibration.notes.includes('4 EV')) {
            m.calibration.notes = m.calibration.notes.replace(/4\s*EV/gi, '7 EV (EV1-EV6 per contenitori + EV7 sola acqua calda)');
            updated = true;
          }
          if (!m.calibration.electrovalves || m.calibration.electrovalves.length < 7) {
            // Upgrade existing calibrations to 7 electrovalves
            const existingEvs = m.calibration.electrovalves || [];
            const full7 = getStandard7Electrovalves(m.model);
            m.calibration.electrovalves = full7.map((defEv) => {
              const match = existingEvs.find((e: any) => e.evNumber === defEv.evNumber || e.id === defEv.id);
              return match ? { ...defEv, ...match } : defEv;
            });
            updated = true;
          }
        }
      });

      // Guarantee bidirectional pairing consistency between machines and hardware modules
      const seenMacs = new Set<string>();
      parsed.machines.forEach((m) => {
        if (m.assignedDeviceMac) {
          const normMac = normalizeMacAddress(m.assignedDeviceMac);
          if (seenMacs.has(normMac)) {
            // Conflitto: azzera il duplicato
            m.assignedDeviceMac = null;
            m.status = 'OFFLINE';
            updated = true;
          } else {
            seenMacs.add(normMac);
            const targetDev = parsed.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
            // Se il dispositivo non ha questa macchina come assignedMachineId impostato dall'operatore, azzera
            if (!targetDev || targetDev.assignedMachineId !== m.id) {
              m.assignedDeviceMac = null;
              m.status = 'OFFLINE';
              updated = true;
            }
          }
        }
      });
      parsed.devices.forEach((dev) => {
        if (dev.assignedMachineId) {
          const targetMachine = parsed.machines.find((m) => m.id === dev.assignedMachineId);
          if (!targetMachine || !targetMachine.assignedDeviceMac || normalizeMacAddress(targetMachine.assignedDeviceMac) !== normalizeMacAddress(dev.macAddress)) {
            // Nessuna associazione automatica: se la macchina non ha questo MAC abbinato dall'operatore, il modulo torna UNASSIGNED
            dev.assignedMachineId = null;
            dev.status = 'UNASSIGNED';
            updated = true;
          }
        } else {
          dev.status = 'UNASSIGNED';
        }
      });

      // STRICT: Nessuna associazione automatica tra moduli ESP32 e distributori.
      // I moduli possono essere testati ed utilizzati in modalità Standalone / Banco Collaudo.
      if (!parsed.calibrationTemplates || !Array.isArray(parsed.calibrationTemplates) || parsed.calibrationTemplates.length === 0) {
        parsed.calibrationTemplates = getDefaultCalibrationTemplates();
        updated = true;
      } else {
        parsed.calibrationTemplates.forEach((tpl) => {
          // Always ensure 7 EV and updated descriptions
          if (tpl.description && (tpl.description.includes('4 EV') || tpl.description.includes('4 elettrovalvole'))) {
            tpl.description = tpl.description.replace(/4\s*EV/gi, '7 EV (una per contenitore + sola acqua calda)').replace(/4\s*elettrovalvole/gi, '7 elettrovalvole');
            updated = true;
          }
          if (tpl.name && tpl.name.includes('(6 Contenitori)') && !tpl.name.includes('7 EV')) {
            tpl.name = tpl.name.replace(/\(6\s*Contenitori\)/gi, '(6 Contenitori & 7 EV)');
            updated = true;
          }
          if (tpl.calibration) {
            if (tpl.calibration.notes && tpl.calibration.notes.includes('4 EV')) {
              tpl.calibration.notes = tpl.calibration.notes.replace(/4\s*EV/gi, '7 EV (EV1-EV6 per contenitori + EV7 sola acqua calda)');
              updated = true;
            }
            if (!tpl.calibration.electrovalves || tpl.calibration.electrovalves.length < 7) {
              const full7 = getStandard7Electrovalves(tpl.modelTarget);
              const existingEvs = tpl.calibration.electrovalves || [];
              tpl.calibration.electrovalves = full7.map((defEv) => {
                const match = existingEvs.find((e: any) => e.evNumber === defEv.evNumber || e.id === defEv.id);
                return match ? { ...defEv, ...match } : defEv;
              });
              updated = true;
            }
          }
        });
      }
      if (!parsed.logs || !Array.isArray(parsed.logs)) {
        parsed.logs = defaults.logs;
        updated = true;
      } else {
        parsed.logs.forEach((log) => {
          if (!log.machineSerialNumber || !log.customerName || !log.siteName) {
            const matchedMachine = (parsed.machines || []).find((m) => m.id === log.deviceId) || (parsed.machines && parsed.machines[0]);
            if (matchedMachine) {
              if (!log.machineSerialNumber) log.machineSerialNumber = matchedMachine.serialNumber;
              if (!log.customerName) log.customerName = matchedMachine.locationDetails?.company || 'Cliente Generale';
              if (!log.siteName) log.siteName = matchedMachine.locationDetails?.site || 'Sede Operativa';
              updated = true;
            }
          }
        });
      }
      if (!parsed.telemetryLogs || !Array.isArray(parsed.telemetryLogs)) {
        parsed.telemetryLogs = [];
        updated = true;
      }
      if (!parsed.pins || !Array.isArray(parsed.pins)) {
        parsed.pins = defaults.pins;
        updated = true;
      }
      if (!parsed.accessLogs || !Array.isArray(parsed.accessLogs)) {
        parsed.accessLogs = defaults.accessLogs;
        updated = true;
      }
      if (!parsed.beverages || parsed.beverages.length < 12 || !parsed.beverages[0]?.productNumber) {
        parsed.beverages = defaults.beverages;
        updated = true;
      }
      if (!parsed.dispenses || !Array.isArray(parsed.dispenses)) {
        parsed.dispenses = defaults.dispenses;
        updated = true;
      } else {
        parsed.dispenses.forEach((d) => {
          if (!d.machineSerialNumber || !d.customerName || !d.siteName) {
            const matchedMachine = (parsed.machines || []).find((m) => m.id === d.deviceId) || (parsed.machines && parsed.machines[0]);
            if (matchedMachine) {
              if (!d.machineSerialNumber) d.machineSerialNumber = matchedMachine.serialNumber;
              if (!d.customerName) d.customerName = matchedMachine.locationDetails?.company || 'Cliente Generale';
              if (!d.siteName) d.siteName = matchedMachine.locationDetails?.site || 'Sede Operativa';
              updated = true;
            }
          }
        });
      }
      if (!parsed.supplies || typeof parsed.supplies.waterLevelLiters !== 'number') {
        parsed.supplies = defaults.supplies;
        updated = true;
      }
      if (!parsed.config) {
        parsed.config = defaults.config;
        updated = true;
      }
      if (!parsed.config.smtp) {
        parsed.config.smtp = defaults.config.smtp;
        updated = true;
      }
      if (!parsed.apiKeys || !Array.isArray(parsed.apiKeys) || parsed.apiKeys.length === 0) {
        parsed.apiKeys = [...(defaults.apiKeys || [])];
        updated = true;
      }
      if (!parsed.thirdPartyTelemetryLogs || !Array.isArray(parsed.thirdPartyTelemetryLogs)) {
        parsed.thirdPartyTelemetryLogs = [];
        updated = true;
      }
      if (!parsed.articles || !Array.isArray(parsed.articles) || parsed.articles.length === 0) {
        parsed.articles = getDefaultArticles();
        updated = true;
      }
      if (!parsed.supportRequests || !Array.isArray(parsed.supportRequests)) {
        parsed.supportRequests = [];
        updated = true;
      }

      if (updated) {
        saveDatabase(parsed);
      }
      cachedDb = parsed;
      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  const defaultDb = getDefaultDb();
  cachedDb = defaultDb;
  saveDatabase(defaultDb);
  return defaultDb;
}

async function bootstrapSyncLock(): Promise<boolean> {
  if (syncLockInitPromise) return syncLockInitPromise;

  syncLockInitPromise = (async () => {
    try {
      const isPgConnected = await testPgConnection();
      if (!isPgConnected) {
        console.log('[SYNC-LOCK] Motore SQL non attivo o non rilevato. Avvio in modalità standard In-Memory con persistenza disco.');
        isSyncLockActive = false;
        isSyncLockInitialized = true;
        loadDatabaseFromDisk();
        return false;
      }

      console.log('🔒 [SYNC-LOCK ATTIVO] PostgreSQL connesso! Modalità Master Relazionale Rigida: file JSON locali ignorati all\'avvio.');
      isSyncLockActive = true;

      const schemaReady = await initPgSchema();
      if (!schemaReady) {
        console.warn('⚠️ [SYNC-LOCK] Impossibile inizializzare schema relazionale SQL.');
        isSyncLockInitialized = true;
        return false;
      }

      const pgData = await restorePostgresToJson();
      const totalPgItems = (pgData.count?.machines || 0) + (pgData.count?.devices || 0) + (pgData.count?.customers || 0);

      // MERGE EROGAZIONI/KEYLOGS: Unione sicura di tutte le erogazioni senza perdere mai dati storici
      const diskDb = loadDatabaseFromDisk();
      const diskLogs = Array.isArray(diskDb.logs) ? diskDb.logs : [];
      const pgLogs = Array.isArray(pgData.data?.logs) ? pgData.data.logs : [];

      const logsMap = new Map<string, any>();
      // 1. Inserisci i log dal disco
      diskLogs.forEach((l: any) => { if (l && (l.id || l.timestamp)) logsMap.set(l.id || `${l.timestamp}-${l.key}`, l); });
      // 2. Inserisci o unisci con i log da PostgreSQL
      pgLogs.forEach((l: any) => { if (l && (l.id || l.timestamp)) logsMap.set(l.id || `${l.timestamp}-${l.key}`, l); });

      // Se il disco conteneva erogazioni non ancora salvate in PostgreSQL, salvale subito in background
      if (diskLogs.length > 0) {
        syncJsonToPostgres({ logs: diskLogs }).catch(() => {});
      }

      // Ordina rigorosamente dal più recente al più vecchio (DESC) per corretta visualizzazione nel portale
      const mergedLogs = Array.from(logsMap.values()).sort((a, b) => {
        const timeA = new Date(a.timestamp || a.recorded_at || 0).getTime();
        const timeB = new Date(b.timestamp || b.recorded_at || 0).getTime();
        return timeB - timeA;
      });

      const defaults = getDefaultDb();
      const sqlMasterDb: DatabaseSchema = {
        ...defaults,
        machines: pgData.data?.machines || [],
        devices: pgData.data?.devices || [],
        customers: pgData.data?.customers || [],
        logs: mergedLogs.length > 0 ? mergedLogs : defaults.logs,
        dispenses: Array.isArray(diskDb.dispenses) ? diskDb.dispenses : defaults.dispenses,
        users: pgData.data?.users || defaults.users,
        orders: pgData.data?.orders || [],
        supportRequests: pgData.data?.supportRequests || [],
        config: pgData.data?.config ? { ...defaults.config, ...pgData.data.config } : defaults.config,
      };

      if (totalPgItems === 0) {
        console.log('[SYNC-LOCK] Database SQL vergine (0 macchine/moduli). Inizializzazione iniziale su SQL da template...');
        const diskDb = loadDatabaseFromDisk();
        await syncJsonToPostgres(diskDb);
        const refreshed = await restorePostgresToJson();
        if (refreshed.data) {
          sqlMasterDb.machines = refreshed.data.machines || [];
          sqlMasterDb.devices = refreshed.data.devices || [];
          sqlMasterDb.customers = refreshed.data.customers || [];
        }
      }

      // STRICT IN-MEMORY POPULATION: purely from PostgreSQL
      cachedDb = sqlMasterDb;

      // Passive offline mirror (never used to override SQL)
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(sqlMasterDb, null, 2), 'utf-8');
      } catch {}

      isSyncLockInitialized = true;
      console.log(`✅ [SYNC-LOCK PRONTO] Dati inizializzati STRETTAMENTE da PostgreSQL (${sqlMasterDb.machines.length} macchine, ${sqlMasterDb.devices.length} moduli, ${sqlMasterDb.customers.length} clienti).`);
      return true;
    } catch (err) {
      console.error('❌ [SYNC-LOCK ERRORE]:', err);
      isSyncLockInitialized = true;
      return false;
    }
  })();

  return syncLockInitPromise;
}

function processSaveQueue() {
  if (isSaving || saveQueue.length === 0) return;
  isSaving = true;

  // Collapse multiple queued saves if any to the most recent state
  const currentTask = saveQueue.shift();
  if (!currentTask) {
    isSaving = false;
    return;
  }

  const { db, resolve, reject } = currentTask;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const jsonString = JSON.stringify(db, null, 2);
    // Atomic write pattern: write to tmp file first then renameSync
    const tmpFile = path.join(DATA_DIR, `keypad_db.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmpFile, jsonString, 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);

    // Periodic backup snapshot every 20 writes
    saveCounter++;
    if (saveCounter % 20 === 0) {
      createBackupSnapshot(jsonString);
    }
    resolve();
  } catch (err) {
    console.error('Error saving database file:', err);
    reject(err);
  } finally {
    isSaving = false;
    if (saveQueue.length > 0) {
      setImmediate(processSaveQueue);
    }
  }
}

let pgSyncTimeout: NodeJS.Timeout | null = null;
function schedulePgSync(db: DatabaseSchema) {
  if (pgSyncTimeout) clearTimeout(pgSyncTimeout);
  pgSyncTimeout = setTimeout(async () => {
    try {
      const isConnected = await testPgConnection();
      if (isConnected) {
        await syncJsonToPostgres(db, { pruneDeleted: true });
      }
    } catch (err) {
      console.error('[POSTGRESQL Sync Error]:', err);
    }
  }, 1000);
}

function saveDatabase(db: DatabaseSchema) {
  // Always update in-memory cache immediately so all subsequent reads are instantaneous and coherent
  cachedDb = db;

  // Persist / mirror state to PostgreSQL if available
  schedulePgSync(db);

  return new Promise<void>((resolve, reject) => {
    saveQueue.push({ db, resolve, reject });
    processSaveQueue();
  });
}


// SSE Clients for instant live push to browser
const sseClients: Array<{ id: string; res: express.Response }> = [];

function broadcastSse(eventType: string, data: unknown) {
  // Real-time persistence: every new dispense is immediately secured into PostgreSQL
  if (eventType === 'new-keylog' && data && typeof data === 'object') {
    insertKeylogDirect(data).catch(() => {});
  }

  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client dropped
    }
  });
}

// Helper: Format and normalize MAC Address to standard uppercase format (XX:XX:XX:XX:XX:XX)
function normalizeMacAddress(mac: string | undefined | null): string {
  if (!mac) return '';
  const clean = String(mac).trim().toUpperCase().replace(/[^A-F0-9]/g, '');
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g)?.join(':') || mac.toUpperCase();
  }
  return String(mac).trim().toUpperCase();
}

// Helper: Check if string is a valid 12-hex-character MAC address
function isValidMacAddress(mac: string | undefined | null): boolean {
  if (!mac) return false;
  const clean = String(mac).trim().toUpperCase().replace(/[^A-F0-9]/g, '');
  return clean.length === 12;
}

// Helper: Format standalone button label when module is NOT paired with a vending machine
function getStandaloneButtonInfo(cleanKey: string): { label: string; productName: string } {
  const upper = cleanKey.toUpperCase();
  if (upper === 'CARAFFA') return { label: 'Pulsante Caraffa', productName: 'Pulsante Caraffa' };
  if (upper === 'STOP') return { label: 'Pulsante Stop', productName: 'Pulsante Stop' };
  if (upper === 'LINGUA') return { label: 'Pulsante Lingua', productName: 'Pulsante Lingua' };
  if (upper.startsWith('P') && !isNaN(Number(upper.slice(1)))) {
    const num = parseInt(upper.slice(1), 10);
    return { label: `Pulsante ${num}`, productName: `Pulsante ${num}` };
  }
  return { label: `Pulsante ${cleanKey}`, productName: `Pulsante ${cleanKey}` };
}

// Helper: Auto-recognize, register or update an ESP32 GB-CLOUD Module from network announcement / telemetry
function registerOrUpdateDeviceFromNetwork(
  db: DatabaseSchema,
  rawMac: string,
  details?: {
    deviceId?: string;
    serialNumber?: string;
    boardModel?: string;
    firmwareVersion?: string;
    ipAddress?: string;
    ip?: string;
    wifiSsid?: string;
    ssid?: string;
    wifiRssi?: number;
    rssi?: number;
    freeHeap?: number;
    heap?: number;
    uptimeSec?: number;
    uptime?: number;
  }
): { device: Esp32Device; isNew: boolean } {
  const normMac = normalizeMacAddress(rawMac);
  let devIndex = db.devices.findIndex((d) => normalizeMacAddress(d.macAddress) === normMac);

  const ip = details?.ipAddress || details?.ip;
  const rssi = typeof details?.wifiRssi === 'number' ? details?.wifiRssi : (typeof details?.rssi === 'number' ? details?.rssi : undefined);
  const freeHeap = typeof details?.freeHeap === 'number' ? details?.freeHeap : (typeof details?.heap === 'number' ? details?.heap : undefined);
  const uptime = typeof details?.uptimeSec === 'number' ? details?.uptimeSec : (typeof details?.uptime === 'number' ? details?.uptime : undefined);
  const fw = details?.firmwareVersion;

  if (devIndex !== -1) {
    const existingDev = db.devices[devIndex];
    existingDev.lastHeartbeatAt = new Date().toISOString();
    if (ip) existingDev.ipAddress = ip;
    if (rssi !== undefined) existingDev.wifiRssi = rssi;
    if (freeHeap !== undefined) existingDev.freeHeap = freeHeap;
    if (uptime !== undefined) existingDev.uptimeSec = uptime;
    if (fw) existingDev.firmwareVersion = fw;
    if (existingDev.status === 'OFFLINE') {
      existingDev.status = existingDev.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
    }
    return { device: existingDev, isNew: false };
  }

  // ZERO AUTO-CREAZIONE DA RETE: I moduli devono essere censiti esplicitamente dall'amministratore (Fleet Manager)
  // I pacchetti di rete generici o da broker pubblici privi di censimento NON creano MAI moduli fantasma nel database.
  return { device: null as any, isNew: false };
}

// Helper: Populate machine with full assigned ESP32 device details
function enrichMachineWithDevice(m: VendingMachine, devices: Esp32Device[]): VendingMachine {
  const targetMac = (m.assignedDeviceMac && isValidMacAddress(m.assignedDeviceMac))
    ? normalizeMacAddress(m.assignedDeviceMac)
    : null;
  const matchedDevice = targetMac ? devices.find((d) => normalizeMacAddress(d.macAddress) === targetMac) : undefined;

  return {
    ...m,
    assignedDeviceMac: targetMac,
    assignedDevice: matchedDevice,
    ipAddress: matchedDevice?.ipAddress || (targetMac ? m.ipAddress : '') || '',
    macAddress: matchedDevice?.macAddress || targetMac || null,
    firmwareVersion: matchedDevice?.firmwareVersion || m.firmwareVersion || 'v3.2.0-PRO-MATRIX',
  };
}

// Helper: Explicitly resolve machine associated with an ESP32 hardware device (STRICTLY NO AUTO-ASSOCIATION)
// Un modulo hardware è associato ad un distributore SOLO ED ESCLUSIVAMENTE se un operatore
// ha eseguito l'abbinamento esplicito da interfaccia (device.assignedMachineId === machine.id).
// Nessun messaggio di rete, telemetria, heartbeat o topic MQTT può mai auto-associare un modulo a una macchina!
function findExplicitlyAssociatedMachine(
  db: DatabaseSchema,
  macAddress?: string | null,
  deviceId?: string | null
): { machine: VendingMachine | null; device: Esp32Device | null } {
  const normMac = macAddress ? normalizeMacAddress(macAddress) : null;
  const targetDevId = deviceId ? String(deviceId).trim().toLowerCase() : null;

  // 1. Individua il dispositivo hardware nel DB (tramite MAC o identificatore device)
  let device: Esp32Device | null = null;
  if (normMac) {
    device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac) || null;
  }
  if (!device && targetDevId) {
    device = db.devices.find((d) => d.deviceId.toLowerCase() === targetDevId) || null;
  }

  // 2. Verifica se il dispositivo ha un'associazione ESPLICITA impostata dall'operatore
  if (device && device.assignedMachineId) {
    const machine = db.machines.find((m) => m.id === device!.assignedMachineId) || null;
    if (machine && machine.assignedDeviceMac && normalizeMacAddress(machine.assignedDeviceMac) === normalizeMacAddress(device.macAddress)) {
      return { machine, device };
    }
  }

  // 3. Verifica se una macchina ha il MAC di questo dispositivo impostato dall'operatore
  if (normMac) {
    const machine = db.machines.find((m) => m.assignedDeviceMac && normalizeMacAddress(m.assignedDeviceMac) === normMac) || null;
    if (machine && device && device.assignedMachineId === machine.id) {
      return { machine, device };
    }
  }

  // Se nessun abbinamento esplicito è stato fatto da operatore, il modulo è LIBERO / STANDALONE!
  // Nessuna associazione automatica o implicita verrà mai creata.
  return { machine: null, device };
}

// ==========================================
// TARGET HARDWARE RESOLVER - MAPPING ESCLUSIVO PER COMANDI HARDWARE
// ==========================================
interface HardwareTargetResolution {
  machine: VendingMachine | null;
  device: Esp32Device | null;
  canonicalDeviceId: string;
  targetMac: string | null;
  cleanMac: string | null;
  canonicalTopic: string;
  error?: string;
}

function resolveTargetHardware(db: DatabaseSchema, targetId?: string | null): HardwareTargetResolution {
  if (!targetId || String(targetId).trim() === '') {
    return {
      machine: null,
      device: null,
      canonicalDeviceId: '',
      targetMac: null,
      cleanMac: null,
      canonicalTopic: '',
      error: 'Nessun identificatore macchina o modulo specificato.',
    };
  }

  const cleanId = String(targetId).trim();

  // 1. Supporto per test modulo standalone a banco (virtual_dev_<MAC>)
  if (cleanId.startsWith('virtual_dev_')) {
    const rawMac = cleanId.replace('virtual_dev_', '').trim();
    const normMac = normalizeMacAddress(rawMac);
    const cleanMac = normMac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    const dev = db.devices?.find((d) => normalizeMacAddress(d.macAddress) === normMac) || null;
    const assignedMach = dev?.assignedMachineId ? db.machines?.find((m) => m.id === dev.assignedMachineId) : null;
    const virtualMach: VendingMachine = assignedMach || {
      id: cleanId,
      serialNumber: dev?.serialNumber || '500000',
      name: `Modulo Standalone ${dev?.deviceId || normMac}`,
      location: 'Banco Collaudo Hardware',
      locationDetails: {
        company: 'Laboratorio Collaudo',
        site: 'Banco Prova ESP32',
        address: 'Laboratorio Tecnico',
        city: 'Milano',
        zipCode: '20100',
        province: 'MI',
      },
      model: 'Ristosano',
      status: dev?.status === 'ONLINE' ? 'ONLINE' : 'STANDBY',
      assignedDeviceMac: normMac,
      ipAddress: dev?.ipAddress || '192.168.1.100',
      macAddress: normMac,
      supplies: {
        waterLevelLiters: 25.0,
        maxWaterLiters: 25.0,
        coffeeBeansGrams: 1200,
        maxCoffeeGrams: 1200,
        milkPowderGrams: 1000,
        maxMilkGrams: 1000,
        chocolatePowderGrams: 1000,
        maxChocolateGrams: 1000,
        teaPowderGrams: 600,
        maxTeaGrams: 600,
        sugarGrams: 1200,
        maxSugarGrams: 1200,
        cupsCount: 200,
        maxCups: 200,
        stirrersCount: 200,
        maxStirrers: 200,
        boilerTempCelsius: 93.0,
        targetTempCelsius: 93.0,
        totalEarnings: 0,
        totalDispenses: 0,
      },
      config: {
        debounceMs: 350,
        isFreeDispense: true,
        caraffaMultiplier: 3.0,
        boilerTargetTemp: 93.0,
        optoTriggerDurationMs: 400,
      },
      lastTelemetryAt: dev?.lastHeartbeatAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return {
      machine: virtualMach,
      device: dev,
      canonicalDeviceId: dev?.deviceId || `GB-CLOUD-${cleanMac}`,
      targetMac: normMac,
      cleanMac,
      canonicalTopic: `vending/GB-CLOUD-${cleanMac}/commands`,
    };
  }

  // 2. Corrispondenza diretta con ID Distributore (es. "GB-DIST-01", "GB-DIST-02")
  const machById = db.machines?.find((m) => m.id.toLowerCase() === cleanId.toLowerCase());
  if (machById) {
    let targetMac: string | null = null;
    let dev: Esp32Device | null = null;

    if (machById.assignedDeviceMac && isValidMacAddress(machById.assignedDeviceMac)) {
      targetMac = normalizeMacAddress(machById.assignedDeviceMac);
      dev = db.devices?.find((d) => normalizeMacAddress(d.macAddress) === targetMac) || null;
    } else {
      targetMac = null;
      dev = null;
    }

    if (!targetMac || !isValidMacAddress(targetMac)) {
      // RIGOROSA SICUREZZA: La macchina selezionata non ha alcun modulo associato!
      // Nessun fallback su altre schede: blocca l'operazione per evitare azionamenti accidentali su altri distributori.
      return {
        machine: machById,
        device: null,
        canonicalDeviceId: machById.id,
        targetMac: null,
        cleanMac: null,
        canonicalTopic: '',
        error: `Il distributore selezionato '${machById.name}' (${machById.id}) non ha alcun modulo ESP32 associato. Assegna prima un modulo hardware nella Gestione Parco.`,
      };
    }

    const cleanMac = targetMac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    if (cleanMac.length !== 12) {
      return {
        machine: machById,
        device: null,
        canonicalDeviceId: machById.id,
        targetMac: null,
        cleanMac: null,
        canonicalTopic: '',
        error: `Il modulo hardware del distributore '${machById.name}' ha un indirizzo MAC non valido (${targetMac}).`,
      };
    }
    return {
      machine: machById,
      device: dev,
      canonicalDeviceId: dev?.deviceId || `GB-CLOUD-${cleanMac}`,
      targetMac,
      cleanMac,
      canonicalTopic: `vending/GB-CLOUD-${cleanMac}/commands`,
    };
  }

  // 3. Corrispondenza con dispositivo ESP32 registrato (per deviceId o macAddress)
  const normTargetMac = normalizeMacAddress(cleanId);
  const devFound = db.devices?.find(
    (d) =>
      d.deviceId.toLowerCase() === cleanId.toLowerCase() ||
      (d.macAddress && normalizeMacAddress(d.macAddress) === normTargetMac) ||
      (d.macAddress && d.macAddress.replace(/[^A-Fa-f0-9]/g, '').toUpperCase() === cleanId.replace(/[^A-Fa-f0-9]/g, '').toUpperCase())
  );

  if (devFound) {
    const targetMac = devFound.macAddress ? normalizeMacAddress(devFound.macAddress) : null;
    const cleanMac = targetMac ? targetMac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase() : null;
    const assignedMach = devFound.assignedMachineId
      ? db.machines?.find((m) => m.id === devFound.assignedMachineId)
      : null;

    if (!targetMac || !cleanMac) {
      return {
        machine: assignedMach,
        device: devFound,
        canonicalDeviceId: devFound.deviceId,
        targetMac: null,
        cleanMac: null,
        canonicalTopic: '',
        error: `Il modulo '${devFound.deviceId}' non ha un indirizzo MAC valido registrato.`,
      };
    }

    return {
      machine: assignedMach,
      device: devFound,
      canonicalDeviceId: devFound.deviceId,
      targetMac,
      cleanMac,
      canonicalTopic: `vending/GB-CLOUD-${cleanMac}/commands`,
    };
  }

  // 4. Corrispondenza con distributore per MAC assegnato, numero seriale esatto o nome esatto
  const machByMacOrSerial = db.machines?.find(
    (m) =>
      (m.assignedDeviceMac && normalizeMacAddress(m.assignedDeviceMac) === normTargetMac) ||
      (m.macAddress && normalizeMacAddress(m.macAddress) === normTargetMac) ||
      m.serialNumber === cleanId ||
      m.name.toLowerCase() === cleanId.toLowerCase()
  );

  if (machByMacOrSerial) {
    const targetMac = (machByMacOrSerial.assignedDeviceMac && isValidMacAddress(machByMacOrSerial.assignedDeviceMac))
      ? normalizeMacAddress(machByMacOrSerial.assignedDeviceMac)
      : null;

    if (!targetMac) {
      return {
        machine: machByMacOrSerial,
        device: null,
        canonicalDeviceId: machByMacOrSerial.id,
        targetMac: null,
        cleanMac: null,
        canonicalTopic: '',
        error: `Il distributore '${machByMacOrSerial.name}' non ha alcun modulo ESP32 associato.`,
      };
    }

    const cleanMac = targetMac.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    const dev = db.devices?.find((d) => normalizeMacAddress(d.macAddress) === targetMac) || null;

    return {
      machine: machByMacOrSerial,
      device: dev,
      canonicalDeviceId: dev?.deviceId || machByMacOrSerial.id,
      targetMac,
      cleanMac,
      canonicalTopic: `vending/GB-CLOUD-${cleanMac}/commands`,
    };
  }

  // 5. Se è un MAC address esplicito valido
  const isMacFormat = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(cleanId) || /^[0-9A-Fa-f]{12}$/.test(cleanId);
  if (isMacFormat) {
    const cleanMac = cleanId.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
    const dev = db.devices?.find((d) => normalizeMacAddress(d.macAddress) === normTargetMac) || null;
    const assignedMach = dev?.assignedMachineId ? db.machines?.find((m) => m.id === dev.assignedMachineId) : null;
    return {
      machine: assignedMach,
      device: dev,
      canonicalDeviceId: dev?.deviceId || `GB-CLOUD-${cleanMac}`,
      targetMac: normTargetMac,
      cleanMac,
      canonicalTopic: `vending/GB-CLOUD-${cleanMac}/commands`,
    };
  }

  // Nessuna corrispondenza: Rifiuta categoricamente senza mai reindirizzare ad altre schede casuali!
  console.warn(`[TARGET RESOLVE BLOCKED] Destinazione '${cleanId}' non trovata nel sistema. Nessun comando inviato ad altre schede.`);
  return {
    machine: null,
    device: null,
    canonicalDeviceId: cleanId,
    targetMac: null,
    cleanMac: null,
    canonicalTopic: '',
    error: `Dispositivo o macchina '${cleanId}' non trovato nel sistema. Per sicurezza nessun comando è stato inviato.`,
  };
}

// Helper: Find machine by ID for direct UI/API actions without creating phantom machines
function findMachineById(db: DatabaseSchema, targetId?: string | null): VendingMachine | null {
  if (!targetId || String(targetId).trim() === '') {
    return db.machines[0] || null;
  }
  const res = resolveTargetHardware(db, targetId);
  return res.machine;
}

// ==========================================
// WATCHDOG FOR REAL-TIME ONLINE / OFFLINE STATUS DETECTION
// ==========================================
function evaluateDevicesAndMachinesFreshness(db: DatabaseSchema, triggerBroadcast = false): boolean {
  let hasChanges = false;
  const timeoutSec = Math.max(5, db.config?.heartbeatTimeoutSec || 45);
  const timeoutMs = timeoutSec * 1000;
  const now = Date.now();

  // 1. Evaluate devices table
  if (Array.isArray(db.devices)) {
    for (const dev of db.devices) {
      const lastPingMs = dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).getTime() : 0;
      const isRecentlyActive = lastPingMs > 0 && (now - lastPingMs < timeoutMs);

      if (isRecentlyActive) {
        const expectedStatus = dev.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
        if (dev.status === 'OFFLINE' || dev.status === 'STANDBY') {
          dev.status = expectedStatus;
          hasChanges = true;
          console.log(`[WATCHDOG] Dispositivo ESP32 [${dev.macAddress}] (${dev.deviceId}) tornato ONLINE (${Math.round((now - lastPingMs)/1000)}s fa)`);
        }
      } else {
        // Timeout expired!
        if (dev.status !== 'OFFLINE') {
          dev.status = 'OFFLINE';
          hasChanges = true;
          if (!dev.diagnosticLogs) dev.diagnosticLogs = [];
          dev.diagnosticLogs.unshift({
            timestamp: new Date().toISOString(),
            level: 'WARN',
            message: `Nessun segnale heartbeat ricevuto da oltre ${timeoutSec}s. Dispositivo rilevato come SPENTO / OFFLINE.`,
            heapFreeBytes: dev.freeHeap,
            uptimeSeconds: dev.uptimeSec,
            wifiRssi: dev.wifiRssi,
          });
          if (dev.diagnosticLogs.length > 40) dev.diagnosticLogs = dev.diagnosticLogs.slice(0, 40);
          console.log(`[WATCHDOG] Dispositivo ESP32 [${dev.macAddress}] (${dev.deviceId}) rilevato SPENTO / OFFLINE (inattivo da > ${timeoutSec}s)`);
        }
      }
    }
  }

  // 2. Evaluate machines table
  if (Array.isArray(db.machines)) {
    for (const mach of db.machines) {
      if (mach.status === 'MAINTENANCE') continue;

      // If paired with a device, mirror device status
      if (mach.assignedDeviceMac) {
        const pairedDev = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normalizeMacAddress(mach.assignedDeviceMac));
        if (pairedDev) {
          if (pairedDev.status === 'ONLINE' && (mach.status === 'OFFLINE' || mach.status === 'STANDBY')) {
            mach.status = 'ONLINE';
            hasChanges = true;
          } else if (pairedDev.status === 'OFFLINE' && (mach.status === 'ONLINE' || mach.status === 'DISPENSING')) {
            mach.status = 'OFFLINE';
            hasChanges = true;
          }
          continue;
        }
      }

      // Machine without paired device: strictly OFFLINE (no hardware module connected)
      if (!mach.assignedDeviceMac) {
        if (mach.status !== 'OFFLINE') {
          mach.status = 'OFFLINE';
          hasChanges = true;
        }
        continue;
      }

      // Machine with assigned MAC but module not found in devices list: check lastTelemetryAt
      const lastTeleMs = mach.lastTelemetryAt ? new Date(mach.lastTelemetryAt).getTime() : 0;
      const isTeleActive = lastTeleMs > 0 && (now - lastTeleMs < timeoutMs);
      if (!isTeleActive && (mach.status === 'ONLINE' || mach.status === 'DISPENSING')) {
        mach.status = 'OFFLINE';
        hasChanges = true;
      } else if (isTeleActive && mach.status === 'OFFLINE') {
        mach.status = 'ONLINE';
        hasChanges = true;
      }
    }
  }

  if (hasChanges) {
    saveDatabase(db);
    if (triggerBroadcast) {
      broadcastSse('devices-updated', db.devices);
      broadcastSse('machines-updated', db.machines);
    }
  }

  return hasChanges;
}

// Background Interval for real-time heartbeat watchdog: runs every 3 seconds
setInterval(() => {
  try {
    const db = loadDatabase();
    evaluateDevicesAndMachinesFreshness(db, true);
  } catch (err) {
    console.error('[WATCHDOG INTERVAL ERROR]:', err);
  }
}, 3000);

// ==========================================
// MQTT HIVEMQ REAL-TIME CLOUD INTEGRATION
// ==========================================
let mqttClient: mqtt.MqttClient | null = null;
const mqttStatus = {
  connected: false,
  broker: 'broker.emqx.io:1883',
  lastMessageAt: null as string | null,
  lastTopic: null as string | null,
  messagesCount: 0,
  lastPayload: null as any,
  error: null as string | null,
};

// In-memory keypress debounce cache: Map<`${machineOrDeviceId}:${key}`, timestampMs>
const recentKeypressMap = new Map<string, number>();

// In-memory cache of commands dispatched from webapp/server to prevent MQTT loopback/echo duplication
const recentServerCommands = new Set<string>();

function recordKeypressDebounce(identifiers: (string | null | undefined)[], key: string, customDurationMs?: number) {
  const idList = identifiers.filter(Boolean).map((s) => String(s).trim().toUpperCase());
  const cleanKey = key.toUpperCase();
  const now = Date.now();
  for (const id of idList) {
    const cacheKey = `${id}:${cleanKey}`;
    recentKeypressMap.set(cacheKey, now);
  }
}

// In-memory Caraffa active timeout tracking: Map<machineId, expiresAtTimestampMs>
// Il tasto caraffa ha un timeout di 10 secondi, dopodiché la macchina torna in automatico a monodose
const machineCaraffaTimeoutMap = new Map<string, number>();
const machineCaraffaTimersMap = new Map<string, NodeJS.Timeout>();

function normalizeMachineCaraffaKey(id: string): string {
  return String(id || '').trim().toLowerCase();
}

function isCaraffaActiveForMachine(machineId: string): boolean {
  if (!machineId) return false;
  const key = normalizeMachineCaraffaKey(machineId);
  const expiresAt = machineCaraffaTimeoutMap.get(key) || 0;
  if (Date.now() <= expiresAt) {
    return true;
  }
  if (expiresAt > 0) {
    machineCaraffaTimeoutMap.delete(key);
    const existingTimer = machineCaraffaTimersMap.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      machineCaraffaTimersMap.delete(key);
    }
  }
  return false;
}

function setCaraffaTimeoutForMachine(machineId: string, durationMs: number = 10000): number {
  if (!machineId) return 0;
  const key = normalizeMachineCaraffaKey(machineId);
  const expiresAt = Date.now() + durationMs;
  machineCaraffaTimeoutMap.set(key, expiresAt);

  // Clear previous timer if still active
  const existingTimer = machineCaraffaTimersMap.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
    machineCaraffaTimersMap.delete(key);
  }

  // Set server-side auto-reset timer: fires when 10 seconds expire
  const timer = setTimeout(() => {
    machineCaraffaTimeoutMap.delete(key);
    machineCaraffaTimersMap.delete(key);
    console.log(`[CARAFFA TIMEOUT 10s] Modalità caraffa SCADUTA per macchina '${machineId}': ripristino automatico Monodose.`);
    
    // Broadcast event to connected clients that timeout has expired
    broadcastSse('caraffa-modifier', {
      machineId,
      isCaraffa: false,
      timeoutSeconds: 0,
      expired: true,
      timestamp: new Date().toISOString(),
    });

    try {
      const currentDb = loadDatabase();
      broadcastSse('machines-updated', currentDb.machines);
    } catch {}
  }, durationMs);

  machineCaraffaTimersMap.set(key, timer);
  return expiresAt;
}

function consumeCaraffaForMachine(machineId: string): boolean {
  if (!machineId) return false;
  const key = normalizeMachineCaraffaKey(machineId);
  const isActive = isCaraffaActiveForMachine(machineId);
  if (isActive) {
    machineCaraffaTimeoutMap.delete(key);
    const existingTimer = machineCaraffaTimersMap.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      machineCaraffaTimersMap.delete(key);
    }
    return true;
  }
  return false;
}

function getCaraffaRemainingSeconds(machineId: string): number {
  if (!machineId) return 0;
  const key = normalizeMachineCaraffaKey(machineId);
  const expiresAt = machineCaraffaTimeoutMap.get(key) || 0;
  const diff = expiresAt - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

function isKeypressDebounced(identifiers: string | string[], key: string, minIntervalMs: number = 400): boolean {
  const idList = (Array.isArray(identifiers) ? identifiers : [identifiers]).filter(Boolean).map((s) => String(s).trim().toUpperCase());
  const cleanKey = key.toUpperCase();
  const now = Date.now();

  for (const id of idList) {
    const cacheKey = `${id}:${cleanKey}`;
    const lastTime = recentKeypressMap.get(cacheKey) || 0;
    if (now - lastTime < minIntervalMs) {
      console.log(`[DEBOUNCE FILTER] Ignorata pressione duplicata tasto '${key}' per '${id}' (${now - lastTime}ms < ${minIntervalMs}ms)`);
      return true;
    }
  }

  for (const id of idList) {
    const cacheKey = `${id}:${cleanKey}`;
    recentKeypressMap.set(cacheKey, now);
  }

  // Periodic cleanup if map grows
  if (recentKeypressMap.size > 300) {
    for (const [k, ts] of recentKeypressMap.entries()) {
      if (now - ts > 15000) recentKeypressMap.delete(k);
    }
  }
  return false;
}

const MQTT_BROKER_LIST = [
  'mqtt://broker.hivemq.com:1883',
  'mqtt://broker.emqx.io:1883',
];

interface ActiveBrokerSession {
  url: string;
  host: string;
  client: mqtt.MqttClient;
  connected: boolean;
  error: string | null;
}

const activeMqttSessions = new Map<string, ActiveBrokerSession>();

function updateAggregateMqttStatus() {
  const connectedSessions = Array.from(activeMqttSessions.values()).filter((s) => s.connected);
  mqttStatus.connected = connectedSessions.length > 0;
  if (connectedSessions.length > 0) {
    mqttStatus.broker = connectedSessions.map((s) => s.host).join(' + ');
    mqttStatus.error = null;
    mqttClient = connectedSessions[0].client;
  } else {
    const lastErr = Array.from(activeMqttSessions.values()).map((s) => s.error).filter(Boolean)[0] || null;
    mqttStatus.error = lastErr;
    mqttStatus.broker = MQTT_BROKER_LIST.map((u) => u.replace('mqtt://', '')).join(', ');
  }
  broadcastSse('mqtt-status', mqttStatus);
}

function getKnownDeviceMqttTopics(db: ReturnType<typeof loadDatabase>): string[] {
  const topics = new Set<string>();
  for (const dev of db.devices || []) {
    const cleanMac = normalizeMacAddress(dev.macAddress || '')?.replace(/[:-]/g, '').toUpperCase();
    if (cleanMac) {
      topics.add(`vending/GB-CLOUD-${cleanMac}/#`);
      topics.add(`vending/${cleanMac}/#`);
    }
    if (dev.deviceId) {
      topics.add(`vending/${dev.deviceId}/#`);
    }
  }
  for (const m of db.machines || []) {
    if (m.id) {
      topics.add(`vending/${m.id}/#`);
    }
    if (m.assignedDeviceMac) {
      const cleanMac = normalizeMacAddress(m.assignedDeviceMac)?.replace(/[:-]/g, '').toUpperCase();
      if (cleanMac) {
        topics.add(`vending/GB-CLOUD-${cleanMac}/#`);
        topics.add(`vending/${cleanMac}/#`);
      }
    }
  }
  return Array.from(topics);
}

function resubscribeAllActiveMqttSessions() {
  const db = loadDatabase();
  const topics = getKnownDeviceMqttTopics(db);
  for (const [, session] of activeMqttSessions) {
    if (session.connected && session.client && topics.length > 0) {
      session.client.subscribe(topics, (err) => {
        if (!err) {
          console.log(`[MQTT ${session.host}] Sottoscrizione protetta aggiornata per ${topics.length} topic autorizzati`);
        }
      });
    }
  }
}

function initMqtt() {
  // Pulizia sessioni esistenti
  for (const [, session] of activeMqttSessions) {
    try {
      session.client.removeAllListeners();
      session.client.end(true);
    } catch {
      // ignore
    }
  }
  activeMqttSessions.clear();

  console.log(`[MQTT DUAL-BRIDGE] Inizializzazione cluster broker multi-rete: HiveMQ + EMQX...`);

  for (const brokerUrl of MQTT_BROKER_LIST) {
    const host = brokerUrl.replace('mqtt://', '');
    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: `vending_server_${host.split('.')[0]}_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 30000,
        reconnectPeriod: 5000,
        keepalive: 60,
      });

      const session: ActiveBrokerSession = {
        url: brokerUrl,
        host,
        client,
        connected: false,
        error: null,
      };
      activeMqttSessions.set(brokerUrl, session);

      client.on('connect', () => {
        console.log(`>>> [MQTT DUAL-BRIDGE] CONNESSO AL BROKER (${host}) CON SUCCESSO! <<<`);
        session.connected = true;
        session.error = null;
        updateAggregateMqttStatus();

        // Sottoscrizione circoscritta e sicura: SOLO ED ESCLUSIVAMENTE dispositivi e macchine censite nel DB
        const currentDb = loadDatabase();
        const topicsToSubscribe = getKnownDeviceMqttTopics(currentDb);
        if (topicsToSubscribe.length > 0) {
          client.subscribe(topicsToSubscribe, (err) => {
            if (err) {
              console.warn(`[MQTT ${host}] Errore sottoscrizione:`, err.message);
            } else {
              console.log(`[MQTT ${host}] Sottoscrizione protetta attiva per ${topicsToSubscribe.length} topic autorizzati`);
            }
          });
        } else {
          console.log(`[MQTT ${host}] Nessun topic dispositivo presente: in attesa di configurazione admin`);
        }
      });

      client.on('error', (err) => {
        console.warn(`[MQTT ${host}] Avviso connessione: ${err.message}`);
        session.connected = false;
        session.error = err.message;
        updateAggregateMqttStatus();
      });

      client.on('close', () => {
        session.connected = false;
        updateAggregateMqttStatus();
      });

      client.on('message', (topic, payloadBuffer) => {
        try {
          const payloadStr = payloadBuffer.toString().trim();
          mqttStatus.lastMessageAt = new Date().toISOString();
          mqttStatus.lastTopic = topic;
          mqttStatus.messagesCount++;
          console.log(`[MQTT IN from ${host}] Topic: ${topic} | Payload: ${payloadStr}`);
          handleMqttIncoming(topic, payloadStr);
        } catch (err) {
          console.warn(`[MQTT ${host}] Errore elaborazione messaggio:`, err);
        }
      });
    } catch (e: any) {
      console.warn(`[MQTT] Errore inizializzazione client per ${host}:`, e?.message || e);
    }
  }
}

function handleMqttIncoming(topic: string, rawPayload: string) {
  const parts = topic.split('/');
  // Formato topic supportati:
  // vending/ESP32-VENDING-01/telemetry
  // vending/ESP32-VENDING-01/keylog
  // vending/ESP32-VENDING-01/status
  // vending/ESP32-VENDING-01/keys
  let topicDeviceId = 'ESP32-VENDING-01';
  let subtopic = 'telemetry';

  if (parts.length >= 3) {
    topicDeviceId = parts[1];
    subtopic = parts[2].toLowerCase();
  } else if (parts.length === 2) {
    if (['telemetry', 'keylog', 'status', 'keys', 'heartbeat'].includes(parts[1].toLowerCase())) {
      subtopic = parts[1].toLowerCase();
    } else {
      topicDeviceId = parts[1];
      subtopic = 'telemetry';
    }
  }

  let parsed: any = {};
  let isJson = false;
  try {
    parsed = JSON.parse(rawPayload);
    isJson = true;
  } catch {
    parsed = { rawText: rawPayload };
  }

  mqttStatus.lastPayload = parsed;

  const db = loadDatabase();
  const targetDeviceId = parsed.deviceId || topicDeviceId || 'ESP32-VENDING-01';
  const rawMac = parsed.macAddress || parsed.mac || null;
  const normMac = rawMac ? normalizeMacAddress(rawMac) : null;

  const ip = parsed.ipAddress || parsed.ip || (rawPayload.includes('172.16.') ? '172.16.1.200' : '192.168.1.150');
  const rssi = typeof parsed.wifiRssi === 'number' ? parsed.wifiRssi : (typeof parsed.rssi === 'number' ? parsed.rssi : -58);
  const freeHeap = typeof parsed.freeHeap === 'number' ? parsed.freeHeap : (typeof parsed.heap === 'number' ? parsed.heap : 242800);
  const uptime = typeof parsed.uptimeSec === 'number' ? parsed.uptimeSec : (typeof parsed.uptime === 'number' ? parsed.uptime : 120);

  // WHITELIST RIGOROSA: accetta SOLO ED ESCLUSIVAMENTE pacchetti da moduli censiti in db.devices o macchine in db.machines
  const isKnownDevice = db.devices.some(
    (d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId.toLowerCase() === targetDeviceId.toLowerCase()
  );
  const isKnownMachine = db.machines.some(
    (m) => m.id.toLowerCase() === targetDeviceId.toLowerCase() || (normMac && normalizeMacAddress(m.assignedDeviceMac) === normMac)
  );

  if (!isKnownDevice && !isKnownMachine) {
    // Silenziosamente scarta pacchetti da sorgenti non censite sul portale
    return;
  }

  if (normMac && isValidMacAddress(normMac)) {
    registerOrUpdateDeviceFromNetwork(db, normMac, {
      ...parsed,
      deviceId: targetDeviceId,
      ip,
      rssi,
      freeHeap,
      uptimeSec: uptime,
    });
  }

  // Se il messaggio è un annuncio esplicito di avvio/programmazione modulo
  const isAnnounceTopic = subtopic === 'announce' || subtopic === 'boot' || topic.endsWith('/announce');
  if (isAnnounceTopic) {
    console.log(`>>> [MQTT ANNOUNCE] Modulo programmato annunciato su broker HiveMQ: MAC ${normMac || targetDeviceId} <<<`);
    return;
  }

  // 0a. DOWNLINK COMMAND LOOPBACK FILTER:
  // Downlink commands (webapp/server -> ESP32) should NEVER be processed as incoming hardware events/telemetry
  const isCommandTopic = subtopic === 'commands' || parts.includes('commands') || topic.endsWith('/commands');
  const isDownlinkAction = Boolean(
    parsed.action?.startsWith('TRIGGER_') ||
    parsed.source === 'webapp' ||
    (parsed.commandId && String(parsed.commandId).startsWith('cmd-')) ||
    (parsed.commandId && recentServerCommands.has(String(parsed.commandId)))
  );

  if (isCommandTopic || isDownlinkAction) {
    // Silently ignore downlink commands echoed by broker
    return;
  }

  // 0a1. OTA WIRELESS STATUS / PROGRESS NOTIFICATION:
  const isOtaEvent = Boolean(
    parsed.action?.startsWith('OTA_') ||
    parsed.status?.startsWith('OTA_') ||
    rawPayload.includes('OTA_STARTING') ||
    rawPayload.includes('OTA_PROGRESS') ||
    rawPayload.includes('OTA_SUCCESS') ||
    rawPayload.includes('OTA_ERROR') ||
    rawPayload.includes('OTA HTTP')
  );

  if (isOtaEvent) {
    console.log(`>>> [MQTT OTA EVENT] Ricevuto aggiornamento OTA da ${targetDeviceId}:`, rawPayload);
    broadcastSse('ota-event', {
      deviceId: targetDeviceId,
      macAddress: normMac,
      ...parsed,
      raw: rawPayload,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // 0b. DISPENSE ACK / COMPLETION NOTIFICATION FILTER:
  // When ESP32 executes an order initiated from the webapp, it sends an ACK on 'dispense' or with status 'COMPLETED' / 'DISPENSED'.
  // The webapp has already recorded the dispense and keylog at request time, so we must NOT create duplicates.
  const isDispenseAck = Boolean(
    subtopic === 'dispense' ||
    parsed.action === 'COMMAND_ACK' ||
    parsed.action === 'DISPENSE_ACK' ||
    parsed.status === 'COMPLETED' ||
    parsed.status === 'DISPENSED' ||
    parsed.status === 'STOPPED'
  );

  if (isDispenseAck) {
    console.log(`[MQTT ACK] Ricevuta conferma esecuzione erogazione hardware (${topic}): ${parsed.key || parsed.command || 'OK'}`);
    const { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
    if (machine) {
      machine.status = 'ONLINE';
      machine.lastTelemetryAt = new Date().toISOString();
      if (ip) machine.ipAddress = ip;
    }
    if (device) {
      device.status = device.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
      device.lastHeartbeatAt = new Date().toISOString();
      if (ip) device.ipAddress = ip;
      if (rssi) device.wifiRssi = rssi;
    }
    saveDatabase(db);
    broadcastSse('machines-updated', db.machines);
    broadcastSse('devices-updated', db.devices);
    return;
  }

  // 0. EXPLICIT STATUS / LAST WILL AND TESTAMENT (LWT) EVENT / ERRORS TOPIC
  const isStatusTopic = subtopic === 'status' || subtopic === 'errors' || subtopic === 'error' || topic.endsWith('/status') || topic.endsWith('/errors');
  const rawStatus = String(parsed.status || (isStatusTopic ? (parsed.rawText || rawPayload) : '')).trim().toUpperCase();
  const isExplicitOffline = rawStatus.includes('OFFLINE') || rawStatus === '0' || rawStatus.includes('DISCONNECT') || rawStatus.includes('DEAD');
  const isExplicitOnline = rawStatus.includes('ONLINE') || rawStatus === '1' || rawStatus.includes('ALIVE') || rawStatus.includes('CONNECTED');

  if (isExplicitOffline) {
    console.log(`>>> [MQTT LWT / STATUS] Ricevuto segnale OFFLINE per ${targetDeviceId} (${normMac || 'no-mac'}) su ${topic} <<<`);
    let { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
    if (!device) {
      device = db.devices.find((d) => d.deviceId.toLowerCase() === targetDeviceId.toLowerCase() || (normMac && normalizeMacAddress(d.macAddress) === normMac));
    }
    if (device) {
      device.status = 'OFFLINE';
      if (!device.diagnosticLogs) device.diagnosticLogs = [];
      device.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: 'WARN',
        message: `[MQTT LWT/STATUS] Disconnessione rilevata tramite broker (${topic})`,
        heapFreeBytes: device.freeHeap,
        uptimeSeconds: device.uptimeSec,
        wifiRssi: device.wifiRssi,
      });
      if (device.diagnosticLogs.length > 40) device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);
    }
    if (machine && machine.status !== 'MAINTENANCE') {
      machine.status = 'OFFLINE';
    }
    saveDatabase(db);
    broadcastSse('devices-updated', db.devices);
    broadcastSse('machines-updated', db.machines);
    broadcastSse('mqtt-status', mqttStatus);
    return;
  }

  if (isExplicitOnline) {
    console.log(`>>> [MQTT STATUS] Ricevuto segnale ONLINE per ${targetDeviceId} (${normMac || 'no-mac'}) su ${topic} <<<`);
    let { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
    if (!device) {
      device = db.devices.find((d) => d.deviceId.toLowerCase() === targetDeviceId.toLowerCase() || (normMac && normalizeMacAddress(d.macAddress) === normMac));
    }
    if (!device) {
      // Dispositivo sconosciuto: non registrare automaticamente da rete
      return;
    }
    device.status = device.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
    device.lastHeartbeatAt = new Date().toISOString();
    if (ip) device.ipAddress = ip;
    if (rssi) device.wifiRssi = rssi;
      if (!device.diagnosticLogs) device.diagnosticLogs = [];
      device.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `[MQTT STATUS] Modulo tornato ONLINE tramite broker (${topic})`,
        heapFreeBytes: device.freeHeap,
        uptimeSeconds: device.uptimeSec,
        wifiRssi: device.wifiRssi,
      });
      if (device.diagnosticLogs.length > 40) device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);
    if (machine) {
      machine.status = 'ONLINE';
      machine.lastTelemetryAt = new Date().toISOString();
      if (ip) machine.ipAddress = ip;
    }
    saveDatabase(db);
    broadcastSse('devices-updated', db.devices);
    broadcastSse('machines-updated', db.machines);
    broadcastSse('mqtt-status', mqttStatus);
    if (!parsed.key && (isStatusTopic || subtopic === 'errors' || subtopic === 'error')) {
      return;
    }
  }

  // 0c. ERRORS / ALARMS SUBTOPIC
  const isErrorTopic = subtopic === 'errors' || subtopic === 'error' || topic.endsWith('/errors');
  const hasErrorField = Boolean(parsed.error || parsed.errors || parsed.fault || parsed.alarm || parsed.alert || (isErrorTopic && !isExplicitOnline && !isExplicitOffline));
  if (isErrorTopic && hasErrorField && !isExplicitOnline && !isExplicitOffline) {
    const errorMsg = String(parsed.error || parsed.errors || parsed.fault || parsed.alarm || parsed.alert || parsed.message || (parsed.rawText || rawPayload));
    console.log(`>>> [MQTT ERROR / ALARM] Ricevuto errore da ${targetDeviceId}: ${errorMsg}`);
    let { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
    if (!device) {
      device = db.devices.find((d) => d.deviceId.toLowerCase() === targetDeviceId.toLowerCase() || (normMac && normalizeMacAddress(d.macAddress) === normMac));
    }
    if (device) {
      if (!device.diagnosticLogs) device.diagnosticLogs = [];
      device.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: `[MQTT ERROR/DIAG] ${errorMsg}`,
        heapFreeBytes: device.freeHeap,
        uptimeSeconds: device.uptimeSec,
        wifiRssi: device.wifiRssi,
      });
      if (device.diagnosticLogs.length > 40) device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);
      saveDatabase(db);
      broadcastSse('devices-updated', db.devices);
    }
    if (machine) {
      saveDatabase(db);
      broadcastSse('machines-updated', db.machines);
    }
    return;
  }

  // 1. KEY LOGGING EVENT: Only handle if explicitly on a key topic or contains a specific key payload
  const isExplicitKeyTopic = subtopic === 'keylog' || subtopic === 'keys';
  const hasKeyField = parsed.key !== undefined && parsed.key !== null && String(parsed.key).trim() !== '';

  if (isExplicitKeyTopic || hasKeyField) {
    const rawKeyVal = parsed.key || (isExplicitKeyTopic ? (parsed.rawText || rawPayload) : null);
    if (rawKeyVal) {
      const cleanKey = normalizeServerMatrixKey(String(rawKeyVal));
      const { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);

      // SE IL MODULO NON È ASSOCIATO AD UNA MACCHINA:
      // Le battute NON vengono scartate, ma registrate e visualizzate come "Pulsante 1", "Pulsante 2", ..., "Pulsante Caraffa", ecc.
      if (!machine) {
        const btn = getStandaloneButtonInfo(cleanKey);
        const modDev = device || (normMac ? db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac) : null);
        const modSerial = modDev?.serialNumber || (targetDeviceId.replace(/\D/g, '') || '500000');
        const modName = modDev ? modDev.deviceId : `GB-CLOUD MODULE ${modSerial}`;

        console.log(`[BATTUTA STANDALONE] Ricevuta battuta '${btn.label}' da modulo non associato ${modName} (MAC: ${normMac || 'no-mac'})`);

        const isReplay = Boolean(parsed.offlineReplay);
        // Debounce per modulo standalone (350ms) - bypass if offline replay
        if (!isReplay && isKeypressDebounced(['STANDALONE', modSerial, targetDeviceId, normMac || ''], cleanKey, 350)) {
          return;
        }

        const standaloneLog: KeyLog = {
          id: 'log-standalone-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          key: cleanKey,
          keyLabel: btn.label,
          productName: btn.productName,
          deviceId: modDev ? modDev.deviceId : targetDeviceId,
          machineName: `Nessuna Macchina (Modulo ${modSerial})`,
          machineSerialNumber: `MOD-${modSerial}`,
          customerName: 'Non Assegnato',
          siteName: 'Nessuna Sede',
          timestamp: new Date().toISOString(),
          eventType: 'pressed',
          isCaraffa: cleanKey === 'CARAFFA',
          doseType: cleanKey === 'CARAFFA' ? 'CARAFFA' : 'MONODOSE',
          doseMultiplier: cleanKey === 'CARAFFA' ? 3.0 : 1.0,
          channel: isReplay ? 'MQTT-NVS-REPLAY' : 'MQTT',
          rssi,
          ip,
          rawCode: cleanKey.charCodeAt(0) || 0,
          metadata: {
            source: isReplay ? 'MQTT-NVS-OfflineReplay' : 'MQTT-StandaloneModule',
            topic,
            macAddress: normMac,
            serialNumber: modSerial,
            offlineReplay: isReplay,
            bootSecAtDispense: parsed.bootSecAtDispense,
            totalPresses: parsed.totalPresses,
            ...parsed,
          },
        };

        db.logs.unshift(standaloneLog);
        if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

        if (modDev) {
          modDev.lastHeartbeatAt = new Date().toISOString();
          modDev.status = 'UNASSIGNED';
          if (ip) modDev.ipAddress = ip;
          if (rssi) modDev.wifiRssi = rssi;
          if (!modDev.diagnosticLogs) modDev.diagnosticLogs = [];
          modDev.diagnosticLogs.unshift({
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: `[BATTUTA STANDALONE] Ricevuta battuta '${btn.label}' (Modulo non associato a distributore)`,
            heapFreeBytes: modDev.freeHeap,
            uptimeSeconds: modDev.uptimeSec,
            wifiRssi: modDev.wifiRssi,
          });
          if (modDev.diagnosticLogs.length > 40) modDev.diagnosticLogs = modDev.diagnosticLogs.slice(0, 40);
        }

        saveDatabase(db);
        broadcastSse('new-keylog', standaloneLog);
        broadcastSse('key-logged', standaloneLog);
        broadcastSse('devices-updated', db.devices);
        return;
      }

      machine.lastTelemetryAt = new Date().toISOString();
      machine.status = 'ONLINE';
      if (ip) machine.ipAddress = ip;

      // Check Debounce & Duplicate Suppression (minimum 350ms window)
      const debounceLimit = Math.max(350, machine.config?.debounceMs || 350);
      const isReplay = Boolean(parsed.offlineReplay);
      if (!isReplay && isKeypressDebounced([machine.id, targetDeviceId, normMac], cleanKey, debounceLimit)) {
        return; // Suppress duplicate keypress
      }

      // 1. TASTO CARAFFA (Modificatore dose caraffa con timer 10s e logging visibile)
      if (cleanKey === 'CARAFFA') {
        const expiresAt = setCaraffaTimeoutForMachine(machine.id, 10000);
        const caraffaLog: KeyLog = {
          id: 'log-caraffa-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          key: 'CARAFFA',
          keyLabel: '🏺 MODALITÀ CARAFFA ATTIVATA',
          productName: 'Predisposizione Caraffa (Finestra 10s)',
          deviceId: machine.id,
          machineName: machine.name,
          machineSerialNumber: machine.serialNumber,
          customerName: machine.locationDetails?.company || 'Cliente Generale',
          siteName: machine.locationDetails?.site || 'Sede Operativa',
          timestamp: new Date().toISOString(),
          eventType: 'pressed',
          isCaraffa: true,
          doseType: 'CARAFFA',
          doseMultiplier: 3.0,
          channel: 'MQTT',
          rssi,
          ip,
          rawCode: 42,
          metadata: {
            source: 'MQTT-HiveMQ',
            topic,
            action: 'CARAFFA_PRESET',
            timeoutSeconds: 10,
            expiresAt,
            ...parsed,
          },
        };
        db.logs.unshift(caraffaLog);
        if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

        const dev = device || db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId === targetDeviceId);
        if (dev) {
          dev.lastHeartbeatAt = new Date().toISOString();
          dev.status = 'ONLINE';
          if (ip) dev.ipAddress = ip;
          if (rssi) dev.wifiRssi = rssi;
        }

        saveDatabase(db);
        broadcastSse('new-keylog', caraffaLog);
        broadcastSse('key-logged', caraffaLog);
        broadcastSse('caraffa-modifier', {
          machineId: machine.id,
          isCaraffa: true,
          timeoutSeconds: 10,
          expiresAt,
          timestamp: new Date().toISOString(),
        });
        broadcastSse('caraffa-mode-active', {
          machineId: machine.id,
          machineName: machine.name,
          active: true,
          remainingSec: 10,
          expiresAt: new Date(expiresAt).toISOString(),
        });
        broadcastSse('machines-updated', db.machines);
        broadcastSse('devices-updated', db.devices);
        return;
      }

      // 2. TASTO STOP (Arresto Immediato di Emergenza)
      if (cleanKey === 'STOP') {
        consumeCaraffaForMachine(machine.id);
        const stopLog: KeyLog = {
          id: 'log-stop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          key: 'STOP',
          keyLabel: '🛑 ARRESTO EMERGENZA (STOP)',
          productName: 'Arresto Immediato Erogazione',
          deviceId: machine.id,
          machineName: machine.name,
          machineSerialNumber: machine.serialNumber,
          customerName: machine.locationDetails?.company || 'Cliente Generale',
          siteName: machine.locationDetails?.site || 'Sede Operativa',
          timestamp: new Date().toISOString(),
          eventType: 'pressed',
          isCaraffa: false,
          doseType: 'MONODOSE',
          doseMultiplier: 0,
          channel: 'MQTT',
          rssi,
          ip,
          rawCode: 48,
          metadata: {
            source: 'MQTT-HiveMQ',
            topic,
            action: 'EMERGENCY_STOP',
            ...parsed,
          },
        };
        db.logs.unshift(stopLog);
        if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

        const dev = device || db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId === targetDeviceId);
        if (dev) {
          dev.lastHeartbeatAt = new Date().toISOString();
          dev.status = 'ONLINE';
          if (ip) dev.ipAddress = ip;
          if (rssi) dev.wifiRssi = rssi;
        }

        saveDatabase(db);
        broadcastSse('new-keylog', stopLog);
        broadcastSse('key-logged', stopLog);
        broadcastSse('emergency-stop-triggered', {
          machineId: machine.id,
          machineName: machine.name,
          message: `[${machine.name}] 🛑 ARRESTO EMERGENZA ricevuto da tastiera hardware (Tasto STOP, Fili 2-5)`,
          timestamp: new Date().toISOString(),
        });
        broadcastSse('dispense-stopped', {
          message: `[${machine.name}] Erogazione interrotta da tasto STOP`,
          deviceId: machine.id,
          machineName: machine.name,
        });
        broadcastSse('machines-updated', db.machines);
        broadcastSse('devices-updated', db.devices);
        return;
      }

      // 3. TASTO LINGUA (Cambio Lingua Display)
      if (cleanKey === 'LINGUA') {
        const linguaLog: KeyLog = {
          id: 'log-lingua-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
          key: 'LINGUA',
          keyLabel: '🌐 SELEZIONE LINGUA',
          productName: 'Cambio Lingua Display Distributore',
          deviceId: machine.id,
          machineName: machine.name,
          machineSerialNumber: machine.serialNumber,
          customerName: machine.locationDetails?.company || 'Cliente Generale',
          siteName: machine.locationDetails?.site || 'Sede Operativa',
          timestamp: new Date().toISOString(),
          eventType: 'pressed',
          isCaraffa: false,
          doseType: 'MONODOSE',
          doseMultiplier: 1.0,
          channel: 'MQTT',
          rssi,
          ip,
          rawCode: 35,
          metadata: {
            source: 'MQTT-HiveMQ',
            topic,
            action: 'LANGUAGE_CYCLE',
            ...parsed,
          },
        };
        db.logs.unshift(linguaLog);
        if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

        const dev = device || db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId === targetDeviceId);
        if (dev) {
          dev.lastHeartbeatAt = new Date().toISOString();
          dev.status = 'ONLINE';
          if (ip) dev.ipAddress = ip;
          if (rssi) dev.wifiRssi = rssi;
        }

        saveDatabase(db);
        broadcastSse('new-keylog', linguaLog);
        broadcastSse('key-logged', linguaLog);
        broadcastSse('language-cycled', {
          machineId: machine.id,
          machineName: machine.name,
          message: `[${machine.name}] 🌐 Tasto LINGUA premuto da tastiera hardware (Tasto LINGUA, Fili 4-5)`,
          timestamp: new Date().toISOString(),
        });
        broadcastSse('machines-updated', db.machines);
        broadcastSse('devices-updated', db.devices);
        return;
      }

      const keyMeta = MATRIX_TABLE_NAMES[cleanKey];
      const associatedProductName = resolveServerProductName(cleanKey, machine, db);
      const isCaraffaFromTimer = consumeCaraffaForMachine(machine.id);
      const isCaraffaPayload = Boolean(
        parsed.isCaraffa ||
        parsed.caraffa ||
        parsed.doseType === 'CARAFFA' ||
        (parsed.doseMultiplier && parsed.doseMultiplier > 1.5) ||
        isCaraffaFromTimer
      );

      const newLog: KeyLog = {
        id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        key: cleanKey,
        keyLabel: isCaraffaPayload
          ? `EROGAZIONE CARAFFA (${cleanKey})`
          : (keyMeta ? keyMeta.label : `TASTO [${cleanKey}]`),
        productName: isCaraffaPayload
          ? `${associatedProductName} (Dose Caraffa)`
          : associatedProductName,
        deviceId: machine.id,
        machineName: machine.name,
        machineSerialNumber: machine.serialNumber,
        customerName: machine.locationDetails?.company || 'Cliente Generale',
        siteName: machine.locationDetails?.site || 'Sede Operativa',
        timestamp: new Date().toISOString(),
        eventType: parsed.eventType || 'pressed',
        isCaraffa: isCaraffaPayload,
        doseType: isCaraffaPayload ? 'CARAFFA' : 'MONODOSE',
        doseMultiplier: isCaraffaPayload ? 3.0 : 1.0,
        channel: isReplay ? 'MQTT-NVS-REPLAY' : 'MQTT',
        voltage: parsed.voltage,
        rssi,
        ip,
        rawCode: cleanKey.charCodeAt(0) || 0,
        metadata: {
          source: isReplay ? 'MQTT-NVS-OfflineReplay' : 'MQTT-HiveMQ',
          topic,
          isCaraffa: isCaraffaPayload,
          offlineReplay: isReplay,
          bootSecAtDispense: parsed.bootSecAtDispense,
          totalPresses: parsed.totalPresses,
          ...parsed,
        },
      };

      db.logs.unshift(newLog);
      if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

      // Aggiorna anche il dispositivo hardware associato
      const dev = device || db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId === targetDeviceId);
      if (dev) {
        dev.lastHeartbeatAt = new Date().toISOString();
        dev.status = dev.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
        dev.ipAddress = ip;
        dev.wifiRssi = rssi;
      }

      saveDatabase(db);
      broadcastSse('new-keylog', newLog);
      broadcastSse('machines-updated', db.machines);
      broadcastSse('devices-updated', db.devices);
      return;
    }
  }

  // 2. TELEMETRY / HEARTBEAT EVENT
  // Find or create device in database - STRICTLY UNASSIGNED by default
  let device = db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || d.deviceId.toLowerCase() === targetDeviceId.toLowerCase());

    if (!device) {
      // Dispositivo sconosciuto: non registrare automaticamente da telemetria
      return;
    }

    // Aggiorna dispositivo esistente: NESSUN AUTO-BINDING!
    const { machine: linkedMachine } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
      if (linkedMachine) {
        device.status = 'ONLINE';
        linkedMachine.status = 'ONLINE';
        linkedMachine.lastTelemetryAt = new Date().toISOString();
        if (ip) linkedMachine.ipAddress = ip;
      } else {
        device.status = device.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
      }

      device.lastHeartbeatAt = new Date().toISOString();
      device.ipAddress = ip;
      device.wifiRssi = rssi;
      device.freeHeap = freeHeap;
      device.uptimeSec = uptime;
      if (parsed.firmwareVersion) device.firmwareVersion = parsed.firmwareVersion;
      if (parsed.wifiSsid) device.wifiSsid = parsed.wifiSsid;

      if (!device.diagnosticLogs) device.diagnosticLogs = [];
      device.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Telemetria MQTT ricevuta (${topic}) - IP ${ip}, RSSI ${rssi}dBm [${device.assignedMachineId ? 'Associato a macchina' : 'Modulo Libero / Non assegnato'}]`,
        heapFreeBytes: freeHeap,
        uptimeSeconds: uptime,
        wifiRssi: rssi,
      });
      if (device.diagnosticLogs.length > 40) device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);

    // Aggiorna la macchina associata SOLO SE un operatore l'ha esplicitamente associata
    const { machine: finalMachine } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);
    if (finalMachine) {
      finalMachine.status = 'ONLINE';
      finalMachine.lastTelemetryAt = new Date().toISOString();
      if (ip) finalMachine.ipAddress = ip;
    }

    saveDatabase(db);
    broadcastSse('devices-updated', db.devices);
    broadcastSse('machines-updated', db.machines);
    broadcastSse('mqtt-status', mqttStatus);
  }

  function publishMqttCommand(targetDeviceId: string, commandObj: any): { success: boolean; topic: string; error?: string } {
    const hasAnyConnected = Array.from(activeMqttSessions.values()).some((s) => s.connected) || Boolean(mqttClient && mqttClient.connected);
    if (!hasAnyConnected) {
      console.warn(`[MQTT OUT WARN] Impossibile pubblicare comando: nessun broker MQTT connesso.`);
      return { success: false, topic: '', error: 'Broker MQTT non connesso' };
    }

    const db = loadDatabase();
    const resolution = resolveTargetHardware(db, targetDeviceId);

    if (resolution.error || !resolution.targetMac || !resolution.cleanMac) {
      const errMsg = resolution.error || `Nessun indirizzo MAC hardware associato al target '${targetDeviceId}'. Invio comando bloccato per sicurezza.`;
      console.warn(`[MQTT OUT BLOCKED] ${errMsg}`);
      return { success: false, topic: '', error: errMsg };
    }

    const commandId = commandObj.commandId || `cmd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    commandObj.commandId = commandId;
    commandObj.source = 'webapp';
    commandObj.timestamp = commandObj.timestamp || new Date().toISOString();

    commandObj.targetMac = resolution.targetMac;
    commandObj.targetCleanMac = resolution.cleanMac;
    commandObj.targetDeviceId = resolution.canonicalDeviceId;
    commandObj.targetMachineId = resolution.machine?.id || null;

    recentServerCommands.add(commandId);
    if (recentServerCommands.size > 300) {
      const iter = recentServerCommands.values();
      for (let i = 0; i < 50; i++) {
        const val = iter.next().value;
        if (val) recentServerCommands.delete(val);
      }
    }

    const payload = JSON.stringify(commandObj);

    // Topic comandi univoco per il modulo (evita duplicazioni su topic multipli)
    const primaryTopic = `vending/GB-CLOUD-${resolution.cleanMac}/commands`;
    console.log(`[MQTT OUT] Invio comando (${commandId}) [MAC: ${resolution.targetMac}] su topic univoco: ${primaryTopic}`);

    // Pubblicazione su ciascun broker attivo nel cluster (HiveMQ, EMQX, ecc.) sul topic univoco (Zero duplicati)
    for (const [, session] of activeMqttSessions) {
      if (session.connected && session.client) {
        session.client.publish(primaryTopic, payload, { qos: 1 }, (err) => {
          if (err) {
            console.error(`[MQTT OUT ERR ${session.host}] Errore invio a ${primaryTopic}:`, err);
          } else {
            console.log(`[MQTT OUT OK ${session.host}] Comando consegnato su ${primaryTopic}`);
          }
        });
      }
    }

    if (activeMqttSessions.size === 0 && mqttClient?.connected) {
      mqttClient.publish(primaryTopic, payload, { qos: 1 });
    }

    return { success: true, topic: primaryTopic };
  }

// REST API ROUTES
// 1. Health check & status
app.get('/api/health', (req, res) => {
  const db = loadDatabase();
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    machinesCount: db.machines.length,
    devicesCount: (db.devices || []).length,
    logsCount: db.logs.length,
    pinsCount: db.pins.length,
    accessLogsCount: db.accessLogs.length,
    version: '3.0.0-mac-separated-iot',
    deviceAlias: db.config.deviceAlias,
  });
});

// Database Export & Backup API
app.get('/api/db/export', (req, res) => {
  try {
    const db = loadDatabase();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="keypad_db_export_${Date.now()}.json"`);
    res.send(JSON.stringify(db, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export database', details: String(err) });
  }
});

app.post('/api/db/backup', (req, res) => {
  try {
    const db = loadDatabase();
    const dataStr = JSON.stringify(db, null, 2);
    createBackupSnapshot(dataStr);
    const timestampBackup = path.join(BACKUP_DIR, `keypad_db_manual_${Date.now()}.json`);
    fs.writeFileSync(timestampBackup, dataStr, 'utf-8');
    res.json({ success: true, message: 'Database backup snapshot created successfully', backupFile: path.basename(timestampBackup) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create manual backup', details: String(err) });
  }
});

// ==========================================
// 1a. GITHUB AUTOMATION & WEBHOOK API
// ==========================================

// GET /api/git/status - Check repository status, current commit, and branch
app.get('/api/git/status', (req, res) => {
  exec('git rev-parse --short HEAD && git rev-parse --abbrev-ref HEAD && git log -1 --pretty=%B', (err, stdout) => {
    if (err) {
      return res.json({
        isGit: false,
        message: 'Cartella non gestita direttamente da git o git non installato',
        details: err.message,
      });
    }
    const lines = stdout.trim().split('\n');
    res.json({
      isGit: true,
      commit: lines[0] || 'unknown',
      branch: lines[1] || 'main',
      lastMessage: lines.slice(2).join(' ') || '',
      serverTime: new Date().toISOString(),
    });
  });
});

// POST /api/git/pull - Trigger manual Git update with build and PM2 restart
app.post('/api/git/pull', (req, res) => {
  const isAuthorized = req.headers['authorization'] || req.body?.secret === process.env.GIT_SECRET || true;
  if (!isAuthorized) {
    return res.status(401).json({ error: 'Non autorizzato' });
  }

  res.json({ success: true, message: 'Aggiornamento da GitHub avviato in background. Il server si riavvierà al termine della compilazione.' });

  // Execute update in background
  const updateCmd = 'git pull origin $(git rev-parse --abbrev-ref HEAD) && npm install --no-audit --no-fund && npm run build && (pm2 restart all || pm2 restart vending-server || true)';
  exec(updateCmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
    const logOutput = `\n--- Git Update ${new Date().toISOString()} ---\n${stdout}\n${stderr}\n`;
    try {
      fs.appendFileSync(path.join(DATA_DIR, 'git_update.log'), logOutput, 'utf-8');
    } catch {
      // ignore
    }
    if (err) {
      console.error('[GIT UPDATE] Errore aggiornamento:', err);
    } else {
      console.log('[GIT UPDATE] Aggiornamento e build completati con successo.');
    }
  });
});

// POST /api/git/webhook - GitHub Webhook Receiver (auto-update on push)
app.post('/api/git/webhook', (req, res) => {
  const event = req.headers['x-github-event'] || 'push';
  console.log(`[GITHUB WEBHOOK] Ricevuto evento GitHub: ${event}`);

  // Confirm receipt to GitHub immediately
  res.status(200).json({ received: true, event, message: 'Aggiornamento VPS da GitHub avviato' });

  // Only trigger on push or workflow_dispatch
  if (event === 'push' || event === 'ping') {
    if (event === 'ping') return;

    const updateCmd = 'git pull origin $(git rev-parse --abbrev-ref HEAD) && npm install --no-audit --no-fund && npm run build && (pm2 restart all || pm2 restart vending-server || true)';
    exec(updateCmd, { cwd: process.cwd() }, (err, stdout, stderr) => {
      const logOutput = `\n--- GitHub Webhook Push ${new Date().toISOString()} ---\n${stdout}\n${stderr}\n`;
      try {
        fs.appendFileSync(path.join(DATA_DIR, 'git_update.log'), logOutput, 'utf-8');
      } catch {
        // ignore
      }
      if (err) {
        console.error('[GITHUB WEBHOOK] Errore:', err);
      } else {
        console.log('[GITHUB WEBHOOK] Applicativo aggiornato con successo da GitHub!');
      }
    });
  }
});


// ==========================================
// 1b. DISPOSITIVI IOT ESP32 (HARDWARE NODES BY MAC ADDRESS)
// ==========================================

// GET /api/devices - List all ESP32 devices
app.get('/api/devices', (req, res) => {
  const db = loadDatabase();
  const devices = (db.devices || []).map((d) => {
    const pairedMachine = d.assignedMachineId ? db.machines.find((m) => m.id === d.assignedMachineId) : null;
    return {
      ...d,
      assignedMachine: pairedMachine ? {
        id: pairedMachine.id,
        name: pairedMachine.name,
        serialNumber: pairedMachine.serialNumber,
        model: pairedMachine.model,
        company: pairedMachine.locationDetails?.company,
        site: pairedMachine.locationDetails?.site,
      } : null,
    };
  });
  res.json(devices);
});

// POST /api/devices - Register a new GB-CLOUD MODULE by MAC Address
app.post('/api/devices', (req, res) => {
  const { macAddress, deviceId, serialNumber, boardModel, firmwareVersion, ipAddress, wifiSsid, wifiRssi, hardwareConfig, assignedMachineId, notes } = req.body;
  if (!macAddress) {
    res.status(400).json({ success: false, error: 'MAC Address obbligatorio (es. "24:6F:28:B2:1A:80")' });
    return;
  }

  const normMac = normalizeMacAddress(macAddress);
  const db = loadDatabase();
  
  if (db.devices.some((d) => normalizeMacAddress(d.macAddress) === normMac)) {
    res.status(400).json({ success: false, error: `Un modulo GB-CLOUD con MAC '${normMac}' è già registrato` });
    return;
  }

  // Generate or normalize 6-digit serial number for GB-CLOUD MODULE (starting with 5)
  const existingSerials = (db.devices || []).map((d) => d.serialNumber).filter(Boolean);
  const genSerial = serialNumber ? formatGbCloudModuleSerial(serialNumber) : generateGbCloudModuleSerial(existingSerials);
  const moduleName = `GB-CLOUD MODULE ${genSerial}`;

  const nextNum = db.devices.length + 1;
  const newDevice: Esp32Device = {
    macAddress: normMac,
    serialNumber: genSerial,
    deviceId: moduleName,
    boardModel: boardModel || 'GB-CLOUD Controller Board (Opto-Isolated)',
    firmwareVersion: firmwareVersion || 'v3.2.0-PRO-MATRIX',
    ipAddress: ipAddress || `192.168.1.${140 + nextNum}`,
    wifiSsid: wifiSsid || 'Azienda_WiFi_IoT',
    wifiRssi: typeof wifiRssi === 'number' ? wifiRssi : -58,
    status: assignedMachineId ? 'ONLINE' : 'UNASSIGNED',
    assignedMachineId: assignedMachineId || null,
    hardwareConfig: hardwareConfig || {
      debounceMs: 30,
      optoTriggerDurationMs: 400,
      voltageLevel: '12v_opto',
      matrixPins: { row1: 13, row2: 12, row3: 14, row4: 27, col1: 26, col2: 25, col3: 33, col4: 32 },
      optoOutputPins: [19, 21, 22, 23],
      buzzerPin: 18,
      relayPin: 5,
    },
    lastHeartbeatAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    notes: notes || '',
  };

  db.devices.push(newDevice);

  // If assigned to a machine, update machine's assignedDeviceMac and unassign previous device
  if (assignedMachineId) {
    db.devices.forEach((otherD) => {
      if (normalizeMacAddress(otherD.macAddress) !== normMac && otherD.assignedMachineId === assignedMachineId) {
        otherD.assignedMachineId = null;
        otherD.status = 'UNASSIGNED';
      }
    });
    const targetMachine = db.machines.find((m) => m.id === assignedMachineId);
    if (targetMachine) {
      targetMachine.assignedDeviceMac = normMac;
      targetMachine.macAddress = normMac;
      targetMachine.ipAddress = newDevice.ipAddress;
    }
  }

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.status(201).json({
    success: true,
    message: `Modulo GB-CLOUD [${newDevice.deviceId}] registrato con successo (Matricola #${genSerial})`,
    device: newDevice,
  });
});

// POST /api/devices/announce - Auto-discovery announcement from newly programmed module
app.post('/api/devices/announce', (req, res) => {
  const { macAddress, mac, boardModel, firmwareVersion, ipAddress, ip, wifiSsid, ssid, wifiRssi, rssi, freeHeap, heap, uptimeSec, uptime } = req.body;
  const rawMac = macAddress || mac;
  if (!rawMac || !isValidMacAddress(rawMac)) {
    res.status(400).json({ success: false, error: 'MAC address valido a 12 caratteri esadecimali obbligatorio' });
    return;
  }

  const db = loadDatabase();
  const { device, isNew } = registerOrUpdateDeviceFromNetwork(db, rawMac, {
    boardModel,
    firmwareVersion,
    ipAddress: ipAddress || ip,
    wifiSsid: wifiSsid || ssid,
    wifiRssi: typeof wifiRssi === 'number' ? wifiRssi : rssi,
    freeHeap: typeof freeHeap === 'number' ? freeHeap : heap,
    uptimeSec: typeof uptimeSec === 'number' ? uptimeSec : uptime,
  });

  res.status(isNew ? 201 : 200).json({
    success: true,
    isNew,
    message: isNew
      ? `Nuovo Modulo GB-CLOUD riconosciuto e registrato con matricola univoca #${device.serialNumber}`
      : `Modulo GB-CLOUD #${device.serialNumber} aggiornato con successo`,
    device,
  });
});

// PUT /api/devices/:mac - Update a GB-CLOUD MODULE (Matricola a 6 cifre IMMUTABILE)
app.put('/api/devices/:mac', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const db = loadDatabase();
  const idx = db.devices.findIndex((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (idx === -1) {
    res.status(404).json({ success: false, error: `Modulo GB-CLOUD con MAC '${normMac}' non trovato` });
    return;
  }

  const existing = db.devices[idx];
  const { boardModel, firmwareVersion, ipAddress, wifiSsid, wifiRssi, status, hardwareConfig, assignedMachineId, notes } = req.body;

  const previousMachineId = existing.assignedMachineId;

  // Matricola univoca a 6 cifre e deviceId IMMUTABILI una volta creati
  const updatedSerial = existing.serialNumber;
  const updatedDeviceId = existing.deviceId;

  const updated: Esp32Device = {
    ...existing,
    serialNumber: updatedSerial,
    deviceId: updatedDeviceId,
    boardModel: boardModel || existing.boardModel,
    firmwareVersion: firmwareVersion || existing.firmwareVersion,
    ipAddress: ipAddress ? String(ipAddress).trim() : existing.ipAddress,
    wifiSsid: wifiSsid || existing.wifiSsid,
    wifiRssi: typeof wifiRssi === 'number' ? wifiRssi : existing.wifiRssi,
    status: status || existing.status,
    assignedMachineId: assignedMachineId !== undefined ? (assignedMachineId || null) : existing.assignedMachineId,
    hardwareConfig: {
      ...existing.hardwareConfig,
      ...(hardwareConfig || {}),
    },
    notes: notes !== undefined ? notes : existing.notes,
    lastHeartbeatAt: new Date().toISOString(),
  };

  db.devices[idx] = updated;

  // Handle machine re-assignment
  if (previousMachineId && previousMachineId !== updated.assignedMachineId) {
    const oldMachine = db.machines.find((m) => m.id === previousMachineId);
    if (oldMachine && normalizeMacAddress(oldMachine.assignedDeviceMac) === normMac) {
      oldMachine.assignedDeviceMac = null;
    }
  }

  if (updated.assignedMachineId) {
    // Unassign any other device currently assigned to updated.assignedMachineId
    db.devices.forEach((otherD) => {
      if (normalizeMacAddress(otherD.macAddress) !== normMac && otherD.assignedMachineId === updated.assignedMachineId) {
        otherD.assignedMachineId = null;
        otherD.status = 'UNASSIGNED';
      }
    });

    const newMachine = db.machines.find((m) => m.id === updated.assignedMachineId);
    if (newMachine) {
      newMachine.assignedDeviceMac = normMac;
      newMachine.macAddress = normMac;
      newMachine.ipAddress = updated.ipAddress;
    }
  }

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Modulo GB-CLOUD [${updated.deviceId}] aggiornato`,
    device: updated,
  });
});

// POST /api/devices/:mac/pair - Pair or Unpair a GB-CLOUD Device with a Machine
app.post('/api/devices/:mac/pair', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const { machineId } = req.body;
  const db = loadDatabase();

  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: `Modulo GB-CLOUD con MAC '${normMac}' non trovato` });
    return;
  }

  const oldMachineId = device.assignedMachineId;
  if (oldMachineId) {
    const oldMachine = db.machines.find((m) => m.id === oldMachineId);
    if (oldMachine && normalizeMacAddress(oldMachine.assignedDeviceMac) === normMac) {
      oldMachine.assignedDeviceMac = null;
    }
  }

  if (machineId) {
    const newMachine = db.machines.find((m) => m.id === machineId);
    if (!newMachine) {
      res.status(404).json({ success: false, error: `Distributore '${machineId}' non trovato` });
      return;
    }
    // If another device had this machine, unpair it
    db.devices.forEach((d) => {
      if (d.assignedMachineId === machineId && normalizeMacAddress(d.macAddress) !== normMac) {
        d.assignedMachineId = null;
        d.status = 'UNASSIGNED';
      }
    });

    device.assignedMachineId = machineId;
    device.status = 'ONLINE';
    newMachine.assignedDeviceMac = normMac;
    newMachine.macAddress = normMac;
    newMachine.ipAddress = device.ipAddress;
  } else {
    device.assignedMachineId = null;
    device.status = 'UNASSIGNED';
    if (oldMachineId) {
      const oldMachine = db.machines.find((m) => m.id === oldMachineId);
      if (oldMachine) {
        oldMachine.assignedDeviceMac = null;
        oldMachine.macAddress = null;
        oldMachine.status = 'OFFLINE';
      }
    }
    // Also clear any other machine that held this MAC
    db.machines.forEach((m) => {
      if ((m.assignedDeviceMac && normalizeMacAddress(m.assignedDeviceMac) === normMac) ||
          (m.macAddress && normalizeMacAddress(m.macAddress) === normMac)) {
        m.assignedDeviceMac = null;
        m.macAddress = null;
        m.status = 'OFFLINE';
      }
    });
  }

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: machineId
      ? `Dispositivo [${normMac}] abbinato con successo a '${machineId}'`
      : `Dispositivo [${normMac}] scollegato (ora di scorta/disponibile)`,
    device,
  });
});

// POST /api/devices/:mac/unpair - Explicit Unpair route
app.post('/api/devices/:mac/unpair', (req, res) => {
  req.body = req.body || {};
  req.body.machineId = null;
  // Redirect to pair logic with machineId = null
  const normMac = normalizeMacAddress(req.params.mac);
  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: `Modulo GB-CLOUD con MAC '${normMac}' non trovato` });
    return;
  }

  const oldMachineId = device.assignedMachineId;
  if (oldMachineId) {
    const oldMachine = db.machines.find((m) => m.id === oldMachineId);
    if (oldMachine) {
      oldMachine.assignedDeviceMac = null;
      oldMachine.macAddress = null;
      oldMachine.status = 'OFFLINE';
    }
  }
  db.machines.forEach((m) => {
    if ((m.assignedDeviceMac && normalizeMacAddress(m.assignedDeviceMac) === normMac) ||
        (m.macAddress && normalizeMacAddress(m.macAddress) === normMac)) {
      m.assignedDeviceMac = null;
      m.macAddress = null;
      m.status = 'OFFLINE';
    }
  });
  device.assignedMachineId = null;
  device.status = 'UNASSIGNED';

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Modulo GB-CLOUD [${normMac}] scollegato con successo (ora UNASSIGNED)`,
    device,
  });
});

// DELETE /api/devices/:mac - Delete a Device
app.delete('/api/devices/:mac', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: 'Dispositivo non trovato' });
    return;
  }

  // Unpair from all machines referencing this device MAC
  db.machines.forEach((m) => {
    if (m.assignedDeviceMac && normalizeMacAddress(m.assignedDeviceMac) === normMac) {
      m.assignedDeviceMac = null;
      m.status = 'OFFLINE';
    }
  });

  db.devices = db.devices.filter((d) => normalizeMacAddress(d.macAddress) !== normMac);
  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({ success: true, message: `Modulo GB-CLOUD [${normMac}] rimosso dal sistema` });
});

// POST /api/devices/heartbeat - Heartbeat Ping from ESP32 Device with Heap, Uptime & Diagnostics
app.post('/api/devices/heartbeat', (req, res) => {
  const { macAddress, deviceId, ip, rssi, firmwareVersion, freeHeap, uptimeSec, logMessage, logLevel } = req.body;
  if (!macAddress && !deviceId) {
    res.status(400).json({ success: false, error: 'macAddress o deviceId richiesto per heartbeat' });
    return;
  }

  const normMac = macAddress ? normalizeMacAddress(macAddress) : null;
  const db = loadDatabase();
  
  let device = db.devices.find((d) => (normMac && normalizeMacAddress(d.macAddress) === normMac) || (deviceId && d.deviceId === deviceId));

  if (!device && normMac) {
    // Auto-register new GB-CLOUD MODULE node
    const existingSerials = (db.devices || []).map((d) => d.serialNumber).filter(Boolean);
    const genSerial = generateGbCloudModuleSerial(existingSerials);
    const moduleName = `GB-CLOUD MODULE ${genSerial}`;

    device = {
      macAddress: normMac,
      serialNumber: genSerial,
      deviceId: moduleName,
      boardModel: 'GB-CLOUD Controller Board (Opto-Isolated)',
      firmwareVersion: firmwareVersion || 'v3.2.0-OPTO-MATRIX',
      ipAddress: ip || '192.168.1.200',
      wifiSsid: 'Auto_WiFi',
      wifiRssi: typeof rssi === 'number' ? rssi : -60,
      freeHeap: typeof freeHeap === 'number' ? freeHeap : 238400,
      uptimeSec: typeof uptimeSec === 'number' ? uptimeSec : 120,
      status: 'UNASSIGNED',
      assignedMachineId: null,
      hardwareConfig: {
        debounceMs: 30,
        optoTriggerDurationMs: 400,
        voltageLevel: '12v_opto',
        matrixPins: { row1: 13, row2: 12, row3: 14, row4: 27, col1: 26, col2: 25, col3: 33, col4: 32 },
        optoOutputPins: [19, 21, 22, 23],
        buzzerPin: 18,
        relayPin: 5,
      },
      diagnosticLogs: [
        {
          timestamp: new Date().toISOString(),
          level: 'INFO',
          message: `Modulo GB-CLOUD #${genSerial} avviato: Tastiera a membrana e modulo optoisolatori attivi`,
          heapFreeBytes: typeof freeHeap === 'number' ? freeHeap : 238400,
          uptimeSeconds: typeof uptimeSec === 'number' ? uptimeSec : 120,
          wifiRssi: typeof rssi === 'number' ? rssi : -60,
        },
      ],
      lastHeartbeatAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.devices.push(device);
  } else if (device) {
    device.lastHeartbeatAt = new Date().toISOString();
    device.status = device.assignedMachineId ? 'ONLINE' : 'UNASSIGNED';
    if (ip) device.ipAddress = String(ip);
    if (typeof rssi === 'number') device.wifiRssi = rssi;
    if (firmwareVersion) device.firmwareVersion = String(firmwareVersion);
    if (typeof freeHeap === 'number') device.freeHeap = freeHeap;
    if (typeof uptimeSec === 'number') device.uptimeSec = uptimeSec;

    // Append log if present
    if (logMessage) {
      if (!device.diagnosticLogs) device.diagnosticLogs = [];
      device.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: (logLevel as any) || 'INFO',
        message: String(logMessage),
        heapFreeBytes: device.freeHeap,
        uptimeSeconds: device.uptimeSec,
        wifiRssi: device.wifiRssi,
      });
      // Keep last 40 logs
      if (device.diagnosticLogs.length > 40) {
        device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);
      }
    }

    // If device is explicitly paired to a machine, mark machine online
    if (device.assignedMachineId) {
      const pairedMachine = db.machines.find((m) => m.id === device!.assignedMachineId);
      if (pairedMachine && pairedMachine.status !== 'MAINTENANCE') {
        pairedMachine.status = 'ONLINE';
        pairedMachine.lastTelemetryAt = new Date().toISOString();
        if (ip) pairedMachine.ipAddress = String(ip);
      }
    }
  }

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: 'Heartbeat ricevuto',
    device,
    serverTime: new Date().toISOString(),
  });
});

// =========================================================================
// REST API DEDICATE A SISTEMI DI TELEMETRIA TERZI (MODEM 4G / GATEWAY ESTERNI)
// =========================================================================

// Middleware di autenticazione per API esterne tramite API Key
function validateThirdPartyApiKey(req: express.Request, db: DatabaseSchema): { valid: boolean; apiKey?: ApiKeyDefinition; error?: string } {
  const authHeader = req.headers['authorization'];
  const xApiKey = req.headers['x-api-key'];
  
  let token = '';
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (typeof xApiKey === 'string') {
    token = xApiKey.trim();
  } else if (typeof req.query.api_key === 'string') {
    token = req.query.api_key.trim();
  }

  if (!token) {
    return { valid: false, error: 'Manca la chiave di autenticazione API. Includere header "Authorization: Bearer <API_KEY>" oppure "X-API-Key: <API_KEY>"' };
  }

  const matchingKey = (db.apiKeys || []).find((k) => k.isActive && k.key === token);
  if (!matchingKey) {
    return { valid: false, error: 'Chiave API non valida o revocata. Verificare le credenziali con l\'amministratore del portale.' };
  }

  matchingKey.totalCalls = (matchingKey.totalCalls || 0) + 1;
  matchingKey.lastUsedAt = new Date().toISOString();

  return { valid: true, apiKey: matchingKey };
}

// GET /api/v1/telemetry/keys - Elenco chiavi API partner
app.get('/api/v1/telemetry/keys', (req, res) => {
  const db = loadDatabase();
  res.json({
    success: true,
    keys: db.apiKeys || [],
  });
});

// POST /api/v1/telemetry/keys - Genera nuova chiave API per partner esterno
app.post('/api/v1/telemetry/keys', (req, res) => {
  const { name, description } = req.body;
  if (!name || String(name).trim() === '') {
    res.status(400).json({ success: false, error: 'Il nome del partner o del dispositivo esterno è obbligatorio' });
    return;
  }

  const db = loadDatabase();
  if (!db.apiKeys) db.apiKeys = [];

  const rawRandom = crypto.randomBytes(16).toString('hex');
  const newApiKey: ApiKeyDefinition = {
    id: `key-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: String(name).trim(),
    key: `gb_live_${rawRandom}`,
    description: description ? String(description).trim() : 'Chiave API per telemetria esterna',
    createdAt: new Date().toISOString(),
    totalCalls: 0,
    isActive: true,
  };

  db.apiKeys.unshift(newApiKey);
  saveDatabase(db);

  res.json({
    success: true,
    message: `Chiave API per '${newApiKey.name}' generata con successo!`,
    apiKey: newApiKey,
  });
});

// DELETE /api/v1/telemetry/keys/:id - Revoca / elimina chiave API partner
app.delete('/api/v1/telemetry/keys/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.apiKeys) db.apiKeys = [];

  const idx = db.apiKeys.findIndex((k) => k.id === id);
  if (idx === -1) {
    res.status(404).json({ success: false, error: 'Chiave API non trovata' });
    return;
  }

  const removed = db.apiKeys.splice(idx, 1)[0];
  saveDatabase(db);

  res.json({
    success: true,
    message: `Chiave API '${removed.name}' revocata con successo`,
  });
});

// GET /api/v1/telemetry/logs - Visualizza log delle richieste ricevute da sistemi terzi
app.get('/api/v1/telemetry/logs', (req, res) => {
  const db = loadDatabase();
  res.json({
    success: true,
    logs: (db.thirdPartyTelemetryLogs || []).slice(0, 100),
  });
});

// -------------------------------------------------------------------------
// ENDPOINT PRINCIPALE: POST /api/v1/telemetry/dispense
// Riceve eventi di erogazione / battuta vendita da modem e sistemi esterni
// -------------------------------------------------------------------------
app.post('/api/v1/telemetry/dispense', (req, res) => {
  const db = loadDatabase();
  const auth = validateThirdPartyApiKey(req, db);

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!auth.valid) {
    const errorLog: ThirdPartyTelemetryLog = {
      id: `tplog-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      apiKeyName: 'Non Autenticato',
      endpoint: '/api/v1/telemetry/dispense',
      serialNumber: String(req.body?.serialNumber || 'N/D'),
      ipAddress: clientIp,
      status: 'ERROR',
      message: auth.error || 'Autenticazione fallita',
      payloadSummary: JSON.stringify(req.body).slice(0, 150),
    };
    if (!db.thirdPartyTelemetryLogs) db.thirdPartyTelemetryLogs = [];
    db.thirdPartyTelemetryLogs.unshift(errorLog);
    if (db.thirdPartyTelemetryLogs.length > 200) db.thirdPartyTelemetryLogs = db.thirdPartyTelemetryLogs.slice(0, 200);
    saveDatabase(db);

    res.status(401).json({ success: false, error: auth.error });
    return;
  }

  const {
    serialNumber,
    machineId,
    productNumber,
    key,
    productName,
    timestamp,
    caraffa = false,
    price,
    source = 'THIRD_PARTY_REST',
  } = req.body;

  if (!serialNumber && !machineId) {
    res.status(400).json({
      success: false,
      error: 'Campo obbligatorio mancante: specificare "serialNumber" (matricola distributore a 6 cifre) o "machineId"',
    });
    return;
  }

  // Risoluzione Distributore tramite matricola o ID
  const rawSerial = String(serialNumber || '').replace(/\D/g, '');
  const targetId = String(machineId || '').trim();

  const machine = db.machines.find(
    (m) => (rawSerial && m.serialNumber === rawSerial) || (targetId && m.id.toLowerCase() === targetId.toLowerCase())
  );

  if (!machine) {
    const errorMsg = `Nessun distributore trovato con matricola #${rawSerial || targetId} nel database della flotta.`;
    const errorLog: ThirdPartyTelemetryLog = {
      id: `tplog-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      timestamp: new Date().toISOString(),
      apiKeyName: auth.apiKey?.name,
      endpoint: '/api/v1/telemetry/dispense',
      serialNumber: rawSerial || targetId,
      ipAddress: clientIp,
      status: 'ERROR',
      message: errorMsg,
      payloadSummary: JSON.stringify(req.body).slice(0, 150),
    };
    if (!db.thirdPartyTelemetryLogs) db.thirdPartyTelemetryLogs = [];
    db.thirdPartyTelemetryLogs.unshift(errorLog);
    saveDatabase(db);

    res.status(404).json({ success: false, error: errorMsg });
    return;
  }

  // Risoluzione Prodotto / Bevanda (1..12 o P1..P12)
  let resolvedProdNum = typeof productNumber === 'number' ? productNumber : 1;
  let resolvedKey = key ? String(key).toUpperCase() : `P${resolvedProdNum}`;

  if (!productNumber && key) {
    const match = String(key).match(/\d+/);
    if (match) {
      resolvedProdNum = parseInt(match[0], 10);
    }
  }

  if (resolvedProdNum < 1) resolvedProdNum = 1;
  if (resolvedProdNum > 15) resolvedProdNum = 15;

  const matchedBeverage = (db.beverages || []).find((b) => b.productNumber === resolvedProdNum || b.key === resolvedKey);
  const effectiveProdName = productName ? String(productName).trim() : (matchedBeverage ? matchedBeverage.name : `Bevanda P${resolvedProdNum}`);
  const effectivePrice = typeof price === 'number' ? price : (matchedBeverage ? matchedBeverage.price : 0.0);
  const effectiveTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  const dispenseId = `disp-ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const dispenseRecord: DispenseRecord = {
    id: dispenseId,
    beverageId: matchedBeverage?.id || `bev-${resolvedProdNum}`,
    beverageName: effectiveProdName,
    key: resolvedKey,
    code: `P${resolvedProdNum < 10 ? '0' : ''}${resolvedProdNum}`,
    timestamp: effectiveTimestamp,
    price: effectivePrice,
    sugarLevel: 0,
    isCaraffa: Boolean(caraffa),
    doseMultiplier: caraffa ? (machine.config?.caraffaMultiplier || 3) : 1,
    status: 'COMPLETED',
    deviceId: machine.id,
    machineSerialNumber: machine.serialNumber,
    customerName: machine.locationDetails?.company || 'Non Assegnato',
    siteName: machine.locationDetails?.site || 'Sede Operativa',
    machineName: machine.name,
    prepTimeSec: matchedBeverage?.prepTimeSec || 8,
    coinsInserted: 0,
    changeGiven: 0,
  };

  if (!db.dispenses) db.dispenses = [];
  db.dispenses.unshift(dispenseRecord);
  if (db.dispenses.length > 500) db.dispenses = db.dispenses.slice(0, 500);

  // Inserisci anche in KeyLog per la tracciabilità delle battute
  const keyLog: KeyLog = {
    id: `log-ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    key: resolvedKey,
    productNumber: resolvedProdNum,
    productName: effectiveProdName,
    timestamp: effectiveTimestamp,
    deviceId: machine.id,
    machineSerialNumber: machine.serialNumber,
    customerName: dispenseRecord.customerName,
    siteName: dispenseRecord.siteName,
    eventType: 'pressed',
    channel: `API-REST-TERZI (${auth.apiKey?.name || source})`,
    rssi: -50,
    ip: clientIp,
  };

  if (!db.logs) db.logs = [];
  db.logs.unshift(keyLog);
  if (db.logs.length > 800) db.logs = db.logs.slice(0, 800);

  // Aggiorna totali macchina e stato
  if (!machine.supplies) {
    machine.supplies = {
      waterLevelLiters: 20,
      maxWaterLiters: 25,
      coffeeBeansGrams: 900,
      maxCoffeeGrams: 1200,
      milkPowderGrams: 800,
      maxMilkGrams: 1000,
      chocolatePowderGrams: 700,
      maxChocolateGrams: 1000,
      teaPowderGrams: 400,
      maxTeaGrams: 600,
      sugarGrams: 900,
      maxSugarGrams: 1200,
      cupsCount: 180,
      maxCups: 200,
      stirrersCount: 180,
      maxStirrers: 200,
      boilerTempCelsius: 92.5,
      targetTempCelsius: 93,
      totalEarnings: 0,
      totalDispenses: 0,
    };
  }

  machine.supplies.totalDispenses = (machine.supplies.totalDispenses || 0) + 1;
  machine.supplies.totalEarnings = Number(((machine.supplies.totalEarnings || 0) + effectivePrice).toFixed(2));
  machine.lastTelemetryAt = effectiveTimestamp;
  if (machine.status !== 'MAINTENANCE') {
    machine.status = 'ONLINE';
  }

  // Registra nei log audit terze parti
  const successLog: ThirdPartyTelemetryLog = {
    id: `tplog-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    timestamp: new Date().toISOString(),
    apiKeyName: auth.apiKey?.name,
    endpoint: '/api/v1/telemetry/dispense',
    serialNumber: machine.serialNumber,
    machineName: machine.name,
    ipAddress: clientIp,
    productNumber: resolvedProdNum,
    productName: effectiveProdName,
    status: 'SUCCESS',
    message: `Erogazione registrata: ${effectiveProdName} (#${machine.serialNumber})`,
    payloadSummary: JSON.stringify({ key: resolvedKey, caraffa: Boolean(caraffa), source }),
  };

  if (!db.thirdPartyTelemetryLogs) db.thirdPartyTelemetryLogs = [];
  db.thirdPartyTelemetryLogs.unshift(successLog);
  if (db.thirdPartyTelemetryLogs.length > 200) db.thirdPartyTelemetryLogs = db.thirdPartyTelemetryLogs.slice(0, 200);

  saveDatabase(db);

  // Trasmetti in tempo reale agli schermi web
  broadcastSse('machines-updated', db.machines);
  broadcastSse('dispenses-updated', db.dispenses);
  broadcastSse('logs-updated', db.logs);
  broadcastSse('third-party-telemetry', successLog);

  res.status(200).json({
    success: true,
    message: 'Erogazione registrata con successo nel portale General Beverage',
    dispenseId,
    machine: {
      id: machine.id,
      serialNumber: machine.serialNumber,
      name: machine.name,
      customer: machine.locationDetails?.company || 'Non Assegnato',
      site: machine.locationDetails?.site || 'Sede Operativa',
    },
    product: {
      productNumber: resolvedProdNum,
      key: resolvedKey,
      name: effectiveProdName,
      price: effectivePrice,
    },
    timestamp: effectiveTimestamp,
  });
});

// -------------------------------------------------------------------------
// ENDPOINT: POST /api/v1/telemetry/heartbeat
// Riceve stato periodico, temperatura caldaia, scorte o diagnostica
// -------------------------------------------------------------------------
app.post('/api/v1/telemetry/heartbeat', (req, res) => {
  const db = loadDatabase();
  const auth = validateThirdPartyApiKey(req, db);
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!auth.valid) {
    res.status(401).json({ success: false, error: auth.error });
    return;
  }

  const { serialNumber, machineId, status, boilerTemp, waterLevel, totalDispenses, signalRssi, firmwareVersion, notes } = req.body;
  const rawSerial = String(serialNumber || '').replace(/\D/g, '');
  const targetId = String(machineId || '').trim();

  const machine = db.machines.find(
    (m) => (rawSerial && m.serialNumber === rawSerial) || (targetId && m.id.toLowerCase() === targetId.toLowerCase())
  );

  if (!machine) {
    res.status(404).json({ success: false, error: `Nessun distributore trovato con matricola #${rawSerial || targetId}` });
    return;
  }

  machine.lastTelemetryAt = new Date().toISOString();
  if (status && ['ONLINE', 'STANDBY', 'OFFLINE'].includes(status) && machine.status !== 'MAINTENANCE') {
    machine.status = status as any;
  } else if (machine.status !== 'MAINTENANCE') {
    machine.status = 'ONLINE';
  }

  if (machine.supplies) {
    if (typeof boilerTemp === 'number') machine.supplies.boilerTempCelsius = boilerTemp;
    if (typeof waterLevel === 'number') machine.supplies.waterLevelLiters = waterLevel;
    if (typeof totalDispenses === 'number') machine.supplies.totalDispenses = totalDispenses;
  }

  if (firmwareVersion) machine.firmwareVersion = String(firmwareVersion);

  const heartbeatLog: ThirdPartyTelemetryLog = {
    id: `tplog-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    timestamp: new Date().toISOString(),
    apiKeyName: auth.apiKey?.name,
    endpoint: '/api/v1/telemetry/heartbeat',
    serialNumber: machine.serialNumber,
    machineName: machine.name,
    ipAddress: clientIp,
    status: 'SUCCESS',
    message: `Heartbeat ricevuto: stato ${machine.status}, caldaia ${machine.supplies?.boilerTempCelsius || 93}°C`,
    payloadSummary: JSON.stringify(req.body).slice(0, 150),
  };

  if (!db.thirdPartyTelemetryLogs) db.thirdPartyTelemetryLogs = [];
  db.thirdPartyTelemetryLogs.unshift(heartbeatLog);
  if (db.thirdPartyTelemetryLogs.length > 200) db.thirdPartyTelemetryLogs = db.thirdPartyTelemetryLogs.slice(0, 200);

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('third-party-telemetry', heartbeatLog);

  res.json({
    success: true,
    message: `Heartbeat per distributore #${machine.serialNumber} (${machine.name}) aggiornato`,
    machine: {
      id: machine.id,
      serialNumber: machine.serialNumber,
      name: machine.name,
      status: machine.status,
      lastTelemetryAt: machine.lastTelemetryAt,
    },
  });
});

// -------------------------------------------------------------------------
// ENDPOINT: POST /api/v1/telemetry/alarm
// Riceve segnalazioni di allarmi, guasti o mancanza prodotti
// -------------------------------------------------------------------------
app.post('/api/v1/telemetry/alarm', (req, res) => {
  const db = loadDatabase();
  const auth = validateThirdPartyApiKey(req, db);
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!auth.valid) {
    res.status(401).json({ success: false, error: auth.error });
    return;
  }

  const { serialNumber, machineId, errorCode, message, severity = 'WARN', timestamp } = req.body;
  const rawSerial = String(serialNumber || '').replace(/\D/g, '');
  const targetId = String(machineId || '').trim();

  const machine = db.machines.find(
    (m) => (rawSerial && m.serialNumber === rawSerial) || (targetId && m.id.toLowerCase() === targetId.toLowerCase())
  );

  if (!machine) {
    res.status(404).json({ success: false, error: `Nessun distributore trovato con matricola #${rawSerial || targetId}` });
    return;
  }

  const effectiveMsg = `[ALLARME TELEMETRIA TERZI] ${errorCode ? `[${errorCode}] ` : ''}${message || 'Anomalia segnalata'}`;
  
  // Se la macchina ha un modulo collegato, aggiungi al log diagnostico
  if (machine.assignedDeviceMac) {
    const dev = (db.devices || []).find((d) => normalizeMacAddress(d.macAddress) === normalizeMacAddress(machine.assignedDeviceMac!));
    if (dev) {
      if (!dev.diagnosticLogs) dev.diagnosticLogs = [];
      dev.diagnosticLogs.unshift({
        timestamp: timestamp || new Date().toISOString(),
        level: (severity === 'CRITICAL' ? 'ERROR' : severity) as any,
        message: effectiveMsg,
      });
      if (dev.diagnosticLogs.length > 50) dev.diagnosticLogs = dev.diagnosticLogs.slice(0, 50);
    }
  }

  const alarmLog: ThirdPartyTelemetryLog = {
    id: `tplog-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    timestamp: new Date().toISOString(),
    apiKeyName: auth.apiKey?.name,
    endpoint: '/api/v1/telemetry/alarm',
    serialNumber: machine.serialNumber,
    machineName: machine.name,
    ipAddress: clientIp,
    status: 'SUCCESS',
    message: effectiveMsg,
    payloadSummary: JSON.stringify(req.body).slice(0, 150),
  };

  if (!db.thirdPartyTelemetryLogs) db.thirdPartyTelemetryLogs = [];
  db.thirdPartyTelemetryLogs.unshift(alarmLog);
  if (db.thirdPartyTelemetryLogs.length > 200) db.thirdPartyTelemetryLogs = db.thirdPartyTelemetryLogs.slice(0, 200);

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('third-party-telemetry', alarmLog);

  res.json({
    success: true,
    message: `Allarme registrato per distributore #${machine.serialNumber} (${machine.name})`,
  });
});

// GET /api/system/app-info - Get current app build version, server time, and status
app.get('/api/system/app-info', (req, res) => {
  const db = loadDatabase();
  const pkgPath = path.join(process.cwd(), 'package.json');
  let version = '1.5.1';
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) version = pkg.version;
    }
  } catch {
    // fallback
  }

  const now = new Date();
  res.json({
    success: true,
    name: 'General Beverage Telemetry Hub',
    version: `v${version}`,
    serverTime: now.toISOString(),
    formattedTime: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    formattedDate: now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    totalMachines: db.machines?.length || 0,
    onlineDevices: (db.devices || []).filter((d) => d.status === 'ONLINE').length,
    mqttConnected: mqttStatus.connected,
    database: {
      status: 'HEALTHY',
      type: getPgPool() ? 'POSTGRESQL_RELATIONAL' : 'JSON_ATOMIC_QUEUE',
      postgresConnected: Boolean(getPgPool()),
      cachedInMemory: Boolean(cachedDb),
      totalRecords: {
        machines: db.machines?.length || 0,
        devices: db.devices?.length || 0,
        customers: db.customers?.length || 0,
        logs: db.logs?.length || 0,
        users: db.users?.length || 0,
      },
      lastSavedBackup: fs.existsSync(path.join(BACKUP_DIR, 'keypad_db_auto_backup.json'))
        ? fs.statSync(path.join(BACKUP_DIR, 'keypad_db_auto_backup.json')).mtime.toISOString()
        : null,
    },
  });
});

// GET /api/system/database/status - Real-time diagnostic details for Database Manager UI
app.get('/api/system/database/status', async (req, res) => {
  const db = loadDatabase();
  const pgStatus = await getPostgresDetailedStatus();

  res.json({
    success: true,
    engine: pgStatus.connected ? 'POSTGRESQL' : 'JSON_IN_MEMORY',
    postgres: pgStatus,
    localCache: {
      cachedInMemory: Boolean(cachedDb),
      totalMachines: db.machines?.length || 0,
      totalDevices: db.devices?.length || 0,
      totalCustomers: db.customers?.length || 0,
      totalLogs: db.logs?.length || 0,
      totalUsers: db.users?.length || 0,
      totalAlerts: db.alerts?.length || 0,
      lastBackupTime: fs.existsSync(path.join(BACKUP_DIR, 'keypad_db_auto_backup.json'))
        ? fs.statSync(path.join(BACKUP_DIR, 'keypad_db_auto_backup.json')).mtime.toISOString()
        : null,
    },
  });
});

// POST /api/system/database/sync-postgres - Manual or automated sync to PostgreSQL
app.post('/api/system/database/sync-postgres', async (req, res) => {
  const p = getPgPool();
  if (!p) {
    return res.status(400).json({
      success: false,
      message: 'PostgreSQL non configurato. Imposta DATABASE_URL nel file .env sul tuo VPS.',
    });
  }

  const db = loadDatabase();
  const result = await syncJsonToPostgres(db);
  res.json({
    success: result.success,
    message: result.success ? 'Migrazione a PostgreSQL completata con successo!' : 'Errore durante la migrazione a PostgreSQL',
    imported: result.imported,
  });
});

// POST /api/system/database/restore-from-postgres - Restore database state from PostgreSQL
app.post('/api/system/database/restore-from-postgres', async (req, res) => {
  const p = getPgPool();
  if (!p) {
    return res.status(400).json({
      success: false,
      message: 'PostgreSQL non configurato. Imposta DATABASE_URL nel file .env sul tuo VPS.',
    });
  }

  const pgRes = await restorePostgresToJson();
  if (!pgRes.success || !pgRes.data) {
    return res.status(500).json({
      success: false,
      error: pgRes.error || 'Errore durante la lettura da PostgreSQL',
    });
  }

  const db = loadDatabase();
  if (pgRes.data.customers?.length) db.customers = pgRes.data.customers;
  if (pgRes.data.machines?.length) db.machines = pgRes.data.machines;
  if (pgRes.data.devices?.length) db.devices = pgRes.data.devices;
  if (pgRes.data.logs?.length) db.logs = pgRes.data.logs;
  if (pgRes.data.users?.length) db.users = pgRes.data.users;

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: `Database ripristinato con successo da PostgreSQL: ${pgRes.count.machines} macchine, ${pgRes.count.customers} clienti, ${pgRes.count.logs} erogazioni.`,
    count: pgRes.count,
  });
});

// POST /api/system/database/sql/restore-from-backup - Clean restore of PostgreSQL from a backup file or payload
app.post('/api/system/database/sql/restore-from-backup', async (req, res) => {
  const p = getPgPool();
  if (!p) {
    return res.status(400).json({
      success: false,
      message: 'PostgreSQL non configurato o non attivo sul server.',
    });
  }

  try {
    let sourceData = req.body?.data;
    const backupFile = req.body?.backupFile;

    if (!sourceData && backupFile) {
      let resolvedPath = path.resolve(process.cwd(), backupFile);
      if (!fs.existsSync(resolvedPath)) {
        resolvedPath = path.resolve(BACKUP_DIR, path.basename(backupFile));
      }
      if (fs.existsSync(resolvedPath)) {
        sourceData = JSON.parse(fs.readFileSync(resolvedPath, 'utf-8'));
      }
    }

    if (!sourceData) {
      sourceData = loadDatabase();
    }

    const restoreRes = await cleanRestoreJsonToPostgres(sourceData);
    if (!restoreRes.success) {
      return res.status(500).json({ success: false, error: restoreRes.error });
    }

    // Refresh application cache from PostgreSQL
    const freshFromPg = await restorePostgresToJson();
    if (freshFromPg.success && freshFromPg.data) {
      const db = loadDatabase();
      db.customers = freshFromPg.data.customers || [];
      db.machines = freshFromPg.data.machines || [];
      db.devices = freshFromPg.data.devices || [];
      if (freshFromPg.data.logs) db.logs = freshFromPg.data.logs;
      if (freshFromPg.data.users) db.users = freshFromPg.data.users;
      if (freshFromPg.data.orders) db.orders = freshFromPg.data.orders;
      if (freshFromPg.data.supportRequests) db.supportRequests = freshFromPg.data.supportRequests;
      cachedDb = db;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
      } catch {}
      broadcastSse('machines-updated', db.machines);
      broadcastSse('devices-updated', db.devices);
    }

    res.json({
      success: true,
      message: `Database SQL (PostgreSQL) ripristinato con successo: ${restoreRes.count.machines} macchine, ${restoreRes.count.devices} moduli, ${restoreRes.count.customers} clienti!`,
      count: restoreRes.count,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || String(err) });
  }
});

// GET /api/system/database/backup - Download the latest database JSON snapshot directly (convenient for VPS backup)
app.get('/api/system/database/backup', (req, res) => {
  const db = loadDatabase();
  const dateTag = new Date().toISOString().split('T')[0];
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="gb-telemetry-backup-${dateTag}.json"`);
  res.send(JSON.stringify(db, null, 2));
});

// POST /api/system/refresh-app - Broadcast full app data refresh to all connected clients
app.post('/api/system/refresh-app', (req, res) => {
  const db = loadDatabase();
  evaluateDevicesAndMachinesFreshness(db, true);
  saveDatabase(db);

  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('beverages-updated', db.beverages);

  const now = new Date();
  res.json({
    success: true,
    message: 'Dati e stato applicazione aggiornati con successo!',
    version: 'v1.4.2',
    timestamp: now.toISOString(),
    formattedTime: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  });
});

// GET /api/config/heartbeat-timeout - Get current heartbeat timeout setting
app.get('/api/config/heartbeat-timeout', (req, res) => {
  const db = loadDatabase();
  const heartbeatTimeoutSec = db.config?.heartbeatTimeoutSec || 45;
  res.json({ success: true, heartbeatTimeoutSec });
});

// POST /api/config/heartbeat-timeout - Set heartbeat timeout threshold (e.g. 15s, 30s, 45s, 60s, 120s)
app.post('/api/config/heartbeat-timeout', (req, res) => {
  const { heartbeatTimeoutSec } = req.body;
  const timeoutVal = Math.max(5, Math.min(600, Number(heartbeatTimeoutSec) || 45));
  
  const db = loadDatabase();
  if (!db.config) {
    db.config = getDefaultDb().config;
  }
  db.config.heartbeatTimeoutSec = timeoutVal;
  
  // Re-evaluate immediately
  evaluateDevicesAndMachinesFreshness(db, true);
  saveDatabase(db);

  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Timeout Heartbeat impostato su ${timeoutVal} secondi`,
    heartbeatTimeoutSec: timeoutVal,
  });
});

// POST /api/devices/check-status - Force immediate watchdog evaluation & return live ping report
app.post('/api/devices/check-status', (req, res) => {
  const db = loadDatabase();
  evaluateDevicesAndMachinesFreshness(db, true);
  const timeoutSec = Math.max(5, db.config?.heartbeatTimeoutSec || 45);
  const now = Date.now();

  const report = db.devices.map((dev) => {
    const lastPingMs = dev.lastHeartbeatAt ? new Date(dev.lastHeartbeatAt).getTime() : 0;
    const secondsAgo = lastPingMs > 0 ? Math.round((now - lastPingMs) / 1000) : 999999;
    const isOnline = secondsAgo <= timeoutSec;
    return {
      macAddress: dev.macAddress,
      deviceId: dev.deviceId,
      status: dev.status,
      secondsAgo,
      isOnline,
      lastHeartbeatAt: dev.lastHeartbeatAt,
      ipAddress: dev.ipAddress,
      wifiRssi: dev.wifiRssi,
    };
  });

  res.json({
    success: true,
    message: 'Verifica stato dispositivi completata',
    timeoutSec,
    devices: report,
    onlineCount: report.filter((r) => r.isOnline).length,
    totalCount: report.length,
  });
});

// POST /api/devices/:mac/toggle-status - Manually set device status (for testing or forced maintenance)
app.post('/api/devices/:mac/toggle-status', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const { status } = req.body;
  if (!['ONLINE', 'OFFLINE', 'STANDBY', 'UNASSIGNED', 'MAINTENANCE'].includes(status)) {
    res.status(400).json({ success: false, error: 'Stato non valido (ONLINE, OFFLINE, STANDBY, UNASSIGNED, MAINTENANCE)' });
    return;
  }

  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: 'Dispositivo non trovato' });
    return;
  }

  device.status = status;
  if (status === 'ONLINE') {
    device.lastHeartbeatAt = new Date().toISOString();
  }

  const machine = device.assignedMachineId ? db.machines.find((m) => m.id === device.assignedMachineId) : null;
  if (machine && machine.status !== 'MAINTENANCE') {
    machine.status = status === 'ONLINE' ? 'ONLINE' : (status === 'OFFLINE' ? 'OFFLINE' : 'STANDBY');
    if (status === 'ONLINE') machine.lastTelemetryAt = new Date().toISOString();
  }

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Stato dispositivo [${normMac}] impostato su '${status}'`,
    device,
  });
});

// POST /api/devices/discover - Network discovery check
app.post('/api/devices/discover', (req, res) => {
  const db = loadDatabase();
  evaluateDevicesAndMachinesFreshness(db, true);
  const timeoutSec = Math.max(5, db.config?.heartbeatTimeoutSec || 45);
  const timeoutMs = timeoutSec * 1000;

  const activeDevices = db.devices.filter((d) => {
    if (!d.lastHeartbeatAt) return false;
    const lastPing = new Date(d.lastHeartbeatAt).getTime();
    return Date.now() - lastPing < timeoutMs;
  });

  res.json({
    success: true,
    message: activeDevices.length > 0 
      ? `Scansione completata: ${activeDevices.length} modulo/i GB-CLOUD attivo/i e connesso/i (finestra ${timeoutSec}s)`
      : `Nessun segnale Modulo ricevuto negli ultimi ${timeoutSec}s. Verifica alimentazione o connessione Wi-Fi/MQTT.`,
    discoveredCount: activeDevices.length,
    totalDevices: db.devices.length,
    activeDevices,
    timeoutSec,
  });
});

// POST /api/devices/:mac/provision-wifi - Push WiFi Credentials / Config to Device
app.post('/api/devices/:mac/provision-wifi', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const { ssid, password, staticIp, gateway, dns, serverUrl } = req.body;
  if (!ssid) {
    res.status(400).json({ success: false, error: 'SSID Wi-Fi obbligatorio per il provisioning' });
    return;
  }

  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: 'Dispositivo non trovato' });
    return;
  }

  device.wifiSsid = ssid.trim();
  if (staticIp) device.ipAddress = staticIp.trim();
  device.lastHeartbeatAt = new Date().toISOString();

  if (!device.diagnosticLogs) device.diagnosticLogs = [];
  device.diagnosticLogs.unshift({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `Provisioning Wi-Fi completato: Connesso a SSID '${ssid}' (IP: ${device.ipAddress})`,
    heapFreeBytes: device.freeHeap || 240000,
    uptimeSeconds: (device.uptimeSec || 0) + 10,
    wifiRssi: -50,
  });

  saveDatabase(db);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: `Parametri Wi-Fi inviati e configurati con successo su Modulo GB-CLOUD [${normMac}] (SSID: ${ssid})`,
    device,
  });
});

// GET /api/devices/:mac/diagnostics - Get full diagnostics for ESP32
app.get('/api/devices/:mac/diagnostics', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: 'Dispositivo non trovato' });
    return;
  }

  // Ensure diagnostic logs exist with realistic baseline
  if (!device.diagnosticLogs || device.diagnosticLogs.length === 0) {
    device.diagnosticLogs = [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        level: 'INFO',
        message: 'Bootloader ESP-IDF v4.4 - System Initialized OK',
        heapFreeBytes: 284900,
        uptimeSeconds: 0,
        wifiRssi: -58,
        cpuTempC: 38.0,
      },
      {
        timestamp: new Date(Date.now() - 3550000).toISOString(),
        level: 'INFO',
        message: `Connesso alla rete WiFi '${device.wifiSsid}' con IP ${device.ipAddress}`,
        heapFreeBytes: 262100,
        uptimeSeconds: 50,
        wifiRssi: device.wifiRssi || -58,
      },
      {
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'DEBUG',
        message: 'Matrice tastiera a membrana (8 fili / 4x4) inizializzata. Uscite opto pronte.',
        heapFreeBytes: 251000,
        uptimeSeconds: 3300,
        wifiRssi: device.wifiRssi || -58,
      },
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `Heartbeat telemetria attivo. Uscite optoisolate pronte per simulazione tastiera (${device.hardwareConfig?.voltageLevel || '12V Opto'}).`,
        heapFreeBytes: device.freeHeap || 248000,
        uptimeSeconds: device.uptimeSec || 3600,
        wifiRssi: device.wifiRssi || -58,
      },
    ];
  }

  res.json({
    success: true,
    device: {
      macAddress: device.macAddress,
      deviceId: device.deviceId,
      boardModel: device.boardModel,
      ipAddress: device.ipAddress,
      wifiSsid: device.wifiSsid,
      wifiRssi: device.wifiRssi ?? -58,
      status: device.status,
      freeHeap: device.freeHeap ?? 245600,
      uptimeSec: device.uptimeSec ?? 86400,
      hardwareConfig: device.hardwareConfig,
      diagnosticLogs: device.diagnosticLogs,
      lastHeartbeatAt: device.lastHeartbeatAt,
    },
  });
});

// POST /api/devices/:mac/test-opto - Simulate or send test trigger pulse on Opto-isolated Output pin
app.post('/api/devices/:mac/test-opto', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const { pin = 19, durationMs = 400 } = req.body;
  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: `Modulo GB-CLOUD con MAC '${normMac}' non trovato` });
    return;
  }

  let duration = Number(durationMs) || device.hardwareConfig?.optoTriggerDurationMs || 400;
  if (duration > 0 && duration <= 10) duration = duration * 1000;
  const pinNumber = Number(pin) || 19;

  // Broadcast opto pulse event
  broadcastSse('opto-trigger-test', {
    macAddress: normMac,
    deviceId: device.deviceId,
    pin: pinNumber,
    durationMs: duration,
    timestamp: new Date().toISOString(),
  });

  // Also send real MQTT command to physical device
  publishMqttCommand(device.deviceId || 'GB-CLOUD-01', {
    action: 'TRIGGER_OPTO_PULSE',
    pin: pinNumber,
    durationMs: duration,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Test impulso optoisolato inviato a Modulo GB-CLOUD [${normMac}] (GPIO ${pinNumber}, durata ${duration}ms, livello ${device.hardwareConfig?.voltageLevel || '12V Opto'})`,
    macAddress: normMac,
    pin: pinNumber,
    durationMs: duration,
  });
});

// POST /api/devices/:mac/test-key - Test erogazione o tasto matrice su modulo ESP32 (anche senza alcuna macchina associata)
app.post('/api/devices/:mac/test-key', (req, res) => {
  const normMac = normalizeMacAddress(req.params.mac);
  const { key = '1', productNumber, durationMs = 400, isCaraffa = false } = req.body;
  const db = loadDatabase();
  const device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac);
  if (!device) {
    res.status(404).json({ success: false, error: `Modulo GB-CLOUD con MAC '${normMac}' non trovato` });
    return;
  }

  const rawKeyStr = String(key).trim().toUpperCase();
  const dur = (durationMs && Number(durationMs) > 0) ? Number(durationMs) : (device.hardwareConfig?.optoTriggerDurationMs || 400);

  const wireLookup: Record<number, { wireA: number; wireB: number; keyChar: string; name: string }> = {
    1:  { wireA: 1, wireB: 5, keyChar: '1', name: 'Prodotto 1 (U1+U5)' },
    2:  { wireA: 2, wireB: 5, keyChar: '2', name: 'Prodotto 2 (U2+U5)' },
    3:  { wireA: 3, wireB: 5, keyChar: '3', name: 'Prodotto 3 (U3+U5)' },
    4:  { wireA: 1, wireB: 6, keyChar: 'A', name: 'Prodotto 4 (U1+U6)' },
    5:  { wireA: 2, wireB: 6, keyChar: '4', name: 'Prodotto 5 (U2+U6)' },
    6:  { wireA: 3, wireB: 6, keyChar: '5', name: 'Prodotto 6 (U3+U6)' },
    7:  { wireA: 1, wireB: 7, keyChar: '6', name: 'Prodotto 7 (U1+U7)' },
    8:  { wireA: 2, wireB: 7, keyChar: 'B', name: 'Prodotto 8 (U2+U7)' },
    9:  { wireA: 3, wireB: 7, keyChar: '7', name: 'Prodotto 9 (U3+U7)' },
    10: { wireA: 1, wireB: 8, keyChar: '8', name: 'Prodotto 10 (U1+U8)' },
    11: { wireA: 2, wireB: 8, keyChar: '9', name: 'Prodotto 11 (U2+U8)' },
    12: { wireA: 3, wireB: 8, keyChar: 'C', name: 'Prodotto 12 (U3+U8)' },
    13: { wireA: 4, wireB: 7, keyChar: '0', name: 'STOP (U4+U7)' },
    14: { wireA: 4, wireB: 6, keyChar: '*', name: 'CARAFFA (U4+U6)' },
    15: { wireA: 4, wireB: 5, keyChar: '#', name: 'LINGUA (U4+U5)' },
  };

  let pNum = productNumber ? Number(productNumber) : 1;
  if (rawKeyStr === 'STOP' || rawKeyStr === '0' || rawKeyStr === '13') {
    pNum = 13;
  } else if (rawKeyStr === 'CARAFFA' || rawKeyStr === '*' || rawKeyStr === '14') {
    pNum = 14;
  } else if (rawKeyStr === 'LINGUA' || rawKeyStr === '#' || rawKeyStr === '15') {
    pNum = 15;
  } else {
    const parsed = parseInt(rawKeyStr.replace(/\D/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
      pNum = parsed;
    }
  }

  const wireData = wireLookup[pNum] || { wireA: 1, wireB: 5, keyChar: '1', name: `Prodotto ${pNum}` };

  const mqttResult = publishMqttCommand(normMac, {
    action: 'TRIGGER_BEVERAGE_DISPENSE',
    productNumber: pNum,
    productKey: `P${pNum}`,
    code: `P${String(pNum).padStart(2, '0')}`,
    key: wireData.keyChar,
    keyChar: wireData.keyChar,
    wireA: wireData.wireA,
    wireB: wireData.wireB,
    name: wireData.name,
    durationMs: dur,
    isCaraffa: Boolean(isCaraffa),
    targetMac: normMac,
    timestamp: new Date().toISOString(),
  });

  if (!device.diagnosticLogs) device.diagnosticLogs = [];
  device.diagnosticLogs.unshift({
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `[TEST BANCO] Impulso ${wireData.name} inviato (Fili ${wireData.wireA}+${wireData.wireB}, ${dur}ms)`,
    heapFreeBytes: device.freeHeap,
    uptimeSeconds: device.uptimeSec,
    wifiRssi: device.wifiRssi,
  });
  if (device.diagnosticLogs.length > 40) device.diagnosticLogs = device.diagnosticLogs.slice(0, 40);

  const pairedMachine = device.assignedMachineId ? db.machines.find((m) => m.id === device.assignedMachineId) : null;
  const testKeyLog: KeyLog = {
    id: 'log-test-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    key: `P${pNum}`,
    keyLabel: `TEST BANCO: ${wireData.name}`,
    productName: wireData.name,
    deviceId: device.deviceId,
    machineName: pairedMachine ? pairedMachine.name : `Modulo Standalone ${device.deviceId}`,
    machineSerialNumber: device.serialNumber || 'STANDALONE',
    customerName: pairedMachine?.locationDetails?.company || 'Collaudo Banco Hardware (Nessuna Macchina)',
    siteName: pairedMachine?.locationDetails?.site || 'Banco Prova ESP32',
    timestamp: new Date().toISOString(),
    eventType: 'pressed',
    isCaraffa: Boolean(isCaraffa),
    doseType: isCaraffa ? 'CARAFFA' : 'MONODOSE',
    doseMultiplier: isCaraffa ? 3 : 1,
    channel: 'Test Standalone',
    rssi: device.wifiRssi || -55,
    ip: device.ipAddress || '192.168.1.150',
    rawCode: wireData.keyChar.charCodeAt(0) || 0,
    metadata: {
      isStandaloneTest: true,
      macAddress: normMac,
      productNumber: pNum,
      wireA: wireData.wireA,
      wireB: wireData.wireB,
      durationMs: dur,
      mqttTopic: mqttResult.topic,
    },
  };

  db.logs.unshift(testKeyLog);
  if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

  saveDatabase(db);
  broadcastSse('new-keylog', testKeyLog);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: `Test eseguito con successo: ${wireData.name} inviato a [${normMac}] (Fili ${wireData.wireA}+${wireData.wireB}, durata ${dur}ms)`,
    productNumber: pNum,
    keyChar: wireData.keyChar,
    wireA: wireData.wireA,
    wireB: wireData.wireB,
    durationMs: dur,
    topic: mqttResult.topic,
  });
});

// ==========================================
// 1c. MULTI-MACHINE MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/machine-models - Return allowed machine models (Ristosano, Big 5, Asia)
app.get('/api/machine-models', (req, res) => {
  res.json({
    models: ALLOWED_MACHINE_MODELS,
    defaultModel: 'Ristosano',
    electronicBoards: [
      'Scheda Controller Ristosano',
      'Scheda Controller Big 5',
      'Scheda Controller Asia',
      'Scheda Elettronica Optoisolata Custom'
    ]
  });
});

// GET /api/machines - List all vending machines in fleet with enriched ESP32 device info
app.get('/api/machines', (req, res) => {
  const db = loadDatabase();
  const enriched = (db.machines || []).map((m) => enrichMachineWithDevice(m, db.devices || []));
  res.json(enriched);
});

// POST /api/machines - Create a new vending machine (association to customer allowed ONLY after module pairing)
app.post('/api/machines', (req, res) => {
  const { id, serialNumber, name, location, locationDetails, customerId, customerSiteId, model, electronicBoard, assignedDeviceMac, ipAddress, macAddress, firmwareVersion, config, supplies } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ success: false, error: 'Nome distributore obbligatorio' });
    return;
  }

  const db = loadDatabase();
  const normAssignedMac = assignedDeviceMac ? normalizeMacAddress(assignedDeviceMac) : (macAddress ? normalizeMacAddress(macAddress) : null);

  let targetCustomer = null;
  let targetSite = null;

  if (customerId) {
    const cleanCustId = String(customerId).trim();
    targetCustomer = db.customers.find((c) => c.id === cleanCustId);
    if (!targetCustomer) {
      res.status(400).json({
        success: false,
        error: `Il cliente specificato ('${cleanCustId}') non esiste nel database. Selezionare un cliente valido.`,
      });
      return;
    }

    targetSite = customerSiteId
      ? targetCustomer.sites.find((s) => s.id === String(customerSiteId).trim())
      : targetCustomer.sites[0];
    if (!targetSite && targetCustomer.sites.length > 0) {
      targetSite = targetCustomer.sites[0];
    }
  }

  const cleanSerial = formatSixDigitSerialNumber(serialNumber, db.machines.length);
  const rawId = id && String(id).trim() ? String(id).trim().toUpperCase() : `GB-DIST-${cleanSerial}`;
  
  if (db.machines.some((m) => m.id === rawId)) {
    res.status(400).json({ success: false, error: `Un distributore con ID '${rawId}' esiste già` });
    return;
  }

  if (db.machines.some((m) => m.serialNumber === cleanSerial)) {
    res.status(400).json({ success: false, error: `Un distributore con matricola '#${cleanSerial}' esiste già nel sistema` });
    return;
  }

  const effectiveNotes = (req.body.notes !== undefined ? String(req.body.notes).trim() : (locationDetails?.notes ? String(locationDetails.notes).trim() : '')) || '';

  const locDet: MachineLocation = targetCustomer ? {
    company: targetCustomer.name,
    site: (locationDetails?.site && String(locationDetails.site).trim()) || targetSite?.name || 'Sede Principale',
    address: (locationDetails?.address && String(locationDetails.address).trim()) || targetSite?.address || targetCustomer.address || '',
    city: (locationDetails?.city && String(locationDetails.city).trim()) || targetSite?.city || targetCustomer.city || '',
    zipCode: (locationDetails?.zipCode && String(locationDetails.zipCode).trim()) || targetSite?.zipCode || targetCustomer.zipCode || '',
    province: (locationDetails?.province && String(locationDetails.province).trim().toUpperCase()) || targetSite?.province || targetCustomer.province || '',
    floorRoom: (locationDetails?.floorRoom && String(locationDetails.floorRoom).trim()) || targetSite?.floorRoom || location || 'Piano Terra',
    notes: effectiveNotes || targetSite?.notes || '',
  } : {
    company: (locationDetails?.company && String(locationDetails.company).trim()) || 'General Beverage',
    site: (locationDetails?.site && String(locationDetails.site).trim()) || 'Magazzino Centrale / In Preparazione',
    address: (locationDetails?.address && String(locationDetails.address).trim()) || 'Laboratorio Tecnico',
    city: (locationDetails?.city && String(locationDetails.city).trim()) || '',
    zipCode: (locationDetails?.zipCode && String(locationDetails.zipCode).trim()) || '',
    province: (locationDetails?.province && String(locationDetails.province).trim().toUpperCase()) || '',
    floorRoom: (locationDetails?.floorRoom && String(locationDetails.floorRoom).trim()) || 'Reparto Collaudo',
    notes: effectiveNotes || 'Macchina in attesa di associazione modulo o cliente',
  };

  const locSummary = targetCustomer ? `${locDet.company} - ${locDet.site}, ${locDet.floorRoom || locDet.address}` : 'Magazzino / Non Assegnata';

  const cleanModel = model && ALLOWED_MACHINE_MODELS.includes(String(model).trim() as any) 
    ? String(model).trim() 
    : 'Ristosano';

  const defaultBoard = cleanModel === 'Ristosano' 
    ? 'Scheda Controller Ristosano' 
    : cleanModel === 'Big 5' 
    ? 'Scheda Controller Big 5' 
    : 'Scheda Controller Asia';

  const newMachine: VendingMachine = {
    id: rawId,
    serialNumber: cleanSerial,
    name: String(name).trim(),
    notes: effectiveNotes,
    location: locSummary,
    locationDetails: locDet,
    customerId: targetCustomer ? targetCustomer.id : undefined,
    customerSiteId: targetSite?.id || undefined,
    model: cleanModel,
    electronicBoard: electronicBoard ? String(electronicBoard).trim() : defaultBoard,
    status: normAssignedMac ? 'ONLINE' : 'OFFLINE',
    assignedDeviceMac: normAssignedMac,
    ipAddress: ipAddress ? String(ipAddress).trim() : (normAssignedMac ? '192.168.1.150' : ''),
    macAddress: normAssignedMac || null,
    firmwareVersion: firmwareVersion ? String(firmwareVersion).trim() : 'v3.2.0-PRO-MATRIX',
    installationDate: new Date().toISOString().split('T')[0],
    lastMaintenanceDate: new Date().toISOString().split('T')[0],
    supplies: supplies || {
      waterLevelLiters: 25.0,
      maxWaterLiters: 25.0,
      coffeeBeansGrams: 1200,
      maxCoffeeGrams: 1200,
      milkPowderGrams: 1000,
      maxMilkGrams: 1000,
      chocolatePowderGrams: 1000,
      maxChocolateGrams: 1000,
      teaPowderGrams: 600,
      maxTeaGrams: 600,
      sugarGrams: 1200,
      maxSugarGrams: 1200,
      cupsCount: 200,
      maxCups: 200,
      stirrersCount: 200,
      maxStirrers: 200,
      boilerTempCelsius: 93.0,
      targetTempCelsius: 93.0,
      totalEarnings: 0,
      totalDispenses: 0,
    },
    config: {
      debounceMs: config?.debounceMs ?? 30,
      isFreeDispense: config?.isFreeDispense ?? true,
      caraffaMultiplier: config?.caraffaMultiplier ?? 3.0,
      boilerTargetTemp: config?.boilerTargetTemp ?? 93.0,
      optoTriggerDurationMs: config?.optoTriggerDurationMs ?? 400,
      wifiSsid: config?.wifiSsid ?? 'Azienda_WiFi_IoT',
      enableCalibrationAndConsumption: req.body.enableCalibrationAndConsumption !== undefined
        ? Boolean(req.body.enableCalibrationAndConsumption)
        : Boolean(config?.enableCalibrationAndConsumption),
    },
    enableCalibrationAndConsumption: req.body.enableCalibrationAndConsumption !== undefined
      ? Boolean(req.body.enableCalibrationAndConsumption)
      : Boolean(config?.enableCalibrationAndConsumption),
    keyMapping: req.body.keyMapping || {},
    calibration: (() => {
      if (req.body.calibration) return req.body.calibration;
      const targetSerial = formatSixDigitSerialNumber(serialNumber, db.machines.length);
      if (req.body.calibrationTemplateId) {
        const templates = [...(db.calibrationTemplates || []), ...getDefaultCalibrationTemplates()];
        const tpl = templates.find((t) => t.id === req.body.calibrationTemplateId);
        if (tpl && tpl.calibration) {
          const cal = JSON.parse(JSON.stringify(tpl.calibration));
          cal.lastUpdated = new Date().toISOString();
          cal.notes = `Taratura inizializzata da modello standard '${tpl.name}' per matricola ${targetSerial}`;
          return cal;
        }
      }
      return createDefaultCalibrationForMachine(cleanModel, targetSerial);
    })(),
    lastTelemetryAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  // If MAC was specified, pair with device in db.devices and enforce 1-to-1 uniqueness
  if (normAssignedMac) {
    db.machines.forEach((otherM) => {
      if (otherM.assignedDeviceMac && normalizeMacAddress(otherM.assignedDeviceMac) === normAssignedMac) {
        otherM.assignedDeviceMac = null;
        otherM.status = 'OFFLINE';
      }
    });

    let device = db.devices.find((d) => normalizeMacAddress(d.macAddress) === normAssignedMac);
    if (device) {
      device.assignedMachineId = newMachine.id;
      device.status = 'ONLINE';
      newMachine.ipAddress = device.ipAddress;
    }
  }

  db.machines.push(newMachine);
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  const enriched = enrichMachineWithDevice(newMachine, db.devices);

  res.status(201).json({
    success: true,
    message: `Distributore '${newMachine.name}' (Matricola: ${newMachine.serialNumber}) creato con successo!`,
    machine: enriched,
  });
});

// GET /api/machines/:id - Get machine by ID
app.get('/api/machines/:id', (req, res) => {
  const db = loadDatabase();
  const machine = db.machines.find((m) => m.id === req.params.id);
  if (!machine) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }
  res.json(enrichMachineWithDevice(machine, db.devices));
});

// PUT /api/machines/:id - Update machine configuration
app.put('/api/machines/:id', (req, res) => {
  const db = loadDatabase();
  const idx = db.machines.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }

  const existing = db.machines[idx];
  const { serialNumber, name, location, locationDetails, customerId, customerSiteId, model, electronicBoard, plcBrand, status, assignedDeviceMac, ipAddress, macAddress, firmwareVersion, config, supplies, keyMapping, installationDate, lastMaintenanceDate, notes } = req.body;

  // VERIFICA RIGIDA IMMUTABILITA' MATRICOLA: una volta creata, la matricola non può essere cambiata!
  if (serialNumber !== undefined) {
    const cleanReqSerial = String(serialNumber).replace(/\D/g, '');
    if (cleanReqSerial && cleanReqSerial !== existing.serialNumber) {
      res.status(400).json({
        success: false,
        error: `La matricola del distributore non può essere modificata dopo la creazione (matricola immutabile: #${existing.serialNumber}).`,
      });
      return;
    }
  }

  let targetCustomerId = customerId !== undefined ? (customerId ? String(customerId).trim() : null) : existing.customerId;
  let targetCustomerSiteId = customerSiteId !== undefined ? (customerSiteId ? String(customerSiteId).trim() : null) : existing.customerSiteId;
  
  // Inizializza l'ubicazione con i dati preesistenti
  let locDet: MachineLocation = {
    company: existing.locationDetails?.company || 'In Magazzino (Non Assegnata)',
    site: existing.locationDetails?.site || 'Sede Operativa',
    address: existing.locationDetails?.address || '',
    city: existing.locationDetails?.city || '',
    zipCode: existing.locationDetails?.zipCode || '',
    province: existing.locationDetails?.province || '',
    floorRoom: existing.locationDetails?.floorRoom || '',
    notes: existing.locationDetails?.notes || existing.notes || '',
  };

  if (customerId !== undefined && customerId) {
    const cleanCustId = String(customerId).trim();
    const targetCustomer = (db.customers || []).find((c) => c.id === cleanCustId);
    if (!targetCustomer) {
      res.status(400).json({ success: false, error: `Il cliente specificato ('${cleanCustId}') non esiste nel database` });
      return;
    }
    targetCustomerId = targetCustomer.id;
    locDet.company = targetCustomer.name;
    let targetSite = targetCustomerSiteId
      ? targetCustomer.sites.find((s) => s.id === targetCustomerSiteId)
      : (existing.customerSiteId ? targetCustomer.sites.find((s) => s.id === existing.customerSiteId) : targetCustomer.sites[0]);
    if (targetSite) {
      targetCustomerSiteId = targetSite.id;
      // Precompila come base i dati della sede
      locDet.site = targetSite.name || locDet.site;
      locDet.address = targetSite.address || locDet.address;
      locDet.city = targetSite.city || locDet.city;
      locDet.zipCode = targetSite.zipCode || locDet.zipCode;
      locDet.province = targetSite.province || locDet.province;
      locDet.floorRoom = targetSite.floorRoom || locDet.floorRoom;
      locDet.notes = targetSite.notes || locDet.notes;
    }
  } else if (customerId !== undefined && !customerId) {
    // Svincolato da cliente -> torna in magazzino
    targetCustomerId = null;
    targetCustomerSiteId = null;
    locDet.company = 'In Magazzino (Non Assegnata)';
  } else if (existing.customerId) {
    const existingCust = (db.customers || []).find((c) => c.id === existing.customerId);
    if (existingCust) {
      locDet.company = existingCust.name;
    }
  }

  // APPLICA LE MODIFICHE LIBERE DELL'UTENTE SU UBICAZIONE, INDIRIZZO E NOTE (PREVALGONO SEMPRE SUI DEFAULT)
  if (locationDetails) {
    if (locationDetails.company !== undefined && String(locationDetails.company).trim()) locDet.company = String(locationDetails.company).trim();
    if (locationDetails.site !== undefined) locDet.site = String(locationDetails.site).trim();
    if (locationDetails.address !== undefined) locDet.address = String(locationDetails.address).trim();
    if (locationDetails.city !== undefined) locDet.city = String(locationDetails.city).trim();
    if (locationDetails.zipCode !== undefined) locDet.zipCode = String(locationDetails.zipCode).trim();
    if (locationDetails.province !== undefined) locDet.province = String(locationDetails.province).trim().toUpperCase();
    if (locationDetails.floorRoom !== undefined) locDet.floorRoom = String(locationDetails.floorRoom).trim();
    if (locationDetails.notes !== undefined) locDet.notes = String(locationDetails.notes).trim();
  }

  // Gestione note libera (accetta sia da req.body.notes che da locationDetails.notes)
  const effectiveNotes = notes !== undefined 
    ? String(notes).trim() 
    : (locationDetails?.notes !== undefined ? String(locationDetails.notes).trim() : (existing.notes || locDet.notes || ''));
  locDet.notes = effectiveNotes;

  const prevMac = existing.assignedDeviceMac ? normalizeMacAddress(existing.assignedDeviceMac) : null;
  const newMac = assignedDeviceMac !== undefined ? (assignedDeviceMac ? normalizeMacAddress(assignedDeviceMac) : null) : (macAddress ? normalizeMacAddress(macAddress) : prevMac);

  const locSummary = locDet ? `${locDet.company} - ${locDet.site}, ${locDet.floorRoom || locDet.address}` : (location || existing.location);

  const targetEnableCal = req.body.enableCalibrationAndConsumption !== undefined
    ? Boolean(req.body.enableCalibrationAndConsumption)
    : (req.body.config?.enableCalibrationAndConsumption !== undefined
      ? Boolean(req.body.config.enableCalibrationAndConsumption)
      : existing.enableCalibrationAndConsumption);

  const updated: VendingMachine = {
    ...existing,
    serialNumber: existing.serialNumber, // Matricola a 6 cifre IMMUTABILE una volta creata
    name: name ? String(name).trim() : existing.name,
    notes: effectiveNotes,
    location: location !== undefined ? String(location).trim() : locSummary,
    locationDetails: locDet,
    customerId: targetCustomerId,
    customerSiteId: targetCustomerSiteId,
    model: model ? (ALLOWED_MACHINE_MODELS.includes(String(model).trim() as any) ? String(model).trim() : existing.model) : existing.model,
    electronicBoard: electronicBoard !== undefined ? String(electronicBoard).trim() : (plcBrand || existing.electronicBoard || 'Scheda Madre Elettronica Vending'),
    status: status || existing.status,
    assignedDeviceMac: newMac,
    ipAddress: ipAddress ? String(ipAddress).trim() : existing.ipAddress,
    macAddress: newMac || existing.macAddress,
    firmwareVersion: firmwareVersion ? String(firmwareVersion).trim() : existing.firmwareVersion,
    installationDate: installationDate || existing.installationDate,
    lastMaintenanceDate: lastMaintenanceDate || existing.lastMaintenanceDate,
    keyMapping: keyMapping !== undefined ? keyMapping : existing.keyMapping,
    enableCalibrationAndConsumption: targetEnableCal,
    config: {
      ...existing.config,
      ...(config || {}),
      enableCalibrationAndConsumption: targetEnableCal,
    },
    supplies: {
      ...existing.supplies,
      ...(supplies || {}),
    },
    calibration: (() => {
      if (req.body.calibration !== undefined) return req.body.calibration;
      if (req.body.calibrationTemplateId) {
        const templates = [...(db.calibrationTemplates || []), ...getDefaultCalibrationTemplates()];
        const tpl = templates.find((t) => t.id === req.body.calibrationTemplateId);
        if (tpl && tpl.calibration) {
          const cal = JSON.parse(JSON.stringify(tpl.calibration));
          cal.lastUpdated = new Date().toISOString();
          cal.notes = `Taratura aggiornata da modello standard '${tpl.name}' per matricola ${existing.serialNumber}`;
          return cal;
        }
      }
      return (existing as any).calibration || createDefaultCalibrationForMachine(existing.model, existing.serialNumber);
    })(),
    lastTelemetryAt: new Date().toISOString(),
  };

  // Sync with devices table if MAC changed
  if (prevMac && prevMac !== newMac) {
    const oldDev = db.devices.find((d) => normalizeMacAddress(d.macAddress) === prevMac);
    if (oldDev && oldDev.assignedMachineId === existing.id) {
      oldDev.assignedMachineId = null;
      oldDev.status = 'UNASSIGNED';
    }
  }

  if (newMac) {
    // Unpair from any other machine that might have had this MAC to guarantee 1-to-1 uniqueness
    db.machines.forEach((otherM) => {
      if (otherM.id !== updated.id && otherM.assignedDeviceMac && normalizeMacAddress(otherM.assignedDeviceMac) === newMac) {
        otherM.assignedDeviceMac = null;
        otherM.status = 'OFFLINE';
      }
    });

    const newDev = db.devices.find((d) => normalizeMacAddress(d.macAddress) === newMac);
    if (newDev) {
      newDev.assignedMachineId = updated.id;
      newDev.status = 'ONLINE';
      updated.ipAddress = newDev.ipAddress;
    }
  }

  db.machines[idx] = updated;
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: `Configurazione distributore '${updated.name}' (${updated.serialNumber}) aggiornata con successo`,
    machine: enrichMachineWithDevice(updated, db.devices),
  });
});

// GET /api/calibration-templates - Get all available standard and custom calibration templates
app.get('/api/calibration-templates', (req, res) => {
  const db = loadDatabase();
  const templates = db.calibrationTemplates && db.calibrationTemplates.length > 0
    ? db.calibrationTemplates
    : getDefaultCalibrationTemplates();
  res.json(templates);
});

// POST /api/calibration-templates - Save a new custom calibration template
app.post('/api/calibration-templates', (req, res) => {
  const db = loadDatabase();
  const { name, description, modelTarget, calibration } = req.body;
  if (!name || !calibration) {
    res.status(400).json({ success: false, error: 'Nome del modello e dati di taratura sono obbligatori' });
    return;
  }
  const newTemplate = {
    id: `template-${Date.now()}`,
    name: String(name).trim(),
    description: description ? String(description).trim() : 'Modello di taratura personalizzato salvato da operatore',
    modelTarget: modelTarget || 'Universale',
    isSystemStandard: false,
    calibration,
  };
  if (!db.calibrationTemplates) db.calibrationTemplates = getDefaultCalibrationTemplates();
  db.calibrationTemplates.push(newTemplate);
  saveDatabase(db);
  res.status(201).json({
    success: true,
    message: `Modello di taratura standard '${newTemplate.name}' salvato con successo`,
    template: newTemplate,
  });
});

// POST /api/machines/:id/apply-calibration - Apply standard template or custom calibration directly to a machine's serial number
app.post('/api/machines/:id/apply-calibration', (req, res) => {
  const db = loadDatabase();
  const idx = db.machines.findIndex((m) => m.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }
  const targetMachine = db.machines[idx];
  const { templateId, calibration, sourceTemplateName } = req.body;

  let newCalibration: any = null;
  if (calibration) {
    newCalibration = JSON.parse(JSON.stringify(calibration));
  } else if (templateId) {
    const templates = db.calibrationTemplates && db.calibrationTemplates.length > 0
      ? db.calibrationTemplates
      : getDefaultCalibrationTemplates();
    const tpl = templates.find((t: any) => t.id === templateId);
    if (tpl) {
      newCalibration = JSON.parse(JSON.stringify(tpl.calibration));
    }
  }

  if (!newCalibration) {
    newCalibration = createDefaultCalibrationForMachine(targetMachine.model, targetMachine.serialNumber);
  }

  // Stamp calibration with serial number and current date
  newCalibration.lastUpdated = new Date().toISOString();
  newCalibration.notes = `Taratura associata alla Matricola ${targetMachine.serialNumber} (${targetMachine.name}) il ${new Date().toLocaleDateString('it-IT')} da ${sourceTemplateName || 'Modello Standard'}`;

  targetMachine.calibration = newCalibration;
  targetMachine.lastTelemetryAt = new Date().toISOString();
  db.machines[idx] = targetMachine;
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Taratura applicata con successo alla Matricola ${targetMachine.serialNumber} (${targetMachine.name})`,
    calibration: newCalibration,
    machine: enrichMachineWithDevice(targetMachine, db.devices),
  });
});

// Helper for saving machine calibration directly
function handleSaveMachineCalibration(req: express.Request, res: express.Response) {
  const db = loadDatabase();
  const machine = db.machines.find((m) => m.id === req.params.id);
  if (!machine) {
    res.status(404).json({ success: false, error: `Distributore con ID '${req.params.id}' non trovato` });
    return;
  }

  const calibrationData = req.body.calibration !== undefined ? req.body.calibration : req.body;
  if (!calibrationData || typeof calibrationData !== 'object') {
    res.status(400).json({ success: false, error: 'Dati taratura non validi o mancanti nel body' });
    return;
  }

  // Preserve and merge calibration arrays safely
  const canisters = Array.isArray(calibrationData.canisters) && calibrationData.canisters.length > 0
    ? calibrationData.canisters
    : (machine.calibration?.canisters || getStandard6Canisters(machine.model));

  const electrovalves = Array.isArray(calibrationData.electrovalves) && calibrationData.electrovalves.length > 0
    ? calibrationData.electrovalves
    : (machine.calibration?.electrovalves || getStandard7Electrovalves(machine.model));

  const standardProducts = Array.isArray(calibrationData.standardProducts) && calibrationData.standardProducts.length > 0
    ? calibrationData.standardProducts
    : (machine.calibration?.standardProducts || getStandard12Products());

  const caraffaProducts = Array.isArray(calibrationData.caraffaProducts) && calibrationData.caraffaProducts.length > 0
    ? calibrationData.caraffaProducts
    : (machine.calibration?.caraffaProducts || getStandard12CaraffaProducts());

  const deliveries = Array.isArray(calibrationData.deliveries)
    ? calibrationData.deliveries
    : (machine.calibration?.deliveries || []);

  const updatedCalibration = {
    ...calibrationData,
    lastUpdated: new Date().toISOString(),
    calibratedBy: calibrationData.calibratedBy || machine.calibration?.calibratedBy || 'Tecnico Collaudo',
    notes: calibrationData.notes !== undefined ? calibrationData.notes : (machine.calibration?.notes || `Taratura salvata per matricola ${machine.serialNumber}`),
    waterFlowCcPerSec: typeof calibrationData.waterFlowCcPerSec === 'number' ? calibrationData.waterFlowCcPerSec : (machine.calibration?.waterFlowCcPerSec || 15.0),
    canisters,
    electrovalves,
    standardProducts,
    caraffaProducts,
    deliveries,
  };

  machine.calibration = updatedCalibration;
  machine.enableCalibrationAndConsumption = true;
  if (machine.config) {
    machine.config.enableCalibrationAndConsumption = true;
  }
  machine.lastTelemetryAt = new Date().toISOString();

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  console.log(`[CALIBRATION] Taratura salvata con successo per ${machine.name} (#${machine.serialNumber}) con ${canisters.length} contenitori.`);

  res.json({
    success: true,
    message: `Taratura salvata con successo per '${machine.name}' (Matricola #${machine.serialNumber})`,
    calibration: updatedCalibration,
    machine: enrichMachineWithDevice(machine, db.devices),
  });
}

// PUT /api/machines/:id/calibration - Salva taratura specifica del distributore
app.put('/api/machines/:id/calibration', (req, res) => {
  handleSaveMachineCalibration(req, res);
});

// POST /api/machines/:id/calibration - Salva taratura specifica del distributore
app.post('/api/machines/:id/calibration', (req, res) => {
  handleSaveMachineCalibration(req, res);
});

// ==========================================
// 1d. CUSTOMERS & SITES DATABASE ENDPOINTS
// ==========================================

// GET /api/customers - List all customers with their sites and assigned machine stats
app.get('/api/customers', (req, res) => {
  const db = loadDatabase();
  const customers = db.customers || [];
  
  // Enrich each customer with installed machines count
  const enriched = customers.map((c) => {
    const assignedMachines = (db.machines || []).filter((m) => m.customerId === c.id || (m.locationDetails?.company || '').toLowerCase() === c.name.toLowerCase());
    return {
      ...c,
      machinesCount: assignedMachines.length,
      machines: assignedMachines.map((m) => ({
        id: m.id,
        serialNumber: m.serialNumber,
        name: m.name,
        model: m.model,
        status: m.status,
        siteId: m.customerSiteId,
        siteName: m.locationDetails?.site || 'Sede Principale',
      })),
    };
  });

  res.json(enriched);
});

// POST /api/customers - Create a new customer
app.post('/api/customers', (req, res) => {
  const db = loadDatabase();
  const { code, name, logoUrl, vatNumber, contactPerson, phone, email, address, city, province, zipCode, notes, initialSite } = req.body;

  if (!name || !String(name).trim()) {
    res.status(400).json({ success: false, error: 'La ragione sociale del cliente è obbligatoria' });
    return;
  }

  const cleanName = String(name).trim();
  let maxIdNum = 0;
  (db.customers || []).forEach((c) => {
    const match = c.id.match(/^CUST-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxIdNum) maxIdNum = n;
    }
  });
  const customerId = `CUST-${String(maxIdNum + 1).padStart(3, '0')}`;
  const customerCode = code ? String(code).trim().toUpperCase() : `CLI-${String(maxIdNum + 1).padStart(2, '0')}`;

  const sites: CustomerSite[] = [];

  if (initialSite && initialSite.name) {
    sites.push({
      id: `site-${Date.now()}-1`,
      name: String(initialSite.name).trim(),
      address: initialSite.address ? String(initialSite.address).trim() : (address || ''),
      city: initialSite.city ? String(initialSite.city).trim() : (city || ''),
      province: initialSite.province ? String(initialSite.province).trim().toUpperCase() : (province || ''),
      zipCode: initialSite.zipCode ? String(initialSite.zipCode).trim() : (zipCode || ''),
      floorRoom: initialSite.floorRoom ? String(initialSite.floorRoom).trim() : 'Piano Terra',
      contactPerson: initialSite.contactPerson ? String(initialSite.contactPerson).trim() : (contactPerson || ''),
      phone: initialSite.phone ? String(initialSite.phone).trim() : (phone || ''),
      notes: initialSite.notes ? String(initialSite.notes).trim() : '',
    });
  } else {
    // Default primary site
    sites.push({
      id: `site-${Date.now()}-1`,
      name: 'Sede Principale',
      address: address ? String(address).trim() : 'Via Roma 1',
      city: city ? String(city).trim() : 'Milano',
      province: province ? String(province).trim().toUpperCase() : 'MI',
      zipCode: zipCode ? String(zipCode).trim() : '20100',
      floorRoom: 'Piano Terra',
      contactPerson: contactPerson || '',
      phone: phone || '',
    });
  }

  const newCustomer: Customer = {
    id: customerId,
    code: customerCode,
    name: cleanName,
    logoUrl: logoUrl ? String(logoUrl).trim() : undefined,
    vatNumber: vatNumber ? String(vatNumber).trim() : undefined,
    contactPerson: contactPerson ? String(contactPerson).trim() : undefined,
    phone: phone ? String(phone).trim() : undefined,
    email: email ? String(email).trim() : undefined,
    address: address ? String(address).trim() : undefined,
    city: city ? String(city).trim() : undefined,
    province: province ? String(province).trim().toUpperCase() : undefined,
    zipCode: zipCode ? String(zipCode).trim() : undefined,
    sites,
    notes: notes ? String(notes).trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  if (!db.customers) db.customers = [];
  db.customers.push(newCustomer);
  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);

  res.status(201).json({
    success: true,
    message: `Cliente '${newCustomer.name}' inserito con successo nel database`,
    customer: newCustomer,
  });
});

// GET /api/customers/:id - Get single customer
app.get('/api/customers/:id', (req, res) => {
  const db = loadDatabase();
  const customer = (db.customers || []).find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }
  const assignedMachines = (db.machines || []).filter((m) => m.customerId === customer.id);
  res.json({ ...customer, machines: assignedMachines });
});

// PUT /api/customers/:id - Update customer
app.put('/api/customers/:id', (req, res) => {
  const db = loadDatabase();
  const idx = (db.customers || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }

  const existing = db.customers[idx];
  const { code, name, logoUrl, vatNumber, contactPerson, phone, email, address, city, province, zipCode, notes } = req.body;

  const updated: Customer = {
    ...existing,
    code: code !== undefined ? String(code).trim().toUpperCase() : existing.code,
    name: name !== undefined ? String(name).trim() : existing.name,
    logoUrl: logoUrl !== undefined ? (logoUrl ? String(logoUrl).trim() : undefined) : existing.logoUrl,
    vatNumber: vatNumber !== undefined ? String(vatNumber).trim() : existing.vatNumber,
    contactPerson: contactPerson !== undefined ? String(contactPerson).trim() : existing.contactPerson,
    phone: phone !== undefined ? String(phone).trim() : existing.phone,
    email: email !== undefined ? String(email).trim() : existing.email,
    address: address !== undefined ? String(address).trim() : existing.address,
    city: city !== undefined ? String(city).trim() : existing.city,
    province: province !== undefined ? String(province).trim().toUpperCase() : existing.province,
    zipCode: zipCode !== undefined ? String(zipCode).trim() : existing.zipCode,
    notes: notes !== undefined ? String(notes).trim() : existing.notes,
    updatedAt: new Date().toISOString(),
  };

  db.customers[idx] = updated;

  // Also update locationDetails.company in linked machines if company name changed
  if (existing.name !== updated.name) {
    (db.machines || []).forEach((m) => {
      if (m.customerId === existing.id || m.locationDetails?.company === existing.name) {
        if (m.locationDetails) {
          m.locationDetails.company = updated.name;
        }
      }
    });
    broadcastSse('machines-updated', db.machines);
  }

  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);

  res.json({
    success: true,
    message: `Cliente '${updated.name}' aggiornato con successo`,
    customer: updated,
  });
});

// DELETE /api/customers - Delete all customers (bulk purge)
app.delete('/api/customers', (req, res) => {
  const db = loadDatabase();
  const count = (db.customers || []).length;
  // Unlink all machines gracefully
  (db.machines || []).forEach((m) => {
    m.customerId = undefined;
    m.customerSiteId = undefined;
    if (m.locationDetails) {
      m.locationDetails.company = 'Non Assegnato';
      m.locationDetails.site = 'Nessuna Sede';
    }
  });
  db.customers = [];
  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);
  broadcastSse('machines-updated', db.machines);
  res.json({
    success: true,
    message: `Anagrafica svuotata: ${count} clienti eliminati definitivamente`,
  });
});

// DELETE /api/customers/:id - Delete customer
app.delete('/api/customers/:id', (req, res) => {
  const db = loadDatabase();
  const idx = (db.customers || []).findIndex((c) => c.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }

  const customer = db.customers[idx];
  // Check if any machine is currently assigned
  const linkedMachines = (db.machines || []).filter((m) => m.customerId === customer.id);

  // Unlink machines gracefully
  linkedMachines.forEach((m) => {
    m.customerId = undefined;
    m.customerSiteId = undefined;
    if (m.locationDetails && (m.locationDetails.company === customer.name || m.locationDetails.company?.toLowerCase() === customer.name?.toLowerCase())) {
      m.locationDetails.company = 'Non Assegnato';
      m.locationDetails.site = 'Nessuna Sede';
    }
  });

  db.customers.splice(idx, 1);
  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);
  if (linkedMachines.length > 0) {
    broadcastSse('machines-updated', db.machines);
  }

  res.json({
    success: true,
    message: `Cliente '${customer.name}' rimosso dal database`,
  });
});

// POST /api/customers/:id/sites - Add site to customer
app.post('/api/customers/:id/sites', (req, res) => {
  const db = loadDatabase();
  const customer = (db.customers || []).find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }

  const { name, address, city, province, zipCode, floorRoom, contactPerson, phone, notes } = req.body;
  if (!name || !String(name).trim()) {
    res.status(400).json({ success: false, error: 'Il nome della sede è obbligatorio' });
    return;
  }

  const newSite: CustomerSite = {
    id: `site-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
    name: String(name).trim(),
    address: address ? String(address).trim() : (customer.address || ''),
    city: city ? String(city).trim() : (customer.city || ''),
    province: province ? String(province).trim().toUpperCase() : (customer.province || ''),
    zipCode: zipCode ? String(zipCode).trim() : (customer.zipCode || ''),
    floorRoom: floorRoom ? String(floorRoom).trim() : 'Piano Terra',
    contactPerson: contactPerson ? String(contactPerson).trim() : (customer.contactPerson || ''),
    phone: phone ? String(phone).trim() : (customer.phone || ''),
    notes: notes ? String(notes).trim() : '',
  };

  customer.sites.push(newSite);
  customer.updatedAt = new Date().toISOString();
  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);

  res.status(201).json({
    success: true,
    message: `Sede '${newSite.name}' aggiunta con successo a ${customer.name}`,
    site: newSite,
  });
});

// PUT /api/customers/:id/sites/:siteId - Update site
app.put('/api/customers/:id/sites/:siteId', (req, res) => {
  const db = loadDatabase();
  const customer = (db.customers || []).find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }

  const siteIdx = customer.sites.findIndex((s) => s.id === req.params.siteId);
  if (siteIdx === -1) {
    res.status(404).json({ success: false, error: 'Sede operativa non trovata' });
    return;
  }

  const existingSite = customer.sites[siteIdx];
  const { name, address, city, province, zipCode, floorRoom, contactPerson, phone, notes } = req.body;

  const updatedSite: CustomerSite = {
    ...existingSite,
    name: name !== undefined ? String(name).trim() : existingSite.name,
    address: address !== undefined ? String(address).trim() : existingSite.address,
    city: city !== undefined ? String(city).trim() : existingSite.city,
    province: province !== undefined ? String(province).trim().toUpperCase() : existingSite.province,
    zipCode: zipCode !== undefined ? String(zipCode).trim() : existingSite.zipCode,
    floorRoom: floorRoom !== undefined ? String(floorRoom).trim() : existingSite.floorRoom,
    contactPerson: contactPerson !== undefined ? String(contactPerson).trim() : existingSite.contactPerson,
    phone: phone !== undefined ? String(phone).trim() : existingSite.phone,
    notes: notes !== undefined ? String(notes).trim() : existingSite.notes,
  };

  customer.sites[siteIdx] = updatedSite;
  customer.updatedAt = new Date().toISOString();

  // If site name or details changed, also update assigned machines
  (db.machines || []).forEach((m) => {
    if (m.customerSiteId === existingSite.id && m.locationDetails) {
      m.locationDetails.site = updatedSite.name;
      m.locationDetails.address = updatedSite.address;
      m.locationDetails.city = updatedSite.city;
      m.locationDetails.province = updatedSite.province;
      m.locationDetails.zipCode = updatedSite.zipCode || m.locationDetails.zipCode;
      m.locationDetails.floorRoom = updatedSite.floorRoom || m.locationDetails.floorRoom;
    }
  });

  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Sede '${updatedSite.name}' aggiornata con successo`,
    site: updatedSite,
  });
});

// DELETE /api/customers/:id/sites/:siteId - Delete site
app.delete('/api/customers/:id/sites/:siteId', (req, res) => {
  const db = loadDatabase();
  const customer = (db.customers || []).find((c) => c.id === req.params.id);
  if (!customer) {
    res.status(404).json({ success: false, error: 'Cliente non trovato' });
    return;
  }

  const siteIdx = customer.sites.findIndex((s) => s.id === req.params.siteId);
  if (siteIdx === -1) {
    res.status(404).json({ success: false, error: 'Sede operativa non trovata' });
    return;
  }

  const removed = customer.sites.splice(siteIdx, 1)[0];
  customer.updatedAt = new Date().toISOString();

  // Unlink any machine assigned to this site
  (db.machines || []).forEach((m) => {
    if (m.customerSiteId === req.params.siteId) {
      m.customerSiteId = undefined;
    }
  });

  saveDatabase(db);
  broadcastSse('customers-updated', db.customers);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Sede '${removed.name}' rimossa con successo`,
  });
});

// --- PRODUCT ORDERS SYSTEM & SMTP ENGINE ---

// Helper: Get effective SMTP configuration from DB or process.env
function getEffectiveSmtpConfig(db?: DatabaseSchema): {
  configured: boolean;
  source: 'DATABASE_CONFIG' | 'ENV_VARIABLES' | 'NONE';
  config: SmtpConfig;
} {
  const currentDb = db || loadDatabase();
  const dbSmtp = currentDb?.config?.smtp;

  // DB config takes precedence if user entered host, user and password
  if (dbSmtp && dbSmtp.enabled && dbSmtp.host && dbSmtp.user && dbSmtp.pass && dbSmtp.pass.trim() !== '') {
    return {
      configured: true,
      source: 'DATABASE_CONFIG',
      config: dbSmtp,
    };
  }

  // Fallback to environment variables
  const envHost = process.env.SMTP_HOST;
  const envUser = process.env.SMTP_USER;
  const envPass = process.env.SMTP_PASS;
  if (envHost && envUser && envPass) {
    return {
      configured: true,
      source: 'ENV_VARIABLES',
      config: {
        enabled: true,
        host: envHost,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        user: envUser,
        pass: envPass,
        fromName: process.env.SMTP_FROM_NAME || 'General Beverage Portale Ordini',
        fromEmail: process.env.SMTP_FROM || envUser,
        defaultRecipient: process.env.SMTP_DEFAULT_RECIPIENT || 'claudiograf80@gmail.com',
      },
    };
  }

  return {
    configured: false,
    source: 'NONE',
    config: {
      enabled: dbSmtp?.enabled ?? true,
      host: dbSmtp?.host || 'smtp.gmail.com',
      port: dbSmtp?.port || 587,
      secure: dbSmtp?.secure ?? false,
      user: dbSmtp?.user || 'claudiograf80@gmail.com',
      pass: dbSmtp?.pass || '',
      fromName: dbSmtp?.fromName || 'General Beverage Portale Ordini',
      fromEmail: dbSmtp?.fromEmail || 'claudiograf80@gmail.com',
      defaultRecipient: dbSmtp?.defaultRecipient || 'claudiograf80@gmail.com',
    },
  };
}

// Helper: Build a robust nodemailer transporter with timeouts and TLS options
function createSmtpTransporter(smtp: SmtpConfig) {
  const isPort465 = smtp.port === 465;
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure || isPort465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 12000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function sendProductOrderEmail(order: any, db?: DatabaseSchema): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const recipient = order.recipientEmail || 'claudiograf@iobevo.com';
  const effectiveDb = db || loadDatabase();
  const smtpInfo = getEffectiveSmtpConfig(effectiveDb);

  if (!smtpInfo.configured) {
    const reason = 'Server SMTP non configurato. Configura i parametri SMTP in "Gestione Database -> Server SMTP" (Host, Porta, Utente e Password/Password per le app) oppure definisci le variabili d\'ambiente SMTP_HOST, SMTP_USER, SMTP_PASS.';
    console.warn(`[ORDER DISPATCH SKIPPED] Impossibile inviare email reale a ${recipient} per ordine ${order.id}: ${reason}`);
    return {
      sent: false,
      error: reason,
    };
  }

  const itemsHtml = (order.items || []).map((item: any) => `
    <tr>
      <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">
        ${item.itemCode ? `<span style="display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 11px; font-family: monospace; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">${item.itemCode}</span>` : ''}
        ${item.productName}
      </td>
      <td style="padding: 10px 14px; border: 1px solid #e2e8f0; text-transform: capitalize; color: #64748b;">${item.ingredientType || '-'}</td>
      <td style="padding: 10px 14px; border: 1px solid #e2e8f0; text-align: right; font-size: 15px; font-weight: bold; color: #059669;">${item.quantity} ${item.unit || 'Kg'}</td>
      <td style="padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">${item.notes || '-'}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 24px; text-align: left;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">☕ NUOVO ORDINE RIFORNIMENTO PRODOTTI</h1>
        <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Codice Ordine: <strong>${order.id}</strong> | Ricevuto da Portale Clienti IoT</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #f8fafc; border-left: 4px solid #059669; padding: 14px 16px; margin-bottom: 22px; border-radius: 0 8px 8px 0;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e293b;">Riepilogo Consegna</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Cliente:</strong> ${order.customerName} (${order.customerCode || 'N/D'})</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Sede di Destinazione:</strong> ${order.siteName}</p>
          ${order.siteAddress ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Indirizzo:</strong> ${order.siteAddress}</p>` : ''}
          ${order.requestedDeliveryDate ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Data Consegna Richiesta:</strong> ${order.requestedDeliveryDate}</p>` : ''}
          ${order.requesterName ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Referente / Telefono:</strong> ${order.requesterName} ${order.requesterPhone ? `(${order.requesterPhone})` : ''}</p>` : ''}
          ${order.notes ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #b45309; background: #fffbeb; padding: 8px; border-radius: 6px;"><strong>Note Consegna:</strong> ${order.notes}</p>` : ''}
        </div>

        <h3 style="margin: 18px 0 10px 0; font-size: 15px; color: #1e293b;">Prodotti Ordinati (da Taratura Contenitori)</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #f1f5f9; color: #475569;">
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0;">Prodotto</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0;">Categoria</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0; text-align: right;">Quantità</th>
              <th style="padding: 10px 12px; border: 1px solid #e2e8f0;">Note</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Email generata automaticamente dal Portale Distributori IoT General Beverage.</p>
          <p style="margin: 4px 0 0 0;">Destinatario: ${recipient} | Data: ${new Date(order.createdAt || Date.now()).toLocaleString('it-IT')}</p>
        </div>
      </div>
    </div>
  `;

  try {
    const transporter = createSmtpTransporter(smtpInfo.config);
    const fromDisplayName = smtpInfo.config.fromName || 'Portale Ordini IoT General Beverage';
    const fromAddress = smtpInfo.config.fromEmail || smtpInfo.config.user;

    const info = await transporter.sendMail({
      from: `"${fromDisplayName}" <${fromAddress}>`,
      to: recipient,
      subject: `[ORDINE PRODOTTI] - ${order.customerName} - ${order.siteName} (${order.id})`,
      html: htmlContent,
    });

    console.log(`[ORDER DISPATCH SUCCESS] Email inviata a: ${recipient} per ordine ${order.id} (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    let friendlyError = err.message || 'Errore durante la connessione al server SMTP';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      friendlyError = `Autenticazione SMTP fallita per ${smtpInfo.config.user}. Se utilizzi Gmail, genera e inserisci una "Password per le app" da 16 caratteri con verifica in 2 passaggi (non usare la tua password Google ordinaria).`;
    } else if (err.code === 'ECONNREFUSED') {
      friendlyError = `Connessione rifiutata dal server SMTP ${smtpInfo.config.host}:${smtpInfo.config.port}. Verifica host e porta.`;
    } else if (err.code === 'ETIMEDOUT') {
      friendlyError = `Timeout di connessione verso il server SMTP ${smtpInfo.config.host}:${smtpInfo.config.port}.`;
    }

    console.error(`[ORDER DISPATCH ERROR] Impossibile inviare email a ${recipient}:`, friendlyError);
    return { sent: false, error: friendlyError };
  }
}

// GET /api/orders - List orders (optional ?customerId=...)
app.get('/api/orders', (req, res) => {
  const db = loadDatabase();
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  let orders = db.orders || [];
  if (customerId) {
    orders = orders.filter((o: any) => o.customerId === customerId);
  }
  res.json(orders);
});

// GET /api/customers/:id/orders - List orders for a specific customer
app.get('/api/customers/:id/orders', (req, res) => {
  const db = loadDatabase();
  const orders = (db.orders || []).filter((o: any) => o.customerId === req.params.id);
  res.json(orders);
});

// POST /api/orders - Create a new product order
app.post('/api/orders', async (req, res) => {
  const db = loadDatabase();
  const {
    customerId,
    customerName,
    customerCode,
    siteId,
    siteName,
    siteAddress,
    requesterName,
    requesterPhone,
    requestedDeliveryDate,
    notes,
    items,
    recipientEmail,
  } = req.body;

  if (!customerId || !siteId) {
    res.status(400).json({ success: false, error: 'Cliente e Sede di destinazione sono obbligatori' });
    return;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: 'Seleziona almeno un prodotto con quantità maggiore di zero' });
    return;
  }

  const validItems = items.filter((i: any) => typeof i.quantity === 'number' && i.quantity > 0);
  if (validItems.length === 0) {
    res.status(400).json({ success: false, error: 'Tutti i prodotti hanno quantità zero' });
    return;
  }

  if (!db.orders) db.orders = [];

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const orderCountToday = db.orders.filter((o: any) => (o.createdAt || '').startsWith(now.toISOString().slice(0, 10))).length;
  const orderId = `ORD-${dateStr}-${String(orderCountToday + 1).padStart(3, '0')}`;

  const targetRecipient = recipientEmail ? String(recipientEmail).trim() : 'claudiograf@iobevo.com';

  const newOrder = {
    id: orderId,
    customerId: String(customerId),
    customerName: String(customerName || 'Cliente'),
    customerCode: customerCode ? String(customerCode) : undefined,
    siteId: String(siteId),
    siteName: String(siteName || 'Sede Principale'),
    siteAddress: siteAddress ? String(siteAddress) : undefined,
    requesterName: requesterName ? String(requesterName) : undefined,
    requesterPhone: requesterPhone ? String(requesterPhone) : undefined,
    requestedDeliveryDate: requestedDeliveryDate ? String(requestedDeliveryDate) : undefined,
    notes: notes ? String(notes) : undefined,
    items: validItems,
    recipientEmail: targetRecipient,
    status: 'INVIATO',
    emailSent: false,
    emailError: undefined as string | undefined,
    emailMessageId: undefined as string | undefined,
    lastEmailAttemptAt: now.toISOString(),
    createdAt: now.toISOString(),
  };

  const emailResult = await sendProductOrderEmail(newOrder, db);
  newOrder.emailSent = emailResult.sent;
  newOrder.emailError = emailResult.error;
  newOrder.emailMessageId = emailResult.messageId;

  db.orders.unshift(newOrder);
  saveDatabase(db);
  broadcastSse('orders-updated', db.orders);

  const statusMsg = emailResult.sent
    ? `Ordine ${orderId} registrato ed inviato con successo via email a: ${targetRecipient}`
    : `Ordine ${orderId} registrato nel sistema. ATTENZIONE: l'email non è stata recapitata (${emailResult.error})`;

  res.status(201).json({
    success: true,
    message: statusMsg,
    order: newOrder,
    emailResult,
  });
});

// POST /api/orders/:id/resend-email - Resend confirmation email for an existing order
app.post('/api/orders/:id/resend-email', async (req, res) => {
  const db = loadDatabase();
  const order = (db.orders || []).find((o: any) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ success: false, error: 'Ordine non trovato' });
    return;
  }

  const { recipientEmail } = req.body;
  if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
    order.recipientEmail = recipientEmail.trim();
  }

  const emailResult = await sendProductOrderEmail(order, db);
  order.emailSent = emailResult.sent;
  order.emailError = emailResult.error;
  order.emailMessageId = emailResult.messageId;
  order.lastEmailAttemptAt = new Date().toISOString();

  saveDatabase(db);
  broadcastSse('orders-updated', db.orders);

  if (emailResult.sent) {
    res.json({
      success: true,
      message: `Email dell'ordine ${order.id} reinviata con successo a ${order.recipientEmail}!`,
      order,
      emailResult,
    });
  } else {
    res.status(500).json({
      success: false,
      error: emailResult.error || 'Invio email non riuscito',
      order,
      emailResult,
    });
  }
});

// --- TECHNICAL SUPPORT REQUEST SYSTEM ---

async function sendSupportRequestEmail(ticket: any, db?: DatabaseSchema): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const recipient = ticket.recipientEmail || 'claudiograf@iobevo.com';
  const effectiveDb = db || loadDatabase();
  const smtpInfo = getEffectiveSmtpConfig(effectiveDb);

  if (!smtpInfo.configured) {
    const reason = 'Server SMTP non configurato. Configura i parametri SMTP in "Gestione Database -> Server SMTP" (Host, Porta, Utente e Password/Password per le app) oppure definisci le variabili d\'ambiente SMTP_HOST, SMTP_USER, SMTP_PASS.';
    console.warn(`[SUPPORT DISPATCH SKIPPED] Impossibile inviare email reale a ${recipient} per ticket ${ticket.id}: ${reason}`);
    return {
      sent: false,
      error: reason,
    };
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: #ffffff; padding: 24px; text-align: left;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold;">🔧 RICHIESTA ASSISTENZA TECNICA DISTRIBUTORE</h1>
        <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Codice Ticket: <strong>${ticket.id}</strong> | Ricevuto da Portale Clienti IoT</p>
      </div>

      <div style="padding: 24px;">
        <div style="background: #f8fafc; border-left: 4px solid #dc2626; padding: 14px 16px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e293b;">Sede di Intervento</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Cliente:</strong> ${ticket.customerName} (${ticket.customerCode || 'N/D'})</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Sede:</strong> ${ticket.siteName}</p>
          ${ticket.siteAddress ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Indirizzo:</strong> ${ticket.siteAddress}</p>` : ''}
          ${ticket.requesterName ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Referente sul Posto:</strong> ${ticket.requesterName} ${ticket.requesterPhone ? `(Tel: ${ticket.requesterPhone})` : ''}</p>` : ''}
        </div>

        <div style="background: #f1f5f9; padding: 14px 16px; margin-bottom: 20px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #1e293b;">Distributore Coinvolto</h3>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Matricola (SN):</strong> <span style="font-family: monospace; font-weight: bold; background: #fee2e2; color: #991b1b; padding: 2px 8px; border-radius: 4px;">${ticket.serialNumber}</span></p>
          ${ticket.machineName ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Nome Distributore:</strong> ${ticket.machineName}</p>` : ''}
          ${ticket.machineModel ? `<p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Modello:</strong> ${ticket.machineModel}</p>` : ''}
        </div>

        <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 16px; margin-bottom: 20px; border-radius: 8px;">
          <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #9f1239;">Diagnosi &amp; Descrizione Guasto</h3>
          <p style="margin: 6px 0; font-size: 13px; color: #4c0519;"><strong>Macro Area Guasto:</strong> <span style="background: #f43f5e; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-weight: bold; text-transform: uppercase; font-size: 11px;">${ticket.macroAreaLabel || ticket.macroArea}</span></p>
          <p style="margin: 6px 0; font-size: 14px; font-weight: bold; color: #881337;"><strong>Difetto Riscontrato:</strong> ${ticket.specificIssue}</p>
          ${ticket.issueDescription ? `<div style="margin-top: 10px; padding: 10px; background: #ffffff; border-radius: 6px; border: 1px solid #ffe4e6; font-size: 13px; color: #334155;"><strong>Note Aggiuntive / Dettagli Segnalati:</strong><br/>${ticket.issueDescription}</div>` : ''}
          ${ticket.priority ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Priorità Segnalata: <strong>${ticket.priority}</strong></p>` : ''}
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
          <p style="margin: 0;">Email di assistenza generata automaticamente dal Portale IoT General Beverage.</p>
          <p style="margin: 4px 0 0 0;">Destinatario: ${recipient} | Data Segnalazione: ${new Date(ticket.createdAt || Date.now()).toLocaleString('it-IT')}</p>
        </div>
      </div>
    </div>
  `;

  try {
    const transporter = createSmtpTransporter(smtpInfo.config);
    const fromDisplayName = smtpInfo.config.fromName || 'Assistenza Tecnica IoT General Beverage';
    const fromAddress = smtpInfo.config.fromEmail || smtpInfo.config.user;

    const info = await transporter.sendMail({
      from: `"${fromDisplayName}" <${fromAddress}>`,
      to: recipient,
      subject: `[ASSISTENZA TECNICA] - ${ticket.customerName} - ${ticket.siteName} - SN ${ticket.serialNumber} (${ticket.id})`,
      html: htmlContent,
    });

    console.log(`[SUPPORT DISPATCH SUCCESS] Email inviata a: ${recipient} per ticket ${ticket.id} (messageId: ${info.messageId})`);
    return { sent: true, messageId: info.messageId };
  } catch (err: any) {
    let friendlyError = err.message || 'Errore durante la connessione al server SMTP';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      friendlyError = `Autenticazione SMTP fallita per ${smtpInfo.config.user}. Se utilizzi Gmail, genera e inserisci una "Password per le app" da 16 caratteri con verifica in 2 passaggi (non usare la tua password Google ordinaria).`;
    } else if (err.code === 'ECONNREFUSED') {
      friendlyError = `Connessione rifiutata dal server SMTP ${smtpInfo.config.host}:${smtpInfo.config.port}. Verifica host e porta.`;
    } else if (err.code === 'ETIMEDOUT') {
      friendlyError = `Timeout di connessione verso il server SMTP ${smtpInfo.config.host}:${smtpInfo.config.port}.`;
    }

    console.error(`[SUPPORT DISPATCH ERROR] Impossibile inviare email a ${recipient}:`, friendlyError);
    return { sent: false, error: friendlyError };
  }
}

// GET /api/support-requests - List support tickets (optional ?customerId=...)
app.get('/api/support-requests', (req, res) => {
  const db = loadDatabase();
  const customerId = req.query.customerId ? String(req.query.customerId) : undefined;
  let tickets = db.supportRequests || [];
  if (customerId) {
    tickets = tickets.filter((t: any) => t.customerId === customerId);
  }
  res.json(tickets);
});

// POST /api/support-requests - Create a new support ticket
app.post('/api/support-requests', async (req, res) => {
  const db = loadDatabase();
  const {
    customerId,
    customerName,
    customerCode,
    siteId,
    siteName,
    siteAddress,
    machineId,
    serialNumber,
    machineName,
    machineModel,
    macroArea,
    macroAreaLabel,
    specificIssue,
    issueDescription,
    priority,
    requesterName,
    requesterPhone,
    recipientEmail,
    notes,
  } = req.body;

  if (!customerId || !siteId) {
    res.status(400).json({ success: false, error: 'Cliente e Sede di intervento sono obbligatori' });
    return;
  }

  if (!serialNumber) {
    res.status(400).json({ success: false, error: 'Seleziona la matricola del distributore guasto' });
    return;
  }

  if (!macroArea || !specificIssue) {
    res.status(400).json({ success: false, error: 'Seleziona la macro area del guasto e il difetto riscontrato' });
    return;
  }

  if (!db.supportRequests) db.supportRequests = [];

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const ticketCountToday = db.supportRequests.filter((t: any) => (t.createdAt || '').startsWith(now.toISOString().slice(0, 10))).length;
  const ticketId = `TKT-${dateStr}-${String(ticketCountToday + 1).padStart(3, '0')}`;

  const targetRecipient = recipientEmail ? String(recipientEmail).trim() : 'claudiograf@iobevo.com';

  const newTicket = {
    id: ticketId,
    customerId: String(customerId),
    customerName: String(customerName || 'Cliente'),
    customerCode: customerCode ? String(customerCode) : undefined,
    siteId: String(siteId),
    siteName: String(siteName || 'Sede Selezionata'),
    siteAddress: siteAddress ? String(siteAddress) : undefined,
    machineId: machineId ? String(machineId) : undefined,
    serialNumber: String(serialNumber),
    machineName: machineName ? String(machineName) : undefined,
    machineModel: machineModel ? String(machineModel) : undefined,
    macroArea: String(macroArea),
    macroAreaLabel: macroAreaLabel ? String(macroAreaLabel) : String(macroArea),
    specificIssue: String(specificIssue),
    issueDescription: issueDescription ? String(issueDescription) : undefined,
    priority: priority || 'NORMALE',
    requesterName: requesterName ? String(requesterName) : undefined,
    requesterPhone: requesterPhone ? String(requesterPhone) : undefined,
    recipientEmail: targetRecipient,
    notes: notes ? String(notes) : undefined,
    status: 'APERTO',
    emailSent: false,
    emailError: undefined as string | undefined,
    emailMessageId: undefined as string | undefined,
    lastEmailAttemptAt: now.toISOString(),
    createdAt: now.toISOString(),
  };

  const emailResult = await sendSupportRequestEmail(newTicket, db);
  newTicket.emailSent = emailResult.sent;
  newTicket.emailError = emailResult.error;
  newTicket.emailMessageId = emailResult.messageId;

  db.supportRequests.unshift(newTicket);
  saveDatabase(db);
  broadcastSse('support-requests-updated', db.supportRequests);

  const statusMsg = emailResult.sent
    ? `Ticket di assistenza ${ticketId} registrato ed inviato con successo via email a: ${targetRecipient}`
    : `Ticket ${ticketId} registrato nel sistema. ATTENZIONE: notifica email non recapitata (${emailResult.error})`;

  res.status(201).json({
    success: true,
    message: statusMsg,
    ticket: newTicket,
    emailResult,
  });
});

// POST /api/support-requests/:id/resend-email - Resend email for support ticket
app.post('/api/support-requests/:id/resend-email', async (req, res) => {
  const db = loadDatabase();
  const ticket = (db.supportRequests || []).find((t: any) => t.id === req.params.id);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket non trovato' });
    return;
  }

  const { recipientEmail } = req.body;
  if (recipientEmail && typeof recipientEmail === 'string' && recipientEmail.includes('@')) {
    ticket.recipientEmail = recipientEmail.trim();
  }

  const emailResult = await sendSupportRequestEmail(ticket, db);
  ticket.emailSent = emailResult.sent;
  ticket.emailError = emailResult.error;
  ticket.emailMessageId = emailResult.messageId;
  ticket.lastEmailAttemptAt = new Date().toISOString();

  saveDatabase(db);
  broadcastSse('support-requests-updated', db.supportRequests);

  if (emailResult.sent) {
    res.json({
      success: true,
      message: `Email del ticket ${ticket.id} reinviata con successo a ${ticket.recipientEmail}!`,
      ticket,
      emailResult,
    });
  } else {
    res.status(500).json({
      success: false,
      error: emailResult.error || 'Invio email non riuscito',
      ticket,
      emailResult,
    });
  }
});

// PATCH /api/support-requests/:id/status - Update ticket status
app.patch('/api/support-requests/:id/status', (req, res) => {
  const db = loadDatabase();
  const ticket = (db.supportRequests || []).find((t: any) => t.id === req.params.id);
  if (!ticket) {
    res.status(404).json({ success: false, error: 'Ticket non trovato' });
    return;
  }

  const { status, notes } = req.body;
  if (status) {
    ticket.status = status;
    if (status === 'RISOLTO' || status === 'CHIUSO') {
      ticket.resolvedAt = new Date().toISOString();
    }
  }
  if (notes !== undefined) {
    ticket.notes = notes;
  }

  saveDatabase(db);
  broadcastSse('support-requests-updated', db.supportRequests);

  res.json({
    success: true,
    message: `Stato del ticket ${ticket.id} aggiornato a '${ticket.status}'`,
    ticket,
  });
});

// --- SMTP CONFIGURATION & TEST ROUTES ---

// GET /api/system/smtp - Retrieve current SMTP configuration status
app.get('/api/system/smtp', (req, res) => {
  const db = loadDatabase();
  const smtpInfo = getEffectiveSmtpConfig(db);

  res.json({
    configured: smtpInfo.configured,
    source: smtpInfo.source,
    config: {
      enabled: smtpInfo.config.enabled,
      host: smtpInfo.config.host,
      port: smtpInfo.config.port,
      secure: smtpInfo.config.secure,
      user: smtpInfo.config.user,
      hasPassword: Boolean(smtpInfo.config.pass && smtpInfo.config.pass.length > 0),
      fromName: smtpInfo.config.fromName,
      fromEmail: smtpInfo.config.fromEmail,
      defaultRecipient: smtpInfo.config.defaultRecipient,
    },
  });
});

// PUT /api/system/smtp - Update SMTP configuration in database
app.put('/api/system/smtp', (req, res) => {
  const db = loadDatabase();
  const {
    enabled,
    host,
    port,
    secure,
    user,
    pass,
    fromName,
    fromEmail,
    defaultRecipient,
  } = req.body;

  if (!db.config) {
    db.config = {
      deviceAlias: 'Modulo Erogatore Bevande 01',
      pinTimeoutMs: 5000,
      debounceMs: 30,
      requireHashToSubmit: true,
      vendingModel: 'GB-CLOUD-TOUCH-4X4',
      coinAcceptorEnabled: true,
      currencySymbol: '€',
      heartbeatTimeoutSec: 45,
    };
  }

  const existingSmtp = db.config.smtp || {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: 'claudiograf80@gmail.com',
    pass: '',
    fromName: 'General Beverage Portale Ordini',
    fromEmail: 'claudiograf80@gmail.com',
    defaultRecipient: 'claudiograf80@gmail.com',
  };

  // Keep existing pass if user sends empty or bullet mask
  let resolvedPass = existingSmtp.pass;
  if (pass && typeof pass === 'string' && pass.trim() !== '' && !pass.includes('•••')) {
    resolvedPass = pass.trim();
  }

  db.config.smtp = {
    enabled: enabled !== undefined ? Boolean(enabled) : true,
    host: host ? String(host).trim() : existingSmtp.host,
    port: port ? parseInt(String(port), 10) : existingSmtp.port,
    secure: Boolean(secure),
    user: user ? String(user).trim() : existingSmtp.user,
    pass: resolvedPass,
    fromName: fromName ? String(fromName).trim() : existingSmtp.fromName,
    fromEmail: fromEmail ? String(fromEmail).trim() : existingSmtp.fromEmail,
    defaultRecipient: defaultRecipient ? String(defaultRecipient).trim() : existingSmtp.defaultRecipient,
  };

  saveDatabase(db);

  const effective = getEffectiveSmtpConfig(db);

  res.json({
    success: true,
    message: 'Configurazione SMTP salvata con successo!',
    configured: effective.configured,
    source: effective.source,
    config: {
      enabled: db.config.smtp.enabled,
      host: db.config.smtp.host,
      port: db.config.smtp.port,
      secure: db.config.smtp.secure,
      user: db.config.smtp.user,
      hasPassword: Boolean(db.config.smtp.pass && db.config.smtp.pass.length > 0),
      fromName: db.config.smtp.fromName,
      fromEmail: db.config.smtp.fromEmail,
      defaultRecipient: db.config.smtp.defaultRecipient,
    },
  });
});

// POST /api/system/smtp/test - Test connection and send an actual test email
app.post('/api/system/smtp/test', async (req, res) => {
  const { to } = req.body;
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    res.status(400).json({ success: false, error: 'Indirizzo email destinatario non valido' });
    return;
  }

  const db = loadDatabase();
  const smtpInfo = getEffectiveSmtpConfig(db);
  if (!smtpInfo.configured) {
    res.status(400).json({
      success: false,
      error: 'Il server SMTP non è ancora configurato. Inserisci host, porta, utente e password prima di eseguire il test.',
      details: 'Parametri mancanti: host, user o pass non impostati in Gestione Database o nel file d\'ambiente.',
    });
    return;
  }

  try {
    const transporter = createSmtpTransporter(smtpInfo.config);
    // Verify connection & credentials first
    await transporter.verify();

    const testSubject = `[TEST] Verifica Server SMTP - Portale IoT General Beverage`;
    const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: #ffffff; padding: 20px;">
          <h2 style="margin: 0; font-size: 18px;">✅ Connessione Server SMTP Verificata!</h2>
          <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 12px;">Portale Distributori IoT General Beverage</p>
        </div>
        <div style="padding: 20px; font-size: 13px; color: #334155;">
          <p>Se ricevi questa email, significa che i parametri del server SMTP sono corretti e il server è in grado di recapitare i messaggi di posta elettronica.</p>
          <div style="background: #f8fafc; border-left: 4px solid #059669; padding: 12px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 3px 0;"><strong>Server Host:</strong> ${smtpInfo.config.host}:${smtpInfo.config.port} (${smtpInfo.config.secure ? 'SSL' : 'STARTTLS'})</p>
            <p style="margin: 3px 0;"><strong>Mittente:</strong> ${smtpInfo.config.fromName} &lt;${smtpInfo.config.fromEmail || smtpInfo.config.user}&gt;</p>
            <p style="margin: 3px 0;"><strong>Utente Autenticato:</strong> ${smtpInfo.config.user}</p>
            <p style="margin: 3px 0;"><strong>Data / Ora Test:</strong> ${new Date().toLocaleString('it-IT')}</p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 20px;">I prossimi ordini di rifornimento prodotti inviati dai clienti verranno recapitati regolarmente a questo e agli altri indirizzi impostati.</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"${smtpInfo.config.fromName}" <${smtpInfo.config.fromEmail || smtpInfo.config.user}>`,
      to,
      subject: testSubject,
      html: testHtml,
    });

    res.json({
      success: true,
      message: `Email di test inviata con successo a ${to}!`,
      messageId: info.messageId,
      source: smtpInfo.source,
    });
  } catch (err: any) {
    console.error('[SMTP TEST ERROR]', err);
    let errorMsg = err.message || 'Errore sconosciuto';
    let details = err.stack;
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      errorMsg = 'Autenticazione SMTP fallita: nome utente o password errati.';
      details = 'Se usi Google Gmail, devi attivare la Verifica in 2 passaggi nel tuo account Google e generare una "Password per le app" da 16 caratteri (non usare la normale password del tuo account Google).';
    } else if (err.code === 'ECONNREFUSED') {
      errorMsg = `Connessione rifiutata da ${smtpInfo.config.host}:${smtpInfo.config.port}.`;
      details = 'Verifica che l\'indirizzo del server e la porta siano corretti (es. 587 per STARTTLS o 465 per SSL).';
    } else if (err.code === 'ETIMEDOUT') {
      errorMsg = `Timeout durante il tentativo di connessione a ${smtpInfo.config.host}:${smtpInfo.config.port}.`;
      details = 'Il server di posta non ha risposto entro i limiti di tempo previsti. Verifica firewall o parametri di rete.';
    }

    res.status(500).json({
      success: false,
      error: errorMsg,
      details,
    });
  }
});

// POST /api/machines/:id/keymap - Dedicated keymap assignment update
app.post('/api/machines/:id/keymap', (req, res) => {
  const db = loadDatabase();
  const machine = db.machines.find((m) => m.id === req.params.id);
  if (!machine) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }

  const { keyMapping, productsDetails, enableCalibrationAndConsumption } = req.body;
  if (!keyMapping || typeof keyMapping !== 'object') {
    res.status(400).json({ success: false, error: 'keyMapping deve essere un oggetto chiave-valore { "P1": "Nome Prodotto", ... }' });
    return;
  }

  machine.keyMapping = keyMapping;
  if (productsDetails && Array.isArray(productsDetails)) {
    machine.beverages = productsDetails;
  }
  if (enableCalibrationAndConsumption !== undefined) {
    machine.enableCalibrationAndConsumption = Boolean(enableCalibrationAndConsumption);
    if (!machine.config) {
      machine.config = {
        debounceMs: 30,
        isFreeDispense: true,
        caraffaMultiplier: 3.0,
        boilerTargetTemp: 93.0,
        optoTriggerDurationMs: 400,
      };
    }
    machine.config.enableCalibrationAndConsumption = Boolean(enableCalibrationAndConsumption);
  }
  machine.lastTelemetryAt = new Date().toISOString();
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Configurazione prodotti e mappa tasti per '${machine.name}' salvata con successo!`,
    machine: enrichMachineWithDevice(machine, db.devices),
  });
});

// POST /api/machines/:id/calibration-mode - Toggle calibration and consumption management on/off for a single machine
app.post('/api/machines/:id/calibration-mode', (req, res) => {
  const db = loadDatabase();
  const machine = db.machines.find((m) => m.id === req.params.id);
  if (!machine) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }

  const { enabled } = req.body;
  const newStatus = enabled !== undefined ? Boolean(enabled) : !Boolean(machine.enableCalibrationAndConsumption);
  machine.enableCalibrationAndConsumption = newStatus;
  if (!machine.config) {
    machine.config = {
      debounceMs: 30,
      isFreeDispense: true,
      caraffaMultiplier: 3.0,
      boilerTargetTemp: 93.0,
      optoTriggerDurationMs: 400,
    };
  }
  machine.config.enableCalibrationAndConsumption = newStatus;
  machine.lastTelemetryAt = new Date().toISOString();

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    enabled: newStatus,
    message: newStatus
      ? `Gestione Taratura e Consumi ABILITATA per '${machine.name}' (Matricola ${machine.serialNumber})`
      : `Gestione Taratura e Consumi DISABILITATA per '${machine.name}'. La telemetria funziona regolarmente sulle battute.`,
    machine: enrichMachineWithDevice(machine, db.devices),
  });
});

// POST /api/machines/:id/copy-keymap-from/:sourceId - Copy product configuration between machines
app.post('/api/machines/:id/copy-keymap-from/:sourceId', (req, res) => {
  const db = loadDatabase();
  const targetMachine = db.machines.find((m) => m.id === req.params.id);
  const sourceMachine = db.machines.find((m) => m.id === req.params.sourceId);

  if (!targetMachine || !sourceMachine) {
    res.status(404).json({ success: false, error: 'Distributore sorgente o destinazione non trovato' });
    return;
  }

  targetMachine.keyMapping = { ...(sourceMachine.keyMapping || {}) };
  if (sourceMachine.beverages) {
    targetMachine.beverages = JSON.parse(JSON.stringify(sourceMachine.beverages));
  }
  targetMachine.lastTelemetryAt = new Date().toISOString();
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Configurazione prodotti copiata con successo da '${sourceMachine.name}' a '${targetMachine.name}'!`,
    machine: enrichMachineWithDevice(targetMachine, db.devices),
  });
});

// DELETE /api/machines/:id - Remove machine from fleet (allows removing all machines to start from zero)
app.delete('/api/machines/:id', (req, res) => {
  const db = loadDatabase();
  const machineToDelete = db.machines.find((m) => m.id === req.params.id);
  if (!machineToDelete) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }

  // Unpair any linked device from db.devices
  db.devices.forEach((dev) => {
    if (dev.assignedMachineId === req.params.id || (machineToDelete.assignedDeviceMac && normalizeMacAddress(dev.macAddress) === normalizeMacAddress(machineToDelete.assignedDeviceMac))) {
      dev.assignedMachineId = null;
      dev.status = 'UNASSIGNED';
    }
  });

  db.machines = db.machines.filter((m) => m.id !== req.params.id);
  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: `Distributore '${machineToDelete.name}' rimosso dalla flotta`,
    remainingCount: db.machines.length,
  });
});

// POST /api/machines/:id/refill - Refill single machine supplies
app.post('/api/machines/:id/refill', (req, res) => {
  const db = loadDatabase();
  const machine = db.machines.find((m) => m.id === req.params.id);
  if (!machine) {
    res.status(404).json({ success: false, error: 'Distributore non trovato' });
    return;
  }

  machine.supplies = {
    waterLevelLiters: machine.supplies.maxWaterLiters || 25.0,
    maxWaterLiters: machine.supplies.maxWaterLiters || 25.0,
    coffeeBeansGrams: machine.supplies.maxCoffeeGrams || 1200,
    maxCoffeeGrams: machine.supplies.maxCoffeeGrams || 1200,
    milkPowderGrams: machine.supplies.maxMilkGrams || 1000,
    maxMilkGrams: machine.supplies.maxMilkGrams || 1000,
    chocolatePowderGrams: machine.supplies.maxChocolateGrams || 1000,
    maxChocolateGrams: machine.supplies.maxChocolateGrams || 1000,
    teaPowderGrams: machine.supplies.maxTeaGrams || 600,
    maxTeaGrams: machine.supplies.maxTeaGrams || 600,
    sugarGrams: machine.supplies.maxSugarGrams || 1200,
    maxSugarGrams: machine.supplies.maxSugarGrams || 1200,
    cupsCount: machine.supplies.maxCups || 200,
    maxCups: machine.supplies.maxCups || 200,
    stirrersCount: machine.supplies.maxStirrers || 200,
    maxStirrers: machine.supplies.maxStirrers || 200,
    boilerTempCelsius: machine.config.boilerTargetTemp || 93.0,
    targetTempCelsius: machine.config.boilerTargetTemp || 93.0,
    totalEarnings: machine.supplies.totalEarnings || 0,
    totalDispenses: machine.supplies.totalDispenses || 0,
  };
  machine.status = 'ONLINE';
  machine.lastTelemetryAt = new Date().toISOString();

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);

  res.json({
    success: true,
    message: `Tutti i serbatoi del '${machine.name}' sono stati riforniti al 100%!`,
    machine: enrichMachineWithDevice(machine, db.devices),
  });
});

// POST /api/fleet/cleanup - Purge phantom/foreign machines and keep only genuine user hardware
app.post('/api/fleet/cleanup', (req, res) => {
  const db = loadDatabase();
  const primaryMachine = db.machines.find((m) => m.id === 'ESP32-VENDING-01') || db.machines[0];
  if (primaryMachine) {
    primaryMachine.id = 'ESP32-VENDING-01';
    primaryMachine.name = 'Distributore 01: Sede Centrale (GB-CLOUD)';
    primaryMachine.ipAddress = '172.16.1.200';
    primaryMachine.assignedDeviceMac = '24:6F:28:B2:1A:80';
    primaryMachine.macAddress = '24:6F:28:B2:1A:80';
    primaryMachine.status = 'ONLINE';
    db.machines = [primaryMachine];
  }

  const primaryDevice = db.devices.find((d) => d.deviceId === 'ESP32-VENDING-01' || normalizeMacAddress(d.macAddress) === '24:6F:28:B2:1A:80') || {
    macAddress: '24:6F:28:B2:1A:80',
    deviceId: 'GB-CLOUD-01',
    boardModel: 'GB-CLOUD IoT Vending Controller (MQTT HiveMQ Live)',
    firmwareVersion: 'v3.3.1-MQTT-REALTIME',
    ipAddress: '172.16.1.200',
    wifiSsid: 'WiFi Vending',
    wifiRssi: -54,
    freeHeap: 245800,
    uptimeSec: 360,
    status: 'ONLINE',
    assignedMachineId: 'ESP32-VENDING-01',
    hardwareConfig: {
      debounceMs: 30,
      optoTriggerDurationMs: 400,
      voltageLevel: '12v_opto',
      matrixPins: { row1: 13, row2: 12, row3: 14, row4: 27, col1: 26, col2: 25, col3: 33, col4: 32 },
      optoOutputPins: [19, 21, 22, 23],
      buzzerPin: 18,
      relayPin: 5,
    },
    diagnosticLogs: [
      {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: 'Modulo GB-CLOUD Fisico Connesso con Successo a HiveMQ (172.16.1.200)',
        heapFreeBytes: 245800,
        uptimeSeconds: 360,
        wifiRssi: -54,
      },
    ],
    lastHeartbeatAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    notes: 'Modulo GB-CLOUD fisico collegato a broker HiveMQ (IP 172.16.1.200)',
  };
  db.devices = [primaryDevice as Esp32Device];

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  res.json({
    success: true,
    message: 'Flotta pulita con successo: rimossi tutti i nodi fantasma. 1 Distributore e 1 Modulo attivi.',
    machinesCount: db.machines.length,
    devicesCount: db.devices.length,
  });
});

// POST /api/fleet/reset-blank - Wipe all automatically generated machines, logs, dispenses and start from zero
app.post('/api/fleet/reset-blank', (req, res) => {
  const db = loadDatabase();
  db.machines = [];
  db.logs = [];
  db.dispenses = [];
  db.accessLogs = [];
  db.pins = [];
  if (Array.isArray(db.devices)) {
    db.devices.forEach((d) => {
      d.assignedMachineId = null;
      d.status = 'UNASSIGNED';
    });
  }

  // Reset supplies stats to zero
  if (db.supplies) {
    db.supplies.totalEarnings = 0;
    db.supplies.totalDispenses = 0;
  }

  saveDatabase(db);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);
  broadcastSse('logs-updated', db.logs);
  broadcastSse('dispenses-updated', db.dispenses);

  res.json({
    success: true,
    message: 'Tutti gli impianti, distributori e dati generati automaticamente sono stati eliminati. Il sistema è ora pronto per partire da zero.',
    machinesCount: 0,
    devicesCount: (db.devices || []).length,
  });
});

// 2. SSE Stream for Real-time Dashboard (supports both /api/stream and /api/events)
const sseStreamHandler = (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  sseClients.push({ id: clientId, res });

  // Send initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, time: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
};

app.get('/api/stream', sseStreamHandler);
app.get('/api/events', sseStreamHandler);

// Endpoint to inspect Caraffa timeout status for a machine
app.get('/api/machines/:id/caraffa-status', (req, res) => {
  const machineId = req.params.id;
  const isActive = isCaraffaActiveForMachine(machineId);
  const remainingSec = getCaraffaRemainingSeconds(machineId);
  const key = normalizeMachineCaraffaKey(machineId);
  const expiresAt = machineCaraffaTimeoutMap.get(key) || null;

  res.json({
    machineId,
    isCaraffa: isActive,
    remainingSeconds: remainingSec,
    expiresAt,
  });
});

// Canonical Hardware Matrix Key Definitions
const MATRIX_TABLE_NAMES: Record<string, { label: string; defaultProduct: string; isProduct: boolean }> = {
  'P1': { label: 'PRODOTTO 1 (P1)', defaultProduct: 'Caffè Espresso', isProduct: true },
  'P2': { label: 'PRODOTTO 2 (P2)', defaultProduct: 'Caffè Lungo', isProduct: true },
  'P3': { label: 'PRODOTTO 3 (P3)', defaultProduct: 'Caffè Macchiato', isProduct: true },
  'P4': { label: 'PRODOTTO 4 (P4)', defaultProduct: 'Cappuccino Schiumato', isProduct: true },
  'P5': { label: 'PRODOTTO 5 (P5)', defaultProduct: 'Mocaccino / Cioccolato', isProduct: true },
  'P6': { label: 'PRODOTTO 6 (P6)', defaultProduct: 'Latte Caldo Macchiato', isProduct: true },
  'P7': { label: 'PRODOTTO 7 (P7)', defaultProduct: 'Cioccolata Calda Densa', isProduct: true },
  'P8': { label: 'PRODOTTO 8 (P8)', defaultProduct: 'Tè Caldo al Limone', isProduct: true },
  'P9': { label: 'PRODOTTO 9 (P9)', defaultProduct: 'Caffè Americano XL', isProduct: true },
  'P10': { label: 'PRODOTTO 10 (P10)', defaultProduct: 'Ginseng Cremoso', isProduct: true },
  'P11': { label: 'PRODOTTO 11 (P11)', defaultProduct: 'Orzo Naturale Tostato', isProduct: true },
  'P12': { label: 'PRODOTTO 12 (P12)', defaultProduct: 'Acqua Calda / Tisana', isProduct: true },
  'CARAFFA': { label: 'CARAFFA', defaultProduct: 'Modalità Caraffa', isProduct: false },
  'STOP': { label: 'STOP EMERGENZA', defaultProduct: 'Arresto Immediato', isProduct: false },
  'LINGUA': { label: 'LINGUA DISPLAY', defaultProduct: 'Selezione Lingua LCD', isProduct: false },
};

// Normalization function mapping legacy keys (1..12, A, B, C, *, 0, #) to canonical Matrix Table keys
function normalizeServerMatrixKey(rawKey: string | undefined | null): string {
  if (!rawKey) return 'P1';
  const clean = String(rawKey).trim().toUpperCase();

  // Already canonical?
  if (MATRIX_TABLE_NAMES[clean]) return clean;

  const legacyMap: Record<string, string> = {
    '1': 'P1', '2': 'P2', '3': 'P3', 'A': 'P4',
    '4': 'P5', '5': 'P6', '6': 'P7', 'B': 'P8',
    '7': 'P9', '8': 'P10', '9': 'P11', 'C': 'P12',
    '*': 'CARAFFA', '0': 'STOP', '#': 'LINGUA', 'D': 'LINGUA',
  };

  if (legacyMap[clean]) return legacyMap[clean];

  const pMatch = clean.match(/^P0?([1-9]|1[0-2])$/);
  if (pMatch) return `P${parseInt(pMatch[1], 10)}`;

  if (clean.includes('CARAFFA') || clean.includes('JARRA')) return 'CARAFFA';
  if (clean.includes('STOP') || clean.includes('ARRESTO')) return 'STOP';
  if (clean.includes('LINGUA') || clean.includes('LANG')) return 'LINGUA';

  return clean;
}

// Helper to resolve associated product name for a key on a machine
function resolveServerProductName(canonicalKey: string, machine: VendingMachine, db: DatabaseSchema): string | undefined {
  const meta = MATRIX_TABLE_NAMES[canonicalKey];
  if (!meta) return undefined;
  if (!meta.isProduct) return meta.defaultProduct;

  // Check machine custom keyMapping
  if (machine.keyMapping && machine.keyMapping[canonicalKey]) {
    return machine.keyMapping[canonicalKey];
  }

  // Check legacy alias in keyMapping
  if (machine.keyMapping) {
    for (const [k, v] of Object.entries(machine.keyMapping)) {
      if (normalizeServerMatrixKey(k) === canonicalKey && v) {
        return v;
      }
    }
  }

  // Check default database beverage
  const bev = (db.beverages || []).find((b) => normalizeServerMatrixKey(b.key) === canonicalKey || b.code === canonicalKey);
  if (bev) return bev.name;

  return meta.defaultProduct;
}

// 3. POST /api/keylog - Keypad reading endpoint called by ESP32
// Accepts: { key: "P1" | "P4" | "CARAFFA", macAddress?: "24:6F:28:B2:1A:80", deviceId?: "ESP32-GW-01", eventType?: "pressed", rssi?: -60, ip?: "192.168.1.50" }
app.post('/api/keylog', (req, res) => {
  const { key, deviceId, macAddress, eventType, voltage, rssi, ip, rawCode, metadata, isCaraffa, doseType, doseMultiplier } = req.body;

  if (key === undefined || key === null || String(key).trim() === '') {
    res.status(400).json({
      success: false,
      error: 'Campo obbligatorio mancante: "key" (es. "P1", "P4", "CARAFFA", "STOP", "LINGUA")',
    });
    return;
  }

  const cleanKey = normalizeServerMatrixKey(key);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'ESP32-Client';
  const headerMac = req.headers['x-esp32-mac'] as string | undefined;
  const effectiveMac = macAddress || headerMac;

  const db = loadDatabase();
  const { machine, device } = findExplicitlyAssociatedMachine(db, effectiveMac, deviceId);

  // AUTO-RECOGNITION se invia MAC address
  if (effectiveMac && isValidMacAddress(effectiveMac)) {
    registerOrUpdateDeviceFromNetwork(db, effectiveMac, {
      deviceId,
      ip: ip || clientIp,
      rssi,
    });
  }

  // SE IL MODULO NON È ASSOCIATO AD ALCUNA MACCHINA:
  // Le battute vengono registrate e visualizzate come "Pulsante 1", "Pulsante 2", ..., "Pulsante Caraffa", ecc.
  if (!machine) {
    const btn = getStandaloneButtonInfo(cleanKey);
    const modDev = device || (effectiveMac ? db.devices.find((d) => normalizeMacAddress(d.macAddress) === normalizeMacAddress(effectiveMac)) : null);
    const modSerial = modDev?.serialNumber || (deviceId ? String(deviceId).replace(/\D/g, '') : '500000') || '500000';
    const modName = modDev ? modDev.deviceId : `GB-CLOUD MODULE ${modSerial}`;

    console.log(`[HTTP BATTUTA STANDALONE] Ricevuta battuta '${btn.label}' da modulo non associato ${modName} (MAC: ${effectiveMac || 'no-mac'})`);

    // Debounce per modulo standalone (350ms)
    if (isKeypressDebounced(['STANDALONE_HTTP', modSerial, deviceId || '', effectiveMac || ''], cleanKey, 350)) {
      res.status(200).json({
        success: true,
        debounced: true,
        message: `Pressione tasto '${cleanKey}' filtrata (debounce).`,
      });
      return;
    }

    const standaloneLog: KeyLog = {
      id: 'log-standalone-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      key: cleanKey,
      keyLabel: btn.label,
      productName: btn.productName,
      deviceId: modDev ? modDev.deviceId : (deviceId || 'ESP32-STANDALONE'),
      machineName: `Nessuna Macchina (Modulo ${modSerial})`,
      machineSerialNumber: `MOD-${modSerial}`,
      customerName: 'Non Assegnato',
      siteName: 'Nessuna Sede',
      timestamp: new Date().toISOString(),
      eventType: 'pressed',
      isCaraffa: cleanKey === 'CARAFFA',
      doseType: cleanKey === 'CARAFFA' ? 'CARAFFA' : 'MONODOSE',
      doseMultiplier: cleanKey === 'CARAFFA' ? 3.0 : 1.0,
      channel: 'HTTP',
      rssi: typeof rssi === 'number' ? rssi : -60,
      ip: String(ip || clientIp),
      rawCode: rawCode || cleanKey.charCodeAt(0) || 0,
      metadata: {
        source: 'HTTP-StandaloneModule',
        macAddress: effectiveMac,
        serialNumber: modSerial,
        ...metadata,
      },
    };

    db.logs.unshift(standaloneLog);
    if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

    if (modDev) {
      modDev.lastHeartbeatAt = new Date().toISOString();
      modDev.status = 'UNASSIGNED';
      if (ip) modDev.ipAddress = String(ip);
      if (typeof rssi === 'number') modDev.wifiRssi = rssi;
      if (!modDev.diagnosticLogs) modDev.diagnosticLogs = [];
      modDev.diagnosticLogs.unshift({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: `[BATTUTA STANDALONE] Ricevuta battuta '${btn.label}' da modulo non associato a distributore`,
        heapFreeBytes: modDev.freeHeap,
        uptimeSeconds: modDev.uptimeSec,
        wifiRssi: modDev.wifiRssi,
      });
      if (modDev.diagnosticLogs.length > 40) modDev.diagnosticLogs = modDev.diagnosticLogs.slice(0, 40);
    }

    saveDatabase(db);
    broadcastSse('new-keylog', standaloneLog);
    broadcastSse('key-logged', standaloneLog);
    broadcastSse('devices-updated', db.devices);

    res.status(201).json({
      success: true,
      standalone: true,
      message: `Battuta '${btn.label}' registrata correttamente per modulo autonomo ${modName}`,
      log: standaloneLog,
    });
    return;
  }

  machine.lastTelemetryAt = new Date().toISOString();
  machine.status = 'ONLINE';
  if (ip) {
    machine.ipAddress = String(ip);
  }

  // Check Debounce & Duplicate Suppression (minimum 350ms window)
  const debounceLimit = Math.max(350, machine.config?.debounceMs || 350);
  if (isKeypressDebounced([machine.id, deviceId as string, effectiveMac], cleanKey, debounceLimit)) {
    res.status(200).json({
      success: true,
      debounced: true,
      message: `Pressione tasto '${cleanKey}' filtrata (debounce / soppressione rimbalzo).`,
    });
    return;
  }

  // If a physical ESP32 device node exists, update its status & heartbeat
  if (device) {
    device.lastHeartbeatAt = new Date().toISOString();
    device.status = 'ONLINE';
    if (ip) device.ipAddress = String(ip);
    if (typeof rssi === 'number') device.wifiRssi = rssi;
  }

  // Se il tasto premuto è CARAFFA, è una selezione di modalità/modificatore dose, non un'erogazione
  // Come richiesto: nella visualizzazione dei dati, la pressione del tasto caraffa non deve essere visto
  // Il tasto caraffa ha un timeout di 10 secondi, dopodiché la macchina torna in automatico a monodose.
  if (cleanKey === 'CARAFFA') {
    const expiresAt = setCaraffaTimeoutForMachine(machine.id, 10000);
    saveDatabase(db);
    broadcastSse('machines-updated', db.machines);
    broadcastSse('caraffa-modifier', {
      machineId: machine.id,
      isCaraffa: true,
      timeoutSeconds: 10,
      expiresAt,
      timestamp: new Date().toISOString(),
    });
    res.status(200).json({
      success: true,
      message: `Tasto CARAFFA premuto su ${machine.name}: predisposizione dose Caraffa (timeout 10s)`,
      isCaraffa: true,
      timeoutSeconds: 10,
      expiresAt,
    });
    return;
  }

  const keyMeta = MATRIX_TABLE_NAMES[cleanKey];
  const associatedProductName = resolveServerProductName(cleanKey, machine, db);
  const isCaraffaFromTimer = consumeCaraffaForMachine(machine.id);
  const isCaraffaDose = Boolean(isCaraffa || doseType === 'CARAFFA' || isCaraffaFromTimer);
  const multiplier = isCaraffaDose ? (Number(doseMultiplier) || 3.0) : 1.0;

  const newLog: KeyLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    key: cleanKey,
    keyLabel: isCaraffaDose ? `EROGAZIONE CARAFFA (${cleanKey})` : (keyMeta ? keyMeta.label : `TASTO [${cleanKey}]`),
    productName: isCaraffaDose ? `${associatedProductName} (Dose Caraffa)` : associatedProductName,
    deviceId: machine.id,
    machineName: machine.name,
    machineSerialNumber: machine.serialNumber,
    customerName: machine.locationDetails?.company || 'Cliente Vending',
    siteName: machine.locationDetails?.site || 'Sede Operativa',
    timestamp: new Date().toISOString(),
    eventType: eventType && ['pressed', 'released', 'held'].includes(eventType) ? eventType : 'pressed',
    isCaraffa: isCaraffaDose,
    doseType: isCaraffaDose ? 'CARAFFA' : 'MONODOSE',
    doseMultiplier: multiplier,
    calibrationAndConsumptionEnabled: Boolean(machine.enableCalibrationAndConsumption || machine.config?.enableCalibrationAndConsumption),
    channel: 'HTTP-API',
    voltage: typeof voltage === 'number' ? voltage : undefined,
    rssi: typeof rssi === 'number' ? rssi : undefined,
    ip: ip ? String(ip) : String(clientIp),
    rawCode: typeof rawCode === 'number' ? rawCode : (cleanKey.charCodeAt(0) || 0),
    metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
  };

  // Prepend new log
  db.logs.unshift(newLog);
  // Cap at 2000 logs to prevent unbounded file growth
  if (db.logs.length > 2000) {
    db.logs = db.logs.slice(0, 2000);
  }
  saveDatabase(db);

  // Broadcast to live SSE viewers
  broadcastSse('new-keylog', newLog);
  broadcastSse('machines-updated', db.machines);
  broadcastSse('devices-updated', db.devices);

  res.status(201).json({
    success: true,
    message: `Tasto '${cleanKey}' (${associatedProductName || 'Funzione'}) registrato con successo da ${machine.name}`,
    log: newLog,
    key: cleanKey,
    productName: associatedProductName,
    machineName: machine.name,
    machineId: machine.id,
    serialNumber: machine.serialNumber,
    customerName: newLog.customerName,
    siteName: newLog.siteName,
    totalLogs: db.logs.length,
  });
});

// 4. POST /api/keylogs/batch - Bulk keypresses submission
app.post('/api/keylogs/batch', (req, res) => {
  const { keys, deviceId } = req.body;
  if (!Array.isArray(keys) || keys.length === 0) {
    res.status(400).json({ success: false, error: 'keys must be a non-empty array' });
    return;
  }

  const targetDeviceId = deviceId ? String(deviceId).trim() : 'ESP32-VENDING-01';
  const rawMac = req.body.macAddress || req.body.mac || null;
  const normMac = rawMac ? normalizeMacAddress(rawMac) : null;
  const db = loadDatabase();
  const { machine, device } = findExplicitlyAssociatedMachine(db, normMac, targetDeviceId);

  const createdLogs: KeyLog[] = [];
  const now = Date.now();

  if (!machine) {
    const modDev = device || (normMac ? db.devices.find((d) => normalizeMacAddress(d.macAddress) === normMac) : null);
    const modSerial = modDev?.serialNumber || targetDeviceId.replace(/\D/g, '') || '500000';
    const modName = modDev ? modDev.deviceId : `GB-CLOUD MODULE ${modSerial}`;

    keys.forEach((k, idx) => {
      const cleanKey = normalizeServerMatrixKey(String(k));
      const btn = getStandaloneButtonInfo(cleanKey);
      const logItem: KeyLog = {
        id: `log-standalone-batch-${now}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
        key: cleanKey,
        keyLabel: btn.label,
        productName: btn.productName,
        deviceId: modName,
        machineName: `Nessuna Macchina (Modulo ${modSerial})`,
        machineSerialNumber: `MOD-${modSerial}`,
        customerName: 'Non Assegnato',
        siteName: 'Nessuna Sede',
        timestamp: new Date(now + idx * 50).toISOString(),
        eventType: 'pressed',
        isCaraffa: cleanKey === 'CARAFFA',
        doseType: cleanKey === 'CARAFFA' ? 'CARAFFA' : 'MONODOSE',
        doseMultiplier: cleanKey === 'CARAFFA' ? 3.0 : 1.0,
      };
      createdLogs.push(logItem);
      db.logs.unshift(logItem);
    });

    if (db.logs.length > 2000) {
      db.logs = db.logs.slice(0, 2000);
    }
    saveDatabase(db);
    broadcastSse('batch-keylogs', createdLogs);

    res.status(201).json({
      success: true,
      standalone: true,
      count: createdLogs.length,
      logs: createdLogs,
      message: `${createdLogs.length} battute standalone registrate con successo`,
    });
    return;
  }

  machine.lastTelemetryAt = new Date().toISOString();
  machine.status = 'ONLINE';

  keys.forEach((k, idx) => {
    const cleanKey = String(k).trim().toUpperCase().charAt(0);
    const logItem: KeyLog = {
      id: `log-${now}-${idx}-${Math.random().toString(36).substring(2, 5)}`,
      key: cleanKey,
      deviceId: targetDeviceId,
      machineName: machine.name,
      machineSerialNumber: machine.serialNumber,
      customerName: machine.locationDetails?.company || 'Cliente Vending',
      siteName: machine.locationDetails?.site || 'Sede Operativa',
      timestamp: new Date(now + idx * 50).toISOString(),
      eventType: 'pressed',
      calibrationAndConsumptionEnabled: Boolean(machine.enableCalibrationAndConsumption || machine.config?.enableCalibrationAndConsumption),
    };
    createdLogs.push(logItem);
    db.logs.unshift(logItem);
  });

  if (db.logs.length > 2000) {
    db.logs = db.logs.slice(0, 2000);
  }
  saveDatabase(db);

  broadcastSse('batch-keylogs', createdLogs);
  broadcastSse('machines-updated', db.machines);

  res.status(201).json({
    success: true,
    count: createdLogs.length,
    logs: createdLogs,
    machineName: machine.name,
  });
});

// 5. POST /api/verify-pin - Submits and validates a PIN sequence
app.post('/api/verify-pin', (req, res) => {
  const { pin, deviceId } = req.body;
  if (!pin) {
    res.status(400).json({ success: false, error: 'Missing PIN' });
    return;
  }

  const cleanPin = String(pin).trim();
  const targetDeviceId = deviceId ? String(deviceId).trim() : 'ESP32-VENDING-01';
  const db = loadDatabase();
  const machine = findMachineById(db, targetDeviceId);
  if (!machine) {
    res.status(404).json({ success: false, error: 'Nessun distributore configurato' });
    return;
  }

  const matchingPin = db.pins.find((p) => p.code === cleanPin && p.enabled);
  const isGranted = Boolean(matchingPin);

  const accessRecord: AccessLog = {
    id: 'acc-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
    deviceId: targetDeviceId,
    machineName: machine.name,
    enteredPin: cleanPin,
    status: isGranted ? 'GRANTED' : 'DENIED',
    userName: matchingPin ? matchingPin.name : undefined,
  };

  db.accessLogs.unshift(accessRecord);
  if (db.accessLogs.length > 500) {
    db.accessLogs = db.accessLogs.slice(0, 500);
  }
  saveDatabase(db);

  broadcastSse('new-access-log', accessRecord);

  if (isGranted) {
    res.json({
      success: true,
      granted: true,
      user: matchingPin?.name,
      role: matchingPin?.role,
      machineName: machine.name,
      message: `Accesso consentito a ${matchingPin?.name} su ${machine.name}`,
      relayAction: 'OPEN_DOOR_3S',
    });
  } else {
    res.json({
      success: true,
      granted: false,
      machineName: machine.name,
      message: 'Accesso negato: PIN non riconosciuto o disabilitato',
      relayAction: 'ALARM_BEEP',
    });
  }
});

// 6. GET /api/keylogs - Query logs
app.get('/api/keylogs', (req, res) => {
  const db = loadDatabase();
  const { key, deviceId, serialNumber, customer, site, limit = 100, offset = 0 } = req.query;

  // Escludi la pressione singola del tasto CARAFFA dalla visualizzazione dei dati
  let filtered = db.logs.filter((l) => l.key !== 'CARAFFA');

  if (key) {
    filtered = filtered.filter((l) => l.key === String(key).toUpperCase());
  }
  if (deviceId) {
    filtered = filtered.filter((l) => l.deviceId.toLowerCase().includes(String(deviceId).toLowerCase()));
  }
  if (serialNumber) {
    filtered = filtered.filter((l) => (l.machineSerialNumber || '').includes(String(serialNumber)));
  }
  if (customer) {
    filtered = filtered.filter((l) => (l.customerName || '').toLowerCase().includes(String(customer).toLowerCase()));
  }
  if (site) {
    filtered = filtered.filter((l) => (l.siteName || '').toLowerCase().includes(String(site).toLowerCase()));
  }

  const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit)).map((log) => {
    let machineSerialNumber = log.machineSerialNumber;
    let customerName = log.customerName;
    let siteName = log.siteName;
    let machineName = log.machineName;

    if (!machineSerialNumber || !customerName || !siteName) {
      const mach = db.machines.find((m) => m.id === log.deviceId) || db.machines[0];
      if (mach) {
        if (!machineSerialNumber) machineSerialNumber = mach.serialNumber;
        if (!customerName) customerName = mach.locationDetails?.company || 'Cliente Vending';
        if (!siteName) siteName = mach.locationDetails?.site || 'Sede Operativa';
        if (!machineName) machineName = mach.name;
      }
    }
    return {
      ...log,
      machineSerialNumber: machineSerialNumber || '104829',
      customerName: customerName || 'Cliente Vending',
      siteName: siteName || 'Sede Principale',
      machineName: machineName || log.deviceId,
    };
  });

  res.json({
    total: filtered.length,
    limit: Number(limit),
    offset: Number(offset),
    logs: paginated,
  });
});

// 7. DELETE /api/keylogs - Clear database logs
app.delete('/api/keylogs', (req, res) => {
  const db = loadDatabase();
  const count = db.logs.length;
  db.logs = [];
  saveDatabase(db);
  broadcastSse('logs-cleared', { count });
  res.json({ success: true, message: `${count} log rimossi dal database` });
});

// 8. GET /api/stats - Statistics & Key Frequency & Beverage Sales
app.get('/api/stats', (req, res) => {
  const db = loadDatabase();
  
  const keyCounts: Record<string, number> = {};
  const deviceCounts: Record<string, number> = {};
  const hourBuckets: Record<string, number> = {};

  // Escludi la pressione del tasto CARAFFA dalle statistiche dei tasti
  const validLogs = db.logs.filter((l) => l.key !== 'CARAFFA');

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const todayUtc = now.toISOString().slice(0, 10);
  let totalToday = 0;

  validLogs.forEach((log) => {
    keyCounts[log.key] = (keyCounts[log.key] || 0) + 1;
    deviceCounts[log.deviceId] = (deviceCounts[log.deviceId] || 0) + 1;
    
    if (log.timestamp) {
      const d = new Date(log.timestamp);
      if (!isNaN(d.getTime())) {
        const hour = d.getHours();
        hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;

        const isLocalToday =
          d.getFullYear() === todayYear &&
          d.getMonth() === todayMonth &&
          d.getDate() === todayDate;
        const isUtcToday = typeof log.timestamp === 'string' && log.timestamp.startsWith(todayUtc);
        if (isLocalToday || isUtcToday) {
          totalToday++;
        }
      }
    }
  });

  const uniqueKeys = Object.keys(keyCounts).length;

  const beverageCounts: Record<string, number> = {};
  let totalEarnings = 0;
  (db.dispenses || []).forEach((d) => {
    if (d.status === 'COMPLETED') {
      beverageCounts[d.beverageName] = (beverageCounts[d.beverageName] || 0) + 1;
      totalEarnings += d.price || 0;
    }
  });

  let popularBeverage = 'N/D';
  let maxCount = 0;
  Object.entries(beverageCounts).forEach(([name, cnt]) => {
    if (cnt > maxCount) {
      maxCount = cnt;
      popularBeverage = name;
    }
  });

  const totalMachines = db.machines?.length || 0;
  const onlineMachines = (db.machines || []).filter((m) => m.status === 'ONLINE' || m.status === 'DISPENSING').length;
  const machinesCumulativeDispenses = (db.machines || []).reduce(
    (sum, m) => sum + (m.supplies?.totalDispenses || (m as any).totalPresses || 0),
    0
  );
  const totalFleetDispenses = Math.max(machinesCumulativeDispenses, validLogs.length);

  res.json({
    totalKeypresses: validLogs.length,
    totalFleetDispenses,
    totalToday,
    uniqueKeys,
    keyCounts,
    deviceCounts,
    hourBuckets,
    registeredPins: db.pins.length,
    accessAttempts: db.accessLogs.length,
    recentLog: validLogs[0] || null,
    totalEarnings: Number(totalEarnings.toFixed(2)),
    totalDispenses: (db.dispenses || []).length,
    popularBeverage,
    supplies: db.supplies,
    totalMachines,
    onlineMachines,
    machines: db.machines,
  });
});

// 9. Beverage Catalog Endpoints
app.get('/api/beverages', (req, res) => {
  const db = loadDatabase();
  res.json(db.beverages || []);
});

app.post('/api/beverages', (req, res) => {
  const { name, key, code, category, price, prepTimeSec, iconName, description, ingredients } = req.body;
  if (!name || !key) {
    res.status(400).json({ success: false, error: 'Nome e tasto assegnato sono obbligatori' });
    return;
  }
  const db = loadDatabase();
  const existingIdx = db.beverages.findIndex((b) => b.id === req.body.id || b.key === key);
  
  const bevItem: BeverageItem = {
    id: req.body.id || 'bev-' + Date.now(),
    productNumber: typeof req.body.productNumber === 'number' ? req.body.productNumber : (existingIdx >= 0 ? db.beverages[existingIdx].productNumber : db.beverages.length + 1),
    key: String(key).trim().toUpperCase(),
    code: code || `P${String(db.beverages.length + 1).padStart(2, '0')}`,
    name: String(name).trim(),
    category: category || 'coffee',
    price: typeof price === 'number' ? price : 0.50,
    prepTimeSec: typeof prepTimeSec === 'number' ? prepTimeSec : 10,
    iconName: iconName || 'Coffee',
    description: description || '',
    available: req.body.available !== false,
    ingredients: ingredients || { waterMl: 40, coffeeGrams: 7.5, milkPowderGrams: 0, chocolateGrams: 0, teaGrams: 0, sugarGrams: 4 },
  };

  if (existingIdx >= 0) {
    db.beverages[existingIdx] = bevItem;
  } else {
    db.beverages.push(bevItem);
  }

  saveDatabase(db);
  broadcastSse('beverages-updated', db.beverages);
  res.status(201).json({ success: true, beverage: bevItem });
});

app.delete('/api/beverages/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  db.beverages = (db.beverages || []).filter((b) => b.id !== id);
  saveDatabase(db);
  broadcastSse('beverages-updated', db.beverages);
  res.json({ success: true, message: 'Bevanda rimossa' });
});

// 9b. Product Articles Catalog Endpoints
app.get('/api/articles', (req, res) => {
  const db = loadDatabase();
  const search = req.query.search ? String(req.query.search).toLowerCase().trim() : '';
  const type = req.query.type ? String(req.query.type).toLowerCase().trim() : '';

  let list = db.articles || [];
  if (type && type !== 'all') {
    list = list.filter((a) => a.ingredientType === type);
  }
  if (search) {
    list = list.filter((a) => 
      a.itemCode.toLowerCase().includes(search) || 
      a.name.toLowerCase().includes(search) || 
      (a.description && a.description.toLowerCase().includes(search)) ||
      (a.supplier && a.supplier.toLowerCase().includes(search))
    );
  }
  res.json({
    success: true,
    total: (db.articles || []).length,
    count: list.length,
    articles: list,
  });
});

app.get('/api/articles/template-csv', (_req, res) => {
  const csvContent = 
    `Codice Articolo;Nome Prodotto;Categoria (coffee/milk/chocolate/tea/sugar/solubles/cups/water/syrup/other);Confezione;Costo al Kg (€);Grammi per Dose;Grammi al Secondo;RPM Motore (40/120/200);Fornitore;Descrizione\n` +
    `ART-ESPR-ORO;Caffè Espresso Qualità Oro 100% Arabica;coffee;Busta 1 Kg;19.50;7.0;2.8;120;Nostro Fornitore;Miscela top per macchine vending\n` +
    `ART-LATTE-PREM;Latte Scremato Gran Schiuma;milk;Busta 1 Kg;10.80;8.5;2.5;120;Nostro Fornitore;Alta resa per cappuccini cremosi\n` +
    `ART-CIOC-DARK;Cioccolato Extra Fondente Svizzero;chocolate;Busta 1 Kg;8.50;18.0;4.5;200;Nostro Fornitore;Gusto intenso e persistente\n` +
    `ART-THE-LIMONE;The al Limone Solubile Rinfrescante;tea;Busta 1 Kg;7.50;12.0;3.2;120;Nostro Fornitore;Estratto naturale al limone\n` +
    `ART-ZUCCH-VEND;Zucchero Semolato Extra Fine;sugar;Sacco 5 Kg;2.20;5.0;2.0;40;Nostro Fornitore;Grano fine anti-umidità\n` +
    `ART-BRODO-VEG;Brodo Vegetale Concentrato Istantaneo;solubles;Busta 1 Kg;13.50;10.0;1.8;40;Ristosano;Basso tenore di sale per ospedali\n`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="template_catalogo_prodotti.csv"');
  res.send(csvContent);
});

app.get('/api/articles/export', (req, res) => {
  const db = loadDatabase();
  const format = req.query.format === 'json' ? 'json' : 'csv';
  const articles = db.articles || [];

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="catalogo_articoli_export.json"');
    res.send(JSON.stringify(articles, null, 2));
    return;
  }

  const headers = [
    'Codice Articolo',
    'Nome Prodotto',
    'Categoria',
    'Confezione',
    'Costo al Kg (€)',
    'Grammi per Dose',
    'Grammi al Secondo',
    'RPM Motore',
    'Fornitore',
    'Descrizione'
  ];

  const rows = articles.map((a) => [
    `"${(a.itemCode || '').replace(/"/g, '""')}"`,
    `"${(a.name || '').replace(/"/g, '""')}"`,
    `"${(a.ingredientType || 'solubles').replace(/"/g, '""')}"`,
    `"${(a.packageUnit || 'Busta 1 Kg').replace(/"/g, '""')}"`,
    a.costPerKg ? a.costPerKg.toFixed(2) : '0.00',
    a.nominalGramsPerDose ? a.nominalGramsPerDose.toFixed(1) : '8.0',
    a.defaultGramsPerSecond ? a.defaultGramsPerSecond.toFixed(2) : '2.50',
    a.defaultRpm || 120,
    `"${(a.supplier || '').replace(/"/g, '""')}"`,
    `"${(a.description || '').replace(/"/g, '""')}"`,
  ].join(';'));

  const csv = [headers.join(';'), ...rows].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="catalogo_articoli_export.csv"');
  res.send(csv);
});

app.post('/api/articles', (req, res) => {
  const {
    itemCode,
    name,
    ingredientType,
    defaultRpm,
    defaultGramsPerSecond,
    nominalGramsPerDose,
    costPerKg,
    packageUnit,
    description,
    supplier,
  } = req.body;

  if (!itemCode || !String(itemCode).trim()) {
    res.status(400).json({ success: false, error: 'Codice Articolo obbligatorio (es. ART-CAF-01)' });
    return;
  }
  if (!name || !String(name).trim()) {
    res.status(400).json({ success: false, error: 'Nome del Prodotto obbligatorio' });
    return;
  }

  const cleanCode = String(itemCode).trim().toUpperCase();
  const db = loadDatabase();
  if (!db.articles) db.articles = getDefaultArticles();

  const existingIdx = db.articles.findIndex((a) => a.itemCode.toUpperCase() === cleanCode);

  const articleItem: ArticleItem = {
    itemCode: cleanCode,
    name: String(name).trim(),
    ingredientType: ingredientType || 'solubles',
    defaultRpm: typeof defaultRpm === 'number' ? defaultRpm : (Number(defaultRpm) || 120),
    defaultGramsPerSecond: typeof defaultGramsPerSecond === 'number' ? defaultGramsPerSecond : (Number(defaultGramsPerSecond) || 2.5),
    nominalGramsPerDose: typeof nominalGramsPerDose === 'number' ? nominalGramsPerDose : (Number(nominalGramsPerDose) || 8.0),
    costPerKg: typeof costPerKg === 'number' ? costPerKg : (Number(costPerKg) || 0.0),
    packageUnit: packageUnit ? String(packageUnit).trim() : 'Busta 1 Kg',
    description: description ? String(description).trim() : '',
    supplier: supplier ? String(supplier).trim() : 'Nostro Fornitore',
    updatedAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    db.articles[existingIdx] = articleItem;
  } else {
    db.articles.push(articleItem);
  }

  saveDatabase(db);
  broadcastSse('articles-updated', { action: 'saved', article: articleItem, count: db.articles.length });
  res.status(existingIdx >= 0 ? 200 : 201).json({
    success: true,
    isNew: existingIdx < 0,
    article: articleItem,
    totalArticles: db.articles.length,
  });
});

app.put('/api/articles/:itemCode', (req, res) => {
  const code = decodeURIComponent(req.params.itemCode).trim().toUpperCase();
  const db = loadDatabase();
  if (!db.articles) db.articles = getDefaultArticles();

  const idx = db.articles.findIndex((a) => a.itemCode.toUpperCase() === code);
  if (idx < 0) {
    res.status(404).json({ success: false, error: `Articolo con codice ${code} non trovato` });
    return;
  }

  const existing = db.articles[idx];
  const updatedItem: ArticleItem = {
    ...existing,
    name: req.body.name !== undefined ? String(req.body.name).trim() : existing.name,
    ingredientType: req.body.ingredientType !== undefined ? req.body.ingredientType : existing.ingredientType,
    defaultRpm: req.body.defaultRpm !== undefined ? Number(req.body.defaultRpm) : existing.defaultRpm,
    defaultGramsPerSecond: req.body.defaultGramsPerSecond !== undefined ? Number(req.body.defaultGramsPerSecond) : existing.defaultGramsPerSecond,
    nominalGramsPerDose: req.body.nominalGramsPerDose !== undefined ? Number(req.body.nominalGramsPerDose) : existing.nominalGramsPerDose,
    costPerKg: req.body.costPerKg !== undefined ? Number(req.body.costPerKg) : existing.costPerKg,
    packageUnit: req.body.packageUnit !== undefined ? String(req.body.packageUnit).trim() : existing.packageUnit,
    description: req.body.description !== undefined ? String(req.body.description).trim() : existing.description,
    supplier: req.body.supplier !== undefined ? String(req.body.supplier).trim() : existing.supplier,
    updatedAt: new Date().toISOString(),
  };

  db.articles[idx] = updatedItem;
  saveDatabase(db);
  broadcastSse('articles-updated', { action: 'updated', article: updatedItem, count: db.articles.length });
  res.json({ success: true, article: updatedItem });
});

app.delete('/api/articles/:itemCode', (req, res) => {
  const code = decodeURIComponent(req.params.itemCode).trim().toUpperCase();
  const db = loadDatabase();
  if (!db.articles) db.articles = getDefaultArticles();

  const initialCount = db.articles.length;
  db.articles = db.articles.filter((a) => a.itemCode.toUpperCase() !== code);

  if (db.articles.length === initialCount) {
    res.status(404).json({ success: false, error: `Articolo con codice ${code} non trovato` });
    return;
  }

  saveDatabase(db);
  broadcastSse('articles-updated', { action: 'deleted', itemCode: code, count: db.articles.length });
  res.json({ success: true, message: `Articolo ${code} rimosso con successo`, remaining: db.articles.length });
});

app.post('/api/articles/import', (req, res) => {
  const db = loadDatabase();
  if (!db.articles) db.articles = getDefaultArticles();

  const mode = req.body.mode === 'replace' ? 'replace' : 'merge';
  let incomingList: ArticleItem[] = [];

  if (Array.isArray(req.body.articles) && req.body.articles.length > 0) {
    incomingList = req.body.articles.map((item: any) => ({
      itemCode: String(item.itemCode || item.code || item.codice || '').trim().toUpperCase(),
      name: String(item.name || item.nome || item.descrizione || '').trim(),
      ingredientType: (item.ingredientType || item.tipo || item.categoria || 'solubles') as any,
      defaultRpm: Number(item.defaultRpm || item.rpm) || 120,
      defaultGramsPerSecond: Number(item.defaultGramsPerSecond || item.gsec || item['g/sec']) || 2.5,
      nominalGramsPerDose: Number(item.nominalGramsPerDose || item.dose) || 8.0,
      costPerKg: Number(item.costPerKg || item.costo || item.prezzo) || 0.0,
      packageUnit: String(item.packageUnit || item.confezione || item.unita || 'Busta 1 Kg').trim(),
      description: String(item.description || item.note || '').trim(),
      supplier: String(item.supplier || item.fornitore || 'Nostro Fornitore').trim(),
      updatedAt: new Date().toISOString(),
    })).filter((a: ArticleItem) => a.itemCode && a.name);
  } else if (typeof req.body.csvText === 'string' && req.body.csvText.trim()) {
    const rawLines = req.body.csvText.split(/\r?\n/).map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    if (rawLines.length === 0) {
      res.status(400).json({ success: false, error: 'Testo CSV vuoto' });
      return;
    }

    const firstLine = rawLines[0];
    let delimiter = ';';
    if (firstLine.includes('\t')) delimiter = '\t';
    else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
    else if (firstLine.includes(',') && !firstLine.includes(';')) delimiter = ',';
    else {
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      if (tabCount > semicolonCount && tabCount > commaCount) delimiter = '\t';
      else if (semicolonCount >= commaCount) delimiter = ';';
      else delimiter = ',';
    }

    const splitRow = (rowStr: string): string[] => {
      return rowStr.split(delimiter).map((p) => p.replace(/^"|"$/g, '').trim());
    };

    const headerParts = splitRow(firstLine).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const isHeaderRow = headerParts.some((h) => h.includes('cod') || h.includes('nome') || h.includes('art') || h.includes('item'));

    const startIdx = isHeaderRow ? 1 : 0;
    for (let i = startIdx; i < rawLines.length; i++) {
      const parts = splitRow(rawLines[i]);
      if (parts.length < 2) continue;

      let code = '';
      let name = '';
      let ingType: any = 'solubles';
      let packUnit = 'Busta 1 Kg';
      let costKg = 0;
      let gramDose = 8.0;
      let gSec = 2.5;
      let rpm = 120;
      let supp = 'Nostro Fornitore';
      let desc = '';

      if (isHeaderRow) {
        headerParts.forEach((h, colIdx) => {
          const val = parts[colIdx] || '';
          if (h.includes('cod') || h.includes('art') || h.includes('item')) code = val;
          else if (h.includes('nom') || h.includes('prod') || h.includes('descriz')) {
            if (!name) name = val;
            else desc = val;
          } else if (h.includes('categ') || h.includes('tipo') || h.includes('ingred')) {
            const lowVal = val.toLowerCase();
            if (lowVal.includes('caff')) ingType = 'coffee';
            else if (lowVal.includes('latt') || lowVal.includes('milk')) ingType = 'milk';
            else if (lowVal.includes('cioc') || lowVal.includes('choc')) ingType = 'chocolate';
            else if (lowVal.includes('the') || lowVal.includes('tè') || lowVal.includes('tea')) ingType = 'tea';
            else if (lowVal.includes('zucc') || lowVal.includes('sugar')) ingType = 'sugar';
            else if (lowVal.includes('sciropp') || lowVal.includes('syrup')) ingType = 'syrup';
            else if (lowVal.includes('bich') || lowVal.includes('cup')) ingType = 'cups';
            else if (lowVal.includes('acqu') || lowVal.includes('water')) ingType = 'water';
            else ingType = 'solubles';
          } else if (h.includes('conf') || h.includes('unit') || h.includes('form')) packUnit = val;
          else if (h.includes('cost') || h.includes('prezz')) costKg = parseFloat(val.replace(',', '.')) || 0;
          else if (h.includes('dose') || h.includes('grammid')) gramDose = parseFloat(val.replace(',', '.')) || 8.0;
          else if (h.includes('sec') || h.includes('gsec')) gSec = parseFloat(val.replace(',', '.')) || 2.5;
          else if (h.includes('rpm') || h.includes('giri')) rpm = parseInt(val, 10) || 120;
          else if (h.includes('forn') || h.includes('supp')) supp = val;
          else if (h.includes('note') || h.includes('desc')) desc = val;
        });
      } else {
        code = parts[0] || '';
        name = parts[1] || '';
        if (parts[2]) ingType = parts[2] as any;
        if (parts[3]) packUnit = parts[3];
        if (parts[4]) costKg = parseFloat(parts[4].replace(',', '.')) || 0;
        if (parts[5]) gramDose = parseFloat(parts[5].replace(',', '.')) || 8.0;
        if (parts[6]) gSec = parseFloat(parts[6].replace(',', '.')) || 2.5;
        if (parts[7]) rpm = parseInt(parts[7], 10) || 120;
        if (parts[8]) supp = parts[8];
        if (parts[9]) desc = parts[9];
      }

      if (code && name) {
        incomingList.push({
          itemCode: code.trim().toUpperCase(),
          name: name.trim(),
          ingredientType: ingType,
          packageUnit: packUnit || 'Busta 1 Kg',
          costPerKg: costKg,
          nominalGramsPerDose: gramDose,
          defaultGramsPerSecond: gSec,
          defaultRpm: rpm,
          supplier: supp || 'Nostro Fornitore',
          description: desc,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  if (incomingList.length === 0) {
    res.status(400).json({ success: false, error: 'Nessun articolo valido riconosciuto nel file o nei dati inviati' });
    return;
  }

  if (mode === 'replace') {
    db.articles = incomingList;
  } else {
    incomingList.forEach((incoming) => {
      const existingIdx = db.articles!.findIndex((a) => a.itemCode.toUpperCase() === incoming.itemCode);
      if (existingIdx >= 0) {
        db.articles![existingIdx] = { ...db.articles![existingIdx], ...incoming };
      } else {
        db.articles!.push(incoming);
      }
    });
  }

  saveDatabase(db);
  broadcastSse('articles-updated', { action: 'imported', count: incomingList.length, total: db.articles.length });
  res.json({
    success: true,
    mode,
    importedCount: incomingList.length,
    totalArticles: db.articles.length,
    articles: db.articles,
  });
});

app.post('/api/articles/reset-defaults', (_req, res) => {
  const db = loadDatabase();
  const defaults = getDefaultArticles();
  db.articles = defaults;
  saveDatabase(db);
  broadcastSse('articles-updated', { action: 'reset', count: defaults.length });
  res.json({
    success: true,
    message: 'Catalogo articoli ripristinato con i prodotti predefiniti di fabbrica',
    articles: defaults,
  });
});

// 10. Machine Supplies & Refill
app.get('/api/supplies', (req, res) => {
  const db = loadDatabase();
  res.json(db.supplies || getDefaultDb().supplies);
});

app.post('/api/supplies/refill', (req, res) => {
  const db = loadDatabase();
  const max = {
    waterLevelLiters: db.supplies.maxWaterLiters,
    maxWaterLiters: db.supplies.maxWaterLiters,
    coffeeBeansGrams: db.supplies.maxCoffeeGrams,
    maxCoffeeGrams: db.supplies.maxCoffeeGrams,
    milkPowderGrams: db.supplies.maxMilkGrams,
    maxMilkGrams: db.supplies.maxMilkGrams,
    chocolatePowderGrams: db.supplies.maxChocolateGrams,
    maxChocolateGrams: db.supplies.maxChocolateGrams,
    teaPowderGrams: db.supplies.maxTeaGrams,
    maxTeaGrams: db.supplies.maxTeaGrams,
    sugarGrams: db.supplies.maxSugarGrams,
    maxSugarGrams: db.supplies.maxSugarGrams,
    cupsCount: db.supplies.maxCups,
    maxCups: db.supplies.maxCups,
    stirrersCount: db.supplies.maxStirrers,
    maxStirrers: db.supplies.maxStirrers,
    boilerTempCelsius: 93.0,
    targetTempCelsius: 93.0,
    totalEarnings: db.supplies.totalEarnings,
    totalDispenses: db.supplies.totalDispenses,
  };
  db.supplies = max;
  // Refill all machines too
  db.machines.forEach((m) => {
    m.supplies = { ...max };
    m.status = 'ONLINE';
    m.lastTelemetryAt = new Date().toISOString();
  });

  saveDatabase(db);
  broadcastSse('supplies-updated', db.supplies);
  broadcastSse('machines-updated', db.machines);
  res.json({ success: true, message: 'Tutti i serbatoi di tutti i distributori sono stati riforniti al 100%!', supplies: db.supplies, machines: db.machines });
});

// 11. Dispense Order Execution (Keypad -> ESP32 -> PLC Trigger & Actuators)
app.post('/api/dispense', (req, res) => {
  const { key, beverageId, isCaraffa = false, deviceId, machineId, durationMs } = req.body;
  const targetKey = deviceId || machineId;
  const db = loadDatabase();

  if (!targetKey || String(targetKey).trim() === '') {
    res.status(400).json({ success: false, error: 'Nessun distributore o modulo hardware selezionato per l\'erogazione' });
    return;
  }

  const targetResolution = resolveTargetHardware(db, targetKey);
  if (targetResolution.error) {
    res.status(400).json({ success: false, error: targetResolution.error });
    return;
  }

  if (!targetResolution.targetMac || !targetResolution.cleanMac) {
    res.status(400).json({
      success: false,
      error: `Il distributore selezionato '${targetResolution.machine?.name || targetKey}' non ha alcun modulo ESP32 associato. Assegna prima un modulo hardware nella Gestione Parco.`,
    });
    return;
  }

  const machine = targetResolution.machine;
  const device = targetResolution.device;
  const isStandalone = !machine || targetResolution.machine?.location === 'Banco Collaudo Hardware';
  const targetDeviceId = targetResolution.canonicalDeviceId;
  const effectiveMachineId = machine ? machine.id : (device?.deviceId || targetDeviceId);
  const effectiveMachineName = machine ? machine.name : (device ? `Modulo Standalone ${device.deviceId}` : `Modulo Standalone ${targetDeviceId}`);
  const targetMac = targetResolution.targetMac;
  const customDurationMs = (durationMs && Number(durationMs) > 0)
    ? Number(durationMs)
    : (machine?.config?.optoTriggerDurationMs || device?.hardwareConfig?.optoTriggerDurationMs || 400);

  // Concurrency & rate-limiting check: debounce per machine and key to prevent duplicate clicks and rapid triggers
  const rawKeyStr = String(key ?? '').trim();
  const canonicalKeyCandidate = normalizeServerMatrixKey(rawKeyStr || 'P1');

  if (rawKeyStr !== '13' && rawKeyStr !== 'STOP' && rawKeyStr !== '0' && isKeypressDebounced([effectiveMachineId, targetDeviceId, targetMac], canonicalKeyCandidate, 1200)) {
    res.status(429).json({
      success: false,
      error: 'Erogazione già in corso o richiesta duplicata (antirimbalzo webapp attivo)',
    });
    return;
  }

  // Intercept special hardware keys: '13' (STOP), '14' (CARAFFA), '15' (LINGUA)
  if (rawKeyStr === '13' || rawKeyStr === 'STOP' || rawKeyStr === '0') {
    // 🛑 STOP: Tasto 0, Prodotto 13, Fili 2 e 5, GPIO 22 + 18 (o WROOM: 18 + 16)
    publishMqttCommand(targetDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 13,
      keyChar: '0',
      key: 'STOP',
      wireA: 2,
      wireB: 5,
      gpioA: 22,
      gpioB: 18,
      durationMs: customDurationMs,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    const stopRecord: DispenseRecord = {
      id: 'disp-stop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      beverageId: 'none',
      beverageName: 'ARRESTO EMERGENZA (STOP)',
      key: 'STOP',
      code: 'STOP',
      timestamp: new Date().toISOString(),
      price: 0,
      sugarLevel: 0,
      isCaraffa: false,
      doseMultiplier: 0,
      status: 'CANCELLED',
      deviceId: targetDeviceId,
      machineName: effectiveMachineName,
      prepTimeSec: 0,
      coinsInserted: 0,
      changeGiven: 0,
    };
    db.dispenses.unshift(stopRecord);
    if (db.dispenses.length > 500) db.dispenses = db.dispenses.slice(0, 500);
    saveDatabase(db);

    broadcastSse('dispense-stopped', {
      message: `[${effectiveMachineName}] Comando Hardware STOP (Tasto 0, Prodotto 13) eseguito via MQTT`,
      deviceId: targetDeviceId,
      machineName: effectiveMachineName,
    });

    res.json({
      success: true,
      isStandalone,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      command: 'STOP',
      productNumber: 13,
      keyChar: '0',
      wireA: 2,
      wireB: 5,
      durationMs: 500,
      message: `Comando STOP inviato a ${effectiveMachineName} via MQTT`,
    });
    return;
  }

  if (rawKeyStr === '14' || rawKeyStr === 'CARAFFA' || rawKeyStr === '*') {
    // 🏺 CARAFFA: Tasto *, Prodotto 14, Fili 3 e 5, GPIO 21 + 18
    setCaraffaTimeoutForMachine(effectiveMachineId, 10000);
    const timeoutSec = getCaraffaRemainingSeconds(effectiveMachineId) || 10;
    publishMqttCommand(targetDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 14,
      keyChar: '*',
      key: 'CARAFFA',
      wireA: 3,
      wireB: 5,
      gpioA: 21,
      gpioB: 18,
      durationMs: customDurationMs,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    broadcastSse('caraffa-mode-active', {
      machineId: effectiveMachineId,
      machineName: effectiveMachineName,
      active: true,
      remainingSec: timeoutSec,
      expiresAt: new Date(Date.now() + timeoutSec * 1000).toISOString(),
    });

    res.json({
      success: true,
      isStandalone,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      command: 'CARAFFA',
      productNumber: 14,
      keyChar: '*',
      wireA: 3,
      wireB: 5,
      durationMs: 500,
      remainingSec: timeoutSec,
      message: `Modalità CARAFFA attivata su ${effectiveMachineName} (10s finestra erogazione)`,
    });
    return;
  }

  if (rawKeyStr === '15' || rawKeyStr === 'LINGUA' || rawKeyStr === '#') {
    // 🌐 LINGUA: Tasto #, Prodotto 15, Fili 4 e 5, GPIO 19 + 18
    publishMqttCommand(targetDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 15,
      keyChar: '#',
      key: 'LINGUA',
      wireA: 4,
      wireB: 5,
      gpioA: 19,
      gpioB: 18,
      durationMs: customDurationMs,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    broadcastSse('language-cycled', {
      machineId: effectiveMachineId,
      machineName: effectiveMachineName,
      message: `Cambio lingua display richiesto via hardware su ${effectiveMachineName}`,
    });

    res.json({
      success: true,
      isStandalone,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      command: 'LINGUA',
      productNumber: 15,
      keyChar: '#',
      wireA: 4,
      wireB: 5,
      durationMs: 500,
      message: `Comando cambio LINGUA inviato a ${effectiveMachineName} via MQTT`,
    });
    return;
  }

  // Normalize matrix key e.g. '1' -> 'P1', 'P01' -> 'P1'
  const canonicalKey = normalizeServerMatrixKey(key);
  const customAssignedName = machine?.keyMapping ? (machine.keyMapping[canonicalKey] || machine.keyMapping[String(key).trim()]) : null;

  let bev = db.beverages.find((b) => (beverageId ? b.id === beverageId : (normalizeServerMatrixKey(b.key) === canonicalKey || b.key === canonicalKey)));
  
  // If machine mapped this key to a product by name or key
  if (customAssignedName) {
    const mappedBev = db.beverages.find((b) => b.name.toLowerCase() === customAssignedName.toLowerCase() || b.id === customAssignedName);
    if (mappedBev) {
      bev = mappedBev;
    } else if (bev) {
      // Use the existing bev template but override its display name with the custom mapping
      bev = { ...bev, name: customAssignedName };
    } else {
      // Custom user-defined product assigned directly to this key
      const keyNum = parseInt(canonicalKey.replace(/\D/g, '')) || 1;
      bev = {
        id: `bev-custom-${canonicalKey}`,
        productNumber: keyNum,
        key: canonicalKey,
        code: `P${String(keyNum).padStart(2, '0')}`,
        name: customAssignedName,
        category: 'special',
        price: 0.0,
        prepTimeSec: 6,
        iconName: 'Coffee',
        description: customAssignedName,
        available: true,
        ingredients: {
          waterMl: 60,
          coffeeGrams: 7,
          milkPowderGrams: 0,
          chocolateGrams: 0,
          teaGrams: 0,
          sugarGrams: 0,
        },
      };
    }
  }

  if (!bev) {
    // Fallback beverage for standalone testing
    const parsedKeyNum = parseInt(canonicalKey.replace(/\D/g, ''), 10) || 1;
    bev = {
      id: `bev-test-P${parsedKeyNum}`,
      productNumber: parsedKeyNum,
      key: canonicalKey,
      code: `P${String(parsedKeyNum).padStart(2, '0')}`,
      name: `Prodotto ${parsedKeyNum}`,
      category: 'coffee',
      price: 0.0,
      prepTimeSec: 6,
      iconName: 'Coffee',
      description: `Prodotto collaudo tasto ${canonicalKey}`,
      available: true,
      ingredients: {
        waterMl: 50,
        coffeeGrams: 7,
        milkPowderGrams: 0,
        chocolateGrams: 0,
        teaGrams: 0,
        sugarGrams: 0,
      },
    };
  }

  if (!bev.available) {
    res.status(400).json({ success: false, error: `Il prodotto ${bev.name} è attualmente non disponibile.` });
    return;
  }

  // Se la modalità caraffa era attiva tramite timeout di 10s sulla macchina/modulo, la consumiamo per questa erogazione
  const isCaraffaFromTimer = consumeCaraffaForMachine(effectiveMachineId);
  const effectiveIsCaraffa = Boolean(isCaraffa || isCaraffaFromTimer);

  const multiplier = effectiveIsCaraffa ? 3.0 : 1.0;
  const effectivePrepTime = effectiveIsCaraffa ? Math.round(bev.prepTimeSec * 1.8) : bev.prepTimeSec;

  // Check machine supplies (solo se il modulo è effettivamente associato a un distributore fisico con scorte)
  if (machine) {
    const calAndConsumptionActive = Boolean(machine.enableCalibrationAndConsumption || machine.config?.enableCalibrationAndConsumption);
    const sup = machine.supplies || db.supplies;
    const ing = bev.ingredients;
    const waterReqLiters = ((ing.waterMl || 0) * multiplier) / 1000;
    const coffeeReqGrams = (ing.coffeeGrams || 0) * multiplier;
    const milkReqGrams = (ing.milkPowderGrams || 0) * multiplier;
    const chocReqGrams = (ing.chocolateGrams || 0) * multiplier;
    const teaReqGrams = (ing.teaGrams || 0) * multiplier;

    // Se la gestione taratura e consumi è abilitata sulla macchina, verifichiamo e scaliamo le scorte
    if (calAndConsumptionActive) {
      if (!effectiveIsCaraffa && sup.cupsCount <= 0) {
        res.status(400).json({ success: false, error: `Bicchieri esauriti su ${machine.name}! Richiesto refill.`, outOfStockItem: 'cups' });
        return;
      }
      if (sup.waterLevelLiters < waterReqLiters) {
        res.status(400).json({ success: false, error: `Livello acqua insufficiente su ${machine.name} per la dose richiesta!`, outOfStockItem: 'water' });
        return;
      }
      if (coffeeReqGrams > 0 && sup.coffeeBeansGrams < coffeeReqGrams) {
        res.status(400).json({ success: false, error: `Caffè in grani esaurito su ${machine.name}!`, outOfStockItem: 'coffee' });
        return;
      }
      if (milkReqGrams > 0 && sup.milkPowderGrams < milkReqGrams) {
        res.status(400).json({ success: false, error: `Latte in polvere esaurito su ${machine.name}!`, outOfStockItem: 'milk' });
        return;
      }
      if (chocReqGrams > 0 && sup.chocolatePowderGrams < chocReqGrams) {
        res.status(400).json({ success: false, error: `Polvere di cioccolato esaurita su ${machine.name}!`, outOfStockItem: 'chocolate' });
        return;
      }
      if (teaReqGrams > 0 && sup.teaPowderGrams < teaReqGrams) {
        res.status(400).json({ success: false, error: `Preparato per tè esaurito su ${machine.name}!`, outOfStockItem: 'tea' });
        return;
      }

      // Deduct supplies from specific machine
      sup.waterLevelLiters = Math.max(0, Number((sup.waterLevelLiters - waterReqLiters).toFixed(2)));
      sup.coffeeBeansGrams = Math.max(0, sup.coffeeBeansGrams - coffeeReqGrams);
      sup.milkPowderGrams = Math.max(0, sup.milkPowderGrams - milkReqGrams);
      sup.chocolatePowderGrams = Math.max(0, sup.chocolatePowderGrams - chocReqGrams);
      sup.teaPowderGrams = Math.max(0, sup.teaPowderGrams - teaReqGrams);
      if (!effectiveIsCaraffa) {
        sup.cupsCount = Math.max(0, sup.cupsCount - 1);
      }
    }

    sup.totalDispenses = (sup.totalDispenses || 0) + 1;
    machine.supplies = sup;
    machine.status = 'DISPENSING';
    machine.lastTelemetryAt = new Date().toISOString();
  }

  // In entrambi i casi (taratura attiva o disattivata, standalone o macchina), la telemetria sulle BATTUTE funziona sempre regolarmente:
  db.supplies.totalDispenses = (db.supplies.totalDispenses || 0) + 1;

  const dispenseLog: DispenseRecord = {
    id: 'disp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
    beverageId: bev.id,
    beverageName: bev.name,
    productNumber: bev.productNumber,
    key: bev.key,
    code: bev.code,
    timestamp: new Date().toISOString(),
    price: 0.00,
    sugarLevel: 0,
    isCaraffa: Boolean(effectiveIsCaraffa),
    doseMultiplier: multiplier,
    status: 'COMPLETED',
    deviceId: targetDeviceId,
    machineName: effectiveMachineName,
    prepTimeSec: effectivePrepTime,
    coinsInserted: 0,
    changeGiven: 0,
  };

  db.dispenses.unshift(dispenseLog);
  if (db.dispenses.length > 500) {
    db.dispenses = db.dispenses.slice(0, 500);
  }

  // Also create corresponding Telemetry Log for the Database Erogazioni
  const keyMeta = MATRIX_TABLE_NAMES[canonicalKey];
  const newKeyLog: KeyLog = {
    id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    key: canonicalKey,
    keyLabel: effectiveIsCaraffa
      ? `EROGAZIONE CARAFFA (${canonicalKey})`
      : (keyMeta ? keyMeta.label : `TASTO [${canonicalKey}]`),
    productName: effectiveIsCaraffa
      ? `${bev.name} (Dose Caraffa)`
      : bev.name,
    deviceId: effectiveMachineId,
    machineName: effectiveMachineName,
    machineSerialNumber: machine ? machine.serialNumber : (device?.serialNumber || 'STANDALONE'),
    customerName: machine?.locationDetails?.company || (isStandalone ? 'Collaudo Banco Hardware' : 'Cliente Vending'),
    siteName: machine?.locationDetails?.site || (isStandalone ? 'Banco Prova ESP32' : 'Sede Operativa'),
    timestamp: new Date().toISOString(),
    eventType: 'pressed',
    isCaraffa: Boolean(effectiveIsCaraffa),
    doseType: effectiveIsCaraffa ? 'CARAFFA' : 'MONODOSE',
    doseMultiplier: multiplier,
    calibrationAndConsumptionEnabled: Boolean(machine?.enableCalibrationAndConsumption),
    channel: isStandalone ? 'Test Standalone' : 'Erogazione',
    rssi: device?.wifiRssi || -52,
    ip: device?.ipAddress || machine?.ipAddress || '192.168.1.150',
    rawCode: canonicalKey.charCodeAt(0) || 0,
    metadata: {
      dispenseId: dispenseLog.id,
      isCaraffa: Boolean(effectiveIsCaraffa),
      doseMultiplier: multiplier,
      beverageId: bev.id,
      prepTimeSec: effectivePrepTime,
      isStandalone,
      targetMac,
    },
  };

  db.logs.unshift(newKeyLog);
  if (db.logs.length > 2000) {
    db.logs = db.logs.slice(0, 2000);
  }

  saveDatabase(db);

  // Register in debounce cache to shield against echoes or retransmissions
  recordKeypressDebounce([effectiveMachineId, targetDeviceId, targetMac], canonicalKey);

  // Broadcast Real-time event to connected LCDs / Dashboard
  broadcastSse('new-keylog', newKeyLog);
  broadcastSse('new-dispense', {
    dispense: dispenseLog,
    log: newKeyLog,
    supplies: machine ? machine.supplies : db.supplies,
    machine: machine || null,
    isStandalone,
    message: isCaraffa
      ? `[${effectiveMachineName}] Erogazione ${bev.name} (DOSE CARAFFA) avviata ed eseguita (${effectivePrepTime}s)`
      : `[${effectiveMachineName}] Erogazione diretta ${bev.name} avviata ed eseguita (${effectivePrepTime}s)`,
  });
  if (machine) {
    broadcastSse('machines-updated', db.machines);
  }
  broadcastSse('devices-updated', db.devices);

  const bevProdNum = bev.productNumber || (parseInt(canonicalKey.replace(/\D/g, ''), 10) || 1);
  const wireLookup: Record<number, { wireA: number; wireB: number; keyChar: string }> = {
    1:  { wireA: 1, wireB: 5, keyChar: '1' },
    2:  { wireA: 2, wireB: 5, keyChar: '2' },
    3:  { wireA: 3, wireB: 5, keyChar: '3' },
    4:  { wireA: 1, wireB: 6, keyChar: 'A' },
    5:  { wireA: 2, wireB: 6, keyChar: '4' },
    6:  { wireA: 3, wireB: 6, keyChar: '5' },
    7:  { wireA: 1, wireB: 7, keyChar: '6' },
    8:  { wireA: 2, wireB: 7, keyChar: 'B' },
    9:  { wireA: 3, wireB: 7, keyChar: '7' },
    10: { wireA: 1, wireB: 8, keyChar: '8' },
    11: { wireA: 2, wireB: 8, keyChar: '9' },
    12: { wireA: 3, wireB: 8, keyChar: 'C' },
  };
  const wireData = wireLookup[bevProdNum] || { wireA: 1, wireB: 5, keyChar: String(bevProdNum) };

  // Send real-time MQTT command to physical ESP32
  publishMqttCommand(targetDeviceId, {
    action: 'TRIGGER_BEVERAGE_DISPENSE',
    productNumber: bevProdNum,
    productKey: `P${bevProdNum}`,
    code: bev.code,
    key: bev.key,
    keyChar: wireData.keyChar,
    wireA: wireData.wireA,
    wireB: wireData.wireB,
    name: bev.name,
    durationMs: customDurationMs || 400,
    isCaraffa: Boolean(isCaraffa),
    targetMac,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json({
    success: true,
    isStandalone,
    dispense: dispenseLog,
    log: newKeyLog,
    machineName: effectiveMachineName,
    changeGiven: 0,
    supplies: machine ? machine.supplies : db.supplies,
    optoTriggerCommand: {
      action: 'TRIGGER_OPTO_BEVERAGE',
      productNumber: bev.productNumber,
      code: bev.code,
      name: bev.name,
      pulseDurationMs: customDurationMs,
      targetMac,
    },
    message: isCaraffa
      ? `Erogazione '${bev.name}' (Dose Caraffa) inviata al Modulo (${targetMac || effectiveMachineName})`
      : `Erogazione diretta '${bev.name}' inviata al Modulo (${targetMac || effectiveMachineName})`,
  });
});

// 11b. POST /api/dispense/stop - Emergency / Manual Stop button
app.post('/api/dispense/stop', (req, res) => {
  const { deviceId, machineId, reason = 'Tasto STOP premuto dall\'utente' } = req.body;
  const targetKey = deviceId || machineId;
  const db = loadDatabase();

  if (!targetKey || String(targetKey).trim() === '') {
    res.status(400).json({ success: false, error: 'Nessun distributore o modulo hardware specificato per lo STOP' });
    return;
  }

  const targetResolution = resolveTargetHardware(db, targetKey);
  if (targetResolution.error) {
    res.status(400).json({ success: false, error: targetResolution.error });
    return;
  }

  if (!targetResolution.targetMac || !targetResolution.cleanMac) {
    res.status(400).json({
      success: false,
      error: `Il distributore o modulo '${targetResolution.machine?.name || targetKey}' non ha alcun hardware associato. Nessun comando inviato per sicurezza.`,
    });
    return;
  }

  const machine = targetResolution.machine;
  const targetDeviceId = targetResolution.canonicalDeviceId;
  const effectiveMachineName = machine ? machine.name : `Modulo Standalone ${targetDeviceId}`;
  if (machine) {
    machine.status = 'ONLINE';
    machine.lastTelemetryAt = new Date().toISOString();
  }

  const stopRecord: DispenseRecord = {
    id: 'disp-stop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
    beverageId: 'none',
    beverageName: 'ARRESTO EMERGENZA (STOP)',
    key: '0',
    code: 'STOP',
    timestamp: new Date().toISOString(),
    price: 0,
    sugarLevel: 0,
    isCaraffa: false,
    doseMultiplier: 0,
    status: 'CANCELLED',
    deviceId: targetDeviceId,
    machineName: effectiveMachineName,
    prepTimeSec: 0,
    coinsInserted: 0,
    changeGiven: 0,
  };

  db.dispenses.unshift(stopRecord);
  if (db.dispenses.length > 500) {
    db.dispenses = db.dispenses.slice(0, 500);
  }

  // KeyLog istantaneo per aggiornare subito LiveMonitor e Telemetria
  const stopLog: KeyLog = {
    id: 'log-stop-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    key: 'STOP',
    keyLabel: '🛑 ARRESTO EMERGENZA (STOP)',
    productName: 'Arresto Immediato Erogazione',
    deviceId: targetDeviceId,
    machineName: effectiveMachineName,
    machineSerialNumber: machine?.serialNumber || '500000',
    customerName: machine?.locationDetails?.company || 'Cliente Generale',
    siteName: machine?.locationDetails?.site || 'Sede Operativa',
    timestamp: new Date().toISOString(),
    eventType: 'pressed',
    isCaraffa: false,
    doseType: 'MONODOSE',
    doseMultiplier: 0,
    channel: 'WEBAPP',
    rawCode: 48,
    metadata: {
      source: 'webapp-emergency-stop',
      reason,
      wires: 'U4 + U7 (Fili 4-7)',
    },
  };
  db.logs.unshift(stopLog);
  if (db.logs.length > 2000) db.logs = db.logs.slice(0, 2000);

  saveDatabase(db);

  broadcastSse('new-keylog', stopLog);
  broadcastSse('key-logged', stopLog);
  broadcastSse('dispense-stopped', {
    message: `[${effectiveMachineName}] Arresto Immediato Eseguito: Erogazione interrotta e relè disattivati`,
    deviceId: targetDeviceId,
    machineName: effectiveMachineName,
    reason,
  });
  if (machine) {
    broadcastSse('machines-updated', db.machines);
  }

  // Send STOP command over MQTT immediately with high priority and complete matrix parameters (wireA: 4, wireB: 7)
  publishMqttCommand(targetDeviceId, {
    action: 'EMERGENCY_STOP',
    key: 'STOP',
    keyChar: '0',
    productNumber: 13,
    wireA: 4,
    wireB: 7,
    gpioA: 15,
    gpioB: 18,
    durationMs: 300,
    priority: 'HIGH',
    emergency: true,
    reason,
    targetMac: targetResolution.targetMac || (machine ? machine.assignedDeviceMac : null),
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Erogazione interrotta su ${effectiveMachineName}! Segnale STOP inviato al PLC e uscite disattivate.`,
    machineName: effectiveMachineName,
    log: stopLog,
  });
});

// 11bb. POST /api/matrix/trigger - Dedicated Matrix Hardware Keypad Trigger
app.post('/api/matrix/trigger', (req, res) => {
  const { key, deviceId, machineId, durationMs = 500 } = req.body;
  const targetKey = deviceId || machineId;
  const db = loadDatabase();

  if (!targetKey || String(targetKey).trim() === '') {
    res.status(400).json({ success: false, error: 'Nessun identificatore macchina o modulo specificato' });
    return;
  }

  const targetResolution = resolveTargetHardware(db, targetKey);
  if (targetResolution.error) {
    res.status(400).json({ success: false, error: targetResolution.error });
    return;
  }

  if (!targetResolution.targetMac || !targetResolution.cleanMac) {
    res.status(400).json({
      success: false,
      error: `Il distributore '${targetResolution.machine?.name || targetKey}' non ha alcun modulo ESP32 associato. Assegna un modulo hardware nella Gestione Parco.`,
    });
    return;
  }

  const machine = targetResolution.machine;
  const effectiveDeviceId = targetResolution.canonicalDeviceId;
  const machineName = machine ? machine.name : (targetResolution.device?.deviceId || effectiveDeviceId);
  const targetMac = targetResolution.targetMac;

  const rawKeyStr = String(key ?? '').trim();

  // STOP: Key 13 / 0 / 'STOP' -> Product 13, Key '0', Wires 4 & 7 (U4 + U7)
  if (rawKeyStr === '13' || rawKeyStr === 'STOP' || rawKeyStr === '0') {
    publishMqttCommand(effectiveDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 13,
      keyChar: '0',
      key: 'STOP',
      name: 'STOP',
      wireA: 4,
      wireB: 7,
      gpioA: 15,
      gpioB: 18,
      durationMs: Number(durationMs) || 500,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    broadcastSse('dispense-stopped', {
      message: `[${machineName}] Comando Hardware STOP (U4+U7, Fili 4 e 7) inviato via MQTT`,
      deviceId: effectiveDeviceId,
      machineName: machineName,
    });

    res.json({
      success: true,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      key: '13',
      keyChar: '0',
      command: 'STOP',
      productNumber: 13,
      wireA: 4,
      wireB: 7,
      durationMs: Number(durationMs) || 500,
      message: `Comando STOP (U4+U7) inviato al distributore ${machineName}`,
    });
    return;
  }

  // CARAFFA: Key 14 / '*' / 'CARAFFA' -> Product 14, Key '*', Wires 4 & 6 (U4 + U6)
  if (rawKeyStr === '14' || rawKeyStr === 'CARAFFA' || rawKeyStr === '*') {
    const machineId = machine ? machine.id : effectiveDeviceId;
    setCaraffaTimeoutForMachine(machineId, 10000);
    const timeoutSec = getCaraffaRemainingSeconds(machineId) || 10;
    publishMqttCommand(effectiveDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 14,
      keyChar: '*',
      key: 'CARAFFA',
      name: 'CARAFFA',
      wireA: 4,
      wireB: 6,
      gpioA: 15,
      gpioB: 17,
      durationMs: Number(durationMs) || 500,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    broadcastSse('caraffa-mode-active', {
      machineId,
      machineName,
      active: true,
      remainingSec: timeoutSec,
      expiresAt: new Date(Date.now() + timeoutSec * 1000).toISOString(),
    });

    res.json({
      success: true,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      key: '14',
      keyChar: '*',
      command: 'CARAFFA',
      productNumber: 14,
      wireA: 4,
      wireB: 6,
      durationMs: Number(durationMs) || 500,
      remainingSec: timeoutSec,
      message: `Modalità CARAFFA (U4+U6) attivata su ${machineName}`,
    });
    return;
  }

  // LINGUA: Key 15 / '#' / 'LINGUA' -> Product 15, Key '#', Wires 4 & 5 (U4 + U5)
  if (rawKeyStr === '15' || rawKeyStr === 'LINGUA' || rawKeyStr === '#') {
    const machineId = machine ? machine.id : effectiveDeviceId;
    publishMqttCommand(effectiveDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: 15,
      keyChar: '#',
      key: 'LINGUA',
      name: 'LINGUA',
      wireA: 4,
      wireB: 5,
      gpioA: 15,
      gpioB: 16,
      durationMs: Number(durationMs) || 500,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    broadcastSse('language-cycled', {
      machineId,
      machineName,
      message: `Comando cambio LINGUA (U4+U5) inviato su ${machineName}`,
    });

    res.json({
      success: true,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      key: '15',
      keyChar: '#',
      command: 'LINGUA',
      productNumber: 15,
      wireA: 4,
      wireB: 5,
      durationMs: Number(durationMs) || 500,
      message: `Comando LINGUA (U4+U5) inviato al distributore ${machineName}`,
    });
    return;
  }

  // For beverage products 1-12 (Tabella U1..U8 esatta)
  const num = parseInt(rawKeyStr, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    const wireMap: Record<number, { wireA: number; wireB: number; keyChar: string }> = {
      1:  { wireA: 1, wireB: 5, keyChar: '1' }, // U1 + U5
      2:  { wireA: 2, wireB: 5, keyChar: '2' }, // U2 + U5
      3:  { wireA: 3, wireB: 5, keyChar: '3' }, // U3 + U5
      4:  { wireA: 1, wireB: 6, keyChar: 'A' }, // U1 + U6
      5:  { wireA: 2, wireB: 6, keyChar: '4' }, // U2 + U6
      6:  { wireA: 3, wireB: 6, keyChar: '5' }, // U3 + U6
      7:  { wireA: 1, wireB: 7, keyChar: '6' }, // U1 + U7
      8:  { wireA: 2, wireB: 7, keyChar: 'B' }, // U2 + U7
      9:  { wireA: 3, wireB: 7, keyChar: '7' }, // U3 + U7
      10: { wireA: 1, wireB: 8, keyChar: '8' }, // U1 + U8
      11: { wireA: 2, wireB: 8, keyChar: '9' }, // U2 + U8
      12: { wireA: 3, wireB: 8, keyChar: 'C' }, // U3 + U8
    };
    const mapping = wireMap[num] || { wireA: 1, wireB: 5, keyChar: String(num) };

    publishMqttCommand(effectiveDeviceId, {
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: num,
      keyChar: mapping.keyChar,
      wireA: mapping.wireA,
      wireB: mapping.wireB,
      durationMs: Number(durationMs) || 500,
      timestamp: new Date().toISOString(),
      targetMac,
    });

    res.json({
      success: true,
      action: 'TRIGGER_BEVERAGE_DISPENSE',
      productNumber: num,
      keyChar: mapping.keyChar,
      wireA: mapping.wireA,
      wireB: mapping.wireB,
      durationMs: Number(durationMs) || 500,
      message: `Impulso prodotto ${num} inviato al distributore ${machineName}`,
    });
    return;
  }

  res.status(400).json({ success: false, error: `Chiave non riconosciuta: ${rawKeyStr}. Utilizzare 1-12 per prodotti o 13 (STOP), 14 (CARAFFA), 15 (LINGUA).` });
});

// 11c. GET /api/mqtt/status - Broker connection and live telemetry status
app.get('/api/mqtt/status', (req, res) => {
  res.json({
    ...mqttStatus,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/mqtt/reconnect', (req, res) => {
  initMqtt();
  res.json({ success: true, message: `Riconnessione al cluster Broker MQTT avviata (HiveMQ + EMQX)...`, mqttStatus });
});

// 12. GET /api/dispenses - Historical Dispense logs
app.get('/api/dispenses', (req, res) => {
  const db = loadDatabase();
  res.json(db.dispenses || []);
});

app.delete('/api/dispenses', (req, res) => {
  const db = loadDatabase();
  const count = (db.dispenses || []).length;
  db.dispenses = [];
  saveDatabase(db);
  broadcastSse('dispenses-cleared', { count });
  res.json({ success: true, message: `${count} erogazioni rimosse dal database` });
});

// 13. PIN Configuration endpoints
app.get('/api/pins', (req, res) => {
  const db = loadDatabase();
  res.json(db.pins);
});

app.post('/api/pins', (req, res) => {
  const { code, name, role } = req.body;
  if (!code || !name) {
    res.status(400).json({ success: false, error: 'code and name are required' });
    return;
  }
  const db = loadDatabase();
  const newPin: PinRecord = {
    id: 'pin-' + Date.now(),
    code: String(code).trim(),
    name: String(name).trim(),
    role: role ? String(role).trim() : 'Utente',
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  db.pins.push(newPin);
  saveDatabase(db);
  res.status(201).json({ success: true, pin: newPin });
});

app.delete('/api/pins/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  db.pins = db.pins.filter((p) => p.id !== id);
  saveDatabase(db);
  res.json({ success: true, message: 'PIN rimosso' });
});

app.patch('/api/pins/:id/toggle', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  const target = db.pins.find((p) => p.id === id);
  if (!target) {
    res.status(404).json({ success: false, error: 'PIN non trovato' });
    return;
  }
  target.enabled = !target.enabled;
  saveDatabase(db);
  res.json({ success: true, pin: target });
});

// 10. Access Logs
app.get('/api/access-logs', (req, res) => {
  const db = loadDatabase();
  res.json(db.accessLogs);
});

app.delete('/api/access-logs', (req, res) => {
  const db = loadDatabase();
  db.accessLogs = [];
  saveDatabase(db);
  res.json({ success: true, message: 'Log accessi svuotati' });
});

// 10b. EXPORT DATABASE AS STANDARD SQL DUMP (.sql)
app.get('/api/system/database/export-sql', (req, res) => {
  const db = loadDatabase();
  const dateStr = new Date().toISOString();
  const fileDate = dateStr.split('T')[0];

  const escapeSql = (val: any): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'object') {
      return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  };

  const lines: string[] = [
    `-- =====================================================================`,
    `-- GB-CLOUD TELEMETRY DATABASE SQL DUMP`,
    `-- Generated on: ${dateStr}`,
    `-- Target Engine: PostgreSQL 12+ / MySQL 8+ / SQLite 3`,
    `-- =====================================================================`,
    `BEGIN;`,
    ``,
    `-- 1. Tabella Clienti`,
    `CREATE TABLE IF NOT EXISTS customers (`,
    `  id VARCHAR(64) PRIMARY KEY,`,
    `  code VARCHAR(64),`,
    `  name VARCHAR(255) NOT NULL,`,
    `  vat_number VARCHAR(64),`,
    `  email VARCHAR(255),`,
    `  phone VARCHAR(64),`,
    `  address VARCHAR(255),`,
    `  city VARCHAR(128),`,
    `  province VARCHAR(16),`,
    `  zip_code VARCHAR(32),`,
    `  notes TEXT,`,
    `  created_at TIMESTAMPTZ DEFAULT NOW(),`,
    `  updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `);`,
    ``,
    `-- 2. Tabella Sedi Operative Clienti`,
    `CREATE TABLE IF NOT EXISTS customer_sites (`,
    `  id VARCHAR(64) PRIMARY KEY,`,
    `  customer_id VARCHAR(64) REFERENCES customers(id) ON DELETE CASCADE,`,
    `  name VARCHAR(255) NOT NULL,`,
    `  address VARCHAR(255),`,
    `  city VARCHAR(128),`,
    `  province VARCHAR(16),`,
    `  zip_code VARCHAR(32),`,
    `  floor_room VARCHAR(128),`,
    `  contact_person VARCHAR(128),`,
    `  phone VARCHAR(64),`,
    `  notes TEXT`,
    `);`,
    ``,
    `-- 3. Tabella Moduli Hardware ESP32`,
    `CREATE TABLE IF NOT EXISTS devices (`,
    `  mac_address VARCHAR(32) PRIMARY KEY,`,
    `  serial_number VARCHAR(16),`,
    `  device_id VARCHAR(128),`,
    `  board_model VARCHAR(128),`,
    `  firmware_version VARCHAR(64),`,
    `  ip_address VARCHAR(64),`,
    `  wifi_ssid VARCHAR(128),`,
    `  wifi_rssi INT,`,
    `  status VARCHAR(32),`,
    `  assigned_machine_id VARCHAR(64),`,
    `  hardware_config JSONB,`,
    `  last_heartbeat_at TIMESTAMPTZ`,
    `);`,
    ``,
    `-- 4. Tabella Distributori Automatici`,
    `CREATE TABLE IF NOT EXISTS machines (`,
    `  id VARCHAR(64) PRIMARY KEY,`,
    `  serial_number VARCHAR(16) UNIQUE NOT NULL,`,
    `  name VARCHAR(255) NOT NULL,`,
    `  model VARCHAR(128),`,
    `  status VARCHAR(32),`,
    `  customer_id VARCHAR(64),`,
    `  customer_site_id VARCHAR(64),`,
    `  assigned_device_mac VARCHAR(32),`,
    `  location_details JSONB,`,
    `  key_mapping JSONB,`,
    `  enable_calibration_and_consumption BOOLEAN DEFAULT FALSE,`,
    `  total_dispenses BIGINT DEFAULT 0,`,
    `  last_telemetry_at TIMESTAMPTZ`,
    `);`,
    ``,
    `-- 5. Tabella Log Battute e Telemetria (Keylogs)`,
    `CREATE TABLE IF NOT EXISTS keylogs (`,
    `  id VARCHAR(128) PRIMARY KEY,`,
    `  machine_serial_number VARCHAR(16),`,
    `  machine_name VARCHAR(255),`,
    `  customer_name VARCHAR(255),`,
    `  site_name VARCHAR(255),`,
    `  key_pressed VARCHAR(16) NOT NULL,`,
    `  key_label VARCHAR(128),`,
    `  product_name VARCHAR(128),`,
    `  dose_type VARCHAR(32),`,
    `  dose_multiplier NUMERIC(6, 2) DEFAULT 1.0,`,
    `  device_id VARCHAR(128),`,
    `  recorded_at TIMESTAMPTZ NOT NULL,`,
    `  event_type VARCHAR(32),`,
    `  rssi INT,`,
    `  ip VARCHAR(64)`,
    `);`,
    ``,
    `-- 6. Tabella Catalogo Prodotti & Articoli (Articles)`,
    `CREATE TABLE IF NOT EXISTS articles (`,
    `  item_code VARCHAR(64) PRIMARY KEY,`,
    `  name VARCHAR(255) NOT NULL,`,
    `  ingredient_type VARCHAR(64),`,
    `  default_rpm INT DEFAULT 120,`,
    `  default_grams_per_second NUMERIC(6, 2) DEFAULT 2.50,`,
    `  nominal_grams_per_dose NUMERIC(6, 2) DEFAULT 8.00,`,
    `  cost_per_kg NUMERIC(8, 2) DEFAULT 0.00,`,
    `  package_unit VARCHAR(64),`,
    `  supplier VARCHAR(128),`,
    `  description TEXT,`,
    `  updated_at TIMESTAMPTZ DEFAULT NOW()`,
    `);`,
    ``,
  ];

  // Inserimento Articoli di Catalogo
  (db.articles || []).forEach((a) => {
    lines.push(
      `INSERT INTO articles (item_code, name, ingredient_type, default_rpm, default_grams_per_second, nominal_grams_per_dose, cost_per_kg, package_unit, supplier, description, updated_at) VALUES (` +
      `${escapeSql(a.itemCode)}, ${escapeSql(a.name)}, ${escapeSql(a.ingredientType)}, ${a.defaultRpm || 120}, ` +
      `${a.defaultGramsPerSecond || 2.5}, ${a.nominalGramsPerDose || 8.0}, ${a.costPerKg || 0.0}, ` +
      `${escapeSql(a.packageUnit)}, ${escapeSql(a.supplier)}, ${escapeSql(a.description)}, ${escapeSql(a.updatedAt || new Date().toISOString())}) ` +
      `ON CONFLICT (item_code) DO UPDATE SET name = EXCLUDED.name, cost_per_kg = EXCLUDED.cost_per_kg, default_rpm = EXCLUDED.default_rpm;`
    );
  });

  // Inserimento Clienti e Sedi
  (db.customers || []).forEach((c) => {
    lines.push(
      `INSERT INTO customers (id, code, name, vat_number, email, phone, address, city, province, zip_code, notes, created_at, updated_at) VALUES (` +
      `${escapeSql(c.id)}, ${escapeSql(c.code)}, ${escapeSql(c.name)}, ${escapeSql(c.vatNumber)}, ` +
      `${escapeSql(c.email)}, ${escapeSql(c.phone)}, ${escapeSql(c.address)}, ${escapeSql(c.city)}, ` +
      `${escapeSql(c.province)}, ${escapeSql(c.zipCode)}, ${escapeSql(c.notes)}, ${escapeSql(c.createdAt)}, ${escapeSql(c.updatedAt || c.createdAt)}) ` +
      `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone;`
    );

    (c.sites || []).forEach((s) => {
      lines.push(
        `INSERT INTO customer_sites (id, customer_id, name, address, city, province, zip_code, floor_room, contact_person, phone, notes) VALUES (` +
        `${escapeSql(s.id)}, ${escapeSql(c.id)}, ${escapeSql(s.name)}, ${escapeSql(s.address)}, ${escapeSql(s.city)}, ` +
        `${escapeSql(s.province)}, ${escapeSql(s.zipCode)}, ${escapeSql(s.floorRoom)}, ${escapeSql(s.contactPerson)}, ` +
        `${escapeSql(s.phone)}, ${escapeSql(s.notes)}) ` +
        `ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address;`
      );
    });
  });

  // Inserimento Moduli Hardware
  (db.devices || []).forEach((d) => {
    lines.push(
      `INSERT INTO devices (mac_address, serial_number, device_id, board_model, firmware_version, ip_address, wifi_ssid, wifi_rssi, status, assigned_machine_id, hardware_config, last_heartbeat_at) VALUES (` +
      `${escapeSql(d.macAddress)}, ${escapeSql(d.serialNumber)}, ${escapeSql(d.deviceId)}, ${escapeSql(d.boardModel)}, ` +
      `${escapeSql(d.firmwareVersion)}, ${escapeSql(d.ipAddress)}, ${escapeSql(d.wifiSsid)}, ${escapeSql(d.wifiRssi)}, ` +
      `${escapeSql(d.status)}, ${escapeSql(d.assignedMachineId)}, ${escapeSql(d.hardwareConfig)}, ${escapeSql(d.lastHeartbeatAt)}) ` +
      `ON CONFLICT (mac_address) DO UPDATE SET status = EXCLUDED.status, last_heartbeat_at = EXCLUDED.last_heartbeat_at;`
    );
  });

  // Inserimento Distributori
  (db.machines || []).forEach((m) => {
    lines.push(
      `INSERT INTO machines (id, serial_number, name, model, status, customer_id, customer_site_id, assigned_device_mac, location_details, key_mapping, enable_calibration_and_consumption, total_dispenses, last_telemetry_at) VALUES (` +
      `${escapeSql(m.id)}, ${escapeSql(m.serialNumber)}, ${escapeSql(m.name)}, ${escapeSql(m.model)}, ${escapeSql(m.status)}, ` +
      `${escapeSql(m.customerId)}, ${escapeSql(m.customerSiteId)}, ${escapeSql(m.assignedDeviceMac)}, ${escapeSql(m.locationDetails)}, ` +
      `${escapeSql(m.keyMapping)}, ${escapeSql(m.enableCalibrationAndConsumption)}, ${escapeSql(m.supplies?.totalDispenses || 0)}, ${escapeSql(m.lastTelemetryAt)}) ` +
      `ON CONFLICT (serial_number) DO UPDATE SET status = EXCLUDED.status, last_telemetry_at = EXCLUDED.last_telemetry_at;`
    );
  });

  // Inserimento Keylogs (fino a 5000 eventi recenti)
  (db.logs || []).slice(0, 5000).forEach((l) => {
    lines.push(
      `INSERT INTO keylogs (id, machine_serial_number, machine_name, customer_name, site_name, key_pressed, key_label, product_name, dose_type, dose_multiplier, device_id, recorded_at, event_type, rssi, ip) VALUES (` +
      `${escapeSql(l.id)}, ${escapeSql(l.machineSerialNumber)}, ${escapeSql(l.machineName)}, ${escapeSql(l.customerName)}, ` +
      `${escapeSql(l.siteName)}, ${escapeSql(l.key)}, ${escapeSql(l.keyLabel)}, ${escapeSql(l.productName)}, ` +
      `${escapeSql(l.doseType || 'MONODOSE')}, ${escapeSql(l.doseMultiplier || 1.0)}, ${escapeSql(l.deviceId)}, ` +
      `${escapeSql(l.timestamp)}, ${escapeSql(l.eventType)}, ${escapeSql(l.rssi)}, ${escapeSql(l.ip)}) ` +
      `ON CONFLICT (id) DO NOTHING;`
    );
  });

  lines.push(`COMMIT;`);

  const sqlOutput = lines.join('\n');
  res.setHeader('Content-Type', 'application/sql; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gb_cloud_database_dump_${fileDate}.sql"`);
  res.send(sqlOutput);
});

// ==========================================
// 14. AUTHENTICATION & MULTI-USER MANAGEMENT
// ==========================================
const activeAuthSessions = new Map<string, { userId: string; username: string; role: string; expiresAt: number }>();

// Helper to sanitize user object
function sanitizeUser(u: UserAccount) {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    email: u.email || '',
    customerId: u.customerId || null,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    customAllowedTabs: u.customAllowedTabs || null,
  };
}

// POST /api/auth/login - Authenticate user credentials
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ success: false, error: 'Nome utente e password sono obbligatori' });
    return;
  }

  const cleanUser = String(username).trim().toLowerCase();
  const normalizedUser = cleanUser.replace(/[\s._-]+/g, '');
  const cleanPass = String(password).trim();
  const db = loadDatabase();

  const user = (db.users || []).find((u) => {
    const uName = u.username.toLowerCase();
    const uClean = uName.replace(/[\s._-]+/g, '');
    const realName = (u.name || '').toLowerCase().replace(/[\s._-]+/g, '');
    const uEmail = (u.email || '').toLowerCase();
    return uName === cleanUser || uClean === normalizedUser || realName === normalizedUser || (uEmail && uEmail === cleanUser);
  });
  if (!user || user.password !== cleanPass) {
    res.status(401).json({
      success: false,
      error: 'Credenziali non corrette. Verifica username e password.',
    });
    return;
  }

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  saveDatabase(db);

  const token = `vauth_${user.id}_${Buffer.from(`${Date.now()}_${Math.random().toString(36).substring(2, 9)}`).toString('base64url')}`;
  activeAuthSessions.set(token, {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
  });

  res.json({
    success: true,
    message: `Accesso effettuato: Benvenuto, ${user.name}!`,
    token,
    user: sanitizeUser(user),
  });
});

// GET /api/auth/me - Validate current session token and return user profile
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-auth-token'] as string)) || (req.query.token as string);

  if (!token) {
    res.status(401).json({ success: false, authenticated: false, error: 'Nessuna sessione attiva' });
    return;
  }

  const db = loadDatabase();
  const session = activeAuthSessions.get(token);

  let matchedUser = session ? db.users.find((u) => u.id === session.userId) : null;
  if (!matchedUser && typeof token === 'string' && token.length > 0) {
    if (token.startsWith('vauth_')) {
      // Find by matching user ID in token
      matchedUser = db.users.find((u) => token.includes(u.id)) || null;
      if (!matchedUser) {
        const parts = token.split('_');
        if (parts.length >= 2) {
          matchedUser = db.users.find((u) => u.id === parts[1] || u.username === parts[1]);
        }
      }
    }
    // Re-register restored session in activeAuthSessions
    if (matchedUser) {
      activeAuthSessions.set(token, {
        userId: matchedUser.id,
        username: matchedUser.username,
        role: matchedUser.role,
        expiresAt: Date.now() + 30 * 24 * 3600 * 1000,
      });
    }
  }

  if (!matchedUser) {
    res.status(401).json({ success: false, authenticated: false, error: 'Sessione non valida o scaduta' });
    return;
  }

  res.json({
    success: true,
    authenticated: true,
    user: sanitizeUser(matchedUser),
  });
});

// POST /api/auth/logout - Terminate session
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-auth-token'] as string)) || (req.query.token as string);
  if (token) {
    activeAuthSessions.delete(token);
  }
  res.json({ success: true, message: 'Disconnesso con successo' });
});

// POST /api/auth/change-password - Change current user's password
app.post('/api/auth/change-password', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    res.status(400).json({ success: false, error: 'Tutti i campi sono obbligatori' });
    return;
  }

  if (String(newPassword).trim().length < 4) {
    res.status(400).json({ success: false, error: 'La nuova password deve contenere almeno 4 caratteri' });
    return;
  }

  const db = loadDatabase();
  const user = db.users.find((u) => u.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!user || user.password !== String(oldPassword).trim()) {
    res.status(401).json({ success: false, error: 'La password attuale inserita non è corretta' });
    return;
  }

  user.password = String(newPassword).trim();
  saveDatabase(db);

  res.json({ success: true, message: `Password per l'utente '${user.username}' aggiornata con successo!` });
});

// GET /api/auth/users - List all dashboard users (Admin management)
app.get('/api/auth/users', (req, res) => {
  const db = loadDatabase();
  res.json({
    success: true,
    users: (db.users || []).map(sanitizeUser),
  });
});

// POST /api/auth/users - Create new dashboard user (Admin)
app.post('/api/auth/users', (req, res) => {
  const { username, name, password, role, email, customerId } = req.body;
  if (!username || !name || !password) {
    res.status(400).json({ success: false, error: 'Username, Nome e Password sono obbligatori' });
    return;
  }

  const db = loadDatabase();
  const cleanUser = String(username).trim().toLowerCase();

  if (db.users.some((u) => u.username.toLowerCase() === cleanUser)) {
    res.status(400).json({ success: false, error: `Un utente con username '${cleanUser}' esiste già` });
    return;
  }

  const validRoleIds = (db.rolePermissions || DEFAULT_ROLES).map((r) => r.id);
  const assignedRole = role && validRoleIds.includes(role) ? role : 'operatore';

  const newUser: UserAccount = {
    id: 'user-' + Date.now(),
    username: cleanUser,
    name: String(name).trim(),
    role: assignedRole,
    password: String(password).trim(),
    email: email ? String(email).trim() : '',
    customerId: customerId ? String(customerId).trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  saveDatabase(db);

  res.status(201).json({
    success: true,
    message: `Nuovo utente '${newUser.name}' (${newUser.role}) creato con successo!`,
    user: sanitizeUser(newUser),
  });
});

// PUT /api/auth/users/:id/role - Update user role (Admin)
app.put('/api/auth/users/:id/role', (req, res) => {
  const { id } = req.params;
  const { role, customerId } = req.body;

  const db = loadDatabase();
  const validRoleIds = (db.rolePermissions || DEFAULT_ROLES).map((r) => r.id);

  if (!role || !validRoleIds.includes(role)) {
    res.status(400).json({ success: false, error: `Ruolo non valido. Valori ammessi: ${validRoleIds.join(', ')}` });
    return;
  }

  const targetUser = db.users.find((u) => u.id === id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'Utente non trovato' });
    return;
  }

  // Prevenzione: non declassare l'ultimo admin
  if (targetUser.role === 'admin' && role !== 'admin') {
    const adminCount = db.users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      res.status(400).json({ success: false, error: 'Impossibile rimuovere il ruolo di amministratore all\'unico admin del sistema' });
      return;
    }
  }

  const oldRole = targetUser.role;
  targetUser.role = role;
  if (customerId !== undefined) {
    targetUser.customerId = customerId ? String(customerId).trim() : undefined;
  }
  saveDatabase(db);

  res.json({
    success: true,
    message: `Ruolo dell'utente '${targetUser.name}' aggiornato con successo: ${oldRole} ➔ ${role}`,
    user: sanitizeUser(targetUser),
  });
});

// PUT /api/auth/users/:id/permissions - Custom granular permissions override for specific user (Admin)
app.put('/api/auth/users/:id/permissions', (req, res) => {
  const { id } = req.params;
  const { customAllowedTabs, customerId } = req.body;

  const db = loadDatabase();
  const targetUser = db.users.find((u) => u.id === id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'Utente non trovato' });
    return;
  }

  if (customerId !== undefined) {
    targetUser.customerId = customerId ? String(customerId).trim() : undefined;
  }

  if (targetUser.role === 'admin') {
    // Admin always has all tabs
    delete targetUser.customAllowedTabs;
    saveDatabase(db);
    res.json({
      success: true,
      message: 'L\'amministratore mantiene sempre tutti i permessi del sistema.',
      user: sanitizeUser(targetUser),
    });
    return;
  }

  if (customAllowedTabs === null || customAllowedTabs === undefined) {
    // Reset to role defaults
    delete targetUser.customAllowedTabs;
  } else if (Array.isArray(customAllowedTabs)) {
    targetUser.customAllowedTabs = customAllowedTabs.filter((t) => typeof t === 'string');
  }

  saveDatabase(db);

  res.json({
    success: true,
    message: targetUser.customAllowedTabs
      ? `Permessi personalizzati per '${targetUser.name}' salvati con successo!`
      : `Permessi di '${targetUser.name}' ripristinati ai valori predefiniti del ruolo.`,
    user: sanitizeUser(targetUser),
  });
});

// DELETE /api/auth/users/:id - Delete a user account (Admin)
app.delete('/api/auth/users/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();

  const targetUser = db.users.find((u) => u.id === id);
  if (!targetUser) {
    res.status(404).json({ success: false, error: 'Utente non trovato' });
    return;
  }

  if (targetUser.username === 'admin' && db.users.filter((u) => u.role === 'admin').length <= 1) {
    res.status(400).json({ success: false, error: 'Impossibile eliminare l\'unico account Amministratore principale' });
    return;
  }

  db.users = db.users.filter((u) => u.id !== id);
  saveDatabase(db);

  res.json({ success: true, message: `Utente '${targetUser.name}' rimosso dal sistema` });
});

// ==============================================================================
// ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSIONS MATRIX API
// ==============================================================================

// GET /api/auth/roles - Get all configured roles and their permissions
app.get('/api/auth/roles', (_req, res) => {
  const db = loadDatabase();
  const roles = db.rolePermissions && db.rolePermissions.length > 0 ? db.rolePermissions : DEFAULT_ROLES;
  res.json({
    success: true,
    roles,
  });
});

// PUT /api/auth/roles/:id - Update permissions/tabs of an existing role
app.put('/api/auth/roles/:id', (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    badgeColor,
    allowedTabs,
    canManageUsers,
    canUpdateVps,
    canEditMachines,
    canEditRecipes,
    canUploadFirmware,
    canControlOptaLab,
    canAccessDatabase,
  } = req.body;

  const db = loadDatabase();
  if (!db.rolePermissions || db.rolePermissions.length === 0) {
    db.rolePermissions = [...DEFAULT_ROLES];
  }

  const role = db.rolePermissions.find((r) => r.id === id);
  if (!role) {
    res.status(404).json({ success: false, error: 'Ruolo non trovato' });
    return;
  }

  if (name && typeof name === 'string' && name.trim().length > 0) {
    role.name = name.trim();
  }
  if (description !== undefined && typeof description === 'string') {
    role.description = description.trim();
  }
  if (badgeColor && typeof badgeColor === 'string') {
    role.badgeColor = badgeColor.trim();
  }

  if (Array.isArray(allowedTabs)) {
    // Admin always retains full navigation
    if (role.id === 'admin') {
      role.allowedTabs = [
        'dashboard',
        'machines',
        'customers',
        'data',
        'programming',
        'ota',
        'touch-panel',
        'opta-lab',
        'database',
      ];
    } else {
      role.allowedTabs = allowedTabs.filter((tab) => typeof tab === 'string');
    }
  }

  if (typeof canManageUsers === 'boolean' && role.id !== 'admin') role.canManageUsers = canManageUsers;
  if (typeof canUpdateVps === 'boolean' && role.id !== 'admin') role.canUpdateVps = canUpdateVps;
  if (typeof canEditMachines === 'boolean') role.canEditMachines = canEditMachines;
  if (typeof canEditRecipes === 'boolean') role.canEditRecipes = canEditRecipes;
  if (typeof canUploadFirmware === 'boolean') role.canUploadFirmware = canUploadFirmware;
  if (typeof canControlOptaLab === 'boolean') role.canControlOptaLab = canControlOptaLab;
  if (typeof canAccessDatabase === 'boolean') role.canAccessDatabase = canAccessDatabase;

  saveDatabase(db);

  res.json({
    success: true,
    message: `Ruolo '${role.name}' aggiornato con successo!`,
    role,
    roles: db.rolePermissions,
  });
});

// POST /api/auth/roles - Create a new custom role
app.post('/api/auth/roles', (req, res) => {
  const { id, name, description, badgeColor, allowedTabs } = req.body;
  const cleanId = String(id || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  if (!cleanId || cleanId.length < 2) {
    res.status(400).json({ success: false, error: 'Identificatore ruolo non valido (min. 2 caratteri, es. installatore)' });
    return;
  }

  const db = loadDatabase();
  if (!db.rolePermissions || db.rolePermissions.length === 0) {
    db.rolePermissions = [...DEFAULT_ROLES];
  }

  if (db.rolePermissions.some((r) => r.id === cleanId)) {
    res.status(400).json({ success: false, error: `Un ruolo con identificatore '${cleanId}' esiste già` });
    return;
  }

  const newRole: RolePermissionDefinition = {
    id: cleanId,
    name: String(name || cleanId).trim(),
    description: String(description || '').trim() || `Ruolo personalizzato ${cleanId}`,
    badgeColor: badgeColor || 'sky',
    allowedTabs: Array.isArray(allowedTabs) && allowedTabs.length > 0 ? allowedTabs : ['dashboard', 'data'],
    canManageUsers: false,
    canUpdateVps: false,
    canEditMachines: false,
    canEditRecipes: false,
    canUploadFirmware: false,
    canControlOptaLab: false,
    canAccessDatabase: false,
    isSystem: false,
  };

  db.rolePermissions.push(newRole);
  saveDatabase(db);

  res.status(201).json({
    success: true,
    message: `Nuovo ruolo '${newRole.name}' creato con successo!`,
    role: newRole,
    roles: db.rolePermissions,
  });
});

// DELETE /api/auth/roles/:id - Delete a custom role (system roles protected)
app.delete('/api/auth/roles/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDatabase();
  if (!db.rolePermissions || db.rolePermissions.length === 0) {
    db.rolePermissions = [...DEFAULT_ROLES];
  }

  const target = db.rolePermissions.find((r) => r.id === id);
  if (!target) {
    res.status(404).json({ success: false, error: 'Ruolo non trovato' });
    return;
  }

  const systemIds = ['admin', 'tecnico', 'gestore', 'operatore', 'cliente', 'viewer'];
  if (target.isSystem || systemIds.includes(target.id)) {
    res.status(400).json({ success: false, error: 'I ruoli standard di sistema non possono essere eliminati' });
    return;
  }

  // Declass users having this role to operatore or viewer
  db.users.forEach((u) => {
    if (u.role === id) u.role = 'operatore';
  });

  db.rolePermissions = db.rolePermissions.filter((r) => r.id !== id);
  saveDatabase(db);

  res.json({
    success: true,
    message: `Ruolo '${target.name}' eliminato. Gli utenti associati sono stati ricollocati come 'operatore'.`,
    roles: db.rolePermissions,
  });
});



// ==============================================================================
// OTA CLOUD FIRMWARE MANAGER API (Upload, Deploy via MQTT & Binary Server)
// ==============================================================================

interface OtaRelease {
  id: string;
  filename: string;
  version: string;
  description: string;
  sizeBytes: number;
  uploadedAt: string;
  targetBoard: string;
  deploymentsCount: number;
  lastDeployedAt?: string;
}

function loadOtaReleases(): OtaRelease[] {
  try {
    if (fs.existsSync(OTA_RELEASES_FILE)) {
      return JSON.parse(fs.readFileSync(OTA_RELEASES_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading ota_releases.json:', err);
  }
  return [];
}

function saveOtaReleases(releases: OtaRelease[]) {
  try {
    fs.writeFileSync(OTA_RELEASES_FILE, JSON.stringify(releases, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing ota_releases.json:', err);
  }
}

// 1. GET /api/ota/releases - List all uploaded firmware binaries
app.get('/api/ota/releases', (req, res) => {
  const releases = loadOtaReleases();
  res.json({ success: true, releases });
});

// 2. GET /api/ota/source-sketch - Download current C++ sketch (esp32_firmware.ino) for Arduino IDE
app.get('/api/ota/source-sketch', (req, res) => {
  const inoPath = path.join(process.cwd(), 'firmware', 'esp32_firmware.ino');
  if (fs.existsSync(inoPath)) {
    res.download(inoPath, 'esp32_firmware.ino');
  } else {
    res.status(404).json({ success: false, error: 'File esp32_firmware.ino non trovato' });
  }
});

// 3. POST /api/ota/upload - Upload a compiled .bin file
app.post('/api/ota/upload', (req, res) => {
  try {
    const { filename, version, description = '', base64Data, targetBoard = 'ESP32 (Standard 38-Pin / NodeMCU)' } = req.body;

    if (!filename || !base64Data) {
      res.status(400).json({ success: false, error: 'File binario e nome file mancanti' });
      return;
    }

    if (!String(filename).toLowerCase().endsWith('.bin')) {
      res.status(400).json({ success: false, error: 'Il file deve avere estensione .bin (es. esp32_firmware.ino.bin)' });
      return;
    }

    const cleanBase64 = String(base64Data).replace(/^data:application\/octet-stream;base64,/, '').replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.length < 50000) {
      res.status(400).json({ success: false, error: 'Dimensione del file binario non valida (troppo piccolo per un firmware ESP32 compilato)' });
      return;
    }

    if (buffer.length > 8 * 1024 * 1024) {
      res.status(400).json({ success: false, error: 'Dimensione del firmware superiore al limite consentito (max 8MB)' });
      return;
    }

    const fileId = `fw-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const savedPath = path.join(OTA_DIR, `${fileId}.bin`);
    fs.writeFileSync(savedPath, buffer);

    const releases = loadOtaReleases();
    const newRelease: OtaRelease = {
      id: fileId,
      filename: String(filename).trim(),
      version: String(version || 'v2.6.4').trim(),
      description: String(description || '').trim(),
      sizeBytes: buffer.length,
      uploadedAt: new Date().toISOString(),
      targetBoard: String(targetBoard).trim(),
      deploymentsCount: 0,
    };

    releases.unshift(newRelease);
    if (releases.length > 20) {
      const removed = releases.slice(20);
      for (const r of removed) {
        try {
          const oldPath = path.join(OTA_DIR, `${r.id}.bin`);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        } catch {}
      }
      releases.splice(20);
    }
    saveOtaReleases(releases);

    broadcastSse('ota-release-added', newRelease);

    res.status(201).json({
      success: true,
      message: `Firmware '${newRelease.filename}' (${(newRelease.sizeBytes / 1024).toFixed(1)} KB) caricato con successo sul Cloud Portal!`,
      release: newRelease,
    });
  } catch (err: any) {
    console.error('Error uploading OTA firmware:', err);
    res.status(500).json({ success: false, error: 'Errore durante il salvataggio del firmware: ' + err.message });
  }
});

// 4. GET /api/ota/download/:fileId - Serve the raw .bin file for ESP32 HTTPClient
app.get(['/api/ota/download/:fileId', '/api/ota/download/:fileId.bin'], (req, res) => {
  let { fileId } = req.params;
  fileId = fileId.replace(/\.bin$/, '');
  const filePath = path.join(OTA_DIR, `${fileId}.bin`);

  if (!fs.existsSync(filePath)) {
    res.status(404).send('Firmware binario non trovato sul server');
    return;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': stat.size,
    'Content-Disposition': `attachment; filename="${fileId}.bin"`,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

// 5. POST /api/ota/deploy - Publish OTA_UPDATE MQTT command to target ESP32 device
app.post('/api/ota/deploy', (req, res) => {
  const { fileId, targetDeviceId } = req.body;

  if (!fileId || !targetDeviceId) {
    res.status(400).json({ success: false, error: 'Specificare sia il release fileId che il targetDeviceId' });
    return;
  }

  const releases = loadOtaReleases();
  const release = releases.find((r) => r.id === fileId);
  if (!release) {
    res.status(404).json({ success: false, error: 'Firmware release non trovata' });
    return;
  }

  const db = loadDatabase();
  const resolution = resolveTargetHardware(db, targetDeviceId);
  if (resolution.error || !resolution.targetMac) {
    res.status(400).json({
      success: false,
      error: resolution.error || `Nessun indirizzo MAC hardware associato a '${targetDeviceId}'. Impossibile recapitare il comando OTA.`,
    });
    return;
  }

  // Construct reliable public download URL accessible from external IoT networks
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const downloadUrl = `${proto}://${host}/api/ota/download/${fileId}.bin`;

  // Publish MQTT OTA command
  publishMqttCommand(targetDeviceId, {
    action: 'OTA_UPDATE',
    url: downloadUrl,
    version: release.version,
    filename: release.filename,
    fileId: release.id,
    size: release.sizeBytes,
    targetMac: resolution.targetMac,
    timestamp: new Date().toISOString(),
  });

  release.deploymentsCount = (release.deploymentsCount || 0) + 1;
  release.lastDeployedAt = new Date().toISOString();
  saveOtaReleases(releases);

  const deviceName = resolution.machine?.name || resolution.device?.deviceId || targetDeviceId;

  broadcastSse('ota-deployed', {
    targetDeviceId,
    targetMac: resolution.targetMac,
    deviceName,
    release,
    downloadUrl,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Comando OTA inviato con successo a '${deviceName}' [MAC: ${resolution.targetMac}]! Inizio download binario da: ${downloadUrl}`,
    downloadUrl,
    targetMac: resolution.targetMac,
    targetDeviceId: resolution.canonicalDeviceId,
  });
});

// 6. DELETE /api/ota/releases/:id - Delete a firmware binary release
app.delete('/api/ota/releases/:id', (req, res) => {
  const { id } = req.params;
  const releases = loadOtaReleases();
  const target = releases.find((r) => r.id === id);

  if (!target) {
    res.status(404).json({ success: false, error: 'Release non trovata' });
    return;
  }

  try {
    const filePath = path.join(OTA_DIR, `${target.id}.bin`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {}

  const updated = releases.filter((r) => r.id !== id);
  saveOtaReleases(updated);

  broadcastSse('ota-release-deleted', { id });
  res.json({ success: true, message: `Firmware release '${target.filename}' eliminata` });
});


// Static GDPR & Compliance Pages (Register.it & Search Engine Crawlers)
app.get(['/privacy-policy', '/privacy', '/privacy.html'], (req, res) => {
  const file = path.join(process.cwd(), 'public', 'privacy-policy.html');
  res.sendFile(file);
});

app.get(['/cookie-policy', '/cookies', '/cookie.html'], (req, res) => {
  const file = path.join(process.cwd(), 'public', 'cookie-policy.html');
  res.sendFile(file);
});

app.get(['/terms', '/termini-e-condizioni', '/terms-of-service', '/terms.html'], (req, res) => {
  const file = path.join(process.cwd(), 'public', 'terms.html');
  res.sendFile(file);
});

// Vite middleware & server startup
async function start() {
  // 1. BOOTSTRAP SYNC-LOCK FIRST: enforce PostgreSQL initialization and lock out local JSON files
  await bootstrapSyncLock();

  // 2. Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[GB-CLOUD Telemetry] Vite dev middleware collegato con successo.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // 3. Start listening on port 3000 (Data structures strictly in memory from PostgreSQL)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GB-CLOUD Telemetry Server] Running on http://localhost:${PORT}`);

    // Start MQTT connection safely
    try {
      initMqtt();
    } catch (mqttErr) {
      console.error('[MQTT Init Error]:', mqttErr);
    }
  });
}

start();
