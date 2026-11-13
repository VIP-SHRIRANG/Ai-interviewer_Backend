const sleep = (ms, onWake) =>
    new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        onWake(() => { clearTimeout(timer); resolve(); });
    });


/**
 * Takes interviews from the queue one at a time and evaluates every answer
 * against its ideal answer, then builds the summary.
 *
 * - Crash-safe: a heartbeat is written after every answer, and a session whose
 *   heartbeat is too old is put back in the queue. Answers that were already
 *   evaluated are not evaluated again.
 * - Failures are retried (with a growing delay), then marked "failed".
 */
class EvaluationWorker {

    constructor({
        store,
        evaluationService,
        pollMs = 2000,
        maxAttempts = 3,
        leaseMs = 5 * 60 * 1000,
        backoffMs = 30000,
        recoverAllOnStart = false,
        logger = console
    }) {

        this.store = store;
        this.evaluationService = evaluationService;
        this.pollMs = pollMs;
        this.maxAttempts = maxAttempts;
        this.leaseMs = leaseMs;
        this.backoffMs = backoffMs;
        this.recoverAllOnStart = recoverAllOnStart;
        this.logger = logger;

        this.running = false;
        this._wake = () => {};
        this._loopDone = null;
    }


    start() {

        if (this.running) return;

        this.running = true;

        // Several workers may share one database, so only take back sessions whose
        // heartbeat has expired. For a single worker, recoverAllOnStart takes back
        // everything that was "evaluating" when the server stopped.
        const recovered = this.store.recoverStuck(this.recoverAllOnStart ? 0 : this.leaseMs);
        if (recovered > 0) {
            this.logger.log(`EvaluationWorker: ${recovered} interrupted session(s) put back in the queue`);
        }

        this._loopDone = this._loop();
        this.logger.log("EvaluationWorker started");
    }


    async stop() {

        this.running = false;
        this._wake();
        await this._loopDone;
    }


    // Call right after a session was queued so it starts without waiting for the next poll
    notify() {

        this._wake();
    }


    async _loop() {

        let lastRecovery = Date.now();

        while (this.running) {

            try {

                if (Date.now() - lastRecovery > this.leaseMs / 2) {
                    this.store.recoverStuck(this.leaseMs);
                    lastRecovery = Date.now();
                }

                const sessionId = this.store.claimNext();

                if (sessionId) {
                    await this.processSession(sessionId);
                    continue;   // look for the next one immediately
                }

            } catch (error) {

                this.logger.error("EvaluationWorker loop error:", error.message);
            }

            await sleep(this.pollMs, (wake) => { this._wake = wake; });
        }
    }


    async processSession(sessionId) {

        const startedAt = Date.now();

        try {

            const session = this.store.getSessionFull(sessionId);

            if (!session) return;

            // Answers evaluated before an interruption are kept
            const pending = session.history.filter((item) => item.score === null || item.score === undefined);

            for (const item of pending) {

                const evaluation = await this.evaluationService.evaluateAnswer(
                    item.question,
                    item.answer,
                    {
                        topic: session.role,
                        company: session.company,
                        role: session.role,
                        difficulty: item.difficulty,
                        questionNumber: item.questionNumber,
                        idealAnswer: item.idealAnswer,
                        strict: true   // throw instead of silently using the word-count fallback
                    }
                );

                this.store.saveEvaluation(sessionId, item.questionNumber, evaluation);
                this.store.touch(sessionId);
            }

            const evaluated = this.store.getSessionFull(sessionId);

            this.store.touch(sessionId);

            const summary = await this.evaluationService.generateSummary({
                topic: evaluated.role,
                history: evaluated.history,
                averageScore: 0
            });

            this.store.complete(sessionId, summary, summary?.averageScore);

            this.logger.log(
                `[timing] session ${sessionId} evaluated: ${pending.length} answer(s) in ${Date.now() - startedAt} ms`
            );

        } catch (error) {

            const outcome = this.store.failOrRequeue(
                sessionId,
                error.message,
                { maxAttempts: this.maxAttempts, backoffMs: this.backoffMs }
            );

            this.logger.error(
                `EvaluationWorker: session ${sessionId} ${outcome}: ${error.message}`
            );
        }
    }
}


module.exports = EvaluationWorker;