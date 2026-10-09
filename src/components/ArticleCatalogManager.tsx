import React, { useState, useEffect, useMemo } from 'react';
import {
  Package,
  Plus,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Coffee,
  Milk,
  Flame,
  Droplets,
  Layers,
  Sparkles,
  Info,
  X,
  Copy,
  Check
} from 'lucide-react';
import { ArticleItem } from '../types';
import {
  getAllArticles,
  fetchArticles,
  saveArticleApi,
  deleteArticleApi,
  importArticlesApi,
  resetDefaultArticlesApi
} from '../data/productArticles';
import { useTheme } from '../context/ThemeContext';

export const ArticleCatalogManager: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modal edit / create state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editForm, setEditForm] = useState<ArticleItem>({
    itemCode: '',
    name: '',
    ingredientType: 'solubles',
    defaultRpm: 120,
    defaultGramsPerSecond: 2.5,
    nominalGramsPerDose: 8.0,
    costPerKg: 0.0,
    packageUnit: 'Busta 1 Kg',
    description: '',
    supplier: 'General Beverage / IoBevo',
  });
  const [savingArticle, setSavingArticle] = useState(false);

  // Modal import state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load articles
  const loadData = async () => {
    setLoading(true);
    try {
      const list = await fetchArticles();
      setArticles(list);
    } catch {
      setArticles(getAllArticles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showNotification = (type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Filtered articles list
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchCat = categoryFilter === 'all' || art.ingredientType === categoryFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        art.itemCode.toLowerCase().includes(q) ||
        art.name.toLowerCase().includes(q) ||
        (art.description && art.description.toLowerCase().includes(q)) ||
        (art.supplier && art.supplier.toLowerCase().includes(q)) ||
        (art.packageUnit && art.packageUnit.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [articles, categoryFilter, search]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Open modal for new article
  const handleOpenNewModal = () => {
    setIsEditingExisting(false);
    setEditForm({
      itemCode: `ART-${Date.now().toString().slice(-4)}`,
      name: '',
      ingredientType: 'coffee',
      defaultRpm: 120,
      defaultGramsPerSecond: 2.8,
      nominalGramsPerDose: 7.5,
      costPerKg: 15.0,
      packageUnit: 'Busta 1 Kg',
      description: '',
      supplier: 'Nostro Fornitore',
    });
    setIsEditModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEditModal = (art: ArticleItem) => {
    setIsEditingExisting(true);
    setEditForm({ ...art });
    setIsEditModalOpen(true);
  };

  // Submit article
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.itemCode.trim()) {
      showNotification('error', 'Il codice articolo è obbligatorio!');
      return;
    }
    if (!editForm.name.trim()) {
      showNotification('error', 'Il nome del prodotto è obbligatorio!');
      return;
    }

    setSavingArticle(true);
    const res = await saveArticleApi({
      ...editForm,
      itemCode: editForm.itemCode.trim().toUpperCase(),
      name: editForm.name.trim(),
    });
    setSavingArticle(false);

    if (res.success) {
      showNotification('success', `Articolo "${editForm.name}" salvato nel database!`);
      setIsEditModalOpen(false);
      loadData();
    } else {
      showNotification('error', res.error || 'Errore salvataggio articolo');
    }
  };

  // Delete article
  const handleDeleteArticle = async (art: ArticleItem) => {
    if (!window.confirm(`Sei sicuro di voler eliminare l'articolo "${art.name}" [${art.itemCode}] dal catalogo?`)) {
      return;
    }
    const res = await deleteArticleApi(art.itemCode);
    if (res.success) {
      showNotification('success', `Articolo "${art.itemCode}" rimosso con successo.`);
      loadData();
    } else {
      showNotification('error', res.error || 'Errore eliminazione articolo');
    }
  };

  // Reset to default 21 products
  const handleResetDefaults = async () => {
    if (
      !window.confirm(
        'Vuoi ripristinare il catalogo articoli ai 21 prodotti predefiniti di fabbrica (General Beverage / IoBevo)? Gli articoli aggiunti verranno sovrascritti.'
      )
    ) {
      return;
    }
    const res = await resetDefaultArticlesApi();
    if (res.success) {
      showNotification('success', 'Catalogo ripristinato con successo con i prodotti predefiniti.');
      loadData();
    } else {
      showNotification('error', res.error || 'Errore durante il ripristino');
    }
  };

  // Import handler
  const handleExecuteImport = async () => {
    if (!importText.trim()) {
      showNotification('error', 'Incolla del testo CSV o seleziona un file valido da importare.');
      return;
    }
    setImporting(true);
    const res = await importArticlesApi({
      csvText: importText,
      mode: importMode,
    });
    setImporting(false);

    if (res.success) {
      showNotification('success', `Importazione completata con successo! ${res.importedCount} articoli processati.`);
      setIsImportModalOpen(false);
      setImportText('');
      loadData();
    } else {
      showNotification('error', res.error || 'Errore durante l\'importazione dei dati');
    }
  };

  // File upload input change
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  // Helper icon for ingredient type
  const getCategoryBadge = (type: string) => {
    switch (type) {
      case 'coffee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Caffè
          </span>
        );
      case 'milk':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <Milk className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Latte
          </span>
        );
      case 'chocolate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
            <Flame className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            Cioccolato
          </span>
        );
      case 'tea':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <Droplets className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Tè / Infusi
          </span>
        );
      case 'sugar':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            Zucchero
          </span>
        );
      case 'syrup':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
            <Droplets className="w-3.5 h-3.5 text-purple-500" />
            Sciroppo
          </span>
        );
      case 'solubles':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Solubile / Pasti
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner notifiche */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
            notification.type === 'success'
              ? isLight
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs'
                : 'bg-emerald-950/50 text-emerald-200 border-emerald-800'
              : notification.type === 'error'
              ? isLight
                ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-xs'
                : 'bg-rose-950/50 text-rose-200 border-rose-800'
              : isLight
              ? 'bg-blue-50 text-blue-900 border-blue-300 shadow-xs'
              : 'bg-blue-950/50 text-blue-200 border-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            )}
            <span className="font-semibold">{notification.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Guide Banner */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          isLight
            ? 'bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 border-emerald-200/80 shadow-xs'
            : 'bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-800/30 shadow-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl border ${
                isLight
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-md shadow-emerald-600/20'
                  : 'bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30'
              }`}
            >
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Anagrafica Articoli &amp; Materie Prime Distributori
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {articles.length} Articoli a Database
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Qui puoi popolare il database con i tuoi prodotti aziendali (caffè, latte, cioccolato, the, preparati catering/ristosano). 
                I prodotti inseriti qui saranno immediatamente selezionabili nella <strong>Taratura Contenitori</strong> e nell'<strong>Area Ordini Clienti</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              id="btn-add-new-article"
              onClick={handleOpenNewModal}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nuovo Articolo
            </button>

            <button
              type="button"
              id="btn-open-import-modal"
              onClick={() => setIsImportModalOpen(true)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-2xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
            >
              <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Importa CSV / Excel
            </button>

            <a
              id="btn-download-articles-template"
              href="/api/articles/template-csv"
              download="template_catalogo_prodotti.csv"
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-2xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
              title="Scarica file Excel/CSV di esempio pronto da compilare"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Scarica Template CSV
            </a>

            <a
              id="btn-export-articles-csv"
              href="/api/articles/export"
              download="catalogo_articoli_export.csv"
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border cursor-pointer transition-all ${
                isLight
                  ? 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300 shadow-2xs'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
              }`}
              title="Esporta catalogo articoli attuale in formato CSV"
            >
              <Download className="w-4 h-4 text-indigo-500" />
              Esporta (.csv)
            </a>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isLight ? 'bg-white border-slate-300 shadow-2xs' : 'bg-slate-900/80 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              id="input-search-articles"
              placeholder="Cerca per codice (es. ART-CAF-01), nome, note o fornitore..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 pr-3.5 py-2 rounded-xl text-xs border transition-all outline-hidden ${
                isLight
                  ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-white focus:bg-slate-900 focus:border-emerald-500'
              }`}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Tutti' },
              { id: 'coffee', label: 'Caffè' },
              { id: 'milk', label: 'Latte' },
              { id: 'chocolate', label: 'Cioccolato' },
              { id: 'tea', label: 'Tè/Infusi' },
              { id: 'solubles', label: 'Solubili/Pasti' },
              { id: 'sugar', label: 'Zucchero' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isLight
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className={`p-2 rounded-xl border text-xs cursor-pointer transition-all ${
              isLight ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
            title="Ricarica elenco articoli dal server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-300 dark:border-rose-900/50 cursor-pointer transition-all`}
            title="Ripristina articoli di fabbrica predefiniti"
          >
            Ripristina Predefiniti
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div
        className={`rounded-2xl border overflow-hidden transition-all ${
          isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-900/80 border-slate-800 shadow-xl'
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className={`border-b ${isLight ? 'bg-slate-50/80 border-slate-300 text-slate-700' : 'bg-slate-800/60 border-slate-800 text-slate-400'}`}>
                <th className="py-3.5 px-4 font-bold">Codice Articolo</th>
                <th className="py-3.5 px-4 font-bold">Descrizione &amp; Nome Prodotto</th>
                <th className="py-3.5 px-4 font-bold">Categoria</th>
                <th className="py-3.5 px-4 font-bold">Formato Confezione</th>
                <th className="py-3.5 px-4 font-bold text-right">Costo / Kg</th>
                <th className="py-3.5 px-4 font-bold text-right">Dose Nominale</th>
                <th className="py-3.5 px-4 font-bold text-center">Dosatore (RPM &bull; g/s)</th>
                <th className="py-3.5 px-4 font-bold">Fornitore</th>
                <th className="py-3.5 px-4 font-bold text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full w-12 h-12 flex items-center justify-center mx-auto text-slate-400">
                        <Package className="w-6 h-6" />
                      </div>
                      <h4 className={`text-sm font-bold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        Nessun articolo trovato
                      </h4>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {search
                          ? `Nessun risultato per "${search}". Prova a modificare i filtri di ricerca.`
                          : 'Il catalogo è attualmente vuoto. Fai clic su "Nuovo Articolo" o "Importa CSV / Excel" per iniziare.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenNewModal}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-xs"
                      >
                        + Aggiungi il primo articolo
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredArticles.map((art) => (
                  <tr
                    key={art.itemCode}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Codice Articolo */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] border ${
                          isLight
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-slate-800 text-slate-200 border-slate-700'
                        }`}>
                          {art.itemCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(art.itemCode)}
                          className="p-1 text-slate-400 hover:text-emerald-500 transition-colors"
                          title="Copia codice articolo negli appunti"
                        >
                          {copiedCode === art.itemCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Nome Prodotto & Descrizione */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {art.name}
                      </div>
                      {art.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {art.description}
                        </div>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="py-3 px-4">
                      {getCategoryBadge(art.ingredientType)}
                    </td>

                    {/* Formato Confezione */}
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {art.packageUnit || 'Busta 1 Kg'}
                    </td>

                    {/* Costo al Kg */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      € {art.costPerKg ? art.costPerKg.toFixed(2) : '0.00'}
                    </td>

                    {/* Dose Nominale */}
                    <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {art.nominalGramsPerDose ? art.nominalGramsPerDose.toFixed(1) : '8.0'} g
                    </td>

                    {/* Dosatore RPM & g/s */}
                    <td className="py-3 px-4 text-center font-mono text-[11px]">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {art.defaultRpm || 120} RPM
                      </span>
                      <span className="text-slate-400 mx-1">&bull;</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {art.defaultGramsPerSecond ? art.defaultGramsPerSecond.toFixed(1) : '2.5'} g/s
                      </span>
                    </td>

                    {/* Fornitore */}
                    <td className="py-3 px-4 text-[11px] text-slate-600 dark:text-slate-400">
                      {art.supplier || 'General Beverage'}
                    </td>

                    {/* Azioni */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(art)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          title="Modifica articolo"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(art)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Elimina articolo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info bar */}
        <div className={`p-3 border-t text-xs flex flex-col sm:flex-row items-center justify-between gap-2 ${
          isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-slate-900 border-slate-800 text-slate-400'
        }`}>
          <div>
            Visualizzati <span className="font-bold text-slate-900 dark:text-white">{filteredArticles.length}</span> di <span className="font-bold text-slate-900 dark:text-white">{articles.length}</span> articoli totali registrati.
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
            <span>I codici articolo sono univoci e vengono usati per il collegamento con i contenitori della macchina.</span>
          </div>
        </div>
      </div>

      {/* MODAL: NUOVO / MODIFICA ARTICOLO */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {isEditingExisting ? `Modifica Articolo [${editForm.itemCode}]` : 'Aggiungi Nuovo Articolo a Catalogo'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compila i dettagli del prodotto per renderlo disponibile nelle tarature e negli ordini.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Codice Articolo */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Codice Articolo Univoco <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditingExisting}
                    placeholder="es. ART-CAF-01, MIO-LATTE-01"
                    value={editForm.itemCode}
                    onChange={(e) => setEditForm({ ...editForm, itemCode: e.target.value.toUpperCase() })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    {isEditingExisting ? 'Il codice univoco non può essere modificato.' : 'Identificativo univoco usato per associare i contenitori.'}
                  </span>
                </div>

                {/* Categoria Ingrediente */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Categoria Ingrediente <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={editForm.ingredientType}
                    onChange={(e) => setEditForm({ ...editForm, ingredientType: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  >
                    <option value="coffee">☕ Caffè (in grani o solubile)</option>
                    <option value="milk">🥛 Latte (scremato o intero)</option>
                    <option value="chocolate">🍫 Cioccolato solubile</option>
                    <option value="tea">🍵 Tè &amp; Tisane</option>
                    <option value="solubles">🥄 Solubili Generali &amp; Pasti (Ristosano)</option>
                    <option value="sugar">🧂 Zucchero</option>
                    <option value="syrup">🍯 Sciroppo</option>
                    <option value="cups">🥤 Bicchieri &amp; Palette</option>
                    <option value="water">💧 Acqua</option>
                    <option value="other">Altro ingrediente</option>
                  </select>
                </div>
              </div>

              {/* Nome Prodotto */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome Commerciale Prodotto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="es. Caffè Espresso Crema Bar 100% Arabica"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Confezionamento */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Confezione
                  </label>
                  <input
                    type="text"
                    placeholder="es. Busta 1 Kg, Sacco 5 Kg"
                    value={editForm.packageUnit || ''}
                    onChange={(e) => setEditForm({ ...editForm, packageUnit: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* Costo al Kg */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Costo (€ / Kg)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="es. 16.50"
                    value={editForm.costPerKg ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, costPerKg: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* Dose Nominale (g) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dose Nominale (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="es. 7.5"
                    value={editForm.nominalGramsPerDose ?? 8.0}
                    onChange={(e) => setEditForm({ ...editForm, nominalGramsPerDose: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-mono border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Parametri Dosaggio Macchina */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-indigo-50/50 border-indigo-200' : 'bg-indigo-950/20 border-indigo-900/40'
              }`}>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300">
                    Parametri Predefiniti Motore Dosatore (Per Taratura Contenitori)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Velocità Motore (RPM Giri/min)
                    </label>
                    <select
                      value={editForm.defaultRpm || 120}
                      onChange={(e) => {
                        const rpm = parseInt(e.target.value, 10) as 40 | 120 | 200;
                        let defaultGsec = 2.5;
                        if (rpm === 40) defaultGsec = 1.8;
                        if (rpm === 200) defaultGsec = 4.2;
                        setEditForm({ ...editForm, defaultRpm: rpm, defaultGramsPerSecond: defaultGsec });
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs border font-mono ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                      }`}
                    >
                      <option value="40">40 RPM (Lento &bull; Zucchero, Brodi, Sciroppi)</option>
                      <option value="120">120 RPM (Standard &bull; Caffè, Latte, The, Orzo)</option>
                      <option value="200">200 RPM (Veloce &bull; Cioccolato denso, Pappe ad alta densità)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Portata Stimata (Grammi / Secondo)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="es. 2.8"
                      value={editForm.defaultGramsPerSecond ?? 2.5}
                      onChange={(e) => setEditForm({ ...editForm, defaultGramsPerSecond: parseFloat(e.target.value) || 2.5 })}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-mono border ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-800 border-slate-700 text-white'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Fornitore & Note */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Fornitore / Marchio
                  </label>
                  <input
                    type="text"
                    placeholder="es. General Beverage, Lavazza, Nestlé"
                    value={editForm.supplier || ''}
                    onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Note / Descrizione Aggiuntiva
                  </label>
                  <input
                    type="text"
                    placeholder="es. Ad alta solubilità, conservare in luogo fresco"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl text-xs border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                        : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={savingArticle}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2"
                >
                  {savingArticle ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Salva Articolo nel DB
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORTA CSV / EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden transition-all ${
              isLight ? 'bg-white border-slate-300' : 'bg-slate-900 border-slate-800 text-white'
            }`}
          >
            <div className={`px-6 py-4 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/60 border-slate-800'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    Importa Catalogo Prodotti (CSV / Excel / Testo)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Carica un file CSV esportato dal tuo gestionale oppure incolla direttamente le righe da Excel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Option Mode */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Modalità di importazione:
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="accent-emerald-600"
                    />
                    <span>Unisci / Aggiorna esistenti (Consigliato)</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer font-medium text-rose-600 dark:text-rose-400 ml-3">
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="accent-rose-600"
                    />
                    <span>Sostituisci intero catalogo</span>
                  </label>
                </div>
              </div>

              {/* File upload box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. Carica File CSV
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileUpload}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  <a
                    href="/api/articles/template-csv"
                    download="template_catalogo_prodotti.csv"
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Scarica Template CSV
                  </a>
                </div>
              </div>

              {/* Paste Text Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  2. Oppure incolla testo CSV / Colonne da Excel
                </label>
                <textarea
                  rows={8}
                  placeholder={`Codice Articolo;Nome Prodotto;Categoria;Confezione;Costo al Kg;Dose Nominale;g/s;RPM\nART-CAF-01;Caffè Solubile Arabica;coffee;Busta 1 Kg;18.50;7.0;2.8;120\nART-LAT-01;Latte Scremato Polvere;milk;Busta 1 Kg;9.80;8.5;2.5;120\nART-CIO-01;Cioccolato Extra Fondente;chocolate;Busta 1 Kg;8.40;18.0;4.5;200`}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className={`w-full p-3 rounded-xl text-xs font-mono border transition-all outline-hidden ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white focus:border-emerald-500'
                      : 'bg-slate-800 border-slate-700 text-white focus:border-emerald-500'
                  }`}
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                  Supporta separatori punto e virgola (<code className="text-emerald-600 font-bold">;</code>), virgola (<code className="text-emerald-600 font-bold">,</code>) o tabulazioni copiate direttamente da Excel.
                </span>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importing || !importText.trim()}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importazione in corso...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Esegui Importazione nel Database
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
