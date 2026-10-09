import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Send,
  Check,
  Copy,
  Code2,
  Key,
  Plus,
  Trash2,
  ShieldCheck,
  FileText,
  Activity,
  AlertTriangle,
  Clock,
  Lock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Download,
  Share2,
  Coffee,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { VendingMachine, BeverageItem, ApiKey, ThirdPartyTelemetryLog } from '../types';

export const ApiTester: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Server URL
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tuo-dominio.run.app';

  // State
  const [machines, setMachines] = useState<VendingMachine[]>([]);
  const [beverages, setBeverages] = useState<BeverageItem[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [telemetryLogs, setTelemetryLogs] = useState<ThirdPartyTelemetryLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Form for testing REST call
  const [selectedSerial, setSelectedSerial] = useState<string>('');
  const [selectedProdNum, setSelectedProdNum] = useState<number>(1);
  const [selectedKeyToken, setSelectedKeyToken] = useState<string>('');
  const [isCaraffa, setIsCaraffa] = useState<boolean>(false);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);

  // New API Key Modal / Form
  const [showNewKeyModal, setShowNewKeyModal] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyDesc, setNewKeyDesc] = useState<string>('');
  const [isCreatingKey, setIsCreatingKey] = useState<boolean>(false);

  // Active view tab inside API section: 'specs' | 'tester' | 'keys' | 'logs'
  const [activeTab, setActiveTab] = useState<'specs' | 'tester' | 'keys' | 'logs'>('specs');

  // Load initial data
  const fetchData = async () => {
    try {
      const [machRes, bevRes, keysRes, logsRes] = await Promise.all([
        fetch('/api/machines'),
        fetch('/api/beverages'),
        fetch('/api/v1/telemetry/keys'),
        fetch('/api/v1/telemetry/logs'),
      ]);

      if (machRes.ok) {
        const data = await machRes.json();
        setMachines(data || []);
        if (data.length > 0 && !selectedSerial) {
          setSelectedSerial(data[0].serialNumber || '');
        }
      }
      if (bevRes.ok) {
        const data = await bevRes.json();
        setBeverages(data || []);
      }
      if (keysRes.ok) {
        const data = await keysRes.json();
        const kList = data.keys || [];
        setApiKeys(kList);
        if (kList.length > 0 && !selectedKeyToken) {
          setSelectedKeyToken(kList[0].key);
        }
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setTelemetryLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Errore nel caricamento dati API:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(id);
    setTimeout(() => setCopiedSnippet(null), 2500);
  };

  // Selected Machine details
  const currentMachine = machines.find((m) => m.serialNumber === selectedSerial) || machines[0];
  const currentBeverage = beverages.find((b) => b.productNumber === selectedProdNum) || beverages[0];

  // Send Test REST call
  const handleSendTestDispense = async () => {
    setIsLoading(true);
    setTestResponse(null);
    setTestStatusCode(null);

    const payload = {
      serialNumber: selectedSerial || currentMachine?.serialNumber || '104829',
      productNumber: selectedProdNum,
      key: `P${selectedProdNum}`,
      productName: currentBeverage?.name || `Prodotto P${selectedProdNum}`,
      price: customPrice ? parseFloat(customPrice) : currentBeverage?.price || 0.5,
      caraffa: isCaraffa,
      source: 'COLLAUDO_PORTALE_TESTER',
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/v1/telemetry/dispense', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${selectedKeyToken || 'gb_live_demo'}`,
        },
        body: JSON.stringify(payload),
      });

      setTestStatusCode(res.status);
      const data = await res.json();
      setTestResponse(JSON.stringify(data, null, 2));

      // Refresh logs and machines after test
      fetchData();
    } catch (err) {
      setTestStatusCode(500);
      setTestResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setIsLoading(false);
    }
  };

  // Create API Key
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await fetch('/api/v1/telemetry/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDesc.trim(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys((prev) => [data.apiKey, ...prev]);
        setSelectedKeyToken(data.apiKey.key);
        setNewKeyName('');
        setNewKeyDesc('');
        setShowNewKeyModal(false);
      }
    } catch (err) {
      console.error('Errore creazione API Key:', err);
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Delete API Key
  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Sei sicuro di voler revocare questa Chiave API? Il dispositivo o fornitore associato non potrà più trasmettere.')) return;
    try {
      const res = await fetch(`/api/v1/telemetry/keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch (err) {
      console.error('Errore eliminazione chiave:', err);
    }
  };

  // cURL Code Snippet
  const activeToken = selectedKeyToken || (apiKeys[0]?.key || 'GB_API_KEY_XXXXXXXXXXXX');
  const activeSerial = selectedSerial || (currentMachine?.serialNumber || '104829');

  const curlDispenseSnippet = `curl -X POST "${serverUrl}/api/v1/telemetry/dispense" \\
  -H "Authorization: Bearer ${activeToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serialNumber": "${activeSerial}",
    "productNumber": ${selectedProdNum},
    "key": "P${selectedProdNum}",
    "productName": "${currentBeverage?.name || 'Espresso'}",
    "price": ${customPrice ? parseFloat(customPrice) : currentBeverage?.price || 0.5},
    "caraffa": ${isCaraffa},
    "source": "MODEM_4G_TERZO",
    "timestamp": "${new Date().toISOString()}"
  }'`;

  const curlHeartbeatSnippet = `curl -X POST "${serverUrl}/api/v1/telemetry/heartbeat" \\
  -H "Authorization: Bearer ${activeToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "serialNumber": "${activeSerial}",
    "status": "ONLINE",
    "boilerTemp": 92.5,
    "waterLevel": 20.0,
    "totalDispenses": 1420
  }'`;

  const pythonSnippet = `import requests

url = "${serverUrl}/api/v1/telemetry/dispense"
headers = {
    "Authorization": "Bearer ${activeToken}",
    "Content-Type": "application/json"
}
payload = {
    "serialNumber": "${activeSerial}",
    "productNumber": ${selectedProdNum},
    "productName": "${currentBeverage?.name || 'Espresso'}",
    "caraffa": ${isCaraffa}
}

response = requests.post(url, json=payload, headers=headers)
print("Status:", response.status_code)
print("Risposta:", response.json())`;

  // Markdown Specifications document ready to send to partner
  const specsDocument = `# SPECIFICHE TECNICHE INTEGRAZIONE TELEMETRIA ESTERNA (REST API)
Piattaforma: General Beverage Cloud Hub
Versione API: v1.0 (REST JSON - HTTPS)

---

## 1. REQUISITO FONDAMENTALE: IDENTIFICATIVO IMPIANTO
Ogni richiesta inviata al portale DEVE contenere la Matricola univoca del distributore:
- Campo: "serialNumber" (Stringa numerica a 6 cifre, es. "${activeSerial}")
- La matricola è immutabile e identifica univocamente la macchina, il cliente e la sede di appartenenza.

---

## 2. TRASMISSIONE SICURA E AUTENTICAZIONE (HTTPS)
Tutte le chiamate API devono avvenire obbligatoriamente su protocollo sicuro **HTTPS** (porta 443 con crittografia TLS/SSL). Le chiamate in HTTP non crittografato (in chiaro) non sono ammesse per motivi di sicurezza dei dati e delle chiavi.

L'autenticazione è obbligatoria per ogni richiesta e si effettua inserendo il Bearer Token (la tua Chiave API) nell'header della richiesta HTTPS:
- Header principale raccomandato: Authorization: Bearer <TUA_CHIAVE_API>
- Header alternativo supportato: X-API-Key: <TUA_CHIAVE_API>
- Content-Type: application/json

Esempio Header HTTPS:
Authorization: Bearer ${activeToken}

---

## 3. ENDPOINT 1: EVENTO DI EROGAZIONE (BATTUTA VENDITA)
Da invocare ogni volta che il distributore eroga una bevanda.

- Metodo: POST
- URL: ${serverUrl}/api/v1/telemetry/dispense
- Payload JSON:
{
  "serialNumber": "${activeSerial}",
  "productNumber": 1,
  "key": "P1",
  "productName": "Espresso",
  "price": 0.50,
  "caraffa": false,
  "source": "MODEM_4G",
  "timestamp": "2026-09-25T15:00:00Z"
}

Descrizione Campi:
- serialNumber   (obbligatorio, string): Matricola a 6 cifre della macchina.
- productNumber  (obbligatorio, int 1..12): Numero della bevanda erogata (P1..P12).
- key            (opzionale, string): Identificativo tasto (es. "P1", "P2", ... "P12").
- productName    (opzionale, string): Descrizione estesa bevanda.
- price          (opzionale, float): Prezzo applicato in Euro.
- caraffa        (opzionale, bool): true se erogazione in modalità caraffa.
- timestamp      (opzionale, ISO8601): Data e ora dell'erogazione in formato UTC.

Risposta di Successo (HTTP 200 OK):
{
  "success": true,
  "message": "Erogazione registrata con successo nel portale General Beverage",
  "dispenseId": "disp-ext-...",
  "machine": {
    "serialNumber": "${activeSerial}",
    "name": "${currentMachine?.name || 'Ristosano Master'}"
  }
}

---

## 4. ENDPOINT 2: HEARTBEAT & STATO PERIODICO
Da invocare periodicamente (es. ogni 1-5 minuti) per aggiornare lo stato di presenza online e la telemetria.

- Metodo: POST
- URL: ${serverUrl}/api/v1/telemetry/heartbeat
- Payload JSON:
{
  "serialNumber": "${activeSerial}",
  "status": "ONLINE",
  "boilerTemp": 92.5,
  "waterLevel": 20.0,
  "totalDispenses": 1420
}

---

## 5. ENDPOINT 3: SEGNALAZIONE ALLARMI ED ERRORI
Da invocare in caso di guasto, blocco o anomalie sul distributore.

- Metodo: POST
- URL: ${serverUrl}/api/v1/telemetry/alarm
- Payload JSON:
{
  "serialNumber": "${activeSerial}",
  "errorCode": "ERR_WATER_EMPTY",
  "message": "Mancanza acqua o alimentazione idrica interrotta",
  "severity": "CRITICAL"
}
`;

  return (
    <div id="api-tester-container" className="space-y-6">
      {/* HEADER SECTION */}
      <div
        className={`rounded-3xl p-5 sm:p-6 border transition-all ${
          isLight
            ? 'bg-white border-slate-300 shadow-md text-slate-800'
            : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
        }`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-inherit">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-md ${
                isLight
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-400 text-white'
                  : 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-400/30 text-white'
              }`}
            >
              <Terminal className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg sm:text-xl font-extrabold tracking-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>
                  Portale Specifiche &amp; REST API per Telemetria Terze Parti
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Solo REST API Esterno
                </span>
              </div>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
                Specifiche ufficiali da consegnare ai fornitori terzi (Modem 4G, centraline esterne, MDB) per scrivere consumi ed erogazioni direttamente nel portale.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard(specsDocument, 'full-specs')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm transition-all cursor-pointer ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
              }`}
            >
              {copiedSnippet === 'full-specs' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Specifiche Copiate!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>Copia Specifiche per il Fornitore</span>
                </>
              )}
            </button>

            <button
              onClick={fetchData}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
              title="Ricarica Dati e Log"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SUB NAVIGATION */}
        <div className="flex items-center gap-2 mt-4 pt-1 overflow-x-auto">
          {[
            { id: 'specs', label: '1. Specifiche Tecniche da Consegnare', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'keys', label: `2. Chiavi API Partner (${apiKeys.length})`, icon: <Key className="w-3.5 h-3.5 text-amber-500" /> },
            { id: 'tester', label: '3. Simulatore & Collaudo Chiamata REST (HTTPS)', icon: <Send className="w-3.5 h-3.5 text-emerald-500" /> },
            { id: 'logs', label: `4. Log Richieste Ricevute (${telemetryLogs.length})`, icon: <Activity className="w-3.5 h-3.5 text-blue-500" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30 border border-blue-700'
                    : isLight
                    ? 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                    : 'text-slate-300 hover:bg-white/5 border border-white/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* VIEW 1: SPECIFICHE TECNICHE DA CONSEGNARE */}
      {activeTab === 'specs' && (
        <div className="space-y-6">
          <div
            className={`rounded-3xl p-5 sm:p-6 border space-y-5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 shadow-md text-slate-800'
                : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <div>
                <h3 className={`text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  Regole Standard per i Sistemi di Telemetria Esterni
                </h3>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Questo è il documento che puoi fornire tale e quale agli sviluppatori o ai tecnici del sistema di telemetria terzo.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(specsDocument, 'specs-md')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                }`}
              >
                {copiedSnippet === 'specs-md' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet === 'specs-md' ? 'Copiato!' : 'Copia Testo Markdown'}</span>
              </button>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  isLight ? 'bg-amber-50/80 border-amber-200 text-amber-900' : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Matricola Immutabile</span>
                </div>
                <div className="text-xs font-semibold">Campo obbligatorio: &quot;serialNumber&quot;</div>
                <p className="text-[11px] opacity-80">
                  Ogni evento deve contenere il codice a 6 cifre della macchina (es. <code>#{activeSerial}</code>). Il server lo collega automaticamente a cliente e sede.
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  isLight ? 'bg-blue-50/80 border-blue-200 text-blue-900' : 'bg-blue-500/10 border-blue-500/25 text-blue-300'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-blue-600" />
                  <span>Autenticazione Sicura</span>
                </div>
                <div className="text-xs font-semibold">Header HTTPS (Bearer Token)</div>
                <p className="text-[11px] opacity-80">
                  <code>Authorization: Bearer &lt;API_KEY&gt;</code>. I modem terzi comunicano direttamente su connessione cifrata HTTPS (TLS/SSL).
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  isLight ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                }`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Protocollo Esclusivo</span>
                </div>
                <div className="text-xs font-semibold">Solo REST API via HTTPS (JSON)</div>
                <p className="text-[11px] opacity-80">
                  I sistemi terzi comunicano unicamente con chiamate HTTPS POST standard (porta 443 crittografata). Nessun accesso diretto MQTT.
                </p>
              </div>
            </div>

            {/* ENDPOINTS OVERVIEW */}
            <div className="space-y-4 pt-2">
              <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Endpoints REST Disponibili per il Fornitore Esterno
              </h4>

              {/* Endpoint 1: Dispense */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-600 text-white">POST</span>
                    <span className="font-mono text-xs font-bold">{serverUrl}/api/v1/telemetry/dispense</span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Registrazione Erogazione / Battuta Vendita
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Payload JSON Richiesto:</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "serialNumber": "${activeSerial}",
  "productNumber": 1,
  "productName": "Espresso",
  "price": 0.50,
  "caraffa": false,
  "timestamp": "2026-09-25T15:00:00Z"
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Risposta del Server (200 OK):</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-blue-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "success": true,
  "message": "Erogazione registrata con successo",
  "dispenseId": "disp-ext-...",
  "machine": {
    "serialNumber": "${activeSerial}",
    "name": "${currentMachine?.name || 'Ristosano'}"
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Endpoint 2: Heartbeat */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-600 text-white">POST</span>
                    <span className="font-mono text-xs font-bold">{serverUrl}/api/v1/telemetry/heartbeat</span>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    Segnale di Presenza / Telemetria Caldaia &amp; Scorte
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Payload JSON:</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "serialNumber": "${activeSerial}",
  "status": "ONLINE",
  "boilerTemp": 92.5,
  "waterLevel": 20.0,
  "totalDispenses": 1420
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Risposta (200 OK):</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-blue-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "success": true,
  "message": "Heartbeat aggiornato",
  "machine": { "status": "ONLINE" }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Endpoint 3: Alarm */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-600 text-white">POST</span>
                    <span className="font-mono text-xs font-bold">{serverUrl}/api/v1/telemetry/alarm</span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    Segnalazione Guasti ed Errori Tecnici
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Payload JSON:</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "serialNumber": "${activeSerial}",
  "errorCode": "ERR_WATER_EMPTY",
  "message": "Mancanza acqua in caldaia",
  "severity": "CRITICAL"
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold block mb-1">Risposta (200 OK):</span>
                    <pre className="p-3 rounded-xl bg-slate-950 text-blue-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
{`{
  "success": true,
  "message": "Allarme registrato per distributore #${activeSerial}"
}`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: CHIAVI API PARTNER */}
      {activeTab === 'keys' && (
        <div className="space-y-6">
          <div
            className={`rounded-3xl p-5 sm:p-6 border space-y-5 transition-all ${
              isLight
                ? 'bg-white border-slate-300 shadow-md text-slate-800'
                : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-inherit">
              <div>
                <h3 className={`text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  <Key className="w-5 h-5 text-amber-500" />
                  Gestione Chiavi API per Sistemi Terzi
                </h3>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  Genera una chiave API univoca per ogni partner o modem 4G. Puoi revocarla in qualsiasi momento.
                </p>
              </div>

              <button
                onClick={() => setShowNewKeyModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Genera Nuova Chiave API</span>
              </button>
            </div>

            {/* List of keys */}
            <div className="space-y-3">
              {apiKeys.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Nessuna chiave API attiva. Clicca su &quot;Genera Nuova Chiave API&quot; per crearne una.
                </div>
              ) : (
                apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.02] border-white/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs">{k.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Attiva
                        </span>
                      </div>
                      {k.description && <p className="text-[11px] opacity-75">{k.description}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] opacity-60 pt-0.5">
                        <span>Creata: {new Date(k.createdAt).toLocaleDateString('it-IT')}</span>
                        <span>&bull;</span>
                        <span>Chiamate totali: <strong>{k.totalCalls || 0}</strong></span>
                        {k.lastUsedAt && (
                          <>
                            <span>&bull;</span>
                            <span>Ultimo uso: {new Date(k.lastUsedAt).toLocaleTimeString('it-IT')}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <div className="font-mono text-xs px-2.5 py-1.5 rounded-lg bg-black/80 text-amber-300 border border-white/10 select-all">
                        {k.key}
                      </div>
                      <button
                        onClick={() => copyToClipboard(k.key, `key-${k.id}`)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer ${
                          isLight ? 'bg-white hover:bg-slate-100 border-slate-300' : 'bg-white/5 hover:bg-white/10 border-white/10'
                        }`}
                        title="Copia Token"
                      >
                        {copiedSnippet === `key-${k.id}` ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteApiKey(k.id)}
                        className="p-2 rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all cursor-pointer"
                        title="Revoca Chiave"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: COLLAUDO CHIAMATA REST & CURL GENERATOR */}
      {activeTab === 'tester' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dispatcher Form */}
          <div
            className={`lg:col-span-6 rounded-3xl p-5 sm:p-6 border space-y-4 text-xs ${
              isLight
                ? 'bg-white border-slate-300 shadow-md text-slate-800'
                : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
            }`}
          >
            <div className="flex items-center justify-between pb-3 border-b border-inherit">
              <span className={`font-bold flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Simula Invio Chiamata REST (POST /api/v1/telemetry/dispense)
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Seleziona Distributore Flotta (con Matricola):</label>
                <select
                  value={selectedSerial}
                  onChange={(e) => setSelectedSerial(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs font-mono font-bold border transition-colors focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                  }`}
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.serialNumber}>
                      #{m.serialNumber} - {m.name} ({m.locationDetails?.company || 'Non Assegnato'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Bevanda Erogata:</label>
                  <select
                    value={selectedProdNum}
                    onChange={(e) => setSelectedProdNum(parseInt(e.target.value) || 1)}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-bold border transition-colors focus:outline-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                    }`}
                  >
                    {beverages.map((b) => (
                      <option key={b.id} value={b.productNumber}>
                        P{b.productNumber} - {b.name} (€{b.price.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Chiave API Partner:</label>
                  <select
                    value={selectedKeyToken}
                    onChange={(e) => setSelectedKeyToken(e.target.value)}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-mono border transition-colors focus:outline-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-500' : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                    }`}
                  >
                    {apiKeys.map((k) => (
                      <option key={k.id} value={k.key}>
                        {k.name} ({k.key.slice(0, 14)}...)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCaraffa}
                    onChange={(e) => setIsCaraffa(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Modalità Caraffa</span>
                </label>
              </div>

              <button
                onClick={handleSendTestDispense}
                disabled={isLoading}
                className={`w-full font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  isLight
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50'
                    : 'bg-emerald-600/80 hover:bg-emerald-600 border border-emerald-400/40 text-white disabled:opacity-50'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>{isLoading ? 'Inviando Chiamata HTTPS...' : 'Invia Chiamata REST di Prova (HTTPS)'}</span>
              </button>
            </div>
          </div>

          {/* Live Response Box */}
          <div
            className={`lg:col-span-6 rounded-3xl p-5 sm:p-6 border flex flex-col text-xs ${
              isLight
                ? 'bg-white border-slate-300 shadow-md text-slate-800'
                : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
            }`}
          >
            <div className="font-bold mb-2 font-mono flex items-center justify-between border-b pb-2 border-inherit">
              <span>Risposta Ricevuta dal Server:</span>
              {testStatusCode !== null && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    testStatusCode === 200 ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'
                  }`}
                >
                  HTTP {testStatusCode}
                </span>
              )}
            </div>

            <pre
              className={`flex-1 p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto border min-h-[140px] ${
                isLight ? 'bg-slate-900 text-emerald-300 border-slate-800' : 'bg-black/60 text-emerald-400 border-white/10'
              }`}
            >
              {testResponse || '// Clicca su "Invia Chiamata REST di Prova" per testare la risposta live'}
            </pre>
          </div>

          {/* Code Snippets cURL and Python */}
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* cURL */}
            <div
              className={`rounded-3xl p-5 border space-y-3 ${
                isLight ? 'bg-white border-slate-300 shadow-md' : 'bg-slate-900/80 border-white/10 shadow-xl'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-blue-500" /> Comando cURL per Terminale / Modem
                </span>
                <button
                  onClick={() => copyToClipboard(curlDispenseSnippet, 'curl-disp')}
                  className="px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet === 'curl-disp' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'curl-disp' ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3.5 rounded-xl font-mono text-[11px] text-slate-200 overflow-x-auto border border-slate-800">
                {curlDispenseSnippet}
              </pre>
            </div>

            {/* Python */}
            <div
              className={`rounded-3xl p-5 border space-y-3 ${
                isLight ? 'bg-white border-slate-300 shadow-md' : 'bg-slate-900/80 border-white/10 shadow-xl'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-xs flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-amber-500" /> Script Python (Modulo Requests)
                </span>
                <button
                  onClick={() => copyToClipboard(pythonSnippet, 'py-disp')}
                  className="px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {copiedSnippet === 'py-disp' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSnippet === 'py-disp' ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
              <pre className="bg-slate-950 p-3.5 rounded-xl font-mono text-[11px] text-slate-200 overflow-x-auto border border-slate-800">
                {pythonSnippet}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: AUDIT LOG DELLE CHIAMATE RICEVUTE */}
      {activeTab === 'logs' && (
        <div
          className={`rounded-3xl p-5 sm:p-6 border space-y-4 transition-all ${
            isLight
              ? 'bg-white border-slate-300 shadow-md text-slate-800'
              : 'bg-slate-900/80 border-white/10 shadow-xl text-slate-200 backdrop-blur-xl'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-inherit">
            <div>
              <h3 className={`text-base font-extrabold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <Activity className="w-5 h-5 text-blue-500" />
                Audit Log Chiamate Ricevute da Sistemi Terzi
              </h3>
              <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                Tracciamento in tempo reale di tutte le richieste HTTP POST arrivate dai modem esterni.
              </p>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Aggiorna Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b ${isLight ? 'border-slate-200 text-slate-500' : 'border-white/10 text-slate-400'}`}>
                  <th className="py-2.5 px-3 font-semibold">Orario</th>
                  <th className="py-2.5 px-3 font-semibold">Stato</th>
                  <th className="py-2.5 px-3 font-semibold">Partner / API Key</th>
                  <th className="py-2.5 px-3 font-semibold">Matricola Macchina</th>
                  <th className="py-2.5 px-3 font-semibold">Endpoint</th>
                  <th className="py-2.5 px-3 font-semibold">Messaggio / Dettaglio</th>
                  <th className="py-2.5 px-3 font-semibold">IP Origine</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {telemetryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Nessuna richiesta ricevuta finora. Esegui un test dalla scheda &quot;Simulatore &amp; Collaudo&quot;.
                    </td>
                  </tr>
                ) : (
                  telemetryLogs.map((log) => (
                    <tr key={log.id} className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] opacity-80">
                        {new Date(log.timestamp).toLocaleTimeString('it-IT')}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3" /> 200 OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 font-bold text-[10px]">
                            <XCircle className="w-3 h-3" /> ERRORE
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold">{log.apiKeyName || 'Anonimo'}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-amber-500">
                        #{log.serialNumber}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] opacity-80">{log.endpoint}</td>
                      <td className="py-2.5 px-3 text-[11px] max-w-xs truncate">{log.message}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[10px] opacity-60">{log.ipAddress}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: NUOVA CHIAVE API */}
      {showNewKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900 border-white/20 text-white'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-inherit">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-500" /> Genera Nuova Chiave API Partner
              </h3>
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer font-bold"
              >
                Chiudi
              </button>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">Nome del Partner / Sistema Esterno *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Modem 4G Alfa - Fornitore X"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none ${
                    isLight ? 'bg-white border-slate-300 focus:border-blue-500' : 'bg-black/50 border-white/15 focus:border-blue-400'
                  }`}
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Descrizione / Note (Opzionale)</label>
                <textarea
                  rows={2}
                  placeholder="Es. SIM 4G montata sui distributori regione Lombardia"
                  value={newKeyDesc}
                  onChange={(e) => setNewKeyDesc(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 text-xs border focus:outline-none resize-none ${
                    isLight ? 'bg-white border-slate-300 focus:border-blue-500' : 'bg-black/50 border-white/15 focus:border-blue-400'
                  }`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewKeyModal(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-500 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isCreatingKey}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isCreatingKey ? 'Generazione...' : 'Crea Chiave API'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
