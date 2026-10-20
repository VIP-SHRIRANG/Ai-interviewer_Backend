class InterviewService {

    constructor(
        questionService,
        interviewSession,
        evaluationService
    ) {

        this.questionService =
            questionService;

        this.interviewSession =
            interviewSession;

        this.evaluationService =
            evaluationService;
    }


    async startInterview(
        options = {},
        onAudio = null
    ) {

        // Support legacy signature startInterview(onAudio)
        if (typeof options === "function") {
            onAudio = options;
            options = {};
        }

        const session =
            this.interviewSession
                .createSession(options);


        const question =
            await this.questionService
                .generateQuestion(
                    1,
                    onAudio,
                    {
                        topic: session.topic,
                        difficulty: session.difficulty
                    }
                );


        this.interviewSession
            .setQuestion(
                session.sessionId,
                question
            );


        return {

            sessionId:
                session.sessionId,

            interviewMode:
                session.interviewMode,

            candidateName:
                session.candidateName,

            topic:
                session.topic,

            difficulty:
                session.difficulty,

            maxQuestions:
                session.maxQuestions,

            question:
                question,

            questionNumber:
                session.questionNumber
        };
    }


    async processAnswer(
        sessionId,
        answer,
        onAudio,
        onFeedback
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


        if (session.status === "completed") {

            throw new Error(
                "Interview session is already completed"
            );
        }


        const previousQuestion =
            session.currentQuestion;

        const previousDifficulty =
            session.difficulty;


        // =================================
        // 1. Evaluate candidate answer
        // =================================

        const evaluation =
            await this.evaluationService
                .evaluateAnswer(
                    previousQuestion,
                    answer,
                    {
                        topic: session.topic,
                        difficulty: previousDifficulty,
                        questionNumber: session.questionNumber
                    }
                );


        // =================================
        // 2. Store answer + evaluation
        // =================================

        this.interviewSession
            .addAnswer(
                sessionId,
                answer,
                evaluation
            );


        // =================================
        // 3. Stream evaluation feedback to client
        // =================================

        if (onFeedback) {

            onFeedback({
                ...evaluation,
                questionNumber: session.questionNumber,
                previousDifficulty,
                averageScore: session.averageScore
            });
        }


        // =================================
        // 4. Check if L1 interview reached maxQuestions
        // =================================

        if (session.questionNumber >= session.maxQuestions) {

            const summary =
                await this.evaluationService
                    .generateSummary(session);

            this.interviewSession
                .completeSession(
                    sessionId,
                    summary
                );

            if (onAudio && summary?.overallFeedback) {
                await this.questionService.speakText(
                    summary.overallFeedback,
                    onAudio
                );
            }

            return {
                sessionId,
                completed: true,
                status: "completed",
                questionNumber: session.questionNumber,
                maxQuestions: session.maxQuestions,
                averageScore: session.averageScore,
                evaluation,
                summary
            };
        }


        // =================================
        // 5. Update adaptive difficulty & generate next question
        // =================================

        const nextDifficulty =
            evaluation.nextDifficulty || previousDifficulty;

        this.interviewSession
            .setDifficulty(
                sessionId,
                nextDifficulty
            );

        const nextQuestionNumber =
            session.questionNumber + 1;

        const previousQuestions =
            session.history.map(item => item.question);

        const nextQuestion =
            await this.questionService
                .generateNextQuestion(
                    previousQuestion,
                    answer,
                    nextQuestionNumber,
                    onAudio,
                    {
                        topic: session.topic,
                        difficulty: nextDifficulty,
                        previousQuestions,
                        missingConcepts: evaluation.missingConcepts
                    }
                );


        this.interviewSession
            .setQuestion(
                sessionId,
                nextQuestion
            );


        return {

            sessionId,

            completed: false,

            status: session.status,

            topic: session.topic,

            difficulty: session.difficulty,

            question:
                nextQuestion,

            questionNumber:
                session.questionNumber,

            maxQuestions:
                session.maxQuestions,

            averageScore:
                session.averageScore,

            evaluation,

            feedback:
                evaluation.feedback
        };
    }


    async finishInterview(
        sessionId
    ) {

        const session =
            this.interviewSession
                .getSession(sessionId);

        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }

        if (session.status === "completed" && session.overallSummary) {
            return session;
        }

        const summary =
            await this.evaluationService
                .generateSummary(session);

        return this.interviewSession
            .completeSession(
                sessionId,
                summary
            );
    }


    getSession(
        sessionId
    ) {

        const session =
            this.interviewSession
                .getSession(sessionId);

        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }

        return session;
    }
}


module.exports =
    InterviewService;