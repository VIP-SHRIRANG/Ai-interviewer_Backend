
export class AudioPlayer {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.currentAudio = null;
  }

  enqueue(base64Audio) {
    if (!base64Audio) return;

    this.queue.push(base64Audio);
    this.playNext();
  }

  // Alias for compatibility with callers using play().
  play(base64Audio) {
    this.enqueue(base64Audio);
  }

  async playNext() {
    if (this.isPlaying || this.queue.length === 0) return;

    this.isPlaying = true;
    const base64Audio = this.queue.shift();

    try {
      const cleanBase64 = base64Audio
        .replace(/^data:audio\/[^;]+;base64,/, "")
        .replace(/\s/g, "");

      const binary = atob(cleanBase64);
      const bytes = new Uint8Array(binary.length);

      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      this.currentAudio = audio;

      await new Promise((resolve, reject) => {
        audio.onended = resolve;
        audio.onerror = () => reject(new Error("Audio playback failed."));

        audio.play().catch(reject);
      });

      URL.revokeObjectURL(audioUrl);
    } catch (error) {
      console.error("Audio playback error:", error);
    } finally {
      this.currentAudio = null;
      this.isPlaying = false;

      if (this.queue.length > 0) {
        this.playNext();
      }
    }
  }

  stop() {
    this.queue = [];

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }

    this.isPlaying = false;
  }
}
