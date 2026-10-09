import { generateMqttRemoteFirmware } from '../data/arduinoSketches';
import { ArduinoSketchSettings } from '../types';

console.log('Testing firmware generator...');
const settings: ArduinoSketchSettings = {
  ssid: 'TestWiFi',
  password: 'TestPassword',
  serverUrl: 'mqtt://broker.hivemq.com:1883',
  deviceId: 'ESP32-TEST-01',
  targetMacAddress: 'AA:BB:CC:DD:EE:FF',
  targetBoardModel: 'Freenove ESP32-S3 WROOM-1',
  optoOutputPins: [14, 13, 12, 15, 16, 17, 18, 21],
  optoTriggerDurationMs: 400,
  debounceMs: 50,
  holdTimeMs: 1000,
  sendOnEachPress: true,
  pinSubmitChar: '#',
  pinClearChar: '*',
  useBuzzer: false,
  buzzerPin: 2,
  useRelay: false,
  relayPin: 4,
  waterPumpPin: 5,
  boilerValvePin: 18,
  mixerMotorPin: 19,
  pins: {
    row1: 4,
    row2: 5,
    row3: 6,
    row4: 7,
    col1: 8,
    col2: 9,
    col3: 10,
    col4: 11
  }
};

const code = generateMqttRemoteFirmware(settings);

if (!code || !code.includes('ESP32')) {
  throw new Error('Firmware generation test failed');
}

console.log('Firmware generator test passed! Code length:', code.length);
