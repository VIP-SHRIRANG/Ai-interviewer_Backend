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

        this.interimTranscript = "";

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

        let currentInterim = "";


        for (
            let i = event.resultIndex;
            i < event.results.length;
            i++
        ) {

            const transcript =
                event.results[i][0].transcript;


            if (event.results[i].isFinal) {

                this.finalTranscript +=
                    (this.finalTranscript ? " " : "") +
                    transcript.trim();

            } else {

                currentInterim +=
                    transcript;
            }
        }

        this.interimTranscript =
            currentInterim.trim();


        if (this.onFinalResult) {

            this.onFinalResult(
                this.finalTranscript
            );
        }


        if (this.onInterimResult) {

            this.onInterimResult(
                this.interimTranscript
            );
        }
    }


    start() {

        this.finalTranscript = "";

        this.interimTranscript = "";

        this.recognition.start();
    }


    stop() {

        this.recognition.stop();
    }


    getTranscript() {

        return (
            this.finalTranscript +
            (this.interimTranscript ? " " + this.interimTranscript : "")
        ).trim();
    }
}