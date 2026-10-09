import React, { useState, useMemo } from 'react';
import { ArduinoSketchSettings, HardwarePinConfig } from '../types';
import { useTheme } from '../context/ThemeContext';
import {
  generateMqttRemoteFirmware,
} from '../data/arduinoSketches';
import {
  Code,
  Copy,
  Check,
  Download,
  Sliders,
  Wifi,
  Cpu,
  Layers,
  Terminal,
  Info,
  Cloud,
  Zap,
} from 'lucide-react';

const FREENOVE_ESP32_S3_KEYPAD_PINS: HardwarePinConfig = {
  row1: 4,  // Filo 1 (Connettore H4)
  row2: 5,  // Filo 2 (Connettore H4)
  row3: 6,  // Filo 3 (Connettore H4)
  row4: 7,  // Filo 4 (Connettore H4)
  col1: 8,  // Filo 5 (Connettore H4)
  col2: 9,  // Filo 6 (Connettore H4)
  col3: 10, // Filo 7 (Connettore H4)
  col4: 11, // Filo 8 (Connettore H4)
};

const DEFAULT_OPTO_PINS: number[] = [14, 13, 12, 15, 16, 17, 18, 21];

const DEFAULT_PINS: HardwarePinConfig = FREENOVE_ESP32_S3_KEYPAD_PINS;

const FREENOVE_ESP32_S2_PINS: HardwarePinConfig = {
  row1: 1,
  row2: 2,
  row3: 3,
  row4: 4,
  col1: 5,
  col2: 6,
  col3: 7,
  col4: 8,
};

const ESP32_S3_ORDERED_PINS: HardwarePinConfig = FREENOVE_ESP32_S3_KEYPAD_PINS;

interface CodeGeneratorProps {
  initialDeviceId?: string;
}

export const CodeGenerator: React.FC<CodeGeneratorProps> = ({ initialDeviceId }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);
  const [machines, setMachines] = useState<{ id: string; name: string; electronicBoard?: string }[]>([]);

  const [settings, setSettings] = useState<ArduinoSketchSettings>({
    ssid: 'Bolds Kranz',
    password: '',
    serverUrl: 'https://api.iobevoservice.it',
    deviceId: initialDeviceId || '',
    targetMacAddress: '',
    mqttBroker: 'broker.hivemq.com',
    mqttPort: 1883,
    pins: FREENOVE_ESP32_S3_KEYPAD_PINS,
    targetBoardModel: 'Freenove ESP32-S3 WROOM-1',
    debounceMs: 50,
    holdTimeMs: 500,
    sendOnEachPress: true,
    pinSubmitChar: '#',
    pinClearChar: '*',
    useBuzzer: false,
    buzzerPin: 0,
    useRelay: false,
    relayPin: 0,
    waterPumpPin: 18,
    boilerValvePin: 19,
    mixerMotorPin: 17,
    cupDropServoPin: 16,
    optoOutputPins: [14, 13, 12, 15, 16, 17, 18, 21],
    optoDurationMs: 400,
    enablePhysicalKeypad: true,
    bridgeOptoOnPhysicalPress: true,
    method: 'rest_http',
    keypadVoltageLevel: '12v_opto',
  });

  React.useEffect(() => {
    fetch('/api/machines')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMachines(data);
        }
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (initialDeviceId) {
      setSettings((prev) => ({ ...prev, deviceId: initialDeviceId }));
    }
  }, [initialDeviceId]);

  const generatedCode = useMemo(() => {
    return generateMqttRemoteFirmware(settings);
  }, [settings]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadIno = () => {
    const element = document.createElement('a');
    const file = new Blob([generatedCode], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'esp32_gbcloud_mqtt_firmware.ino';
    document.body.appendChild(element);
    element.click();
    element.remove();
  };

  const handlePinChange = (pinName: keyof HardwarePinConfig, value: number) => {
    setSettings((prev) => ({
      ...prev,
      pins: {
        ...prev.pins,
        [pinName]: value,
      },
    }));
  };

  return (
    <div id="code-generator-container" className="space-y-6">
      {/* Top Selector Banner */}
      <div className={`backdrop-blur-xl border rounded-2xl p-5 shadow-md ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-white/5 border-white/10 text-slate-100 shadow-xl'
      }`}>
        <div className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b ${
          isLight ? 'border-slate-300' : 'border-white/10'
        }`}>
          <div>
            <h2 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-950' : 'text-white'}`}>
              <Code className={`w-5 h-5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              Generatore di Firmware ESP32 Modulo GB-CLOUD
            </h2>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
              Firmware ufficiale C++ per modulo ESP32 GB-CLOUD: telemetria remota real-time MQTT (HiveMQ), monitoraggio battito cardiaco e gestione optoisolatori.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 shadow-sm ${
              isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
            }`}>
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>OTA Wireless Attivo (Porta 3232)</span>
            </div>
            <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shadow-sm ${
              isLight
                ? 'bg-blue-50 border-blue-300 text-blue-900'
                : 'bg-blue-950/50 border-blue-500/40 text-blue-200'
            }`}>
              <Cloud className="w-4 h-4 text-blue-600 animate-pulse" />
              <span>Telemetria Remota MQTT</span>
            </div>
          </div>
        </div>

        {/* Configuration Matrix & Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5 text-xs">
          {/* Network and Device */}
          <div className={`backdrop-blur-md border rounded-xl p-4 space-y-3 shadow-md ${
            isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className={`font-semibold flex items-center gap-1.5 border-b pb-2 ${
              isLight ? 'text-slate-900 border-slate-300' : 'text-slate-200 border-white/10'
            }`}>
              <Wifi className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} /> Rete Wi-Fi ed Endpoint
            </div>

            <div>
              <label htmlFor="wifi-ssid-input" className={`block mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>SSID Rete WiFi:</label>
              <input
                id="wifi-ssid-input"
                type="text"
                value={settings.ssid}
                onChange={(e) => setSettings({ ...settings, ssid: e.target.value })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                    : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                }`}
              />
            </div>

            <div>
              <label htmlFor="wifi-pass-input" className={`block mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Password WiFi:</label>
              <input
                id="wifi-pass-input"
                type="password"
                value={settings.password}
                onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                    : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="mqtt-broker-input" className={`block font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Broker MQTT Cloud:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, mqttBroker: 'broker.hivemq.com' })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      settings.mqttBroker === 'broker.hivemq.com'
                        ? 'bg-blue-600 text-white'
                        : isLight ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : 'bg-blue-500/20 text-blue-300'
                    }`}
                  >
                    HiveMQ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, mqttBroker: 'broker.emqx.io' })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      settings.mqttBroker === 'broker.emqx.io'
                        ? 'bg-emerald-600 text-white'
                        : isLight ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    EMQX
                  </button>
                </div>
              </div>
              <input
                id="mqtt-broker-input"
                type="text"
                value={settings.mqttBroker || 'broker.hivemq.com'}
                onChange={(e) => setSettings({ ...settings, mqttBroker: e.target.value })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-[11px] focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                    : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                }`}
              />
              <span className={`text-[10px] block mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Porta: 1883 • Auto-fallback su timeout rc=-2
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="server-url-input" className={`block font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>URL Server Database / API:</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, serverUrl: 'https://api.iobevoservice.it' })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      isLight ? 'bg-blue-100 text-blue-900 hover:bg-blue-200' : 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                    }`}
                  >
                    api.iobevoservice.it
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, serverUrl: typeof window !== 'undefined' ? window.location.origin : 'https://iobevoservice.it' })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                      isLight ? 'bg-slate-200 text-slate-800 hover:bg-slate-300' : 'bg-white/10 text-slate-300 hover:bg-white/15'
                    }`}
                  >
                    Cloud App
                  </button>
                </div>
              </div>
              <input
                id="server-url-input"
                type="text"
                value={settings.serverUrl}
                onChange={(e) => setSettings({ ...settings, serverUrl: e.target.value })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-[11px] focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                    : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                }`}
              />
            </div>

            <div className={`p-3 rounded-xl border ${
              isLight ? 'bg-blue-50/60 border-blue-200' : 'bg-blue-950/20 border-blue-500/20'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="device-id-input" className={`block font-semibold text-xs flex items-center gap-1.5 ${isLight ? 'text-blue-950' : 'text-blue-200'}`}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Identità Firmware ESP32:
                </label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  !settings.deviceId
                    ? isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-900/40 text-emerald-300'
                    : isLight ? 'bg-amber-100 text-amber-800' : 'bg-amber-900/40 text-amber-300'
                }`}>
                  {!settings.deviceId ? 'UNIVERSALE DINAMICO' : 'OVERRIDE STATICO'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="device-id-input"
                  type="text"
                  placeholder="Auto (es. GB-CLOUD-246F28B21A80)"
                  value={settings.deviceId}
                  onChange={(e) => setSettings({ ...settings, deviceId: e.target.value })}
                  className={`flex-1 border rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-none ${
                    isLight
                      ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20'
                      : 'bg-black/40 border-white/15 text-white focus:border-blue-400'
                  }`}
                />
                {settings.deviceId && (
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, deviceId: '' })}
                    className={`text-[10px] px-2 py-1.5 rounded-lg border font-semibold transition-colors ${
                      isLight
                        ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                    }`}
                    title="Torna alla modalità Universale Dinamica"
                  >
                    Reset Auto
                  </button>
                )}
              </div>

              {machines.length > 0 && (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Assegna a distributore:</span>
                  <select
                    id="select-configured-machine-id"
                    onChange={(e) => {
                      if (e.target.value) setSettings({ ...settings, deviceId: e.target.value });
                    }}
                    value={machines.some((m) => m.id === settings.deviceId) ? settings.deviceId : ''}
                    className={`text-[10px] border rounded px-1.5 py-0.5 focus:outline-none ${
                      isLight
                        ? 'bg-white text-blue-800 border-blue-300 font-semibold'
                        : 'bg-slate-900 text-blue-300 border-blue-500/30'
                    }`}
                  >
                    <option value="">-- Seleziona da Flotta --</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id} ({m.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <p className={`text-[10px] mt-1.5 leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {!settings.deviceId ? (
                  <>Il firmware rileverà il <strong>MAC hardware</strong> univoco dell'ESP32 all'avvio. La scheda apparirà automaticamente nel cloud senza bisogno di pre-programmare l'ID.</>
                ) : (
                  <>Hai impostato manualmente l'ID <code>{settings.deviceId}</code>. Lascia il campo vuoto per generare il firmware universale per qualsiasi scheda.</>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="target-mac-input" className={`block mb-1 flex items-center justify-between font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                <span>MAC Address Hardware ESP32:</span>
                <span className={`text-[10px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Rilevato in automatico dal modulo</span>
              </label>
              <input
                id="target-mac-input"
                type="text"
                placeholder="Auto-rilevato da WiFi.macAddress() all'avvio"
                value={settings.targetMacAddress}
                onChange={(e) => setSettings({ ...settings, targetMacAddress: e.target.value.toUpperCase() })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-xs focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                    : 'bg-black/30 border-white/10 text-slate-200 focus:border-blue-400'
                }`}
              />
            </div>

            <div>
              <label htmlFor="target-board-model" className={`block mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Modello Scheda Target:</label>
              <select
                id="target-board-model"
                value={settings.targetBoardModel || 'ESP32 DevKit V1 (38-Pin)'}
                onChange={(e) => setSettings({ ...settings, targetBoardModel: e.target.value })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-[11px] focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                    : 'bg-black/40 border-white/15 text-white focus:border-blue-400'
                }`}
              >
                <option value="Freenove ESP32-S3 WROOM-1">Freenove ESP32-S3 WROOM-1 (Dual Type-C / 4..11)</option>
                <option value="Freenove ESP32-S2 WROOM-1">Freenove ESP32-S2 WROOM-1 (USB Type-C / 1..8)</option>
                <option value="ESP32 DevKit V1 (38-Pin)">ESP32 DevKit V1 (38-Pin + Modulo Opto)</option>
                <option value="ESP32 Industrial DIN 4CH (Optoisolato)">ESP32 Industrial DIN 4CH Opto</option>
                <option value="ESP32 NodeMCU-32S">ESP32 NodeMCU-32S</option>
              </select>
            </div>
          </div>

          {/* GPIO Pin Assignment */}
          <div className={`backdrop-blur-md border rounded-xl p-4 space-y-3 shadow-md ${
            isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className={`font-semibold flex items-center justify-between border-b pb-2 ${
              isLight ? 'text-slate-900 border-slate-300' : 'text-slate-200 border-white/10'
            }`}>
              <div className="flex items-center gap-1.5">
                <Cpu className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} /> Assegnazione Pin GPIO Tastiera
              </div>
              <div className="flex items-center gap-1 flex-wrap justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setSettings({
                      ...settings,
                      pins: FREENOVE_ESP32_S3_KEYPAD_PINS,
                      targetBoardModel: 'Freenove ESP32-S3 WROOM-1',
                      optoOutputPins: [14, 13, 12, 15, 16, 17, 18, 21],
                    });
                  }}
                  className={`px-2.5 py-0.5 rounded text-[10px] border font-bold transition-all ${
                    isLight
                      ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-950 border-emerald-400 shadow-sm'
                      : 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-300 border-emerald-400/60 shadow-sm'
                  }`}
                  title="Freenove ESP32-S3 WROOM-1 con pinout su PCB: U1..U8 (GPIO 14, 13, 12, 15, 16, 17, 18, 21)"
                >
                  ⚡ Freenove S3 (U1..U8 Attivi)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Rows (Fili 1..4) */}
              <div className="space-y-2">
                <span className={`text-[11px] font-semibold block ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>Righe Matrice (Fili 1-4)</span>
                {[
                  { name: 'Filo 1 (R1)', key: 'row1' as const },
                  { name: 'Filo 2 (R2)', key: 'row2' as const },
                  { name: 'Filo 3 (R3)', key: 'row3' as const },
                  { name: 'Filo 4 (R4)', key: 'row4' as const },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className={`font-mono text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{item.name}:</span>
                    <input
                      type="number"
                      aria-label={`Pin GPIO per ${item.name}`}
                      value={settings.pins[item.key]}
                      onChange={(e) => handlePinChange(item.key, parseInt(e.target.value) || 0)}
                      className={`w-14 border rounded-lg px-2 py-1 text-center font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                          : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Columns (Fili 5..8) */}
              <div className="space-y-2">
                <span className={`text-[11px] font-semibold block ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>Colonne Matrice (Fili 5-8)</span>
                {[
                  { name: 'Filo 5 (C1)', key: 'col1' as const },
                  { name: 'Filo 6 (C2)', key: 'col2' as const },
                  { name: 'Filo 7 (C3)', key: 'col3' as const },
                  { name: 'Filo 8 (C4)', key: 'col4' as const },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className={`font-mono text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{item.name}:</span>
                    <input
                      type="number"
                      aria-label={`Pin GPIO per ${item.name}`}
                      value={settings.pins[item.key]}
                      onChange={(e) => handlePinChange(item.key, parseInt(e.target.value) || 0)}
                      className={`w-14 border rounded-lg px-2 py-1 text-center font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-slate-300 text-slate-900 focus:border-blue-600'
                          : 'bg-black/30 border-white/15 text-white focus:border-blue-400'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={`text-[11px] flex items-center gap-1 pt-1 ${isLight ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              <Info className={`w-3.5 h-3.5 shrink-0 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              <span>Pin ingressi tastiera scelti per evitare conflitti di boot.</span>
            </div>

            {/* Dedicated 8-Channel Optocoupler Output Pins Section */}
            <div className={`pt-3 mt-3 border-t ${isLight ? 'border-slate-300' : 'border-white/10'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Zap className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} />
                  <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-amber-300'}`}>
                    Uscite Verso Modulo Optoisolatori (U1..U8)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSettings({
                        ...settings,
                        optoOutputPins: [...DEFAULT_OPTO_PINS],
                      });
                    }}
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold border transition-all ${
                      isLight
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                    }`}
                    title="Ripristina pinout hardware su PCB: U1=14, U2=13, U3=12, U4=15, U5=16, U6=17, U7=18, U8=21"
                  >
                    ⚡ Default PCB (14, 13, 12, 15, 16, 17, 18, 21)
                  </button>
                </div>
              </div>
              <p className={`text-[10px] mb-2 leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                GPIO dell&apos;ESP32 collegati alle resistenze da 330Ω che pilotano i LED degli optoisolatori PC817 (per simulare la pressione dei tasti sulla scheda madre).
              </p>

              {/* 8 Opto Output Inputs Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((optoIdx) => {
                  const currentPin = settings.optoOutputPins?.[optoIdx - 1] ?? DEFAULT_OPTO_PINS[optoIdx - 1];
                  return (
                    <div
                      key={optoIdx}
                      className={`p-1.5 rounded-lg border flex flex-col items-center justify-center ${
                        isLight ? 'bg-white border-slate-300 shadow-sm' : 'bg-black/40 border-white/10'
                      }`}
                    >
                      <span className={`text-[10px] font-mono font-bold mb-0.5 ${isLight ? 'text-amber-800' : 'text-amber-400'}`}>
                        U{optoIdx} (Opto {optoIdx})
                      </span>
                      <input
                        type="number"
                        aria-label={`Pin GPIO per Uscita Opto U${optoIdx}`}
                        value={currentPin}
                        onChange={(e) => {
                          const newPins = [...(settings.optoOutputPins || DEFAULT_OPTO_PINS)];
                          newPins[optoIdx - 1] = parseInt(e.target.value) || 0;
                          setSettings({ ...settings, optoOutputPins: newPins });
                        }}
                        className={`w-12 text-center text-xs font-mono font-bold py-0.5 border rounded focus:outline-none ${
                          isLight
                            ? 'bg-amber-50/60 border-amber-300 text-amber-950 focus:border-amber-600'
                            : 'bg-black/50 border-amber-500/40 text-amber-200 focus:border-amber-400'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cablaggio Diretto 1:1 Fisso e Standardizzato */}
            <div className={`mt-3 pt-3 border-t p-2.5 rounded-lg border flex items-center justify-between ${
              isLight ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
            }`}>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span>🔒 Cablaggio Fisso 1:1 (U1..U8)</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                    isLight ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' : 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/50'
                  }`}>
                    STANDARD DEFINITIVO
                  </span>
                </div>
                <p className="text-[10px] leading-tight opacity-90">
                  Nessuna inversione software: la matrice hardware dei 15 tasti è allineata direttamente 1-a-1 alle uscite optoisolate U1..U8 (CARAFFA = U4+U6, STOP = U4+U7, LINGUA = U4+U5, P1..P12).
                </p>
              </div>
            </div>
          </div>

          {/* Peripherals & Timers */}
          <div className={`backdrop-blur-md border rounded-xl p-4 space-y-3 shadow-md ${
            isLight ? 'bg-slate-50 border-slate-300' : 'bg-white/[0.03] border-white/10'
          }`}>
            <div className={`font-semibold flex items-center gap-1.5 border-b pb-2 ${
              isLight ? 'text-slate-900 border-slate-300' : 'text-slate-200 border-white/10'
            }`}>
              <Sliders className={`w-3.5 h-3.5 ${isLight ? 'text-amber-700' : 'text-amber-400'}`} /> Periferiche &amp; Debounce
            </div>

            <div>
              <label htmlFor="voltage-interface-select" className={`block mb-1 flex items-center justify-between font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                <span>Interfaccia Tensione Tastiera:</span>
                <span className={`text-[10px] font-bold ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>12V &rarr; 3.3V</span>
              </label>
              <select
                id="voltage-interface-select"
                value={settings.keypadVoltageLevel || '12v_opto'}
                onChange={(e) => setSettings({ ...settings, keypadVoltageLevel: e.target.value as any })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono text-[11px] focus:outline-none ${
                  isLight
                    ? 'bg-white border-amber-400 text-slate-900 focus:border-amber-600'
                    : 'bg-black/40 border-amber-500/40 text-white focus:border-amber-400'
                }`}
              >
                <option value="12v_opto">⚡ 12V Modulo Optoisolatore PC817 (Consigliato)</option>
                <option value="12v_divider">📐 12V Partitore Resistivo (10kΩ + 3.9kΩ)</option>
                <option value="3v3_direct">🔌 3.3V Contatti a Secco (Membrana Isolata)</option>
              </select>
            </div>

            <div>
              <label htmlFor="debounce-ms-input" className={`block mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Debounce Antirimbalzo (ms):</label>
              <input
                id="debounce-ms-input"
                type="number"
                value={settings.debounceMs}
                onChange={(e) => setSettings({ ...settings, debounceMs: parseInt(e.target.value) || 30 })}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono focus:outline-none ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-600'
                    : 'bg-black/30 border-white/15 text-white focus:border-amber-400'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="opto-duration-input" className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                  Durata Impulso Opto (ms):
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, optoDurationMs: 400, optoTriggerDurationMs: 400 })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      settings.optoDurationMs === 400
                        ? 'bg-amber-600 text-white'
                        : isLight ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    400ms
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, optoDurationMs: 2000, optoTriggerDurationMs: 2000 })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      settings.optoDurationMs === 2000
                        ? 'bg-amber-600 text-white'
                        : isLight ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    2s
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, optoDurationMs: 4000, optoTriggerDurationMs: 4000 })}
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      settings.optoDurationMs === 4000
                        ? 'bg-amber-600 text-white'
                        : isLight ? 'bg-amber-100 text-amber-900 hover:bg-amber-200' : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    4s (Test Tester)
                  </button>
                </div>
              </div>
              <input
                id="opto-duration-input"
                type="number"
                value={settings.optoDurationMs || 400}
                onChange={(e) => {
                  let raw = parseInt(e.target.value) || 0;
                  // Se l'utente scrive 4 (intendendo 4 secondi), converti automaticamente in 4000ms
                  const val = (raw > 0 && raw <= 10) ? raw * 1000 : raw;
                  setSettings({ ...settings, optoDurationMs: val || 400, optoTriggerDurationMs: val || 400 });
                }}
                className={`w-full border rounded-lg px-2.5 py-1.5 font-mono focus:outline-none ${
                  isLight
                    ? 'bg-white border-amber-400 text-amber-950 font-bold focus:border-amber-600'
                    : 'bg-black/30 border-white/15 text-amber-300 focus:border-amber-400'
                }`}
              />
              <span className={`text-[10px] block mt-0.5 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>
                {settings.optoDurationMs ? `${settings.optoDurationMs} ms (${(settings.optoDurationMs / 1000).toFixed(1)} secondi di chiusura contatto)` : '400 ms (0.4s)'}
              </span>
            </div>

            {/* Configurazione Modalità Operativa Hardware */}
            <div className={`p-3 rounded-xl border ${
              isLight ? 'bg-amber-50/70 border-amber-300' : 'bg-amber-950/20 border-amber-500/30'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-bold ${isLight ? 'text-amber-950' : 'text-amber-300'}`}>
                  Modalità Operativa Hardware & Attuazione Opto
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  settings.bridgeOptoOnPhysicalPress
                    ? isLight ? 'bg-blue-100 text-blue-900 border border-blue-300' : 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
                    : isLight ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {settings.bridgeOptoOnPhysicalPress ? 'MODALITÀ BASE (Attiva)' : 'MODALITÀ PARALLELO'}
                </span>
              </div>
              <p className={`text-[11px] mb-2 leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                {settings.bridgeOptoOnPhysicalPress
                  ? 'Modalità Base (Standard): L\'ESP32 legge la tastiera a membrana su H4 e chiude i contatti verso la scheda madre su H3 (Opto U1..U8). Sulle erogazioni da remoto, l\'interblocco hardware a 1500ms e la deduplicazione MQTT impediscono categoricamente doppi impulsi o doppi bip.'
                  : 'Modalità Parallelo: La tastiera è già collegata direttamente in parallelo alla macchina. L\'ESP32 fa solo ascolto telemetrico senza chiudere gli opto su pressione locale.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, bridgeOptoOnPhysicalPress: true })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                    settings.bridgeOptoOnPhysicalPress
                      ? isLight ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : isLight ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100' : 'bg-black/30 text-slate-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span>⚡ Modalità Base (Predefinita)</span>
                  <span className="text-[10px] font-normal opacity-90">Legge tastiera H4 + Chiude contatti Opto H3</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, bridgeOptoOnPhysicalPress: false })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all text-left flex flex-col gap-0.5 ${
                    !settings.bridgeOptoOnPhysicalPress
                      ? isLight ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : isLight ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100' : 'bg-black/30 text-slate-300 border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span>🔇 Modalità Parallelo</span>
                  <span className="text-[10px] font-normal opacity-90">Tastiera sdoppiata in parallelo alla macchina</span>
                </button>
              </div>
            </div>

            {/* Modalità Operativa Unica: Lettura Tasto Fisico + Simulazione Optoisolata + Simulazione WebApp */}
            <div className={`p-3.5 rounded-xl border ${
              isLight ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950' : 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold">
                    Doppio Ingresso: Tastiera Fisica &amp; Simulatore WebApp
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isLight ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' : 'bg-emerald-900/70 text-emerald-300 border border-emerald-500/30'
                }`}>
                  OPTO FISICO + WEBAPP
                </span>
              </div>
              <p className={`text-[11px] mt-2 leading-relaxed ${isLight ? 'text-emerald-900/90' : 'text-emerald-200/90'}`}>
                <strong>Comandi Remoti WebApp:</strong> Quando un operatore o cliente preme un tasto nel portale web o via API MQTT, l'ESP32 chiude istantaneamente la coppia di Optoisolatori PC817 (U1..U8 su H3) erogando la bevanda in tempo reale.
              </p>
              <div className={`mt-2 pt-2 border-t text-[10px] flex items-center justify-between font-mono ${
                isLight ? 'border-emerald-200 text-emerald-800' : 'border-emerald-800/60 text-emerald-300'
              }`}>
                <span>H4 (Tastiera Fisica) &amp; WebApp (MQTT)</span>
                <span>&rarr;</span>
                <span>Uscite Opto U1..U8 (H3)</span>
                <span>&rarr;</span>
                <span>Scheda Distributore</span>
              </div>
            </div>

            <div className={`pt-2 border-t text-[11px] flex items-center gap-1.5 ${
              isLight ? 'border-slate-300 text-emerald-800 font-medium' : 'border-white/10 text-emerald-400'
            }`}>
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Architettura unica: lettura tastiera a membrana fisica + simulazione automatica con optoisolatori.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 15 Buttons Bidirectional MQTT Overview Banner */}
      <div className={`border rounded-2xl p-4 shadow-md ${
        isLight ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-blue-200 text-slate-800' : 'bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-emerald-950/40 border-blue-500/30 text-slate-200'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> 15 Pulsanti Gestiti
            </span>
            <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Architettura Bidirezionale MQTT Real-Time
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className={`px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-black/30 border-white/15 text-slate-300'}`}>
              Baud: 115200
            </span>
            <span className={`px-2 py-0.5 rounded border ${isLight ? 'bg-white border-slate-300 text-emerald-700 font-bold' : 'bg-black/30 border-white/15 text-emerald-400 font-bold'}`}>
              Buffer: 1024B
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
          <div className={`p-2 rounded-lg border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-white/5 border-white/10'}`}>
            <span className="font-bold block text-blue-600 dark:text-blue-400 mb-0.5">12 Prodotti (P1..P12)</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Espresso, Lungo, Macchiato, Cappuccino, Latte, Cioccolata, Tè, Orzo, Ginseng...</span>
          </div>
          <div className={`p-2 rounded-lg border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-white/5 border-white/10'}`}>
            <span className="font-bold block text-rose-600 dark:text-rose-400 mb-0.5">🛑 Tasto STOP (U4 &amp; U7)</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Arresto di emergenza, reset stato e annullamento dose caraffa.</span>
          </div>
          <div className={`p-2 rounded-lg border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-white/5 border-white/10'}`}>
            <span className="font-bold block text-amber-600 dark:text-amber-400 mb-0.5">🏺 Tasto CARAFFA (U4 &amp; U6)</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Finestra 10s per dose caraffa, auto-reset su timeout o dopo erogazione.</span>
          </div>
          <div className={`p-2 rounded-lg border ${isLight ? 'bg-white/80 border-slate-200' : 'bg-white/5 border-white/10'}`}>
            <span className="font-bold block text-emerald-600 dark:text-emerald-400 mb-0.5">🌐 Tasto LINGUA (U4 &amp; U5)</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Ciclo cambio lingua display a video e telemetria immediata.</span>
          </div>
        </div>

        {/* Hardware Architecture: 8x PC817 Shared Bus Circuit */}
        <div className={`mt-3 pt-3 border-t text-[11px] ${
          isLight ? 'border-blue-200/80' : 'border-white/10'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white shadow-sm">
              Schema Hardware Ufficiale
            </span>
            <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Scheda 8x PC817 su Piazza Comune (Isolamento Galvanico Totale)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
            <div className={`p-2.5 rounded-lg border font-mono text-[10px] ${isLight ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-black/40 border-white/10 text-slate-300'}`}>
              <div className="font-bold text-blue-600 dark:text-blue-400 mb-1">GRUPPO RIGHE (U1..U4 - Fili 1..4, Polo Positivo +12V/+13.2V):</div>
              <div>• Pin 1 LED: da GPIO ESP32 tramite R = 330 &Omega;</div>
              <div>• Pin 2 LED: a GND comune ESP32</div>
              <div>• Pin 4 Collettore (+): a Connettore H3 Fili 1..4 (Polo Positivo Scheda Macchina)</div>
              <div>• Pin 3 Emettitore (-): <strong>Tutti saldati su PIAZZA COMUNE</strong></div>
            </div>
            <div className={`p-2.5 rounded-lg border font-mono text-[10px] ${isLight ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-black/40 border-white/10 text-slate-300'}`}>
              <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">GRUPPO COLONNE (U5..U8 - Fili 5..8, Riferimento Ritorno / GND):</div>
              <div>• Pin 1 LED: da GPIO ESP32 tramite R = 330 &Omega;</div>
              <div>• Pin 2 LED: a GND comune ESP32</div>
              <div>• Pin 4 Collettore (+): <strong>Tutti saldati su PIAZZA COMUNE</strong></div>
              <div>• Pin 3 Emettitore (-): a Connettore H3 Fili 5..8 (Riferimento Ritorno Scheda Macchina)</div>
            </div>
          </div>
          <div className={`mt-2 p-2 rounded text-[10px] ${isLight ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-blue-950/40 text-blue-300 border border-blue-800/40'}`}>
            <strong>Principio di Funzionamento:</strong> Per comandare qualsiasi dei 15 tasti, l&apos;ESP32 accende simultaneamente 2 GPIO (es. <code>P1 Espresso = U1 + U5</code>, <code>STOP = U4 + U7</code>, <code>CARAFFA = U4 + U6</code>, <code>LINGUA = U4 + U5</code>). La corrente attraversa i due fototransistor in serie chiudendo il contatto senza alcuna connessione elettrica o di massa tra ESP32 e distributore!
          </div>
        </div>

        <div className={`mt-2.5 pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] ${
          isLight ? 'border-blue-200 text-slate-600' : 'border-white/10 text-slate-400'
        }`}>
          <span>
            <strong>Bidirezionale:</strong> Pressione tastiera fisica &rarr; MQTT (App) • Comando da App &rarr; Esecuzione fisica ESP32 + Notifica conferma
          </span>
          <span className="font-mono text-[10px]">
            Topic: <code className="px-1 py-0.2 bg-blue-100 dark:bg-blue-950/60 rounded text-blue-800 dark:text-blue-300">vending/{settings.deviceId}/commands</code>
          </span>
        </div>
      </div>

      {/* Code Viewer Box with Syntax & Actions */}
      <div className={`backdrop-blur-xl border rounded-2xl overflow-hidden shadow-lg ${
        isLight ? 'bg-white border-slate-300' : 'bg-white/5 border-white/10 shadow-2xl'
      }`}>
        <div className={`px-4 py-3 border-b backdrop-blur-md flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-black/30 border-white/10'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <span className={`text-xs font-mono ml-2 font-bold ${
              isLight ? 'text-slate-800' : 'text-slate-300'
            }`}>
              esp32_gbcloud_mqtt_firmware.ino
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-code-btn"
              onClick={handleCopyCode}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                  : 'bg-blue-500/30 hover:bg-blue-500/40 border-blue-400/40 text-white'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiato!' : 'Copia Codice'}</span>
            </button>

            <button
              id="download-ino-btn"
              onClick={handleDownloadIno}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                isLight
                  ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-800'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-200'
              }`}
            >
              <Download className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
              <span>Scarica .INO</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="relative">
          <pre className={`p-4 md:p-6 text-xs md:text-sm font-mono overflow-x-auto leading-relaxed max-h-[540px] ${
            isLight
              ? 'bg-slate-900 text-emerald-300 border-t border-slate-300'
              : 'bg-black/60 text-slate-200'
          }`}>
            <code>{generatedCode}</code>
          </pre>
        </div>
      </div>

      {/* Flashing instructions card */}
      <div className={`backdrop-blur-xl border rounded-2xl p-5 text-xs space-y-3 shadow-md ${
        isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-white/5 border-white/10 text-slate-300 shadow-xl'
      }`}>
        <h3 className={`text-sm font-bold flex items-center gap-2 ${
          isLight ? 'text-slate-950' : 'text-white'
        }`}>
          <Terminal className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
          Guida Rapida: Come caricare il codice su ESP32
        </h3>
        <ol className={`list-decimal list-inside space-y-2 ${
          isLight ? 'text-slate-700 font-medium' : 'text-slate-400'
        }`}>
          <li>
            <strong className={isLight ? 'text-slate-950' : 'text-slate-200'}>Apri Arduino IDE:</strong> Assicurati di avere installato il pacchetto schede <code className={`px-1.5 py-0.5 rounded border font-mono ${
              isLight ? 'text-blue-900 bg-blue-50 border-blue-200' : 'text-blue-300 bg-black/40 border-white/10'
            }`}>esp32 by Espressif Systems</code>.
          </li>
          <li>
            <strong className={isLight ? 'text-slate-950' : 'text-slate-200'}>Installa le Librerie:</strong> Vai su <em className={isLight ? 'text-slate-900 font-semibold' : 'text-slate-300'}>Strumenti &gt; Gestione Librerie</em> e cerca:
            <ul className={`list-disc list-inside ml-4 mt-1 space-y-0.5 font-mono ${
              isLight ? 'text-blue-800 font-semibold' : 'text-blue-300'
            }`}>
              <li>PubSubClient (di Nick O&apos;Leary)</li>
              <li>Keypad (di Mark Stanley &amp; Alexander Brevig)</li>
              <li>ArduinoJson (di Benoit Blanchon, v6 o v7)</li>
            </ul>
          </li>
          <li>
            <strong className={isLight ? 'text-slate-950' : 'text-slate-200'}>Seleziona la scheda in Arduino IDE:</strong>
            <ul className={`list-disc list-inside ml-4 mt-1 space-y-1 ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
              <li>
                <strong className="text-emerald-400">Per Freenove ESP32-S3 WROOM-1 (Consigliata):</strong> Seleziona <code className={`px-1.5 py-0.5 rounded border font-mono font-bold ${
                  isLight ? 'text-emerald-900 bg-emerald-50 border-emerald-300' : 'text-emerald-300 bg-emerald-950/40 border-emerald-500/40'
                }`}>ESP32S3 Dev Module</code>, imposta <code className={`px-1 rounded font-mono ${isLight ? 'bg-emerald-50 text-emerald-900 font-bold' : 'bg-black/30 text-emerald-300'}`}>USB CDC On Boot: Enabled</code>, <code className={`px-1 rounded font-mono ${isLight ? 'bg-emerald-50 text-emerald-900' : 'bg-black/30 text-emerald-300'}`}>Flash Size: 8MB (o 16MB)</code> e <code className={`px-1 rounded font-mono ${isLight ? 'bg-emerald-50 text-emerald-900' : 'bg-black/30 text-emerald-300'}`}>PSRAM: OPI PSRAM</code> (o Enabled).
              </li>
              <li>
                <strong>Per Freenove ESP32-S2 WROOM-1:</strong> Seleziona <code className={`px-1.5 py-0.5 rounded border font-mono ${
                  isLight ? 'text-blue-900 bg-blue-50 border-blue-200' : 'text-blue-300 bg-black/40 border-white/10'
                }`}>ESP32S2 Dev Module</code>, imposta <code className={`px-1 rounded font-mono ${isLight ? 'bg-amber-50 text-amber-900' : 'bg-black/30 text-amber-300'}`}>USB CDC On Boot: Enabled</code>.
              </li>
              <li>
                <strong>Per ESP32 Base (WROOM-32):</strong> Seleziona <code className={`px-1.5 py-0.5 rounded border font-mono ${
                  isLight ? 'text-blue-900 bg-blue-50 border-blue-200' : 'text-blue-300 bg-black/40 border-white/10'
                }`}>ESP32 Dev Module</code> (o DOIT ESP32 DEVKIT V1).
              </li>
            </ul>
          </li>
          <li>
            <strong className={isLight ? 'text-slate-950' : 'text-slate-200'}>Carica e Monitora:</strong> Clicca <em className={isLight ? 'text-slate-900 font-semibold' : 'text-slate-300'}>Carica</em> (se l&apos;ESP32-S2 non entra in bootloader automaticamente, tieni premuto <code className="font-mono">BOOT</code>, premi e rilascia <code className="font-mono">RST</code>, poi rilascia <code className="font-mono">BOOT</code>), poi apri il <em className={isLight ? 'text-slate-900 font-semibold' : 'text-slate-300'}>Monitor Seriale</em> a <code className={`px-1.5 py-0.5 rounded border font-mono ${
              isLight ? 'text-amber-900 bg-amber-50 border-amber-200 font-bold' : 'text-amber-300 bg-black/40 border-white/10'
            }`}>115200 baud</code>.
          </li>
        </ol>
      </div>
    </div>
  );
};
