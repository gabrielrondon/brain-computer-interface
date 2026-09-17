import { BiologicalSignalSimulator, SimulationPreset } from '@cortex-bci/simulator';

export interface FrameCallback {
  (frame: number[], timestampMs: number): void;
}

export interface HardwareTransport {
  readonly name: string;
  readonly isConnected: boolean;
  readonly sampleRate: number;
  readonly channelNames: string[];
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onFrame(callback: FrameCallback): () => void;
}

/**
 * High-resolution Simulator Transport providing zero-hardware execution.
 */
export class SimulatorTransport implements HardwareTransport {
  readonly name = 'Synthetic Biological Simulator';
  readonly sampleRate = 256;
  readonly channelNames = ['TP9', 'AF7', 'AF8', 'TP10'];
  private connected = false;
  private simulator: BiologicalSignalSimulator;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<FrameCallback> = new Set();

  constructor(initialPreset: SimulationPreset = 'ACTIVE_FOCUS') {
    this.simulator = new BiologicalSignalSimulator({
      sampleRate: this.sampleRate,
      preset: initialPreset,
      blinkIntervalSeconds: 4.0,
    });
  }

  get isConnected(): boolean {
    return this.connected;
  }

  public setPreset(preset: SimulationPreset): void {
    this.simulator.setPreset(preset);
  }

  public triggerBlink(): void {
    this.simulator.triggerBlink();
  }

  public triggerJawClench(): void {
    this.simulator.triggerJawClench();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;

    // Emulate 256 Hz in batches of 4 samples every 15.625 ms (approx 64 FPS chunk dispatch)
    const intervalMs = 16;
    const samplesPerTick = 4;

    this.timerId = setInterval(() => {
      if (!this.connected) return;
      const now = performance.now();
      for (let i = 0; i < samplesPerTick; i++) {
        const frame = this.simulator.nextFrame();
        for (const cb of this.subscribers) {
          cb(frame, now);
        }
      }
    }, intervalMs);
  }

  async disconnect(): Promise<void> {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.connected = false;
  }

  onFrame(callback: FrameCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

/**
 * Muse 2 / Muse S Web-Bluetooth GATT transport.
 * Communicates directly with consumer Muse headbands via browser Web-Bluetooth.
 */
export class MuseBluetoothTransport implements HardwareTransport {
  readonly name = 'Muse Headband (Web-Bluetooth)';
  readonly sampleRate = 256;
  readonly channelNames = ['TP9', 'AF7', 'AF8', 'TP10'];

  private connected = false;
  private subscribers: Set<FrameCallback> = new Set();
  private bluetoothDevice: any = null;
  private gattServer: any = null;

  // Muse GATT UUIDs
  static readonly SERVICE_UUID = '0000fe8d-0000-1000-8000-00805f9b34fb';
  static readonly CHARACTERISTICS = {
    TP9: '273e0003-4c4d-454d-96be-f03bac821358',
    AF7: '273e0004-4c4d-454d-96be-f03bac821358',
    AF8: '273e0005-4c4d-454d-96be-f03bac821358',
    TP10: '273e0006-4c4d-454d-96be-f03bac821358',
    CONTROL: '273e0001-4c4d-454d-96be-f03bac821358',
  };

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (typeof navigator === 'undefined' || !(navigator as any).bluetooth) {
      throw new Error('Web-Bluetooth API is not supported in this browser. Please use Chrome/Edge or enable flags.');
    }

    const navBluetooth = (navigator as any).bluetooth;

    this.bluetoothDevice = await navBluetooth.requestDevice({
      filters: [{ namePrefix: 'Muse' }],
      optionalServices: [MuseBluetoothTransport.SERVICE_UUID],
    });

    this.gattServer = await this.bluetoothDevice.gatt.connect();
    const service = await this.gattServer.getPrimaryService(MuseBluetoothTransport.SERVICE_UUID);

    // Subscribe to the 4 electrode characteristics
    const channelKeys: (keyof typeof MuseBluetoothTransport.CHARACTERISTICS)[] = [
      'TP9',
      'AF7',
      'AF8',
      'TP10',
    ];

    for (let chIdx = 0; chIdx < channelKeys.length; chIdx++) {
      const charUuid = MuseBluetoothTransport.CHARACTERISTICS[channelKeys[chIdx]];
      const characteristic = await service.getCharacteristic(charUuid);
      await characteristic.startNotifications();

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value: DataView = event.target.value;
        this.parseMusePacket(chIdx, value);
      });
    }

    // Start streaming by writing command to control characteristic
    const controlChar = await service.getCharacteristic(MuseBluetoothTransport.CHARACTERISTICS.CONTROL);
    const startCmd = new Uint8Array([0x02, 0x64, 0x0a]); // 'd\n' resume command
    await controlChar.writeValue(startCmd);

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    this.connected = false;
  }

  onFrame(callback: FrameCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Decodes Muse 12-bit packed biological samples.
   * Muse packets contain 16-bit packet index followed by twelve 12-bit samples.
   */
  private parseMusePacket(channelIndex: number, value: DataView): void {
    if (value.byteLength < 20) return;

    // 12 samples of 12-bit integers packed into 18 bytes
    const samples: number[] = [];
    for (let i = 2; i < 20; i += 3) {
      const b0 = value.getUint8(i);
      const b1 = value.getUint8(i + 1);
      const b2 = value.getUint8(i + 2);

      const s0 = (b0 << 4) | (b1 >> 4);
      const s1 = ((b1 & 0x0f) << 8) | b2;

      // Scale to microvolts: Muse ADC scale factor is 0.48828125 uV/LSB with 0.82V ref
      samples.push((s0 - 2048) * 0.48828125);
      samples.push((s1 - 2048) * 0.48828125);
    }

    const now = performance.now();
    for (const sample of samples) {
      // Build sparse 4-channel frame
      const frame = [0, 0, 0, 0];
      frame[channelIndex] = sample;
      for (const cb of this.subscribers) {
        cb(frame, now);
      }
    }
  }
}

/**
 * WebSocket transport connecting to local Lab Streaming Layer (LSL) or OpenBCI bridges.
 */
export class WebSocketLslTransport implements HardwareTransport {
  readonly name = 'WebSocket / LSL Research Stream';
  readonly sampleRate = 250;
  readonly channelNames = ['CH1', 'CH2', 'CH3', 'CH4'];

  private socket: WebSocket | null = null;
  private connected = false;
  private subscribers: Set<FrameCallback> = new Set();
  private url: string;

  constructor(url = 'ws://localhost:8080/eeg') {
    this.url = url;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);
        this.socket.binaryType = 'arraybuffer';

        this.socket.onopen = () => {
          this.connected = true;
          resolve();
        };

        this.socket.onerror = () => {
          reject(new Error(`WebSocket connection failed to ${this.url}`));
        };

        this.socket.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const data = JSON.parse(event.data);
              if (Array.isArray(data.frame)) {
                for (const cb of this.subscribers) {
                  cb(data.frame, performance.now());
                }
              }
            } catch {}
          }
        };

        this.socket.onclose = () => {
          this.connected = false;
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
  }

  onFrame(callback: FrameCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}
