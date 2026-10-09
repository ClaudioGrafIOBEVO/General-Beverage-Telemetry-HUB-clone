import XLSXStyle from 'xlsx-js-style';
const XLSX: any = (XLSXStyle as any).default || XLSXStyle;
import {
  MachineCalibrationConfig,
  CanisterCalibration,
  ElectrovalveCalibration,
  BeverageDosageCalibration,
  MotorRpmType,
} from '../types';

export interface ParsedExcelCalibrationResult {
  success: boolean;
  message: string;
  metadata: {
    date?: string;
    model?: string;
    serialNumber?: string;
    formatTitle?: string;
    boilerTempC?: number;
    deltaR2?: number;
    minPulse?: number;
    tempoMinImpulso?: number;
  };
  containersDetected: {
    slot: string; // S1..S6
    name: string;
    rpm: number;
    evCcSec: number;
    delaySec: number;
    queueSec: number;
  }[];
  hotWaterEvCcSec: number;
  recipesPiattoCount: number;
  recipesZuppieraCount: number;
  calibration: MachineCalibrationConfig;
  warnings: string[];
}

/**
 * Pulisce e converte una stringa numerica con virgola o punto in float
 */
function parseNumber(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const cleaned = String(val).replace(',', '.').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Normalizza stringhe per confronti case-insensitive
 */
function norm(str: any): string {
  if (!str) return '';
  return String(str).trim().toUpperCase();
}

/**
 * Analizza e importa una taratura dal foglio Excel storico (Formato RR-AF PRO / BIG 6 CATERING / RISTOSANO)
 */
export function parseHistoricExcelCalibration(fileBuffer: ArrayBuffer): ParsedExcelCalibrationResult {
  const warnings: string[] = [];
  try {
    const workbook = XLSX.read(fileBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        message: 'Nessun foglio trovato nel file Excel caricato.',
        metadata: {},
        containersDetected: [],
        hotWaterEvCcSec: 18,
        recipesPiattoCount: 0,
        recipesZuppieraCount: 0,
        calibration: {} as any,
        warnings: ['File vuoto'],
      };
    }

    const worksheet = workbook.Sheets[sheetName];
    // Convertiamo in matrice 2D (righe e colonne)
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length < 5) {
      return {
        success: false,
        message: 'Il foglio Excel non contiene un numero sufficiente di righe.',
        metadata: {},
        containersDetected: [],
        hotWaterEvCcSec: 18,
        recipesPiattoCount: 0,
        recipesZuppieraCount: 0,
        calibration: {} as any,
        warnings: ['Troppe poche righe nel foglio'],
      };
    }

    // 1. ESTRAZIONE METADATI GENERALI (DATA, MODELLO, MATRICOLA, FORMAT, PARAMETRI CALDAIA)
    const metadata: ParsedExcelCalibrationResult['metadata'] = {};
    for (let r = 0; r < Math.min(rawRows.length, 12); r++) {
      const row = rawRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = norm(row[c]);
        if (cell === 'DATA') {
          metadata.date = String(row[c + 1] || row[c + 2] || '').trim();
        } else if (cell === 'MODELLO') {
          metadata.model = String(row[c + 1] || row[c + 2] || '').trim();
        } else if (cell === 'MATRICOLA') {
          metadata.serialNumber = String(row[c + 1] || row[c + 2] || '').trim();
        } else if (cell.includes('FORMAT')) {
          metadata.formatTitle = String(row[c]).trim();
        }
      }
    }

    // Parametri in fondo (Temperatura, Delta R2, Impulso minimo)
    for (let r = rawRows.length - 1; r >= Math.max(0, rawRows.length - 15); r--) {
      const row = rawRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = norm(row[c]);
        if (cell.includes('TEMPERATURA')) {
          const val = parseNumber(row[c + 1] || row[c + 2]);
          if (val > 0) metadata.boilerTempC = val;
        } else if (cell.includes('DELTA R2')) {
          const val = parseNumber(row[c + 1] || row[c + 2]);
          if (val > 0) metadata.deltaR2 = val;
        } else if (cell.includes('IMPULSO MINIMO')) {
          const val = parseNumber(row[c + 1] || row[c + 2]);
          if (val > 0) metadata.minPulse = val;
        } else if (cell.includes('TEMPO MIN IMPULSO')) {
          const val = parseNumber(row[c + 1] || row[c + 2]);
          if (val > 0) metadata.tempoMinImpulso = val;
        }
      }
    }

    // 2. RICERCA RIGA INTESTAZIONE S1..S6 E SOTTORIGHE
    // Cerchiamo dove compaiono 'S1', 'S2', 'S3' o dove compare 'E.V. cc/sec' o 'Motore'
    let sRowIdx = -1;
    let sColMap: { [slot: string]: { colStart: number; colAcqua: number; colPolvere: number } } = {};
    let evHotWaterCol = -1;

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      let foundS1 = false;
      let foundS2 = false;
      for (let c = 0; c < row.length; c++) {
        const val = norm(row[c]);
        if (val === 'S1') foundS1 = true;
        if (val === 'S2') foundS2 = true;
      }
      if (foundS1 && foundS2) {
        sRowIdx = r;
        break;
      }
    }

    // Se non troviamo S1 su una riga esatta, cerchiamo 'E.V. CC/SEC' o 'MOTORE'
    let evCcRowIdx = -1;
    let motorRowIdx = -1;
    let delayRowIdx = -1;
    let queueRowIdx = -1;

    for (let r = 0; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      for (let c = 0; c < Math.min(row.length, 12); c++) {
        const cell = norm(row[c]);
        if (cell.includes('E.V.') && (cell.includes('CC/SEC') || cell.includes('CC/S') || cell.includes('CC'))) {
          evCcRowIdx = r;
        }
        if (cell === 'MOTORE' || cell.startsWith('MOTORE')) {
          motorRowIdx = r;
        }
        if (cell.includes('RITARDO')) {
          delayRowIdx = r;
        }
        if (cell.includes('CODA')) {
          queueRowIdx = r;
        }
      }
    }

    // Se abbiamo sRowIdx, individuiamo le colonne S1..S6 e la colonna E.V. Acqua Calda
    if (sRowIdx !== -1) {
      const sRow = rawRows[sRowIdx];
      for (let c = 0; c < sRow.length; c++) {
        const val = norm(sRow[c]);
        if (['S1', 'S2', 'S3', 'S4', 'S5', 'S6'].includes(val)) {
          // Ogni slot S ha 2 colonne sotto: ACQUA e POLVERE
          sColMap[val] = {
            colStart: c,
            colAcqua: c,
            colPolvere: c + 1,
          };
        } else if (val.includes('E.V.') || val.includes('ACQUA') || val === 'EV') {
          if (evHotWaterCol === -1 && c > 5) {
            evHotWaterCol = c;
          }
        }
      }
    }

    // Se non abbiamo sColMap completa, proviamo a cercarle controllando la riga "ACQUA" / "POLVERE"
    let subHeaderRowIdx = -1;
    if (sRowIdx !== -1 && sRowIdx + 1 < rawRows.length) {
      const nextRow = rawRows[sRowIdx + 1];
      for (let c = 0; c < nextRow.length; c++) {
        const val = norm(nextRow[c]);
        if (val === 'ACQUA' || val === 'POLVERE') {
          subHeaderRowIdx = sRowIdx + 1;
          break;
        }
      }
    }

    // Se le colonne S1..S6 non sono state trovate con precisione, usiamo il layout standard delle schede (E..Q, ovvero col 4..16)
    if (Object.keys(sColMap).length < 4) {
      let firstAcquaCol = 4; // Colonna E di default nel format RR-AF PRO
      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        for (let c = 0; c < row.length; c++) {
          if (norm(row[c]) === 'ACQUA' && norm(row[c + 1]) === 'POLVERE') {
            firstAcquaCol = c;
            subHeaderRowIdx = r;
            break;
          }
        }
        if (subHeaderRowIdx !== -1) break;
      }

      for (let i = 1; i <= 6; i++) {
        const colA = firstAcquaCol + (i - 1) * 2;
        sColMap[`S${i}`] = {
          colStart: colA,
          colAcqua: colA,
          colPolvere: colA + 1,
        };
      }
      evHotWaterCol = firstAcquaCol + 12; // Colonna Q (EV7)
    }

    // Se gli indici riga non sono stati trovati dai testi, usiamo le righe storiche fisse (0-based)
    if (evCcRowIdx === -1) evCcRowIdx = 4;      // Riga 5 Excel
    if (motorRowIdx === -1) motorRowIdx = 5;    // Riga 6 Excel
    if (delayRowIdx === -1) delayRowIdx = 6;    // Riga 7 Excel
    if (queueRowIdx === -1) queueRowIdx = 8;    // Riga 9 Excel
    if (subHeaderRowIdx === -1) subHeaderRowIdx = 10; // Riga 11 Excel (ACQUA / POLVERE)

    // 3. ESTRAZIONE NOMI POLVERI / INGREDIENTI PER S1..S6
    // Guardiamo le righe sopra a 'E.V. cc/sec' o 'S1' per i titoli (es. MOUSSE FRUTTA, PASTA, Puré, LATTE, OMOGENEIZZATI, FRITTATA)
    const containerNames: { [slot: string]: string } = {
      S1: 'Contenitore 1 - Mousse Frutta',
      S2: 'Contenitore 2 - Pasta Tortellini',
      S3: 'Contenitore 3 - Purè Vari',
      S4: 'Contenitore 4 - Latte / Dessert PRO',
      S5: 'Contenitore 5 - Omogeneizzati Carne/Pesce',
      S6: 'Contenitore 6 - Frittata',
    };

    // Scansioniamo sopra evCcRowIdx per estrarre le etichette delle celle
    const nameSearchRow = evCcRowIdx > 0 ? evCcRowIdx - 1 : (sRowIdx > 0 ? sRowIdx - 1 : -1);
    if (nameSearchRow >= 0) {
      for (let i = 1; i <= 6; i++) {
        const slot = `S${i}`;
        const map = sColMap[slot];
        if (map) {
          const val1 = String(rawRows[nameSearchRow]?.[map.colAcqua] || '').trim();
          const val2 = String(rawRows[nameSearchRow]?.[map.colPolvere] || '').trim();
          const combined = (val1 + (val2 && val2 !== val1 ? ' ' + val2 : '')).trim();
          if (combined && combined.length > 1) {
            containerNames[slot] = `S${i}: ${combined}`;
          }
        }
      }
    }

    // 4. ESTRAZIONE VALORI MOTORE (RPM), EV CC/SEC, RITARDO, CODA
    const containerRpms: { [slot: string]: MotorRpmType } = {
      S1: 120,
      S2: 120,
      S3: 120,
      S4: 200,
      S5: 200,
      S6: 200,
    };
    const containerEvFlows: { [slot: string]: number } = {
      S1: 17.0,
      S2: 17.0,
      S3: 17.0,
      S4: 17.0,
      S5: 17.0,
      S6: 17.0,
    };
    const containerDelays: { [slot: string]: number } = {};
    const containerQueues: { [slot: string]: number } = {};
    let hotWaterEvCcSec = 20.0;

    for (let i = 1; i <= 6; i++) {
      const slot = `S${i}`;
      const map = sColMap[slot];
      if (map) {
        // EV cc/sec
        if (evCcRowIdx !== -1) {
          const val = parseNumber(rawRows[evCcRowIdx][map.colAcqua] || rawRows[evCcRowIdx][map.colPolvere], 17.0);
          if (val > 0) containerEvFlows[slot] = val;
        }
        // Motore RPM
        if (motorRowIdx !== -1) {
          const rpmRaw = parseNumber(rawRows[motorRowIdx][map.colAcqua] || rawRows[motorRowIdx][map.colPolvere], 120);
          if (rpmRaw === 40 || rpmRaw === 120 || rpmRaw === 200) {
            containerRpms[slot] = rpmRaw as MotorRpmType;
          } else if (rpmRaw >= 160) {
            containerRpms[slot] = 200;
          } else if (rpmRaw >= 80) {
            containerRpms[slot] = 120;
          } else {
            containerRpms[slot] = 40;
          }
        }
        // Ritardo
        if (delayRowIdx !== -1) {
          containerDelays[slot] = parseNumber(rawRows[delayRowIdx][map.colAcqua] || rawRows[delayRowIdx][map.colPolvere], 1.5);
        }
        // Coda
        if (queueRowIdx !== -1) {
          containerQueues[slot] = parseNumber(rawRows[queueRowIdx][map.colAcqua] || rawRows[queueRowIdx][map.colPolvere], 0);
        }
      }
    }

    // Estrazione portata Acqua Calda (EV7)
    if (evHotWaterCol !== -1 && evCcRowIdx !== -1) {
      const val = parseNumber(rawRows[evCcRowIdx][evHotWaterCol], 20.0);
      if (val > 0) hotWaterEvCcSec = val;
    }

    // 5. ESTRAZIONE RICETTE TASTI P1 - P12 (RIGHE PIATTO E ZUPPIERA)
    // Troviamo le righe dei pulsanti P1..P12
    interface ParsedButtonRow {
      pKey: string; // P1..P12
      label: string;
      selectionType: 'PIATTO' | 'ZUPPIERA' | 'STANDARD';
      powderSec: { [slot: string]: number };
      waterSec: { [slot: string]: number };
      hotWaterSec: number;
      nominalVolumeCc?: number;
    }

    const piattoRows: ParsedButtonRow[] = [];
    const zuppieraRows: ParsedButtonRow[] = [];

    // Cerchiamo le righe che contengono P1, P2 ... P12 nella prima colonna (o tra le prime 3 colonne)
    let currentPKey = '';
    let currentLabel = '';

    for (let r = (subHeaderRowIdx !== -1 ? subHeaderRowIdx + 1 : 11); r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      if (!row || row.length === 0) continue;

      const firstCellNorm = norm(row[0]);
      // Stop immediato se incontriamo le righe footer dei parametri caldaia
      if (
        firstCellNorm.includes('IMPULSO') ||
        firstCellNorm.includes('TEMPERATURA') ||
        firstCellNorm.includes('DELTA') ||
        firstCellNorm.includes('NOTE')
      ) {
        break;
      }

      // Cerchiamo il codice tasto P1..P12 o numero 1..12
      let foundPInRow = '';
      for (let c = 0; c < 3; c++) {
        const rawCell = String(row[c] || '').trim();
        const cell = norm(rawCell);
        
        // P1, P 1, P.1, P-1
        const matchP = cell.match(/^P[\s.-]?(\d{1,2})$/i);
        if (matchP) {
          const num = parseInt(matchP[1], 10);
          if (num >= 1 && num <= 12) {
            foundPInRow = `P${num}`;
            break;
          }
        }
        
        // Numero puro 1..12 nella prima colonna
        if (c === 0 && /^\d{1,2}$/.test(rawCell)) {
          const num = parseInt(rawCell, 10);
          if (num >= 1 && num <= 12) {
            foundPInRow = `P${num}`;
            break;
          }
        }
      }

      if (foundPInRow) {
        currentPKey = foundPInRow;
        // L'etichetta si trova nella colonna 1 o 2
        const rawLabel = String(row[1] || row[2] || '').trim();
        if (rawLabel && norm(rawLabel) !== 'PIATTO' && norm(rawLabel) !== 'ZUPPIERA' && norm(rawLabel) !== 'CARAFFA') {
          currentLabel = rawLabel;
        }
      }

      // Se non abbiamo ancora un PKey identificato e siamo nelle prime righe prodotto (riga 11..34),
      // usiamo la posizione progressiva a coppie: riga 11/12 -> P1, 13/14 -> P2, ecc.
      if (!currentPKey && r >= 11 && r <= 34) {
        const calculatedIndex = Math.floor((r - 11) / 2) + 1;
        if (calculatedIndex >= 1 && calculatedIndex <= 12) {
          currentPKey = `P${calculatedIndex}`;
        }
      }

      if (!currentPKey) continue;

      // Verifichiamo se questa riga è PIATTO o ZUPPIERA
      let selType: 'PIATTO' | 'ZUPPIERA' | 'STANDARD' = 'STANDARD';
      for (let c = 0; c < 5; c++) {
        const val = norm(row[c]);
        if (val === 'PIATTO') {
          selType = 'PIATTO';
          break;
        }
        if (val === 'ZUPPIERA' || val === 'CARAFFA') {
          selType = 'ZUPPIERA';
          break;
        }
      }

      // Se non c'è la parola esplicita, potremmo dedurla dall'alternanza: prima riga = PIATTO, seconda = ZUPPIERA
      if (selType === 'STANDARD') {
        const alreadyHasPiatto = piattoRows.some((pr) => pr.pKey === currentPKey);
        selType = alreadyHasPiatto ? 'ZUPPIERA' : 'PIATTO';
      }

      // Estraiamo i tempi di Acqua e Polvere per S1..S6
      const powderSec: { [slot: string]: number } = {};
      const waterSec: { [slot: string]: number } = {};

      for (let i = 1; i <= 6; i++) {
        const slot = `S${i}`;
        const map = sColMap[slot];
        if (map) {
          const wSec = parseNumber(row[map.colAcqua], 0);
          const pSec = parseNumber(row[map.colPolvere], 0);
          if (wSec > 0) waterSec[slot] = wSec;
          if (pSec > 0) powderSec[slot] = pSec;
        }
      }

      // Estraiamo eventuale sola acqua calda (EV7)
      let hwSec = 0;
      if (evHotWaterCol !== -1) {
        hwSec = parseNumber(row[evHotWaterCol], 0);
      }

      const parsedRow: ParsedButtonRow = {
        pKey: currentPKey,
        label: currentLabel || `Prodotto ${currentPKey}`,
        selectionType: selType,
        powderSec,
        waterSec,
        hotWaterSec: hwSec,
      };

      if (selType === 'PIATTO') {
        // Se c'è già un piatto per questa PKey, evitiamo duplicati
        const existingIdx = piattoRows.findIndex((pr) => pr.pKey === currentPKey);
        if (existingIdx !== -1) piattoRows[existingIdx] = parsedRow;
        else piattoRows.push(parsedRow);
      } else {
        const existingIdx = zuppieraRows.findIndex((zr) => zr.pKey === currentPKey);
        if (existingIdx !== -1) zuppieraRows[existingIdx] = parsedRow;
        else zuppieraRows.push(parsedRow);
      }
    }

    // 6. COSTRUZIONE OGGETTO CALIBRAZIONE COMPLETO (CANISTERS, 7 EV, 12 BICCHIERI/PIATTO, 12 CARAFFE/ZUPPIERA)
    // CANISTERS (S1 .. S6)
    const canisters: CanisterCalibration[] = [1, 2, 3, 4, 5, 6].map((num) => {
      const slot = `S${num}`;
      const defaultType = num === 1 ? 'coffee' : num === 2 ? 'milk' : num === 3 ? 'chocolate' : num === 4 ? 'tea' : 'solubles';
      return {
        id: `canister-${num}`,
        canisterNumber: num,
        name: containerNames[slot] || `Contenitore ${num}`,
        ingredientType: defaultType as any,
        motorRpm: containerRpms[slot] || 120,
        gramsPerSecond: containerRpms[slot] === 200 ? 3.5 : containerRpms[slot] === 40 ? 1.2 : 2.5,
        containerCapacityKg: 2.5,
        currentStockKg: 2.0,
        costPerKg: 15.0,
        lastCalibrationDate: metadata.date || new Date().toISOString(),
      };
    });

    // 7 ELETTROVALVOLE (EV1..EV6 per i contenitori + EV7 per sola acqua calda)
    const electrovalves: ElectrovalveCalibration[] = [
      {
        id: 'ev-1',
        evNumber: 1,
        name: `EV1: Mixer Contenitore 1 (${canisters[0]?.name.replace(/S\d+:\s*/, '') || 'S1'})`,
        flowRateCcPerSec: containerEvFlows.S1 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 1`,
      },
      {
        id: 'ev-2',
        evNumber: 2,
        name: `EV2: Mixer Contenitore 2 (${canisters[1]?.name.replace(/S\d+:\s*/, '') || 'S2'})`,
        flowRateCcPerSec: containerEvFlows.S2 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 2`,
      },
      {
        id: 'ev-3',
        evNumber: 3,
        name: `EV3: Mixer Contenitore 3 (${canisters[2]?.name.replace(/S\d+:\s*/, '') || 'S3'})`,
        flowRateCcPerSec: containerEvFlows.S3 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 3`,
      },
      {
        id: 'ev-4',
        evNumber: 4,
        name: `EV4: Mixer Contenitore 4 (${canisters[3]?.name.replace(/S\d+:\s*/, '') || 'S4'})`,
        flowRateCcPerSec: containerEvFlows.S4 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 4`,
      },
      {
        id: 'ev-5',
        evNumber: 5,
        name: `EV5: Mixer Contenitore 5 (${canisters[4]?.name.replace(/S\d+:\s*/, '') || 'S5'})`,
        flowRateCcPerSec: containerEvFlows.S5 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 5`,
      },
      {
        id: 'ev-6',
        evNumber: 6,
        name: `EV6: Mixer Contenitore 6 (${canisters[5]?.name.replace(/S\d+:\s*/, '') || 'S6'})`,
        flowRateCcPerSec: containerEvFlows.S6 || 17.0,
        description: `Elettrovalvola dedicata al Contenitore 6`,
      },
      {
        id: 'ev-7',
        evNumber: 7,
        name: 'EV7: Sola Acqua Calda Diretta',
        flowRateCcPerSec: hotWaterEvCcSec || 20.0,
        description: 'Elettrovalvola dedicata esclusivamente all’erogazione diretta di sola acqua calda (tè, tisane e allungamento)',
      },
    ];

    // COSTRUZIONE RICETTE STANDARD (PIATTO / BICCHIERE) P1 - P12
    const buildBeverageRecipe = (
      pKey: string,
      row: ParsedButtonRow | undefined,
      fallbackName: string,
      isZuppiera = false
    ): BeverageDosageCalibration => {
      const name = row?.label ? (isZuppiera ? `${row.label} (Zuppiera)` : row.label) : fallbackName;
      const canisterTimings = [1, 2, 3, 4, 5, 6].map((num) => {
        const slot = `S${num}`;
        const sec = row?.powderSec[slot] || 0;
        return {
          canisterId: `canister-${num}`,
          enabled: sec > 0,
          motorDurationSec: sec,
        };
      });

      const evTimings = [1, 2, 3, 4, 5, 6, 7].map((num) => {
        if (num === 7) {
          const sec = row?.hotWaterSec || 0;
          return {
            evId: 'ev-7',
            enabled: sec > 0,
            waterDurationSec: sec,
          };
        }
        const slot = `S${num}`;
        const sec = row?.waterSec[slot] || 0;
        return {
          evId: `ev-${num}`,
          enabled: sec > 0,
          waterDurationSec: sec,
        };
      });

      return {
        key: pKey,
        name,
        canisterTimings,
        evTimings,
        notes: isZuppiera ? 'Taratura formato Zuppiera (dose grande)' : 'Taratura formato Piatto (dose standard)',
      };
    };

    const standardProducts: BeverageDosageCalibration[] = [];
    const caraffaProducts: BeverageDosageCalibration[] = [];

    for (let i = 1; i <= 12; i++) {
      const key = `P${i}`;
      const pRow = piattoRows.find((r) => r.pKey === key);
      const zRow = zuppieraRows.find((r) => r.pKey === key);

      standardProducts.push(buildBeverageRecipe(key, pRow, `Pulsante ${key}`, false));
      caraffaProducts.push(buildBeverageRecipe(key, zRow, `Pulsante ${key} (Zuppiera)`, true));
    }

    const calibrationConfig: MachineCalibrationConfig = {
      lastUpdated: metadata.date || new Date().toISOString(),
      calibratedBy: metadata.formatTitle ? `${metadata.formatTitle} (${metadata.model || 'Excel'})` : 'Importato da Excel Storico',
      notes: `Taratura importata da foglio Excel ${metadata.formatTitle || ''}. Modello: ${metadata.model || 'N/D'} | Matricola: ${metadata.serialNumber || 'N/D'}. Caldaia: ${metadata.boilerTempC || 90}°C (Delta ${metadata.deltaR2 || 3}°C).`,
      waterFlowCcPerSec: containerEvFlows.S1 || 17.0,
      canisters,
      electrovalves,
      standardProducts,
      caraffaProducts,
    };

    const containersDetected = [1, 2, 3, 4, 5, 6].map((num) => ({
      slot: `S${num}`,
      name: containerNames[`S${num}`] || `Contenitore ${num}`,
      rpm: containerRpms[`S${num}`] || 120,
      evCcSec: containerEvFlows[`S${num}`] || 17.0,
      delaySec: containerDelays[`S${num}`] || 1.5,
      queueSec: containerQueues[`S${num}`] || 0,
    }));

    return {
      success: true,
      message: `File Excel analizzato con successo: rilevati 6 contenitori polveri, 7 elettrovalvole, ${piattoRows.length} ricette Piatto e ${zuppieraRows.length} ricette Zuppiera.`,
      metadata,
      containersDetected,
      hotWaterEvCcSec,
      recipesPiattoCount: piattoRows.length,
      recipesZuppieraCount: zuppieraRows.length,
      calibration: calibrationConfig,
      warnings,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Errore durante l'elaborazione del file Excel: ${error?.message || 'Formato non supportato o corrotto'}`,
      metadata: {},
      containersDetected: [],
      hotWaterEvCcSec: 18,
      recipesPiattoCount: 0,
      recipesZuppieraCount: 0,
      calibration: {} as any,
      warnings: [String(error)],
    };
  }
}

/**
 * Esporta la configurazione di taratura attuale in un file Excel formattato identico al foglio storico
 * (Griglia 1:1, celle unite, formule automatiche volume cc., 6 contenitori S1..S6, 7 EV, Piatto e Zuppiera P1..P12)
 */
export function exportHistoricExcelCalibration(
  calibration: MachineCalibrationConfig,
  modelName: string = 'BIG 6 CATERING',
  serialNumber: string = '104829',
  formatTitle: string = 'Format RR-AF PRO'
): { success: boolean; filename: string; error?: string } {
  const wb = XLSX.utils.book_new();

  // Nomi Canister
  const c1 = calibration.canisters[0]?.name?.replace(/S\d+:\s*/, '') || 'MOUSSE FRUTTA';
  const c2 = calibration.canisters[1]?.name?.replace(/S\d+:\s*/, '') || 'PASTA TORTELLINI';
  const c3 = calibration.canisters[2]?.name?.replace(/S\d+:\s*/, '') || 'Puré VARI';
  const c4 = calibration.canisters[3]?.name?.replace(/S\d+:\s*/, '') || 'LATTE PRO DESSERT PRO';
  const c5 = calibration.canisters[4]?.name?.replace(/S\d+:\s*/, '') || 'OMOGENEIZZATI CARNE - PESCE';
  const c6 = calibration.canisters[5]?.name?.replace(/S\d+:\s*/, '') || 'FRITTATA';

  // Portate EV
  const evs = calibration.electrovalves || [];
  const ev1 = evs.find((e) => e.evNumber === 1)?.flowRateCcPerSec || 17;
  const ev2 = evs.find((e) => e.evNumber === 2)?.flowRateCcPerSec || 17;
  const ev3 = evs.find((e) => e.evNumber === 3)?.flowRateCcPerSec || 17;
  const ev4 = evs.find((e) => e.evNumber === 4)?.flowRateCcPerSec || 17;
  const ev5 = evs.find((e) => e.evNumber === 5)?.flowRateCcPerSec || 17;
  const ev6 = evs.find((e) => e.evNumber === 6)?.flowRateCcPerSec || 17;
  const evHot = evs.find((e) => e.evNumber === 7)?.flowRateCcPerSec || 20;

  // Giri Motore RPM
  const rpm1 = calibration.canisters[0]?.motorRpm || 120;
  const rpm2 = calibration.canisters[1]?.motorRpm || 120;
  const rpm3 = calibration.canisters[2]?.motorRpm || 120;
  const rpm4 = calibration.canisters[3]?.motorRpm || 200;
  const rpm5 = calibration.canisters[4]?.motorRpm || 200;
  const rpm6 = calibration.canisters[5]?.motorRpm || 200;

  const todayStr = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Inizializziamo matrice bidimensionale vuota (42 righe x 17 colonne)
  const totalRows = 42;
  const totalCols = 17;
  const grid: any[][] = Array.from({ length: totalRows }, () => Array(totalCols).fill(''));

  // Riga 0 (Excel 1): BEVOGEL sopra S1
  grid[0][4] = 'BEVOGEL';

  // Riga 1 (Excel 2): DATA
  grid[1][1] = 'DATA';
  grid[1][2] = todayStr;

  // Riga 2 (Excel 3): Nomi contenitori S1..S6 + ACQUA CALDA
  grid[2][4] = c1;
  grid[2][6] = c2;
  grid[2][8] = c3;
  grid[2][10] = c4;
  grid[2][12] = c5;
  grid[2][14] = c6;
  grid[2][16] = 'ACQUA CALDA';

  // Riga 3 (Excel 4): MODELLO
  grid[3][0] = 'MODELLO';
  grid[3][2] = modelName;

  // Riga 4 (Excel 5): MATRICOLA ed E.V. cc/sec
  grid[4][0] = 'MATRICOLA';
  grid[4][2] = serialNumber;
  grid[4][3] = 'E.V. cc/sec';
  grid[4][4] = ev1;
  grid[4][6] = ev2;
  grid[4][8] = ev3;
  grid[4][10] = ev4;
  grid[4][12] = ev5;
  grid[4][14] = ev6;
  grid[4][16] = evHot;

  // Riga 5 (Excel 6): Format Title e Giri Motore
  grid[5][0] = formatTitle;
  grid[5][3] = 'Motore';
  grid[5][4] = rpm1;
  grid[5][6] = rpm2;
  grid[5][8] = rpm3;
  grid[5][10] = rpm4;
  grid[5][12] = rpm5;
  grid[5][14] = rpm6;

  // Riga 6 (Excel 7): Ritardo >>>
  grid[6][3] = 'Ritardo >>>';
  grid[6][4] = 1.5;
  grid[6][6] = 1.5;
  grid[6][8] = 1.5;
  grid[6][10] = 1.5;
  grid[6][12] = 1.5;
  grid[6][14] = 1.5;

  // Riga 8 (Excel 9): Coda >>>
  grid[8][3] = 'Coda >>>';
  grid[8][4] = 0;
  grid[8][6] = 0;
  grid[8][8] = 0;
  grid[8][10] = 0;
  grid[8][12] = 0;
  grid[8][14] = 0;

  // Riga 9 (Excel 10): Header S1..S6 ed E.V.
  grid[9][3] = 'Volume cc.';
  grid[9][4] = 'S1';
  grid[9][6] = 'S2';
  grid[9][8] = 'S3';
  grid[9][10] = 'S4';
  grid[9][12] = 'S5';
  grid[9][14] = 'S6';
  grid[9][16] = 'E.V.';

  // Riga 10 (Excel 11): Intestazione Tabelle Dosi
  grid[10][0] = 'PULSANTE';
  grid[10][1] = 'ETICHETTA';
  grid[10][2] = 'SELEZIONE';
  grid[10][3] = 'cc.';
  grid[10][4] = 'ACQUA';
  grid[10][5] = 'POLVERE';
  grid[10][6] = 'ACQUA';
  grid[10][7] = 'POLVERE';
  grid[10][8] = 'ACQUA';
  grid[10][9] = 'POLVERE';
  grid[10][10] = 'ACQUA';
  grid[10][11] = 'POLVERE';
  grid[10][12] = 'ACQUA';
  grid[10][13] = 'POLVERE';
  grid[10][14] = 'ACQUA';
  grid[10][15] = 'POLVERE';
  grid[10][16] = 'ACQUA';

  // Funzione helper per estrarre i tempi
  const getProductTimings = (prod?: BeverageDosageCalibration) => {
    const out: number[] = [];
    for (let c = 1; c <= 6; c++) {
      const canTiming = prod?.canisterTimings?.find((ct) => ct.canisterId === `canister-${c}`);
      const evTiming = prod?.evTimings?.find((et) => et.evId === `ev-${c}`);
      const wSec = evTiming?.enabled ? Number(evTiming.waterDurationSec || 0) : 0;
      const pSec = canTiming?.enabled ? Number(canTiming.motorDurationSec || 0) : 0;
      out.push(wSec, pSec);
    }
    const hwTiming = prod?.evTimings?.find((et) => et.evId === 'ev-7');
    out.push(hwTiming?.enabled ? Number(hwTiming.waterDurationSec || 0) : 0);
    return out;
  };

  // Nomi etichette storiche predefinite
  const defaultLabels: { [key: string]: string } = {
    P1: 'Mousse di frutta',
    P2: 'Pasta tortellini',
    P3: 'Puré di patate',
    P4: 'Latte e biscotti',
    P5: 'Omogeneizzato manzo',
    P6: 'Frittata',
    P7: 'Omogeneizzato pollo',
    P8: 'Pasta e fagioli',
    P9: 'Puré carote',
    P10: 'Dessert cioccolato',
    P11: 'Omogeneizzato tacchino',
    P12: 'Acqua calda',
  };

  // Popolamento dei 12 Pulsanti (Righe 11..34)
  for (let i = 1; i <= 12; i++) {
    const key = `P${i}`;
    const pStd = calibration.standardProducts.find((p) => p.key === key);
    const pCar = calibration.caraffaProducts.find((p) => p.key === key);

    const labelClean = pStd?.name?.replace(/\s*\(Zuppiera\)/i, '') || defaultLabels[key] || `Prodotto ${key}`;
    const timingsP = getProductTimings(pStd);
    const timingsZ = getProductTimings(pCar);

    const rPiatto = 11 + (i - 1) * 2;
    const rZuppiera = rPiatto + 1;

    // Riga PIATTO
    grid[rPiatto][0] = key;
    grid[rPiatto][1] = labelClean;
    grid[rPiatto][2] = 'PIATTO';
    // Volume calcolato in cc
    const volP = Math.round(
      (timingsP[0] * ev1 + timingsP[2] * ev2 + timingsP[4] * ev3 + timingsP[6] * ev4 + timingsP[8] * ev5 + timingsP[10] * ev6 + timingsP[12] * evHot) * 10
    ) / 10;
    grid[rPiatto][3] = volP > 0 ? volP : '';
    // Tempi S1..S6 + EV7
    for (let t = 0; t < 12; t++) {
      grid[rPiatto][4 + t] = timingsP[t] > 0 ? timingsP[t] : '';
    }
    grid[rPiatto][16] = timingsP[12] > 0 ? timingsP[12] : '';

    // Riga ZUPPIERA
    grid[rZuppiera][0] = '';
    grid[rZuppiera][1] = '';
    grid[rZuppiera][2] = 'ZUPPIERA';
    const volZ = Math.round(
      (timingsZ[0] * ev1 + timingsZ[2] * ev2 + timingsZ[4] * ev3 + timingsZ[6] * ev4 + timingsZ[8] * ev5 + timingsZ[10] * ev6 + timingsZ[12] * evHot) * 10
    ) / 10;
    grid[rZuppiera][3] = volZ > 0 ? volZ : '';
    for (let t = 0; t < 12; t++) {
      grid[rZuppiera][4 + t] = timingsZ[t] > 0 ? timingsZ[t] : '';
    }
    grid[rZuppiera][16] = timingsZ[12] > 0 ? timingsZ[12] : '';
  }

  // Footer Parametri Macchina
  grid[36][0] = 'IMPULSO MINIMO';
  grid[36][2] = 1.0;

  grid[37][0] = 'TEMPO MIN IMPULSO';
  grid[37][2] = 1.0;

  grid[38][0] = 'TEMPERATURA';
  grid[38][2] = '90 °C';

  grid[39][0] = 'DELTA R2';
  grid[39][2] = '3°C';

  // Creazione foglio SheetJS
  const ws = XLSX.utils.aoa_to_sheet(grid);

  // Definizione Unioni di Celle (!merges)
  interface CellRange {
    s: { r: number; c: number };
    e: { r: number; c: number };
  }

  const merges: CellRange[] = [
    // BEVOGEL E1:Q1
    { s: { r: 0, c: 4 }, e: { r: 0, c: 16 } },

    // Nomi Contenitori S1..S6 (Riga 2 / Excel 3)
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } },
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } },
    { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } },
    { s: { r: 2, c: 10 }, e: { r: 2, c: 11 } },
    { s: { r: 2, c: 12 }, e: { r: 2, c: 13 } },
    { s: { r: 2, c: 14 }, e: { r: 2, c: 15 } },

    // E.V. cc/sec (Riga 4 / Excel 5)
    { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
    { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } },
    { s: { r: 4, c: 8 }, e: { r: 4, c: 9 } },
    { s: { r: 4, c: 10 }, e: { r: 4, c: 11 } },
    { s: { r: 4, c: 12 }, e: { r: 4, c: 13 } },
    { s: { r: 4, c: 14 }, e: { r: 4, c: 15 } },

    // Motore RPM (Riga 5 / Excel 6)
    { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
    { s: { r: 5, c: 6 }, e: { r: 5, c: 7 } },
    { s: { r: 5, c: 8 }, e: { r: 5, c: 9 } },
    { s: { r: 5, c: 10 }, e: { r: 5, c: 11 } },
    { s: { r: 5, c: 12 }, e: { r: 5, c: 13 } },
    { s: { r: 5, c: 14 }, e: { r: 5, c: 15 } },

    // Ritardo (Riga 6 / Excel 7)
    { s: { r: 6, c: 4 }, e: { r: 6, c: 5 } },
    { s: { r: 6, c: 6 }, e: { r: 6, c: 7 } },
    { s: { r: 6, c: 8 }, e: { r: 6, c: 9 } },
    { s: { r: 6, c: 10 }, e: { r: 6, c: 11 } },
    { s: { r: 6, c: 12 }, e: { r: 6, c: 13 } },
    { s: { r: 6, c: 14 }, e: { r: 6, c: 15 } },

    // Coda (Riga 8 / Excel 9)
    { s: { r: 8, c: 4 }, e: { r: 8, c: 5 } },
    { s: { r: 8, c: 6 }, e: { r: 8, c: 7 } },
    { s: { r: 8, c: 8 }, e: { r: 8, c: 9 } },
    { s: { r: 8, c: 10 }, e: { r: 8, c: 11 } },
    { s: { r: 8, c: 12 }, e: { r: 8, c: 13 } },
    { s: { r: 8, c: 14 }, e: { r: 8, c: 15 } },

    // Header S1..S6 (Riga 9 / Excel 10)
    { s: { r: 9, c: 4 }, e: { r: 9, c: 5 } },
    { s: { r: 9, c: 6 }, e: { r: 9, c: 7 } },
    { s: { r: 9, c: 8 }, e: { r: 9, c: 9 } },
    { s: { r: 9, c: 10 }, e: { r: 9, c: 11 } },
    { s: { r: 9, c: 12 }, e: { r: 9, c: 13 } },
    { s: { r: 9, c: 14 }, e: { r: 9, c: 15 } },

    // Format Title A6:C6
    { s: { r: 5, c: 0 }, e: { r: 5, c: 2 } },

    // Footer A37:B37 .. A40:B40
    { s: { r: 36, c: 0 }, e: { r: 36, c: 1 } },
    { s: { r: 37, c: 0 }, e: { r: 37, c: 1 } },
    { s: { r: 38, c: 0 }, e: { r: 38, c: 1 } },
    { s: { r: 39, c: 0 }, e: { r: 39, c: 1 } },
  ];

  // Unioni verticali per i 12 Pulsanti P1..P12 (Pulsante in Colonna A, Etichetta in Colonna B)
  for (let i = 0; i < 12; i++) {
    const r = 11 + i * 2;
    merges.push({ s: { r, c: 0 }, e: { r: r + 1, c: 0 } });
    merges.push({ s: { r, c: 1 }, e: { r: r + 1, c: 1 } });
  }

  ws['!merges'] = merges;

  // ==========================================
  // STYLING COMPLETO (COLORI, BORDI, FONT, ALLINEAMENTO)
  // ==========================================
  const BORDER_THIN = { style: 'thin', color: { rgb: 'D9D9D9' } };
  const BORDER_DARK_MED = { style: 'medium', color: { rgb: '595959' } };
  const BORDER_HEADER_BOTTOM = { style: 'medium', color: { rgb: '1F4E78' } };

  const cellBorderStandard = {
    top: BORDER_THIN,
    bottom: BORDER_THIN,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };

  const cellBorderZuppieraEnd = {
    top: BORDER_THIN,
    bottom: BORDER_DARK_MED,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };

  const cellBorderHeader = {
    top: BORDER_THIN,
    bottom: BORDER_HEADER_BOTTOM,
    left: BORDER_THIN,
    right: BORDER_THIN,
  };

  const applyCellStyle = (r: number, c: number, style: any) => {
    const ref = XLSX.utils.encode_cell({ r, c });
    if (!ws[ref]) ws[ref] = { v: '', t: 's' };
    ws[ref].s = { ...(ws[ref].s || {}), ...style };
  };

  const applyRangeStyle = (rStart: number, cStart: number, rEnd: number, cEnd: number, style: any) => {
    for (let r = rStart; r <= rEnd; r++) {
      for (let c = cStart; c <= cEnd; c++) {
        applyCellStyle(r, c, style);
      }
    }
  };

  // 1. Riga 0 (Excel 1): BEVOGEL Banner
  applyRangeStyle(0, 4, 0, 16, {
    fill: { fgColor: { rgb: '1F4E78' } },
    font: { name: 'Arial', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });

  // 2. Riga 1 (Excel 2): DATA
  applyCellStyle(1, 1, {
    fill: { fgColor: { rgb: 'F2F2F2' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '333333' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  applyCellStyle(1, 2, {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });

  // 3. Riga 2 (Excel 3): Nomi Contenitori S1..S6 + ACQUA CALDA
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(2, cStart, 2, cStart + 1, {
      fill: { fgColor: { rgb: 'D9E1F2' } },
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '1F4E78' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: cellBorderStandard,
    });
  }
  applyCellStyle(2, 16, {
    fill: { fgColor: { rgb: 'FCE4D6' } },
    font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: 'C00000' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: cellBorderStandard,
  });

  // 4. Riga 3 (Excel 4): MODELLO
  applyCellStyle(3, 0, {
    fill: { fgColor: { rgb: 'F2F2F2' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '333333' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  applyCellStyle(3, 1, { fill: { fgColor: { rgb: 'FFFFFF' } }, border: cellBorderStandard });
  applyCellStyle(3, 2, {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });

  // 5. Riga 4 (Excel 5): MATRICOLA ed E.V. cc/sec
  applyCellStyle(4, 0, {
    fill: { fgColor: { rgb: 'F2F2F2' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '333333' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  applyCellStyle(4, 1, { fill: { fgColor: { rgb: 'FFFFFF' } }, border: cellBorderStandard });
  applyCellStyle(4, 2, {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  applyCellStyle(4, 3, {
    fill: { fgColor: { rgb: 'D9E1F2' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1F4E78' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: cellBorderStandard,
  });
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(4, cStart, 4, cStart + 1, {
      fill: { fgColor: { rgb: 'EBF1F5' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }
  applyCellStyle(4, 16, {
    fill: { fgColor: { rgb: 'FCE4D6' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'C00000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });

  // 6. Riga 5 (Excel 6): Format Title e Giri Motore
  applyRangeStyle(5, 0, 5, 2, {
    fill: { fgColor: { rgb: '2F5597' } },
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  applyCellStyle(5, 3, {
    fill: { fgColor: { rgb: 'FFF2CC' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: cellBorderStandard,
  });
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(5, cStart, 5, cStart + 1, {
      fill: { fgColor: { rgb: 'FFF2CC' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }

  // 7. Riga 6 (Excel 7): Ritardo >>>
  applyCellStyle(6, 3, {
    fill: { fgColor: { rgb: 'F2F2F2' } },
    font: { name: 'Arial', sz: 9.5, color: { rgb: '333333' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: cellBorderStandard,
  });
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(6, cStart, 6, cStart + 1, {
      fill: { fgColor: { rgb: 'F9F9F9' } },
      font: { name: 'Arial', sz: 9.5, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }

  // 8. Riga 8 (Excel 9): Coda >>>
  applyCellStyle(8, 3, {
    fill: { fgColor: { rgb: 'F2F2F2' } },
    font: { name: 'Arial', sz: 9.5, color: { rgb: '333333' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: cellBorderStandard,
  });
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(8, cStart, 8, cStart + 1, {
      fill: { fgColor: { rgb: 'F9F9F9' } },
      font: { name: 'Arial', sz: 9.5, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }

  // 9. Riga 9 (Excel 10): Header S1..S6 ed E.V.
  applyCellStyle(9, 3, {
    fill: { fgColor: { rgb: 'D9E1F2' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '1F4E78' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });
  for (let i = 0; i < 6; i++) {
    const cStart = 4 + i * 2;
    applyRangeStyle(9, cStart, 9, cStart + 1, {
      fill: { fgColor: { rgb: '2F5597' } },
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }
  applyCellStyle(9, 16, {
    fill: { fgColor: { rgb: 'C00000' } },
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderStandard,
  });

  // 10. Riga 10 (Excel 11): Intestazione Tabelle Dosi
  applyRangeStyle(10, 0, 10, 3, {
    fill: { fgColor: { rgb: '1F4E78' } },
    font: { name: 'Arial', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderHeader,
  });
  for (let i = 0; i < 6; i++) {
    // ACQUA (col E, G, I, K, M, O)
    applyCellStyle(10, 4 + i * 2, {
      fill: { fgColor: { rgb: 'BDD7EE' } },
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '002060' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderHeader,
    });
    // POLVERE (col F, H, J, L, N, P)
    applyCellStyle(10, 5 + i * 2, {
      fill: { fgColor: { rgb: 'FCE4D6' } },
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '7F3F00' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderHeader,
    });
  }
  // ACQUA Calda (col Q)
  applyCellStyle(10, 16, {
    fill: { fgColor: { rgb: 'BDD7EE' } },
    font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: 'C00000' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: cellBorderHeader,
  });

  // 11. Righe 11..34 (Excel 12..35): Ricette P1..P12
  for (let i = 1; i <= 12; i++) {
    const rP = 11 + (i - 1) * 2;
    const rZ = rP + 1;

    // Colonna A: Tasto P1..P12 (unito verticalmente)
    applyCellStyle(rP, 0, {
      fill: { fgColor: { rgb: 'EDEDED' } },
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
    applyCellStyle(rZ, 0, {
      fill: { fgColor: { rgb: 'EDEDED' } },
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderZuppieraEnd,
    });

    // Colonna B: Etichetta (unita verticalmente)
    applyCellStyle(rP, 1, {
      fill: { fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: cellBorderStandard,
    });
    applyCellStyle(rZ, 1, {
      fill: { fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: cellBorderZuppieraEnd,
    });

    // Colonna C: Selezione PIATTO / ZUPPIERA
    applyCellStyle(rP, 2, {
      fill: { fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
    applyCellStyle(rZ, 2, {
      fill: { fgColor: { rgb: 'F2F2F2' } },
      font: { name: 'Arial', sz: 9, bold: true, color: { rgb: '1F4E78' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderZuppieraEnd,
    });

    // Colonna D: Volume cc.
    applyCellStyle(rP, 3, {
      fill: { fgColor: { rgb: 'FFF2CC' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
      numFmt: '0.0',
    });
    applyCellStyle(rZ, 3, {
      fill: { fgColor: { rgb: 'FFE699' } },
      font: { name: 'Arial', sz: 10, bold: true, color: { rgb: '000000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderZuppieraEnd,
      numFmt: '0.0',
    });

    // Colonne E..P: Tempi S1..S6 Acqua e Polvere
    for (let c = 4; c <= 15; c++) {
      const isWater = c % 2 === 0;
      applyCellStyle(rP, c, {
        fill: { fgColor: { rgb: 'FFFFFF' } },
        font: { name: 'Arial', sz: 9.5, color: { rgb: isWater ? '002060' : '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderStandard,
        numFmt: '0.0',
      });
      applyCellStyle(rZ, c, {
        fill: { fgColor: { rgb: isWater ? 'F2F5F9' : 'FFF9F5' } },
        font: { name: 'Arial', sz: 9.5, color: { rgb: isWater ? '002060' : '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: cellBorderZuppieraEnd,
        numFmt: '0.0',
      });
    }

    // Colonna Q: EV Calda
    applyCellStyle(rP, 16, {
      fill: { fgColor: { rgb: 'FFFFFF' } },
      font: { name: 'Arial', sz: 9.5, color: { rgb: 'C00000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
      numFmt: '0.0',
    });
    applyCellStyle(rZ, 16, {
      fill: { fgColor: { rgb: 'F2F2F2' } },
      font: { name: 'Arial', sz: 9.5, color: { rgb: 'C00000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderZuppieraEnd,
      numFmt: '0.0',
    });
  }

  // 12. Righe 36..39 (Excel 37..40): Parametri Caldaia e Impulsi
  for (let r = 36; r <= 39; r++) {
    applyRangeStyle(r, 0, r, 1, {
      fill: { fgColor: { rgb: 'E7E6E6' } },
      font: { name: 'Arial', sz: 9.5, bold: true, color: { rgb: '333333' } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: cellBorderStandard,
    });
    applyCellStyle(r, 2, {
      fill: { fgColor: { rgb: 'FFFFFF' } },
      font: {
        name: 'Arial',
        sz: 10,
        bold: true,
        color: { rgb: r === 38 ? 'C00000' : '000000' },
      },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: cellBorderStandard,
    });
  }

  // ==========================================
  // LARGHEZZE COLONNE ED ALTEZZE RIGHE (DIMENSIONI CELLE)
  // ==========================================
  ws['!cols'] = [
    { wch: 13 }, // A: PULSANTE
    { wch: 32 }, // B: ETICHETTA (Spaziosa, nessun testo troncato)
    { wch: 14 }, // C: SELEZIONE
    { wch: 13 }, // D: cc. (Volume)
    { wch: 11 }, // E: S1 ACQUA
    { wch: 11 }, // F: S1 POLVERE
    { wch: 11 }, // G: S2 ACQUA
    { wch: 11 }, // H: S2 POLVERE
    { wch: 11 }, // I: S3 ACQUA
    { wch: 11 }, // J: S3 POLVERE
    { wch: 11 }, // K: S4 ACQUA
    { wch: 11 }, // L: S4 POLVERE
    { wch: 11 }, // M: S5 ACQUA
    { wch: 11 }, // N: S5 POLVERE
    { wch: 11 }, // O: S6 ACQUA
    { wch: 11 }, // P: S6 POLVERE
    { wch: 15 }, // Q: ACQUA CALDA E.V.
  ];

  const rowHeights: { [r: number]: number } = {
    0: 26,  // BEVOGEL
    1: 21,  // DATA
    2: 30,  // NOMI CONTENITORI (spazio per 2 righe di testo)
    3: 21,  // MODELLO
    4: 24,  // MATRICOLA / E.V. cc/sec
    5: 24,  // FORMAT / Motore RPM
    6: 21,  // Ritardo
    7: 12,  // Separatore vuoto
    8: 21,  // Coda
    9: 26,  // Header S1..S6 / E.V.
    10: 26, // Header PULSANTE / ETICHETTA / ACQUA / POLVERE
    35: 14, // Separatore vuoto
    36: 22, // IMPULSO MINIMO
    37: 22, // TEMPO MIN IMPULSO
    38: 22, // TEMPERATURA
    39: 22, // DELTA R2
  };

  ws['!rows'] = Array.from({ length: 42 }, (_, r) => ({
    hpt: rowHeights[r] || (r >= 11 && r <= 34 ? 21 : 20),
  }));

  XLSX.utils.book_append_sheet(wb, ws, 'Taratura RR-AF PRO');

  const cleanModel = (modelName || 'BIG_6').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSerial = (serialNumber || '104829').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Taratura_${cleanModel}_MATR_${cleanSerial}.xlsx`;

  try {
    // Generazione file binario formattato con stili
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    // Download compatibile al 100% con browser e iframe
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.style.display = 'none';
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();

    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
      window.URL.revokeObjectURL(url);
    }, 400);

    return { success: true, filename };
  } catch (err: any) {
    // Fallback standard XLSX.writeFile
    try {
      XLSX.writeFile(wb, filename);
      return { success: true, filename };
    } catch (fallbackErr: any) {
      console.error('Errore export Excel:', fallbackErr);
      return { success: false, filename, error: fallbackErr?.message || String(fallbackErr) };
    }
  }
}
