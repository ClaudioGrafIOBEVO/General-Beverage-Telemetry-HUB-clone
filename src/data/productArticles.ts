import { ArticleItem } from '../types';

/**
 * Anagrafica Articoli e Materie Prime Ufficiali per Contenitori Vending (IoBevo / General Beverage)
 * Ogni prodotto ha un Codice Articolo univoco, descrizione commerciale, tipologia ingrediente,
 * valori standard di taratura (RPM, grammi/sec, dose nominale) e confezionamento.
 */
export const OFFICIAL_PRODUCT_ARTICLES: ArticleItem[] = [
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
  },
  {
    itemCode: 'ART-ORZ-01',
    name: 'Orzo Tostato Naturale Solubile',
    ingredientType: 'solubles',
    defaultRpm: 40,
    defaultGramsPerSecond: 1.6,
    nominalGramsPerDose: 9.0,
    costPerKg: 14.20,
    packageUnit: 'Busta 1 Kg',
    description: 'Orzo tostato 100% cereali per motore lento 40 RPM.',
  },
  {
    itemCode: 'ART-GIN-01',
    name: 'Ginseng Dolce Cremoso Solubile',
    ingredientType: 'solubles',
    defaultRpm: 40,
    defaultGramsPerSecond: 1.8,
    nominalGramsPerDose: 9.5,
    costPerKg: 16.50,
    packageUnit: 'Busta 1 Kg',
    description: 'Estratto di panax ginseng con aroma caramello e latte.',
  },
  {
    itemCode: 'ART-ZUC-01',
    name: 'Zucchero Semolato Fine Vending',
    ingredientType: 'sugar',
    defaultRpm: 120,
    defaultGramsPerSecond: 3.0,
    nominalGramsPerDose: 6.0,
    costPerKg: 1.90,
    packageUnit: 'Busta 1 Kg',
    description: 'Zucchero bianco extra-fine anti-impaccamento per dosatori a coclea.',
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
    description: 'Infuso di camomilla dolcificato con miele in polvere.',
  },
  // --- LINEA CATERING / RISTOSANO (Pasti, Omogeneizzati & Preparati) ---
  {
    itemCode: 'ART-MOU-01',
    name: 'Mousse di Frutta Liofilizzata',
    ingredientType: 'solubles',
    defaultRpm: 120,
    defaultGramsPerSecond: 3.2,
    nominalGramsPerDose: 20.0,
    costPerKg: 14.80,
    packageUnit: 'Busta 1 Kg',
    description: 'Preparato per mousse di mela e frutta mista per catering assistenziale.',
  },
  {
    itemCode: 'ART-PAS-01',
    name: 'Pasta & Tortellini Solubile Frullata',
    ingredientType: 'solubles',
    defaultRpm: 120,
    defaultGramsPerSecond: 3.0,
    nominalGramsPerDose: 25.0,
    costPerKg: 16.20,
    packageUnit: 'Busta 1 Kg',
    description: 'Primo piatto liofilizzato ad alto valore nutrizionale per dispensatore.',
  },
  {
    itemCode: 'ART-PUR-01',
    name: 'Puré di Patate & Verdure Istantaneo',
    ingredientType: 'solubles',
    defaultRpm: 120,
    defaultGramsPerSecond: 3.4,
    nominalGramsPerDose: 22.0,
    costPerKg: 11.50,
    packageUnit: 'Busta 1 Kg',
    description: 'Fiocchi di puré istantaneo a dissoluzione immediata.',
  },
  {
    itemCode: 'ART-DES-01',
    name: 'Latte Pro & Dessert Proteico',
    ingredientType: 'milk',
    defaultRpm: 200,
    defaultGramsPerSecond: 4.0,
    nominalGramsPerDose: 24.0,
    costPerKg: 19.50,
    packageUnit: 'Busta 1 Kg',
    description: 'Preparato iperproteico per colazioni e merende ospedaliere.',
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
  },
];

/**
 * Cache dinamica degli articoli caricati dal database (/api/articles).
 * Inizializzata con il catalogo ufficiale predefinito.
 */
let dynamicArticles: ArticleItem[] = [...OFFICIAL_PRODUCT_ARTICLES];

/**
 * Aggiorna la cache locale degli articoli
 */
export function setCachedArticles(articles: ArticleItem[]): void {
  if (Array.isArray(articles) && articles.length > 0) {
    dynamicArticles = [...articles];
  }
}

/**
 * Carica l'elenco aggiornato degli articoli direttamente dall'API del server.
 * In caso di errore o assenza di connessione, ricade sulla cache locale.
 */
export async function fetchArticles(): Promise<ArticleItem[]> {
  try {
    const res = await fetch('/api/articles');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.articles)) {
        dynamicArticles = data.articles;
        return data.articles;
      }
    }
  } catch (err) {
    console.warn('Impossibile recuperare articoli da /api/articles, uso cache predefinita:', err);
  }
  return dynamicArticles;
}

/**
 * Salva o aggiorna un articolo sul database tramite l'API
 */
export async function saveArticleApi(article: ArticleItem): Promise<{ success: boolean; article?: ArticleItem; error?: string }> {
  try {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(article),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchArticles(); // Aggiorna la cache locale
      return { success: true, article: data.article };
    }
    return { success: false, error: data.error || 'Errore salvataggio articolo' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore di rete' };
  }
}

/**
 * Elimina un articolo dal database
 */
export async function deleteArticleApi(itemCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/articles/${encodeURIComponent(itemCode)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchArticles();
      return { success: true };
    }
    return { success: false, error: data.error || 'Errore eliminazione articolo' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore di rete' };
  }
}

/**
 * Importa massivamente articoli da testo CSV o array di oggetti
 */
export async function importArticlesApi(
  payload: { csvText?: string; articles?: ArticleItem[]; mode?: 'merge' | 'replace' }
): Promise<{ success: boolean; importedCount?: number; totalArticles?: number; error?: string }> {
  try {
    const res = await fetch('/api/articles/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchArticles();
      return { success: true, importedCount: data.importedCount, totalArticles: data.totalArticles };
    }
    return { success: false, error: data.error || 'Errore durante l\'importazione' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore di rete' };
  }
}

/**
 * Ripristina il catalogo predefinito con i 21 articoli ufficiali
 */
export async function resetDefaultArticlesApi(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/articles/reset-defaults', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      await fetchArticles();
      return { success: true };
    }
    return { success: false, error: data.error || 'Errore durante il ripristino' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Errore di rete' };
  }
}

/**
 * Restituisce l'elenco completo degli articoli registrati (dalla cache dinamica o default)
 */
export function getAllArticles(): ArticleItem[] {
  return dynamicArticles.length > 0 ? dynamicArticles : OFFICIAL_PRODUCT_ARTICLES;
}

/**
 * Cerca un articolo per codice articolo univoco (es. 'ART-CAF-01')
 */
export function findArticleByCode(code?: string): ArticleItem | undefined {
  if (!code) return undefined;
  const clean = code.trim().toUpperCase();
  const pool = dynamicArticles.length > 0 ? dynamicArticles : OFFICIAL_PRODUCT_ARTICLES;
  return pool.find((a) => a.itemCode.toUpperCase() === clean);
}

/**
 * Cerca un articolo per corrispondenza testuale sul nome o tipologia
 */
export function findArticleByNameOrType(name?: string, type?: string): ArticleItem | undefined {
  if (!name && !type) return undefined;
  const lowerName = (name || '').toLowerCase();
  const pool = dynamicArticles.length > 0 ? dynamicArticles : OFFICIAL_PRODUCT_ARTICLES;

  // Match esatto o parziale sul nome
  const matched = pool.find((a) => {
    const aLower = a.name.toLowerCase();
    return aLower.includes(lowerName) || lowerName.includes(aLower);
  });
  if (matched) return matched;

  // Match su parole chiave comuni
  if (lowerName.includes('caff') || lowerName.includes('coffee') || type === 'coffee') {
    if (lowerName.includes('gran')) return findArticleByCode('ART-CAF-02');
    if (lowerName.includes('dec')) return findArticleByCode('ART-CAF-03');
    return findArticleByCode('ART-CAF-01');
  }
  if (lowerName.includes('latte') || lowerName.includes('milk') || type === 'milk') {
    return findArticleByCode('ART-LAT-01');
  }
  if (lowerName.includes('ciocc') || lowerName.includes('choc') || type === 'chocolate') {
    return findArticleByCode('ART-CIO-01');
  }
  if (lowerName.includes('the') || lowerName.includes('tè') || lowerName.includes('tea') || type === 'tea') {
    if (lowerName.includes('pesca')) return findArticleByCode('ART-THE-02');
    if (lowerName.includes('verd')) return findArticleByCode('ART-THE-03');
    return findArticleByCode('ART-THE-01');
  }
  if (lowerName.includes('orzo')) return findArticleByCode('ART-ORZ-01');
  if (lowerName.includes('ginseng')) return findArticleByCode('ART-GIN-01');
  if (lowerName.includes('zuccher') || lowerName.includes('sugar') || type === 'sugar') {
    return findArticleByCode('ART-ZUC-01');
  }
  if (lowerName.includes('camom') || lowerName.includes('tisana')) return findArticleByCode('ART-CAM-01');
  if (lowerName.includes('mouss')) return findArticleByCode('ART-MOU-01');
  if (lowerName.includes('pasta') || lowerName.includes('tortellin')) return findArticleByCode('ART-PAS-01');
  if (lowerName.includes('puré') || lowerName.includes('pure') || lowerName.includes('patat')) return findArticleByCode('ART-PUR-01');
  if (lowerName.includes('dessert') || lowerName.includes('proteic')) return findArticleByCode('ART-DES-01');
  if (lowerName.includes('omogene') || lowerName.includes('carne') || lowerName.includes('pesce')) return findArticleByCode('ART-OMO-01');
  if (lowerName.includes('frittat') || lowerName.includes('uov')) return findArticleByCode('ART-FRI-01');
  if (lowerName.includes('brod')) return findArticleByCode('ART-BRO-01');

  return undefined;
}
