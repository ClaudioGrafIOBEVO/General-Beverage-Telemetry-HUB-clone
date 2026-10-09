import React, { useState, useEffect } from 'react';
import {
  VendingMachine,
  CanisterCalibration,
  ElectrovalveCalibration,
  ButtonCanisterTiming,
  ButtonEvTiming,
  BeverageDosageCalibration,
  DeliveryReconciliation,
  MachineCalibrationConfig,
  MotorRpmType,
  CalibrationTemplate,
} from '../types';
import { STANDARD_CALIBRATION_TEMPLATES } from '../data/calibrationTemplates';
import { useTheme } from '../context/ThemeContext';
import {
  parseHistoricExcelCalibration,
  exportHistoricExcelCalibration,
  ParsedExcelCalibrationResult,
} from '../utils/excelCalibrationParser';
import {
  Sliders,
  Scale,
  Activity,
  Coffee,
  Droplets,
  PackageCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Info,
  Layers,
  Calculator,
  Server,
  ArrowRight,
  TrendingUp,
  Cpu,
  Clock,
  Check,
  Sparkles,
  Copy,
  Gauge,
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  Settings,
  Flame,
  X,
  Edit2,
  Tag,
  Search,
  Box,
} from 'lucide-react';
import { ArticleItem } from '../types';
import {
  OFFICIAL_PRODUCT_ARTICLES,
  getAllArticles,
  findArticleByCode,
  findArticleByNameOrType,
  fetchArticles,
} from '../data/productArticles';

interface MachineCalibrationViewProps {
  machines: VendingMachine[];
  selectedMachineId?: string;
  onMachineChange?: (machineId: string) => void;
  onRefreshMachines?: () => void;
}

// I 6 CONTENITORI PREDEFINITI (40 / 120 / 200 Giri/min)
export const DEFAULT_6_CANISTERS: CanisterCalibration[] = [
  {
    id: 'canister-1',
    canisterNumber: 1,
    name: 'Contenitore 1: Caffè Solubile / Grani',
    itemCode: 'ART-CAF-01',
    packageUnit: 'Busta 1 Kg',
    ingredientType: 'coffee',
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 2.8, // ~2.8 g/s
    nominalGramsPerDose: 7.0,
    containerCapacityKg: 3.5,
    currentStockKg: 2.4,
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
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 2.5, // ~2.5 g/s
    nominalGramsPerDose: 8.5,
    containerCapacityKg: 2.5,
    currentStockKg: 1.8,
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
    motorRpm: 200, // 200 RPM veloce per erogazioni ricche
    gramsPerSecond: 4.5, // ~4.5 g/s
    nominalGramsPerDose: 18.0,
    containerCapacityKg: 3.0,
    currentStockKg: 2.1,
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
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 3.2, // ~3.2 g/s
    nominalGramsPerDose: 12.0,
    containerCapacityKg: 2.5,
    currentStockKg: 1.7,
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
    motorRpm: 40, // 40 RPM lento per polveri dense
    gramsPerSecond: 1.6, // ~1.6 g/s
    nominalGramsPerDose: 9.0,
    containerCapacityKg: 2.0,
    currentStockKg: 1.3,
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
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 3.0, // ~3.0 g/s
    nominalGramsPerDose: 6.0,
    containerCapacityKg: 4.0,
    currentStockKg: 3.2,
    costPerKg: 1.9,
    lastCalibrationDate: new Date().toISOString().split('T')[0],
  },
];

// LE 7 ELETTROVALVOLE PREDEFINITE (EV1..EV6 per i 6 Contenitori + EV7 per Sola Acqua Calda)
export const DEFAULT_ELECTROVALVES: ElectrovalveCalibration[] = [
  {
    id: 'ev-1',
    evNumber: 1,
    name: 'EV1: Contenitore 1 (Mixer 1 - Caffè / Espresso)',
    flowRateCcPerSec: 15.0, // 15 cc/s
    description: 'Elettrovalvola acqua calda per campana mixer 1 (Contenitore 1: Caffè)',
  },
  {
    id: 'ev-2',
    evNumber: 2,
    name: 'EV2: Contenitore 2 (Mixer 2 - Latte / Schiuma)',
    flowRateCcPerSec: 15.0, // 15 cc/s
    description: 'Elettrovalvola acqua calda per frullino mixer 2 (Contenitore 2: Latte)',
  },
  {
    id: 'ev-3',
    evNumber: 3,
    name: 'EV3: Contenitore 3 (Mixer 3 - Cioccolato Caldo)',
    flowRateCcPerSec: 16.0, // 16 cc/s
    description: 'Elettrovalvola per frullino mixer 3 (Contenitore 3: Cioccolato)',
  },
  {
    id: 'ev-4',
    evNumber: 4,
    name: 'EV4: Contenitore 4 (Mixer 4 - The al Limone)',
    flowRateCcPerSec: 16.0, // 16 cc/s
    description: 'Elettrovalvola per mixer 4 (Contenitore 4: The al Limone)',
  },
  {
    id: 'ev-5',
    evNumber: 5,
    name: 'EV5: Contenitore 5 (Mixer 5 - Orzo & Ginseng)',
    flowRateCcPerSec: 15.0, // 15 cc/s
    description: 'Elettrovalvola per mixer 5 (Contenitore 5: Orzo & Ginseng)',
  },
  {
    id: 'ev-6',
    evNumber: 6,
    name: 'EV6: Contenitore 6 (Mixer 6 - Zucchero / Solubile 6)',
    flowRateCcPerSec: 15.0, // 15 cc/s
    description: 'Elettrovalvola per mixer/flussaggio 6 (Contenitore 6: Zucchero)',
  },
  {
    id: 'ev-7',
    evNumber: 7,
    name: 'EV7: Sola Acqua Calda (Erogazione Diretta)',
    flowRateCcPerSec: 18.0, // 18 cc/s
    description: 'Elettrovalvola dedicata alla sola erogazione di acqua calda diretta (by-pass, tè e tisane)',
  },
];

// Helper per fondere le EV esistenti con la configurazione standard a 7 elettrovalvole
export const ensure7Electrovalves = (currentEvs?: ElectrovalveCalibration[]): ElectrovalveCalibration[] => {
  if (!currentEvs || currentEvs.length === 0) return DEFAULT_ELECTROVALVES;
  return DEFAULT_ELECTROVALVES.map((defEv) => {
    const found = currentEvs.find((e) => e.id === defEv.id || e.evNumber === defEv.evNumber);
    if (found) {
      return {
        ...defEv,
        ...found,
        id: defEv.id,
        evNumber: defEv.evNumber,
      };
    }
    return defEv;
  });
};

// GENERATORE PULSANTI CON STRUTTURA CONTENITORI & EV
const buildDefaultBeverage = (
  key: string,
  name: string,
  activeCanisters: { canisterId: string; sec: number }[],
  activeEvs: { evId: string; sec: number }[],
  notes: string = ''
): BeverageDosageCalibration => {
  return {
    key,
    name,
    canisterTimings: DEFAULT_6_CANISTERS.map((c) => {
      const match = activeCanisters.find((ac) => ac.canisterId === c.id);
      return {
        canisterId: c.id,
        enabled: !!match,
        motorDurationSec: match ? match.sec : 0,
      };
    }),
    evTimings: DEFAULT_ELECTROVALVES.map((ev) => {
      const match = activeEvs.find((ae) => ae.evId === ev.id);
      return {
        evId: ev.id,
        enabled: !!match,
        waterDurationSec: match ? match.sec : 0,
      };
    }),
    notes,
  };
};

// 12 PRODOTTI STANDARD BICCHIERE (P1 - P12)
export const DEFAULT_12_STANDARD_PRODUCTS: BeverageDosageCalibration[] = [
  buildDefaultBeverage('P1', 'Caffè Espresso', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 3.0 }], 'Espresso corto intenso'),
  buildDefaultBeverage('P2', 'Caffè Lungo', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 4.0 }, { evId: 'ev-7', sec: 2.0 }], 'Espresso allungato con EV7 sola acqua calda'),
  buildDefaultBeverage('P3', 'Caffè Macchiato', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 1.2 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 1.8 }], 'Espresso con goccia di latte'),
  buildDefaultBeverage('P4', 'Cappuccino Cremoso', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 3.5 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 6.0 }], 'Latte montato con caffè'),
  buildDefaultBeverage('P5', 'Caffellatte', [{ canisterId: 'canister-1', sec: 1.8 }, { canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 7.5 }], 'Tazza grande di latte con poco caffè'),
  buildDefaultBeverage('P6', 'Cioccolato Caldo Denso', [{ canisterId: 'canister-3', sec: 4.0 }], [{ evId: 'ev-3', sec: 8.5 }], 'Cioccolato cremoso solubile'),
  buildDefaultBeverage('P7', 'Mocaccino', [{ canisterId: 'canister-1', sec: 2.2 }, { canisterId: 'canister-2', sec: 2.0 }, { canisterId: 'canister-3', sec: 2.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 3.5 }, { evId: 'ev-3', sec: 4.0 }], 'Caffè, latte e cioccolato denso'),
  buildDefaultBeverage('P8', 'Latte Caldo Puro', [{ canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-2', sec: 9.0 }], 'Latte caldo senza caffè'),
  buildDefaultBeverage('P9', 'The al Limone', [{ canisterId: 'canister-4', sec: 3.8 }], [{ evId: 'ev-4', sec: 8.5 }], 'The caldo al limone con EV4 dedicata'),
  buildDefaultBeverage('P10', 'Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 5.5 }], [{ evId: 'ev-5', sec: 4.0 }], 'Orzo tostato tazza piccola (motore 40 RPM, EV5 dedicata)'),
  buildDefaultBeverage('P11', 'Orzo Grande Tazza', [{ canisterId: 'canister-5', sec: 7.0 }], [{ evId: 'ev-5', sec: 7.5 }], 'Orzo lungo (motore 40 RPM, EV5 dedicata)'),
  buildDefaultBeverage('P12', 'Ginseng Dolce', [{ canisterId: 'canister-5', sec: 6.0 }, { canisterId: 'canister-2', sec: 1.5 }], [{ evId: 'ev-5', sec: 5.0 }, { evId: 'ev-2', sec: 2.0 }], 'Ginseng cremoso con goccia di latte'),
];

// 12 PRODOTTI VERSIONE CARAFFA (P1 - P12, TARABILI IN MODO TOTALMENTE INDIPENDENTE)
export const DEFAULT_12_CARAFFA_PRODUCTS: BeverageDosageCalibration[] = [
  buildDefaultBeverage('P1', 'Caraffa Caffè Espresso (4 Tazze)', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 12.0 }], 'Caraffa 4 caffè'),
  buildDefaultBeverage('P2', 'Caraffa Caffè Americano', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 16.0 }, { evId: 'ev-7', sec: 10.0 }], 'Caraffa allungata americana con EV7 sola acqua calda'),
  buildDefaultBeverage('P3', 'Caraffa Caffè Macchiato', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 4.8 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 7.0 }], 'Caraffa macchiato'),
  buildDefaultBeverage('P4', 'Caraffa Cappuccino', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 14.0 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 24.0 }], 'Caraffa cappuccino per colazioni'),
  buildDefaultBeverage('P5', 'Caraffa Caffellatte', [{ canisterId: 'canister-1', sec: 7.0 }, { canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 30.0 }], 'Caraffa latte caldo'),
  buildDefaultBeverage('P6', 'Caraffa Cioccolato Caldo', [{ canisterId: 'canister-3', sec: 16.0 }], [{ evId: 'ev-3', sec: 34.0 }], 'Caraffa cioccolato ricca EV3'),
  buildDefaultBeverage('P7', 'Caraffa Mocaccino', [{ canisterId: 'canister-1', sec: 8.8 }, { canisterId: 'canister-2', sec: 8.0 }, { canisterId: 'canister-3', sec: 10.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 14.0 }, { evId: 'ev-3', sec: 16.0 }], 'Caraffa mocaccino'),
  buildDefaultBeverage('P8', 'Caraffa Latte Caldo', [{ canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-2', sec: 36.0 }], 'Caraffa latte intero'),
  buildDefaultBeverage('P9', 'Caraffa The al Limone', [{ canisterId: 'canister-4', sec: 15.2 }], [{ evId: 'ev-4', sec: 34.0 }], 'Caraffa the 1 Litro EV4'),
  buildDefaultBeverage('P10', 'Caraffa Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 22.0 }], [{ evId: 'ev-5', sec: 16.0 }], 'Caraffa orzo concentrato EV5'),
  buildDefaultBeverage('P11', 'Caraffa Orzo Tazza Grande', [{ canisterId: 'canister-5', sec: 28.0 }], [{ evId: 'ev-5', sec: 30.0 }], 'Caraffa orzo abbondante EV5'),
  buildDefaultBeverage('P12', 'Caraffa Ginseng', [{ canisterId: 'canister-5', sec: 24.0 }, { canisterId: 'canister-2', sec: 6.0 }], [{ evId: 'ev-5', sec: 20.0 }, { evId: 'ev-2', sec: 8.0 }], 'Caraffa ginseng riunioni EV5 + EV2'),
];

export const MachineCalibrationView: React.FC<MachineCalibrationViewProps> = ({
  machines,
  selectedMachineId,
  onMachineChange,
  onRefreshMachines,
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Selettore macchina attiva
  const [currentMachineId, setCurrentMachineId] = useState<string>(
    selectedMachineId || (machines.length > 0 ? machines[0].id : '')
  );

  useEffect(() => {
    if (selectedMachineId) {
      setCurrentMachineId(selectedMachineId);
    } else if (!currentMachineId && machines.length > 0) {
      setCurrentMachineId(machines[0].id);
    }
  }, [selectedMachineId, machines]);

  const activeMachine = machines.find((m) => m.id === currentMachineId) || machines[0];
  const isCalibrationActive = Boolean(activeMachine?.enableCalibrationAndConsumption ?? activeMachine?.config?.enableCalibrationAndConsumption);
  const [isTogglingCalibrationMode, setIsTogglingCalibrationMode] = useState<boolean>(false);

  const handleToggleCalibrationMode = async () => {
    if (!activeMachine) return;
    setIsTogglingCalibrationMode(true);
    const targetState = !isCalibrationActive;
    try {
      const res = await fetch(`/api/machines/${activeMachine.id}/calibration-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: targetState }),
      });
      const data = await res.json();
      if (res.ok) {
        setTemplateNotification(data.message || `Modalità macchina aggiornata: ${targetState ? 'Taratura e consumi abilitati' : 'Sola rilevazione battute'}`);
        onRefreshMachines?.();
      } else {
        alert(data.error || 'Errore durante aggiornamento modalità');
      }
    } catch {
      alert('Errore di connessione con il server');
    } finally {
      setIsTogglingCalibrationMode(false);
    }
  };

  // Workflow Tabs: 'canisters' | 'evs' | 'standard' | 'caraffa' | 'reconciliation'
  const [activeSubTab, setActiveSubTab] = useState<'canisters' | 'evs' | 'standard' | 'caraffa' | 'reconciliation'>('canisters');

  // I 6 Contenitori
  const [canisters, setCanisters] = useState<CanisterCalibration[]>(DEFAULT_6_CANISTERS);

  // Le Elettrovalvole (EV)
  const [electrovalves, setElectrovalves] = useState<ElectrovalveCalibration[]>(DEFAULT_ELECTROVALVES);

  // Taratura portata acqua generale in cc/s
  const [waterFlowCcPerSec, setWaterFlowCcPerSec] = useState<number>(15.0);

  // 12 Prodotti Bicchiere
  const [standardProducts, setStandardProducts] = useState<BeverageDosageCalibration[]>(DEFAULT_12_STANDARD_PRODUCTS);

  // 12 Prodotti Caraffa (indipendenti)
  const [caraffaProducts, setCaraffaProducts] = useState<BeverageDosageCalibration[]>(DEFAULT_12_CARAFFA_PRODUCTS);

  // Consegne DDT
  const [deliveries, setDeliveries] = useState<DeliveryReconciliation[]>([]);

  // Note Tecnico
  const [calibratedBy, setCalibratedBy] = useState<string>('Tecnico Collaudo');
  const [calibrationNotes, setCalibrationNotes] = useState<string>('');

  // Salvataggio
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Modale Regolazione Dettagliata Tasto Singolo (Pulsante P1..P12)
  const [editingBeverage, setEditingBeverage] = useState<{
    isOpen: boolean;
    isCaraffa: boolean;
    beverage: BeverageDosageCalibration;
  } | null>(null);

  // Modale Test Pesata Contenitore con Bilancino
  const [testScaleModal, setTestScaleModal] = useState<{
    isOpen: boolean;
    canisterId: string;
    canisterName: string;
    motorRpm: MotorRpmType;
    testDurationSec: number;
    measuredWeightGrams: number;
  }>({
    isOpen: false,
    canisterId: '',
    canisterName: '',
    motorRpm: 120,
    testDurationSec: 5.0,
    measuredWeightGrams: 14.0,
  });

  // Modale Test Taratura Acqua Elettrovalvola con Cilindro Graduato
  const [testWaterModal, setTestWaterModal] = useState<{
    isOpen: boolean;
    evId: string;
    evName: string;
    testDurationSec: number;
    measuredCc: number;
  }>({
    isOpen: false,
    evId: '',
    evName: '',
    testDurationSec: 10.0,
    measuredCc: 150,
  });

  // Modale Selezione Articolo da Anagrafica per Contenitore
  const [productCatalogModal, setProductCatalogModal] = useState<{
    isOpen: boolean;
    canisterId: string;
    canisterNumber: number;
  } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('all');
  const [customArticleCode, setCustomArticleCode] = useState<string>('');
  const [customArticleName, setCustomArticleName] = useState<string>('');
  const [dbArticles, setDbArticles] = useState<ArticleItem[]>(getAllArticles());

  useEffect(() => {
    fetchArticles().then((items) => {
      if (items && items.length > 0) {
        setDbArticles(items);
      }
    });
  }, []);

  // Modelli Standard di Taratura
  const [templates, setTemplates] = useState<CalibrationTemplate[]>(STANDARD_CALIBRATION_TEMPLATES);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState<boolean>(false);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [newTemplateDesc, setNewTemplateDesc] = useState<string>('');
  const [newTemplateTarget, setNewTemplateTarget] = useState<string>('Ristosano');
  const [isApplyingTemplate, setIsApplyingTemplate] = useState<boolean>(false);
  const [templateNotification, setTemplateNotification] = useState<string | null>(null);

  // Modale e Stati Import / Export Excel Storico (.xlsx)
  const [showExcelImportModal, setShowExcelImportModal] = useState<boolean>(false);
  const [excelParsedResult, setExcelParsedResult] = useState<ParsedExcelCalibrationResult | null>(null);
  const [excelImportLoading, setExcelImportLoading] = useState<boolean>(false);
  const [excelFileName, setExcelFileName] = useState<string>('');

  const handleExcelFileUpload = (file: File) => {
    setExcelFileName(file.name);
    setExcelImportLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const result = parseHistoricExcelCalibration(buffer);
        setExcelParsedResult(result);
      } catch (err: any) {
        setExcelParsedResult({
          success: false,
          message: `Errore durante la lettura del file: ${err?.message || 'File non valido'}`,
          metadata: {},
          containersDetected: [],
          hotWaterEvCcSec: 18,
          recipesPiattoCount: 0,
          recipesZuppieraCount: 0,
          calibration: {} as any,
          warnings: [String(err)],
        });
      } finally {
        setExcelImportLoading(false);
      }
    };
    reader.onerror = () => {
      setExcelImportLoading(false);
      setExcelParsedResult({
        success: false,
        message: 'Impossibile leggere il file selezionato.',
        metadata: {},
        containersDetected: [],
        hotWaterEvCcSec: 18,
        recipesPiattoCount: 0,
        recipesZuppieraCount: 0,
        calibration: {} as any,
        warnings: ['Errore FileReader'],
      });
    };
    reader.readAsArrayBuffer(file);
  };

  const handleApplyExcelCalibration = () => {
    if (!excelParsedResult || !excelParsedResult.success) return;
    const cal = excelParsedResult.calibration;
    setWaterFlowCcPerSec(cal.waterFlowCcPerSec || 17.0);
    setCanisters(cal.canisters || DEFAULT_6_CANISTERS);
    setElectrovalves(cal.electrovalves && cal.electrovalves.length === 7 ? cal.electrovalves : ensure7Electrovalves(cal.electrovalves));
    setStandardProducts(cal.standardProducts || DEFAULT_12_STANDARD_PRODUCTS);
    setCaraffaProducts(cal.caraffaProducts || DEFAULT_12_CARAFFA_PRODUCTS);
    setCalibratedBy(cal.calibratedBy || `Importato da ${excelFileName}`);
    if (cal.notes) setCalibrationNotes(cal.notes);
    setShowExcelImportModal(false);
    setTemplateNotification(`Taratura da Excel "${excelFileName}" importata con successo per ${activeMachine?.name || 'la macchina'}! 6 Contenitori, 7 EV e 24 ricette aggiornate. Ricorda di salvare.`);
  };

  const handleExportExcel = () => {
    try {
      const currentConfig: MachineCalibrationConfig = {
        lastUpdated: new Date().toISOString(),
        calibratedBy,
        notes: calibrationNotes,
        waterFlowCcPerSec,
        canisters,
        electrovalves,
        standardProducts,
        caraffaProducts,
        deliveries,
      };
      const res = exportHistoricExcelCalibration(
        currentConfig,
        activeMachine?.model || 'BIG 6 CATERING',
        activeMachine?.serialNumber || '104829',
        'Format RR-AF PRO'
      );
      if (res?.success) {
        setTemplateNotification(`✅ File Excel "${res.filename}" generato e scaricato con successo con layout 1:1 identico al vostro modello storico!`);
      } else {
        setTemplateNotification(`Download generato: ${res?.filename || 'Taratura.xlsx'}. Controlla la cartella Download del browser.`);
      }
    } catch (err: any) {
      console.error('Errore export:', err);
      setTemplateNotification(`Errore generazione Excel: ${err?.message || 'Verifica i permessi download'}`);
    }
  };

  // Fetch modelli da backend al mount
  useEffect(() => {
    fetch('/api/calibration-templates')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTemplates(data);
        }
      })
      .catch(() => {});
  }, []);

  // Helper per convertire un vecchio record senza canisterTimings o evTimings
  const normalizeProduct = (
    p: BeverageDosageCalibration,
    canisterList: CanisterCalibration[],
    evList: ElectrovalveCalibration[]
  ): BeverageDosageCalibration => {
    const canisterTimings: ButtonCanisterTiming[] = canisterList.map((c) => {
      const existing = p.canisterTimings?.find((ct) => ct.canisterId === c.id);
      if (existing) return existing;
      // Retrocompatibilità se aveva canisterId singolo
      if (p.canisterId === c.id) {
        return {
          canisterId: c.id,
          enabled: true,
          motorDurationSec: p.motorDurationSec || 2.5,
        };
      }
      return {
        canisterId: c.id,
        enabled: false,
        motorDurationSec: 0,
      };
    });

    const evTimings: ButtonEvTiming[] = evList.map((ev, idx) => {
      const existing = p.evTimings?.find((et) => et.evId === ev.id);
      if (existing) return existing;
      // Se non c'erano evTimings, abbiniamo al primo EV
      if (idx === 0) {
        return {
          evId: ev.id,
          enabled: true,
          waterDurationSec: p.waterDurationSec || 4.0,
        };
      }
      return {
        evId: ev.id,
        enabled: false,
        waterDurationSec: 0,
      };
    });

    return {
      ...p,
      canisterTimings,
      evTimings,
    };
  };

  // Carica i dati della macchina selezionata
  useEffect(() => {
    if (activeMachine?.calibration) {
      const cal = activeMachine.calibration;
      if (cal.waterFlowCcPerSec) {
        setWaterFlowCcPerSec(cal.waterFlowCcPerSec);
      }
      const rawCanisters =
        cal.canisters && cal.canisters.length === 6 ? cal.canisters : DEFAULT_6_CANISTERS;
      const defaultCodes = ['ART-CAF-01', 'ART-LAT-01', 'ART-CIO-01', 'ART-THE-01', 'ART-ORZ-01', 'ART-ZUC-01'];
      const loadedCanisters = rawCanisters.map((c: CanisterCalibration, idx: number) => {
        if (!c.itemCode) {
          const matched = findArticleByNameOrType(c.name, c.ingredientType);
          return {
            ...c,
            itemCode: matched?.itemCode || defaultCodes[idx] || `ART-CAN-0${idx + 1}`,
            packageUnit: c.packageUnit || matched?.packageUnit || 'Busta 1 Kg',
          };
        }
        return {
          ...c,
          packageUnit: c.packageUnit || 'Busta 1 Kg',
        };
      });
      setCanisters(loadedCanisters);

      const loadedEvs = ensure7Electrovalves(cal.electrovalves);
      setElectrovalves(loadedEvs);

      if (cal.standardProducts && cal.standardProducts.length === 12) {
        setStandardProducts(
          cal.standardProducts.map((p) => normalizeProduct(p, loadedCanisters, loadedEvs))
        );
      } else {
        setStandardProducts(DEFAULT_12_STANDARD_PRODUCTS);
      }

      if (cal.caraffaProducts && cal.caraffaProducts.length === 12) {
        setCaraffaProducts(
          cal.caraffaProducts.map((p) => normalizeProduct(p, loadedCanisters, loadedEvs))
        );
      } else {
        setCaraffaProducts(DEFAULT_12_CARAFFA_PRODUCTS);
      }

      if (cal.deliveries) {
        setDeliveries(cal.deliveries);
      }
      if (cal.calibratedBy) {
        setCalibratedBy(cal.calibratedBy);
      }
      if (cal.notes) {
        setCalibrationNotes(cal.notes);
      }
    } else {
      setCanisters(DEFAULT_6_CANISTERS);
      setElectrovalves(DEFAULT_ELECTROVALVES);
      setStandardProducts(DEFAULT_12_STANDARD_PRODUCTS);
      setCaraffaProducts(DEFAULT_12_CARAFFA_PRODUCTS);
      setWaterFlowCcPerSec(15.0);
    }
  }, [activeMachine?.id]);

  // Aggiornamento singolo Contenitore (1..6)
  const handleUpdateCanister = (id: string, field: keyof CanisterCalibration, value: any) => {
    setCanisters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  // Aggiornamento singola Elettrovalvola (EV)
  const handleUpdateEv = (id: string, field: keyof ElectrovalveCalibration, value: any) => {
    setElectrovalves((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, [field]: value } : ev))
    );
  };

  // Aggiornamento rapido Prodotto Bicchiere
  const handleUpdateStandardProduct = (key: string, updated: BeverageDosageCalibration) => {
    setStandardProducts((prev) => prev.map((p) => (p.key === key ? updated : p)));
  };

  // Aggiornamento rapido Prodotto Caraffa
  const handleUpdateCaraffaProduct = (key: string, updated: BeverageDosageCalibration) => {
    setCaraffaProducts((prev) => prev.map((p) => (p.key === key ? updated : p)));
  };

  // Modifica toggle contenitore per un pulsante
  const handleToggleCanisterForBeverage = (
    beverage: BeverageDosageCalibration,
    canisterId: string,
    enabled: boolean,
    isCaraffa: boolean
  ) => {
    const defaultSec = isCaraffa ? 10.0 : 2.5;
    const updatedCanisterTimings = beverage.canisterTimings.map((ct) => {
      if (ct.canisterId === canisterId) {
        return {
          ...ct,
          enabled,
          motorDurationSec: enabled && ct.motorDurationSec === 0 ? defaultSec : ct.motorDurationSec,
        };
      }
      return ct;
    });

    const updated = { ...beverage, canisterTimings: updatedCanisterTimings };
    if (isCaraffa) {
      handleUpdateCaraffaProduct(beverage.key, updated);
    } else {
      handleUpdateStandardProduct(beverage.key, updated);
    }
    if (editingBeverage && editingBeverage.beverage.key === beverage.key && editingBeverage.isCaraffa === isCaraffa) {
      setEditingBeverage({ ...editingBeverage, beverage: updated });
    }
  };

  // Modifica tempo coclea per un contenitore su un pulsante
  const handleCanisterDurationChange = (
    beverage: BeverageDosageCalibration,
    canisterId: string,
    sec: number,
    isCaraffa: boolean
  ) => {
    const updatedCanisterTimings = beverage.canisterTimings.map((ct) => {
      if (ct.canisterId === canisterId) {
        return { ...ct, motorDurationSec: sec, enabled: sec > 0 };
      }
      return ct;
    });
    const updated = { ...beverage, canisterTimings: updatedCanisterTimings };
    if (isCaraffa) {
      handleUpdateCaraffaProduct(beverage.key, updated);
    } else {
      handleUpdateStandardProduct(beverage.key, updated);
    }
    if (editingBeverage && editingBeverage.beverage.key === beverage.key && editingBeverage.isCaraffa === isCaraffa) {
      setEditingBeverage({ ...editingBeverage, beverage: updated });
    }
  };

  // Modifica toggle EV per un pulsante
  const handleToggleEvForBeverage = (
    beverage: BeverageDosageCalibration,
    evId: string,
    enabled: boolean,
    isCaraffa: boolean
  ) => {
    const defaultSec = isCaraffa ? 15.0 : 4.0;
    const updatedEvTimings = beverage.evTimings.map((et) => {
      if (et.evId === evId) {
        return {
          ...et,
          enabled,
          waterDurationSec: enabled && et.waterDurationSec === 0 ? defaultSec : et.waterDurationSec,
        };
      }
      return et;
    });

    const updated = { ...beverage, evTimings: updatedEvTimings };
    if (isCaraffa) {
      handleUpdateCaraffaProduct(beverage.key, updated);
    } else {
      handleUpdateStandardProduct(beverage.key, updated);
    }
    if (editingBeverage && editingBeverage.beverage.key === beverage.key && editingBeverage.isCaraffa === isCaraffa) {
      setEditingBeverage({ ...editingBeverage, beverage: updated });
    }
  };

  // Modifica tempo acqua per un'EV su un pulsante
  const handleEvDurationChange = (
    beverage: BeverageDosageCalibration,
    evId: string,
    sec: number,
    isCaraffa: boolean
  ) => {
    const updatedEvTimings = beverage.evTimings.map((et) => {
      if (et.evId === evId) {
        return { ...et, waterDurationSec: sec, enabled: sec > 0 };
      }
      return et;
    });
    const updated = { ...beverage, evTimings: updatedEvTimings };
    if (isCaraffa) {
      handleUpdateCaraffaProduct(beverage.key, updated);
    } else {
      handleUpdateStandardProduct(beverage.key, updated);
    }
    if (editingBeverage && editingBeverage.beverage.key === beverage.key && editingBeverage.isCaraffa === isCaraffa) {
      setEditingBeverage({ ...editingBeverage, beverage: updated });
    }
  };

  // Calcola totale grammi, volume cc e costo di un pulsante
  const calculateBeverageTotals = (b: BeverageDosageCalibration) => {
    let totalGrams = 0;
    let totalCost = 0;
    const canisterDetails: Array<{ name: string; sec: number; grams: number; rpm: number }> = [];

    b.canisterTimings?.forEach((ct) => {
      if (ct.enabled && ct.motorDurationSec > 0) {
        const can = canisters.find((c) => c.id === ct.canisterId);
        if (can) {
          const grams = Number((ct.motorDurationSec * can.gramsPerSecond).toFixed(1));
          totalGrams += grams;
          totalCost += grams * (can.costPerKg / 1000);
          canisterDetails.push({
            name: can.name,
            sec: ct.motorDurationSec,
            grams,
            rpm: can.motorRpm,
          });
        }
      }
    });

    let totalWaterCc = 0;
    const evDetails: Array<{ name: string; sec: number; cc: number }> = [];

    b.evTimings?.forEach((et) => {
      if (et.enabled && et.waterDurationSec > 0) {
        const ev = electrovalves.find((e) => e.id === et.evId);
        const flow = ev ? ev.flowRateCcPerSec : waterFlowCcPerSec;
        const cc = Number((et.waterDurationSec * flow).toFixed(0));
        totalWaterCc += cc;
        evDetails.push({
          name: ev ? ev.name : et.evId,
          sec: et.waterDurationSec,
          cc,
        });
      }
    });

    return {
      totalGrams: Number(totalGrams.toFixed(1)),
      totalCost: Number(totalCost.toFixed(3)),
      totalWaterCc,
      canisterDetails,
      evDetails,
    };
  };

  // Pre-imposta Caraffa scalando i tempi dal Bicchiere
  const handleScaleStandardToCaraffa = (multiplier: number = 4) => {
    if (
      !window.confirm(
        `Vuoi reimpostare i 12 prodotti Caraffa copiando contenitori ed EV dei prodotti Bicchiere e moltiplicando i tempi di coclea e acqua per ${multiplier}x?`
      )
    ) {
      return;
    }
    setCaraffaProducts(
      standardProducts.map((std) => ({
        key: std.key,
        name: `Caraffa ${std.name}`,
        canisterTimings: std.canisterTimings.map((ct) => ({
          ...ct,
          motorDurationSec: Number((ct.motorDurationSec * multiplier).toFixed(1)),
        })),
        evTimings: std.evTimings.map((et) => ({
          ...et,
          waterDurationSec: Number((et.waterDurationSec * multiplier).toFixed(1)),
        })),
        notes: `Generato da ${std.name} (${multiplier}x)`,
      }))
    );
  };

  // Salvataggio sul Server via PUT /api/machines/:id/calibration
  const handleSaveCalibration = async () => {
    if (!activeMachine) return;
    setIsSaving(true);
    setSaveSuccess(false);

    const calibrationPayload: MachineCalibrationConfig = {
      lastUpdated: new Date().toISOString(),
      calibratedBy,
      notes: calibrationNotes,
      waterFlowCcPerSec,
      electrovalves,
      canisters,
      standardProducts,
      caraffaProducts,
      deliveries,
    };

    try {
      // 1. Prova prima l'endpoint dedicato di taratura
      let res = await fetch(`/api/machines/${activeMachine.id}/calibration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calibration: calibrationPayload,
        }),
      });

      // 2. Fallback a PUT /api/machines/:id se per qualche motivo 404
      if (res.status === 404) {
        res = await fetch(`/api/machines/${activeMachine.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            calibration: calibrationPayload,
          }),
        });
      }

      const data = await res.json().catch(() => null);

      if (res.ok && (data?.success !== false)) {
        setSaveSuccess(true);
        // Aggiorna subito in memoria la macchina corrente per evitare disallineamenti UI
        activeMachine.calibration = calibrationPayload;
        activeMachine.enableCalibrationAndConsumption = true;
        setTemplateNotification(`✅ Taratura per Matricola #${activeMachine.serialNumber} (${activeMachine.name}) salvata con successo nel database!`);
        onRefreshMachines?.();
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        const errorMsg = data?.error || 'Errore durante il salvataggio della taratura sul server.';
        setTemplateNotification(`❌ ${errorMsg}`);
        alert(errorMsg);
      }
    } catch (err: any) {
      console.error('Errore salvataggio taratura:', err);
      localStorage.setItem(`calibration_${activeMachine.id}`, JSON.stringify(calibrationPayload));
      activeMachine.calibration = calibrationPayload;
      setSaveSuccess(true);
      setTemplateNotification(`⚠️ Salvata localmente per Matricola #${activeMachine.serialNumber} (server non raggiungibile).`);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  // Applica Modello Standard alla Macchina Selezionata
  const handleApplyTemplate = async (template: CalibrationTemplate) => {
    if (!activeMachine) return;
    setIsApplyingTemplate(true);
    try {
      const cal = JSON.parse(JSON.stringify(template.calibration));
      setWaterFlowCcPerSec(cal.waterFlowCcPerSec || 15.0);
      setCanisters(cal.canisters || DEFAULT_6_CANISTERS);
      setElectrovalves(ensure7Electrovalves(cal.electrovalves));
      setStandardProducts(cal.standardProducts || DEFAULT_12_STANDARD_PRODUCTS);
      setCaraffaProducts(cal.caraffaProducts || DEFAULT_12_CARAFFA_PRODUCTS);
      setCalibratedBy(`Modello: ${template.name}`);
      const notesMsg = `Taratura associata alla Matricola ${activeMachine.serialNumber} dal modello "${template.name}" in data ${new Date().toLocaleDateString('it-IT')}`;
      setCalibrationNotes(notesMsg);

      const res = await fetch(`/api/machines/${activeMachine.id}/apply-calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          sourceTemplateName: template.name,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTemplateNotification(`Modello "${template.name}" applicato con successo alla Matricola #${activeMachine.serialNumber}!`);
        setTimeout(() => setTemplateNotification(null), 5000);
        setTimeout(() => setSaveSuccess(false), 3500);
        onRefreshMachines?.();
      }
    } catch (err) {
      console.error('Errore durante applicazione modello:', err);
    } finally {
      setIsApplyingTemplate(false);
      setShowTemplateModal(false);
    }
  };

  // Salva Configurazione Attuale come Nuovo Modello Standard
  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      const calibrationPayload: MachineCalibrationConfig = {
        lastUpdated: new Date().toISOString(),
        calibratedBy,
        notes: calibrationNotes || `Modello standard salvato da Matricola ${activeMachine?.serialNumber}`,
        waterFlowCcPerSec,
        electrovalves,
        canisters,
        standardProducts,
        caraffaProducts,
        deliveries: [],
      };

      const res = await fetch('/api/calibration-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplateName.trim(),
          description: newTemplateDesc.trim() || `Modello basato sui parametri del distributore ${activeMachine?.name} (${activeMachine?.serialNumber})`,
          modelTarget: newTemplateTarget || activeMachine?.model || 'Universale',
          calibration: calibrationPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.template) {
          setTemplates((prev) => [...prev, data.template]);
        }
        setShowSaveTemplateModal(false);
        setNewTemplateName('');
        setNewTemplateDesc('');
        setTemplateNotification(`Nuovo modello "${newTemplateName}" salvato! È ora disponibile come base per qualsiasi matricola.`);
        setTimeout(() => setTemplateNotification(null), 5000);
      }
    } catch (err) {
      console.error('Errore salvataggio modello:', err);
    }
  };

  // Applica prova di pesata con bilancino (Calibrazione Contenitore g/sec)
  const handleApplyScaleCalibration = () => {
    const calculatedGramsPerSec = Number(
      (testScaleModal.measuredWeightGrams / Math.max(0.1, testScaleModal.testDurationSec)).toFixed(2)
    );
    setCanisters((prev) =>
      prev.map((c) =>
        c.id === testScaleModal.canisterId
          ? {
              ...c,
              gramsPerSecond: calculatedGramsPerSec,
              motorRpm: testScaleModal.motorRpm,
              lastCalibrationDate: new Date().toISOString().split('T')[0],
            }
          : c
      )
    );
    setTestScaleModal({ ...testScaleModal, isOpen: false });
  };

  // Applica prova taratura acqua con cilindro graduato (Calibrazione EV cc/sec)
  const handleApplyWaterCalibration = () => {
    const calculatedCcPerSec = Number(
      (testWaterModal.measuredCc / Math.max(0.1, testWaterModal.testDurationSec)).toFixed(1)
    );
    setElectrovalves((prev) =>
      prev.map((ev) =>
        ev.id === testWaterModal.evId ? { ...ev, flowRateCcPerSec: calculatedCcPerSec } : ev
      )
    );
    setTestWaterModal({ ...testWaterModal, isOpen: false });
  };

  // Esporta report completo JSON
  const handleExportJson = () => {
    const exportData = {
      machineId: activeMachine?.id,
      serialNumber: activeMachine?.serialNumber,
      machineName: activeMachine?.name,
      model: activeMachine?.model,
      exportedAt: new Date().toISOString(),
      calibratedBy,
      waterFlowCcPerSec,
      electrovalves,
      canisters,
      standardProducts,
      caraffaProducts,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taratura_${activeMachine?.serialNumber || 'macchina'}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* HEADER DI CONTROLLO & SELETTORE DISTRIBUTORE */}
      {/* ========================================================================= */}
      <div className={`rounded-3xl p-5 border shadow-xl transition-all duration-200 ${
        isLight
          ? 'bg-white border-slate-200 shadow-slate-200/50'
          : 'bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-emerald-500/20 shadow-2xl backdrop-blur-md'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${
                isLight
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-sm'
                  : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400'
              }`}>
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className={`text-lg font-black tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Taratura Macchina: 6 Contenitori, EV &amp; 12+12 Pulsanti
                  </h2>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                    isLight
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  }`}>
                    Coclee 40 / 120 / 200 RPM
                  </span>
                </div>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                  Indica prima i 6 contenitori e le elettrovalvole; poi regola ogni pulsante con i contenitori da azionare, le EV da aprire e i rispettivi tempi in secondi.
                </p>
              </div>
            </div>
          </div>

          {/* Selettore Distributore & Azioni di Salvataggio */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Distributore:
              </span>
              <select
                id="calibration-machine-selector"
                value={activeMachine?.id || ''}
                onChange={(e) => {
                  setCurrentMachineId(e.target.value);
                  onMachineChange?.(e.target.value);
                }}
                className={`text-xs font-bold rounded-xl px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-slate-800 border-white/10 text-white'
                }`}
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    Matr. {m.serialNumber} - {m.name} ({m.model})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowTemplateModal(true)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-[1.02] ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/40'
              }`}
              title="Carica una taratura standard di partenza (Ristosano, Big 5, Asia) per questa matricola"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Applica Taratura Standard...</span>
            </button>

            <button
              onClick={() => {
                setNewTemplateName(`Modello ${activeMachine?.name || 'Personalizzato'}`);
                setNewTemplateDesc(`Basato su matricola ${activeMachine?.serialNumber || ''} (${activeMachine?.model || ''})`);
                setNewTemplateTarget(activeMachine?.model || 'Ristosano');
                setShowSaveTemplateModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Salva la configurazione attuale come modello standard riutilizzabile"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Salva Modello</span>
            </button>

            <button
              onClick={() => {
                setExcelParsedResult(null);
                setExcelFileName('');
                setShowExcelImportModal(true);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                isLight
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/40'
              }`}
              title="Importa la taratura completa dal vostro foglio Excel storico (Formato RR-AF PRO / BIG 6 / Ristosano)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Importa Excel (.xlsx)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
              }`}
              title="Scarica il foglio Excel formattato identico al vostro modello storico per questa macchina"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" />
              <span>Esporta Excel (.xlsx)</span>
            </button>

            <button
              id="save-calibration-btn"
              onClick={handleSaveCalibration}
              disabled={isSaving}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all hover:scale-[1.02] ${
                saveSuccess
                  ? 'bg-emerald-600 shadow-emerald-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Taratura Salvata!</span>
                </>
              ) : isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvataggio...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salva Configurazione</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* FEEDBACK APPLICAZIONE MODELLO */}
        {templateNotification && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{templateNotification}</span>
            </div>
            <button
              onClick={() => setTemplateNotification(null)}
              className="text-xs font-bold underline cursor-pointer"
            >
              Chiudi
            </button>
          </div>
        )}

        {/* DETTAGLI VELOCI MACCHINA & ASSOCIAZIONE MATRICOLA */}
        {activeMachine && (
          <div className={`mt-4 pt-3 border-t space-y-3 ${
            isLight ? 'border-slate-200' : 'border-white/10'
          }`}>
            <div className={`p-3.5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              isLight ? 'bg-emerald-50/70 border-emerald-200' : 'bg-emerald-950/30 border-emerald-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-base shadow-sm ${
                  isLight ? 'bg-emerald-600 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      Taratura Associata alla Matricola:
                    </span>
                    <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-white dark:bg-black/40 border border-emerald-300 dark:border-emerald-600 text-emerald-900 dark:text-emerald-200">
                      #{activeMachine.serialNumber}
                    </span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      isLight ? 'bg-white text-slate-800 border border-slate-200' : 'bg-slate-800 text-white'
                    }`}>
                      Modello: {activeMachine.model}
                    </span>
                    {activeMachine.assignedDeviceMac && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300">
                        MAC: {activeMachine.assignedDeviceMac}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    <span className="font-semibold">{activeMachine.name}</span> &bull; {activeMachine.locationDetails?.company || 'Cliente'} ({activeMachine.locationDetails?.site || activeMachine.location})
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Switch Modalità Taratura vs Sola Battuta */}
                <button
                  type="button"
                  onClick={handleToggleCalibrationMode}
                  disabled={isTogglingCalibrationMode}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-sm ${
                    isCalibrationActive
                      ? isLight
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                      : isLight
                        ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                        : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border-blue-500/40'
                  }`}
                  title="Abilita o disabilita la gestione taratura e consumi per questa macchina. Se disabilitata, la telemetria funziona regolarmente sulle battute."
                >
                  {isTogglingCalibrationMode ? (
                    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isCalibrationActive ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span>
                    {isCalibrationActive ? 'Taratura & Consumi: ATTIVI' : 'Modalità: SOLA BATTUTA'}
                  </span>
                </button>

                <span className={`text-[11px] font-mono px-3 py-1.5 rounded-xl border ${
                  isLight ? 'bg-white text-slate-700 border-emerald-200' : 'bg-black/40 text-emerald-200 border-emerald-500/40'
                }`}>
                  Ultima taratura: {activeMachine.calibration?.lastUpdated ? new Date(activeMachine.calibration.lastUpdated).toLocaleDateString('it-IT') : 'Standard Iniziale'}
                </span>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Carica da Modello Base</span>
                </button>
              </div>
            </div>

            {/* BANNER INFORMATIVO SE LA MODALITÀ È DISABILITATA */}
            {!isCalibrationActive && (
              <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                isLight ? 'bg-blue-50/80 border-blue-200 text-blue-900' : 'bg-blue-950/40 border-blue-500/30 text-blue-200'
              }`}>
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <span className="font-bold">Telemetria Battute Regolare:</span> La gestione taratura e consumi è disabilitata per questa singola macchina. Tutte le battute, conteggi tasti, orari ed allarmi continuano a essere registrati normalmente.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleCalibrationMode}
                  disabled={isTogglingCalibrationMode}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition shrink-0 cursor-pointer"
                >
                  Abilita Taratura &amp; Consumi
                </button>
              </div>
            )}

            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}>
              <div>
                <span className="text-[10px] uppercase tracking-wider block opacity-70">I 6 Contenitori</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">6 Serbatoi (40, 120, 200 RPM)</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block opacity-70">Elettrovalvole (EV)</span>
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">{electrovalves.length} EV calibrate in cc/s</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block opacity-70">Pulsanti Erogazione</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">12 Dosi Piatto + 12 Dosi Zuppiera</span>
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider block opacity-70">Telemetria &amp; DDT</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{deliveries.length} Consegne per riconciliazione</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* WORKFLOW NAVIGATION: 1. CONTENITORI -> 2. EV -> 3. TASTI BICCHIERE -> 4. CARAFFA */}
      {/* ========================================================================= */}
      <div className={`flex flex-wrap items-center gap-2 border-b pb-2.5 ${
        isLight ? 'border-slate-200' : 'border-white/10'
      }`}>
        <button
          onClick={() => setActiveSubTab('canisters')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'canisters'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">1</span>
          <Scale className="w-4 h-4" />
          <span>I 6 Contenitori S1-S6 (40 / 120 / 200 RPM)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('evs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'evs'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">2</span>
          <Droplets className="w-4 h-4" />
          <span>7 Elettrovalvole EV (EV1..EV6 + Sola Acqua Calda EV7)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('standard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'standard'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">3</span>
          <Coffee className="w-4 h-4" />
          <span>12 Pulsanti Bicchiere / Piatto (P1 - P12)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('caraffa')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'caraffa'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">4</span>
          <Layers className="w-4 h-4" />
          <span>12 Pulsanti Caraffa / Zuppiera (Indipendenti)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reconciliation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'reconciliation'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : isLight
              ? 'text-slate-600 hover:bg-slate-100'
              : 'text-slate-400 hover:bg-white/5'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Riconciliazione DDT &amp; Consumi</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SEZIONE 1: INDICAZIONE DEI 6 CONTENITORI & VELOCITÀ MOTORE COCAGLIA */}
      {/* ========================================================================= */}
      {activeSubTab === 'canisters' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Passo 1: Indicazione dei 6 Contenitori &amp; Motoriduttori Coclea</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Esattamente 6 Serbatoi
                </span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Indica il prodotto contenuto in ciascun serbatoio, il tipo di motoriduttore installato (<strong>40 giri, 120 giri o 200 giri</strong>) e la portata in grammi al secondo (g/s).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {canisters.map((c) => {
              const stockPct = Math.min(100, Math.round((c.currentStockKg / c.containerCapacityKg) * 100));

              return (
                <div
                  key={c.id}
                  className={`rounded-2xl p-4 border transition-all space-y-3.5 ${
                    isLight
                      ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                      : 'bg-white/5 border-white/10 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                            {c.canisterNumber}
                          </span>
                          <input
                            type="text"
                            value={c.name}
                            onChange={(e) => handleUpdateCanister(c.id, 'name', e.target.value)}
                            className={`font-bold text-xs bg-transparent border-b focus:outline-none focus:border-emerald-500 w-full truncate ${
                              isLight ? 'text-slate-900 border-slate-200' : 'text-white border-white/10'
                            }`}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                            <Tag className="w-3 h-3" />
                            {c.itemCode || 'Cod. Non Definito'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                            {c.packageUnit || 'Busta 1 Kg'}
                          </span>
                          <span className={`text-[10px] font-mono ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}>
                            €{c.costPerKg.toFixed(2)}/Kg &bull; Cap: {c.containerCapacityKg} Kg
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 shrink-0">
                        {c.motorRpm} RPM
                      </span>
                    </div>

                    {/* Selezione Rapida o Ricerca da Elenco Articoli Ufficiali */}
                    <div className={`p-2 rounded-xl border space-y-1.5 ${
                      isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-blue-500" />
                          Seleziona Prodotto da Elenco:
                        </label>
                        <button
                          type="button"
                          onClick={() => setProductCatalogModal({ isOpen: true, canisterId: c.id, canisterNumber: c.canisterNumber })}
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                        >
                          <Search className="w-3 h-3" />
                          <span>Catalogo Completo</span>
                        </button>
                      </div>

                      <select
                        value={c.itemCode || ''}
                        onChange={(e) => {
                          const selectedArt = dbArticles.find(a => a.itemCode === e.target.value);
                          if (selectedArt) {
                            setCanisters((prev) =>
                              prev.map((item) =>
                                item.id === c.id
                                  ? {
                                      ...item,
                                      itemCode: selectedArt.itemCode,
                                      name: `Contenitore ${c.canisterNumber}: ${selectedArt.name}`,
                                      ingredientType: selectedArt.ingredientType,
                                      packageUnit: selectedArt.packageUnit || 'Busta 1 Kg',
                                      costPerKg: selectedArt.costPerKg || item.costPerKg,
                                      motorRpm: selectedArt.defaultRpm || item.motorRpm,
                                      gramsPerSecond: selectedArt.defaultGramsPerSecond || item.gramsPerSecond,
                                      nominalGramsPerDose: selectedArt.nominalGramsPerDose || item.nominalGramsPerDose,
                                    }
                                  : item
                              )
                            );
                          }
                        }}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isLight
                            ? 'bg-white border-slate-300 text-slate-900 focus:border-emerald-500'
                            : 'bg-black/40 border-white/10 text-white focus:border-emerald-500'
                        }`}
                      >
                        <option value="" disabled>-- Seleziona Articolo Ufficiale --</option>
                        {dbArticles.map((art) => (
                          <option key={art.itemCode} value={art.itemCode}>
                            [{art.itemCode}] {art.name} ({art.defaultRpm || 120} RPM - €{art.costPerKg?.toFixed(2) || '0.00'}/Kg)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Selezione Velocità Motore (40 / 120 / 200 giri) */}
                  <div className={`p-2.5 rounded-xl border space-y-1.5 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/30 border-white/5'
                  }`}>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block">
                      Motoriduttore Coclea Installato:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {([40, 120, 200] as MotorRpmType[]).map((rpm) => (
                        <button
                          key={rpm}
                          type="button"
                          onClick={() => handleUpdateCanister(c.id, 'motorRpm', rpm)}
                          className={`py-1.5 rounded-lg text-xs font-bold font-mono transition-all border ${
                            c.motorRpm === rpm
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : isLight
                              ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                          }`}
                        >
                          {rpm} Giri
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Portata Grammi al Secondo & Prova Pesata */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-2 rounded-xl border ${
                      isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className="text-[10px] text-slate-500 block">Portata Coclea:</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={c.gramsPerSecond}
                          onChange={(e) => handleUpdateCanister(c.id, 'gramsPerSecond', parseFloat(e.target.value) || 0)}
                          className={`w-16 font-mono font-bold text-xs bg-transparent border-b focus:outline-none focus:border-emerald-500 ${
                            isLight ? 'text-emerald-900 border-emerald-300' : 'text-emerald-300 border-emerald-500/40'
                          }`}
                        />
                        <span className="font-mono text-[10px] text-slate-400">g/sec</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTestScaleModal({
                          isOpen: true,
                          canisterId: c.id,
                          canisterName: c.name,
                          motorRpm: c.motorRpm,
                          testDurationSec: 5.0,
                          measuredWeightGrams: Number((5.0 * c.gramsPerSecond).toFixed(1)),
                        })
                      }
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all text-xs font-semibold ${
                        isLight
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      <Scale className="w-3.5 h-3.5 mb-0.5" />
                      <span>Test Bilancino</span>
                    </button>
                  </div>

                  {/* Giacenza & Capacità Serbatoio */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Giacenza Serbatoio:</span>
                      <span>{c.currentStockKg.toFixed(1)} / {c.containerCapacityKg} Kg ({stockPct}%)</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                      <div
                        className={`h-full rounded-full ${
                          stockPct < 25 ? 'bg-rose-500' : stockPct < 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEZIONE 2: LE 7 ELETTROVALVOLE EV (1 PER CONTENITORE + SOLA ACQUA CALDA) */}
      {/* ========================================================================= */}
      {activeSubTab === 'evs' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Passo 2: 7 Elettrovalvole (EV1..EV6 per i 6 Contenitori + EV7 Sola Acqua Calda)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                  Configurazione 7 EV
                </span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                La macchina gestisce <strong>7 elettrovalvole idrauliche indipendenti</strong>: una elettrovalvola dedicata per ciascun contenitore polvere (<strong>EV1 - EV6</strong> per le rispettive campane o frullini mixer) e una elettrovalvola per la <strong>sola acqua calda diretta (EV7)</strong>. La portata di ciascuna EV viene tarata in <strong>cc al secondo (cc/s)</strong> con il cilindro graduato.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {electrovalves.map((ev) => {
              const isHotWaterOnly = ev.evNumber === 7;
              const associatedCanister = !isHotWaterOnly ? canisters.find((c) => c.canisterNumber === ev.evNumber) : null;

              return (
                <div
                  key={ev.id}
                  className={`rounded-2xl p-4 border transition-all space-y-3 ${
                    isHotWaterOnly
                      ? isLight
                        ? 'bg-blue-50/60 border-blue-300 shadow-sm ring-1 ring-blue-400/20'
                        : 'bg-blue-950/20 border-blue-500/40 hover:border-blue-400/60'
                      : isLight
                      ? 'bg-white border-slate-200 shadow-sm hover:border-cyan-300'
                      : 'bg-white/5 border-white/10 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-7 h-7 rounded-lg text-white font-bold text-xs flex items-center justify-center font-mono shadow-sm ${
                        isHotWaterOnly ? 'bg-blue-600' : 'bg-cyan-600'
                      }`}>
                        EV{ev.evNumber}
                      </span>
                      {isHotWaterOnly ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                          <Droplets className="w-2.5 h-2.5" />
                          Sola Acqua Calda
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Contenitore {ev.evNumber}
                        </span>
                      )}
                    </div>
                    <span className={`text-[11px] font-mono font-bold ${
                      isHotWaterOnly ? 'text-blue-600 dark:text-blue-400' : 'text-cyan-600 dark:text-cyan-400'
                    }`}>
                      {ev.flowRateCcPerSec.toFixed(1)} cc/s
                    </span>
                  </div>

                  <div>
                    <input
                      type="text"
                      value={ev.name}
                      onChange={(e) => handleUpdateEv(ev.id, 'name', e.target.value)}
                      className={`w-full font-bold text-xs bg-transparent border-b focus:outline-none focus:border-cyan-500 ${
                        isLight ? 'text-slate-900 border-slate-200' : 'text-white border-white/10'
                      }`}
                    />
                    <input
                      type="text"
                      value={ev.description || ''}
                      placeholder={isHotWaterOnly ? "Erogazione diretta acqua bollente per tè e allungamento..." : `Elettrovalvola dedicata al Contenitore ${ev.evNumber}...`}
                      onChange={(e) => handleUpdateEv(ev.id, 'description', e.target.value)}
                      className={`w-full text-[10px] text-slate-400 bg-transparent border-b mt-1 focus:outline-none ${
                        isLight ? 'border-slate-100' : 'border-white/5'
                      }`}
                    />
                    {associatedCanister && (
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <span className="truncate">Polvere: <strong>{associatedCanister.name.split(':')[1]?.trim() || associatedCanister.name}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                    isHotWaterOnly
                      ? isLight ? 'bg-blue-100/40 border-blue-200' : 'bg-blue-950/30 border-blue-800/40'
                      : isLight ? 'bg-cyan-50/50 border-cyan-100' : 'bg-cyan-950/20 border-cyan-900/30'
                  }`}>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Portata cc/s:</span>
                      <input
                        type="number"
                        step="0.5"
                        min="1"
                        value={ev.flowRateCcPerSec}
                        onChange={(e) => handleUpdateEv(ev.id, 'flowRateCcPerSec', parseFloat(e.target.value) || 0)}
                        className={`w-16 font-mono font-bold text-sm bg-transparent border-b focus:outline-none ${
                          isHotWaterOnly ? 'text-blue-600 dark:text-blue-400' : 'text-cyan-600 dark:text-cyan-400'
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setTestWaterModal({
                          isOpen: true,
                          evId: ev.id,
                          evName: ev.name,
                          testDurationSec: 10.0,
                          measuredCc: Math.round(10.0 * ev.flowRateCcPerSec),
                        })
                      }
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        isHotWaterOnly
                          ? isLight
                            ? 'bg-white hover:bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-black/40 hover:bg-blue-500/20 text-blue-300 border-blue-500/30'
                          : isLight
                          ? 'bg-white hover:bg-cyan-100 text-cyan-700 border-cyan-200'
                          : 'bg-black/40 hover:bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      <Droplets className="w-3 h-3" />
                      <span>Cilindro cc</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEZIONE 3: I 12 PULSANTI BICCHIERE (P1 - P12) */}
      {/* ========================================================================= */}
      {activeSubTab === 'standard' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Passo 3: Regolazione 12 Pulsanti Bicchiere (P1 - P12)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Tasti Standard
                </span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Per ogni pulsante seleziona <strong>con quali contenitori funzionare</strong> e i <strong>secondi di coclea</strong> per ciascuno; poi seleziona <strong>quali EV aprire</strong> e i <strong>secondi di acqua</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScaleStandardToCaraffa(4)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isLight
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}
                title="Copia e moltiplica per 4x tempi nei prodotti caraffa"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Preimposta Caraffa (4x)</span>
              </button>
            </div>
          </div>

          {/* LISTA SCHEDE DETTAGLIATE DEI 12 PULSANTI BICCHIERE */}
          <div className="space-y-3">
            {standardProducts.map((p) => {
              const totals = calculateBeverageTotals(p);

              return (
                <div
                  key={p.key}
                  className={`rounded-2xl border p-4 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 shadow-sm hover:border-emerald-300'
                      : 'bg-white/5 border-white/10 hover:border-emerald-500/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-md shadow-emerald-600/20">
                        {p.key}
                      </span>
                      <div>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            handleUpdateStandardProduct(p.key, { ...p, name: e.target.value })
                          }
                          className={`font-bold text-sm bg-transparent border-b focus:outline-none focus:border-emerald-500 ${
                            isLight ? 'text-slate-900 border-slate-200' : 'text-white border-white/10'
                          }`}
                        />
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>Dose Totale: <strong className="text-emerald-600 dark:text-emerald-400">{totals.totalGrams} g</strong> polvere</span>
                          <span>&bull;</span>
                          <span>Volume: <strong className="text-cyan-600 dark:text-cyan-400">{totals.totalWaterCc} cc</strong> acqua</span>
                          <span>&bull;</span>
                          <span>Costo Materia: <strong className="text-emerald-600 dark:text-emerald-400">€{totals.totalCost.toFixed(3)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingBeverage({
                          isOpen: true,
                          isCaraffa: false,
                          beverage: p,
                        })
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all self-start lg:self-center ${
                        isLight
                          ? 'bg-slate-100 hover:bg-emerald-100 text-emerald-800 border-slate-200'
                          : 'bg-white/5 hover:bg-emerald-500/20 text-emerald-300 border-white/10'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configura Pulsante {p.key}</span>
                    </button>
                  </div>

                  {/* CONTENITORI & EV ASSOCIATI A QUESTO PULSANTE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                    {/* Contenitori attivi */}
                    <div className={`p-3 rounded-xl border ${
                      isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-2 flex items-center justify-between">
                        <span>Contenitori &amp; Coclee Assegnati:</span>
                        <span className="font-normal text-slate-400">{totals.canisterDetails.length} attivi</span>
                      </span>
                      <div className="space-y-1.5">
                        {canisters.map((c) => {
                          const timing = p.canisterTimings?.find((ct) => ct.canisterId === c.id);
                          const isEnabled = timing?.enabled || false;
                          const sec = timing?.motorDurationSec || 0;
                          const grams = Number((sec * c.gramsPerSecond).toFixed(1));

                          return (
                            <div
                              key={c.id}
                              className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                isEnabled
                                  ? isLight
                                    ? 'bg-emerald-50/80 border-emerald-200 text-slate-900'
                                    : 'bg-emerald-950/30 border-emerald-500/30 text-white'
                                  : 'bg-transparent border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) =>
                                    handleToggleCanisterForBeverage(p, c.id, e.target.checked, false)
                                  }
                                  className="w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500"
                                />
                                <span className="font-medium text-xs">Cont. {c.canisterNumber} ({c.name.split(':')[1]?.trim() || c.name})</span>
                              </label>

                              {isEnabled && (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="30"
                                      value={sec}
                                      onChange={(e) =>
                                        handleCanisterDurationChange(p, c.id, parseFloat(e.target.value) || 0, false)
                                      }
                                      className="w-14 text-center font-bold bg-transparent border-b border-emerald-400 text-emerald-700 dark:text-emerald-300 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400">sec</span>
                                  </div>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                                    ({grams}g)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Elettrovalvole (EV) attive */}
                    <div className={`p-3 rounded-xl border ${
                      isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 block mb-2 flex items-center justify-between">
                        <span>Elettrovalvole EV Assegnate:</span>
                        <span className="font-normal text-slate-400">{totals.evDetails.length} attive</span>
                      </span>
                      <div className="space-y-1.5">
                        {electrovalves.map((ev) => {
                          const timing = p.evTimings?.find((et) => et.evId === ev.id);
                          const isEnabled = timing?.enabled || false;
                          const sec = timing?.waterDurationSec || 0;
                          const cc = Number((sec * ev.flowRateCcPerSec).toFixed(0));

                          return (
                            <div
                              key={ev.id}
                              className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                isEnabled
                                  ? isLight
                                    ? 'bg-cyan-50/80 border-cyan-200 text-slate-900'
                                    : 'bg-cyan-950/30 border-cyan-500/30 text-white'
                                  : 'bg-transparent border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) =>
                                    handleToggleEvForBeverage(p, ev.id, e.target.checked, false)
                                  }
                                  className="w-3.5 h-3.5 text-cyan-600 rounded focus:ring-cyan-500"
                                />
                                <span className="font-medium text-xs">{ev.name}</span>
                              </label>

                              {isEnabled && (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      max="60"
                                      value={sec}
                                      onChange={(e) =>
                                        handleEvDurationChange(p, ev.id, parseFloat(e.target.value) || 0, false)
                                      }
                                      className="w-14 text-center font-bold bg-transparent border-b border-cyan-400 text-cyan-700 dark:text-cyan-300 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400">sec</span>
                                  </div>
                                  <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                                    ({cc}cc)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEZIONE 4: I 12 PULSANTI VERSIONE CARAFFA (INDIPENDENTI) */}
      {/* ========================================================================= */}
      {activeSubTab === 'caraffa' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Passo 4: Regolazione 12 Pulsanti Caraffa (P1 - P12)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Taratura Indipendente
                </span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Anche per la caraffa puoi scegliere liberamente <strong>quali contenitori attivare</strong> e i relativi <strong>secondi coclea</strong>, oltre a <strong>quali EV aprire</strong> e i relativi <strong>secondi di acqua</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleScaleStandardToCaraffa(4)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isLight
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
                title="Resetta i tempi della caraffa a 4x rispetto al bicchiere"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ripristina Base 4x</span>
              </button>
            </div>
          </div>

          {/* LISTA DEI 12 PULSANTI CARAFFA */}
          <div className="space-y-3">
            {caraffaProducts.map((p) => {
              const totals = calculateBeverageTotals(p);

              return (
                <div
                  key={p.key}
                  className={`rounded-2xl border p-4 transition-all ${
                    isLight
                      ? 'bg-white border-slate-200 shadow-sm hover:border-amber-300'
                      : 'bg-white/5 border-white/10 hover:border-amber-500/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-amber-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-md shadow-amber-600/20">
                        C-{p.key}
                      </span>
                      <div>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) =>
                            handleUpdateCaraffaProduct(p.key, { ...p, name: e.target.value })
                          }
                          className={`font-bold text-sm bg-transparent border-b focus:outline-none focus:border-amber-500 ${
                            isLight ? 'text-slate-900 border-slate-200' : 'text-white border-white/10'
                          }`}
                        />
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span>Polvere: <strong className="text-amber-600 dark:text-amber-400">{totals.totalGrams} g</strong></span>
                          <span>&bull;</span>
                          <span>Volume Caraffa: <strong className="text-cyan-600 dark:text-cyan-400">{totals.totalWaterCc} cc</strong> ({(totals.totalWaterCc / 1000).toFixed(2)} L)</span>
                          <span>&bull;</span>
                          <span>Costo: <strong className="text-emerald-600 dark:text-emerald-400">€{totals.totalCost.toFixed(2)}</strong></span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setEditingBeverage({
                          isOpen: true,
                          isCaraffa: true,
                          beverage: p,
                        })
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all self-start lg:self-center ${
                        isLight
                          ? 'bg-slate-100 hover:bg-amber-100 text-amber-800 border-slate-200'
                          : 'bg-white/5 hover:bg-amber-500/20 text-amber-300 border-white/10'
                      }`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Configura Caraffa C-{p.key}</span>
                    </button>
                  </div>

                  {/* CONTENITORI & EV ATTIVE CARAFFA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs">
                    {/* Contenitori attivi */}
                    <div className={`p-3 rounded-xl border ${
                      isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block mb-2 flex items-center justify-between">
                        <span>Contenitori Attivi Caraffa:</span>
                        <span className="font-normal text-slate-400">{totals.canisterDetails.length} attivi</span>
                      </span>
                      <div className="space-y-1.5">
                        {canisters.map((c) => {
                          const timing = p.canisterTimings?.find((ct) => ct.canisterId === c.id);
                          const isEnabled = timing?.enabled || false;
                          const sec = timing?.motorDurationSec || 0;
                          const grams = Number((sec * c.gramsPerSecond).toFixed(1));

                          return (
                            <div
                              key={c.id}
                              className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                isEnabled
                                  ? isLight
                                    ? 'bg-amber-50/80 border-amber-200 text-slate-900'
                                    : 'bg-amber-950/30 border-amber-500/30 text-white'
                                  : 'bg-transparent border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) =>
                                    handleToggleCanisterForBeverage(p, c.id, e.target.checked, true)
                                  }
                                  className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500"
                                />
                                <span className="font-medium text-xs">Cont. {c.canisterNumber} ({c.name.split(':')[1]?.trim() || c.name})</span>
                              </label>

                              {isEnabled && (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="120"
                                      value={sec}
                                      onChange={(e) =>
                                        handleCanisterDurationChange(p, c.id, parseFloat(e.target.value) || 0, true)
                                      }
                                      className="w-14 text-center font-bold bg-transparent border-b border-amber-400 text-amber-700 dark:text-amber-300 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400">sec</span>
                                  </div>
                                  <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                                    ({grams}g)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* EV attive */}
                    <div className={`p-3 rounded-xl border ${
                      isLight ? 'bg-slate-50/70 border-slate-200' : 'bg-black/20 border-white/5'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 block mb-2 flex items-center justify-between">
                        <span>Elettrovalvole EV Caraffa:</span>
                        <span className="font-normal text-slate-400">{totals.evDetails.length} attive</span>
                      </span>
                      <div className="space-y-1.5">
                        {electrovalves.map((ev) => {
                          const timing = p.evTimings?.find((et) => et.evId === ev.id);
                          const isEnabled = timing?.enabled || false;
                          const sec = timing?.waterDurationSec || 0;
                          const cc = Number((sec * ev.flowRateCcPerSec).toFixed(0));

                          return (
                            <div
                              key={ev.id}
                              className={`flex items-center justify-between p-1.5 rounded-lg border transition-all ${
                                isEnabled
                                  ? isLight
                                    ? 'bg-cyan-50/80 border-cyan-200 text-slate-900'
                                    : 'bg-cyan-950/30 border-cyan-500/30 text-white'
                                  : 'bg-transparent border-transparent text-slate-400 opacity-60'
                              }`}
                            >
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isEnabled}
                                  onChange={(e) =>
                                    handleToggleEvForBeverage(p, ev.id, e.target.checked, true)
                                  }
                                  className="w-3.5 h-3.5 text-cyan-600 rounded focus:ring-cyan-500"
                                />
                                <span className="font-medium text-xs">{ev.name}</span>
                              </label>

                              {isEnabled && (
                                <div className="flex items-center gap-2 font-mono text-xs">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="200"
                                      value={sec}
                                      onChange={(e) =>
                                        handleEvDurationChange(p, ev.id, parseFloat(e.target.value) || 0, true)
                                      }
                                      className="w-14 text-center font-bold bg-transparent border-b border-cyan-400 text-cyan-700 dark:text-cyan-300 focus:outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400">sec</span>
                                  </div>
                                  <span className="font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                                    ({cc}cc)
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SEZIONE 5: RICONCILIAZIONE DDT & CONSUMI TELEMETRIA */}
      {/* ========================================================================= */}
      {activeSubTab === 'reconciliation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <span>Riconciliazione Merce Consegnata (DDT) vs Consumi Reali Telemetria</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Modulo Telemetria
                </span>
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Questa vista metterà a confronto i kg di prodotto scaricati tramite le bolle DDT con i kg effettivamente consumati, calcolati moltiplicando le battute registrate dal modulo ESP32 per i tempi di coclea tarati.
              </p>
            </div>
          </div>

          <div className={`p-6 rounded-2xl border text-center space-y-3 ${
            isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
          }`}>
            <PackageCheck className="w-12 h-12 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h4 className="font-bold text-sm">In attesa dei dati di telemetria dal campo</h4>
            <p className="text-xs text-slate-400 max-w-lg mx-auto">
              Non appena la scheda PCB con l&apos;ESP32-S3 sarà installata sul distributore e inizierà ad inviare i dati delle selezioni (P1 - P12), il sistema calcolerà in automatico i consumi in grammi di ciascuno dei 6 contenitori e li confronterà con le consegne DDT.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DI CONFIGURAZIONE COMPLETA PULSANTE (BEVERAGE CONFIG) */}
      {/* ========================================================================= */}
      {editingBeverage && editingBeverage.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className={`w-8 h-8 rounded-xl font-mono font-bold text-sm text-white flex items-center justify-center ${
                  editingBeverage.isCaraffa ? 'bg-amber-600' : 'bg-emerald-600'
                }`}>
                  {editingBeverage.isCaraffa ? `C-${editingBeverage.beverage.key}` : editingBeverage.beverage.key}
                </span>
                <div>
                  <h4 className="font-bold text-sm">
                    Regolazione Ricetta: {editingBeverage.beverage.name}
                  </h4>
                  <span className="text-[10px] text-slate-400">
                    {editingBeverage.isCaraffa ? 'Versione Caraffa (Volume esteso)' : 'Versione Bicchiere (Tazza singola)'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setEditingBeverage(null)}
                className="p-1 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SELEZIONE CONTENITORI (1-6) CON TEMPI */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>1. Contenitori Polvere da attivare per questo tasto:</span>
                <span className="text-[10px] text-slate-400 font-normal">Spunta i contenitori e imposta i secondi coclea</span>
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {canisters.map((c) => {
                  const timing = editingBeverage.beverage.canisterTimings?.find((ct) => ct.canisterId === c.id);
                  const isEnabled = timing?.enabled || false;
                  const sec = timing?.motorDurationSec || 0;
                  const grams = Number((sec * c.gramsPerSecond).toFixed(1));

                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        isEnabled
                          ? isLight
                            ? 'bg-emerald-50/70 border-emerald-300'
                            : 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) =>
                              handleToggleCanisterForBeverage(
                                editingBeverage.beverage,
                                c.id,
                                e.target.checked,
                                editingBeverage.isCaraffa
                              )
                            }
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <span className="font-bold text-xs">Cont. {c.canisterNumber}</span>
                        </label>
                        <span className="text-[10px] text-slate-400">{c.motorRpm} RPM</span>
                      </div>

                      <div className="text-[10px] text-slate-500 truncate">
                        {c.name.split(':')[1]?.trim() || c.name}
                      </div>

                      {isEnabled && (
                        <div className="flex items-center justify-between pt-1 border-t border-emerald-200/50 dark:border-emerald-800/50">
                          <span className="text-[10px] text-slate-400">Secondi Coclea:</span>
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="120"
                              value={sec}
                              onChange={(e) =>
                                handleCanisterDurationChange(
                                  editingBeverage.beverage,
                                  c.id,
                                  parseFloat(e.target.value) || 0,
                                  editingBeverage.isCaraffa
                                )
                              }
                              className="w-14 text-center font-bold bg-transparent border-b border-emerald-500 text-emerald-600 dark:text-emerald-300 focus:outline-none"
                            />
                            <span className="text-[10px]">sec</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">({grams}g)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SELEZIONE ELETTROVALVOLE (EV) CON TEMPI */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <h5 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 flex items-center justify-between">
                <span>2. Elettrovalvole EV da aprire per questo tasto:</span>
                <span className="text-[10px] text-slate-400 font-normal">Spunta le EV e imposta i secondi di acqua</span>
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {electrovalves.map((ev) => {
                  const timing = editingBeverage.beverage.evTimings?.find((et) => et.evId === ev.id);
                  const isEnabled = timing?.enabled || false;
                  const sec = timing?.waterDurationSec || 0;
                  const cc = Number((sec * ev.flowRateCcPerSec).toFixed(0));

                  return (
                    <div
                      key={ev.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        isEnabled
                          ? isLight
                            ? 'bg-cyan-50/70 border-cyan-300'
                            : 'bg-cyan-950/30 border-cyan-500/40'
                          : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) =>
                              handleToggleEvForBeverage(
                                editingBeverage.beverage,
                                ev.id,
                                e.target.checked,
                                editingBeverage.isCaraffa
                              )
                            }
                            className="w-4 h-4 text-cyan-600 rounded"
                          />
                          <span className="font-bold text-xs">{ev.name}</span>
                        </label>
                        <span className="text-[10px] text-slate-400">{ev.flowRateCcPerSec} cc/s</span>
                      </div>

                      {isEnabled && (
                        <div className="flex items-center justify-between pt-1 border-t border-cyan-200/50 dark:border-cyan-800/50">
                          <span className="text-[10px] text-slate-400">Secondi Acqua:</span>
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="200"
                              value={sec}
                              onChange={(e) =>
                                handleEvDurationChange(
                                  editingBeverage.beverage,
                                  ev.id,
                                  parseFloat(e.target.value) || 0,
                                  editingBeverage.isCaraffa
                                )
                              }
                              className="w-14 text-center font-bold bg-transparent border-b border-cyan-500 text-cyan-600 dark:text-cyan-300 focus:outline-none"
                            />
                            <span className="text-[10px]">sec</span>
                            <span className="font-bold text-cyan-600 dark:text-cyan-400">({cc}cc)</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIEPILOGO DOSE CALCOLATA */}
            {(() => {
              const totals = calculateBeverageTotals(editingBeverage.beverage);
              return (
                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-mono ${
                  isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-500/30'
                }`}>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Grammi Totali Polveri:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{totals.totalGrams} g</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Acqua Totale Erogata:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400 text-sm">{totals.totalWaterCc} cc</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-sans">Costo Materia Prima:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">€{totals.totalCost.toFixed(3)}</span>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingBeverage(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Chiudi e Conferma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DI TEST BILANCINO (PESATA CONTENITORE) */}
      {/* ========================================================================= */}
      {testScaleModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-sm">Test di Pesata con Bilancino</h4>
              </div>
              <button
                onClick={() => setTestScaleModal({ ...testScaleModal, isOpen: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Fai girare la coclea del <strong>{testScaleModal.canisterName}</strong> per i secondi indicati raccogliendo la polvere in un bicchierino e pesala sul bilancino.
            </p>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Tempo di Azionamento (Secondi):</label>
                <input
                  type="number"
                  step="0.5"
                  value={testScaleModal.testDurationSec}
                  onChange={(e) =>
                    setTestScaleModal({ ...testScaleModal, testDurationSec: parseFloat(e.target.value) || 1 })
                  }
                  className="w-full p-2.5 rounded-xl border font-bold text-sm bg-transparent border-slate-300 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Peso Rilevato su Bilancino (Grammi):</label>
                <input
                  type="number"
                  step="0.1"
                  value={testScaleModal.measuredWeightGrams}
                  onChange={(e) =>
                    setTestScaleModal({ ...testScaleModal, measuredWeightGrams: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 rounded-xl border font-bold text-sm bg-transparent border-emerald-500 text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <span className="text-[10px] text-slate-400 block font-sans">Portata Calcolata:</span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {(testScaleModal.measuredWeightGrams / Math.max(0.1, testScaleModal.testDurationSec)).toFixed(2)} g/secondo
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTestScaleModal({ ...testScaleModal, isOpen: false })}
                className="px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/10"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleApplyScaleCalibration}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30"
              >
                Salva Taratura Coclea
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DI TEST CILINDRO (TARATURA ACQUA ELETTROVALVOLA) */}
      {/* ========================================================================= */}
      {testWaterModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-cyan-500" />
                <h4 className="font-bold text-sm">Taratura Acqua con Cilindro Graduato</h4>
              </div>
              <button
                onClick={() => setTestWaterModal({ ...testWaterModal, isOpen: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Apri l&apos;elettrovalvola <strong>{testWaterModal.evName}</strong> per i secondi impostati e misura i cc (ml) di acqua raccolti nel cilindro graduato.
            </p>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Tempo di Apertura EV (Secondi):</label>
                <input
                  type="number"
                  step="1"
                  value={testWaterModal.testDurationSec}
                  onChange={(e) =>
                    setTestWaterModal({ ...testWaterModal, testDurationSec: parseFloat(e.target.value) || 1 })
                  }
                  className="w-full p-2.5 rounded-xl border font-bold text-sm bg-transparent border-slate-300 dark:border-white/10"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block">Volume Raccolto (cc / ml):</label>
                <input
                  type="number"
                  step="5"
                  value={testWaterModal.measuredCc}
                  onChange={(e) =>
                    setTestWaterModal({ ...testWaterModal, measuredCc: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full p-2.5 rounded-xl border font-bold text-sm bg-transparent border-cyan-500 text-cyan-600 dark:text-cyan-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-center">
                <span className="text-[10px] text-slate-400 block font-sans">Portata Calcolata:</span>
                <span className="text-lg font-black text-cyan-600 dark:text-cyan-400">
                  {(testWaterModal.measuredCc / Math.max(0.1, testWaterModal.testDurationSec)).toFixed(1)} cc/secondo
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTestWaterModal({ ...testWaterModal, isOpen: false })}
                className="px-3 py-2 rounded-xl text-xs font-semibold hover:bg-white/10"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleApplyWaterCalibration}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30"
              >
                Salva Taratura EV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 4: SELEZIONE MODELLO STANDARD DA APPLICARE ALLA MATRICOLA          */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    Modelli di Taratura Standard
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Associa un set collaudato di dosaggi alla matricola <strong className="text-emerald-600 dark:text-emerald-400 font-mono">#{activeMachine?.serialNumber}</strong> ({activeMachine?.name})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className={`p-3 rounded-2xl border text-xs ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}>
              <span className="font-bold">Regola Operativa:</span> La taratura delle macchine è strettamente collegata alla matricola della macchina. Seleziona un modello standard da cui partire per pre-impostare i 6 contenitori (RPM 40/120/200), le elettrovalvole (cc/s) e i tempi dei 12+12 pulsanti (Bicchiere e Caraffa). Potrai poi affinarli in ogni momento.
            </div>

            <div className="space-y-3">
              {templates.map((tpl) => {
                const isRecommended = activeMachine?.model && (tpl.modelTarget === activeMachine.model || tpl.modelTarget === 'Universale');
                return (
                  <div
                    key={tpl.id}
                    className={`p-4 rounded-2xl border transition-all hover:border-emerald-500/60 ${
                      isRecommended
                        ? isLight
                          ? 'bg-emerald-50/40 border-emerald-300'
                          : 'bg-emerald-950/20 border-emerald-500/40'
                        : isLight
                        ? 'bg-slate-50 border-slate-200'
                        : 'bg-slate-800/40 border-white/5'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black">{tpl.name}</span>
                          {isRecommended && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-sm">
                              Consigliato per {activeMachine?.model}
                            </span>
                          )}
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                            isLight ? 'bg-white text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-white/10'
                          }`}>
                            Target: {tpl.modelTarget}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {tpl.description}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Layers className="w-3 h-3 text-emerald-500" />
                            6 Contenitori ({tpl.calibration?.canisters?.map((c) => `${c.motorRpm} RPM`).slice(0, 3).join(', ')}...)
                          </span>
                          <span>&bull;</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Droplets className="w-3 h-3 text-cyan-500" />
                            {tpl.calibration?.electrovalves?.length || 7} EV ({tpl.calibration?.waterFlowCcPerSec || 15} cc/s)
                          </span>
                          <span>&bull;</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Coffee className="w-3 h-3 text-amber-500" />
                            12 Standard + 12 Caraffa
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleApplyTemplate(tpl)}
                        disabled={isApplyingTemplate}
                        className="self-start sm:self-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                      >
                        {isApplyingTemplate ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Applicazione...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Applica a #{activeMachine?.serialNumber}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-inherit">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE 5: SALVA CONFIGURAZIONE COME NUOVO MODELLO STANDARD                */}
      {/* ========================================================================= */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-5 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    Salva come Modello Standard
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Crea un nuovo template riutilizzabile su altre macchine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveTemplateModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Nome del Modello Standard *
                </label>
                <input
                  type="text"
                  placeholder="Es. Ristosano Ospedale Standard, Asia Fast..."
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Modello Macchina Target
                </label>
                <select
                  value={newTemplateTarget}
                  onChange={(e) => setNewTemplateTarget(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                >
                  <option value="Ristosano">Ristosano (6 Contenitori)</option>
                  <option value="Big 5">Big 5 (5 Contenitori)</option>
                  <option value="Asia">Asia</option>
                  <option value="Universale">Universale</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Descrizione o Note Tecniche
                </label>
                <textarea
                  rows={3}
                  placeholder="Descrivi la configurazione di grammature e tempi impostata..."
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-800 border-white/10 text-white'
                  }`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-inherit">
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(false)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salva Modello</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE IMPORTAZIONE TARATURA DA EXCEL STORICO (.xlsx / .xls)              */}
      {/* ========================================================================= */}
      {showExcelImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-3xl rounded-3xl p-6 border shadow-2xl space-y-5 my-8 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-white/10 text-white'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-inherit">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                    <span>Importa Taratura da Foglio Excel Storico</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono">
                      .xlsx / .xls
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Compatibile con il modello storico di fabbrica (Formato RR-AF PRO / BIG 6 CATERING / RISTOSANO)
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelParsedResult(null);
                  setExcelFileName('');
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Area Drag & Drop / Selezione File */}
            {!excelParsedResult && (
              <div className="space-y-4">
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleExcelFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                    isLight
                      ? 'border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50'
                      : 'border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/30'
                  }`}
                  onClick={() => {
                    const input = document.getElementById('excel-file-input');
                    if (input) input.click();
                  }}
                >
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleExcelFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Upload className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                    Trascina qui il vostro foglio Excel di taratura
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    oppure clicca per selezionare il file dal tuo computer (.xlsx o .xls)
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Sfoglia File Excel...</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportExcel();
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10'
                      }`}
                      title="Scarica subito una copia del foglio Excel storico 1:1 con i dati attuali"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-500" />
                      <span>Scarica Modello Excel Storico (.xlsx)</span>
                    </button>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-800/60 border-white/10 text-slate-300'
                }`}>
                  <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-emerald-500" />
                    <span>Parametri riconosciuti ed estratti in automatico dal vostro foglio:</span>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>I 6 Contenitori Polveri S1..S6</strong> (Nomi, RPM coclea 120/200, ritardo)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>7 Elettrovalvole EV</strong> (EV1..EV6 mixer + EV7 sola Acqua Calda)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>12 Ricette PIATTO</strong> (tempi acqua ed erogazione polvere per P1..P12)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>12 Ricette ZUPPIERA</strong> (dosi caraffa indipendenti per P1..P12)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>Dati Macchina</strong> (Data, Modello, Matricola, Caldaia a 90°C, Delta R2)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span><strong>Portate Acqua</strong> (cc/sec per ciascuna EV e per Acqua Calda diretta)</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Spinner durante il caricamento */}
            {excelImportLoading && (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Analisi del foglio Excel in corso...
                </p>
              </div>
            )}

            {/* Risultato Analisi Excel */}
            {excelParsedResult && !excelImportLoading && (
              <div className="space-y-4">
                {excelParsedResult.success ? (
                  <div className="space-y-4">
                    {/* Banner Successo con Metadati */}
                    <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span>File "{excelFileName}" analizzato con successo!</span>
                        </div>
                        <button
                          onClick={() => {
                            setExcelParsedResult(null);
                            setExcelFileName('');
                          }}
                          className="text-xs underline font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                        >
                          Carica un altro file
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-500/20 text-xs">
                        <div>
                          <span className="text-[10px] uppercase opacity-70 block">Modello Excel</span>
                          <span className="font-bold">{excelParsedResult.metadata.model || 'Non specificato'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase opacity-70 block">Matricola nel File</span>
                          <span className="font-bold font-mono">#{excelParsedResult.metadata.serialNumber || 'N/D'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase opacity-70 block">Data Taratura</span>
                          <span className="font-bold">{excelParsedResult.metadata.date || 'Recente'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase opacity-70 block">Formato / Caldaia</span>
                          <span className="font-bold">
                            {excelParsedResult.metadata.boilerTempC ? `${excelParsedResult.metadata.boilerTempC}°C` : '90°C'}
                            {excelParsedResult.metadata.deltaR2 ? ` (Δ ${excelParsedResult.metadata.deltaR2}°C)` : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dettagli Contenitori Rilevati S1..S6 */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-emerald-500" />
                        <span>I 6 Contenitori Polveri Rilevati (S1..S6)</span>
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        {excelParsedResult.containersDetected.map((c) => (
                          <div
                            key={c.slot}
                            className={`p-2.5 rounded-xl border ${
                              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/80 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {c.slot}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                                {c.rpm} RPM
                              </span>
                            </div>
                            <div className="font-bold text-[11px] truncate" title={c.name}>
                              {c.name}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                              <span>EV cc/s: {c.evCcSec}</span>
                              <span>Rit: {c.delaySec}s</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dettagli EV e Ricette Piatto & Zuppiera */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className={`p-3 rounded-2xl border ${
                        isLight ? 'bg-cyan-50/60 border-cyan-200' : 'bg-cyan-950/30 border-cyan-500/30'
                      }`}>
                        <div className="flex items-center gap-2 font-bold text-cyan-800 dark:text-cyan-200 mb-1">
                          <Droplets className="w-4 h-4 text-cyan-500" />
                          <span>7 Elettrovalvole (EV1..EV7)</span>
                        </div>
                        <p className="text-[11px] text-cyan-700 dark:text-cyan-300">
                          Configurate 6 EV dedicate ai contenitori + EV7 con portata <strong>{excelParsedResult.hotWaterEvCcSec} cc/s</strong> per sola Acqua Calda diretta.
                        </p>
                      </div>

                      <div className={`p-3 rounded-2xl border ${
                        isLight ? 'bg-emerald-50/60 border-emerald-200' : 'bg-emerald-950/30 border-emerald-500/30'
                      }`}>
                        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200 mb-1">
                          <Coffee className="w-4 h-4 text-emerald-500" />
                          <span>24 Ricette Dosaggio Estratte</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                          Rilevate <strong>{excelParsedResult.recipesPiattoCount} ricette formato Piatto</strong> e <strong>{excelParsedResult.recipesZuppieraCount} ricette formato Zuppiera</strong> (P1-P12).
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-800 dark:text-rose-200 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      <span>Impossibile importare il file</span>
                    </div>
                    <p className="text-xs">{excelParsedResult.message}</p>
                    <button
                      onClick={() => {
                        setExcelParsedResult(null);
                        setExcelFileName('');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
                    >
                      Riprova con un altro file
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between gap-3 pt-4 border-t border-inherit">
              <button
                type="button"
                onClick={() => {
                  setShowExcelImportModal(false);
                  setExcelParsedResult(null);
                  setExcelFileName('');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold ${
                  isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                }`}
              >
                Annulla
              </button>

              {excelParsedResult && excelParsedResult.success && (
                <button
                  type="button"
                  onClick={handleApplyExcelCalibration}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Applica Taratura a #{activeMachine?.serialNumber || 'Macchina'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE SELEZIONE ARTICOLO DA ANAGRAFICA PER CONTENITORE */}
      {/* ========================================================================= */}
      {productCatalogModal && productCatalogModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div
            className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-4 my-8 ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0f172a] border-white/15 text-white'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3 border-inherit">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Seleziona Articolo per Contenitore {productCatalogModal.canisterNumber}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scegli il prodotto dall'elenco articoli con codice e parametri di fabbrica
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProductCatalogModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra di Ricerca e Categorie */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cerca per codice (es. ART-CAF-01), nome o ingrediente..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold border ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-white'
                  }`}
                />
              </div>

              <div className="flex flex-wrap gap-1 text-[11px]">
                {[
                  { id: 'all', label: 'Tutti gli Articoli' },
                  { id: 'coffee', label: 'Caffè' },
                  { id: 'milk', label: 'Latte' },
                  { id: 'chocolate', label: 'Cioccolato' },
                  { id: 'tea', label: 'Tè & Tisane' },
                  { id: 'solubles', label: 'Solubili & Catering' },
                  { id: 'sugar', label: 'Zucchero' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCatalogCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      catalogCategoryFilter === cat.id
                        ? 'bg-emerald-600 text-white'
                        : isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Elenco Articoli */}
            <div className={`rounded-2xl border divide-y overflow-y-auto max-h-80 ${
              isLight ? 'bg-slate-50 border-slate-200 divide-slate-200' : 'bg-black/30 border-white/10 divide-white/5'
            }`}>
              {dbArticles
                .filter((art) => {
                  const matchCat = catalogCategoryFilter === 'all' || art.ingredientType === catalogCategoryFilter;
                  const q = catalogSearch.toLowerCase().trim();
                  const matchQ =
                    !q ||
                    art.itemCode.toLowerCase().includes(q) ||
                    art.name.toLowerCase().includes(q) ||
                    (art.description || '').toLowerCase().includes(q);
                  return matchCat && matchQ;
                })
                .map((art) => (
                  <div
                    key={art.itemCode}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-emerald-500/5 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {art.itemCode}
                        </span>
                        <span className="text-xs font-bold">{art.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 font-mono">
                        <span>RPM: <strong>{art.defaultRpm || 120}</strong></span>
                        <span>• Portata: <strong>{art.defaultGramsPerSecond || 2.8} g/s</strong></span>
                        <span>• Dose: <strong>{art.nominalGramsPerDose || 7.0}g</strong></span>
                        <span>• Confezione: <strong>{art.packageUnit || 'Busta 1 Kg'}</strong></span>
                        <span>• Costo: <strong>€{art.costPerKg?.toFixed(2) || '0.00'}/Kg</strong></span>
                      </div>
                      {art.description && (
                        <p className="text-[10px] text-slate-500 italic">{art.description}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCanisters((prev) =>
                          prev.map((item) =>
                            item.id === productCatalogModal.canisterId
                              ? {
                                  ...item,
                                  itemCode: art.itemCode,
                                  name: `Contenitore ${productCatalogModal.canisterNumber}: ${art.name}`,
                                  ingredientType: art.ingredientType,
                                  packageUnit: art.packageUnit || 'Busta 1 Kg',
                                  costPerKg: art.costPerKg || item.costPerKg,
                                  motorRpm: art.defaultRpm || item.motorRpm,
                                  gramsPerSecond: art.defaultGramsPerSecond || item.gramsPerSecond,
                                  nominalGramsPerDose: art.nominalGramsPerDose || item.nominalGramsPerDose,
                                }
                              : item
                          )
                        );
                        setProductCatalogModal(null);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer shadow-sm transition-all"
                    >
                      Applica
                    </button>
                  </div>
                ))}
            </div>

            {/* Inserimento Articolo con Codice Personalizzato */}
            <div className={`p-3.5 rounded-2xl border space-y-2.5 ${
              isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
              <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-emerald-500" />
                Oppure inserisci articolo con Codice Personalizzato:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Codice Articolo (es. ART-PERS-01):</label>
                  <input
                    type="text"
                    placeholder="ART-PERS-01"
                    value={customArticleCode}
                    onChange={(e) => setCustomArticleCode(e.target.value.toUpperCase())}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Descrizione Prodotto:</label>
                  <input
                    type="text"
                    placeholder="Descrizione prodotto personalizzato"
                    value={customArticleName}
                    onChange={(e) => setCustomArticleName(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-lg border font-semibold ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-black/30 border-white/10 text-white'
                    }`}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  disabled={!customArticleCode.trim() || !customArticleName.trim()}
                  onClick={() => {
                    const code = customArticleCode.trim();
                    const name = customArticleName.trim();
                    setCanisters((prev) =>
                      prev.map((item) =>
                        item.id === productCatalogModal.canisterId
                          ? {
                              ...item,
                              itemCode: code,
                              name: `Contenitore ${productCatalogModal.canisterNumber}: ${name}`,
                              packageUnit: 'Busta 1 Kg',
                            }
                          : item
                      )
                    );
                    setCustomArticleCode('');
                    setCustomArticleName('');
                    setProductCatalogModal(null);
                  }}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white cursor-pointer"
                >
                  Salva Codice &amp; Applica
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
