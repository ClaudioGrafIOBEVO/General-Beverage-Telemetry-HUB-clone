import React from 'react';
import { X, ShieldCheck, Cookie, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className={`border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all ${
          isLight
            ? 'bg-white border-slate-300 text-slate-800'
            : 'bg-slate-900 border-slate-800 text-slate-100'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'border-slate-300 bg-slate-100' : 'border-slate-800 bg-slate-950/60'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
                isLight
                  ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                  : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Informativa Privacy &amp; Cookie Policy (GDPR)
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                Piattaforma Gestionale e Telemetria Flotta Distributori Automatici (B2B)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-600 hover:text-slate-950 hover:bg-slate-200'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed">
          {/* Note introduttiva B2B */}
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-3 ${
              isLight
                ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold mb-0.5">Uso Esclusivamente Aziendale &amp; Professionale (B2B)</strong>
              La presente applicazione è riservata al personale tecnico, amministrativo e agli operatori autorizzati. Non prevede registrazione pubblica, né profilazione dei consumatori finali, né strumenti di tracciamento commerciale.
            </div>
          </div>

          {/* 1. Titolare del Trattamento */}
          <div className="space-y-1.5">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              1. Titolare del Trattamento dei Dati
            </h4>
            <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
              Il Titolare del trattamento è la società proprietaria o gestore dell&apos;infrastruttura dei distributori automatici. I dati vengono trattati nel rispetto del Regolamento Europeo 2016/679 (GDPR) e della normativa nazionale vigente.
            </p>
          </div>

          {/* 2. Dati Trattati e Finalità */}
          <div className="space-y-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Lock className="w-3.5 h-3.5 text-blue-500" />
              2. Tipologia di Dati Raccolti e Finalità
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                <strong className={`block text-[11px] mb-1 font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                  Dati degli Account Aziendali:
                </strong>
                <p className={isLight ? 'text-slate-700' : 'text-slate-400'}>
                  Nome, username, indirizzo email aziendale, ruolo assegnato e data/ora dell&apos;ultimo accesso. Finalità: autenticazione sicura, abilitazione dei permessi (RBAC) e audit di sicurezza.
                </p>
              </div>
              <div className={`p-3 rounded-xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/40 border-slate-800'}`}>
                <strong className={`block text-[11px] mb-1 font-bold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                  Dati Telemetrici &amp; Macchine:
                </strong>
                <p className={isLight ? 'text-slate-700' : 'text-slate-400'}>
                  Matricola distributore, log battute (tasto erogato, durata), taratura elettrovalvole e coclee. Sono <em>dati tecnici industriali totalmente anonimi</em> privi di riferimenti ai consumatori finali.
                </p>
              </div>
            </div>
          </div>

          {/* 3. Base Giuridica */}
          <div className="space-y-1.5">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              3. Base Giuridica del Trattamento
            </h4>
            <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
              Il trattamento si fonda sul <strong>legittimo interesse del titolare</strong> (art. 6, par. 1, lett. f, GDPR) alla salvaguardia della sicurezza informatica aziendale e sull&apos;<strong>esecuzione del rapporto contrattuale</strong> per la gestione tecnica e manutentiva degli impianti di distribuzione bevande.
            </p>
          </div>

          {/* 4. Cookie Policy e Archiviazione Locale */}
          <div className="space-y-2">
            <h4 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Cookie className="w-3.5 h-3.5 text-amber-500" />
              4. Cookie Policy &amp; Web Storage
            </h4>
            <div className={`p-3.5 rounded-xl border ${isLight ? 'bg-amber-50/60 border-amber-300 text-amber-950' : 'bg-amber-950/20 border-amber-500/30 text-amber-200'}`}>
              <strong className="block font-bold mb-1">Solo Cookie &amp; Storage Tecnici Essenziali:</strong>
              <ul className="list-disc list-inside space-y-1 text-[11px]">
                <li><code className="font-mono font-bold">vending_auth_token</code>: token di autenticazione sicuro per mantenere la sessione di lavoro attiva.</li>
                <li><code className="font-mono font-bold">vending_theme</code>: preferenza visiva (modalità Chiara o Scura).</li>
              </ul>
              <p className="mt-1.5 text-[11px]">
                <strong>Nessun cookie di terze parti</strong>, nessun cookie di profilazione pubblicitaria (Google Ads, Meta Pixel, ecc.). Per i cookie tecnici la legge non richiede il consenso preventivo tramite banner bloccante.
              </p>
            </div>
          </div>

          {/* 5. Conservazione e Diritti */}
          <div className="space-y-1.5">
            <h4 className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
              5. Conservazione dei Dati &amp; Diritti dell&apos;Utente
            </h4>
            <p className={isLight ? 'text-slate-700' : 'text-slate-300'}>
              I dati dell&apos;account sono conservati per tutta la durata del rapporto di servizio e cancellati su richiesta dell&apos;amministratore. Ai sensi degli artt. 15-22 del GDPR, ciascun utente autorizzato ha diritto di accesso, rettifica, aggiornamento e cancellazione dei propri dati rivolgendosi all&apos;amministratore di sistema.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3.5 border-t ${
            isLight ? 'border-slate-300 bg-slate-100' : 'border-slate-800 bg-slate-950/60'
          }`}
        >
          <span className={`text-[11px] font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Conforme a Regolamento UE 2016/679 (GDPR) &bull; Uso Tecnico Interno
          </span>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isLight
                ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            Ho compreso
          </button>
        </div>
      </div>
    </div>
  );
};
