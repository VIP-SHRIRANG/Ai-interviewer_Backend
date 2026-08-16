const SentenceBuffer =
    require("../utils/sentenceBuffer");

class InterviewService {

    constructor(llmService, ttsService) {

        this.llmService =
            llmService;

        this.ttsService =
            ttsService;
    }

    async processQuestion(
        question,
        onAudio,
        signal
    ) {

        const sentenceBuffer =
            new SentenceBuffer();

        let completeAnswer = "";


        await this.llmService.generateAnswer(

            question,

            async token => {

                completeAnswer += token;

                const sentence =
                    sentenceBuffer.add(token);

                if (!sentence) {
                    return;
                }

                const audio =
                    await this.ttsService.speak(
                        sentence
                    );

                await onAudio(
                    audio,
                    sentence
                );
            },

            signal
        );


        const remaining =
            sentenceBuffer.flush();


        if (remaining) {

            const audio =
                await this.ttsService.speak(
                    remaining
                );

            await onAudio(
                audio,
                remaining
            );
        }


        return completeAnswer;
    }
}

module.exports = InterviewService;