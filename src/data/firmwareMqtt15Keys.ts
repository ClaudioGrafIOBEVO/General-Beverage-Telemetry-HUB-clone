import { ArduinoSketchSettings } from '../types';

/**
 * GENERATORE UFFICIALE FIRMWARE ESP32 GB-CLOUD
 * GESTIONE COMPLETA DEI 15 PULSANTI CON COMUNICAZIONE BIDIREZIONALE MQTT REAL-TIME
 * 
 * I 15 Pulsanti gestiti:
 * - 12 Prodotti da P1 a P12
 * - STOP (Arresto Emergenza / Reset)
 * - CARAFFA (Dose Caraffa 10s)
 * - LINGUA (Cambio Lingua Display)
 * 
 * Bidirezionalità:
 * 1. Da App ad ESP32 via MQTT (vending/{deviceId}/commands):
 *    Riceve il comando di uno qualsiasi dei 15 pulsanti, attiva i contatti della matrice (fili 1..8)
 *    e le uscite optoisolate, stampa log su seriale e pubblica conferma di esecuzione.
 * 2. Da Tastiera a Membrana fisica ad ESP32 all'App via MQTT:
 *    Rileva la pressione fisica del pulsante sui fili, antirimbalzo stabilizzato,
 *    stampa su seriale i dettagli (fili e GPIO coinvolti) e trasmette telemetria a:
 *    - vending/{deviceId}/telemetry
 *    - vending/{deviceId}/dispense
 */
export function generateMqttRemoteFirmware(config: ArduinoSketchSettings): string {
  const { ssid, password, deviceId, targetBoardModel, optoOutputPins } = config;
  // Modalità Base (Standard predefinita): l'ESP32 legge la tastiera a membrana su H4 E chiude i contatti su H3 via optoisolatori PC817
  const bridgeOpto = config.bridgeOptoOnPhysicalPress ?? true;
  const devId = (deviceId && deviceId.trim()) ? deviceId.trim() : '';
  const boardModel = targetBoardModel || 'Freenove ESP32-S3 WROOM-1';
  const optoPins = (optoOutputPins && optoOutputPins.length >= 8)
    ? optoOutputPins
    : [14, 13, 12, 15, 16, 17, 18, 21];
  const optoDuration = config.optoTriggerDurationMs ?? config.optoDurationMs ?? 400;
  const pins = config.pins || {
    row1: 4, row2: 5, row3: 6, row4: 7, col1: 8, col2: 9, col3: 10, col4: 11
  };
  const brokerPrimary = config.mqttBroker || 'broker.emqx.io';
  const brokerSecondary = brokerPrimary === 'broker.emqx.io' ? 'broker.hivemq.com' : 'broker.emqx.io';
  const brokerPort = config.mqttPort || 1883;

  return `/*
 * ==================================================================================
 * ESP32 - FIRMWARE UNICO TELEMETRIA & ATTUAZIONE (15 TASTI)
 * ==================================================================================
 * MODALITÀ OPERATIVA UNICA E PREDEFINITA:
 * 1. IN LOCALE: L'ESP32 legge la pressione reale del tasto fisico (Tastiera a Membrana su Connettore H4)
 *    e simula immediatamente la chiusura del contatto tramite gli Optoisolatori (U1..U8 su H3).
 * 2. DA REMOTO (WEBAPP): L'ESP32 riceve il comando di erogazione via MQTT dall'interfaccia web
 *    e attiva direttamente la coppia di Optoisolatori (U1..U8 su H3) come se fosse stato premuto il tasto fisico.
 * 3. TELEMETRIA: Trasmette simultaneamente ogni evento di erogazione (locale o web) al Cloud MQTT.
 * ==================================================================================
 * Architettura:       UNICA (Lettura Tasto Reale H4 -> Simulazione Opto U1..U8 H3 -> Cloud MQTT)
 * Identità Modulo:    Dinamica da MAC ESP32 (es. GB-CLOUD-246F28B21A80)
 * Fallback Manuale:   ${devId ? devId : 'Non impostato (Auto-determinato da hardware)'}
 * Hardware Target:    ${boardModel}
 * Broker Primario:    ${brokerPrimary}:${brokerPort}
 * Broker Secondario:  ${brokerSecondary}:${brokerPort} (Auto-Fallback se timeout)
 *
 * ASSEGNAZIONE PIN ESP32 SULLA SCHEDA:
 * ----------------------------------------------------------------------------------
 * INGRESSI TASTIERA A MEMBRANA FISICA (Connettore H4 - 8 Fili):
 *   Filo 1: GPIO ${pins.row1} | Filo 2: GPIO ${pins.row2} | Filo 3: GPIO ${pins.row3} | Filo 4: GPIO ${pins.row4}
 *   Filo 5: GPIO ${pins.col1} | Filo 6: GPIO ${pins.col2} | Filo 7: GPIO ${pins.col3} | Filo 8: GPIO ${pins.col4}
 *
 * USCITE MODULO 8x OPTOISOLATORI PC817 (Connettore H3 - U1..U8 verso Scheda Distributore):
 *   U1 (Filo 1): GPIO ${optoPins[0]} | U2 (Filo 2): GPIO ${optoPins[1]} | U3 (Filo 3): GPIO ${optoPins[2]} | U4 (Filo 4): GPIO ${optoPins[3]}
 *   U5 (Filo 5): GPIO ${optoPins[4]} | U6 (Filo 6): GPIO ${optoPins[5]} | U7 (Filo 7): GPIO ${optoPins[6]} | U8 (Filo 8): GPIO ${optoPins[7]}
 *
 * MAPPATURA COLLAUDATA DEI 15 TASTI DEL DISTRIBUTORE (FISSA 1:1):
 * ----------------------------------------------------------------------------------
 * Tasto 1  (P1  - Espresso):             Opto U1 (GPIO ${optoPins[0]}) + Opto U5 (GPIO ${optoPins[4]})
 * Tasto 2  (P2  - Caffe Lungo):          Opto U2 (GPIO ${optoPins[1]}) + Opto U5 (GPIO ${optoPins[4]})
 * Tasto 3  (P3  - Caffe Macchiato):      Opto U3 (GPIO ${optoPins[2]}) + Opto U5 (GPIO ${optoPins[4]})
 * Tasto 4  (P4  - Cappuccino / A):       Opto U1 (GPIO ${optoPins[0]}) + Opto U6 (GPIO ${optoPins[5]})
 * Tasto 5  (P5  - Latte Macchiato):      Opto U2 (GPIO ${optoPins[1]}) + Opto U6 (GPIO ${optoPins[5]})
 * Tasto 6  (P6  - Cioccolata):           Opto U3 (GPIO ${optoPins[2]}) + Opto U6 (GPIO ${optoPins[5]})
 * Tasto 7  (P7  - Cioccolata con Latte): Opto U1 (GPIO ${optoPins[0]}) + Opto U7 (GPIO ${optoPins[6]})
 * Tasto 8  (P8  - Te al Limone / B):     Opto U2 (GPIO ${optoPins[1]}) + Opto U7 (GPIO ${optoPins[6]})
 * Tasto 9  (P9  - Te Verde):             Opto U3 (GPIO ${optoPins[2]}) + Opto U7 (GPIO ${optoPins[6]})
 * Tasto 10 (P10 - Bevanda Bianca/Latte): Opto U1 (GPIO ${optoPins[0]}) + Opto U8 (GPIO ${optoPins[7]})
 * Tasto 11 (P11 - Orzo):                 Opto U2 (GPIO ${optoPins[1]}) + Opto U8 (GPIO ${optoPins[7]})
 * Tasto 12 (P12 - Ginseng / C):          Opto U3 (GPIO ${optoPins[2]}) + Opto U8 (GPIO ${optoPins[7]})
 * Tasto 13 (STOP    - Arresto / Tasto 0):Opto U4 (GPIO ${optoPins[3]}) + Opto U7 (GPIO ${optoPins[6]})
 * Tasto 14 (CARAFFA - Dose 10s / Tasto *):Opto U4 (GPIO ${optoPins[3]}) + Opto U6 (GPIO ${optoPins[5]})
 * Tasto 15 (LINGUA  - Cambio Lingua / #):Opto U4 (GPIO ${optoPins[3]}) + Opto U5 (GPIO ${optoPins[4]})
 *
 * ARCHITETTURA HARDWARE CON 8 OPTOISOLATORI PC817 SU PIAZZA COMUNE (ISOLAMENTO GALVANICO TOTALE):
 * ----------------------------------------------------------------------------------
 * - U1, U2, U3, U4 (Righe - Fili 1..4 a +13.2V): Pin 4 (Collettore +) ai Fili 1..4 | Pin 3 (Emettitore -) alla PIAZZA COMUNE
 * - U5, U6, U7, U8 (Colonne - Fili 5..8 Ritorno/GND): Pin 4 (Collettore +) alla PIAZZA COMUNE | Pin 3 (Emettitore -) ai Fili 5..8
 * - Pin 1 (Anodo LED) di U1..U8: ai GPIO dell'ESP32 tramite resistenze 330 Ohm
 * - Pin 2 (Catodo LED) di U1..U8: a GND dell'ESP32
 * - Piazza Comune: Bus interno flottante isolato (nessun collegamento a terra o alimentazione macchina).
 * Quando la corrente scorre: dal Filo positivo (es. Filo 4 a +13.2V) entra nel Collettore U4, esce dall'Emettitore U4 verso
 * la Piazza Comune, entra nel Collettore U8 ed esce dall'Emettitore U8 verso il Filo 8 (Ritorno/Massa). Entrambi i transistor lavorano in polarizzazione diretta!
 * - Per simulare qualsiasi dei 15 tasti, l'ESP32 eccita contemporaneamente una coppia di optoisolatori
 *   (uno tra U1..U4 e uno tra U5..U8): la corrente fluisce in serie attraverso la piazza comune!
 *
 * COMUNICAZIONE BIDIREZIONALE:
 * 1. TRASMISSIONE DA TASTIERA FISICA (MEMBRANA 8 FILI) ALL'APP:
 *    - Scansione a matrice stabilizzata con filtro integratore di campioni
 *    - Log seriale dettagliato ad ogni tocco (con fili e GPIO attivati)
 *    - Pubblicazione immediata su topic vending/${devId}/telemetry e vending/${devId}/dispense
 *
 * 2. RICEZIONE COMANDI DA APP AD ESP32:
 *    - Sottoscrizione a vending/${devId}/commands e vending/+/commands
 *    - Riceve erogazione P1..P12, STOP, CARAFFA, LINGUA
 *    - Chiusura optoisolatori PC817 su Piazza Comune con isolamento galvanico
 *    - Stampa seriale completa del comando eseguito
 *    - Invio notifica di avvenuta esecuzione al Cloud
 * ==================================================================================
 * LIBRERIE NECESSARIE in Arduino IDE (Strumenti -> Gestione Librerie):
 * - "PubSubClient" di Nick O'Leary (versione 2.8 o superiore)
 * ==================================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoOTA.h>
#include <HTTPClient.h>
#include <Update.h>

// --- STRUTTURA DEFINIZIONE TASTO DALLA MATRICE REALE ---
typedef struct TastoMatrice {
  int filoA;          // Filo 1..8 cavo piatto
  int filoB;          // Filo 1..8 cavo piatto
  char keyChar;       // Codice identificativo ('1'..'9', 'A', 'B', 'C', '0', '*', '#')
  const char* nome;   // Descrizione estesa
  bool isBeverage;    // true per P1..P12, false per STOP, CARAFFA, LINGUA
  int productNum;     // 1..12 per i prodotti, 13 per STOP, 14 per CARAFFA, 15 per LINGUA
} TastoMatrice;

// Prototipi espliciti per garantire la compilazione con qualsiasi versione di Arduino IDE
void inizializzaIdentitaHardware();
void salvaEventoOffline(const TastoMatrice& t, bool caraffa);
void svuotaCodaOffline();
void inizializzaOTA();
void eseguiOtaDaUrl(String binUrl);
void attivaTastoOptoPiazzaComune(int filoA, int filoB, int durationMs);
void inviaEventoMQTT(const TastoMatrice& t);
void simulaTastoMatrice(int filoA, int filoB, int durationMs);
void triggerOptoOutput(int optoIndex, int durationMs);
void mqttCallback(char* topic, byte* payload, unsigned int length);
void connettiWiFi();
void riconnettiMQTT();
void inviaHeartbeat();
int mappaFiloIngressoTastiera(int filoLogico);
int scansionaTastoPremuto();

// --- CONFIGURAZIONE RETE WI-FI & IDENTITA' DISPOSITIVO UNIVERSALE ---
const char* WIFI_SSID       = "${ssid || 'Bolds Kranz'}";
const char* WIFI_PASSWORD   = "${password || 'PASSWORD_WIFI'}";
const char* BOARD_MODEL     = "${boardModel}";
const char* FALLBACK_MANUAL_ID = "${devId}"; // Usato solo se specificato manualmente

// Variabili di identità hardware determinate dinamicamente all'avvio:
String DEVICE_ID            = ""; // Popolato dinamicamente da WiFi.macAddress() -> es. "GB-CLOUD-246F28B21A80"
String TOPIC_KEYLOG         = ""; // "vending/<DEVICE_ID>/telemetry"
String TOPIC_DISPENSE       = ""; // "vending/<DEVICE_ID>/dispense"
String TOPIC_STATUS         = ""; // "vending/<DEVICE_ID>/status"
String TOPIC_COMMANDS       = ""; // "vending/<DEVICE_ID>/commands"

// Inizializzazione dinamica dell'identità hardware ESP32
void inizializzaIdentitaHardware() {
  String macStr = WiFi.macAddress();
  String cleanMac = macStr;
  cleanMac.replace(":", "");
  cleanMac.toUpperCase();

  if (strlen(FALLBACK_MANUAL_ID) > 0) {
    DEVICE_ID = String(FALLBACK_MANUAL_ID);
  } else {
    DEVICE_ID = "GB-CLOUD-" + cleanMac;
  }

  TOPIC_KEYLOG   = "vending/" + DEVICE_ID + "/telemetry";
  TOPIC_DISPENSE = "vending/" + DEVICE_ID + "/dispense";
  TOPIC_STATUS   = "vending/" + DEVICE_ID + "/status";
  TOPIC_COMMANDS = "vending/" + DEVICE_ID + "/commands";

  Serial.println("----------------------------------------------------------------");
  Serial.print(">>> IDENTITÀ MODULO HARDWARE: "); Serial.println(DEVICE_ID);
  Serial.print(">>> MAC ADDRESS REALE:        "); Serial.println(macStr);
  Serial.print(">>> TOPIC TELEMETRIA:         "); Serial.println(TOPIC_KEYLOG);
  Serial.print(">>> TOPIC COMANDI:            "); Serial.println(TOPIC_COMMANDS);
  Serial.println("----------------------------------------------------------------");
}

// --- BROKER MQTT CON FALLBACK AUTOMATICO (RISOLUZIONE DNS STANDARD) ---
const char* BROKER_LIST[]   = {"${brokerPrimary}", "${brokerSecondary}"};
const int   NUM_BROKERS     = sizeof(BROKER_LIST) / sizeof(BROKER_LIST[0]);
int         currentBrokerIdx= 0;
const int   MQTT_PORT       = ${brokerPort};

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// --- ASSEGNAZIONE DEGLI 8 PIN FISICI TASTIERA A MEMBRANA (Fili 1..8) ---
const int PIN_FILI[8] = {
  ${pins.row1}, // Filo 1
  ${pins.row2}, // Filo 2
  ${pins.row3}, // Filo 3
  ${pins.row4}, // Filo 4
  ${pins.col1}, // Filo 5
  ${pins.col2}, // Filo 6
  ${pins.col3}, // Filo 7
  ${pins.col4}  // Filo 8
};
const int LED_STATUS = 2; // LED di stato integrato (GPIO 2)

// --- USCITE OPTOISOLATE: SCHEDA 8x PC817 SU PIAZZA COMUNE (ISOLAMENTO GALVANICO) ---
// Schema Hardware con 8 Optoisolatori PC817 (U1..U8):
// - U1, U2, U3, U4 (Righe - Fili 1..4 a +13.2V): Collettori (Pin 4) a Fili 1..4 di H3, Emettitori (Pin 3) su PIAZZA COMUNE
// - U5, U6, U7, U8 (Colonne - Fili 5..8 Ritorno/GND): Collettori (Pin 4) su PIAZZA COMUNE, Emettitori (Pin 3) a Fili 5..8 di H3
// - Pin 1 (Anodo LED) di U1..U8: a GPIO ESP32 tramite resistore da 330 Ohm
// - Pin 2 (Catodo LED) di U1..U8: a GND comune ESP32
// Quando un tasto viene erogato, l'ESP32 attiva CONTEMPORANEAMENTE i due optoisolatori
// corrispondenti (uno di U1..U4 e uno di U5..U8) chiudendo il circuito attraverso la piazza comune.
const int PIN_OPTO_PC817[8] = {
  ${optoPins[0]}, // NET1 -> U1 (Filo 1 - Connettore H3 Pin 1)
  ${optoPins[1]}, // NET2 -> U2 (Filo 2 - Connettore H3 Pin 2)
  ${optoPins[2]}, // NET3 -> U3 (Filo 3 - Connettore H3 Pin 3)
  ${optoPins[3]}, // NET4 -> U4 (Filo 4 - Connettore H3 Pin 4)
  ${optoPins[4]}, // NET5 -> U5 (Filo 5 - Connettore H3 Pin 5)
  ${optoPins[5]}, // NET6 -> U6 (Filo 6 - Connettore H3 Pin 6)
  ${optoPins[6]}, // NET7 -> U7 (Filo 7 - Connettore H3 Pin 7)
  ${optoPins[7]}  // NET8 -> U8 (Filo 8 - Connettore H3 Pin 8)
};
const int OPTO_DURATION_MS = ${optoDuration};

// TABELLA COMPLETA DEI 15 TASTI COLLAUDATI (Coppie Optoisolatori U1..U8 su Piazza Comune)
const TastoMatrice TABELLA_TASTI[] = {
  // I 12 PRODOTTI STANDARD (P1 .. P12)
  {1, 5, '1', "PRODOTTO 1 (P1 - U1+U5)",             true,  1},
  {2, 5, '2', "PRODOTTO 2 (P2 - U2+U5)",             true,  2},
  {3, 5, '3', "PRODOTTO 3 (P3 - U3+U5)",             true,  3},
  {1, 6, 'A', "PRODOTTO 4 (P4 - U1+U6)",             true,  4},
  {2, 6, '4', "PRODOTTO 5 (P5 - U2+U6)",             true,  5},
  {3, 6, '5', "PRODOTTO 6 (P6 - U3+U6)",             true,  6},
  {1, 7, '6', "PRODOTTO 7 (P7 - U1+U7)",             true,  7},
  {2, 7, 'B', "PRODOTTO 8 (P8 - U2+U7)",             true,  8},
  {3, 7, '7', "PRODOTTO 9 (P9 - U3+U7)",             true,  9},
  {1, 8, '8', "PRODOTTO 10 (P10 - U1+U8)",           true, 10},
  {2, 8, '9', "PRODOTTO 11 (P11 - U2+U8)",           true, 11},
  {3, 8, 'C', "PRODOTTO 12 (P12 - U3+U8)",           true, 12},

  // I 3 TASTI FUNZIONE SPECIALI (U4 in combinazione con U7, U6, U5)
  {4, 7, '0', "STOP (Arresto Emergenza - U4+U7)",    false, 13},
  {4, 6, '*', "CARAFFA (Dose Caraffa 10s - U4+U6)",  false, 14},
  {4, 5, '#', "LINGUA (Cambio Lingua LCD - U4+U5)",  false, 15}
};

const int TOTALE_TASTI = sizeof(TABELLA_TASTI) / sizeof(TABELLA_TASTI[0]);

// Variabili di stato
bool modalitaCaraffa = false;
unsigned long caraffaTimerStart = 0;
const unsigned long CARAFFA_TIMEOUT_MS = 10000; // Finestra di 10 secondi per selezionare la bevanda in dose caraffa
unsigned long ultimoHeartbeat = 0;
unsigned long conteggioPressioni = 0;
unsigned long conteggioComandiRicevuti = 0;

// ==============================================================================
// BUFFER CIRCOLARE MEMORIA OFFLINE (ZERO PERDITA BATTUTE SE CADUTA WI-FI / INTERNET)
// ==============================================================================
// Se il Wi-Fi o il broker MQTT cadono, la macchina continua a erogare al 100%
// e registra ogni battuta nella memoria RAM dell'ESP32. Non appena la connessione
// torna attiva, tutte le battute pendenti vengono sincronizzate in automatico al Cloud!
struct EventoOffline {
  char keyChar;
  char nome[36];
  int productNum;
  int filoA;
  int filoB;
  bool isCaraffa;
  bool isBeverage;
  unsigned long timestampSec;
};

const int MAX_EVENTI_OFFLINE = 64; // Coda FIFO per 64 erogazioni offline
EventoOffline codaOffline[MAX_EVENTI_OFFLINE];
int testaCodaOffline = 0;
int codaCountOffline = 0;

void salvaEventoOffline(const TastoMatrice& t, bool caraffa) {
  int index = (testaCodaOffline + codaCountOffline) % MAX_EVENTI_OFFLINE;
  codaOffline[index].keyChar = t.keyChar;
  strncpy(codaOffline[index].nome, t.nome, sizeof(codaOffline[index].nome) - 1);
  codaOffline[index].nome[sizeof(codaOffline[index].nome) - 1] = 0;
  codaOffline[index].productNum = t.productNum;
  codaOffline[index].filoA = t.filoA;
  codaOffline[index].filoB = t.filoB;
  codaOffline[index].isCaraffa = caraffa;
  codaOffline[index].isBeverage = t.isBeverage;
  codaOffline[index].timestampSec = millis() / 1000;

  if (codaCountOffline < MAX_EVENTI_OFFLINE) {
    codaCountOffline++;
  } else {
    // Buffer pieno: avanza la testa sovrascrivendo l'evento più vecchio
    testaCodaOffline = (testaCodaOffline + 1) % MAX_EVENTI_OFFLINE;
  }
  Serial.print(">> [OFFLINE BUFFER]: Evento '");
  Serial.print(t.nome);
  Serial.print("' salvato in memoria locale. Eventi pendenti in coda: ");
  Serial.println(codaCountOffline);
}

void svuotaCodaOffline() {
  if (codaCountOffline == 0) return;
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) return;

  Serial.println("================================================================");
  Serial.print(">>> [SYNC CLOUD OFFLINE]: Sincronizzazione di ");
  Serial.print(codaCountOffline);
  Serial.println(" erogazioni salvate durante il periodo offline...");

  while (codaCountOffline > 0 && mqttClient.connected()) {
    EventoOffline ev = codaOffline[testaCodaOffline];

    String jsonPayload = String("{\\\"key\\\":\\\"") + String(ev.keyChar) + "\\\","
                       + "\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                       + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                       + "\\\"eventType\\\":\\\"pressed_buffered\\\","
                       + "\\\"nomeTasto\\\":\\\"" + String(ev.nome) + "\\\","
                       + "\\\"productNum\\\":" + String(ev.productNum) + ","
                       + "\\\"filoA\\\":" + String(ev.filoA) + ","
                       + "\\\"filoB\\\":" + String(ev.filoB) + ","
                       + "\\\"isCaraffa\\\":" + (ev.isCaraffa ? "true" : "false") + ","
                       + "\\\"wasOffline\\\":true,"
                       + "\\\"uptimeSec\\\":" + String(ev.timestampSec) + "}";

    bool ok = mqttClient.publish(TOPIC_KEYLOG.c_str(), jsonPayload.c_str());
    if (ok) {
      testaCodaOffline = (testaCodaOffline + 1) % MAX_EVENTI_OFFLINE;
      codaCountOffline--;
      delay(30); // Breve pausa per non saturare lo stack MQTT
    } else {
      Serial.println(">> [SYNC OFFLINE]: Errore invio pacchetto, riprovo al prossimo ciclo.");
      break;
    }
  }
  Serial.print(">>> [SYNC CLOUD OFFLINE]: Completato. Rimanenti in coda: ");
  Serial.println(codaCountOffline);
  Serial.println("================================================================");
}

// ==============================================================================
// AGGIORNAMENTO FIRMWARE OVER-THE-AIR (OTA WIRELESS)
// ==============================================================================
// Supporta 2 modalità di aggiornamento wireless:
// 1. ArduinoOTA: Flash diretto via WiFi su porta 3232 da Arduino IDE / PlatformIO
// 2. HTTP OTA via MQTT: Invio comando da cloud con URL binario {"action":"OTA_UPDATE","url":"http://..."}
bool otaInCorso = false;

void inizializzaOTA() {
  ArduinoOTA.setHostname(DEVICE_ID.c_str());
  ArduinoOTA.setPassword("gbcloud2026"); // Password di sicurezza per flash OTA

  ArduinoOTA.onStart([]() {
    otaInCorso = true;
    String type = (ArduinoOTA.getCommand() == U_FLASH) ? "firmware (sketch)" : "filesystem (spiffs)";
    Serial.println();
    Serial.println(">>> [OTA WIRELESS AVVIATO]: Aggiornamento " + type + " in corso...");
    digitalWrite(LED_STATUS, HIGH);
  });

  ArduinoOTA.onEnd([]() {
    otaInCorso = false;
    digitalWrite(LED_STATUS, LOW);
    Serial.println();
    Serial.println(">>> [OTA WIRELESS COMPLETATO CON SUCCESSO!]: Riavvio ESP32 in corso...");
  });

  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    int perc = (progress / (total / 100));
    if (perc % 20 == 0) {
      Serial.print(">>> [OTA PROGRESS]: ");
      Serial.print(perc);
      Serial.println("%");
    }
  });

  ArduinoOTA.onError([](ota_error_t error) {
    otaInCorso = false;
    digitalWrite(LED_STATUS, LOW);
    Serial.print(">>> [OTA ERRORE]: ");
    Serial.println(error);
    if (error == OTA_AUTH_ERROR) Serial.println("Autenticazione fallita");
    else if (error == OTA_BEGIN_ERROR) Serial.println("Errore avvio memoria flash");
    else if (error == OTA_CONNECT_ERROR) Serial.println("Errore connessione");
    else if (error == OTA_RECEIVE_ERROR) Serial.println("Errore ricezione pacchetti");
    else if (error == OTA_END_ERROR) Serial.println("Errore finalizzazione");
  });

  ArduinoOTA.begin();
  Serial.println(">>> [OTA WIRELESS PRONTO]: Hostname: " + DEVICE_ID + " (Porta 3232, Auth Protetta)");
}

void eseguiOtaDaUrl(String binUrl) {
  if (WiFi.status() != WL_CONNECTED || binUrl.length() < 8) return;
  Serial.println();
  Serial.println("================================================================");
  Serial.println(">>> [OTA HTTP CLOUD]: Download e flash firmware da URL remoto:");
  Serial.println(">>> " + binUrl);
  Serial.println("================================================================");

  HTTPClient http;
  http.begin(binUrl);
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    int contentLength = http.getSize();
    bool canBegin = Update.begin(contentLength);
    if (canBegin) {
      WiFiClient* client = http.getStreamPtr();
      size_t written = Update.writeStream(*client);
      if (written == contentLength) {
        Serial.println(">>> [OTA HTTP]: Firmware scaricato (" + String(written) + " byte). Finalizzazione...");
      }
      if (Update.end()) {
        if (Update.isFinished()) {
          Serial.println(">>> [OTA HTTP SUCCESSO]: Aggiornamento riuscito! Riavvio in corso...");
          delay(500);
          ESP.restart();
        } else {
          Serial.println(">>> [OTA HTTP ERRORE]: Aggiornamento non completato.");
        }
      } else {
        Serial.println(">>> [OTA HTTP ERRORE]: " + String(Update.getError()));
      }
    } else {
      Serial.println(">>> [OTA HTTP ERRORE]: Spazio flash insufficiente per nuovo firmware.");
    }
  } else {
    Serial.println(">>> [OTA HTTP ERRORE]: Download fallito (HTTP " + String(httpCode) + ")");
  }
  http.end();
}
// ==============================================================================
// MODALITÀ ATTUAZIONE OPTOISOLATORI PC817 (CONNETTORE H3 VERSO DISTRIBUTORE):
// - MODALITÀ BASE (Predefinita): L'ESP32 legge la tastiera a membrana su H4 e chiude
//   i contatti sulla scheda madre della macchina attivando la coppia di Optoisolatori
//   U1..U8 su Piazza Comune (connettore H3).
// - SULLE EROGAZIONI DA REMOTO: L'ESP32 riceve il comando MQTT ed eccita gli opto
//   con interblocco hardware e deduplicazione temporale (zero doppi bip).
// ==============================================================================
const bool ABILITA_SCANSIONE_TASTIERA_LOCALE = true;
const bool SIMULA_OPTO_SU_PRESSIONE_FISICA    = ${bridgeOpto ? 'true' : 'false'};

// Macchina a stati antirimbalzo industriale con lockout e isteresi di rilascio
enum StatoTastiera { STATO_IDLE, STATO_PREMUTO };
StatoTastiera statoTastiera = STATO_IDLE;
int tastoCandidato = -1;
int conteggioCampioniPremuto = 0;
int conteggioCampioniRilascio = 0;
unsigned long ultimoInvioMs = 0;

const int CAMPIONI_MIN_PRESSIONE = 4; // 4 letture stabili consecutive (~40ms) per confermare la pressione
const int CAMPIONI_MIN_RILASCIO  = 8; // 8 letture consecutive a riposo (~80ms) per riarmare il tasto
const unsigned long KEYPAD_LOCKOUT_MS = 1200; // Lockout minimo 1200ms: zero doppi tocchi / zero doppi bip

// Timestamp tracciamento attivazione optoisolatore (interblocco hardware anti-doppio impulso)
unsigned long ultimoOptoAttivoMillis = 0;

// --- FUNZIONE ATTUAZIONE: SCHEDA 8x PC817 SU PIAZZA COMUNE ---
// Per simulare la chiusura tra filoA (1..4) e filoB (5..8),
// porta a HIGH i rispettivi pin ESP32 eccitando entrambi i LED degli optoisolatori.
// La corrente attraversa i due fototransistor in serie connessi sulla piazza comune.
void attivaTastoOptoPiazzaComune(int filoA, int filoB, int durationMs = OPTO_DURATION_MS) {
  int riga = (filoA <= 4) ? filoA : filoB; // Filo 1..4 (Optoisolatori U1..U4)
  int col  = (filoA > 4)  ? filoA : filoB; // Filo 5..8 (Optoisolatori U5..U8)

  if (riga >= 1 && riga <= 4 && col >= 5 && col <= 8) {
    int pinRiga = PIN_OPTO_PC817[riga - 1]; // U1..U4
    int pinCol  = PIN_OPTO_PC817[col - 1];  // U5..U8

    ultimoOptoAttivoMillis = millis();

    Serial.println("  --------------------------------------------------");
    Serial.print("  [8x PC817 PIAZZA COMUNE] Attivazione Tasto U");
    Serial.print(riga);
    Serial.print(" (GPIO ");
    Serial.print(pinRiga);
    Serial.print(") + U");
    Serial.print(col);
    Serial.print(" (GPIO ");
    Serial.print(pinCol);
    Serial.print(") per ");
    Serial.print(durationMs);
    Serial.println("ms...");

    // Accende i 2 LED degli optoisolatori (Pin 1 a HIGH, Pin 2 è a GND)
    digitalWrite(pinRiga, HIGH);
    digitalWrite(pinCol,  HIGH);

    delay(durationMs);

    // Ritorno a riposo (spenti)
    digitalWrite(pinRiga, LOW);
    digitalWrite(pinCol,  LOW);

    ultimoOptoAttivoMillis = millis();

    Serial.println("  [8x PC817 PIAZZA COMUNE] Contatto rilasciato (U1..U8 a riposo LOW).");
    Serial.println("  --------------------------------------------------");
  } else {
    Serial.println("  [ERRORE 8x PC817] I fili devono essere uno nel gruppo 1..4 e uno nel gruppo 5..8.");
  }
}

// Fallback / Alias per compatibilità
void simulaTastoMatrice(int filoA, int filoB, int durationMs = OPTO_DURATION_MS) {
  attivaTastoOptoPiazzaComune(filoA, filoB, durationMs);
}

// --- CONNESSIONE WI-FI (TIMEOUT RAPIDO - NON BLOCCA MAI IL DISTRIBUTORE) ---
void connettiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println();
  Serial.println("========================================================");
  Serial.print("  CONNESSIONE WI-FI A: ");
  Serial.println(WIFI_SSID);
  Serial.println("========================================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  // Attesa breve di massimo 3 secondi all'avvio. Se il Wi-Fi non risponde,
  // il distributore parte immediatamente al 100% in modalità offline locale!
  int tentativi = 0;
  while (WiFi.status() != WL_CONNECTED && tentativi < 10) {
    delay(300);
    Serial.print(".");
    digitalWrite(LED_STATUS, !digitalRead(LED_STATUS));
    tentativi++;
  }

  digitalWrite(LED_STATUS, LOW);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println(">>> WI-FI CONNESSO CON SUCCESSO! <<<");
    Serial.print(">>> Indirizzo IP Assegnato: ");
    Serial.println(WiFi.localIP().toString());
    Serial.print(">>> MAC Address Hardware:  ");
    Serial.println(WiFi.macAddress());
    Serial.print(">>> Segnale RSSI:          ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    inizializzaIdentitaHardware();
    Serial.println("========================================================\\n");
  } else {
    Serial.println();
    Serial.println(">>> [MODALITÀ OFFLINE ATTIVA]: Wi-Fi non connesso al boot.");
    Serial.println(">>> PRIORITÀ ASSOLUTA HARDWARE: Il distributore è 100% OPERATIVO.");
    Serial.println(">>> Le erogazioni locali funzionano regolarmente; la rete si riconnetterà in background.");
    Serial.println("========================================================\\n");
  }
}

// --- CONNESSIONE AL BROKER MQTT CON FALLBACK AUTOMATICO (NON BLOCCANTE) ---
int tentativiMqttFalliti = 0;

void riconnettiMQTT() {
  // Non tentare la connessione MQTT se il Wi-Fi non è collegato
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  const char* activeBroker = BROKER_LIST[currentBrokerIdx];
  Serial.println("--------------------------------------------------------");
  Serial.print("Tentativo connessione rapida MQTT [");
  Serial.print(currentBrokerIdx + 1);
  Serial.print("/");
  Serial.print(NUM_BROKERS);
  Serial.print("]: ");
  Serial.print(activeBroker);
  Serial.print(":");
  Serial.print(MQTT_PORT);
  Serial.println("...");

  mqttClient.setServer(activeBroker, MQTT_PORT);
  mqttClient.setBufferSize(1024);
  mqttClient.setSocketTimeout(2); // Timeout breve (2 secondi) per non bloccare mai la macchina
  mqttClient.setKeepAlive(60);
  mqttClient.setCallback(mqttCallback);

  String clientId = "GB-ESP32-" + String(WiFi.macAddress()) + "-" + String(random(0xffff), HEX);
  clientId.replace(":", "");

  // Last Will & Testament (LWT)
  String willTopic = String(TOPIC_STATUS);
  String willMsg = "{\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                 + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                 + "\\\"status\\\":\\\"OFFLINE\\\"}";

  if (mqttClient.connect(clientId.c_str(), willTopic.c_str(), 1, true, willMsg.c_str())) {
    Serial.println(">>> MQTT CONNESSO AL CLOUD CON SUCCESSO! <<<");
    Serial.print(">>> Broker Attivo: ");
    Serial.println(activeBroker);
    Serial.print(">>> Client ID:     ");
    Serial.println(clientId);
    tentativiMqttFalliti = 0;

    digitalWrite(LED_STATUS, HIGH);
    delay(100);
    digitalWrite(LED_STATUS, LOW);

    // Invio stato iniziale ONLINE al server
    String statusMsg = "{\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                     + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                     + "\\\"boardModel\\\":\\\"" + String(BOARD_MODEL) + "\\\","
                     + "\\\"status\\\":\\\"ONLINE\\\","
                     + "\\\"broker\\\":\\\"" + String(activeBroker) + "\\\","
                     + "\\\"ip\\\":\\\"" + WiFi.localIP().toString() + "\\\","
                     + "\\\"freeHeap\\\":" + String(ESP.getFreeHeap()) + ","
                     + "\\\"uptimeSec\\\":" + String(millis() / 1000) + ","
                     + "\\\"rssi\\\":" + String(WiFi.RSSI()) + "}";
    mqttClient.publish(TOPIC_STATUS.c_str(), statusMsg.c_str(), true);

    // Sottoscrizione univoca al topic comandi dedicato al modulo (Zero duplicazioni broker)
    mqttClient.subscribe(TOPIC_COMMANDS.c_str());
    Serial.print(">>> Sottoscrizione Topic Comandi Univoco: ");
    Serial.println(TOPIC_COMMANDS);
    Serial.println("========================================================\\n");

    // Sincronizzazione automatica al Cloud di eventuali erogazioni registrate offline
    svuotaCodaOffline();
  } else {
    tentativiMqttFalliti++;
    int errCode = mqttClient.state();
    Serial.print(">> [MQTT INFO] Tentativo non riuscito (rc=");
    Serial.print(errCode);
    Serial.println("). Il distributore continua a erogare regolarmente in locale.");

    if (tentativiMqttFalliti >= 2) {
      currentBrokerIdx = (currentBrokerIdx + 1) % NUM_BROKERS;
      Serial.print(">>> [AUTO-FALLBACK] Prossimo tentativo su Broker alternativo: ");
      Serial.println(BROKER_LIST[currentBrokerIdx]);
      tentativiMqttFalliti = 0;
    }
  }
}

// --- TRASMISSIONE EVENTO PRESSIONE TASTIERA VERSO MQTT (NON BLOCCANTE) ---
void inviaEventoMQTT(const TastoMatrice& t) {
  conteggioPressioni++;

  // 1. Log Seriale di debug della pressione rilevata
  Serial.println();
  Serial.println("================================================================");
  Serial.print(">>> [TASTIERA MEMBRANA FISICA] TASTO PREMUTO: ");
  Serial.println(t.nome);
  Serial.print(">>> Codice Tasto: '");
  Serial.print(t.keyChar);
  Serial.print("' | Matrice Tasto: Filo ");
  Serial.print(t.filoA);
  Serial.print(" <-> Filo ");
  Serial.println(t.filoB);
  Serial.print(">>> Modalità Erogazione: ");
  Serial.println(modalitaCaraffa ? "[DOSE CARAFFA]" : "[MONODOSE STANDARD]");
  Serial.print(">>> Pressioni Totali Registrate: ");
  Serial.println(conteggioPressioni);
  Serial.println("================================================================");

  // 2. Se Wi-Fi o MQTT non sono collegati, salviamo nel buffer circolare offline (Zero perdita battute)
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) {
    Serial.println(">> [OFFLINE]: Connessione Cloud non attiva. Erogazione hardware eseguita localmente con successo.");
    salvaEventoOffline(t, modalitaCaraffa);
    return;
  }

  // Se presenti, riversa prima eventuali eventi rimasti in coda durante disconnessioni temporanee
  if (codaCountOffline > 0) {
    svuotaCodaOffline();
  }

  // 3. Payload Telemetria Completo per l'App (quando online)
  String jsonPayload = "{\\\"key\\\":\\\"" + String(t.keyChar) + "\\\","
                     + "\\\"deviceId\\\":\\\"" + String(DEVICE_ID) + "\\\","
                     + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                     + "\\\"eventType\\\":\\\"pressed\\\","
                     + "\\\"nomeTasto\\\":\\\"" + String(t.nome) + "\\\","
                     + "\\\"productNum\\\":" + String(t.productNum) + ","
                     + "\\\"filoA\\\":" + String(t.filoA) + ","
                     + "\\\"filoB\\\":" + String(t.filoB) + ","
                     + "\\\"isCaraffa\\\":" + (modalitaCaraffa ? "true" : "false") + ","
                     + "\\\"rssi\\\":" + String(WiFi.RSSI()) + ","
                     + "\\\"freeHeap\\\":" + String(ESP.getFreeHeap()) + ","
                     + "\\\"uptimeSec\\\":" + String(millis() / 1000) + ","
                     + "\\\"totalPresses\\\":" + String(conteggioPressioni) + "}";

  bool okTel = mqttClient.publish(TOPIC_KEYLOG.c_str(), jsonPayload.c_str());
  if (okTel) {
    Serial.println(">> [MQTT TX] Singolo evento telemetria inviato con successo a: " + TOPIC_KEYLOG);
  } else {
    Serial.println(">> [MQTT INFO] Invio telemetria non riuscito.");
  }
}

// --- CALLBACK RICEZIONE COMANDI REMOTI VIA MQTT (DALL'APP AD ESP32) ---
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  conteggioComandiRicevuti++;

  Serial.println();
  Serial.println("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");
  Serial.print("<<< [MQTT COMANDO RICEVUTO DA APP] (N. ");
  Serial.print(conteggioComandiRicevuti);
  Serial.print(") sul Topic: ");
  Serial.println(topic);
  Serial.print("<<< Payload: ");
  Serial.println(message);
  Serial.println("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<");

  // --- CONTROLLO DI ESCLUSIVITA' HARDWARE (SICUREZZA MULTI-MACCHINA) ---
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
      Serial.println(">> [MQTT SICUREZZA]: Comando ignorato! Destinato ad un altro MAC hardware (questo modulo e' " + myMac + ")");
      return;
    }
  }

  String topicStr = String(topic);
  topicStr.toUpperCase();
  if (topicStr.indexOf("GB-CLOUD-") >= 0 && topicStr.indexOf(myCleanMac) < 0 && topicStr.indexOf(String(DEVICE_ID)) < 0) {
    Serial.println(">> [MQTT SICUREZZA]: Comando su topic altrui (" + topicStr + ") ignorato!");
    return;
  }

  // --- FILTRO ANTIDUPLICAZIONE COMANDI E PROTEZIONE DA DOPPIE EROGAZIONI ---
  // Storico ring-buffer degli ultimi commandId elaborati (8 slot)
  const int NUM_DEDUP_CMD = 8;
  static String storicoCommandId[NUM_DEDUP_CMD];
  static unsigned long storicoCommandMillis[NUM_DEDUP_CMD];
  static int dedupIdx = 0;
  static unsigned long ultimoComandoEseguitoMillis = 0;

  // Estrazione eventuale ID comando univoco
  String cmdId = "";
  int cIdIdx = message.indexOf("commandId");
  if (cIdIdx >= 0) {
    int colonIdx = message.indexOf(':', cIdIdx);
    if (colonIdx >= 0) {
      int endIdx = message.indexOf(',', colonIdx);
      if (endIdx < 0) endIdx = message.indexOf('}', colonIdx);
      if (endIdx > colonIdx) {
        cmdId = message.substring(colonIdx + 1, endIdx);
        cmdId.replace("\\\"", "");
        cmdId.replace("\\\\", "");
        cmdId.trim();
      }
    }
  }

  // Estrazione fili matrice wireA e wireB (necessari per rilevamento prioritario STOP)
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

  // Estrazione eventuale numero prodotto dal comando
  int pNum = 0;
  int pIdx = message.indexOf("productNumber");
  if (pIdx >= 0) {
    int colonIdx = message.indexOf(':', pIdx);
    if (colonIdx >= 0) pNum = message.substring(colonIdx + 1).toInt();
  }
  if (pNum == 0) {
    for (int i = 1; i <= 12; i++) {
      String pMatch = "\\\"P" + String(i) + "\\\"";
      if (message.indexOf(pMatch) >= 0) { pNum = i; break; }
    }
  }

  // Rilevamento immediato prioritario Tasto STOP (Bypass debounce ed antirimbalzo per sicurezza)
  // Controllo SELETTIVO su STOP (NON un generico "13" che intercetta timestamp o millisecondi!)
  bool isStopPrioritario = (message.indexOf("\\\"STOP\\\"") >= 0 || message.indexOf("\\\"EMERGENCY\\\"") >= 0 ||
                            pNum == 13 || (wireA == 4 && wireB == 7) || (wireA == 7 && wireB == 4) ||
                            (wireA == 2 && wireB == 5) || (wireA == 5 && wireB == 2) ||
                            message.indexOf("\\\"key\\\":\\\"0\\\"") >= 0 || message.indexOf("\\\"key\\\":\\\"STOP\\\"") >= 0);

  if (!isStopPrioritario) {
    // 1. Controllo storico commandId: scarta duplicati ricevuti entro 8 secondi
    if (cmdId.length() > 3) {
      for (int i = 0; i < NUM_DEDUP_CMD; i++) {
        if (storicoCommandId[i].length() > 3 && storicoCommandId[i] == cmdId && (millis() - storicoCommandMillis[i] < 8000)) {
          Serial.println(">>> [MQTT DEDUP]: Comando duplicato ignorato (stesso commandId gia' eseguito: " + cmdId + ")");
          return;
        }
      }
    }

    // 2. Interblocco hardware: se un optoisolatore e' attivo o e' stato attivato meno di 1500ms fa, scarta (evita doppio bip!)
    if (millis() - ultimoOptoAttivoMillis < 1500) {
      Serial.println(">>> [MQTT DEDUP]: Comando ignorato per interblocco opto (< 1500ms dall'ultimo impulso, evita doppio bip)");
      return;
    }

    // 3. Antirimbalzo temporale generale: minimo 1200ms tra comandi ordinari consecutivi
    if (millis() - ultimoComandoEseguitoMillis < 1200) {
      Serial.println(">>> [MQTT DEDUP]: Comando ignorato per finestra antirimbalzo (< 1200ms)");
      return;
    }
  } else {
    Serial.println(">>> [MQTT PRIORITÀ ZERO]: Rilevato comando di ARRESTO EMERGENZA (STOP)! Esecuzione immediata senza filtri.");
  }

  ultimoComandoEseguitoMillis = millis();
  if (cmdId.length() > 3) {
    storicoCommandId[dedupIdx] = cmdId;
    storicoCommandMillis[dedupIdx] = millis();
    dedupIdx = (dedupIdx + 1) % NUM_DEDUP_CMD;
  }

  // Lampeggio visivo di feedback sul LED integrato
  digitalWrite(LED_STATUS, HIGH);
  delay(80);
  digitalWrite(LED_STATUS, LOW);

  // Estrazione parametri comando dal JSON (gestione sia millisecondi che secondi se <= 10)
  int dur = OPTO_DURATION_MS;
  int durIdx = message.indexOf("durationMs");
  if (durIdx >= 0) {
    int colonIdx = message.indexOf(':', durIdx);
    if (colonIdx >= 0) {
      dur = message.substring(colonIdx + 1).toInt();
      if (dur > 0 && dur <= 10) dur = dur * 1000; // Se vengono passati secondi (es. 4), converte a 4000ms
      if (dur <= 0) dur = OPTO_DURATION_MS;
    }
  }

  // Supporto comando OTA remoto da Cloud via MQTT: {"action":"OTA_UPDATE","url":"http://..."}
  if (message.indexOf("OTA_UPDATE") >= 0 || message.indexOf("FIRMWARE_UPGRADE") >= 0) {
    String otaUrl = "";
    int urlIdx = message.indexOf("url");
    if (urlIdx >= 0) {
      int colonIdx = message.indexOf(':', urlIdx);
      if (colonIdx >= 0) {
        int endIdx = message.indexOf(',', colonIdx);
        if (endIdx < 0) endIdx = message.indexOf('}', colonIdx);
        if (endIdx > colonIdx) {
          otaUrl = message.substring(colonIdx + 1, endIdx);
          otaUrl.replace("\\\"", "");
          otaUrl.replace("\\\\", "");
          otaUrl.trim();
        }
      }
    }
    if (otaUrl.length() > 5) {
      String ackMsg = String("{\\\"action\\\":\\\"OTA_STARTING\\\",\\\"deviceId\\\":\\\"") + DEVICE_ID + "\\\",\\\"url\\\":\\\"" + otaUrl + "\\\"}";
      mqttClient.publish(TOPIC_STATUS.c_str(), ackMsg.c_str());
      eseguiOtaDaUrl(otaUrl);
      return;
    }
  }

  // Supporto test diretto pin optoisolatore da pannello Diagnostica/Flotta
  if (message.indexOf("TRIGGER_OPTO_PULSE") >= 0 || message.indexOf("TEST_PIN") >= 0) {
    int testPin = 19;
    int pinIdx = message.indexOf("pin");
    if (pinIdx >= 0) {
      int colonIdx = message.indexOf(':', pinIdx);
      if (colonIdx >= 0) testPin = message.substring(colonIdx + 1).toInt();
    }
    Serial.print("<<< [TEST OPTO LIVE]: Attivazione impulsiva su GPIO ");
    Serial.print(testPin);
    Serial.print(" per ");
    Serial.print(dur);
    Serial.println(" ms...");

    pinMode(testPin, OUTPUT);
    digitalWrite(testPin, HIGH);
    delay(dur);
    digitalWrite(testPin, LOW);

    String ackMsg = String("{\\\"action\\\":\\\"COMMAND_ACK\\\",\\\"status\\\":\\\"OPTO_TEST_OK\\\",\\\"pin\\\":") + String(testPin)
                  + ",\\\"durationMs\\\":" + String(dur) + ",\\\"deviceId\\\":\\\"" + DEVICE_ID + "\\\"}";
    mqttClient.publish(TOPIC_DISPENSE.c_str(), ackMsg.c_str());
    Serial.println("<<< [TEST OPTO]: Impulso completato e confermato via MQTT.");
    return;
  }

  // Riconoscimento dei 15 pulsanti ricevuti:
  
  // 1. TASTO STOP (Arresto Emergenza / Reset) -> Matrice esatta: U4 e U7 (Fili 4 e 7)
  bool isStop = (message.indexOf("STOP") >= 0 || message.indexOf("EMERGENCY") >= 0 || pNum == 13 ||
                 (wireA == 4 && wireB == 7) || (wireA == 7 && wireB == 4) || (message.indexOf("\\\"key\\\":\\\"0\\\"") >= 0) || (message.indexOf("\\\"key\\\":\\\"STOP\\\"") >= 0));

  // 2. TASTO CARAFFA (Modificatore Dose 10s) -> Matrice esatta: U4 e U6 (Fili 4 e 6)
  bool isCaraffa = (message.indexOf("CARAFFA") >= 0 || pNum == 14 ||
                    (wireA == 4 && wireB == 6) || (wireA == 6 && wireB == 4) || (message.indexOf("\\\"key\\\":\\\"*\\\"") >= 0));

  // 3. TASTO LINGUA (Cambio Lingua Display) -> Matrice esatta: U4 e U5 (Fili 4 e 5)
  bool isLingua = (message.indexOf("LINGUA") >= 0 || message.indexOf("LANGUAGE") >= 0 || pNum == 15 ||
                   (wireA == 4 && wireB == 5) || (wireA == 5 && wireB == 4) || (message.indexOf("\\\"key\\\":\\\"#\\\"") >= 0));

  if (isStop) {
    modalitaCaraffa = false;
    Serial.println("<<< [ESECUZIONE COMANDO]: 🛑 ARRESTO EMERGENZA (STOP) IMMEDIATO");
    // Spegnimento preventivo istantaneo di tutte le uscite opto per interrompere subito qualsiasi erogazione in corso
    for (int p = 0; p < 8; p++) {
      pinMode(PIN_OPTO_PC817[p], OUTPUT);
      digitalWrite(PIN_OPTO_PC817[p], LOW);
    }
    // Impulso rapido matrice U4+U7 (250ms) per garantire risposta fulminea senza bloccare la CPU
    int stopDur = (dur > 0 && dur <= 400) ? dur : 250;
    Serial.println("<<< Attivazione Opto U4 e U7 su Piazza Comune (Fili 4 e 7) per " + String(stopDur) + "ms...");
    attivaTastoOptoPiazzaComune(4, 7, stopDur);

    // Conferma esecuzione inviata al Cloud come ACK comando
    String ackMsg = "{\\\"action\\\":\\\"COMMAND_ACK\\\",\\\"status\\\":\\\"STOPPED\\\",\\\"command\\\":\\\"STOP\\\",\\\"commandId\\\":\\\"" + cmdId + "\\\",\\\"deviceId\\\":\\\"" + DEVICE_ID + "\\\"}";
    mqttClient.publish(TOPIC_DISPENSE.c_str(), ackMsg.c_str());
    Serial.println("<<< [CONFERMA MQTT] Inviata notifica di STOP al Cloud su: " + TOPIC_DISPENSE);
  }
  else if (isCaraffa) {
    modalitaCaraffa = true;
    caraffaTimerStart = millis();
    Serial.println("<<< [ESECUZIONE COMANDO]: 🏺 MODALITÀ CARAFFA ATTIVATA DA APP");
    Serial.println("<<< Finestra di 10 secondi avviata. Attivazione Opto U4 e U6 (Fili 4 e 6) per " + String(dur) + "ms...");
    attivaTastoOptoPiazzaComune(4, 6, dur);

    String ackMsg = "{\\\"action\\\":\\\"COMMAND_ACK\\\",\\\"status\\\":\\\"CARAFFA_PRESET\\\",\\\"command\\\":\\\"CARAFFA\\\",\\\"isCaraffa\\\":true,\\\"timeoutSec\\\":10,\\\"commandId\\\":\\\"" + cmdId + "\\\",\\\"deviceId\\\":\\\"" + DEVICE_ID + "\\\"}";
    mqttClient.publish(TOPIC_DISPENSE.c_str(), ackMsg.c_str());
    Serial.println("<<< [CONFERMA MQTT] Inviata notifica di Caraffa attiva al Cloud su: " + TOPIC_DISPENSE);
  }
  else if (isLingua) {
    Serial.println("<<< [ESECUZIONE COMANDO]: 🌐 CAMBIO LINGUA RICHIESTO DA APP");
    Serial.println("<<< Attivazione Opto U4 e U5 (Fili 4 e 5) per " + String(dur) + "ms...");
    attivaTastoOptoPiazzaComune(4, 5, dur);

    String ackMsg = "{\\\"action\\\":\\\"COMMAND_ACK\\\",\\\"status\\\":\\\"LANGUAGE_CYCLED\\\",\\\"command\\\":\\\"LINGUA\\\",\\\"commandId\\\":\\\"" + cmdId + "\\\",\\\"deviceId\\\":\\\"" + DEVICE_ID + "\\\"}";
    mqttClient.publish(TOPIC_DISPENSE.c_str(), ackMsg.c_str());
    Serial.println("<<< [CONFERMA MQTT] Inviata notifica di Cambio Lingua al Cloud su: " + TOPIC_DISPENSE);
  }
  else {
    // EROGAZIONE PRODOTTI P1 .. P12
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
      // Individua il tasto nella tabella
      const TastoMatrice* targetKey = nullptr;
      for (int i = 0; i < TOTALE_TASTI; i++) {
        if (TABELLA_TASTI[i].isBeverage && TABELLA_TASTI[i].productNum == pNum) {
          targetKey = &TABELLA_TASTI[i];
          break;
        }
      }

      if (targetKey != nullptr) {
        wireA = targetKey->filoA;
        wireB = targetKey->filoB;
      }

      Serial.print("<<< [ESECUZIONE COMANDO]: ☕ EROGAZIONE ");
      Serial.print(targetKey ? targetKey->nome : ("PRODOTTO P" + String(pNum)));
      Serial.println(modalitaCaraffa ? " [DOSE CARAFFA]" : " [MONODOSE STANDARD]");

      // Attivazione della coppia di Optoisolatori PC817 su Piazza Comune (Galvanicamente Isolati)
      if (wireA > 0 && wireB > 0) {
        attivaTastoOptoPiazzaComune(wireA, wireB, dur);
      }

      // 3. Pubblica conferma di erogazione su MQTT solo come ACK su TOPIC_DISPENSE (MAI su TOPIC_KEYLOG)
      String doneMsg = String("{\\\"action\\\":\\\"COMMAND_ACK\\\",")
                     + "\\\"status\\\":\\\"COMPLETED\\\","
                     + "\\\"productNum\\\":" + String(pNum) + ","
                     + "\\\"nomeTasto\\\":\\\"" + (targetKey ? String(targetKey->nome) : ("PRODOTTO " + String(pNum))) + "\\\","
                     + "\\\"isCaraffa\\\":" + (modalitaCaraffa ? "true" : "false") + ","
                     + "\\\"commandId\\\":\\\"" + cmdId + "\\\","
                     + "\\\"deviceId\\\":\\\"" + DEVICE_ID + "\\\"}";
      mqttClient.publish(TOPIC_DISPENSE.c_str(), doneMsg.c_str());
      Serial.println("<<< [CONFERMA MQTT] Notifica di erogazione completata inviata al Cloud su: " + TOPIC_DISPENSE);

      // Se era in modalità Caraffa, resetta a Monodose
      if (modalitaCaraffa) {
        modalitaCaraffa = false;
        Serial.println("<<< [CARAFFA COMPLETATA]: Ritorno automatico a Monodose standard.");
      }
    } else {
      Serial.println("<<< [INFO]: Messaggio MQTT generico o non mappato a nessun tasto.");
    }
  }
}

// --- MAPPATURA INGRESSI TASTIERA A MEMBRANA FISICA ---
// Il connettore a 8 poli della tastiera a membrana fisica è orientato con pinout 1<->8 (1↔8, 2↔7, 3↔6, 4↔5).
// Questa traduzione hardware degli ingressi garantisce la corrispondenza esatta di tutti i 15 tasti fisici.
inline int mappaFiloIngressoTastiera(int filoLogico) {
  return 9 - filoLogico;
}

// --- SCANSIONE MATRICE TASTIERA A MEMBRANA FISICA (8 FILI) ---
int scansionaTastoPremuto() {
  for (int i = 0; i < TOTALE_TASTI; i++) {
    // I fili logici del tasto i (1..8)
    int filoALogico = TABELLA_TASTI[i].filoA;
    int filoBLogico = TABELLA_TASTI[i].filoB;

    // Lettura dai pin fisici corretti della tastiera a membrana
    int filoAFisico = mappaFiloIngressoTastiera(filoALogico);
    int filoBFisico = mappaFiloIngressoTastiera(filoBLogico);

    int idxA = filoAFisico - 1;
    int idxB = filoBFisico - 1;

    int pinA = PIN_FILI[idxA];
    int pinB = PIN_FILI[idxB];

    // Scansione Direzione 1: Pin A -> OUTPUT LOW, leggi Pin B
    pinMode(pinA, OUTPUT);
    digitalWrite(pinA, LOW);
    delayMicroseconds(100);

    bool premuto = (digitalRead(pinB) == LOW);
    pinMode(pinA, INPUT_PULLUP);

    // Scansione Direzione 2 (anti-inversione o presenza diodi sulla matrice): Pin B -> OUTPUT LOW, leggi Pin A
    if (!premuto) {
      pinMode(pinB, OUTPUT);
      digitalWrite(pinB, LOW);
      delayMicroseconds(100);
      premuto = (digitalRead(pinA) == LOW);
      pinMode(pinB, INPUT_PULLUP);
    }

    if (premuto) {
      return i; // Tasto i rilevato a contatto chiuso
    }
  }
  return -1; // Nessun contatto chiuso rilevato
}

// --- INVIA DIAGNOSTICA / HEARTBEAT PERIODICO AL CLOUD ---
void inviaHeartbeat() {
  if (!mqttClient.connected()) return;

  String pingMsg = String("{\\\"deviceId\\\":\\\"") + DEVICE_ID + "\\\","
                 + "\\\"macAddress\\\":\\\"" + String(WiFi.macAddress()) + "\\\","
                 + "\\\"status\\\":\\\"ONLINE_READY\\\","
                 + "\\\"broker\\\":\\\"" + String(BROKER_LIST[currentBrokerIdx]) + "\\\","
                 + "\\\"uptimeSec\\\":" + String(millis() / 1000) + ","
                 + "\\\"rssi\\\":" + String(WiFi.RSSI()) + ","
                 + "\\\"freeHeap\\\":" + String(ESP.getFreeHeap()) + ","
                 + "\\\"totalPresses\\\":" + String(conteggioPressioni) + ","
                 + "\\\"totalCommands\\\":" + String(conteggioComandiRicevuti) + "}";

  mqttClient.publish(TOPIC_STATUS.c_str(), pingMsg.c_str());
  Serial.println(">> [HEARTBEAT] Diagnostica inviata al Cloud (Heap: " + String(ESP.getFreeHeap()) + " byte | Uptime: " + String(millis() / 1000) + "s)");
}

// --- SETUP HARDWARE E INIZIALIZZAZIONE ---
void setup() {
  Serial.begin(115200);
  delay(400);

  pinMode(LED_STATUS, OUTPUT);
  digitalWrite(LED_STATUS, LOW);

  // ============================================================================
  // 1. PRIORITÀ ASSOLUTA HARDWARE:
  // Inizializza IMMEDIATAMENTE le uscite optoisolate U1..U8 e gli ingressi tastiera.
  // In questo modo il distributore risponde ai tasti fin dal primo secondo di boot!
  // ============================================================================
  for (int i = 0; i < 8; i++) {
    pinMode(PIN_OPTO_PC817[i], OUTPUT);
    digitalWrite(PIN_OPTO_PC817[i], LOW); // A riposo tutti i pin opto sono OUTPUT a 0.00V (LED PC817 spenti)
  }

  for (int i = 0; i < 8; i++) {
    pinMode(PIN_FILI[i], INPUT_PULLUP);
  }
  Serial.println("\\n>>> [HARDWARE PRONTO]: Optoisolatori U1..U8 e Ingressi Tastiera INIZIALIZZATI.");
  Serial.println(">>> [HARDWARE] Ingressi Tastiera (8 pin INPUT_PULLUP) + Uscite Opto (8 pin OUTPUT LOW)");

  // 2. Inizializzazione Identità Hardware via MAC
  WiFi.mode(WIFI_STA);
  inizializzaIdentitaHardware();

  // 3. Connessione Wi-Fi rapida (timeout max 3s: se assente, la macchina parte comunque al 100% in locale)
  connettiWiFi();

  Serial.println("\\n================================================================");
  Serial.println("  ESP32 - MODULO GB-CLOUD: CONTROLLO 15 TASTI BIDIREZIONALE MQTT");
  Serial.println("================================================================");
  Serial.print("  Dispositivo:  "); Serial.println(DEVICE_ID);
  Serial.print("  Scheda Target:"); Serial.println(BOARD_MODEL);
  Serial.print("  Broker MQTT:  "); Serial.print(BROKER_LIST[0]); Serial.print(":"); Serial.println(MQTT_PORT);
  Serial.print("  Fallback:     "); Serial.print(BROKER_LIST[1]); Serial.print(":"); Serial.println(MQTT_PORT);
  Serial.println("----------------------------------------------------------------");
  Serial.println("  MAPPATURA HARDWARE DEI 15 TASTI COLLAUDATI:");
  for (int i = 0; i < TOTALE_TASTI; i++) {
    const TastoMatrice& t = TABELLA_TASTI[i];
    int pA = PIN_FILI[t.filoA - 1];
    int pB = PIN_FILI[t.filoB - 1];
    Serial.print("  [");
    if (i + 1 < 10) Serial.print(" ");
    Serial.print(i + 1);
    Serial.print("] ");
    Serial.print(t.nome);
    for (int s = strlen(t.nome); s < 38; s++) Serial.print(" ");
    Serial.print("-> Fili ");
    Serial.print(t.filoA);
    Serial.print("&");
    Serial.print(t.filoB);
    Serial.print(" (GPIO ");
    Serial.print(pA);
    Serial.print(" & ");
    Serial.print(pB);
    Serial.println(")");
  }
  Serial.println("================================================================\\n");

  // Inizializza client MQTT
  mqttClient.setServer(BROKER_LIST[currentBrokerIdx], MQTT_PORT);
  mqttClient.setBufferSize(1024);
  mqttClient.setCallback(mqttCallback);

  // Inizializza Aggiornamento Firmware Wireless OTA (Over-The-Air)
  inizializzaOTA();

  Serial.println(">>> SISTEMA PRONTO: Erogazioni locali hardware attive + Rete in background...\\n");
}

// --- LOOP PRINCIPALE ---
void loop() {
  unsigned long adesso = millis();

  // Gestione Over-The-Air (se connesso a Wi-Fi)
  if (WiFi.status() == WL_CONNECTED) {
    ArduinoOTA.handle();
  }

  // 1. Manutenzione Wi-Fi e MQTT in background COMPLETAMENTE NON BLOCCANTE
  // Non blocca MAI la scansione della tastiera o l'attivazione degli optoisolatori!
  static unsigned long ultimoCheckRete = 0;
  if (adesso - ultimoCheckRete >= 10000) {
    ultimoCheckRete = adesso;
    if (WiFi.status() != WL_CONNECTED) {
      WiFi.reconnect(); // Riconnessione asincrona non bloccante
    } else if (!mqttClient.connected()) {
      riconnettiMQTT(); // Tentativo singolo con timeout di 2s
    }
  }

  // Se connesso a MQTT, processa messaggi in arrivo dall'App
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
    mqttClient.loop();
  }

  // 2. Timeout automatico Modalità Caraffa (ritorno a Monodose standard dopo 10s se nessun prodotto è stato scelto)
  if (modalitaCaraffa && (adesso - caraffaTimerStart >= CARAFFA_TIMEOUT_MS)) {
    modalitaCaraffa = false;
    Serial.println(">>> [TIMEOUT CARAFFA 10s]: Nessuna bevanda selezionata. Ritorno automatico a Monodose standard.");
  }

  // 3. Scansione Matrice Tastiera a Membrana (PRIORITÀ ASSOLUTA, ESEGUITA CONTINUAMENTE)
  if (ABILITA_SCANSIONE_TASTIERA_LOCALE) {
    int tastoRilevato = scansionaTastoPremuto();

    if (statoTastiera == STATO_IDLE) {
      if (tastoRilevato >= 0) {
        // Finestra di lockout antirimbalzo: ignora qualsiasi rimbalzo nei primi 1200ms dal tocco precedente
        if (adesso - ultimoInvioMs < KEYPAD_LOCKOUT_MS) {
          // In periodo refrattario
        } else if (tastoRilevato == tastoCandidato) {
          conteggioCampioniPremuto++;
          if (conteggioCampioniPremuto >= CAMPIONI_MIN_PRESSIONE) {
            // Pressione stabile confermata (passati almeno 4 campioni e superato il lockout)
            statoTastiera = STATO_PREMUTO;
            ultimoInvioMs = adesso;
            conteggioCampioniRilascio = 0;

            const TastoMatrice& t = TABELLA_TASTI[tastoRilevato];
            digitalWrite(LED_STATUS, HIGH);

            // ============================================================================
            // ATTUAZIONE OPTOISOLATORE (Solo se configurato ponte/gateway serie):
            // In configurazione parallela standard, il distributore legge già il tasto
            // direttamente; attivare l'opto creerebbe un secondo impulso e un doppio bip!
            // ============================================================================
            if (SIMULA_OPTO_SU_PRESSIONE_FISICA && t.filoA >= 1 && t.filoB >= 1) {
              Serial.println(">> [EROGAZIONE HARDWARE GATEWAY] Chiusura contatto opto per: " + String(t.nome));
              attivaTastoOptoPiazzaComune(t.filoA, t.filoB, OPTO_DURATION_MS);
            } else {
              Serial.println(">> [TELEMETRIA TASTO FISICO] Tasto registrato: " + String(t.nome) + " (Opto non replicato per evitare doppio bip)");
            }

            // Gestione Tasti Funzione Locali
            if (t.productNum == 14) { // CARAFFA ('*')
              if (modalitaCaraffa) {
                modalitaCaraffa = false;
                Serial.println(">>> [CARAFFA ANNULLATA]: Ritorno a Monodose standard.");
              } else {
                modalitaCaraffa = true;
                caraffaTimerStart = adesso;
                Serial.println(">>> [MODALITÀ CARAFFA ATTIVATA]: Finestra di 10 secondi per selezionare un prodotto in dose aumentata.");
              }
            } else if (t.productNum == 13) { // STOP ('0')
              modalitaCaraffa = false;
              Serial.println(">>> [ARRESTO EMERGENZA (STOP)]: Modalità Caraffa resettata a Monodose.");
            } else if (t.productNum == 15) { // LINGUA ('#')
              Serial.println(">>> [CAMBIO LINGUA]: Richiesta cambio lingua inviata.");
            } else if (t.isBeverage && modalitaCaraffa) {
              modalitaCaraffa = false;
              Serial.println(">>> [CARAFFA COMPLETATA]: Modalità ripristinata automaticamente a Monodose standard.");
            }

            // Trasmette ESATTAMENTE UN SINGOLO evento MQTT all'App (senza duplicazioni)
            inviaEventoMQTT(t);
          }
        } else {
          // Nuovo contatto rilevato: avvia conteggio campioni di verifica
          tastoCandidato = tastoRilevato;
          conteggioCampioniPremuto = 1;
        }
      } else {
        tastoCandidato = -1;
        conteggioCampioniPremuto = 0;
      }
    } else if (statoTastiera == STATO_PREMUTO) {
      // Spegne il LED di feedback dopo 80ms
      if (adesso - ultimoInvioMs > 80) {
        digitalWrite(LED_STATUS, LOW);
      }

      // Attende sia il rilascio continuo del tasto (almeno 8 campioni = ~80ms)
      // sia il decorso della finestra di lockout di 1200ms prima di riarmare
      if (tastoRilevato == -1) {
        conteggioCampioniRilascio++;
        if (conteggioCampioniRilascio >= CAMPIONI_MIN_RILASCIO && (adesso - ultimoInvioMs >= KEYPAD_LOCKOUT_MS)) {
          statoTastiera = STATO_IDLE;
          tastoCandidato = -1;
          conteggioCampioniPremuto = 0;
          conteggioCampioniRilascio = 0;
          digitalWrite(LED_STATUS, LOW);
          Serial.println(">> [TASTO RILASCIATO & ARMATO] Tastiera pronta per il prossimo tocco.");
        }
      } else {
        conteggioCampioniRilascio = 0;
      }
    }
  }

  // 4. Svuotamento automatico coda offline e sincronizzazione non appena online
  static unsigned long ultimoSyncOffline = 0;
  if (codaCountOffline > 0 && WiFi.status() == WL_CONNECTED && mqttClient.connected() && (adesso - ultimoSyncOffline > 2000)) {
    ultimoSyncOffline = adesso;
    svuotaCodaOffline();
  }

  // 5. Invio Heartbeat diagnostico ogni 30 secondi (solo se connesso)
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected() && (adesso - ultimoHeartbeat > 30000)) {
    ultimoHeartbeat = adesso;
    inviaHeartbeat();
  }

  delay(10);
}
`;
}
