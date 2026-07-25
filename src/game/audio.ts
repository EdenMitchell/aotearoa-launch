export class ProceduralAudio {
  private context?: AudioContext;

  constructor(private readonly isMuted: () => boolean) {}

  tile(): void {
    this.tone(480, 640, 0.07, "sine", 0.035);
  }

  weight(): void {
    this.tone(150, 105, 0.09, "square", 0.026);
    this.noise(0.035, 0.018);
  }

  launch(): void {
    this.tone(170, 520, 0.22, "sawtooth", 0.045);
  }

  impact(): void {
    this.noise(0.09, 0.04);
    this.tone(120, 80, 0.12, "square", 0.025);
  }

  success(): void {
    this.chord([523, 659, 784], 0.3, 0.035);
  }

  blitz(): void {
    this.chord([392, 523, 659, 784], 0.42, 0.04);
  }

  finale(): void {
    this.chord([262, 392, 523, 659], 0.65, 0.045);
  }

  unlock(): void {
    this.chord([659, 784, 988], 0.45, 0.035);
  }

  private ensureContext(): AudioContext | undefined {
    if (this.isMuted() || typeof window === "undefined" || !window.AudioContext) {
      return undefined;
    }
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    return this.context;
  }

  private tone(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    delay = 0,
  ): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  private chord(frequencies: readonly number[], duration: number, volume: number): void {
    frequencies.forEach((frequency, index) => {
      this.tone(frequency, frequency * 1.03, duration, "triangle", volume, index * 0.055);
    });
  }

  private noise(duration: number, volume: number): void {
    const context = this.ensureContext();
    if (!context) {
      return;
    }
    const frames = Math.ceil(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frames; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(gain).connect(context.destination);
    source.start();
  }
}
