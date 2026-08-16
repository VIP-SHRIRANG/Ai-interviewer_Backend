class InterviewService {

    constructor(
        questionService,
        interviewSession
    ) {

        this.questionService =
            questionService;

        this.interviewSession =
            interviewSession;
    }


    async startInterview(
        onAudio
    ) {

        const session =
            this.interviewSession
                .createSession();


        const question =
            await this.questionService
                .generateQuestion(
                    1,
                    onAudio
                );


        this.interviewSession
            .setQuestion(
                session.sessionId,
                question
            );


        return {

            sessionId:
                session.sessionId,

            question:
                question,

            questionNumber:
                session.questionNumber
        };
    }


    async processAnswer(
        sessionId,
        answer,
        onAudio
    ) {

        const session =
            this.interviewSession
                .getSession(
                    sessionId
                );


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        const previousQuestion =
            session.currentQuestion;


        // Store answer

        this.interviewSession
            .addAnswer(
                sessionId,
                answer
            );


        const nextQuestionNumber =
            session.questionNumber + 1;


        // Generate next question

        const nextQuestion =
            await this.questionService
                .generateNextQuestion(

                    previousQuestion,

                    answer,

                    nextQuestionNumber,

                    onAudio
                );


        // Update session

        this.interviewSession
            .setQuestion(
                sessionId,
                nextQuestion
            );


        return {

            sessionId,

            question:
                nextQuestion,

            questionNumber:
                session.questionNumber
        };
    }
}


module.exports =
    InterviewService;