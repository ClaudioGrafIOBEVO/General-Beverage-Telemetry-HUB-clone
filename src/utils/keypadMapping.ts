import {
  Coffee,
  CupSoda,
  Flame,
  Droplets,
  Zap,
  Sparkles,
  Octagon,
  Languages,
  Wine,
  HelpCircle,
  LucideIcon,
} from 'lucide-react';
import { VendingMachine } from '../types';

export interface MatrixKeyDefinition {
  key: string;            // Canonical key code: 'P1', 'P2', ..., 'P12', 'CARAFFA', 'STOP', 'LINGUA'
  productNum: number;     // 1 to 12 for beverages, 0 for system function keys
  label: string;          // e.g. "PRODOTTO 1", "STOP", "CARAFFA", "LINGUA"
  sub: string;            // e.g. "Eroga Subito", "Dose Caraffa", "Arresto Immediato"
  code: string;           // e.g. "P01", "P02", ..., "CARAFFA", "STOP", "LANG"
  icon: LucideIcon;
  color: 'amber' | 'orange' | 'emerald' | 'cyan' | 'emerald' | 'yellow' | 'rose' | 'blue';
  wirePins: string;       // e.g. "Fili 4-8"
  wireA: number;          // Pin/Wire A index (1-8)
  wireB: number;          // Pin/Wire B index (1-8)
  defaultProduct: string; // Default beverage name
  isProduct: boolean;
  isSpecial?: boolean;
}

// Official 15 Matrix Keys based on Hardware Table (U1..U8 / Fili 1..8)
export const MATRIX_KEYS: MatrixKeyDefinition[] = [
  // Colonna U5 (Filo 5)
  {
    key: 'P1',
    productNum: 1,
    label: 'PRODOTTO 1',
    sub: 'Eroga Subito',
    code: 'P01',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U1 + U5 (Fili 1-5)',
    wireA: 1,
    wireB: 5,
    defaultProduct: 'Caffè Espresso',
    isProduct: true,
  },
  {
    key: 'P2',
    productNum: 2,
    label: 'PRODOTTO 2',
    sub: 'Eroga Subito',
    code: 'P02',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U2 + U5 (Fili 2-5)',
    wireA: 2,
    wireB: 5,
    defaultProduct: 'Caffè Lungo',
    isProduct: true,
  },
  {
    key: 'P3',
    productNum: 3,
    label: 'PRODOTTO 3',
    sub: 'Eroga Subito',
    code: 'P03',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U3 + U5 (Fili 3-5)',
    wireA: 3,
    wireB: 5,
    defaultProduct: 'Caffè Macchiato',
    isProduct: true,
  },
  {
    key: 'P4',
    productNum: 4,
    label: 'PRODOTTO 4',
    sub: 'Eroga Subito',
    code: 'P04',
    icon: CupSoda,
    color: 'emerald',
    wirePins: 'U1 + U6 (Fili 1-6)',
    wireA: 1,
    wireB: 6,
    defaultProduct: 'Cappuccino Schiumato',
    isProduct: true,
  },

  // Colonna U6 (Filo 6)
  {
    key: 'P5',
    productNum: 5,
    label: 'PRODOTTO 5',
    sub: 'Eroga Subito',
    code: 'P05',
    icon: Flame,
    color: 'orange',
    wirePins: 'U2 + U6 (Fili 2-6)',
    wireA: 2,
    wireB: 6,
    defaultProduct: 'Mocaccino / Cioccolato',
    isProduct: true,
  },
  {
    key: 'P6',
    productNum: 6,
    label: 'PRODOTTO 6',
    sub: 'Eroga Subito',
    code: 'P06',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U3 + U6 (Fili 3-6)',
    wireA: 3,
    wireB: 6,
    defaultProduct: 'Latte Caldo Macchiato',
    isProduct: true,
  },
  {
    key: 'P7',
    productNum: 7,
    label: 'PRODOTTO 7',
    sub: 'Eroga Subito',
    code: 'P07',
    icon: Sparkles,
    color: 'emerald',
    wirePins: 'U1 + U7 (Fili 1-7)',
    wireA: 1,
    wireB: 7,
    defaultProduct: 'Cioccolata Calda Densa',
    isProduct: true,
  },
  {
    key: 'P8',
    productNum: 8,
    label: 'PRODOTTO 8',
    sub: 'Eroga Subito',
    code: 'P08',
    icon: CupSoda,
    color: 'emerald',
    wirePins: 'U2 + U7 (Fili 2-7)',
    wireA: 2,
    wireB: 7,
    defaultProduct: 'Tè Caldo al Limone',
    isProduct: true,
  },

  // Colonna U7 & U8 (Fili 7 & 8)
  {
    key: 'P9',
    productNum: 9,
    label: 'PRODOTTO 9',
    sub: 'Eroga Subito',
    code: 'P09',
    icon: Zap,
    color: 'yellow',
    wirePins: 'U3 + U7 (Fili 3-7)',
    wireA: 3,
    wireB: 7,
    defaultProduct: 'Caffè Americano XL',
    isProduct: true,
  },
  {
    key: 'P10',
    productNum: 10,
    label: 'PRODOTTO 10',
    sub: 'Eroga Subito',
    code: 'P10',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U1 + U8 (Fili 1-8)',
    wireA: 1,
    wireB: 8,
    defaultProduct: 'Ginseng Cremoso',
    isProduct: true,
  },
  {
    key: 'P11',
    productNum: 11,
    label: 'PRODOTTO 11',
    sub: 'Eroga Subito',
    code: 'P11',
    icon: Coffee,
    color: 'amber',
    wirePins: 'U2 + U8 (Fili 2-8)',
    wireA: 2,
    wireB: 8,
    defaultProduct: 'Orzo Naturale Tostato',
    isProduct: true,
  },
  {
    key: 'P12',
    productNum: 12,
    label: 'PRODOTTO 12',
    sub: 'Eroga Subito',
    code: 'P12',
    icon: Droplets,
    color: 'cyan',
    wirePins: 'U3 + U8 (Fili 3-8)',
    wireA: 3,
    wireB: 8,
    defaultProduct: 'Acqua Calda / Tisana',
    isProduct: true,
  },

  // Row 4 (System Function Keys)
  {
    key: 'CARAFFA',
    productNum: 0,
    label: 'CARAFFA',
    sub: 'Dose Caraffa',
    code: 'CARAFFA',
    icon: Wine,
    color: 'cyan',
    wirePins: 'U4 + U6 (Fili 4-6)',
    wireA: 4,
    wireB: 6,
    defaultProduct: 'Modalità Caraffa',
    isProduct: false,
    isSpecial: true,
  },
  {
    key: 'STOP',
    productNum: 0,
    label: 'STOP',
    sub: 'Arresto Immediato',
    code: 'STOP',
    icon: Octagon,
    color: 'rose',
    wirePins: 'U4 + U7 (Fili 4-7)',
    wireA: 4,
    wireB: 7,
    defaultProduct: 'Arresto Emergenza',
    isProduct: false,
    isSpecial: true,
  },
  {
    key: 'LINGUA',
    productNum: 0,
    label: 'LINGUA',
    sub: 'IT / EN / DE / FR / ES',
    code: 'LINGUA',
    icon: Languages,
    color: 'blue',
    wirePins: 'U4 + U5 (Fili 4-5)',
    wireA: 4,
    wireB: 5,
    defaultProduct: 'Selezione Lingua LCD',
    isProduct: false,
    isSpecial: true,
  },
];

// 4x4 Grid layout structured for the distributor simulator
export const MATRIX_PRODUCT_ROWS: MatrixKeyDefinition[][] = [
  MATRIX_KEYS.slice(0, 4),   // P1, P2, P3, P4
  MATRIX_KEYS.slice(4, 8),   // P5, P6, P7, P8
  MATRIX_KEYS.slice(8, 12),  // P9, P10, P11, P12
];

export const MATRIX_FUNCTION_ROW: MatrixKeyDefinition[] = MATRIX_KEYS.slice(12, 15); // CARAFFA, STOP, LINGUA

export const ALL_CANONICAL_KEYS: string[] = MATRIX_KEYS.map((k) => k.key);

// Tasti mostrati nella visualizzazione dati e reportistica telemetrica
export const DATA_DISPLAY_KEYS: string[] = ALL_CANONICAL_KEYS;

// Mapping from legacy phone-keypad characters to real matrix table keys
const LEGACY_KEY_MAP: Record<string, string> = {
  '1': 'P1',
  '2': 'P2',
  '3': 'P3',
  'A': 'P4',
  '4': 'P5',
  '5': 'P6',
  '6': 'P7',
  'B': 'P8',
  '7': 'P9',
  '8': 'P10',
  '9': 'P11',
  'C': 'P12',
  '*': 'CARAFFA',
  '0': 'STOP',
  '#': 'LINGUA',
  'D': 'LINGUA',
};

/**
 * Normalizes any incoming key string (e.g. 'P1', '1', 'A', '*', 'CARAFFA')
 * into the exact standard matrix key code ('P1'..'P12', 'CARAFFA', 'STOP', 'LINGUA').
 */
export function normalizeMatrixKey(rawKey: string | undefined | null): string {
  if (!rawKey) return 'P1';
  const clean = String(rawKey).trim().toUpperCase();

  // Already canonical?
  if (MATRIX_KEYS.some((m) => m.key === clean)) {
    return clean;
  }

  // Check 'P01' -> 'P1', 'P02' -> 'P2', etc.
  const pMatch = clean.match(/^P0?([1-9]|1[0-2])$/);
  if (pMatch) {
    return `P${parseInt(pMatch[1], 10)}`;
  }

  // Check legacy map
  if (LEGACY_KEY_MAP[clean]) {
    return LEGACY_KEY_MAP[clean];
  }

  // Match keyword in string
  if (clean.includes('CARAFFA') || clean.includes('JARRA') || clean.includes('KARAFFE')) return 'CARAFFA';
  if (clean.includes('STOP') || clean.includes('ARRESTO') || clean.includes('EMERG')) return 'STOP';
  if (clean.includes('LINGUA') || clean.includes('LANG') || clean.includes('IDIOMA')) return 'LINGUA';

  return clean;
}

/**
 * Resolves the full information for a key, including its custom or default associated product.
 */
export function resolveKeyDetails(
  rawKey: string | undefined | null,
  machineOrKeyMap?: VendingMachine | Record<string, string> | null
) {
  const canonicalKey = normalizeMatrixKey(rawKey);
  const def = MATRIX_KEYS.find((k) => k.key === canonicalKey) || {
    key: canonicalKey,
    productNum: 0,
    label: `TASTO ${canonicalKey}`,
    sub: 'Erogazione',
    code: canonicalKey,
    icon: HelpCircle,
    color: 'amber' as const,
    wirePins: 'Fili Matrice',
    wireA: 0,
    wireB: 0,
    defaultProduct: `Prodotto ${canonicalKey}`,
    isProduct: canonicalKey.startsWith('P'),
    isSpecial: !canonicalKey.startsWith('P'),
  };

  // Check custom mapping
  let customMap: Record<string, string> | undefined;
  if (machineOrKeyMap && typeof machineOrKeyMap === 'object') {
    if ('keyMapping' in machineOrKeyMap && machineOrKeyMap.keyMapping && typeof machineOrKeyMap.keyMapping === 'object') {
      customMap = machineOrKeyMap.keyMapping as Record<string, string>;
    } else if (!('id' in machineOrKeyMap)) {
      customMap = machineOrKeyMap as Record<string, string>;
    }
  }

  // Look for canonical key or legacy alias in map
  let associatedProduct = def.defaultProduct;
  if (customMap) {
    if (customMap[canonicalKey]) {
      associatedProduct = customMap[canonicalKey];
    } else {
      // Find matching legacy key if present
      for (const [legacy, canon] of Object.entries(LEGACY_KEY_MAP)) {
        if (canon === canonicalKey && customMap[legacy]) {
          associatedProduct = customMap[legacy];
          break;
        }
      }
    }
  }

  // Visual styling classes
  let badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  let pillStyle = 'bg-amber-500/20 text-amber-200 border border-amber-400/30';

  if (canonicalKey === 'CARAFFA') {
    badgeStyle = 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    pillStyle = 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30';
  } else if (canonicalKey === 'STOP') {
    badgeStyle = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    pillStyle = 'bg-rose-500/20 text-rose-200 border border-rose-400/30';
  } else if (canonicalKey === 'LINGUA') {
    badgeStyle = 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    pillStyle = 'bg-blue-500/20 text-blue-200 border border-blue-400/30';
  } else if (def.color === 'emerald') {
    badgeStyle = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    pillStyle = 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30';
  } else if (def.color === 'amber') {
    badgeStyle = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    pillStyle = 'bg-amber-500/20 text-amber-200 border border-amber-400/30';
  } else if (def.color === 'orange') {
    badgeStyle = 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    pillStyle = 'bg-orange-500/20 text-orange-200 border border-orange-400/30';
  } else if (def.color === 'yellow') {
    badgeStyle = 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
    pillStyle = 'bg-yellow-500/20 text-yellow-200 border border-yellow-400/30';
  }

  return {
    ...def,
    canonicalKey,
    associatedProduct,
    isProduct: def.isProduct,
    isFunction: !def.isProduct,
    badgeStyle,
    pillStyle,
  };
}

/**
 * Resolves label for standalone modules not associated with any machine.
 * As requested: generic buttons "Pulsante 1", "Pulsante 2", ..., "Pulsante Caraffa", etc.
 */
export function resolveStandaloneButtonLabel(rawKey: string | undefined | null): { label: string; productName: string } {
  const clean = normalizeMatrixKey(rawKey);
  const numMatch = clean.match(/^P0?([1-9]|1[0-2])$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    return {
      label: `Pulsante ${n}`,
      productName: `Pulsante ${n}`,
    };
  }
  if (clean === 'CARAFFA') {
    return {
      label: 'Pulsante Caraffa',
      productName: 'Pulsante Caraffa',
    };
  }
  if (clean === 'STOP') {
    return {
      label: 'Pulsante Stop',
      productName: 'Pulsante Stop',
    };
  }
  if (clean === 'LINGUA') {
    return {
      label: 'Pulsante Lingua',
      productName: 'Pulsante Lingua',
    };
  }
  return {
    label: `Pulsante ${clean}`,
    productName: `Pulsante ${clean}`,
  };
}
