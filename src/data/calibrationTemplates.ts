import {
  MachineCalibrationConfig,
  CanisterCalibration,
  ElectrovalveCalibration,
  BeverageDosageCalibration,
  CalibrationTemplate,
} from '../types';

// I 6 CONTENITORI BASE RISTOSANO (40 / 120 / 200 Giri/min)
export const RISTOSANO_6_CANISTERS: CanisterCalibration[] = [
  {
    id: 'canister-1',
    canisterNumber: 1,
    name: 'Contenitore 1: Caffè Solubile / Grani',
    itemCode: 'ART-CAF-01',
    packageUnit: 'Busta 1 Kg',
    ingredientType: 'coffee',
    motorRpm: 120, // 120 RPM standard
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
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 2.5,
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
    motorRpm: 200, // 200 RPM veloce per erogazioni ricche
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
    motorRpm: 120, // 120 RPM standard
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
    motorRpm: 40, // 40 RPM lento per polveri dense
    gramsPerSecond: 1.6,
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
    motorRpm: 120, // 120 RPM standard
    gramsPerSecond: 3.0,
    nominalGramsPerDose: 6.0,
    containerCapacityKg: 4.0,
    currentStockKg: 4.0,
    costPerKg: 1.9,
    lastCalibrationDate: new Date().toISOString().split('T')[0],
  },
];

// LE 7 ELETTROVALVOLE BASE RISTOSANO (Una per contenitore + Una per sola acqua calda)
export const RISTOSANO_7_ELECTROVALVES: ElectrovalveCalibration[] = [
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
    description: 'Elettrovalvola dedicata esclusivamente alla sola erogazione di acqua calda diretta (by-pass, tè e tisane)',
  },
];

// Alias per compatibilità
export const RISTOSANO_4_ELECTROVALVES = RISTOSANO_7_ELECTROVALVES;

const buildBeverage = (
  key: string,
  name: string,
  activeCanisters: { canisterId: string; sec: number }[],
  activeEvs: { evId: string; sec: number }[],
  canisterList: CanisterCalibration[],
  evList: ElectrovalveCalibration[],
  notes: string = ''
): BeverageDosageCalibration => {
  return {
    key,
    name,
    canisterTimings: canisterList.map((c) => {
      const match = activeCanisters.find((ac) => ac.canisterId === c.id);
      return {
        canisterId: c.id,
        enabled: !!match,
        motorDurationSec: match ? match.sec : 0,
      };
    }),
    evTimings: evList.map((ev) => {
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

export const RISTOSANO_12_STANDARD_PRODUCTS: BeverageDosageCalibration[] = [
  buildBeverage('P1', 'Caffè Espresso', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 3.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Espresso corto intenso'),
  buildBeverage('P2', 'Caffè Lungo', [{ canisterId: 'canister-1', sec: 2.5 }], [{ evId: 'ev-1', sec: 4.0 }, { evId: 'ev-7', sec: 2.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Espresso allungato con sola acqua calda'),
  buildBeverage('P3', 'Caffè Macchiato', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 1.2 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 1.8 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Espresso con latte macchiato'),
  buildBeverage('P4', 'Cappuccino Cremoso', [{ canisterId: 'canister-1', sec: 2.5 }, { canisterId: 'canister-2', sec: 3.5 }], [{ evId: 'ev-1', sec: 3.0 }, { evId: 'ev-2', sec: 6.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Cappuccino schiumato'),
  buildBeverage('P5', 'Caffellatte', [{ canisterId: 'canister-1', sec: 1.8 }, { canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 7.5 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Tazza grande latte con caffè'),
  buildBeverage('P6', 'Cioccolato Caldo Denso', [{ canisterId: 'canister-3', sec: 4.0 }], [{ evId: 'ev-3', sec: 8.5 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Cioccolato denso 200 RPM'),
  buildBeverage('P7', 'Mocaccino', [{ canisterId: 'canister-1', sec: 2.2 }, { canisterId: 'canister-2', sec: 2.0 }, { canisterId: 'canister-3', sec: 2.5 }], [{ evId: 'ev-1', sec: 2.5 }, { evId: 'ev-2', sec: 3.5 }, { evId: 'ev-3', sec: 4.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caffè, latte e cioccolato'),
  buildBeverage('P8', 'Latte Caldo Puro', [{ canisterId: 'canister-2', sec: 4.5 }], [{ evId: 'ev-2', sec: 9.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Latte caldo senza caffè'),
  buildBeverage('P9', 'The al Limone', [{ canisterId: 'canister-4', sec: 3.8 }], [{ evId: 'ev-4', sec: 8.5 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'The solubile limone con EV4 dedicata'),
  buildBeverage('P10', 'Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 5.5 }], [{ evId: 'ev-5', sec: 4.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Orzo tostato motore 40 RPM con EV5 dedicata'),
  buildBeverage('P11', 'Orzo Grande Tazza', [{ canisterId: 'canister-5', sec: 7.0 }], [{ evId: 'ev-5', sec: 7.5 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Orzo lungo motore 40 RPM con EV5 dedicata'),
  buildBeverage('P12', 'Ginseng Dolce', [{ canisterId: 'canister-5', sec: 6.0 }, { canisterId: 'canister-2', sec: 1.5 }], [{ evId: 'ev-5', sec: 5.0 }, { evId: 'ev-2', sec: 2.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Ginseng cremoso EV5 + EV2 latte'),
];

export const RISTOSANO_12_CARAFFA_PRODUCTS: BeverageDosageCalibration[] = [
  buildBeverage('P1', 'Caraffa Caffè Espresso (4 Tazze)', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 12.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa 4 caffè'),
  buildBeverage('P2', 'Caraffa Caffè Americano', [{ canisterId: 'canister-1', sec: 10.0 }], [{ evId: 'ev-1', sec: 16.0 }, { evId: 'ev-7', sec: 10.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa americana allungata con sola acqua calda EV7'),
  buildBeverage('P3', 'Caraffa Caffè Macchiato', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 4.8 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 7.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa macchiato'),
  buildBeverage('P4', 'Caraffa Cappuccino', [{ canisterId: 'canister-1', sec: 10.0 }, { canisterId: 'canister-2', sec: 14.0 }], [{ evId: 'ev-1', sec: 12.0 }, { evId: 'ev-2', sec: 24.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa cappuccino colazioni'),
  buildBeverage('P5', 'Caraffa Caffellatte', [{ canisterId: 'canister-1', sec: 7.0 }, { canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 30.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa latte caldo'),
  buildBeverage('P6', 'Caraffa Cioccolato Caldo', [{ canisterId: 'canister-3', sec: 16.0 }], [{ evId: 'ev-3', sec: 34.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa cioccolato ricca EV3'),
  buildBeverage('P7', 'Caraffa Mocaccino', [{ canisterId: 'canister-1', sec: 8.8 }, { canisterId: 'canister-2', sec: 8.0 }, { canisterId: 'canister-3', sec: 10.0 }], [{ evId: 'ev-1', sec: 10.0 }, { evId: 'ev-2', sec: 14.0 }, { evId: 'ev-3', sec: 16.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa mocaccino'),
  buildBeverage('P8', 'Caraffa Latte Caldo', [{ canisterId: 'canister-2', sec: 18.0 }], [{ evId: 'ev-2', sec: 36.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa latte intero'),
  buildBeverage('P9', 'Caraffa The al Limone', [{ canisterId: 'canister-4', sec: 15.2 }], [{ evId: 'ev-4', sec: 34.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa the 1 Litro EV4'),
  buildBeverage('P10', 'Caraffa Orzo Tradizionale', [{ canisterId: 'canister-5', sec: 22.0 }], [{ evId: 'ev-5', sec: 16.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa orzo concentrato EV5'),
  buildBeverage('P11', 'Caraffa Orzo Tazza Grande', [{ canisterId: 'canister-5', sec: 28.0 }], [{ evId: 'ev-5', sec: 30.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa orzo abbondante EV5'),
  buildBeverage('P12', 'Caraffa Ginseng', [{ canisterId: 'canister-5', sec: 24.0 }, { canisterId: 'canister-2', sec: 6.0 }], [{ evId: 'ev-5', sec: 20.0 }, { evId: 'ev-2', sec: 8.0 }], RISTOSANO_6_CANISTERS, RISTOSANO_7_ELECTROVALVES, 'Caraffa ginseng riunioni EV5 + EV2'),
];

export const CALIBRATION_RISTOSANO_STANDARD: MachineCalibrationConfig = {
  lastUpdated: new Date().toISOString(),
  calibratedBy: 'Configurazione Ufficiale Ristosano',
  notes: 'Taratura Standard Ristosano di fabbrica: 6 contenitori con coclee differenziate (40, 120 e 200 RPM) e 7 EV (EV1-EV6 per contenitori + EV7 per sola acqua calda).',
  waterFlowCcPerSec: 15.0,
  canisters: RISTOSANO_6_CANISTERS,
  electrovalves: RISTOSANO_7_ELECTROVALVES,
  standardProducts: RISTOSANO_12_STANDARD_PRODUCTS,
  caraffaProducts: RISTOSANO_12_CARAFFA_PRODUCTS,
};

// TARATURA STANDARD BIG 5 (Alti volumi per Hotel & Catering)
export const CALIBRATION_BIG5_STANDARD: MachineCalibrationConfig = {
  lastUpdated: new Date().toISOString(),
  calibratedBy: 'Configurazione Ufficiale Big 5',
  notes: 'Taratura Big 5 ad alta portata: 7 EV calibrate a 18-22 cc/s (EV1-EV6 per contenitori + EV7 sola acqua calda) per riempimento rapido caraffe da 1L e 1.5L hotel.',
  waterFlowCcPerSec: 18.0,
  canisters: RISTOSANO_6_CANISTERS.map((c) => ({
    ...c,
    motorRpm: c.ingredientType === 'chocolate' ? 200 : c.ingredientType === 'milk' ? 200 : c.motorRpm,
    gramsPerSecond: c.ingredientType === 'milk' ? 3.8 : c.gramsPerSecond,
  })),
  electrovalves: [
    { id: 'ev-1', evNumber: 1, name: 'EV1: Contenitore 1 (Mixer Caffè Rapido)', flowRateCcPerSec: 18.0, description: 'Alta portata per colazioni veloci' },
    { id: 'ev-2', evNumber: 2, name: 'EV2: Contenitore 2 (Schiuma Latte Hotel)', flowRateCcPerSec: 18.0, description: 'Flusso alto latte montato' },
    { id: 'ev-3', evNumber: 3, name: 'EV3: Contenitore 3 (Mixer Cioccolato)', flowRateCcPerSec: 20.0, description: 'Portata maggiorata per caraffe cioccolato' },
    { id: 'ev-4', evNumber: 4, name: 'EV4: Contenitore 4 (Mixer The al Limone)', flowRateCcPerSec: 20.0, description: 'Flusso rapido tè colazioni' },
    { id: 'ev-5', evNumber: 5, name: 'EV5: Contenitore 5 (Mixer Orzo/Ginseng)', flowRateCcPerSec: 18.0, description: 'Miscelazione solubili' },
    { id: 'ev-6', evNumber: 6, name: 'EV6: Contenitore 6 (Mixer Zucchero/Solubile)', flowRateCcPerSec: 18.0, description: 'Flussaggio contenitore 6' },
    { id: 'ev-7', evNumber: 7, name: 'EV7: Sola Acqua Calda (Tè & Tisane)', flowRateCcPerSec: 22.0, description: 'Erogatore rapido acqua bollente hotel' },
  ],
  standardProducts: RISTOSANO_12_STANDARD_PRODUCTS,
  caraffaProducts: RISTOSANO_12_CARAFFA_PRODUCTS,
};

// TARATURA STANDARD ASIA (Specializzata solubili, tè ed infusi)
export const CALIBRATION_ASIA_STANDARD: MachineCalibrationConfig = {
  lastUpdated: new Date().toISOString(),
  calibratedBy: 'Configurazione Ufficiale Asia',
  notes: 'Taratura Asia: dosaggi bilanciati per polveri solubili fini, tè, tisane e caffè americano con 7 EV dedicate (EV1-EV6 per contenitori + EV7 sola acqua calda).',
  waterFlowCcPerSec: 16.0,
  canisters: RISTOSANO_6_CANISTERS.map((c) => ({
    ...c,
    motorRpm: c.ingredientType === 'solubles' ? 120 : c.motorRpm,
  })),
  electrovalves: RISTOSANO_7_ELECTROVALVES,
  standardProducts: RISTOSANO_12_STANDARD_PRODUCTS,
  caraffaProducts: RISTOSANO_12_CARAFFA_PRODUCTS,
};

// MODELLI STANDARD DISPONIBILI
export const STANDARD_CALIBRATION_TEMPLATES: CalibrationTemplate[] = [
  {
    id: 'template-ristosano-std',
    name: 'Taratura Standard Ristosano (6 Contenitori - 7 EV)',
    description: 'Taratura ufficiale di fabbrica con coclee differenziate (40 / 120 / 200 Giri), 7 EV (una per contenitore + una per sola acqua calda) e 12 ricette bicchiere + 12 caraffa.',
    modelTarget: 'Ristosano',
    isSystemStandard: true,
    calibration: CALIBRATION_RISTOSANO_STANDARD,
  },
  {
    id: 'template-big5-hotel',
    name: 'Taratura Standard Big 5 (Hotel & Grandi Volumi - 7 EV)',
    description: 'Ottimizzata per velocità di erogazione e caraffe per colazioni hotel. 7 EV con portata elevata (18-22 cc/s: una per contenitore + una per sola acqua calda) e coclee rapide.',
    modelTarget: 'Big 5',
    isSystemStandard: true,
    calibration: CALIBRATION_BIG5_STANDARD,
  },
  {
    id: 'template-asia-solubles',
    name: 'Taratura Standard Asia (Solubili Rapidi & Tè - 7 EV)',
    description: 'Taratura bilanciata per distributore Asia con 7 EV dedicate per tè, tisane, orzo e solubili leggeri + erogazione diretta sola acqua calda.',
    modelTarget: 'Asia',
    isSystemStandard: true,
    calibration: CALIBRATION_ASIA_STANDARD,
  },
];

export const getCalibrationForModel = (model: string): MachineCalibrationConfig => {
  const clean = (model || '').trim().toLowerCase();
  if (clean.includes('big')) {
    return JSON.parse(JSON.stringify(CALIBRATION_BIG5_STANDARD));
  }
  if (clean.includes('asia')) {
    return JSON.parse(JSON.stringify(CALIBRATION_ASIA_STANDARD));
  }
  return JSON.parse(JSON.stringify(CALIBRATION_RISTOSANO_STANDARD));
};
