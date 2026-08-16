export class SpeechRecognitionService {

    constructor() {

        const SpeechRecognition =
            window.SpeechRecognition ||
            window.webkitSpeechRecognition;

        if (!SpeechRecognition) {

            throw new Error(
                "Speech Recognition is not supported."
            );
        }

        this.recognition =
            new SpeechRecognition();

        this.recognition.continuous = true;

        this.recognition.interimResults = true;

        this.recognition.lang = "en-US";

        this.finalTranscript = "";

        this.onFinalResult = null;

        this.onInterimResult = null;

        this.onEnd = null;

        this.onError = null;


        // Bind events

        this.recognition.onresult =
            this.handleResult.bind(this);

        this.recognition.onend =
            () => {

                if (this.onEnd) {
                    this.onEnd();
                }

            };

        this.recognition.onerror =
            (event) => {

                if (this.onError) {
                    this.onError(event.error);
                }

            };
    }


    handleResult(event) {

        let interimTranscript = "";


        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const transcript =
                event.results[i][0].transcript;


            if (event.results[i].isFinal) {

                this.finalTranscript +=
                    transcript;

            } else {

                interimTranscript +=
                    transcript;
            }
        }


        if (this.onFinalResult) {

            this.onFinalResult(
                this.finalTranscript
            );
        }


        if (this.onInterimResult) {

            this.onInterimResult(
                interimTranscript
            );
        }
    }


    start() {

        this.finalTranscript = "";

        this.recognition.start();
    }


    stop() {

        this.recognition.stop();
    }


    getTranscript() {

        return this.finalTranscript.trim();
    }
}