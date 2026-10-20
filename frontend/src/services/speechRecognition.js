export class SpeechRecognitionService {
  constructor() {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition ||
          window.webkitSpeechRecognition
        : null;

    this.recognition = SpeechRecognition
      ? new SpeechRecognition()
      : null;

    this.isListening = false;
    this.onResult = null;
    this.onError = null;
    this.restartRequested = false;
    this.lastTranscript = "";

    if (this.recognition) {
      this.recognition.lang = "en-US";
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event) => {
        let transcript = "";

        // Read the complete transcript so previous words aren't lost.
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];

          if (result && result[0]) {
            transcript += result[0].transcript + " ";
          }
        }

        transcript = transcript.trim();

        if (transcript && transcript !== this.lastTranscript) {
          this.lastTranscript = transcript;
          this.onResult?.(transcript);
        }
      };

      this.recognition.onerror = (event) => {
        const errorCode = event?.error || "unknown";

        // "no-speech" can happen if you pause before speaking.
        if (errorCode === "no-speech") {
          return;
        }

        this.isListening = false;

        const messages = {
          "not-allowed":
            "Microphone permission is blocked. Allow microphone access in Chrome site settings.",
          "service-not-allowed":
            "Speech recognition is blocked by the browser. Check your microphone and browser permissions.",
          "audio-capture":
            "No microphone was detected. Connect or enable your microphone.",
          network:
            "Speech recognition needs a network connection. Check your internet and try again.",
          "language-not-supported":
            "The selected speech recognition language is not supported.",
          aborted:
            "Speech recognition was stopped.",
        };

        this.onError?.(
          messages[errorCode] ||
            `Speech recognition error: ${errorCode}`
        );
      };

      this.recognition.onend = () => {
        this.isListening = false;

        // Do not automatically restart here. The user can start it again
        // if the browser stops listening.
      };
    }
  }

  start(onResult, onError) {
    if (!this.recognition) {
      throw new Error(
        "Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge."
      );
    }

    if (this.isListening) {
      return;
    }

    if (typeof onResult === "function") {
      this.onResult = onResult;
    }

    if (typeof onError === "function") {
      this.onError = onError;
    }

    this.lastTranscript = "";
    this.isListening = true;

    try {
      this.recognition.start();
    } catch (error) {
      this.isListening = false;

      if (error?.name === "InvalidStateError") {
        throw new Error(
          "The microphone is already starting or running. Click Stop listening, then try again."
        );
      }

      throw error;
    }
  }

  stop() {
    if (!this.recognition) {
      this.isListening = false;
      return;
    }

    this.isListening = false;

    try {
      this.recognition.stop();
    } catch {
      // Recognition may already have stopped.
    }
  }
}
