class ServiceError extends Error {

    constructor(message, status = 400) {

        super(message);
        this.status = status;
    }
}


/**
 * Runs the interview itself: asks questions and saves the answers.
 * Nothing is evaluated here. When the last answer arrives, the interview is
 * put in the evaluation queue and the EvaluationWorker takes it from there.
 */
class InterviewService {

    constructor(
        questionService,
        store,
        idealAnswers,
        {
            limits = { min: 1, max: 15, default: 5 },
            onQueued = null
        } = {}
    ) {

        this.questionService = questionService;
        this.store = store;
        this.idealAnswers = idealAnswers;
        this.limits = limits;
        this.onQueued = onQueued;   // e.g. () => worker.notify()
    }


    _clampMax(value) {

        const n = Math.round(Number(value));

        if (!Number.isFinite(n) || n < this.limits.min) return this.limits.default;
        return Math.min(this.limits.max, n);
    }


    // The session must exist and belong to this candidate ("not found" hides other people's sessions)
    _ownedSession(sessionId, candidateId) {

        const row = this.store.getSessionRow(sessionId);

        if (!row || row.candidate_id !== String(candidateId)) {
            throw new ServiceError("Interview session not found", 404);
        }

        return row;
    }


    // Called by the controller BEFORE it opens the event stream, so mistakes get a proper HTTP status
    assertCanAnswer(sessionId, candidateId) {

        const row = this._ownedSession(sessionId, candidateId);

        if (row.status !== "in_progress") {
            throw new ServiceError("This interview was already submitted", 409);
        }

        return row;
    }


    _questionContext(row, previousQuestions) {

        return {
            topic: row.role,
            difficulty: "medium",
            company: row.company,
            role: row.role,
            round: row.round,
            previousQuestions,
            missingConcepts: []
        };
    }


    // Saves the question (with its ideal answer) and tells the caller as soon as its text is known
    _registerQuestion(sessionId, number, text, onQuestion, extra = {}) {

        this.store.addQuestion({
            sessionId,
            number,
            question: text,
            idealAnswer: this.idealAnswers.get(text),
            difficulty: "medium"
        });

        if (onQuestion) {

            const row = this.store.getSessionRow(sessionId);

            onQuestion({
                sessionId,
                question: text,
                questionNumber: number,
                maxQuestions: row.max_questions,
                ...extra
            });
        }
    }


    async startInterview(options = {}, onAudio = null, onQuestion = null) {

        if (!options.candidateId) {
            throw new ServiceError("Not logged in", 401);
        }

        const sessionId = this.store.createSession({
            candidateId: options.candidateId,
            candidateName: options.candidateName || "Candidate",
            company: options.company,
            role: options.role,
            round: options.round,
            maxQuestions: this._clampMax(options.maxQuestions)
        });

        const row = this.store.getSessionRow(sessionId);

        let registered = false;

        try {

            const text = await this.questionService.generateQuestion(
                1,
                onAudio,
                this._questionContext(row, []),
                async (questionText) => {

                    registered = true;
                    this._registerQuestion(sessionId, 1, questionText, onQuestion, {
                        company: row.company,
                        role: row.role
                    });
                }
            );

            if (!registered) {
                this._registerQuestion(sessionId, 1, text, onQuestion, {
                    company: row.company,
                    role: row.role
                });
            }

            return {
                sessionId,
                company: row.company,
                role: row.role,
                maxQuestions: row.max_questions,
                question: text,
                questionNumber: 1
            };

        } catch (error) {

            // Nothing useful was started, so do not leave an empty session on the dashboard
            this.store.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
            throw error;
        }
    }


    async processAnswer(sessionId, candidateId, answer, onAudio = null, onQuestion = null) {

        const row = this.assertCanAnswer(sessionId, candidateId);

        const current = this.store.getCurrentQuestion(sessionId);

        if (!current) {
            throw new ServiceError("No question is waiting for an answer", 409);
        }

        const saved = this.store.saveAnswer(sessionId, current.question_number, answer);

        if (!saved) {
            throw new ServiceError("This question was already answered", 409);
        }

        // Last question: hand the whole interview to the evaluation queue
        if (current.question_number >= row.max_questions) {

            this.store.enqueue(sessionId);
            if (this.onQueued) this.onQueued();

            return {
                sessionId,
                submitted: true,
                status: "under_evaluation",
                questionsAnswered: current.question_number
            };
        }

        const nextNumber = current.question_number + 1;

        let registered = false;

        try {

            const text = await this.questionService.generateNextQuestion(
                current.question,
                answer,
                nextNumber,
                onAudio,
                this._questionContext(row, this.store.getAskedQuestions(sessionId)),
                async (questionText) => {

                    registered = true;
                    this._registerQuestion(sessionId, nextNumber, questionText, onQuestion);
                }
            );

            if (!registered) {
                this._registerQuestion(sessionId, nextNumber, text, onQuestion);
            }

            return {
                sessionId,
                submitted: false,
                question: text,
                questionNumber: nextNumber,
                maxQuestions: row.max_questions
            };

        } catch (error) {

            // Let the candidate send the same answer again
            if (!registered) this.store.clearAnswer(sessionId, current.question_number);
            throw error;
        }
    }


    // Submit early ("Finish Interview"): only answered questions are evaluated
    finishInterview(sessionId, candidateId) {

        this.assertCanAnswer(sessionId, candidateId);

        if (this.store.countAnswered(sessionId) === 0) {
            throw new ServiceError("Answer at least one question before finishing", 400);
        }

        this.store.enqueue(sessionId);
        if (this.onQueued) this.onQueued();

        return this.store.getPublic(sessionId);
    }


    // ------------------------------------------------------------------
    // Dashboard
    // ------------------------------------------------------------------

    listSessions(candidateId) {

        return this.store.listForCandidate(candidateId);
    }


    getSessionStatus(sessionId, candidateId) {

        this._ownedSession(sessionId, candidateId);
        return this.store.getPublic(sessionId);
    }


    // The data the PDF is built from; only available once evaluation has completed
    getReportData(sessionId, candidateId) {

        const row = this._ownedSession(sessionId, candidateId);

        if (row.status !== "completed") {
            throw new ServiceError("The report is not ready yet", 409);
        }

        return this.store.getSessionFull(sessionId);
    }


    retryEvaluation(sessionId, candidateId) {

        this._ownedSession(sessionId, candidateId);

        if (!this.store.retry(sessionId)) {
            throw new ServiceError("Only a failed evaluation can be retried", 409);
        }

        if (this.onQueued) this.onQueued();

        return this.store.getPublic(sessionId);
    }
}


module.exports = { InterviewService, ServiceError };