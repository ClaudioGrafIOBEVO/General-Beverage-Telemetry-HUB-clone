import React, { useState, useEffect } from 'react';
import { CodeGenerator } from './CodeGenerator';
import { MachineKeyConfig } from './MachineKeyConfig';
import { WiringGuide } from './WiringGuide';
import { PinAccessManager } from './PinAccessManager';
import { ApiTester } from './ApiTester';
import { OtaFirmwareView } from './OtaFirmwareView';
import { useTheme } from '../context/ThemeContext';
import {
  Code,
  Coffee,
  Sliders,
  Cable,
  ShieldCheck,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  Radio,
} from 'lucide-react';

interface NodeProgrammingViewProps {
  selectedMachineId: string;
  onMachineChanged: (machineId: string) => void;
  initialSubTab?: ProgrammingSubTab;
}

export type ProgrammingSubTab = 'products' | 'firmware' | 'ota' | 'wiring' | 'pins' | 'api' | 'keymap';

export const NodeProgrammingView: React.FC<NodeProgrammingViewProps> = ({
  selectedMachineId,
  onMachineChanged,
  initialSubTab = 'products',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const resolvedInitialTab: ProgrammingSubTab = (initialSubTab === 'keymap' ? 'products' : (initialSubTab || 'products')) as ProgrammingSubTab;
  const [activeSubTab, setActiveSubTab] = useState<ProgrammingSubTab>(resolvedInitialTab);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab((initialSubTab === 'keymap' ? 'products' : initialSubTab) as ProgrammingSubTab);
    }
  }, [initialSubTab]);

  const SUB_TABS: Array<{ id: ProgrammingSubTab; label: string; icon: React.ReactNode }> = [
    { id: 'products', label: 'Configurazione Prodotti (P1 - P12)', icon: <Coffee className="w-3.5 h-3.5" /> },
    { id: 'firmware', label: 'Firmware C++ (Arduino/PlatformIO)', icon: <Code className="w-3.5 h-3.5" /> },
    { id: 'ota', label: 'Aggiornamento OTA Cloud (.bin)', icon: <Radio className="w-3.5 h-3.5 text-emerald-400" /> },
    { id: 'wiring', label: 'Schema Cablaggio & Relè', icon: <Cable className="w-3.5 h-3.5" /> },
    { id: 'pins', label: 'PIN Tecnico & Relè Sicurezza', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'api', label: 'API Telemetria REST & cURL', icon: <Terminal className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER WITH SUB-TABS */}
      <div className={`rounded-3xl p-5 border space-y-4 transition-all ${
        isLight
          ? 'bg-white border-slate-300 shadow-md'
          : 'bg-slate-900/80 border-white/10 shadow-xl backdrop-blur-md'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-sm ${
              isLight ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
            }`}>
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h1 className={`text-xl font-extrabold tracking-tight ${isLight ? 'text-slate-950' : 'text-white'}`}>
                Programmazione &amp; Configurazione Moduli ESP32
              </h1>
              <p className={`text-xs ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                Suite di sviluppo: generazione codice sorgente C++, configurazione matrice tasti, schemi di collegamento e test endpoint.
              </p>
            </div>
          </div>
        </div>

        {/* SUB-TABS BAR */}
        <div className={`flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-2xl border ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-black/40 border-white/10'
        }`}>
          {SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold border border-blue-700'
                    : isLight
                      ? 'text-slate-800 hover:text-slate-950 hover:bg-slate-200 border border-transparent hover:border-slate-300'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SUB-VIEW 1: PRODUCT CONFIGURATION & NAMING (P1 - P12) */}
      {(activeSubTab === 'products' || activeSubTab === 'keymap') && (
        <MachineKeyConfig
          initialMachineId={selectedMachineId}
          onMachineChanged={onMachineChanged}
        />
      )}

      {/* SUB-VIEW 2: C++ ARDUINO CODE GENERATOR */}
      {activeSubTab === 'firmware' && (
        <CodeGenerator initialDeviceId={selectedMachineId} />
      )}

      {/* SUB-VIEW OTA: AGGIORNAMENTO FIRMWARE OTA CLOUD */}
      {activeSubTab === 'ota' && (
        <OtaFirmwareView initialMachineId={selectedMachineId} />
      )}

      {/* SUB-VIEW 3: WIRING SCHEMATICS & OPTOCOUPLERS */}
      {activeSubTab === 'wiring' && (
        <WiringGuide />
      )}

      {/* SUB-VIEW 4: PIN ACCESS & RELAYS */}
      {activeSubTab === 'pins' && (
        <PinAccessManager />
      )}

      {/* SUB-VIEW 5: REST API & CURL TESTER */}
      {activeSubTab === 'api' && (
        <ApiTester />
      )}
    </div>
  );
};

