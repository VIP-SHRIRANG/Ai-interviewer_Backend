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

        // sessionId -> promise chain. Evaluations for one session run
        // one at a time, in the order the answers were submitted.
        this.evalQueues =
            new Map();
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
                        difficulty: session.difficulty,
                        company: session.company,
                        role: session.role,
                        round: session.round
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

            company:
                session.company,

            role:
                session.role,

            round:
                session.round,

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


    // Adds a job to the session's queue. The returned promise gives the job's
    // own result, but the chain itself survives a failed job.
    _enqueueEvaluation(
        sessionId,
        job
    ) {

        const previous =
            this.evalQueues.get(sessionId) ||
            Promise.resolve();

        const run =
            previous.then(job);

        this.evalQueues.set(
            sessionId,
            run.catch(() => {})
        );

        return run;
    }


    // Resolves once every queued evaluation for the session has finished
    waitForEvaluations(
        sessionId
    ) {

        return this.evalQueues.get(sessionId) ||
            Promise.resolve();
    }


    async processAnswer(
        sessionId,
        answer,
        onAudio,
        onFeedback,
        onFinalizing,
        onQuestion
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


        if (session.status === "finalizing") {

            throw new Error(
                "Interview is already being finalized"
            );
        }


        // Details of the question being answered (captured now,
        // because the session moves on before the evaluation finishes)
        const question =
            session.currentQuestion;

        const questionNumber =
            session.questionNumber;

        const difficulty =
            session.difficulty;

        const isLastQuestion =
            questionNumber >= session.maxQuestions;


        // =================================
        // 1. Queue the evaluation (runs in the background)
        // =================================

        session.pendingEvaluations =
            (session.pendingEvaluations || 0) + 1;

        const evaluationJob =
            this._enqueueEvaluation(
                sessionId,
                async () => {

                    const startedAt =
                        Date.now();

                    try {

                        const evaluation =
                            await this.evaluationService
                                .evaluateAnswer(
                                    question,
                                    answer,
                                    {
                                        topic: session.topic,
                                        difficulty,
                                        questionNumber
                                    }
                                );

                        this.interviewSession
                            .addAnswer(
                                sessionId,
                                answer,
                                evaluation,
                                {
                                    questionNumber,
                                    question,
                                    difficulty
                                }
                            );

                        // Adaptive difficulty applies to later questions
                        if (!isLastQuestion && evaluation?.nextDifficulty) {

                            this.interviewSession
                                .setDifficulty(
                                    sessionId,
                                    evaluation.nextDifficulty
                                );
                        }

                        console.log(
                            `[timing] evaluation of question ${questionNumber} took ${Date.now() - startedAt} ms`
                        );

                        return evaluation;

                    } finally {

                        session.pendingEvaluations =
                            Math.max(0, session.pendingEvaluations - 1);
                    }
                }
            );

        // Marks the promise as handled so a failure can't crash the process
        evaluationJob.catch((error) => {

            console.error(
                "Background evaluation failed:",
                error.message
            );
        });


        // =================================
        // 2. Not the last question -> fire the next one immediately
        // =================================

        if (!isLastQuestion) {

            const lastEvaluated =
                session.history[session.history.length - 1];

            let questionRegistered = false;

            const startedAt =
                Date.now();

            const nextQuestion =
                await this.questionService
                    .generateNextQuestion(
                        question,
                        answer,
                        questionNumber + 1,
                        onAudio,
                        {
                            topic: session.topic,
                            difficulty: session.difficulty,
                            company: session.company,
                            role: session.role,
                            round: session.round,
                            previousQuestions: [...session.askedQuestions],
                            missingConcepts: lastEvaluated?.missingConcepts || []
                        },
                        async (text) => {

                            // Register and announce the question as soon as its text exists
                            this.interviewSession
                                .setQuestion(
                                    sessionId,
                                    text
                                );

                            questionRegistered = true;

                            console.log(
                                `[timing] next question text ready after ${Date.now() - startedAt} ms`
                            );

                            if (onQuestion) {

                                onQuestion({
                                    question: text,
                                    questionNumber: session.questionNumber,
                                    maxQuestions: session.maxQuestions,
                                    difficulty: session.difficulty,
                                    averageScore: session.averageScore,
                                    pendingEvaluations: session.pendingEvaluations
                                });
                            }
                        }
                    );

            // Fallback for a questionService that does not call the callback
            if (!questionRegistered) {

                this.interviewSession
                    .setQuestion(
                        sessionId,
                        nextQuestion
                    );
            }

            console.log(
                `[timing] next question fully delivered (with audio) after ${Date.now() - startedAt} ms`
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

                pendingEvaluations:
                    session.pendingEvaluations
            };
        }


        // =================================
        // 3. Last question -> wait for the whole queue, then build the report
        //    (this is where the waiting time of earlier answers stacks up)
        // =================================

        session.status =
            "finalizing";

        if (onFinalizing) {

            onFinalizing({
                pendingEvaluations: session.pendingEvaluations
            });
        }

        try {

            const finalizingStartedAt =
                Date.now();

            // The queue is sequential, so this resolves after every earlier job
            const evaluation =
                await evaluationJob;

            if (onFeedback) {

                onFeedback({
                    ...evaluation,
                    questionNumber,
                    previousDifficulty: difficulty,
                    averageScore: session.averageScore
                });
            }

            const summary =
                await this.evaluationService
                    .generateSummary(session);

            this.interviewSession
                .completeSession(
                    sessionId,
                    summary
                );

            console.log(
                `[timing] report ready ${Date.now() - finalizingStartedAt} ms after the last answer`
            );

            // Speaking the summary adds TTS time before the report appears.
            // Set SPEAK_SUMMARY=true in .env to enable it.
            if (
                process.env.SPEAK_SUMMARY === "true" &&
                onAudio &&
                summary?.overallFeedback
            ) {

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

        } catch (error) {

            // Let the user retry or use "Finish Interview"
            session.status =
                "active";

            throw error;
        }
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

        // Make sure background evaluations are included in the summary
        await this.waitForEvaluations(sessionId);

        const summary =
            await this.evaluationService
                .generateSummary(session);

        return this.interviewSession
            .completeSession(
                sessionId,
                summary
            );
    }


    // Lightweight status for the frontend to poll
    getStatus(
        sessionId,
        since = 0
    ) {

        const session =
            this.getSession(sessionId);

        const sinceNumber =
            Number(since) || 0;

        return {

            sessionId,

            status:
                session.status,

            questionNumber:
                session.questionNumber,

            maxQuestions:
                session.maxQuestions,

            pendingEvaluations:
                session.pendingEvaluations || 0,

            averageScore:
                session.averageScore,

            evaluations:
                session.history
                    .filter(item => item.questionNumber > sinceNumber)
                    .map(item => ({
                        questionNumber: item.questionNumber,
                        difficulty: item.difficulty,
                        score: item.score,
                        feedback: item.feedback,
                        strengths: item.strengths,
                        missingConcepts: item.missingConcepts
                    })),

            summary:
                session.status === "completed"
                    ? session.overallSummary
                    : null
        };
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