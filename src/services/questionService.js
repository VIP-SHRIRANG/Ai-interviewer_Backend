const SentenceBuffer =
    require("../utils/sentenceBuffer");


class QuestionService {

    constructor(
        llmService,
        ttsService
    ) {

        this.llmService =
            llmService;

        this.ttsService =
            ttsService;
    }


    async speakText(
        text,
        onAudio
    ) {

        if (!text || !onAudio) {
            return;
        }

        const sentenceBuffer =
            new SentenceBuffer();

        const sentence =
            sentenceBuffer.add(text + " ");

        if (sentence) {
            try {
                const audio =
                    await this.ttsService.speak(
                        sentence
                    );

                if (audio) {
                    await onAudio(
                        audio,
                        sentence
                    );
                }
            } catch (error) {
                console.error(
                    "TTS speakText error:",
                    error.message
                );
            }
        }

        const remaining =
            sentenceBuffer.flush();

        if (remaining) {
            try {
                const audio =
                    await this.ttsService.speak(
                        remaining
                    );

                if (audio) {
                    await onAudio(
                        audio,
                        remaining
                    );
                }
            } catch (error) {
                console.error(
                    "TTS speakText flush error:",
                    error.message
                );
            }
        }
    }


    // Shared by the first and the following questions.
    // - collects the question text
    // - starts the audio for each sentence as soon as it is complete (in parallel)
    // - sends the audio in order, while the text is announced without waiting for it
    async _generate(
        run,
        onAudio,
        onQuestionText
    ) {

        const sentenceBuffer =
            new SentenceBuffer();

        let completeQuestion = "";

        let sendChain =
            Promise.resolve();

        const queueSpeech = (sentence) => {

            // Synthesis starts now; delivery order is kept by the chain below
            const job =
                Promise.resolve()
                    .then(() => this.ttsService.speak(sentence))
                    .catch((error) => {
                        console.error(
                            "TTS synthesis warning:",
                            error.message
                        );
                        return null;
                    });

            sendChain =
                sendChain.then(async () => {

                    const audio =
                        await job;

                    if (audio && onAudio) {
                        await onAudio(
                            audio,
                            sentence
                        );
                    }
                }).catch((error) => {
                    console.error(
                        "Audio delivery warning:",
                        error.message
                    );
                });
        };


        await run(async (token) => {

            completeQuestion += token;

            const sentence =
                sentenceBuffer.add(token);

            if (sentence) {
                queueSpeech(sentence);
            }
        });


        const remaining =
            sentenceBuffer.flush();

        if (remaining) {
            queueSpeech(remaining);
        }


        const question =
            completeQuestion.trim();

        // The text is final: let the caller show it before the audio finishes
        if (onQuestionText) {
            await onQuestionText(question);
        }

        await sendChain;

        return question;
    }


    async generateQuestion(
        questionNumber,
        onAudio,
        context = {},
        onQuestionText = null
    ) {

        return this._generate(
            (onToken) =>
                this.llmService.generateQuestion(
                    questionNumber,
                    onToken,
                    context
                ),
            onAudio,
            onQuestionText
        );
    }


    async generateNextQuestion(
        question,
        answer,
        questionNumber,
        onAudio,
        context = {},
        onQuestionText = null
    ) {

        return this._generate(
            (onToken) =>
                this.llmService.generateNextQuestion(
                    question,
                    answer,
                    questionNumber,
                    onToken,
                    context
                ),
            onAudio,
            onQuestionText
        );
    }
}


module.exports =
    QuestionService;