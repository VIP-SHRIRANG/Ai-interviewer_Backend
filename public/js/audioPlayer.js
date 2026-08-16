export class AudioPlayer {

    constructor() {

        this.queue = [];

        this.isPlaying = false;

        this.currentAudio = null;
    }


    addAudio(base64Audio) {

        this.queue.push(base64Audio);

        this.playNext();
    }


    async playNext() {

        if (this.isPlaying) {
            return;
        }

        if (this.queue.length === 0) {
            return;
        }


        this.isPlaying = true;


        const base64Audio =
            this.queue.shift();


        try {

            const binary =
                atob(base64Audio);


            const bytes =
                new Uint8Array(
                    binary.length
                );


            for (
                let i = 0;
                i < binary.length;
                i++
            ) {

                bytes[i] =
                    binary.charCodeAt(i);
            }


            const blob =
                new Blob(
                    [bytes],
                    {
                        type: "audio/mpeg"
                    }
                );


            const url =
                URL.createObjectURL(blob);


            this.currentAudio =
                new Audio(url);


            this.currentAudio.onended =
                () => {

                    URL.revokeObjectURL(url);

                    this.currentAudio = null;

                    this.isPlaying = false;

                    this.playNext();
                };


            this.currentAudio.onerror =
                () => {

                    URL.revokeObjectURL(url);

                    this.currentAudio = null;

                    this.isPlaying = false;

                    this.playNext();
                };


            await this.currentAudio.play();

        } catch (error) {

            console.error(
                "Audio playback error:",
                error
            );

            this.isPlaying = false;

            this.currentAudio = null;

            this.playNext();
        }
    }


    stop() {

        if (this.currentAudio) {

            this.currentAudio.pause();

            this.currentAudio.currentTime = 0;

            this.currentAudio = null;
        }


        this.queue = [];

        this.isPlaying = false;
    }
}