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


    async generateQuestion(
        questionNumber,
        onAudio
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


                const audio =
                    await this.ttsService.speak(
                        sentence
                    );


                await onAudio(
                    audio,
                    sentence
                );
            }
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


        return completeQuestion;
    }


    async generateNextQuestion(
        question,
        answer,
        questionNumber,
        onAudio
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


                const audio =
                    await this.ttsService.speak(
                        sentence
                    );


                await onAudio(
                    audio,
                    sentence
                );
            }
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


        return completeQuestion;
    }
}


module.exports =
    QuestionService;