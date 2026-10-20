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


    async generateQuestion(
        questionNumber,
        onAudio,
        context = {}
    ) {

        const sentenceBuffer =
            new SentenceBuffer();

        let completeQuestion = "";


        await this.llmService.generateQuestion(

            questionNumber,

            async (token) => {

                completeQuestion += token;


                const sentence =
                    sentenceBuffer.add(
                        token
                    );


                if (!sentence) {
                    return;
                }


                try {
                    const audio =
                        await this.ttsService.speak(
                            sentence
                        );

                    if (audio && onAudio) {
                        await onAudio(
                            audio,
                            sentence
                        );
                    }
                } catch (error) {
                    console.error(
                        "TTS synthesis warning:",
                        error.message
                    );
                }
            },

            context
        );


        const remaining =
            sentenceBuffer.flush();


        if (remaining) {

            try {
                const audio =
                    await this.ttsService.speak(
                        remaining
                    );

                if (audio && onAudio) {
                    await onAudio(
                        audio,
                        remaining
                    );
                }
            } catch (error) {
                console.error(
                    "TTS flush warning:",
                    error.message
                );
            }
        }


        return completeQuestion.trim();
    }


    async generateNextQuestion(
        question,
        answer,
        questionNumber,
        onAudio,
        context = {}
    ) {

        const sentenceBuffer =
            new SentenceBuffer();

        let completeQuestion = "";


        await this.llmService.generateNextQuestion(

            question,
            answer,
            questionNumber,

            async (token) => {

                completeQuestion += token;


                const sentence =
                    sentenceBuffer.add(
                        token
                    );


                if (!sentence) {
                    return;
                }


                try {
                    const audio =
                        await this.ttsService.speak(
                            sentence
                        );

                    if (audio && onAudio) {
                        await onAudio(
                            audio,
                            sentence
                        );
                    }
                } catch (error) {
                    console.error(
                        "TTS synthesis warning:",
                        error.message
                    );
                }
            },

            context
        );


        const remaining =
            sentenceBuffer.flush();


        if (remaining) {

            try {
                const audio =
                    await this.ttsService.speak(
                        remaining
                    );

                if (audio && onAudio) {
                    await onAudio(
                        audio,
                        remaining
                    );
                }
            } catch (error) {
                console.error(
                    "TTS flush warning:",
                    error.message
                );
            }
        }


        return completeQuestion.trim();
    }
}


module.exports =
    QuestionService;