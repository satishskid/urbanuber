/**
 * LocalSpeechToText — Browser-native speech recognition
 *
 * Uses Web Speech API for real-time transcription.
 * Zero cloud dependency, runs entirely in-browser.
 */

export class LocalSpeechToText {
  private recognition: any = null;
  private isInitialized = false;
  private isTranscribing = false;
  private finalTranscript = "";

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      throw new Error("Web Speech API not supported in this browser");
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.isInitialized = true;
  }

  /**
   * Start live transcription with callback for interim results
   */
  async startLive(onUpdate: (transcript: string) => void): Promise<void> {
    if (!this.isInitialized) await this.initialize();

    this.finalTranscript = "";
    this.isTranscribing = true;

    return new Promise((resolve, reject) => {
      this.recognition.onresult = (event: any) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.finalTranscript += t + " ";
          } else {
            interim += t;
          }
        }

        onUpdate(this.finalTranscript + interim);
      };

      this.recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          reject(new Error("Microphone permission denied"));
        } else if (event.error !== "no-speech") {
          console.warn("[LocalSTT] Error:", event.error);
        }
      };

      this.recognition.onend = () => {
        if (this.isTranscribing) {
          try {
            this.recognition.start();
          } catch {
            /* already running */
          }
        }
      };

      this.recognition.onstart = () => resolve();

      try {
        this.recognition.start();
      } catch (err) {
        reject(err);
      }
    });
  }

  async stop(): Promise<string> {
    this.isTranscribing = false;

    return new Promise((resolve) => {
      this.recognition.onend = () => resolve(this.finalTranscript.trim());
      try {
        this.recognition.stop();
      } catch {
        resolve(this.finalTranscript.trim());
      }
    });
  }

  getTranscript(): string {
    return this.finalTranscript.trim();
  }

  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      !!(
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
      )
    );
  }
}
