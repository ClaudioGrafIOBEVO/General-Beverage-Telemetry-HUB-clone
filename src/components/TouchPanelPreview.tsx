import React, { useState, useEffect, useRef } from 'react';
import {
  Coffee,
  CupSoda,
  Flame,
  Droplets,
  Zap,
  Sparkles,
  Languages,
  Wine,
  Maximize2,
  Minimize2,
  X,
  Volume2,
  VolumeX,
  CheckCircle2,
  RotateCcw,
  Clock,
  Key,
  Heart,
  Smile,
  Sun,
  Moon,
  ShieldCheck,
  Copy,
  ExternalLink,
  Check,
  Tablet,
} from 'lucide-react';
import { MATRIX_KEYS, MatrixKeyDefinition } from '../utils/keypadMapping';
import { VendingMachine } from '../types';

interface TouchPanelPreviewProps {
  onBackToDashboard?: () => void;
  selectedMachine?: VendingMachine | null;
  machines?: VendingMachine[];
  onSelectMachine?: (machineId: string) => void;
  isStandaloneKiosk?: boolean;
  onExitKiosk?: () => void;
}

type SupportedLanguage = 'IT' | 'EN' | 'ES' | 'DE';

interface BeveragePresentation {
  name: string;
  subtitle: string;
  category: string;
  aromaTag: string;
  colorScheme: {
    badge: string;
    iconBg: string;
    iconText: string;
  };
}

const BEVERAGE_DETAILS: Record<SupportedLanguage, Record<string, BeveragePresentation>> = {
  IT: {
    P1: {
      name: 'Caffè Espresso',
      subtitle: 'Crema dorata, corpo intenso e persistente',
      category: 'I Nostri Caffè',
      aromaTag: 'Intenso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P2: {
      name: 'Caffè Lungo',
      subtitle: 'Gusto morbido, estrazione delicata e rotonda',
      category: 'I Nostri Caffè',
      aromaTag: 'Equilibrato',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P3: {
      name: 'Caffè Macchiato',
      subtitle: 'Espresso arricchito da una soffice goccia di latte',
      category: 'I Nostri Caffè',
      aromaTag: 'Morbido',
      colorScheme: { badge: 'bg-orange-100 text-orange-900 border-orange-300', iconBg: 'bg-orange-100 text-orange-800', iconText: 'text-orange-800' },
    },
    P4: {
      name: 'Cappuccino Tradizionale',
      subtitle: 'Crema di latte vellutata su cuore di espresso',
      category: 'Specialità al Latte',
      aromaTag: 'Cremoso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P5: {
      name: 'Mocaccino Goloso',
      subtitle: 'Caffè espresso, cioccolato fine e schiuma di latte',
      category: 'Specialità al Latte',
      aromaTag: 'Cioccolato',
      colorScheme: { badge: 'bg-stone-200 text-stone-900 border-stone-400', iconBg: 'bg-stone-200 text-stone-800', iconText: 'text-stone-800' },
    },
    P6: {
      name: 'Latte Caldo Macchiato',
      subtitle: 'Morbido latte caldo con un tocco aromatico di caffè',
      category: 'Specialità al Latte',
      aromaTag: 'Delicato',
      colorScheme: { badge: 'bg-yellow-100 text-yellow-900 border-yellow-300', iconBg: 'bg-yellow-100 text-yellow-800', iconText: 'text-yellow-800' },
    },
    P7: {
      name: 'Cioccolata Pregiata',
      subtitle: 'Cacao selezionato, densa, calda e avvolgente',
      category: 'Cioccolata & Infusi',
      aromaTag: 'Golosa',
      colorScheme: { badge: 'bg-rose-100 text-rose-900 border-rose-300', iconBg: 'bg-rose-100 text-rose-800', iconText: 'text-rose-800' },
    },
    P8: {
      name: 'Tè Caldo al Limone',
      subtitle: 'Infuso aromatico di foglie di tè con freschezza agrumata',
      category: 'Cioccolata & Infusi',
      aromaTag: 'Rinfrescante',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P9: {
      name: 'Caffè Americano XL',
      subtitle: 'Gusto armonioso in tazza grande per una pausa relax',
      category: 'I Nostri Caffè',
      aromaTag: 'Armonioso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P10: {
      name: 'Ginseng Dolce',
      subtitle: 'Estratto di radice dorata, cremoso ed energizzante',
      category: 'Ginseng & Benessere',
      aromaTag: 'Energia',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P11: {
      name: 'Orzo Tostato Naturale',
      subtitle: '100% cereali tostati italiani, naturalmente senza caffeina',
      category: 'Ginseng & Benessere',
      aromaTag: 'Naturale',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P12: {
      name: 'Acqua Calda per Tisana',
      subtitle: 'Acqua purificata bollente pronta per il tuo infuso',
      category: 'Cioccolata & Infusi',
      aromaTag: 'Purificante',
      colorScheme: { badge: 'bg-sky-100 text-sky-900 border-sky-300', iconBg: 'bg-sky-100 text-sky-800', iconText: 'text-sky-800' },
    },
  },
  EN: {
    P1: {
      name: 'Espresso Coffee',
      subtitle: 'Golden crema, rich and lingering aroma',
      category: 'Our Coffees',
      aromaTag: 'Intense',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P2: {
      name: 'Lungo Coffee',
      subtitle: 'Smooth body with balanced long extraction',
      category: 'Our Coffees',
      aromaTag: 'Balanced',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P3: {
      name: 'Macchiato',
      subtitle: 'Espresso marked with a dash of warm frothed milk',
      category: 'Our Coffees',
      aromaTag: 'Smooth',
      colorScheme: { badge: 'bg-orange-100 text-orange-900 border-orange-300', iconBg: 'bg-orange-100 text-orange-800', iconText: 'text-orange-800' },
    },
    P4: {
      name: 'Italian Cappuccino',
      subtitle: 'Velvety micro-foamed milk on rich espresso',
      category: 'Milk Specialties',
      aromaTag: 'Creamy',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P5: {
      name: 'Mochaccino',
      subtitle: 'Harmonious blend of espresso, dark cocoa and milk',
      category: 'Milk Specialties',
      aromaTag: 'Cocoa',
      colorScheme: { badge: 'bg-stone-200 text-stone-900 border-stone-400', iconBg: 'bg-stone-200 text-stone-800', iconText: 'text-stone-800' },
    },
    P6: {
      name: 'Warm Latte',
      subtitle: 'Comforting warm milk with a subtle drop of espresso',
      category: 'Milk Specialties',
      aromaTag: 'Gentle',
      colorScheme: { badge: 'bg-yellow-100 text-yellow-900 border-yellow-300', iconBg: 'bg-yellow-100 text-yellow-800', iconText: 'text-yellow-800' },
    },
    P7: {
      name: 'Hot Chocolate',
      subtitle: 'Premium European cocoa, thick, velvety and sweet',
      category: 'Choco & Teas',
      aromaTag: 'Sweet',
      colorScheme: { badge: 'bg-rose-100 text-rose-900 border-rose-300', iconBg: 'bg-rose-100 text-rose-800', iconText: 'text-rose-800' },
    },
    P8: {
      name: 'Lemon Tea',
      subtitle: 'Fragrant black tea infused with natural Mediterranean lemon',
      category: 'Choco & Teas',
      aromaTag: 'Refreshing',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P9: {
      name: 'Americano XL',
      subtitle: 'Extended brew in large cup for a peaceful break',
      category: 'Our Coffees',
      aromaTag: 'Harmonious',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P10: {
      name: 'Golden Ginseng',
      subtitle: 'Energizing sweet herbal root extract drink',
      category: 'Wellness & Roots',
      aromaTag: 'Energy',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P11: {
      name: 'Roasted Barley',
      subtitle: 'Pure roasted malt grain, 100% naturally caffeine-free',
      category: 'Wellness & Roots',
      aromaTag: 'Natural',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P12: {
      name: 'Hot Water',
      subtitle: 'Pure boiling water ready for your tea bag or herbal blend',
      category: 'Choco & Teas',
      aromaTag: 'Pure',
      colorScheme: { badge: 'bg-sky-100 text-sky-900 border-sky-300', iconBg: 'bg-sky-100 text-sky-800', iconText: 'text-sky-800' },
    },
  },
  ES: {
    P1: {
      name: 'Café Espresso',
      subtitle: 'Crema dorada, cuerpo aromático e intenso',
      category: 'Nuestros Cafés',
      aromaTag: 'Intenso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P2: {
      name: 'Café Largo',
      subtitle: 'Sabor redondo y extracción equilibrada',
      category: 'Nuestros Cafés',
      aromaTag: 'Equilibrado',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P3: {
      name: 'Café Cortado',
      subtitle: 'Espresso con una suave gota de leche espumada',
      category: 'Nuestros Cafés',
      aromaTag: 'Suave',
      colorScheme: { badge: 'bg-orange-100 text-orange-900 border-orange-300', iconBg: 'bg-orange-100 text-orange-800', iconText: 'text-orange-800' },
    },
    P4: {
      name: 'Capuchino Italiano',
      subtitle: 'Espuma de leche cremosa sobre corazón de café',
      category: 'Con Leche',
      aromaTag: 'Cremoso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P5: {
      name: 'Mocaccino',
      subtitle: 'Café, chocolate selezionato y crema de leche',
      category: 'Con Leche',
      aromaTag: 'Chocolate',
      colorScheme: { badge: 'bg-stone-200 text-stone-900 border-stone-400', iconBg: 'bg-stone-200 text-stone-800', iconText: 'text-stone-800' },
    },
    P6: {
      name: 'Leche Caliente',
      subtitle: 'Leche tibia montada con un toque de café',
      category: 'Con Leche',
      aromaTag: 'Delicado',
      colorScheme: { badge: 'bg-yellow-100 text-yellow-900 border-yellow-300', iconBg: 'bg-yellow-100 text-yellow-800', iconText: 'text-yellow-800' },
    },
    P7: {
      name: 'Chocolate Espeso',
      subtitle: 'Cacao caliente de alta calidad, denso y reconfortante',
      category: 'Choco e Infusiones',
      aromaTag: 'Dulce',
      colorScheme: { badge: 'bg-rose-100 text-rose-900 border-rose-300', iconBg: 'bg-rose-100 text-rose-800', iconText: 'text-rose-800' },
    },
    P8: {
      name: 'Té al Limón',
      subtitle: 'Té negro aromático con toque fresco de limón',
      category: 'Choco e Infusiones',
      aromaTag: 'Refrescante',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P9: {
      name: 'Café Americano XL',
      subtitle: 'Taza grande para disfrutar con tranquilidad',
      category: 'Nuestros Cafés',
      aromaTag: 'Armonioso',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P10: {
      name: 'Ginseng Dulce',
      subtitle: 'Bebida reconstituyente, cremosa y llena de energía',
      category: 'Bienestar',
      aromaTag: 'Energía',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P11: {
      name: 'Cebada Tostada',
      subtitle: '100% natural, sin cafeína, ideal a cualquier hora',
      category: 'Bienestar',
      aromaTag: 'Natural',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P12: {
      name: 'Agua Caliente',
      subtitle: 'Agua pura hirviendo lista para tu bolsita de té',
      category: 'Choco e Infusiones',
      aromaTag: 'Puro',
      colorScheme: { badge: 'bg-sky-100 text-sky-900 border-sky-300', iconBg: 'bg-sky-100 text-sky-800', iconText: 'text-sky-800' },
    },
  },
  DE: {
    P1: {
      name: 'Kaffee Espresso',
      subtitle: 'Goldene Crema, kräftig und vollmundig',
      category: 'Klassiker',
      aromaTag: 'Intensiv',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P2: {
      name: 'Café Crème',
      subtitle: 'Ausgewogener feiner Genuss mit milder Note',
      category: 'Klassiker',
      aromaTag: 'Ausgewogen',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P3: {
      name: 'Espresso Macchiato',
      subtitle: 'Espresso verfeinert mit warmem Milchschaum',
      category: 'Klassiker',
      aromaTag: 'Sanft',
      colorScheme: { badge: 'bg-orange-100 text-orange-900 border-orange-300', iconBg: 'bg-orange-100 text-orange-800', iconText: 'text-orange-800' },
    },
    P4: {
      name: 'Cappuccino',
      subtitle: 'Samtiger Milchschaum auf kräftigem Espresso',
      category: 'Milchspezialitäten',
      aromaTag: 'Cremig',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P5: {
      name: 'Mocaccino',
      subtitle: 'Feine Schokolade, Espresso und heißer Schaum',
      category: 'Milchspezialitäten',
      aromaTag: 'Kakao',
      colorScheme: { badge: 'bg-stone-200 text-stone-900 border-stone-400', iconBg: 'bg-stone-200 text-stone-800', iconText: 'text-stone-800' },
    },
    P6: {
      name: 'Heiße Milch',
      subtitle: 'Cremig aufgeschäumte Heißmilch mit Kaffeetupfer',
      category: 'Milchspezialitäten',
      aromaTag: 'Zart',
      colorScheme: { badge: 'bg-yellow-100 text-yellow-900 border-yellow-300', iconBg: 'bg-yellow-100 text-yellow-800', iconText: 'text-yellow-800' },
    },
    P7: {
      name: 'Heiße Schokolade',
      subtitle: 'Dunkler Premium-Kakao, samtig und dickflüssig',
      category: 'Tee & Kakao',
      aromaTag: 'Süß',
      colorScheme: { badge: 'bg-rose-100 text-rose-900 border-rose-300', iconBg: 'bg-rose-100 text-rose-800', iconText: 'text-rose-800' },
    },
    P8: {
      name: 'Zitronentee',
      subtitle: 'Aromatischer Heißtee mit frischer Zitronennote',
      category: 'Tee & Kakao',
      aromaTag: 'Erfrischend',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P9: {
      name: 'Kaffee Americano',
      subtitle: 'Große Tasse für den ausgiebigen Kaffeegenuss',
      category: 'Klassiker',
      aromaTag: 'Harmonisch',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P10: {
      name: 'Ginseng Kaffee',
      subtitle: 'Süßes, vitalisierendes Heißgetränk mit Ginseng',
      category: 'Vital & Wohlbefinden',
      aromaTag: 'Energie',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    },
    P11: {
      name: 'Gerstenkaffee',
      subtitle: 'Naturreines Malzgetreide, vollkommen koffeinfrei',
      category: 'Vital & Wohlbefinden',
      aromaTag: 'Natürlich',
      colorScheme: { badge: 'bg-emerald-100 text-emerald-900 border-emerald-300', iconBg: 'bg-emerald-100 text-emerald-800', iconText: 'text-emerald-800' },
    },
    P12: {
      name: 'Heißes Teewasser',
      subtitle: 'Frisch gekochtes Wasser für Ihren Teebeutel',
      category: 'Tee & Kakao',
      aromaTag: 'Rein',
      colorScheme: { badge: 'bg-sky-100 text-sky-900 border-sky-300', iconBg: 'bg-sky-100 text-sky-800', iconText: 'text-sky-800' },
    },
  },
};

export const TouchPanelPreview: React.FC<TouchPanelPreviewProps> = ({
  onBackToDashboard,
  selectedMachine,
  machines = [],
  onSelectMachine,
  isStandaloneKiosk = false,
  onExitKiosk,
}) => {
  // Screen mode: framed 10.1" (1024x600 simulator) or True Fullscreen Kiosk
  const [isFullscreenKiosk, setIsFullscreenKiosk] = useState<boolean>(isStandaloneKiosk);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('IT');
  const [copiedKioskLink, setCopiedKioskLink] = useState<boolean>(false);

  // Standalone ESP32 modules (Banco Collaudo senza macchina)
  const [standaloneDevices, setStandaloneDevices] = useState<Array<{ deviceId: string; macAddress: string; assignedMachineId?: string | null }>>([]);
  const [selectedStandaloneMac, setSelectedStandaloneMac] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/devices')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStandaloneDevices(data);
        }
      })
      .catch(() => {});
  }, []);

  // Customer Vending State
  const [isCaraffaActive, setIsCaraffaActive] = useState<boolean>(false);
  const [caraffaCountdown, setCaraffaCountdown] = useState<number>(10);
  const [dispensingItem, setDispensingItem] = useState<{
    keyDef: MatrixKeyDefinition;
    isCaraffa: boolean;
    progress: number;
    presentation: BeveragePresentation;
  } | null>(null);

  // Hidden Manager / Service PIN Modal (Clean & Discreet)
  const [isTechModalOpen, setIsTechModalOpen] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [isPinAuthenticated, setIsPinAuthenticated] = useState<boolean>(false);
  const [pinError, setPinError] = useState<boolean>(false);

  // Machine storage key for individual machine persistence
  const machineStorageKey = selectedMachine?.id ? `vending_touch_counters_${selectedMachine.id}` : 'vending_touch_counters_default';

  // Local cups counter per product (persisted per-machine)
  const [cupCounters, setCupCounters] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(machineStorageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return {
      P1: 142,
      P2: 88,
      P3: 65,
      P4: 119,
      P5: 54,
      P6: 31,
      P7: 76,
      P8: 43,
      P9: 29,
      P10: 97,
      P11: 38,
      P12: 51,
    };
  });

  // Re-load cup counters when selected machine changes
  useEffect(() => {
    const saved = localStorage.getItem(machineStorageKey);
    if (saved) {
      try {
        setCupCounters(JSON.parse(saved));
        return;
      } catch {
        // ignore
      }
    }
    // Generate fresh consistent baseline for this machine
    const fresh: Record<string, number> = {};
    MATRIX_KEYS.filter((k) => k.isProduct).forEach((k, idx) => {
      fresh[k.key] = 20 + ((idx * 11) % 45);
    });
    setCupCounters(fresh);
  }, [machineStorageKey]);

  // Resolve presentation (custom product names per-machine)
  const getBeveragePresentation = (keyDef: MatrixKeyDefinition): BeveragePresentation => {
    const base = BEVERAGE_DETAILS[currentLang]?.[keyDef.key] || {
      name: keyDef.defaultProduct,
      subtitle: 'Bevanda selezionata preparata al momento',
      category: 'Caffetteria',
      aromaTag: 'Classico',
      colorScheme: { badge: 'bg-amber-100 text-amber-900 border-amber-300', iconBg: 'bg-amber-100 text-amber-800', iconText: 'text-amber-800' },
    };

    // Check if current machine has custom calibrated product name
    const customMachineName = selectedMachine?.keyMapping?.[keyDef.key] ||
      selectedMachine?.calibration?.standardProducts?.find((p) => p.key === keyDef.key)?.name;

    if (customMachineName && currentLang === 'IT') {
      return {
        ...base,
        name: customMachineName,
      };
    }
    return base;
  };

  const handleCopyKioskLink = () => {
    const url = `${window.location.origin}/?kiosk=${encodeURIComponent(selectedMachine?.id || '')}`;
    navigator.clipboard?.writeText(url);
    setCopiedKioskLink(true);
    setTimeout(() => setCopiedKioskLink(false), 2500);
  };

  // Opto test state for technician
  const [activeOptoTest, setActiveOptoTest] = useState<string | null>(null);

  // Live time for the kiosk header
  const [currentTime, setCurrentTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  });

  const caraffaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Play pleasant acoustic chime on touch
  const playBeep = (freq = 780, duration = 0.08, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio context might be restricted
    }
  };

  // Caraffa countdown logic (10 seconds timeout)
  useEffect(() => {
    if (isCaraffaActive) {
      setCaraffaCountdown(10);
      caraffaTimerRef.current = setInterval(() => {
        setCaraffaCountdown((prev) => {
          if (prev <= 1) {
            setIsCaraffaActive(false);
            if (caraffaTimerRef.current) clearInterval(caraffaTimerRef.current);
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (caraffaTimerRef.current) {
        clearInterval(caraffaTimerRef.current);
      }
    }
    return () => {
      if (caraffaTimerRef.current) clearInterval(caraffaTimerRef.current);
    };
  }, [isCaraffaActive]);

  // Handle Beverage Selection
  const handleSelectBeverage = (keyDef: MatrixKeyDefinition) => {
    if (dispensingItem) return; // Busy
    playBeep(880, 0.1);

    const isCaraffa = isCaraffaActive;
    if (isCaraffaActive) {
      setIsCaraffaActive(false);
    }

    const presentation = getBeveragePresentation(keyDef);

    // Update cup counter
    setCupCounters((prev) => {
      const updated = {
        ...prev,
        [keyDef.key]: (prev[keyDef.key] || 0) + (isCaraffa ? 4 : 1),
      };
      localStorage.setItem(machineStorageKey, JSON.stringify(updated));
      return updated;
    });

    // Start Dispense Animation (Customer Experience)
    setDispensingItem({
      keyDef,
      isCaraffa,
      progress: 0,
      presentation,
    });

    // Real hardware dispense trigger via REST & MQTT
    try {
      const targetDevId = selectedStandaloneMac
        ? `virtual_dev_${selectedStandaloneMac}`
        : (selectedMachine?.id || '');

      if (targetDevId) {
        fetch('/api/dispense', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: keyDef.key,
            productNumber: keyDef.productNum || (keyDef.isProduct ? parseInt(keyDef.key, 10) : undefined),
            deviceId: targetDevId,
            machineId: selectedStandaloneMac ? undefined : selectedMachine?.id,
            durationMs: selectedMachine?.config?.optoTriggerDurationMs || 400,
            isCaraffa,
            source: 'TOUCH_PANEL_CUSTOMER',
          }),
        }).then((res) => {
          if (!res.ok) {
            res.json().then((errData) => {
              console.warn('[TOUCH PANEL] Avviso risposta erogazione API:', errData);
            }).catch(() => {});
          } else {
            console.log(`[TOUCH PANEL] Erogazione bevanda ${keyDef.label} (${keyDef.key}) inviata con successo all'hardware`);
          }
        }).catch((err) => {
          console.error('[TOUCH PANEL] Errore di rete erogazione:', err);
        });
      }
    } catch {
      // ignore
    }

    const dispenseDuration = isCaraffa ? 5200 : 3400;
    const stepInterval = 40;
    const totalSteps = dispenseDuration / stepInterval;
    let currentStep = 0;

    const progressTimer = setInterval(() => {
      currentStep++;
      const currentProgress = Math.min(100, Math.round((currentStep / totalSteps) * 100));

      setDispensingItem((prev) => (prev ? { ...prev, progress: currentProgress } : null));

      if (currentStep >= totalSteps) {
        clearInterval(progressTimer);
        playBeep(1046, 0.2); // Warm completion chime
        setTimeout(() => {
          setDispensingItem(null);
        }, 600);
      }
    }, stepInterval);
  };

  // Special Keys (Caraffa, Annulla, Lingua) with physical MQTT dispatch
  const handleSpecialKey = (code: string) => {
    const targetDevId = selectedStandaloneMac
      ? `virtual_dev_${selectedStandaloneMac}`
      : (selectedMachine?.id || '');

    if (!targetDevId) return;

    if (code === 'CARAFFA') {
      playBeep(isCaraffaActive ? 520 : 740, 0.1);
      setIsCaraffaActive(!isCaraffaActive);
      fetch('/api/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'CARAFFA',
          deviceId: targetDevId,
          machineId: selectedStandaloneMac ? undefined : selectedMachine?.id,
        }),
      }).catch(() => {});
    } else if (code === 'STOP') {
      playBeep(440, 0.12);
      setIsCaraffaActive(false);
      if (dispensingItem) {
        setDispensingItem(null);
      }
      fetch('/api/dispense/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: targetDevId,
          machineId: selectedStandaloneMac ? undefined : selectedMachine?.id,
          reason: 'Tasto STOP premuto su Touch Panel',
        }),
      }).catch(() => {});
    } else if (code === 'LINGUA') {
      playBeep(784, 0.08);
      const langs: SupportedLanguage[] = ['IT', 'EN', 'ES', 'DE'];
      const nextIdx = (langs.indexOf(currentLang) + 1) % langs.length;
      setCurrentLang(langs[nextIdx]);
      fetch('/api/dispense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'LINGUA',
          deviceId: targetDevId,
          machineId: selectedStandaloneMac ? undefined : selectedMachine?.id,
        }),
      }).catch(() => {});
    }
  };

  // Manager PIN handler
  const handlePinDigit = (digit: string) => {
    playBeep(620, 0.05);
    setPinError(false);
    if (enteredPin.length < 4) {
      const newPin = enteredPin + digit;
      setEnteredPin(newPin);
      if (newPin.length === 4) {
        if (newPin === '1234') {
          playBeep(980, 0.16);
          setIsPinAuthenticated(true);
        } else {
          playBeep(260, 0.25);
          setPinError(true);
          setTimeout(() => {
            setEnteredPin('');
            setPinError(false);
          }, 800);
        }
      }
    }
  };

  // Opto test
  const handleTestOpto = (optoName: string) => {
    playBeep(880, 0.1);
    setActiveOptoTest(optoName);
    setTimeout(() => {
      setActiveOptoTest(null);
    }, 500);
  };

  // Products from matrix keys (P1 to P12)
  const beverageKeys = MATRIX_KEYS.filter((k) => k.isProduct);

  // Total counter
  const totalCupsServed = (Object.values(cupCounters) as number[]).reduce((a: number, b: number) => a + b, 0);

  // Warm, polite greetings
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (currentLang === 'EN') {
      if (hour < 12) return 'Good Morning';
      if (hour < 18) return 'Good Afternoon';
      return 'Good Evening';
    }
    if (currentLang === 'ES') {
      if (hour < 13) return 'Buenos Días';
      if (hour < 20) return 'Buenas Tardes';
      return 'Buenas Noches';
    }
    if (currentLang === 'DE') {
      if (hour < 11) return 'Guten Morgen';
      if (hour < 18) return 'Guten Tag';
      return 'Guten Abend';
    }
    if (hour < 12) return 'Buongiorno';
    if (hour < 18) return 'Buon Pomeriggio';
    return 'Buonasera';
  };

  return (
    <div className="w-full flex flex-col items-center justify-start min-h-[calc(100vh-140px)] animate-fadeIn pb-12">
      {/* Top Banner: Luminous, Clean Simulator Controls & Machine Switcher */}
      {!isStandaloneKiosk && (
        <div className="w-full max-w-5xl mb-4 bg-white/95 dark:bg-white border border-amber-200/80 rounded-2xl p-3.5 shadow-md shadow-amber-900/5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-stone-800">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-300/80 flex items-center justify-center text-amber-800 shadow-xs shrink-0 mt-0.5">
              <Tablet className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-stone-900 text-sm">
                  Display Touch 10.1&quot; &bull; Pagina Singola Macchina / Modulo
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  selectedStandaloneMac
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  {selectedStandaloneMac
                    ? `🧪 Banco Prova: Modulo [${selectedStandaloneMac}]`
                    : selectedMachine
                      ? `Macchina: ${selectedMachine.name}`
                      : 'Nessuna macchina'}
                </span>
              </div>
              
              {/* Machine & Standalone Module Selector Dropdown */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs font-semibold text-stone-600">Dispositivo Target:</span>
                <select
                  value={selectedStandaloneMac ? `device:${selectedStandaloneMac}` : (selectedMachine?.id || '')}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.startsWith('device:')) {
                      setSelectedStandaloneMac(val.replace('device:', ''));
                    } else {
                      setSelectedStandaloneMac(null);
                      onSelectMachine?.(val);
                    }
                  }}
                  className="text-xs font-bold bg-amber-50/60 border border-amber-300 rounded-lg px-2.5 py-1 text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {machines && machines.length > 0 && (
                    <optgroup label="Distributori Automatici">
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.model || 'Distributore'}) &bull; {m.location || 'Sede non specificata'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {standaloneDevices && standaloneDevices.length > 0 && (
                    <optgroup label="🧪 Moduli ESP32 Standalone (Banco Collaudo)">
                      {standaloneDevices.map((d) => (
                        <option key={d.macAddress} value={`device:${d.macAddress}`}>
                          [BANCO PROVA] {d.deviceId} (MAC: {d.macAddress}) {d.assignedMachineId ? `[Abbinato a ${d.assignedMachineId}]` : '[STANDALONE / LIBERO]'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Copy Kiosk URL for this specific machine */}
            <button
              type="button"
              onClick={handleCopyKioskLink}
              title="Copia l'URL univoco da inserire nel Panel PC di questo distributore"
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
            >
              {copiedKioskLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-emerald-700" />}
              <span>{copiedKioskLink ? 'URL Kiosk Copiato!' : 'Copia Link Panel PC'}</span>
            </button>

            {/* Open dedicated machine Kiosk in new tab */}
            <a
              href={`/?kiosk=${encodeURIComponent(selectedMachine?.id || '')}`}
              target="_blank"
              rel="noreferrer"
              title="Apri a tutto schermo la pagina dedicata per questo Panel PC in una nuova scheda"
              className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 transition-colors shadow-2xs cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-stone-600" />
              <span>Apri Pagina Kiosk</span>
            </a>

            {/* Audio toggle */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playBeep(700, 0.05);
              }}
              title={soundEnabled ? 'Disattiva Audio Tocco' : 'Attiva Audio Tocco'}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border cursor-pointer transition-colors ${
                soundEnabled
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-300 hover:bg-stone-200'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-800" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">Audio {soundEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Fullscreen Kiosk toggle */}
            <button
              type="button"
              onClick={() => setIsFullscreenKiosk(!isFullscreenKiosk)}
              className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white shadow-sm cursor-pointer transition-all border border-amber-800"
            >
              {isFullscreenKiosk ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreenKiosk ? 'Riduci' : 'Kiosk Fullscreen'}</span>
            </button>

            {/* Back to Dashboard */}
            {onBackToDashboard && !isFullscreenKiosk && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-3 py-2 rounded-xl text-xs font-semibold bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 cursor-pointer transition-colors"
              >
                Torna al Gestionale
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10.1" TOUCH SCREEN CANVAS - TEMA CHIARO (1024 x 600 px Native) */}
      {/* ========================================================================= */}
      <div
        className={`transition-all duration-300 ${
          isFullscreenKiosk
            ? 'fixed inset-0 z-50 bg-[#F5F2EB] flex items-center justify-center'
            : 'relative p-3.5 rounded-[34px] bg-gradient-to-b from-stone-200 via-stone-300 to-stone-400 border-4 border-stone-300 shadow-2xl max-w-full'
        }`}
      >
        {/* Physical Brushed Frame Inset Badge */}
        {!isFullscreenKiosk && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 rounded-full bg-white border border-stone-300 text-[10px] font-semibold tracking-wide text-stone-700 shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            PANNELLO TOUCH 10.1&quot; &bull; ESPERIENZA CAFFETTERIA
          </div>
        )}

        {/* Exit fullscreen button when in kiosk mode */}
        {isFullscreenKiosk && (
          <button
            type="button"
            onClick={() => setIsFullscreenKiosk(false)}
            className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-stone-800 border border-stone-300 text-xs font-semibold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
          >
            <Minimize2 className="w-4 h-4 text-stone-600" />
            <span>Esci da Schermo Intero</span>
          </button>
        )}

        {/* ===================================================================== */}
        {/* THE 1024x600 TOUCH PANEL (LUMINOUS LIGHT PORCELAIN CAFE THEME) */}
        {/* ===================================================================== */}
        <div
          id="dwin-touch-panel-screen"
          style={{ width: '1024px', height: '600px' }}
          className="relative overflow-hidden rounded-[26px] bg-[#FAF8F5] text-stone-900 select-none shadow-xl flex flex-col font-sans border border-amber-100"
        >
          {/* Subtle soft ambient warm glows */}
          <div className="absolute top-0 right-1/4 w-[360px] h-[180px] bg-amber-200/25 rounded-full blur-[80px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-1/4 w-[360px] h-[180px] bg-orange-200/20 rounded-full blur-[90px] pointer-events-none"></div>

          {/* 1. TOP HEADER (Bright, Welcoming, Pure Hospitality) */}
          <header className="h-16 px-6 border-b border-amber-200/60 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0 relative z-20">
            {/* Friendly Greeting and Discreet Café Logo */}
            <div className="flex items-center gap-3">
              {/* Discreet Café Cup Button (Tapping opens PIN service) */}
              <button
                type="button"
                onClick={() => {
                  playBeep(650, 0.08);
                  setIsTechModalOpen(true);
                  setEnteredPin('');
                  setIsPinAuthenticated(false);
                }}
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-700 text-white flex items-center justify-center shadow-sm cursor-pointer active:scale-95 transition-transform"
                title="Area Riservata Gestore"
              >
                <Coffee className="w-5 h-5 text-amber-50" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-stone-900 text-base tracking-tight">
                    {getGreeting()}!
                  </span>
                  <span className="text-xs text-amber-800 font-semibold flex items-center gap-1 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    Scegli la tua bevanda preferita
                  </span>
                </div>
                <div className="text-xs text-stone-600 font-medium flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-stone-900">{selectedMachine ? selectedMachine.name : 'Coffee Bar Lounge'}</span>
                  <span>&bull;</span>
                  <span>{selectedMachine?.location ? `${selectedMachine.location} (${selectedMachine.model || 'Distributore'})` : 'Miscele 100% naturali'}</span>
                </div>
              </div>
            </div>

            {/* Center Status: Clean & Reassuring */}
            <div className="flex items-center gap-3">
              {isCaraffaActive ? (
                <div className="px-4 py-1.5 rounded-full bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-md shadow-amber-500/25 animate-pulse">
                  <Wine className="w-4 h-4" />
                  <span>MODALITÀ CARAFFA ATTIVA ({caraffaCountdown}s) &bull; SELEZIONA ORA</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-xs text-stone-700 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Pronta all&apos;erogazione &bull; Tocca una selezione</span>
                </div>
              )}
            </div>

            {/* Right Controls: Clock & Language Pill */}
            <div className="flex items-center gap-2.5">
              {/* Clean Clock */}
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                <span>{currentTime}</span>
              </div>

              {/* Language Switcher Pill */}
              <button
                type="button"
                onClick={() => handleSpecialKey('LINGUA')}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-xs font-bold text-amber-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Cambia Lingua"
              >
                <Languages className="w-3.5 h-3.5 text-amber-700" />
                <span>{currentLang}</span>
              </button>
            </div>
          </header>

          {/* 2. MAIN 12 BEVERAGES GRID (Crisp, Elegant Light Cards) */}
          <div className="flex-1 p-3.5 grid grid-cols-4 grid-rows-3 gap-2.5 overflow-hidden relative z-10">
            {beverageKeys.map((item) => {
              const details = getBeveragePresentation(item);

              const isCaraffaHighlighted = isCaraffaActive;

              return (
                <button
                  key={item.key}
                  id={`touch-btn-${item.key}`}
                  disabled={dispensingItem !== null}
                  onClick={() => handleSelectBeverage(item)}
                  className={`group relative rounded-2xl p-3 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer overflow-hidden border ${
                    isCaraffaHighlighted
                      ? 'bg-amber-50 border-amber-400 shadow-md shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98]'
                      : 'bg-white hover:bg-amber-50/40 border-stone-200/90 hover:border-amber-300 shadow-xs hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
                  } disabled:opacity-40 disabled:pointer-events-none`}
                >
                  {/* Top line: Category and Aroma Tag */}
                  <div className="flex items-center justify-between w-full relative z-10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 group-hover:text-amber-800 transition-colors">
                      {details.category}
                    </span>

                    {isCaraffaHighlighted ? (
                      <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 flex items-center gap-1 shadow-xs">
                        <Wine className="w-2.5 h-2.5" />
                        4 TAZZE
                      </span>
                    ) : (
                      <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-full border ${details.colorScheme.badge}`}>
                        {details.aromaTag}
                      </span>
                    )}
                  </div>

                  {/* Center: Title and Description */}
                  <div className="my-auto py-1 relative z-10">
                    <h3 className="font-extrabold text-[15px] tracking-tight text-stone-900 leading-snug group-hover:text-amber-800 transition-colors line-clamp-1">
                      {details.name}
                    </h3>
                    <p className="text-[11px] text-stone-600 mt-0.5 line-clamp-1 leading-normal font-normal">
                      {details.subtitle}
                    </p>
                  </div>

                  {/* Bottom line: Icon and Clear Touch Button */}
                  <div className="flex items-center justify-between w-full pt-1.5 border-t border-stone-100 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${details.colorScheme.iconBg}`}>
                        <item.icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[11px] font-medium text-stone-500">
                        Espresso fresco
                      </span>
                    </div>

                    <span
                      className={`text-[10.5px] font-bold px-3 py-1 rounded-full transition-all ${
                        isCaraffaHighlighted
                          ? 'bg-amber-500 text-stone-950 shadow-xs'
                          : 'bg-amber-100/80 text-amber-900 group-hover:bg-amber-700 group-hover:text-white'
                      }`}
                    >
                      Scegli
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. BOTTOM BAR (Harmonious, Friendly, Reassuring) */}
          <footer className="h-16 px-6 border-t border-amber-200/60 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0 relative z-20">
            {/* CARAFFA BUTTON (Pleasant & Clear) */}
            <button
              type="button"
              id="touch-caraffa-btn"
              onClick={() => handleSpecialKey('CARAFFA')}
              className={`h-11 px-5 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer border ${
                isCaraffaActive
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/25'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
              }`}
            >
              <Wine className={`w-4 h-4 ${isCaraffaActive ? 'animate-bounce text-stone-950' : 'text-amber-700'}`} />
              <div className="text-left leading-tight">
                <div>Dose Caraffa (4 Tazze)</div>
                <div className="text-[10px] font-normal text-stone-600">
                  {isCaraffaActive ? `Tempo residuo: ${caraffaCountdown} secondi` : 'Premi prima della bevanda per formato grande'}
                </div>
              </div>
            </button>

            {/* Courteous Placement Reminder (No auto cup/stirrer drop on this dispenser) */}
            <div className="hidden md:flex items-center gap-2 text-xs text-stone-700 font-medium bg-amber-50/70 px-3.5 py-1.5 rounded-xl border border-amber-200/70 shadow-2xs">
              <Coffee className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                {currentLang === 'IT' && "Posizionare la propria tazza o caraffa sotto l'erogatore"}
                {currentLang === 'EN' && "Place your cup or carafe under the spout"}
                {currentLang === 'ES' && "Coloca tu taza o jarra debajo del dispensador"}
                {currentLang === 'DE' && "Tasse oder Kanne unter den Auslauf stellen"}
              </span>
            </div>

            {/* COURTEOUS CANCEL BUTTON */}
            <button
              type="button"
              id="touch-stop-btn"
              onClick={() => handleSpecialKey('STOP')}
              className="h-11 px-4 rounded-2xl text-xs font-semibold flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 cursor-pointer transition-colors active:scale-95"
            >
              <X className="w-4 h-4 text-stone-500" />
              <span>Annulla</span>
            </button>
          </footer>

          {/* ===================================================================== */}
          {/* OVERLAY: ELEGANT LIGHT PREPARATION SCREEN (Hospitality & Warmth) */}
          {/* ===================================================================== */}
          {dispensingItem && (
            <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center p-8 animate-fadeIn text-center text-stone-900">
              {/* Steaming Coffee Cup Icon */}
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white shadow-xl shadow-amber-600/30 mb-4 animate-pulse">
                <Coffee className="w-10 h-10 text-white" />
              </div>

              <span className="text-xs uppercase tracking-widest text-amber-800 font-bold mb-1 bg-amber-100 px-3 py-0.5 rounded-full border border-amber-300">
                {dispensingItem.isCaraffa ? 'Formato Caraffa (4 Tazze)' : 'Preparazione Artigianale'}
              </span>

              <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                {dispensingItem.presentation.name}
              </h2>

              <p className="text-sm text-stone-600 mt-1 max-w-md font-medium">
                {currentLang === 'IT' && 'Erogazione in corso nella tua tazza. Attendere il termine prima di ritirarla.'}
                {currentLang === 'EN' && 'Dispensing into your cup. Please wait for completion before removing.'}
                {currentLang === 'ES' && 'Erogación en curso en su taza. Espere el pitido final antes de retirarla.'}
                {currentLang === 'DE' && 'Zubereitung in Ihre Tasse läuft. Bitte Signalton vor der Entnahme abwarten.'}
              </p>

              {/* Luminous Warm Amber Progress Bar */}
              <div className="w-full max-w-md bg-stone-200 rounded-full h-3.5 mt-6 overflow-hidden border border-stone-300 p-0.5 shadow-inner">
                <div
                  className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 h-full rounded-full transition-all duration-75 shadow-sm"
                  style={{ width: `${dispensingItem.progress}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between w-full max-w-md mt-2 text-xs text-stone-600 font-semibold">
                <span>Erogazione in corso...</span>
                <span className="text-amber-800 font-bold">{dispensingItem.progress}%</span>
              </div>
            </div>
          )}

          {/* ===================================================================== */}
          {/* OVERLAY: CLEAN LIGHT TECHNICIAN / SERVICE MENU (Protected by PIN) */}
          {/* ===================================================================== */}
          {isTechModalOpen && (
            <div className="absolute inset-0 z-50 bg-stone-900/40 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
              <div className="w-full max-w-md bg-white border border-stone-300 rounded-2xl p-5 shadow-2xl relative text-stone-900">
                {/* Close modal */}
                <button
                  type="button"
                  onClick={() => setIsTechModalOpen(false)}
                  className="absolute top-4 right-4 text-stone-500 hover:text-stone-900 p-1 rounded-lg hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>

                {!isPinAuthenticated ? (
                  /* PIN Entry View */
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto mb-3 border border-amber-300">
                      <Key className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-stone-900">Menu Gestore &bull; Assistenza</h3>
                    <p className="text-xs text-stone-600 mt-1">
                      Inserisci il codice PIN di servizio per accedere ai contatori (Default: <strong className="text-amber-800">1234</strong>).
                    </p>

                    {/* PIN Display bullets */}
                    <div className="flex items-center justify-center gap-3 my-4">
                      {[0, 1, 2, 3].map((idx) => (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${
                            pinError
                              ? 'border-rose-500 bg-rose-200 animate-shake'
                              : enteredPin.length > idx
                              ? 'border-amber-700 bg-amber-600'
                              : 'border-stone-300 bg-stone-100'
                          }`}
                        ></div>
                      ))}
                    </div>

                    {pinError && (
                      <p className="text-xs text-rose-600 font-semibold mb-2">
                        Codice PIN errato. Riprova.
                      </p>
                    )}

                    {/* Numeric Keypad */}
                    <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                        <button
                          key={digit}
                          type="button"
                          onClick={() => handlePinDigit(digit)}
                          className="h-11 rounded-xl bg-stone-100 hover:bg-amber-100 text-stone-900 font-bold text-base border border-stone-200 active:scale-95 transition-all cursor-pointer"
                        >
                          {digit}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          playBeep(400, 0.05);
                          setEnteredPin('');
                        }}
                        className="h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium text-xs border border-stone-200 cursor-pointer"
                      >
                        CANC
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePinDigit('0')}
                        className="h-11 rounded-xl bg-stone-100 hover:bg-amber-100 text-stone-900 font-bold text-base border border-stone-200 active:scale-95 transition-all cursor-pointer"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playBeep(400, 0.05);
                          setEnteredPin(enteredPin.slice(0, -1));
                        }}
                        className="h-11 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-medium text-xs border border-stone-200 cursor-pointer"
                      >
                        &larr;
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Authenticated Technician Dashboard */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-base text-stone-900">Riepilogo Gestore &bull; {selectedMachine?.name || 'Distributore'}</h3>
                      </div>
                      <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                        Autorizzato
                      </span>
                    </div>

                    {/* Machine Profile Box */}
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-900 uppercase font-bold tracking-wider">Distributore Configurato</span>
                        <span className="text-[10px] font-mono font-bold bg-amber-200/70 text-amber-950 px-2 py-0.5 rounded">
                          ID: {selectedMachine?.id || 'N/D'}
                        </span>
                      </div>
                      <div className="text-sm font-bold text-stone-900 mt-1">{selectedMachine?.name || 'Distributore Bar Lounge'}</div>
                      <div className="text-xs text-stone-600 mt-0.5">
                        {selectedMachine?.model || 'Modello Vending'} &bull; {selectedMachine?.location || 'Postazione Standard'}
                      </div>
                      {selectedMachine?.macAddress && (
                        <div className="text-[11px] font-mono text-stone-500 mt-1">
                          Modulo ESP32: {selectedMachine.macAddress} {selectedMachine.ipAddress ? `(${selectedMachine.ipAddress})` : ''}
                        </div>
                      )}
                    </div>

                    {/* Stats & Total Cups */}
                    <div className="grid grid-cols-2 gap-2 text-left">
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="text-[10px] text-stone-500 uppercase font-bold">Erogazioni Totali Macchina</span>
                        <div className="text-lg font-black text-amber-800">{totalCupsServed} tazze</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200">
                        <span className="text-[10px] text-stone-500 uppercase font-bold">Stato Touch Panel</span>
                        <div className="text-xs font-semibold text-emerald-700 mt-0.5">Operativo &bull; In Servizio</div>
                      </div>
                    </div>

                    {/* Test Individual Optoisolators U1..U8 */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-stone-700">Verifica Funzionamento Uscite:</span>
                        {activeOptoTest && (
                          <span className="text-[10px] font-mono text-amber-800 font-bold animate-pulse">
                            {activeOptoTest} ATTIVO
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8'].map((opto) => (
                          <button
                            key={opto}
                            type="button"
                            onClick={() => handleTestOpto(opto)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                              activeOptoTest === opto
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                            }`}
                          >
                            {opto}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Cup breakdown list */}
                    <div>
                      <span className="text-xs font-bold text-stone-700 block mb-1.5">Consumi per Bevanda (questa macchina):</span>
                      <div className="max-h-32 overflow-y-auto pr-1 space-y-1 text-xs">
                        {beverageKeys.map((k) => (
                          <div
                            key={k.key}
                            className="flex items-center justify-between py-1 px-2 rounded bg-stone-50 border border-stone-200"
                          >
                            <span className="text-stone-800 font-medium">
                              {getBeveragePresentation(k).name}
                            </span>
                            <span className="font-mono font-bold text-amber-800">{cupCounters[k.key] || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Reset button & Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-stone-200 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playBeep(400, 0.1);
                          const resetObj: Record<string, number> = {};
                          beverageKeys.forEach((k) => (resetObj[k.key] = 0));
                          setCupCounters(resetObj);
                          localStorage.setItem(machineStorageKey, JSON.stringify(resetObj));
                        }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Azzera Statistiche</span>
                      </button>

                      <div className="flex items-center gap-2">
                        {onExitKiosk && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTechModalOpen(false);
                              onExitKiosk();
                            }}
                            className="px-3 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold cursor-pointer border border-stone-300"
                          >
                            Torna al Gestionale
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsTechModalOpen(false)}
                          className="px-3.5 py-1 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold cursor-pointer"
                        >
                          Chiudi
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Experience notes below the preview */}
      {!isFullscreenKiosk && (
        <div className="w-full max-w-4xl mt-6 grid grid-cols-1 md:grid-cols-3 gap-3.5 text-left text-xs">
          <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-xs text-stone-700">
            <div className="flex items-center gap-2 font-bold text-stone-900 mb-1">
              <Sun className="w-4 h-4 text-amber-700" />
              <span>Tema Chiaro &amp; Luminoso</span>
            </div>
            <p className="text-stone-600">
              Sfondo porcellana caldo, card bianche luminose con accenti ambrati e tipografia ad alto contrasto per una leggibilità immediata.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-xs text-stone-700">
            <div className="flex items-center gap-2 font-bold text-stone-900 mb-1">
              <Smile className="w-4 h-4 text-amber-700" />
              <span>Nessun Riferimento Tecnico</span>
            </div>
            <p className="text-stone-600">
              Nessun codice U1-U8, relè o sigle hardware esposte al cliente: solo nomi accattivanti, descrizioni sensoriali e categorie chiare.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white border border-amber-200/80 shadow-xs text-stone-700">
            <div className="flex items-center gap-2 font-bold text-stone-900 mb-1">
              <Wine className="w-4 h-4 text-amber-700" />
              <span>Caraffa e Annulla Intuitivi</span>
            </div>
            <p className="text-stone-600">
              I pulsanti caraffa e annulla usano un tono cordiale, con conto alla rovescia discreto che ritorna da solo alla dose singola.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
