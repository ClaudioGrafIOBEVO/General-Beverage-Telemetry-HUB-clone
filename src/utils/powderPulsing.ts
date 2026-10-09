/**
 * Algoritmo di calcolo sequenza impulsi per coclea polveri
 * Basato sui parametri di taratura della macchina:
 * T = tempo totale acqua (ms)
 * T1 = testa / pre-bagnatura acqua (ms)
 * T2 = coda / risciacquo finale acqua (ms)
 * T4 = tempo utile per erogazione polvere = T - T1 - T2 (ms)
 * TonTot = tempo totale marcia coclea (ms)
 * Tmi = durata minima ammessa per impulso coclea (ms, default 300ms)
 * targetPulses = numero di impulsi desiderati (default 4)
 */

export interface PulseInterval {
  startMs: number; // millisecondo relativo all'inizio erogazione
  durationMs: number;
}

export interface PowderSchedule {
  T_totalWaterMs: number;
  T1_headWaterMs: number;
  T2_tailWaterMs: number;
  T4_powderWindowMs: number;
  TonTot_powderMs: number;
  Tmi_minPulseMs: number;
  pulseCount: number;
  pulses: PulseInterval[];
  pauseBetweenMs: number;
}

export function computePowderSchedule(
  T_sec: number,
  T1_sec: number,
  T2_sec: number,
  TonTot_sec: number,
  Tmi_ms: number = 300,
  targetPulses: number = 4
): PowderSchedule {
  const T = Math.round(T_sec * 1000);
  const T1 = Math.round(T1_sec * 1000);
  const T2 = Math.round(T2_sec * 1000);
  const TonTot = Math.round(TonTot_sec * 1000);
  const Tmi = Math.max(100, Math.round(Tmi_ms));

  // T4: Finestra utile
  const T4 = Math.max(0, T - T1 - T2);

  // Se la finestra T4 o il tempo coclea sono nulli o negativi
  if (T4 <= 0 || TonTot <= 0) {
    return {
      T_totalWaterMs: T,
      T1_headWaterMs: T1,
      T2_tailWaterMs: T2,
      T4_powderWindowMs: T4,
      TonTot_powderMs: 0,
      Tmi_minPulseMs: Tmi,
      pulseCount: 0,
      pulses: [],
      pauseBetweenMs: 0,
    };
  }

  // Se il tempo totale coclea eccede la finestra utile, lo limitiamo per sicurezza
  const clampedTonTot = Math.min(TonTot, T4);

  // Determina il numero massimo di impulsi ammissibili tale che ogni impulso >= Tmi
  let N = Math.max(1, targetPulses);
  while (N > 1 && clampedTonTot / N < Tmi) {
    N--;
  }

  const basePulseDuration = Math.floor(clampedTonTot / N);
  let remainder = clampedTonTot - basePulseDuration * N;

  // Calcola le durate dei singoli impulsi
  const pulseDurations: number[] = [];
  for (let i = 0; i < N; i++) {
    pulseDurations.push(basePulseDuration);
  }

  // Gestione del resto (se residuo < Tmi viene sommato all'ultimo impulso)
  if (remainder > 0) {
    if (remainder < Tmi && pulseDurations.length > 0) {
      // Viene allegato all'ultimo impulso
      pulseDurations[pulseDurations.length - 1] += remainder;
    } else {
      // Se fosse >= Tmi (raro con la divisione), distribuisci sui primi
      pulseDurations[0] += remainder;
    }
  }

  // Calcolo delle pause tra gli impulsi all'interno della finestra T4
  // Spazio totale disponibile per le pause = T4 - clampedTonTot
  const totalPauseTime = Math.max(0, T4 - clampedTonTot);
  const pauseCount = N > 1 ? N - 1 : 1;
  const pauseBetweenMs = N > 1 ? Math.floor(totalPauseTime / pauseCount) : 0;

  // Genera intervalli temporali assoluti
  const pulses: PulseInterval[] = [];
  let currentStart = T1; // La polvere parte subito dopo la testa T1

  for (let i = 0; i < pulseDurations.length; i++) {
    const dur = pulseDurations[i];
    pulses.push({
      startMs: currentStart,
      durationMs: dur,
    });
    currentStart += dur + pauseBetweenMs;
  }

  return {
    T_totalWaterMs: T,
    T1_headWaterMs: T1,
    T2_tailWaterMs: T2,
    T4_powderWindowMs: T4,
    TonTot_powderMs: clampedTonTot,
    Tmi_minPulseMs: Tmi,
    pulseCount: pulses.length,
    pulses,
    pauseBetweenMs,
  };
}
