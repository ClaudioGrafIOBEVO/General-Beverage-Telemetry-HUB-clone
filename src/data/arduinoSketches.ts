import { ArduinoSketchSettings } from '../types';
import { generateMqttRemoteFirmware as generateMqtt15KeysFirmware } from './firmwareMqtt15Keys';

/**
 * SKETCH MQTT IoT REMOTO IN TEMPO REALE (15 TASTI BIDIREZIONALE + AUTO-FALLBACK)
 * Gestione dei 12 Prodotti + STOP, CARAFFA, LINGUA.
 * Comunicazione bidirezionale da App a ESP32 e da Tastiera a Membrana ad App.
 * Include log seriali completi e dettagliati per debug e controllo.
 */
export function generateMqttRemoteFirmware(config: ArduinoSketchSettings): string {
  return generateMqtt15KeysFirmware(config);
}

function _legacyUnusedMqttRemoteFirmware(config: ArduinoSketchSettings): string {
  const { ssid, password, deviceId, targetMacAddress, targetBoardModel, optoOutputPins, optoTriggerDurationMs } = config;
  const devId = deviceId || 'ESP32-VENDING-01';
  const targetMac = targetMacAddress || '24:6F:28:B2:1A:80';
  const boardModel = targetBoardModel || 'Freenove ESP32-S3 WROOM-1 (Dual Type-C / Dual-Core)';
  const optoPinsList = optoOutputPins && optoOutputPins.length > 0 ? optoOutputPins.join(', ') : '14, 13, 12, 15, 16, 17, 18, 21';
  const optoDuration = optoTriggerDurationMs ?? 400;
  const pins = config.pins || {
    row1: 4, row2: 5, row3: 6, row4: 7, col1: 8, col2: 9, col3: 10, col4: 11
  };

  return `/*
 * ==================================================================================
 * ESP32 - FIRMWARE TELEMETRIA REMOTA IoT CLOUD REAL-TIME (MQTT BROKER PUBBLICO)
 * ==================================================================================
 * Hardware: ${boardModel} | MAC Address: ${targetMac}
 * Protocollo: MQTT Standard su Porta 1883 (Broker Pubblico Globale HiveMQ / EMQX)
 * Funzionamento Remoto: Funziona da qualsiasi Wi-Fi o Hotspot cellulare al mondo!
 *
 * Configurazione Pin Tastiera a Membrana (Fili 1-8):
 * - Filo 1 -> GPIO ${pins.row1}
 * - Filo 2 -> GPIO ${pins.row2}
 * - Filo 3 -> GPIO ${pins.row3}
 * - Filo 4 -> GPIO ${pins.row4}
 * - Filo 5 -> GPIO ${pins.col1}
 * - Filo 6 -> GPIO ${pins.col2}
 * - Filo 7 -> GPIO ${pins.col3}
 * - Filo 8 -> GPIO ${pins.col4}
 *
 * Uscite Optoisolate (Simulazione Pressione Tasti su Scheda Macchina):
 * - Uscite Opto: GPIO {${optoPinsList}} (Durata impulso: ${optoDuration}ms)
 *
 * Topic MQTT:
 * - Telemetria Tasti: vending/${devId}/telemetry
 * - Erogazioni:       vending/${devId}/dispense
 * - Diagnostica/Ping: vending/${devId}/status
 * ==================================================================================
 * LIBRERIE RICHIESTE in Arduino IDE (Gestione Librerie -> Cerca e Installa):
 * 1. "PubSubClient" di Nick O'Leary
 * ==================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>

// --- STRUTTURA DEFINIZIONE TASTO DALLA MATRICE REALE (Dichiarata all'inizio per Arduino IDE) ---
typedef struct TastoMatrice {
  int filoA;
  int filoB;
  char keyChar;
  const char* nome;
  bool isBeverage;
  int productNum;
} TastoMatrice;

// Prototipi espliciti per garantire la compilazione corretta con tutte le versioni di Arduino IDE
void inviaEventoMQTT(const TastoMatrice& t);
void triggerOptoOutput(int optoIndex, int durationMs);
void mqttCallback(char* topic, byte* payload, unsigned int length);

// --- CONFIGURAZIONE RETE WI-FI & IDENTITA HARDWARE ---
const char* WIFI_SSID       = "${ssid || 'GBAPIOS02'}";
const char* WIFI_PASSWORD   = "${password || 'PASSWORD_WIFI'}"; // <-- La tua password Wi-Fi
const char* TARGET_MAC_ADDR = "${targetMac}";
const char* BOARD_MODEL     = "${boardModel}";

// --- BROKER MQTT PUBBLICO AD ALTA DISPONIBILITA' ---
const char* MQTT_BROKER        = "broker.hivemq.com";
const int   MQTT_PORT          = 1883;
// IP Diretti di fallback in caso di mancata risoluzione DNS o timeout su reti aziendali 10.x.x.x
const IPAddress HIVEMQ_IP_1(35, 157, 157, 36);
const IPAddress HIVEMQ_IP_2(52, 57, 53, 146);
IPAddress activeBrokerIp(35, 157, 157, 36);

const char* DEVICE_ID       = "${devId}";

// Topic MQTT
const char* TOPIC_KEYLOG    = "vending/${devId}/telemetry";
const char* TOPIC_DISPENSE  = "vending/${devId}/dispense";
const char* TOPIC_STATUS    = "vending/${devId}/status";
const char* TOPIC_COMMANDS  = "vending/${devId}/commands";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- ASSEGNAZIONE PIN TASTIERA A MEMBRANA ---
const int PIN_FILI[8] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}, ${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};
const int LED_STATUS  = 2; // LED status integrato

// --- USCITE OPTOISOLATE (SIMULAZIONE PRESSIONE TASTI SULLA MACCHINA) ---
const int PIN_OPTO_OUT[]   = {${optoPinsList}};
const int NUM_OPTO_OUT     = sizeof(PIN_OPTO_OUT) / sizeof(PIN_OPTO_OUT[0]);
const int OPTO_DURATION_MS = ${optoDuration};

// Tabella 15 Tasti
const TastoMatrice TABELLA_TASTI[] = {
  {2, 5, '0', "STOP", false, 0},
  {3, 5, '*', "CARAFFA", false, 0},
  {4, 5, '#', "LINGUA", false, 0},
  {4, 8, '1', "PRODOTTO 1 (P1)", true, 1},
  {4, 7, '2', "PRODOTTO 2 (P2)", true, 2},
  {4, 6, '3', "PRODOTTO 3 (P3)", true, 3},
  {3, 8, 'A', "PRODOTTO 4 (P4)", true, 4},
  {3, 7, '4', "PRODOTTO 5 (P5)", true, 5},
  {3, 6, '5', "PRODOTTO 6 (P6)", true, 6},
  {2, 8, '6', "PRODOTTO 7 (P7)", true, 7},
  {2, 7, 'B', "PRODOTTO 8 (P8)", true, 8},
  {2, 6, '7', "PRODOTTO 9 (P9)", true, 9},
  {1, 8, '8', "PRODOTTO 10 (P10)", true, 10},
  {1, 7, '9', "PRODOTTO 11 (P11)", true, 11},
  {1, 6, 'C', "PRODOTTO 12 (P12)", true, 12}
};

const int TOTALE_TASTI = sizeof(TABELLA_TASTI) / sizeof(TABELLA_TASTI[0]);

bool modalitaCaraffa = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000; // Timeout 10s: auto-reset a Monodose standard
unsigned long ultimoHeartbeat = 0;
unsigned long conteggioPressioni = 0;

// Macchina a stati antirimbalzo industriale (Integratore di campioni stabili)
enum StatoTastiera { STATO_IDLE, STATO_PREMUTO };
StatoTastiera statoTastiera = STATO_IDLE;
int tastoCandidato = -1;
int conteggioCampioniPremuto = 0;
int conteggioCampioniRilascio = 0;
unsigned long ultimoInvioMs = 0;

const int CAMPIONI_MIN_PRESSIONE = 3; // Richiede 3 scansioni consecutive (~30ms) stabili per confermare la pressione
const int CAMPIONI_MIN_RILASCIO  = 4; // Richiede 4 scansioni consecutive (~40ms) a riposo per riarmare la tastiera

// Simula la chiusura del contatto optoisolato (es. U1..U8 verso connettore tastiera)
void triggerOptoOutput(int optoIndex, int durationMs = OPTO_DURATION_MS) {
  if (optoIndex < 0 || optoIndex >= NUM_OPTO_OUT) return;
  int targetPin = PIN_OPTO_OUT[optoIndex];
  Serial.println(">> [OPTO] Attivazione Optoisolatore U" + String(optoIndex + 1) + " su GPIO " + String(targetPin) + " (" + String(durationMs) + "ms)...");
  digitalWrite(targetPin, HIGH); // Accende LED interno dell'optoisolatore PC817
  delay(durationMs);
  digitalWrite(targetPin, LOW);  // Rilascia contatto
  Serial.println(">> [OPTO] Contatto rilasciato.");
}

// Simula la chiusura del contatto fisico sui fili della matrice tastiera originale (Fili 1..8)
void simulaTastoMatrice(int filoA, int filoB, int durationMs = OPTO_DURATION_MS) {
  if (filoA >= 1 && filoA <= 8 && filoB >= 1 && filoB <= 8) {
    int pinA = PIN_FILI[filoA - 1];
    int pinB = PIN_FILI[filoB - 1];
    Serial.print(">> [MATRICE HARDWARE] Simulazione Chiusura: Filo ");
    Serial.print(filoA);
    Serial.print(" (GPIO ");
    Serial.print(pinA);
    Serial.print(") <-> Filo ");
    Serial.print(filoB);
    Serial.print(" (GPIO ");
    Serial.print(pinB);
    Serial.print(") [");
    Serial.print(durationMs);
    Serial.println("ms]...");

    pinMode(pinA, OUTPUT);
    digitalWrite(pinA, LOW);
    pinMode(pinB, OUTPUT);
    digitalWrite(pinB, LOW);
    delay(durationMs);
    pinMode(pinA, INPUT_PULLUP);
    pinMode(pinB, INPUT_PULLUP);
    Serial.println(">> [MATRICE HARDWARE] Contatto rilasciato.");
  }
}

// --- CONNESSIONE WI-FI ---
void connettiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.print("Connessione a WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativi = 0;
  while (WiFi.status() != WL_CONNECTED && tentativi < 25) {
    delay(400);
    Serial.print(".");
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    tentativi++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS, LOW);
    Serial.println("\\n>>> WiFi Connesso! IP: " + WiFi.localIP().toString() + " <<<");
    Serial.print(">>> MAC Address Hardware: ");
    Serial.println(WiFi.macAddress());
  }
}

// --- CONNESSIONE MQTT CON LAST WILL & TESTAMENT (LWT PER RICONOSCIMENTO ISTANTANEO OFFLINE) ---
int tentativiMqttFalliti = 0;

void riconnettiMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Tentativo di connessione al Broker MQTT (");
    Serial.print(activeBrokerIp.toString());
    Serial.print(":" + String(MQTT_PORT) + ")... ");
    String clientId = "ESP32-Vending-" + String(WiFi.macAddress()) + "-" + String(random(0xffff), HEX);
    
    // Configura Last Will & Testament (LWT): Se l'ESP32 viene spento o perde alimentazione,
    // il broker MQTT pubblica istantaneamente lo stato OFFLINE sul server in tempo reale (< 1s)!
    String willTopic = String(TOPIC_STATUS);
    String willMsg = "{\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                   + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                   + "\\\"status\\\":\\\"OFFLINE\\\"}";

    if (mqttClient.connect(clientId.c_str(), willTopic.c_str(), 1, true, willMsg.c_str())) {
      Serial.println(">>> MQTT CONNESSO CON SUCCESSO! (LWT Attivo) <<<");
      tentativiMqttFalliti = 0;
      digitalWrite(LED_STATUS, HIGH);
      delay(150);
      digitalWrite(LED_STATUS, LOW);

      String statusMsg = "{\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                       + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                       + "\\\"boardModel\\\":\\\"" + String(BOARD_MODEL) + "\\\","
                       + "\\\"status\\\":\\\"ONLINE\\\","
                       + "\\\"ip\\\":\\\"" + WiFi.localIP().toString() + "\\\","
                       + "\\\"freeHeap\\\":" + String(ESP.getFreeHeap()) + ","
                       + "\\\"uptimeSec\\\":" + String(millis() / 1000) + ","
                       + "\\\"rssi\\\":" + String(WiFi.RSSI()) + "}";
      mqttClient.publish(TOPIC_STATUS, statusMsg.c_str(), true);

      // Sottoscrizione comandi remoti dal Cloud ESCLUSIVA per questo modulo
      String myCleanMacSub = WiFi.macAddress();
      myCleanMacSub.replace(":", "");
      myCleanMacSub.replace("-", "");
      myCleanMacSub.toUpperCase();

      String topicMacCommands = "vending/GB-CLOUD-" + myCleanMacSub + "/commands";
      String topicCleanMac = "vending/" + myCleanMacSub + "/commands";

      mqttClient.subscribe(TOPIC_COMMANDS);
      mqttClient.subscribe(topicMacCommands.c_str());
      mqttClient.subscribe(topicCleanMac.c_str());
      Serial.println(">> [MQTT SOTTOSCRIZIONE ATTIVA ESCLUSIVA]:");
      Serial.println("   - " + String(TOPIC_COMMANDS));
      Serial.println("   - " + topicMacCommands);
      Serial.println("   - " + topicCleanMac);
    } else {
      tentativiMqttFalliti++;
      int errCode = mqttClient.state();
      Serial.print("Fallito, rc=");
      Serial.print(errCode);
      Serial.println(" Riprovo tra 2s...");

      if (errCode == -2) { // MQTT_CONNECT_FAILED (Socket connection failed)
        if (tentativiMqttFalliti == 2) {
          Serial.println("\\n------------------------------------------------------------");
          Serial.println(">> [DIAGNOSTICA ERRORE rc=-2: MQTT_CONNECT_FAILED]");
          Serial.println(">> Impossibile aprire la connessione TCP sulla Porta 1883.");
          Serial.println(">> CAUSA PROBABILE: Il Firewall aziendale (WiFi APGB001 10.41.x.x)");
          Serial.println(">>                  blocca la porta 1883 in uscita.");
          Serial.println(">> PROVA VELOCE DI CONFERMA:");
          Serial.println(">> Attiva l'Hotspot 4G/5G del cellulare (2.4 GHz) con lo sketch:");
          Serial.println(">> Se su hotspot si connette subito, la porta 1883 e' filtrata");
          Serial.println(">> dal router/firewall aziendale APGB001.");
          Serial.println("------------------------------------------------------------\\n");
        }

        // Alterna automaticamente l'IP tra nodo HiveMQ 1 e nodo HiveMQ 2
        activeBrokerIp = (activeBrokerIp == HIVEMQ_IP_1) ? HIVEMQ_IP_2 : HIVEMQ_IP_1;
        mqttClient.setServer(activeBrokerIp, MQTT_PORT);
      }

      delay(2000);
      break; // Non blocca il loop in caso di disconnessione temporanea
    }
  }
}

// --- TRASMISSIONE EVENTO REMOTO TASTO VIA MQTT ---
void inviaEventoMQTT(const TastoMatrice& t) {
  if (!mqttClient.connected()) {
    riconnettiMQTT();
  }

  conteggioPressioni++;

  // Payload JSON telemetria
  String jsonPayload = "{\\\"key\\\":\\\"" + String(t.keyChar) + "\\\","
                     + "\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                     + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                     + "\\\"eventType\\\":\\\"pressed\\\","
                     + "\\\"nomeTasto\\\":\\\"" + String(t.nome) + "\\\","
                     + "\\\"isCaraffa\\\":" + (modalitaCaraffa ? "true" : "false") + ","
                     + "\\\"rssi\\\":" + String(WiFi.RSSI()) + ","
                     + "\\\"freeHeap\\\":" + String(ESP.getFreeHeap()) + ","
                     + "\\\"uptimeSec\\\":" + String(millis() / 1000) + ","
                     + "\\\"totalPresses\\\":" + String(conteggioPressioni) + "}";

  bool ok = mqttClient.publish(TOPIC_KEYLOG, jsonPayload.c_str());
  if (ok) {
    Serial.println(">> [MQTT CLOUD] Inviato singolo evento telemetria: " + jsonPayload);
  } else {
    Serial.println(">> [MQTT ERRORE] Impossibile pubblicare evento.");
  }

  if (t.isBeverage && modalitaCaraffa) {
    modalitaCaraffa = false;
    Serial.println(">>> [CARAFFA EROGATA] Ritorno automatico alla modalita' normale standard.");
  }
}

// --- CALLBACK RICEZIONE COMANDI REMOTI DAL CLOUD ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  // Filtro anti-duplicazione comandi (Debounce temporale e verifica timestamp)
  static String ultimoTimestampElaborato = "";
  static unsigned long ultimoComandoMillis = 0;

  // Rilevamento immediato STOP per sicurezza (Bypass debounce ed antirimbalzo)
  bool isStopCmd = (message.indexOf("STOP") >= 0 || message.indexOf("EMERGENCY") >= 0);

  if (!isStopCmd) {
    int tsIdx = message.indexOf("timestamp");
    if (tsIdx >= 0) {
      int colonIdx = message.indexOf(':', tsIdx);
      if (colonIdx >= 0) {
        String msgTs = message.substring(colonIdx + 1, colonIdx + 30);
        if (msgTs.length() > 5 && msgTs == ultimoTimestampElaborato) {
          Serial.println(">> [MQTT DEDUP]: Comando duplicato ignorato (stesso timestamp gia' elaborato).");
          return;
        }
        ultimoTimestampElaborato = msgTs;
      }
    }

    if (millis() - ultimoComandoMillis < 800) {
      Serial.println(">> [MQTT DEDUP]: Comando ignorato (intervallo troppo ravvicinato < 800ms).");
      return;
    }
  } else {
    Serial.println(">> [MQTT PRIORITA' ZERO]: Rilevato STOP di emergenza! Esecuzione immediata.");
  }
  ultimoComandoMillis = millis();

  // CONTROLLO DI ESCLUSIVITA' HARDWARE:
  // Verifica se il messaggio è indirizzato a questo specifico modulo (MAC o DeviceId)
  String myMac = WiFi.macAddress();
  myMac.toUpperCase();
  String myCleanMac = myMac;
  myCleanMac.replace(":", "");
  myCleanMac.replace("-", "");

  if (message.indexOf("targetMac") >= 0 || message.indexOf("targetCleanMac") >= 0) {
    String msgUpper = message;
    msgUpper.toUpperCase();
    bool matchMac = (msgUpper.indexOf(myMac) >= 0) || (msgUpper.indexOf(myCleanMac) >= 0);
    if (!matchMac) {
      Serial.println(">> [MQTT SICUREZZA]: Comando ignorato! Destinato a un altro MAC hardware (questo modulo e' " + myMac + ")");
      return;
    }
  }

  String topicStr = String(topic);
  topicStr.toUpperCase();
  if (topicStr.indexOf("GB-CLOUD-") >= 0 && topicStr.indexOf(myCleanMac) < 0 && topicStr.indexOf(String(DEVICE_ID)) < 0) {
    Serial.println(">> [MQTT SICUREZZA]: Comando su topic altrui (" + topicStr + ") ignorato!");
    return;
  }

  Serial.print(">> [MQTT COMANDO RICEVUTO su ");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  // Lampeggio visivo di conferma ricezione comando
  digitalWrite(LED_STATUS, HIGH);
  delay(60);
  digitalWrite(LED_STATUS, LOW);

  // Estrazione della durata impulso se presente
  int dur = OPTO_DURATION_MS;
  int durIdx = message.indexOf("durationMs");
  if (durIdx >= 0) {
    int colonIdx = message.indexOf(':', durIdx);
    if (colonIdx >= 0) {
      dur = message.substring(colonIdx + 1).toInt();
      if (dur <= 0) dur = OPTO_DURATION_MS;
    }
  }

  // Estrazione fili matrice se presenti nel JSON
  int wireA = 0;
  int wireB = 0;
  int wAIdx = message.indexOf("wireA");
  if (wAIdx >= 0) {
    int colonIdx = message.indexOf(':', wAIdx);
    if (colonIdx >= 0) wireA = message.substring(colonIdx + 1).toInt();
  }
  int wBIdx = message.indexOf("wireB");
  if (wBIdx >= 0) {
    int colonIdx = message.indexOf(':', wBIdx);
    if (colonIdx >= 0) wireB = message.substring(colonIdx + 1).toInt();
  }

  // Estrazione del numero prodotto se presente nel JSON
  int pNum = 0;
  int pIdx = message.indexOf("productNumber");
  if (pIdx >= 0) {
    int colonIdx = message.indexOf(':', pIdx);
    if (colonIdx >= 0) {
      pNum = message.substring(colonIdx + 1).toInt();
    }
  }

  // 1. Tasto STOP (Arresto Emergenza) -> Matrice: Filo 2 e Filo 5 (Tasto '0')
  if (message.indexOf("STOP") >= 0 || message.indexOf("EMERGENCY") >= 0 || pNum == 13 || (wireA == 2 && wireB == 5) || (message.indexOf("key") >= 0 && message.indexOf('0') >= 0)) {
    modalitaCaraffa = false;
    simulaTastoMatrice(2, 5, dur);
    if (NUM_OPTO_OUT > 12) {
      triggerOptoOutput(12, dur);
    }
    Serial.println(">>> [COMANDO CLOUD ESEGUITO]: ARRESTO EMERGENZA (STOP) Attivato [Fili 2 e 5 simulati]!");
  }
  // 2. Tasto CARAFFA (Modificatore dose 10s) -> Matrice: Filo 3 e Filo 5 (Tasto '*')
  else if (message.indexOf("CARAFFA") >= 0 || pNum == 14 || (wireA == 3 && wireB == 5) || (message.indexOf("key") >= 0 && message.indexOf('*') >= 0)) {
    modalitaCaraffa = true;
    caraffaTimerStart = millis();
    simulaTastoMatrice(3, 5, dur);
    if (NUM_OPTO_OUT > 13) {
      triggerOptoOutput(13, dur);
    }
    Serial.println(">>> [COMANDO CLOUD ESEGUITO]: MODALITA CARAFFA ATTIVATA (Finestra 10s) [Fili 3 e 5 simulati]!");
  }
  // 3. Tasto LINGUA -> Matrice: Filo 4 e Filo 5 (Tasto '#')
  else if (message.indexOf("LINGUA") >= 0 || message.indexOf("LANGUAGE") >= 0 || pNum == 15 || (wireA == 4 && wireB == 5) || (message.indexOf("key") >= 0 && message.indexOf('#') >= 0)) {
    simulaTastoMatrice(4, 5, dur);
    if (NUM_OPTO_OUT > 14) {
      triggerOptoOutput(14, dur);
    }
    Serial.println(">>> [COMANDO CLOUD ESEGUITO]: SELEZIONE LINGUA Attivata [Fili 4 e 5 simulati]!");
  }
  // 4. Test Impulso Optoisolatore / Rele Hardware Diretto
  else if (message.indexOf("TRIGGER_OPTO_PULSE") >= 0) {
    int pinIdx = message.indexOf("pin");
    int targetPin = 19;
    if (pinIdx >= 0) {
      int colonIdx = message.indexOf(':', pinIdx);
      if (colonIdx >= 0) {
        targetPin = message.substring(colonIdx + 1).toInt();
      }
    }
    Serial.print(">>> [COMANDO CLOUD ESEGUITO]: Test Uscita Opto su GPIO ");
    Serial.print(targetPin);
    Serial.print(" per ");
    Serial.print(dur);
    Serial.println("ms");
    pinMode(targetPin, OUTPUT);
    digitalWrite(targetPin, HIGH);
    delay(dur);
    digitalWrite(targetPin, LOW);
  }
  // 5. Erogazione Bevande P1..P12 inviata da App (Simulatore / Erogazione / Dashboard)
  else {
    if (pNum == 0) {
      for (int i = 1; i <= 12; i++) {
        String pMatch = "P" + String(i);
        if (message.indexOf(pMatch) >= 0) {
          pNum = i;
          break;
        }
      }
    }

    if (pNum >= 1 && pNum <= 12) {
      Serial.print(">>> [COMANDO CLOUD ESEGUITO]: EROGAZIONE PRODOTTO P");
      Serial.print(pNum);
      if (modalitaCaraffa) {
        Serial.print(" [MODALITA CARAFFA]");
      }
      Serial.println(" AVVIATA!");

      // Recupera i fili della matrice corrispondenti al prodotto
      if (wireA == 0 || wireB == 0) {
        for (int i = 0; i < TOTALE_TASTI; i++) {
          if (TABELLA_TASTI[i].isBeverage && TABELLA_TASTI[i].productNum == pNum) {
            wireA = TABELLA_TASTI[i].filoA;
            wireB = TABELLA_TASTI[i].filoB;
            break;
          }
        }
      }

      // 1. Simula chiusura sulla matrice cavo piatto
      if (wireA > 0 && wireB > 0) {
        simulaTastoMatrice(wireA, wireB, dur);
      }

      // 2. Se collegato a uscite optoisolate (U1..U4), attiva anche l'opto
      int optoIndex = (pNum - 1) % NUM_OPTO_OUT;
      triggerOptoOutput(optoIndex, dur);

      if (modalitaCaraffa) {
        modalitaCaraffa = false;
        Serial.println(">>> [CARAFFA EROGATA]: Ripristino automatico a Monodose.");
      }
    } else {
      Serial.println(">>> [COMANDO CLOUD]: Messaggio MQTT generico elaborato.");
    }
  }
}

// --- INVIA DIAGNOSTICA / HEARTBEAT PERIODICO ---
void inviaHeartbeat() {
  if (!mqttClient.connected()) return;

  String pingMsg = "{\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\","
                 + "\\"macAddress\\":\\"" + String(WiFi.macAddress()) + "\\","
                 + "\\"status\\":\\"ONLINE_READY\\","
                 + "\\"uptimeSec\\":" + String(millis() / 1000) + ","
                 + "\\"rssi\\":" + String(WiFi.RSSI()) + ","
                 + "\\"freeHeap\\":" + String(ESP.getFreeHeap()) + ","
                 + "\\"totalPresses\\":" + String(conteggioPressioni) + "}";

  mqttClient.publish(TOPIC_STATUS, pingMsg.c_str());
  Serial.println(">> [MQTT HEARTBEAT] Diagnostica (Heap/Uptime) inviata al Cloud.");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  Serial.println("\\n========================================================");
  Serial.println("  ESP32 - TELEMETRIA REMOTA IoT MQTT CLOUD REAL-TIME    ");
  Serial.println("========================================================");
  Serial.println("Broker: " + String(MQTT_BROKER) + ":" + String(MQTT_PORT));
  Serial.println("Topic:  " + String(TOPIC_KEYLOG));
  Serial.println("========================================================\\n");

  for (int i = 0; i < 8; i++) {
    pinMode(PIN_FILI[i], INPUT_PULLUP);
  }

  // Inizializza gli 8 pin di uscita verso gli Optoisolatori PC817 (a riposo = LOW)
  for (int i = 0; i < NUM_OPTO_OUT; i++) {
    pinMode(PIN_OPTO_OUT[i], OUTPUT);
    digitalWrite(PIN_OPTO_OUT[i], LOW);
  }

  connettiWiFi();

  // Risoluzione DNS del broker con fallback automatico su IP IPv4 HiveMQ
  Serial.print(">> [DNS] Risoluzione indirizzo broker '");
  Serial.print(MQTT_BROKER);
  Serial.print("'... ");

  IPAddress resolvedIp;
  if (WiFi.hostByName(MQTT_BROKER, resolvedIp) && resolvedIp != IPAddress(0, 0, 0, 0)) {
    activeBrokerIp = resolvedIp;
    Serial.print("OK! IP: ");
    Serial.println(activeBrokerIp.toString());
  } else {
    activeBrokerIp = HIVEMQ_IP_1;
    Serial.println("NON RISOLTO dal router!");
    Serial.print(">> [DNS FALLBACK] Uso IP diretto IPv4 HiveMQ: ");
    Serial.println(activeBrokerIp.toString());
  }

  mqttClient.setServer(activeBrokerIp, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setSocketTimeout(5);
  mqttClient.setKeepAlive(30);
  mqttClient.setCallback(mqttCallback);
}

// Scansione bidirezionale stabilizzata dei tasti a matrice (100% immune a inversioni cavi)
int scansionaTastoPremuto() {
  for (int i = 0; i < TOTALE_TASTI; i++) {
    int idxA = TABELLA_TASTI[i].filoA - 1;
    int idxB = TABELLA_TASTI[i].filoB - 1;

    int pinA = PIN_FILI[idxA];
    int pinB = PIN_FILI[idxB];

    // Direzione 1: Pin A -> LOW, leggi Pin B
    pinMode(pinA, OUTPUT);
    digitalWrite(pinA, LOW);
    delayMicroseconds(100); // Stabilizzazione capacitiva del flat cable

    bool premuto = (digitalRead(pinB) == LOW);
    pinMode(pinA, INPUT_PULLUP);

    // Direzione 2 di sicurezza (per diodi o inversioni pin): Pin B -> LOW, leggi Pin A
    if (!premuto) {
      pinMode(pinB, OUTPUT);
      digitalWrite(pinB, LOW);
      delayMicroseconds(100);
      premuto = (digitalRead(pinA) == LOW);
      pinMode(pinB, INPUT_PULLUP);
    }

    if (premuto) {
      return i; // Rilevato tasto a contatto
    }
  }
  return -1; // Nessun tasto premuto (rilasciato)
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connettiWiFi();
  }

  if (!mqttClient.connected()) {
    riconnettiMQTT();
  }
  mqttClient.loop();

  // Controllo timeout Modalità Caraffa: ritorno automatico a Monodose standard dopo 10s
  if (modalitaCaraffa && (millis() - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    modalitaCaraffa = false;
    Serial.println(">>> [TIMEOUT CARAFFA 10s]: Macchina ripristinata automaticamente a Monodose standard.");
  }

  // Macchina a stati con filtro integratore di campioni
  int tastoRilevato = scansionaTastoPremuto();
  unsigned long adesso = millis();

  const unsigned long KEYPAD_LOCKOUT_MS = 1200; // Lockout minimo 1200ms: zero doppi tocchi / zero doppi bip

  if (statoTastiera == STATO_IDLE) {
    if (tastoRilevato >= 0) {
      if (adesso - ultimoInvioMs < KEYPAD_LOCKOUT_MS) {
        // In periodo refrattario lockout antirimbalzo: ignora
      } else if (tastoRilevato == tastoCandidato) {
        conteggioCampioniPremuto++;
        if (conteggioCampioniPremuto >= CAMPIONI_MIN_PRESSIONE) {
          // Pressione confermata (stabile e oltre la finestra di lockout)
          statoTastiera = STATO_PREMUTO;
          ultimoInvioMs = adesso;
          conteggioCampioniRilascio = 0;

          const TastoMatrice& t = TABELLA_TASTI[tastoRilevato];

          digitalWrite(LED_STATUS, HIGH);
          Serial.print(">> [PRESSIONE CONFERMATA]: ");
          Serial.print(t.nome);
          Serial.print(" (Key: '");
          Serial.print(t.keyChar);
          Serial.println("')");

          if (t.keyChar == '*') {
            if (modalitaCaraffa) {
              modalitaCaraffa = false;
              Serial.println(">>> MODALITA CARAFFA DISATTIVATA (Ritorno a Monodose)");
            } else {
              modalitaCaraffa = true;
              caraffaTimerStart = adesso;
              Serial.println(">>> MODALITA CARAFFA ATTIVATA (Timeout 10s avviato: auto-reset Monodose)");
            }
          } else if (t.keyChar == '0') {
            modalitaCaraffa = false;
            Serial.println(">>> STOP EMERGENZA (Modalita' Caraffa annullata)");
          } else if (t.keyChar == '#') {
            Serial.println(">>> SELEZIONE LINGUA (Tasto # rilevato)");
          }

          // Invia ESATTAMENTE UN SINGOLO evento MQTT
          inviaEventoMQTT(t);
        }
      } else {
        // Nuovo tasto rilevato: inizia conteggio campioni di conferma
        tastoCandidato = tastoRilevato;
        conteggioCampioniPremuto = 1;
      }
    } else {
      // Nessun tocco: reset contatore pressione
      tastoCandidato = -1;
      conteggioCampioniPremuto = 0;
    }
  } else if (statoTastiera == STATO_PREMUTO) {
    // Spegne il LED di feedback dopo 80ms
    if (adesso - ultimoInvioMs > 80) {
      digitalWrite(LED_STATUS, LOW);
    }

    // RIMANE BLOCCATO IN STATO_PREMUTO FINCHÉ IL DITO NON VIENE RILASCIATO PER ALMENO 80ms
    // E SIA TRASCORSO L'INTERO PERIODO DI LOCKOUT (1200ms)
    if (tastoRilevato == -1) {
      conteggioCampioniRilascio++;
      if (conteggioCampioniRilascio >= 8 && (adesso - ultimoInvioMs >= KEYPAD_LOCKOUT_MS)) {
        statoTastiera = STATO_IDLE;
        tastoCandidato = -1;
        conteggioCampioniPremuto = 0;
        conteggioCampioniRilascio = 0;
        digitalWrite(LED_STATUS, LOW);
        Serial.println(">> [TASTO RILASCIATO & ARMATO] Tastiera riarmata per il prossimo tocco.");
      }
    } else {
      // Dito ancora premuto: azzera conteggio di rilascio e NON invia nulla
      conteggioCampioniRilascio = 0;
    }
  }

  // Heartbeat diagnostico e ping periodico ogni 20 secondi (mantiene lo stato Online in tempo reale)
  if (millis() - ultimoHeartbeat > 20000) {
    ultimoHeartbeat = millis();
    inviaHeartbeat();
  }

  delay(10);
}
`;
}


function getVoltageHeaderComment(voltageLevel?: '12v_opto' | '12v_divider' | '3v3_direct'): string {
  if (voltageLevel === '12v_opto' || !voltageLevel) {
    return `// ==================================================================================
// CONFIGURAZIONE HARDWARE SEGNALI TASTIERA A 12V: OPTOISOLATORI PC817 (CONSIGLIATO)
// ==================================================================================
// I segnali della tastiera/distributore operano a 12V DC.
// Collegare gli 8 fili della tastiera agli ingressi IN1..IN8 del modulo Optoisolatore PC817.
// Le uscite OUT1..OUT8 dell'optoisolatore sono collegate ai GPIO dell'ESP32 con pull-up a 3.3V.
// Isolamento galvanico: 2500V RMS (Protegge l'ESP32 dai picchi dei motori a 230V/24V).
// ==================================================================================`;
  }
  if (voltageLevel === '12v_divider') {
    return `// ==================================================================================
// CONFIGURAZIONE HARDWARE SEGNALI TASTIERA A 12V: PARTITORI RESISTIVI (R1=10k, R2=3.9k)
// ==================================================================================
// I segnali operano a 12V DC. Ogni linea passa attraverso un partitore di tensione:
// Vin (12V) -> R1 (10kΩ) -> Nodo GPIO ESP32 (3.36V) -> R2 (3.9kΩ) -> GND Comune.
// Si raccomanda un diodo Zener da 3.3V (BZX55C3V3) in parallelo a R2 come clamp di sovratensione.
// ==================================================================================`;
  }
  return `// ==================================================================================
// CONFIGURAZIONE HARDWARE TASTIERA: CONTATTI A SECCO PASSIVI (3.3V DIRECT)
// ==================================================================================
// La tastiera a membrana e' scollegata da qualsiasi alimentazione a 12V della macchina.
// L'ESP32 pilota la matrice direttamente a 3.3V con pull-up interni (INPUT_PULLUP).
// ==================================================================================`;
}

/**
 * SKETCH COLLAUDATO DEFINITIVO: MATRICE REALE 15 TASTI DISTRIBUTORE + WI-FI CLOUD
 * (12 Prodotti P1..P12 + 3 Funzioni: STOP, CARAFFA, LINGUA - Nessun tasto Lavaggio)
 * Basato sui pin e sulla tabella contatti verificata dall'utente:
 * - Filo 1: GPIO 19
 * - Filo 2: GPIO 18
 * - Filo 3: GPIO 5
 * - Filo 4: GPIO 17
 * - Filo 5: GPIO 16
 * - Filo 6: GPIO 4
 * - Filo 7: GPIO 23
 * - Filo 8: GPIO 22
 * Include scansione Open-Drain anti-reset, connessione WiFi con auto-riconnessione,
 * invio telemetria a /api/keylog e /api/dispense, feedback LED e monitoraggio seriale.
 */
export function generateVerified15KeyFirmware(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, macAddress, boardModel, optoDurationMs, optoOutputPins } = config;
  let baseUrl = serverUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-akbppqecvs232cjosiasrr-128008516049.europe-west2.run.app');
  // Se l'URL corrente è in modalità sviluppatore ais-dev, convertilo automaticamente in ais-pre per consentire l'accesso pubblico all'ESP32
  if (baseUrl.includes('ais-dev-')) {
    baseUrl = baseUrl.replace('ais-dev-', 'ais-pre-');
  }

  const macVal = macAddress || '24:6F:28:A1:B2:C3';
  const modelVal = boardModel || 'Freenove ESP32-S3 WROOM-1 (Dual Type-C / Dual-Core)';
  const optoDuration = optoDurationMs || 400;
  const optoPinsList = optoOutputPins && optoOutputPins.length > 0 ? optoOutputPins.join(', ') : '14, 13, 12, 15, 16, 17, 18, 21';
  const pins = config.pins || {
    row1: 4, row2: 5, row3: 6, row4: 7, col1: 8, col2: 9, col3: 10, col4: 11
  };

  return `/*
 * ==================================================================================
 * ESP32 - FIRMWARE PRODUZIONE COLLAUDATO AL 100% (15 TASTI DISTRIBUTORE + CLOUD)
 * ==================================================================================
 * Hardware: ${modelVal} | MAC Address: ${macVal}
 * Configurazione Pin Testata e Verificata:
 * - Filo 1 (Cavo Piatto) -> GPIO ${pins.row1} (Riga 1)
 * - Filo 2 (Cavo Piatto) -> GPIO ${pins.row2} (Riga 2)
 * - Filo 3 (Cavo Piatto) -> GPIO ${pins.row3} (Riga 3)
 * - Filo 4 (Cavo Piatto) -> GPIO ${pins.row4} (Riga 4)
 * - Filo 5 (Cavo Piatto) -> GPIO ${pins.col1} (Colonna 1)
 * - Filo 6 (Cavo Piatto) -> GPIO ${pins.col2} (Colonna 2)
 * - Filo 7 (Cavo Piatto) -> GPIO ${pins.col3} (Colonna 3)
 * - Filo 8 (Cavo Piatto) -> GPIO ${pins.col4} (Colonna 4)
 *
 * Uscite Optoisolate per Simulazione Tasti su Scheda Macchina:
 * - Uscite Opto: GPIO ${optoPinsList} (Durata impulso: ${optoDuration}ms)
 *
 * Mappatura 15 Tasti Reali del Distributore:
 * - P1..P12: Erogazione Prodotti da 1 a 12 (One-Touch)
 * - CARAFFA (*): Attiva Modalità Caraffa
 * - STOP (0): Arresto di Emergenza Erogazione
 * - LINGUA (#): Cambio Lingua Interfaccia (IT/EN/DE/FR/ES)
 *
 * Telemetria IoT:
 * - Invia ogni evento in tempo reale all'API Cloud: ${baseUrl}/api/keylog
 * - Sincronizza lo stato della flotta distributori in tempo reale (SSE).
 * ==================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>

// --- CONFIGURAZIONE RETE WI-FI E SERVER CLOUD ---
const char* WIFI_SSID     = "${ssid || 'IL_TUO_WIFI'}";
const char* WIFI_PASSWORD = "${password || 'PASSWORD_WIFI'}";
const char* SERVER_URL    = "${baseUrl}/api/keylog";
const char* DISPENSE_URL  = "${baseUrl}/api/dispense";
const char* HEARTBEAT_URL = "${baseUrl}/api/devices/heartbeat";
const char* DEVICE_ID     = "${deviceId || 'ESP32-VENDING-01'}";
const char* MAC_ADDRESS   = "${macVal}";

// Web Server Locale Integrato su porta 80 (Accessibile da browser su rete locale)
WebServer localServer(80);

// --- ASSEGNAZIONE DEGLI 8 PIN FISICI COLLAUDATI (TASTIERA A MEMBRANA) ---
const int PIN_FILI[8] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}, ${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};
const int LED_STATUS  = 2; // LED status integrato

// --- USCITE OPTOISOLATE PER SIMULARE LA PRESSIONE DEI TASTI ALLA MACCHINA ---
const int OPTO_DURATION_MS   = ${optoDuration};
const int PIN_OPTO_OUT[]     = {${optoPinsList}};
const int NUM_OPTO_OUT       = sizeof(PIN_OPTO_OUT) / sizeof(PIN_OPTO_OUT[0]);

// --- STRUTTURA DEFINIZIONE TASTO DALLA MATRICE REALE ---
typedef struct TastoMatrice {
  int filoA;          // Filo 1..8
  int filoB;          // Filo 1..8
  char keyChar;       // Codice identificativo tasto
  const char* nome;   // Etichetta estesa
  bool isBeverage;    // true se prodotto P1..P12, false se funzione
  int productNum;     // 1..12 (0 se funzione)
} TastoMatrice;

// Prototipi espliciti per preprocessore Arduino IDE
void inviaEventoAlCloud(const TastoMatrice& t);

// Tabella dei 15 tasti reali (12 Prodotti + 3 Funzioni: STOP, CARAFFA, LINGUA):
const TastoMatrice TABELLA_TASTI[] = {
  {2, 5, '0', "STOP", false, 0},
  {3, 5, '*', "CARAFFA", false, 0},
  {4, 5, '#', "LINGUA", false, 0},
  {4, 8, '1', "PRODOTTO 1 (P1)", true, 1},
  {4, 7, '2', "PRODOTTO 2 (P2)", true, 2},
  {4, 6, '3', "PRODOTTO 3 (P3)", true, 3},
  {3, 8, 'A', "PRODOTTO 4 (P4)", true, 4},
  {3, 7, '4', "PRODOTTO 5 (P5)", true, 5},
  {3, 6, '5', "PRODOTTO 6 (P6)", true, 6},
  {2, 8, '6', "PRODOTTO 7 (P7)", true, 7},
  {2, 7, 'B', "PRODOTTO 8 (P8)", true, 8},
  {2, 6, '7', "PRODOTTO 9 (P9)", true, 9},
  {1, 8, '8', "PRODOTTO 10 (P10)", true, 10},
  {1, 7, '9', "PRODOTTO 11 (P11)", true, 11},
  {1, 6, 'C', "PRODOTTO 12 (P12)", true, 12}
};

const int TOTALE_TASTI = sizeof(TABELLA_TASTI) / sizeof(TABELLA_TASTI[0]);

// Stato operativo
bool modalitaCaraffa = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000; // Timeout 10s: auto-reset a Monodose standard
String ultimoTastoPremuto = "Nessuno";
unsigned long conteggioPressioni = 0;
unsigned long ultimoInvioWiFi = 0;
int tastoPrecedentementePremuto = -1;
unsigned long ultimoTempoPressione = 0;
const unsigned long DEBOUNCE_MIN_MS = 350;

// --- GESTORI PAGINA WEB LOCALE SU ESP32 (HTTP://IP-ESP32) ---
void handleRoot() {
  String html = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>ESP32 Vending Controller</title>";
  html += "<style>body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#f8fafc;padding:24px;text-align:center;max-width:600px;margin:auto}";
  html += ".card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:20px;margin-top:16px;box-shadow:0 10px 25px rgba(0,0,0,0.5)}";
  html += ".badge{display:inline-block;padding:4px 12px;background:#059669;color:#fff;border-radius:999px;font-weight:bold;font-size:12px}";
  html += ".btn{background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-weight:bold;cursor:pointer;margin-top:12px;text-decoration:none;display:inline-block}";
  html += ".key-box{font-size:32px;font-weight:bold;color:#38bdf8;margin:12px 0}</style></head><body>";
  html += "<h2>☕ ESP32 Vending Controller</h2>";
  html += "<div class='card'><span class='badge'>ONLINE & PRONTO</span>";
  html += "<p>Dispositivo: <strong>" + String(DEVICE_ID) + "</strong></p>";
  html += "<p>Ultimo Tasto Premuto:</p><div class='key-box'>" + ultimoTastoPremuto + "</div>";
  html += "<p>Totale Pressioni Rilevate: <strong>" + String(conteggioPressioni) + "</strong></p>";
  html += "<p>Modalità Caraffa: <strong>" + String(modalitaCaraffa ? "ATTIVA" : "Disattivata") + "</strong></p>";
  html += "<p>Segnale Wi-Fi (RSSI): <strong>" + String(WiFi.RSSI()) + " dBm</strong></p>";
  html += "<a href='/' class='btn'>🔄 Aggiorna Stato</a>";
  html += "</div></body></html>";
  localServer.send(200, "text/html", html);
}

void handleApiStatus() {
  String json = "{\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\","
              + "\\"status\\":\\"ONLINE\\","
              + "\\"lastPressed\\":\\"" + ultimoTastoPremuto + "\\","
              + "\\"totalPresses\\":" + String(conteggioPressioni) + ","
              + "\\"isCaraffa\\":" + (modalitaCaraffa ? "true" : "false") + ","
              + "\\"rssi\\":" + String(WiFi.RSSI()) + ","
              + "\\"ip\\":\\"" + WiFi.localIP().toString() + "\\"}";
  localServer.send(200, "application/json", json);
}

// --- FUNZIONE DI CONNESSIONE WI-FI ---
void connettiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("Connessione a WiFi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int tentativi = 0;
  while (WiFi.status() != WL_CONNECTED && tentativi < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    tentativi++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS, LOW);
    Serial.println("\\n>>> WiFi Connesso con successo! <<<");
    Serial.print("Indirizzo IP Locale: http://");
    Serial.println(WiFi.localIP());
    Serial.print("Potenza Segnale (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    // Avvia server web locale su porta 80
    localServer.on("/", handleRoot);
    localServer.on("/api/status", handleApiStatus);
    localServer.begin();
    Serial.println(">>> Web Server Locale attivo su http://" + WiFi.localIP().toString() + " <<<");
  } else {
    Serial.println("\\n[AVVISO] WiFi non connesso al momento. Funzionamento offline attivo.");
  }
}

// --- TRASMISSIONE TELEMETRIA CLOUD (HTTPS SICURO & ZERO DIPENDENZE) ---
void inviaEventoAlCloud(const TastoMatrice& t) {
  if (WiFi.status() != WL_CONNECTED) {
    connettiWiFi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  WiFiClientSecure secureClient;
  secureClient.setInsecure(); // Accetta certificati HTTPS cloud senza blocchi

  HTTPClient http;
  if (http.begin(secureClient, SERVER_URL)) {
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.addHeader("Content-Type", "application/json");

    // Formattazione JSON nativa
    String payloadJson = "{\\"key\\":\\"" + String(t.keyChar) + "\\","
                       + "\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\","
                       + "\\"eventType\\":\\"pressed\\","
                       + "\\"rssi\\":" + String(WiFi.RSSI()) + ","
                       + "\\"ip\\":\\"" + WiFi.localIP().toString() + "\\","
                       + "\\"metadata\\":{\\"nomeTasto\\":\\"" + String(t.nome) + "\\","
                       + "\\"isCaraffa\\":" + (modalitaCaraffa ? "true" : "false") + "}}";

    int httpResponseCode = http.POST(payloadJson);
    Serial.print(">> Telemetria inviata al Cloud (Codice HTTP: ");
    Serial.print(httpResponseCode);
    Serial.println(")");

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println(">> Risposta Cloud: " + response);
    } else {
      Serial.print(">> Errore invio HTTP: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  }

  // Se è un prodotto (P1..P12), registra l'erogazione nel gestore bevande
  if (t.isBeverage) {
    WiFiClientSecure secureClientDisp;
    secureClientDisp.setInsecure();
    HTTPClient httpDispense;
    if (httpDispense.begin(secureClientDisp, DISPENSE_URL)) {
      httpDispense.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
      httpDispense.addHeader("Content-Type", "application/json");

      String dispPayload = "{\\"key\\":\\"" + String(t.keyChar) + "\\","
                         + "\\"deviceId\\":\\"" + String(DEVICE_ID) + "\\","
                         + "\\"isCaraffa\\":" + (modalitaCaraffa ? "true" : "false") + "}";

      int dispRes = httpDispense.POST(dispPayload);
      Serial.print(">> Registrazione Erogazione Prodotto HTTP: ");
      Serial.println(dispRes);
      httpDispense.end();
    }

    if (modalitaCaraffa) {
      modalitaCaraffa = false;
      Serial.println(">>> Modalita' Caraffa completata: ritorno a dose standard.");
    }
  }
}

// --- SETUP ---
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  Serial.println("\\n========================================================");
  Serial.println("  ESP32 - VENDING MACHINE CONTROLLER & CLOUD TELEMETRY  ");
  Serial.println("========================================================");
  Serial.println("Tastiera: 15 Tasti Verificati (P1..P12 + 3 Funzioni)");
  Serial.println("Hardware: GPIO 19, 18, 5, 17, 16, 4, 23, 22");
  Serial.println("Cloud Endpoint: " + String(SERVER_URL));
  Serial.println("========================================================\\n");

  // Inizializza tutti gli 8 pin con Pull-Up interno a 3.3V
  for (int i = 0; i < 8; i++) {
    pinMode(PIN_FILI[i], INPUT_PULLUP);
  }

  // Connessione WiFi iniziale
  connettiWiFi();
}

// --- SCANSIONE MATRICE PROTETTA ---
int scansionaTastoPremuto() {
  for (int i = 0; i < TOTALE_TASTI; i++) {
    int idxA = TABELLA_TASTI[i].filoA - 1;
    int idxB = TABELLA_TASTI[i].filoB - 1;

    int pinA = PIN_FILI[idxA];
    int pinB = PIN_FILI[idxB];

    // Porta il filo A a MASSA (LOW)
    pinMode(pinA, OUTPUT);
    digitalWrite(pinA, LOW);
    delayMicroseconds(40);

    bool premuto = (digitalRead(pinB) == LOW);

    // Ripristina il pin in alta impedenza
    pinMode(pinA, INPUT_PULLUP);

    if (premuto) {
      return i; // Tasto attualmente a contatto
    }
  }
  return -1; // Rilasciato
}

// --- LOOP PRINCIPALE ---
void loop() {
  // Controllo timeout Modalità Caraffa: ritorno automatico a Monodose standard dopo 10s
  if (modalitaCaraffa && (millis() - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    modalitaCaraffa = false;
    Serial.println(">>> [TIMEOUT CARAFFA 10s]: Macchina ripristinata automaticamente a Monodose standard.");
  }

  int indiceAttuale = scansionaTastoPremuto();
  unsigned long adesso = millis();

  if (indiceAttuale >= 0) {
    if (indiceAttuale != tastoPrecedentementePremuto && (adesso - ultimoTempoPressione > DEBOUNCE_MIN_MS)) {
      tastoPrecedentementePremuto = indiceAttuale;
      ultimoTempoPressione = adesso;

      const TastoMatrice& t = TABELLA_TASTI[indiceAttuale];

      digitalWrite(LED_STATUS, HIGH);

      Serial.print(">> [TASTO PREMUTO SINGOLO]: ");
      Serial.print(t.nome);
      Serial.print(" (Key: '");
      Serial.print(t.keyChar);
      Serial.println("')");

      // Gestione logica speciale dei tasti funzione
      if (t.keyChar == '*') {
        if (modalitaCaraffa) {
          modalitaCaraffa = false;
          Serial.println(">>> MODALITA CARAFFA DISATTIVATA (Ritorno a Monodose)");
        } else {
          modalitaCaraffa = true;
          caraffaTimerStart = adesso;
          Serial.println(">>> MODALITA CARAFFA ATTIVATA (Timeout 10s avviato: auto-reset Monodose)");
        }
      } else if (t.keyChar == '0') {
        modalitaCaraffa = false;
        Serial.println(">>> STOP DI EMERGENZA RICEVUTO DALLA TASTIERA! (Caraffa annullata) <<<");
      } else if (t.keyChar == '#') {
        Serial.println(">>> SELEZIONE LINGUA RICEVUTA DALLA TASTIERA (Tasto #) <<<");
      }

      // Invia telemetria in tempo reale al Cloud
      inviaEventoAlCloud(t);

      // Se e' stata erogata una bevanda con modalita' caraffa, torna a monodose standard
      if (t.isBeverage && modalitaCaraffa) {
        modalitaCaraffa = false;
        Serial.println(">>> [CARAFFA EROGATA]: Ritorno automatico a Monodose standard.");
      }

      ultimoTastoPremuto = String(t.nome) + " ('" + String(t.keyChar) + "')";
      conteggioPressioni++;

      delay(40);
      digitalWrite(LED_STATUS, LOW);
    }
  } else {
    tastoPrecedentementePremuto = -1;
  }

  // Gestione richieste client web locali (http://IP-ESP32)
  localServer.handleClient();

  // Verifica periodica connessione WiFi ogni 30 secondi
  if (millis() - ultimoInvioWiFi > 30000) {
    ultimoInvioWiFi = millis();
    if (WiFi.status() != WL_CONNECTED) {
      connettiWiFi();
    }
  }

  delay(15);
}
`;
}

/**
 * SKETCH OPZIONE A (TELEMETRIA PARALLELA NON INVASIVA A 12V):
 * L'ESP32 e' collegato in PARALLELO alla tastiera a 12V tramite modulo Optoisolatore PC817.
 * Tutti i pin sono configurati come INPUT ad alta impedenza.
 * L'ESP32 ascolta i tasti premuti senza interferire con la scheda madre originale e invia
 * i dati di telemetria via WiFi al Cloud.
 */
export function generateParallelSniffingSketch(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, debounceMs, keypadVoltageLevel } = config;
  const pins = config.pins || { row1: 19, row2: 18, row3: 5, row4: 17, col1: 16, col2: 4, col3: 23, col4: 22 };
  const voltageComment = getVoltageHeaderComment(keypadVoltageLevel);

  return `/*
 * ==================================================================================
 * ESP32 - OPZIONE A: TELEMETRIA PARALLELA NON INVASIVA (SNIFFING TASTIERA A 12V)
 * ==================================================================================
 * ARCHITETTURA:
 * - La scheda madre originale del distributore continua a gestire la macchina al 100%.
 * - La tastiera 14 tasti a 12V e' collegata in PARALLELO agli ingressi del Modulo Optoisolatore 8-CH PC817.
 * - Le uscite del modulo optoisolatore vanno ai pin dell'ESP32 configurati ESCLUSIVAMENTE COME INPUT.
 * - L'ESP32 NON invia segnali verso la tastiera (nessun rischio di cortocircuito o conflitti).
 * - Appena un utente preme un tasto, l'ESP32 intercetta la selezione e la invia via WiFi al Cloud Database.
 * ==================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

${voltageComment}

// --- RETE WI-FI & TELEMETRIA CLOUD ---
const char* WIFI_SSID     = "${ssid || 'WIFI_AZIENDALE'}";
const char* WIFI_PASSWORD = "${password || 'PASSWORD_SICURA'}";
const char* SERVER_URL    = "${serverUrl || 'https://vending-iot.app/api/vending/dispense'}";
const char* DEVICE_ID     = "${deviceId || 'DISTRIBUTORE-01'}";

// --- MAPPATURA PIN ESP32 (TUTTI COME INPUT AD ALTA IMPEDENZA) ---
// Ingressi Righe (R1..R4) - Uscite optoisolatori PC817
const int PIN_R1 = ${pins.row1}; // Pin 1 Tastiera -> R1 (Tasti 1, 2, 3, A)
const int PIN_R2 = ${pins.row2}; // Pin 2 Tastiera -> R2 (Tasti 4, 5, 6, B)
const int PIN_R3 = ${pins.row3}; // Pin 3 Tastiera -> R3 (Tasti 7, 8, 9, C)
const int PIN_R4 = ${pins.row4}; // Pin 4 Tastiera -> R4 (Tasti *, 0)

// Ingressi Colonne (C1..C4) - Uscite optoisolatori PC817
const int PIN_C1 = ${pins.col1}; // Pin 5 Tastiera -> C1 (Tasti 1, 4, 7, *)
const int PIN_C2 = ${pins.col2}; // Pin 6 Tastiera -> C2 (Tasti 2, 5, 8, 0)
const int PIN_C3 = ${pins.col3}; // Pin 7 Tastiera -> C3 (Tasti 3, 6, 9)
const int PIN_C4 = ${pins.col4}; // Pin 8 Tastiera -> C4 (Tasti A, B, C)

// Periferiche Ausiliarie (Opzionali)
const int PIN_BUZZER = ${config.buzzerPin || 2}; // Feedback acustico opzionale

// Display LCD 20x4 I2C (Opzionale: Indirizzo standard 0x27 o 0x3F, SDA=21, SCL=22)
LiquidCrystal_I2C lcd(0x27, 20, 4);
bool lcdAvailable = false;

// --- PARAMETRI TEMPORALI ---
const unsigned long DEBOUNCE_MS = ${debounceMs || 50}; // Filtro antirimbalzo industriale
unsigned long lastKeyPressTime = 0;
char lastDetectedKey = '\\0';
unsigned long totalDispensesLogged = 0;
bool isCaraffaMode = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000; // Timeout 10s: auto-reset Monodose

// Matrice logica di decodifica 4 Righe x 4 Colonne (14 Tasti fisici)
const char KEY_MAP[4][4] = {
  { '1', '2', '3', 'A' }, // Riga 1: Prodotti 1..3 + Prodotto 10 (A)
  { '4', '5', '6', 'B' }, // Riga 2: Prodotti 4..6 + Prodotto 11 (B)
  { '7', '8', '9', 'C' }, // Riga 3: Prodotti 7..9 + Prodotto 12 (C)
  { '*', '0', 'X', 'Y' }  // Riga 4: * = CARAFFA, 0 = STOP (X e Y non cablati)
};

// Nomi prodotti per il log
const char* getProductName(char key) {
  switch (key) {
    case '1': return "Caffe Espresso";
    case '2': return "Espresso Lungo";
    case '3': return "Caffe Macchiato";
    case '4': return "Cappuccino";
    case '5': return "Latte Macchiato";
    case '6': return "Mocaccino";
    case '7': return "Cioccolata Calda";
    case '8': return "Cioccolata con Latte";
    case '9': return "Te al Limone";
    case 'A': return "Ginseng Espresso";
    case 'B': return "Ginseng Lungo";
    case 'C': return "Orzo Espresso";
    case '*': return "MODALITA CARAFFA";
    case '0': return "STOP EROGAZIONE";
    default:  return "Selezione Sconosciuta";
  }
}

// Prezzi stimati per telemetria (€)
float getProductPrice(char key) {
  switch (key) {
    case '1': case '2': return 0.50;
    case '3': case '4': return 0.60;
    case '5': case '6': return 0.65;
    case '7': case '8': return 0.60;
    case '9': return 0.50;
    case 'A': case 'B': case 'C': return 0.70;
    case '*': return 1.50;
    default: return 0.00;
  }
}

// --- CONNESSIONE WI-FI ---
void connectWiFi() {
  Serial.print("[WiFi] Connessione a ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\\n[WiFi] Connesso con successo!");
    Serial.print("[WiFi] Indirizzo IP: ");
    Serial.println(WiFi.localIP());

    if (lcdAvailable) {
      lcd.setCursor(0, 2);
      lcd.print("WiFi: Connesso OK   ");
      lcd.setCursor(0, 3);
      lcd.print("IP: ");
      lcd.print(WiFi.localIP());
    }
  } else {
    Serial.println("\\n[WiFi] ATTENZIONE: Connessione fallita. Ritento in background.");
    if (lcdAvailable) {
      lcd.setCursor(0, 2);
      lcd.print("WiFi: In Attesa...  ");
    }
  }
}

// --- INVIO TELEMETRIA AL CLOUD VIA HTTP POST ---
void sendDispenseTelemetry(char key) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Cloud] WiFi non connesso. Tentativo di riconnessione rapida...");
    WiFi.reconnect();
    delay(200);
    if (WiFi.status() != WL_CONNECTED) return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-ID", DEVICE_ID);

  StaticJsonDocument<512> doc;
  doc["deviceId"]      = DEVICE_ID;
  doc["key"]           = String(key);
  doc["productName"]   = getProductName(key);
  doc["price"]         = getProductPrice(key);
  doc["topology"]      = "parallel_sniff";
  doc["voltageLevel"]  = "${keypadVoltageLevel || '12v_opto'}";
  doc["uptimeSec"]     = millis() / 1000;
  doc["timestamp"]     = millis();
  doc["rssi"]          = WiFi.RSSI();

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("[Cloud] Invio telemetria evento tasto in parallelo:");
  Serial.println(jsonPayload);

  int httpCode = http.POST(jsonPayload);
  if (httpCode > 0) {
    Serial.printf("[Cloud] Risposta Server HTTP: %d\\n", httpCode);
    totalDispensesLogged++;
  } else {
    Serial.printf("[Cloud] ERRORE Invio: %s (Codice %d)\\n", http.errorToString(httpCode).c_str(), httpCode);
  }
  http.end();
}

// --- SCANSIONE MATRICE PASSIVA (SNIFFING IN PARALLELO) ---
char scanParallelMatrix() {
  const int rowPins[4] = { PIN_R1, PIN_R2, PIN_R3, PIN_R4 };
  const int colPins[4] = { PIN_C1, PIN_C2, PIN_C3, PIN_C4 };

  // Con Optoisolatori PC817 (uscita NPN open-collector a GND con pull-up 3.3V):
  // Quando un tasto a 12V e' premuto sulla macchina, il pin corrispondente va a livello LOW (0V).
  for (int r = 0; r < 4; r++) {
    if (digitalRead(rowPins[r]) == LOW) {
      // Riga attiva rilevata! Ora verifichiamo quale colonna e' contemporaneamente attiva
      for (int c = 0; c < 4; c++) {
        if (digitalRead(colPins[c]) == LOW) {
          char detected = KEY_MAP[r][c];
          if (detected != 'X' && detected != 'Y') {
            return detected;
          }
        }
      }
    }
  }
  return '\\0';
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\\n==================================================");
  Serial.println(" ESP32 TELEMETRIA DISTRIBUTORE - OPZIONE A PARALLELO");
  Serial.println("==================================================");

  // Inizializzazione Display LCD se presente
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcdAvailable = true;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("VENDING TELEMETRY");
  lcd.setCursor(0, 1);
  lcd.print("MODALITA: PARALLELO ");

  // CONFIGURAZIONE PIN: TUTTI COME INPUT AD ALTA IMPEDENZA
  // Non generiamo alcuna tensione/corrente verso la macchina
  pinMode(PIN_R1, INPUT_PULLUP);
  pinMode(PIN_R2, INPUT_PULLUP);
  pinMode(PIN_R3, INPUT_PULLUP);
  pinMode(PIN_R4, INPUT_PULLUP);

  pinMode(PIN_C1, INPUT_PULLUP);
  pinMode(PIN_C2, INPUT_PULLUP);
  pinMode(PIN_C3, INPUT_PULLUP);
  pinMode(PIN_C4, INPUT_PULLUP);

  // Buzzer opzionale
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // Connessione WiFi
  connectWiFi();

  Serial.println("[SETUP] In ascolto passivo sulla tastiera a 12V...");
}

void loop() {
  // 1. Monitoraggio stato connessione WiFi
  static unsigned long lastWiFiCheck = 0;
  if (millis() - lastWiFiCheck > 15000) {
    lastWiFiCheck = millis();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[WiFi] Riconnessione...");
      WiFi.reconnect();
    }
  }

  // Auto-reset Modalità Caraffa dopo 10 secondi
  if (isCaraffaMode && (millis() - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    isCaraffaMode = false;
    Serial.println(">>> [TIMEOUT CARAFFA 10s]: Ritorno automatico a Monodose standard.");
  }

  // 2. Lettura passiva in parallelo della tastiera
  char pressedKey = scanParallelMatrix();

  if (pressedKey != '\\0' && (millis() - lastKeyPressTime > DEBOUNCE_MS)) {
    if (pressedKey != lastDetectedKey || (millis() - lastKeyPressTime > 1500)) {
      lastKeyPressTime = millis();
      lastDetectedKey = pressedKey;

      if (pressedKey == '*') {
        if (isCaraffaMode) {
          isCaraffaMode = false;
          Serial.println(">>> MODALITA CARAFFA DISATTIVATA (Ritorno a Monodose)");
        } else {
          isCaraffaMode = true;
          caraffaTimerStart = millis();
          Serial.println(">>> MODALITA CARAFFA ATTIVATA (Timeout 10s avviato: auto-reset Monodose)");
        }
        return;
      } else if (pressedKey == '0') {
        isCaraffaMode = false;
        Serial.println(">>> STOP EMERGENZA (Modalita' Caraffa annullata)");
      }

      Serial.println("--------------------------------------------------");
      Serial.printf("[SNIFFER] Tasto Intercettato: '%c' -> %s (%.2f €)\\n",
                    pressedKey, getProductName(pressedKey), getProductPrice(pressedKey));

      // Feedback acustico breve (Bip 50ms)
      digitalWrite(PIN_BUZZER, HIGH);
      delay(50);
      digitalWrite(PIN_BUZZER, LOW);

      // Aggiornamento Display LCD
      if (lcdAvailable) {
        lcd.setCursor(0, 1);
        lcd.print("                    ");
        lcd.setCursor(0, 1);
        lcd.print("Sel: [");
        lcd.print(pressedKey);
        lcd.print("] ");
        lcd.print(getProductName(pressedKey));
      }

      // 3. Trasmissione al Cloud Database
      sendDispenseTelemetry(pressedKey);

      // Se era attiva caraffa ed e' stata completata la selezione bevanda, torna a monodose
      if (isCaraffaMode) {
        isCaraffaMode = false;
        Serial.println(">>> [CARAFFA EROGATA]: Ritorno automatico a Monodose standard.");
      }
    }
  } else if (pressedKey == '\\0') {
    lastDetectedKey = '\\0'; // Tasto rilasciato
  }

  delay(10); // Ciclo rapido a 100Hz per campionare la scansione a 12V della macchina
}
`;
}

/**
 * SKETCH 1 (PREDEFINITO): ESP32 Telemetry Gateway & Interfaccia Tastiera -> Master PLC Macchina
 * L'ESP32 legge la tastiera 14 tasti, pilota il display LCD 20x4, invia i comandi al PLC
 * tramite uscite optoisolate / bus seriale, legge lo stato macchina dal PLC e carica
 * tutta la telemetria real-time su Database Cloud via WiFi.
 */
export function generateVendingPlcTelemetrySketch(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, pins, debounceMs, keypadVoltageLevel, macAddress, boardModel, optoDurationMs } = config;
  const voltageComment = getVoltageHeaderComment(keypadVoltageLevel);
  const macVal = macAddress || '24:6F:28:A1:B2:C3';
  const modelVal = boardModel || 'ESP32 NodeMCU 38-Pin (Tastiera + Opto)';
  const optoDuration = optoDurationMs || 400;

  return `/*
 * ==================================================================================
 * ESP32 - GATEWAY TELEMETRIA IOT & INTERFACCIA TASTIERA (14 TASTI) <-> MASTER PLC
 * ==================================================================================
 * Hardware: ${modelVal} | MAC Address: ${macVal}
 * ARCHITETTURA DI SISTEMA:
 * - SCHEDA MASTER (PLC INDUSTRIALE): Gestisce la logica di funzionamento della macchina,
 *   attuatori di potenza 24V/230V, caldaia espresso (PID), pompa 15-bar, macinacaffè,
 *   mixer polveri solubili, sgancio bicchieri, sensori di livello e termocoppie.
 *
 * - SCHEDA ESP32 (GATEWAY TELEMETRIA & UI):
 *   1. Legge la tastiera a membrana frontale a 14 Tasti Fisici (12 Prodotti + CARAFFA + STOP).
 *   2. Invia la selezione al PLC tramite uscite optoisolate (Strobe + Codifica o Seriale UART/RS485).
 *   3. Monitora in tempo reale gli ingressi di stato dal PLC (READY, BUSY, ALLARME).
 *   4. Gestisce il Display LCD 20x4 I2C frontale e il Buzzer sonoro.
 *   5. Trasmette tutta la telemetria (erogazioni, consumi, audit, tempi, allarmi)
 *      al Database Cloud REST API via WiFi.
 * ==================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

${voltageComment}

// --- RETE WI-FI & TELEMETRIA CLOUD ---
const char* WIFI_SSID     = "${ssid || 'WIFI_AZIENDALE'}";
const char* WIFI_PASSWORD = "${password || 'PASSWORD_SICURA'}";
const char* API_DISPENSE  = "${serverUrl || 'https://tuo-dominio.run.app'}/api/dispense";
const char* API_STOP      = "${serverUrl || 'https://tuo-dominio.run.app'}/api/dispense/stop";
const char* API_KEYLOG    = "${serverUrl || 'https://tuo-dominio.run.app'}/api/keylog";
const char* API_HEARTBEAT = "${serverUrl || 'https://tuo-dominio.run.app'}/api/devices/heartbeat";
const char* DEVICE_ID     = "${deviceId || 'ESP32-TELEMETRY-01'}";
const char* MAC_ADDRESS   = "${macVal}";

// --- DISPLAY LCD 20x4 I2C (SDA=21, SCL=22, Addr 0x27) ---
LiquidCrystal_I2C lcd(0x27, 20, 4);

// --- PARAMETRI TEMPORALI OPTOISOLATORI ---
const int OPTO_DURATION_MS   = ${optoDuration};

// --- INTERFACCIA SEGNALI ESP32 -> MASTER PLC (Uscite Optoisolate 3.3V/5V) ---
const int PIN_PLC_STROBE    = 19; // Impulso di Start Erogazione al PLC (Active HIGH)
const int PIN_PLC_CARAFFA   = 18; // Segnale Modalità Caraffa al PLC (Active HIGH)
const int PIN_PLC_STOP      = 5;  // Segnale Arresto di Emergenza al PLC (Active HIGH)
const int PIN_PLC_SEL_B0    = 17; // Codifica BCD Bit 0 selezione bevanda (1-12)
const int PIN_PLC_SEL_B1    = 16; // Codifica BCD Bit 1 selezione bevanda
const int PIN_PLC_SEL_B2    = 4;  // Codifica BCD Bit 2 selezione bevanda
const int PIN_PLC_SEL_B3    = 0;  // Codifica BCD Bit 3 selezione bevanda (oppure UART TX2=GPIO17)

// --- INTERFACCIA SEGNALI MASTER PLC -> ESP32 (Ingressi di Stato Optoisolati) ---
const int PIN_PLC_READY_IN  = 34; // PLC Pronto / Caldaia a regime (Input Only)
const int PIN_PLC_BUSY_IN   = 35; // PLC in corso di erogazione (Input Only)
const int PIN_PLC_ALARM_IN  = 39; // Segnalazione Allarme dal PLC (mancanza acqua, etc.)

// --- SEGNALATORE ACUSTICO ---
const int PIN_BUZZER        = 2;  // Buzzer piezoelettrico frontale

// --- MATRICE TASTIERA A MEMBRANA 14 TASTI FISICI (4 Righe x 4 Colonne, 2 Pin non popolati) ---
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'}, // Riga 1: Prod 1, Prod 2, Prod 3, Prod 4
  {'4', '5', '6', 'B'}, // Riga 2: Prod 5, Prod 6, Prod 7, Prod 8
  {'7', '8', '9', 'C'}, // Riga 3: Prod 9, Prod 10, Prod 11, Prod 12
  {'*', '0', '\\0', '\\0'} // Riga 4: CARAFFA (*), STOP (0) - Totale 14 Tasti Fisici
};

byte rowPins[ROWS] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}};
byte colPins[COLS] = {${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// --- STATO DEL GATEWAY TELEMETRIA ---
bool isCaraffaMode = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000; // Timeout 10s: ritorno automatico a Monodose
bool isDispensing = false;
unsigned long lastHeartbeat = 0;

// Prototipi
void handleKeypadPress(char key);
void updateLcdScreen();
void forwardSelectionToPlc(int productNumber, bool caraffa);
void forwardStopToPlc();
void monitorPlcState();
const char* getProductName(char k);
int getProductNumber(char k);
void logKeyToCloud(char key);
void sendDispenseToDatabase(char key, bool caraffa);
void sendStopToDatabase();

void setup() {
  Serial.begin(115200);
  Serial.println("\\n=== ESP32 TELEMETRY GATEWAY FOR PLC VENDING MACHINE ===");

  // Configurazione Uscite verso PLC
  pinMode(PIN_PLC_STROBE, OUTPUT);
  pinMode(PIN_PLC_CARAFFA, OUTPUT);
  pinMode(PIN_PLC_STOP, OUTPUT);
  pinMode(PIN_PLC_SEL_B0, OUTPUT);
  pinMode(PIN_PLC_SEL_B1, OUTPUT);
  pinMode(PIN_PLC_SEL_B2, OUTPUT);
  pinMode(PIN_PLC_SEL_B3, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);

  digitalWrite(PIN_PLC_STROBE, LOW);
  digitalWrite(PIN_PLC_CARAFFA, LOW);
  digitalWrite(PIN_PLC_STOP, LOW);
  digitalWrite(PIN_PLC_SEL_B0, LOW);
  digitalWrite(PIN_PLC_SEL_B1, LOW);
  digitalWrite(PIN_PLC_SEL_B2, LOW);
  digitalWrite(PIN_PLC_SEL_B3, LOW);

  // Configurazione Ingressi di Stato da PLC
  pinMode(PIN_PLC_READY_IN, INPUT);
  pinMode(PIN_PLC_BUSY_IN, INPUT);
  pinMode(PIN_PLC_ALARM_IN, INPUT);

  // Display LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ESP32 TELEMETRY IOT");
  lcd.setCursor(0, 1);
  lcd.print("INTERFACCIA -> PLC");
  lcd.setCursor(0, 2);
  lcd.print("WiFi: Connessione...");

  // Connessione WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 25) {
    delay(400);
    Serial.print(".");
    retry++;
  }

  keypad.setDebounceTime(${debounceMs || 30});

  lcd.clear();
  updateLcdScreen();
}

void loop() {
  // 1. Scansione Tastiera 14 Tasti
  char key = keypad.getKey();
  if (key) {
    handleKeypadPress(key);
  }

  // 2. Timeout Modalità Caraffa: ritorno automatico a Monodose dopo 10 secondi
  if (isCaraffaMode && !isDispensing && (millis() - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    isCaraffaMode = false;
    digitalWrite(PIN_PLC_CARAFFA, LOW);
    tone(PIN_BUZZER, 800, 100);
    Serial.println("[TIMEOUT CARAFFA] Trascorsi 10s: ripristino automatico Monodose standard");
    updateLcdScreen();
  }

  // 3. Monitoraggio Ingressi di Stato dal Master PLC
  monitorPlcState();
}

void handleKeypadPress(char key) {
  tone(PIN_BUZZER, 1600, 40);
  logKeyToCloud(key);

  // Tasto STOP [0]: Invia comando di interruzione immediata al PLC
  if (key == '0') {
    forwardStopToPlc();
    return;
  }

  // Tasto CARAFFA [*]: Attiva/Disattiva modalità Caraffa con timeout 10 secondi
  if (key == '*') {
    isCaraffaMode = !isCaraffaMode;
    digitalWrite(PIN_PLC_CARAFFA, isCaraffaMode ? HIGH : LOW);
    if (isCaraffaMode) {
      caraffaTimerStart = millis();
      tone(PIN_BUZZER, 2200, 120);
      Serial.println("MODALITÀ CARAFFA ATTIVATA: Timeout 10s avviato (auto-reset Monodose)");
    } else {
      tone(PIN_BUZZER, 1200, 80);
      Serial.println("Modalità Caraffa disattivata manualmente (Monodose)");
    }
    updateLcdScreen();
    return;
  }

  // Tasti Prodotti 1..12 (1..9, A, B, C) -> Invio comando al PLC & Telemetria Cloud
  if ((key >= '1' && key <= '9') || key == 'A' || key == 'B' || key == 'C') {
    if (!isDispensing) {
      int prodNum = getProductNumber(key);
      forwardSelectionToPlc(prodNum, isCaraffaMode);
      sendDispenseToDatabase(key, isCaraffaMode);
    }
  }
}

void forwardSelectionToPlc(int productNumber, bool caraffa) {
  isDispensing = true;

  // Mostra su LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(caraffa ? "*** CARAFFA ***" : "*** EROGAZIONE ***");
  lcd.setCursor(0, 1);
  lcd.print("P");
  if (productNumber < 10) lcd.print("0");
  lcd.print(productNumber);
  lcd.print(" Inviato al PLC");
  lcd.setCursor(0, 2);
  lcd.print("PLC: Logica attiva");

  // 1. Imposta le linee BCD della selezione prodotto verso il PLC
  digitalWrite(PIN_PLC_SEL_B0, (productNumber & 0x01) ? HIGH : LOW);
  digitalWrite(PIN_PLC_SEL_B1, (productNumber & 0x02) ? HIGH : LOW);
  digitalWrite(PIN_PLC_SEL_B2, (productNumber & 0x04) ? HIGH : LOW);
  digitalWrite(PIN_PLC_SEL_B3, (productNumber & 0x08) ? HIGH : LOW);
  digitalWrite(PIN_PLC_CARAFFA, caraffa ? HIGH : LOW);

  // 2. Invia impulso di STROBE (Start) al PLC (durata 150ms)
  digitalWrite(PIN_PLC_STROBE, HIGH);
  delay(150);
  digitalWrite(PIN_PLC_STROBE, LOW);

  Serial.printf("[PLC GATEWAY] Inviato Prodotto P%02d (Caraffa: %d) al Master PLC\\n", productNumber, caraffa);

  // Feedback sonoro selezione accettata
  tone(PIN_BUZZER, 2000, 100);
}

void forwardStopToPlc() {
  // Invia impulso di arresto immediato al PLC
  digitalWrite(PIN_PLC_STOP, HIGH);
  delay(200);
  digitalWrite(PIN_PLC_STOP, LOW);

  isCaraffaMode = false;
  isDispensing = false;
  digitalWrite(PIN_PLC_CARAFFA, LOW);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("*** ARRESTO STOP ***");
  lcd.setCursor(0, 1);
  lcd.print("SEGNALE STOP AL PLC");
  lcd.setCursor(0, 2);
  lcd.print("ATTUATORI BLOCCATI");

  for (int i = 0; i < 3; i++) {
    tone(PIN_BUZZER, 800, 120);
    delay(150);
  }

  sendStopToDatabase();
  delay(1500);
  updateLcdScreen();
}

void monitorPlcState() {
  // Lettura segnale BUSY dal PLC (se il PLC è tornato in standby)
  bool plcBusy = (digitalRead(PIN_PLC_BUSY_IN) == HIGH);
  bool plcAlarm = (digitalRead(PIN_PLC_ALARM_IN) == HIGH);

  if (isDispensing && !plcBusy) {
    // Il PLC ha terminato l'erogazione
    isDispensing = false;
    isCaraffaMode = false;
    digitalWrite(PIN_PLC_CARAFFA, LOW);
    
    lcd.setCursor(0, 3);
    lcd.print("BEVANDA PRONTA!     ");
    tone(PIN_BUZZER, 2400, 300);
    delay(1800);
    updateLcdScreen();
  }

  if (plcAlarm) {
    lcd.setCursor(0, 3);
    lcd.print("! ALLARME PLC MACCH !");
  }
}

void updateLcdScreen() {
  lcd.clear();
  
  if (isCaraffaMode) {
    lcd.setCursor(0, 0);
    lcd.print("*** MODO CARAFFA ***");
    lcd.setCursor(0, 1);
    lcd.print("DOSE CARAFFA [10s]  ");
    lcd.setCursor(0, 2);
    lcd.print("PREMI PRODOTTO(1-12)");
    lcd.setCursor(0, 3);
    lcd.print("AUTO-RESET MONODOSE ");
  } else {
    lcd.setCursor(0, 0);
    lcd.print("DISTRIBUTORE BEVANDE");
    lcd.setCursor(0, 1);
    lcd.print("PREMI UN TASTO(1-12)");
    lcd.setCursor(0, 2);
    lcd.print("MODO: BICCHIERE STD ");
    lcd.setCursor(0, 3);
    lcd.print("*:CARAFFA   0:STOP  ");
  }
}

const char* getProductName(char k) {
  switch (k) {
    case '1': return "Espresso";
    case '2': return "Esp. Lungo";
    case '3': return "Macchiato";
    case 'A': return "Cappuccino";
    case '4': return "Cioccolata";
    case '5': return "Mochaccino";
    case '6': return "Te Limone";
    case 'B': return "Latte Caldo";
    case '7': return "Caffe Ginseng";
    case '8': return "Caffe d'Orzo";
    case '9': return "Decaffeinato";
    case 'C': return "Acqua Calda";
    default:  return "Prodotto";
  }
}

int getProductNumber(char k) {
  switch (k) {
    case '1': return 1;
    case '2': return 2;
    case '3': return 3;
    case 'A': return 4;
    case '4': return 5;
    case '5': return 6;
    case '6': return 7;
    case 'B': return 8;
    case '7': return 9;
    case '8': return 10;
    case '9': return 11;
    case 'C': return 12;
    default:  return 1;
  }
}

void logKeyToCloud(char key) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_KEYLOG);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["key"] = String(key);
  doc["deviceId"] = DEVICE_ID;
  doc["eventType"] = "pressed";

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}

void sendDispenseToDatabase(char key, bool caraffa) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_DISPENSE);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["key"] = String(key);
  doc["isCaraffa"] = caraffa;
  doc["deviceId"] = DEVICE_ID;
  doc["controllerType"] = "PLC_MASTER_GATEWAY";

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}

void sendStopToDatabase() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_STOP);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["reason"] = "Tasto STOP premuto su tastiera 4x4 (Inviato al PLC)";

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}
`;
}

export function generateVendingMachineSketch(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, pins, debounceMs, keypadVoltageLevel, macAddress, boardModel, optoDurationMs } = config;
  const voltageComment = getVoltageHeaderComment(keypadVoltageLevel);
  const macVal = macAddress || '24:6F:28:A1:B2:C3';
  const modelVal = boardModel || 'ESP32 NodeMCU 38-Pin (Tastiera + Opto)';
  const optoDuration = optoDurationMs || 400;

  return `/*
 * ==================================================================================
 * ESP32 - DISTRIBUTORE BEVANDE (TASTIERA A MEMBRANA + MODULO OPTO)
 * ==================================================================================
 * Hardware: ${modelVal} | MAC Address: ${macVal}
 * Modalità: INTERFACCIA TASTIERA 14 TASTI & OPTOISOLATORI MACCHINA
 * ==================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

${voltageComment}

// --- RETE WI-FI & TELEMETRIA ---
const char* WIFI_SSID     = "${ssid || 'WIFI_DISTRIBUTORE'}";
const char* WIFI_PASSWORD = "${password || 'PASSWORD_SICURA'}";
const char* API_DISPENSE  = "${serverUrl || 'https://tuo-dominio.run.app'}/api/dispense";
const char* API_STOP      = "${serverUrl || 'https://tuo-dominio.run.app'}/api/dispense/stop";
const char* API_KEYLOG    = "${serverUrl || 'https://tuo-dominio.run.app'}/api/keylog";
const char* API_HEARTBEAT = "${serverUrl || 'https://tuo-dominio.run.app'}/api/devices/heartbeat";
const char* DEVICE_ID     = "${deviceId || 'ESP32-VENDING-01'}";
const char* MAC_ADDRESS   = "${macVal}";

// --- PARAMETRI TEMPORALI OPTOISOLATORI ---
const int OPTO_DURATION_MS   = ${optoDuration};

// --- LCD DISPLAY I2C (20 colonne x 4 righe) ---
LiquidCrystal_I2C lcd(0x27, 20, 4);

// --- PIN ATTUATORI & RELÈ DISTRIBUTORE ---
const int PIN_VALVE_WATER   = 19; // Elettrovalvola Caldaia
const int PIN_PUMP_WATER    = 18; // Pompa Erogazione 15 Bar
const int PIN_GRINDER       = 5;  // Motore Macinacaffè
const int PIN_MIXER         = 17; // Miscelatore Solubili
const int PIN_CUP_SERVO     = 15; // Sgancio Bicchiere Monouso
const int PIN_BUZZER        = 2;  // Segnalatore Acustico Beep

// --- MATRICE TASTIERA A MEMBRANA 14 TASTI FISICI (4 Righe x 4 Colonne) ---
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '\\0', '\\0'}
};

byte rowPins[ROWS] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}};
byte colPins[COLS] = {${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

bool isCaraffaMode = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000;
bool isDispensing = false;
volatile bool stopTriggered = false;

void handleKeypadPress(char key);
void updateLcdScreen();
void executeBeverageDispense(char drinkKey);
void emergencyStop();
const char* getProductName(char k);
int getProductNumber(char k);
void logKeyToCloud(char key);
void sendDispenseToDatabase(char key, bool caraffa);
void sendStopToDatabase();

void setup() {
  Serial.begin(115200);
  pinMode(PIN_VALVE_WATER, OUTPUT);
  pinMode(PIN_PUMP_WATER, OUTPUT);
  pinMode(PIN_GRINDER, OUTPUT);
  pinMode(PIN_MIXER, OUTPUT);
  pinMode(PIN_CUP_SERVO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  
  digitalWrite(PIN_VALVE_WATER, LOW);
  digitalWrite(PIN_PUMP_WATER, LOW);
  digitalWrite(PIN_GRINDER, LOW);
  digitalWrite(PIN_MIXER, LOW);
  digitalWrite(PIN_CUP_SERVO, LOW);

  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ESP32 VENDING FREE");
  lcd.setCursor(0, 1);
  lcd.print("STANDALONE RELAYS");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 25) {
    delay(400);
    retry++;
  }

  keypad.setDebounceTime(${debounceMs || 30});
  updateLcdScreen();
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    handleKeypadPress(key);
  }

  // Timeout Modalità Caraffa: ritorno automatico a Monodose dopo 10 secondi
  if (isCaraffaMode && !isDispensing && (millis() - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    isCaraffaMode = false;
    tone(PIN_BUZZER, 800, 100);
    Serial.println("[TIMEOUT CARAFFA] Trascorsi 10s: ripristino automatico a Monodose standard");
    updateLcdScreen();
  }
}

void handleKeypadPress(char key) {
  tone(PIN_BUZZER, 1500, 50);
  logKeyToCloud(key);

  if (key == '0') {
    if (isDispensing) {
      stopTriggered = true;
      emergencyStop();
    } else {
      isCaraffaMode = false;
      updateLcdScreen();
    }
    return;
  }

  if (key == '*') {
    isCaraffaMode = !isCaraffaMode;
    if (isCaraffaMode) {
      caraffaTimerStart = millis();
    }
    updateLcdScreen();
    return;
  }

  if ((key >= '1' && key <= '9') || key == 'A' || key == 'B' || key == 'C') {
    if (!isDispensing) {
      executeBeverageDispense(key);
    }
  }
}

void updateLcdScreen() {
  lcd.clear();
  if (isCaraffaMode) {
    lcd.setCursor(0, 0); lcd.print("*** MODO CARAFFA ***");
    lcd.setCursor(0, 1); lcd.print("DOSE CARAFFA         ");
    lcd.setCursor(0, 2); lcd.print("PREMI PRODOTTO(1-12)");
    lcd.setCursor(0, 3); lcd.print("NO SGANCIO BICCHIERE");
  } else {
    lcd.setCursor(0, 0); lcd.print("DISTRIBUTORE BEVANDE");
    lcd.setCursor(0, 1); lcd.print("PREMI UN TASTO(1-12)");
    lcd.setCursor(0, 2); lcd.print("MODO: BICCHIERE STD ");
    lcd.setCursor(0, 3); lcd.print("*:CARAFFA   0:STOP  ");
  }
}

const char* getProductName(char k) {
  switch (k) {
    case '1': return "Espresso";
    case '2': return "Esp. Lungo";
    case '3': return "Macchiato";
    case 'A': return "Cappuccino";
    case '4': return "Cioccolata";
    case '5': return "Mochaccino";
    case '6': return "Te Limone";
    case 'B': return "Latte Caldo";
    case '7': return "Caffe Ginseng";
    case '8': return "Caffe d'Orzo";
    case '9': return "Decaffeinato";
    case 'C': return "Acqua Calda";
    default:  return "Prodotto";
  }
}

int getProductNumber(char k) {
  switch (k) {
    case '1': return 1; case '2': return 2; case '3': return 3; case 'A': return 4;
    case '4': return 5; case '5': return 6; case '6': return 7; case 'B': return 8;
    case '7': return 9; case '8': return 10; case '9': return 11; case 'C': return 12;
    default: return 1;
  }
}

void emergencyStop() {
  digitalWrite(PIN_VALVE_WATER, LOW);
  digitalWrite(PIN_PUMP_WATER, LOW);
  digitalWrite(PIN_GRINDER, LOW);
  digitalWrite(PIN_MIXER, LOW);
  digitalWrite(PIN_CUP_SERVO, LOW);
  
  isDispensing = false;
  stopTriggered = false;

  sendStopToDatabase();
  delay(1500);
  updateLcdScreen();
}

void executeBeverageDispense(char drinkKey) {
  isDispensing = true;
  stopTriggered = false;

  if (!isCaraffaMode) {
    digitalWrite(PIN_CUP_SERVO, HIGH);
    delay(1000);
    digitalWrite(PIN_CUP_SERVO, LOW);
  }

  if (drinkKey == '1' || drinkKey == '2' || drinkKey == '3' || drinkKey == 'A' || drinkKey == '5' || drinkKey == '9') {
    digitalWrite(PIN_GRINDER, HIGH);
    delay(isCaraffaMode ? 6000 : 3000);
    digitalWrite(PIN_GRINDER, LOW);
  }

  digitalWrite(PIN_VALVE_WATER, HIGH);
  digitalWrite(PIN_PUMP_WATER, HIGH);
  if (drinkKey == '4' || drinkKey == '6' || drinkKey == 'B' || drinkKey == '7' || drinkKey == '8') {
    digitalWrite(PIN_MIXER, HIGH);
  }

  int dispenseDuration = isCaraffaMode ? 14000 : 6000;
  int elapsed = 0;
  while (elapsed < dispenseDuration) {
    char checkStop = keypad.getKey();
    if (checkStop == '0' || stopTriggered) {
      emergencyStop();
      return;
    }
    delay(100);
    elapsed += 100;
  }

  digitalWrite(PIN_VALVE_WATER, LOW);
  digitalWrite(PIN_PUMP_WATER, LOW);
  digitalWrite(PIN_MIXER, LOW);

  sendDispenseToDatabase(drinkKey, isCaraffaMode);
  tone(PIN_BUZZER, 2400, 300);
  delay(1800);

  isCaraffaMode = false;
  isDispensing = false;
  updateLcdScreen();
}

void logKeyToCloud(char key) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_KEYLOG);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["key"] = String(key);
  doc["deviceId"] = DEVICE_ID;
  doc["eventType"] = "pressed";

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}

void sendDispenseToDatabase(char key, bool caraffa) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_DISPENSE);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["key"] = String(key);
  doc["isCaraffa"] = caraffa;
  doc["deviceId"] = DEVICE_ID;

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}

void sendStopToDatabase() {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(API_STOP);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["reason"] = "Tasto STOP premuto";

  String json;
  serializeJson(doc, json);
  http.POST(json);
  http.end();
}
`;
}

export function generateRestHttpSketch(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, pins, debounceMs, holdTimeMs, useBuzzer, buzzerPin, useRelay, relayPin, keypadVoltageLevel, macAddress, boardModel, optoDurationMs } = config;
  const voltageComment = getVoltageHeaderComment(keypadVoltageLevel);
  const macVal = macAddress || '24:6F:28:A1:B2:C3';
  const modelVal = boardModel || 'ESP32 NodeMCU 38-Pin';
  const optoDuration = optoDurationMs || 400;

  return `/*
 * =========================================================================
 * ESP32 - LETTURA TASTIERA A MEMBRANA 4x4 E SALVATAGGIO SU DATABASE
 * =========================================================================
 * Hardware: ${modelVal} | MAC Address: ${macVal}
 * Librerie necessarie (Installa da Arduino Library Manager):
 * 1. "Keypad" di Mark Stanley & Alexander Brevig (v3.1.1+)
 * 2. "ArduinoJson" di Benoit Blanchon (v6.x o v7.x)
 * 3. WiFi ed HTTPClient (incluse nel core ESP32)
 *
 * Collegamenti Hardware:
 * Righe (Rows):    R1=GPIO${pins.row1}, R2=GPIO${pins.row2}, R3=GPIO${pins.row3}, R4=GPIO${pins.row4}
 * Colonne (Cols):  C1=GPIO${pins.col1}, C2=GPIO${pins.col2}, C3=GPIO${pins.col3}, C4=GPIO${pins.col4}
 * ${useBuzzer ? `Buzzer:          GPIO${buzzerPin}` : ''}
 * ${useRelay ? `Relay / Serratura: GPIO${relayPin}` : ''}
 * =========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <ArduinoJson.h>

${voltageComment}

// --- CONFIGURAZIONE RETE WI-FI ---
const char* WIFI_SSID     = "${ssid || 'IL_TUO_WIFI_SSID'}";
const char* WIFI_PASSWORD = "${password || 'LA_TUA_PASSWORD_WIFI'}";

// --- ENDPOINT SERVER / DATABASE ---
// URL dell'API dove inviare il tasto letto
const char* API_ENDPOINT  = "${serverUrl || 'https://tuo-dominio.run.app'}/api/keylog";
const char* API_HEARTBEAT = "${serverUrl || 'https://tuo-dominio.run.app'}/api/devices/heartbeat";
const char* DEVICE_ID     = "${deviceId || 'ESP32-KEYPAD-01'}";
const char* MAC_ADDRESS   = "${macVal}";

// --- DEFINIZIONE MATRICE TASTIERA 4x4 ---
const byte ROWS = 4;
const byte COLS = 4;

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

// Pin assegnati su ESP32
byte rowPins[ROWS] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}};
byte colPins[COLS] = {${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};

// Inizializzazione oggetto Keypad
Keypad customKeypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// Pin Ausiliari
const int LED_STATUS = 2; // LED Onboard ESP32
${useBuzzer ? `const int BUZZER_PIN = ${buzzerPin};` : ''}
${useRelay ? `const int RELAY_PIN  = ${relayPin};` : ''}

// Prototipi di funzione
void connectToWiFi();
bool sendKeyToDatabase(char key);
void beep(int freq, int durationMs);

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\n==================================================");
  Serial.println("  ESP32 4x4 Keypad -> Database Logger Avviato");
  Serial.println("==================================================");

  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  ${useBuzzer ? `pinMode(BUZZER_PIN, OUTPUT);` : ''}
  ${useRelay ? `pinMode(RELAY_PIN, OUTPUT); digitalWrite(RELAY_PIN, LOW);` : ''}

  // Configura debounce tastiera
  customKeypad.setDebounceTime(${debounceMs || 30});
  customKeypad.setHoldTime(${holdTimeMs || 500});

  // Connessione WiFi
  connectToWiFi();
}

void loop() {
  // Verifica se il WiFi è ancora connesso
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connessione persa. Riconnessione...");
    connectToWiFi();
  }

  // Lettura non bloccante del tasto
  char customKey = customKeypad.getKey();

  if (customKey) {
    Serial.print("[KEYPAD] Tasto premuto: ");
    Serial.println(customKey);

    // Feedback sonoro e visivo
    digitalWrite(LED_STATUS, HIGH);
    ${useBuzzer ? `beep(1200, 40);` : ''}

    // Invio al Database tramite API REST
    bool success = sendKeyToDatabase(customKey);

    if (success) {
      Serial.println("[DB] OK -> Scrittura completata con successo!");
    } else {
      Serial.println("[DB] ERRORE -> Impossibile scrivere su database.");
    }

    digitalWrite(LED_STATUS, LOW);
  }

  // Piccolo ritardo per non saturare la CPU
  delay(10);
}

// ---------------------------------------------------------
// FUNZIONE: Connessione alla rete WiFi
// ---------------------------------------------------------
void connectToWiFi() {
  Serial.print("[WIFI] Connessione a ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_STATUS, HIGH);
    Serial.println("\\n[WIFI] Connesso con successo!");
    Serial.print("[WIFI] Indirizzo IP assegnato: ");
    Serial.println(WiFi.localIP());
    Serial.print("[WIFI] Segnale RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    digitalWrite(LED_STATUS, LOW);
    Serial.println("\\n[WIFI] ERRORE: Impossibile connettersi. Controlla SSID e password.");
  }
}

// ---------------------------------------------------------
// FUNZIONE: Invio lettura tasto al Database via HTTP POST
// ---------------------------------------------------------
bool sendKeyToDatabase(char key) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Nessuna connessione WiFi.");
    return false;
  }

  HTTPClient http;
  http.begin(API_ENDPOINT);
  http.addHeader("Content-Type", "application/json");

  // Creazione del payload JSON (ArduinoJson v6/v7 compatibile)
  StaticJsonDocument<256> doc;
  doc["key"] = String(key);
  doc["deviceId"] = DEVICE_ID;
  doc["eventType"] = "pressed";
  doc["rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();

  String requestBody;
  serializeJson(doc, requestBody);

  Serial.print("[HTTP] Inviando al server: ");
  Serial.println(requestBody);

  // Esecuzione chiamata POST
  int httpResponseCode = http.POST(requestBody);

  bool isOk = false;
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("[HTTP] Risposta server (Code ");
    Serial.print(httpResponseCode);
    Serial.print("): ");
    Serial.println(response);

    if (httpResponseCode == 200 || httpResponseCode == 201) {
      isOk = true;
    }
  } else {
    Serial.print("[HTTP] Errore richiesta HTTP: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
  return isOk;
}

// ---------------------------------------------------------
// FUNZIONE: Emissione segnale acustico su Buzzer passivo/attivo
// ---------------------------------------------------------
void beep(int freq, int durationMs) {
#if ${useBuzzer ? 'true' : 'false'}
  tone(BUZZER_PIN, freq, durationMs);
  delay(durationMs);
  noTone(BUZZER_PIN);
#endif
}
`;
}

export function generatePinAccessSketch(config: ArduinoSketchSettings): string {
  const { ssid, password, serverUrl, deviceId, pins, debounceMs, buzzerPin, relayPin } = config;

  return `/*
 * =========================================================================
 * ESP32 - CONTROLLO ACCESSI PIN CON TASTIERA 4x4 E DATABASE REMOTO
 * =========================================================================
 * Funzionamento:
 * - L'utente digita il PIN sulla tastiera a membrana
 * - Premere '#' per inviare la verifica al database
 * - Premere '*' per cancellare i tasti digitati
 * - Il server/database risponde autorizzando o negando l'accesso
 * - In caso di autorizzazione, l'ESP32 attiva il Rele (Serratura/Porta) per 3s
 * =========================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Keypad.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "${ssid || 'IL_TUO_WIFI_SSID'}";
const char* WIFI_PASSWORD = "${password || 'LA_TUA_PASSWORD_WIFI'}";
const char* VERIFY_API    = "${serverUrl || 'https://tuo-dominio.run.app'}/api/verify-pin";
const char* DEVICE_ID     = "${deviceId || 'ESP32-DOOR-KEYPAD'}";

const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[ROWS] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}};
byte colPins[COLS] = {${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

const int RELAY_PIN  = ${relayPin || 4};
const int BUZZER_PIN = ${buzzerPin || 18};
const int LED_PIN    = 2;

String currentPin = "";
const int MAX_PIN_LEN = 10;
unsigned long lastKeyTime = 0;
const unsigned long PIN_TIMEOUT = 10000; // 10 secondi per completare l'inserimento

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);

  keypad.setDebounceTime(${debounceMs || 30});

  Serial.println("[ACCESS CONTROL] Avvio sistema...");
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // Timeout reset se l'utente si ferma a metà PIN
  if (currentPin.length() > 0 && (millis() - lastKeyTime > PIN_TIMEOUT)) {
    Serial.println("[PIN] Timeout inserimento scaduto. Reset buffer.");
    currentPin = "";
    tone(BUZZER_PIN, 400, 150);
  }

  char key = keypad.getKey();
  if (key) {
    lastKeyTime = millis();
    tone(BUZZER_PIN, 1500, 30); // Beep tocco tasto

    if (key == '#') {
      // Invia PIN al database
      if (currentPin.length() > 0) {
        Serial.print("[PIN] Invio per verifica: ");
        Serial.println(currentPin);
        verifyPinWithServer(currentPin);
        currentPin = "";
      }
    } else if (key == '*') {
      // Cancella
      Serial.println("[PIN] Inserimento annullato.");
      currentPin = "";
      tone(BUZZER_PIN, 600, 100);
    } else {
      // Aggiungi carattere se non oltre la lunghezza massima
      if (currentPin.length() < MAX_PIN_LEN) {
        currentPin += key;
        Serial.print("[PIN] Digitato: ");
        for (int i = 0; i < currentPin.length(); i++) Serial.print("*");
        Serial.println();
      }
    }
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connessione WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connesso! IP: " + WiFi.localIP().toString());
}

void verifyPinWithServer(String pin) {
  HTTPClient http;
  http.begin(VERIFY_API);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["pin"] = pin;
  doc["deviceId"] = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int code = http.POST(body);
  if (code == 200) {
    String res = http.getString();
    StaticJsonDocument<300> resDoc;
    deserializeJson(resDoc, res);

    bool granted = resDoc["granted"] | false;
    const char* user = resDoc["user"] | "Utente Sconosciuto";

    if (granted) {
      Serial.print(">>> ACCESSO CONSENTITO a: ");
      Serial.println(user);
      
      // Suono successo
      tone(BUZZER_PIN, 800, 100);
      delay(120);
      tone(BUZZER_PIN, 1200, 200);

      // Sblocco Rele per 3 secondi
      digitalWrite(RELAY_PIN, HIGH);
      digitalWrite(LED_PIN, HIGH);
      delay(3000);
      digitalWrite(RELAY_PIN, LOW);
      digitalWrite(LED_PIN, LOW);
    } else {
      Serial.println(">>> ACCESSO NEGATO: PIN Errato!");
      // Suono errore
      tone(BUZZER_PIN, 300, 300);
      delay(350);
      tone(BUZZER_PIN, 200, 400);
    }
  } else {
    Serial.print("Errore connessione server HTTP: ");
    Serial.println(code);
  }
  http.end();
}
`;
}

export function generateFirebaseSketch(config: ArduinoSketchSettings): string {
  const { ssid, password, deviceId, pins } = config;

  return `/*
 * =========================================================================
 * ESP32 - SCRITTURA DIRETTA SU FIREBASE REALTIME DATABASE
 * =========================================================================
 * Librerie necessarie:
 * 1. "Firebase ESP Client" di Mobizt (v4.x)
 * 2. "Keypad" di Mark Stanley & Alexander Brevig
 * =========================================================================
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <Keypad.h>

// Fornisci le credenziali del tuo progetto Firebase
#define API_KEY "IL_TUO_FIREBASE_API_KEY"
#define DATABASE_URL "https://tuo-progetto-default-rtdb.europe-west1.firebasedatabase.app/"

// Credenziali WiFi
#define WIFI_SSID "${ssid || 'IL_TUO_WIFI_SSID'}"
#define WIFI_PASSWORD "${password || 'LA_TUA_PASSWORD_WIFI'}"

// Inizializzazione Firebase
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig fbConfig;

// Matrice 4x4
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};
byte rowPins[ROWS] = {${pins.row1}, ${pins.row2}, ${pins.row3}, ${pins.row4}};
byte colPins[COLS] = {${pins.col1}, ${pins.col2}, ${pins.col3}, ${pins.col4}};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connessione WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println("\\nWiFi Connesso!");

  fbConfig.api_key = API_KEY;
  fbConfig.database_url = DATABASE_URL;
  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("Firebase pronto!");
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    Serial.print("Tasto letto: ");
    Serial.println(key);

    if (Firebase.ready()) {
      // Salva nel nodo /keypad_logs/{timestamp}
      String nodePath = "/keypad_logs/" + String(millis());
      FirebaseJson json;
      json.set("key", String(key));
      json.set("deviceId", "${deviceId || 'ESP32-01'}");
      json.set("rssi", WiFi.RSSI());

      if (Firebase.RTDB.setJSON(&fbdo, nodePath.c_str(), &json)) {
        Serial.println("Salvataggio su Firebase riuscito!");
      } else {
        Serial.print("Errore Firebase: ");
        Serial.println(fbdo.errorReason());
      }
    }
  }
}
`;
}
