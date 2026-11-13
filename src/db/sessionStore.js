const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const now = () => new Date().toISOString();

// What the candidate sees on the dashboard
const PUBLIC_STATUS = {
    in_progress: "in_progress",
    queued: "under_evaluation",
    evaluating: "under_evaluation",
    completed: "completed",
    failed: "failed"
};

const parseJson = (text, fallback) => {
    if (!text) return fallback;
    try { return JSON.parse(text); } catch { return fallback; }
};


/**
 * Stores interview sessions, their answers, and acts as the evaluation queue:
 * the queue is simply "sessions with status = queued, oldest first".
 *
 * status flow:  in_progress -> queued -> evaluating -> completed
 *                                  ^           |
 *                                  +-- retry --+--> failed
 *
 * Every method is synchronous and every state change is a single SQL
 * statement or transaction, so it is safe if several workers share the file.
 * (For several MACHINES behind a load balancer, use a shared server database
 * with the same methods; see claimNext().)
 */
class SessionStore {

    constructor(dbPath = "data/interviews.db") {

        if (dbPath !== ":memory:") {
            fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
        }

        this.db = new Database(dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("busy_timeout = 5000");
        this.db.pragma("foreign_keys = ON");

        this._migrate();
    }


    _migrate() {

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS sessions (
                id                    TEXT PRIMARY KEY,
                candidate_id          TEXT NOT NULL,
                candidate_name        TEXT,
                company               TEXT,
                role                  TEXT,
                round                 TEXT,
                max_questions         INTEGER NOT NULL,
                status                TEXT NOT NULL,
                started_at            TEXT NOT NULL,
                finished_at           TEXT,
                queued_at             TEXT,
                evaluation_started_at TEXT,
                completed_at          TEXT,
                average_score         REAL,
                summary_json          TEXT,
                attempts              INTEGER NOT NULL DEFAULT 0,
                next_attempt_at       TEXT,
                locked_at             TEXT,
                error                 TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_candidate
                ON sessions (candidate_id, started_at DESC);

            CREATE INDEX IF NOT EXISTS idx_sessions_queue
                ON sessions (status, queued_at);

            CREATE TABLE IF NOT EXISTS answers (
                session_id       TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                question_number  INTEGER NOT NULL,
                question         TEXT NOT NULL,
                ideal_answer     TEXT,
                difficulty       TEXT,
                asked_at         TEXT,
                candidate_answer TEXT,
                answered_at      TEXT,
                score            REAL,
                feedback         TEXT,
                strengths_json   TEXT,
                missing_json     TEXT,
                evaluated_at     TEXT,
                PRIMARY KEY (session_id, question_number)
            );
        `);
    }


    // ------------------------------------------------------------------
    // Interview (while the candidate is answering)
    // ------------------------------------------------------------------

    createSession({ candidateId, candidateName, company, role, round, maxQuestions }) {

        const id = crypto.randomUUID();

        this.db.prepare(`
            INSERT INTO sessions
                (id, candidate_id, candidate_name, company, role, round,
                 max_questions, status, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'in_progress', ?)
        `).run(id, String(candidateId), candidateName ?? null, company ?? null,
               role ?? null, round ?? null, maxQuestions, now());

        return id;
    }


    getSessionRow(sessionId) {

        return this.db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) || null;
    }


    addQuestion({ sessionId, number, question, idealAnswer = null, difficulty = "medium" }) {

        this.db.prepare(`
            INSERT INTO answers
                (session_id, question_number, question, ideal_answer, difficulty, asked_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(sessionId, number, question, idealAnswer, difficulty, now());
    }


    getCurrentQuestion(sessionId) {

        return this.db.prepare(`
            SELECT * FROM answers WHERE session_id = ?
            ORDER BY question_number DESC LIMIT 1
        `).get(sessionId) || null;
    }


    getAskedQuestions(sessionId) {

        return this.db.prepare(`
            SELECT question FROM answers WHERE session_id = ?
            ORDER BY question_number
        `).all(sessionId).map((r) => r.question);
    }


    countAnswered(sessionId) {

        return this.db.prepare(`
            SELECT COUNT(*) AS n FROM answers
            WHERE session_id = ? AND candidate_answer IS NOT NULL
        `).get(sessionId).n;
    }


    // Returns false when that question was already answered (double submit)
    saveAnswer(sessionId, number, answer) {

        const result = this.db.prepare(`
            UPDATE answers SET candidate_answer = ?, answered_at = ?
            WHERE session_id = ? AND question_number = ? AND candidate_answer IS NULL
        `).run(answer, now(), sessionId, number);

        return result.changes === 1;
    }


    // Used when the next question could not be produced, so the candidate can resubmit
    clearAnswer(sessionId, number) {

        this.db.prepare(`
            UPDATE answers SET candidate_answer = NULL, answered_at = NULL
            WHERE session_id = ? AND question_number = ?
        `).run(sessionId, number);
    }


    // ------------------------------------------------------------------
    // Queue
    // ------------------------------------------------------------------

    // Submit the interview for evaluation (drops a question that was asked but never answered)
    enqueue(sessionId) {

        const tx = this.db.transaction(() => {

            this.db.prepare(`
                DELETE FROM answers WHERE session_id = ? AND candidate_answer IS NULL
            `).run(sessionId);

            const ts = now();

            return this.db.prepare(`
                UPDATE sessions
                SET status = 'queued', finished_at = COALESCE(finished_at, ?), queued_at = ?
                WHERE id = ? AND status = 'in_progress'
            `).run(ts, ts, sessionId).changes === 1;
        });

        return tx.immediate();
    }


    // Take the oldest waiting session. The select and the update are one
    // transaction, so two workers can never take the same session.
    // (On PostgreSQL this is "SELECT ... FOR UPDATE SKIP LOCKED".)
    claimNext() {

        const tx = this.db.transaction(() => {

            const ts = now();

            const row = this.db.prepare(`
                SELECT id FROM sessions
                WHERE status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                ORDER BY queued_at ASC LIMIT 1
            `).get(ts);

            if (!row) return null;

            this.db.prepare(`
                UPDATE sessions
                SET status = 'evaluating', evaluation_started_at = ?, locked_at = ?,
                    attempts = attempts + 1
                WHERE id = ?
            `).run(ts, ts, row.id);

            return row.id;
        });

        return tx.immediate();
    }


    // Heartbeat so a long evaluation is not mistaken for a crashed worker
    touch(sessionId) {

        this.db.prepare(`UPDATE sessions SET locked_at = ? WHERE id = ?`).run(now(), sessionId);
    }


    saveEvaluation(sessionId, number, evaluation) {

        this.db.prepare(`
            UPDATE answers
            SET score = ?, feedback = ?, strengths_json = ?, missing_json = ?, evaluated_at = ?
            WHERE session_id = ? AND question_number = ?
        `).run(
            Number(evaluation.score),
            evaluation.feedback ?? null,
            JSON.stringify(evaluation.strengths ?? []),
            JSON.stringify(evaluation.missingConcepts ?? []),
            now(),
            sessionId,
            number
        );
    }


    complete(sessionId, summary, averageScore) {

        this.db.prepare(`
            UPDATE sessions
            SET status = 'completed', completed_at = ?, summary_json = ?,
                average_score = ?, error = NULL, locked_at = NULL
            WHERE id = ?
        `).run(now(), JSON.stringify(summary ?? null), averageScore ?? null, sessionId);
    }


    // Put it back in the queue (with a delay), or mark it failed after too many attempts
    failOrRequeue(sessionId, message, { maxAttempts = 3, backoffMs = 30000 } = {}) {

        const row = this.getSessionRow(sessionId);
        if (!row) return null;

        if (row.attempts >= maxAttempts) {

            this.db.prepare(`
                UPDATE sessions SET status = 'failed', error = ?, locked_at = NULL WHERE id = ?
            `).run(String(message).slice(0, 500), sessionId);

            return "failed";
        }

        const next = new Date(Date.now() + backoffMs * row.attempts).toISOString();

        this.db.prepare(`
            UPDATE sessions
            SET status = 'queued', next_attempt_at = ?, error = ?, locked_at = NULL
            WHERE id = ?
        `).run(next, String(message).slice(0, 500), sessionId);

        return "requeued";
    }


    // A worker that died mid-evaluation leaves the session "evaluating" forever.
    // Anything whose heartbeat is older than the lease goes back to the queue.
    recoverStuck(leaseMs) {

        const cutoff = new Date(Date.now() - leaseMs).toISOString();

        return this.db.prepare(`
            UPDATE sessions SET status = 'queued', locked_at = NULL
            WHERE status = 'evaluating' AND locked_at < ?
        `).run(cutoff).changes;
    }


    // Candidate-triggered retry of a failed evaluation (goes to the back of the queue)
    retry(sessionId) {

        return this.db.prepare(`
            UPDATE sessions
            SET status = 'queued', attempts = 0, next_attempt_at = NULL,
                error = NULL, queued_at = ?
            WHERE id = ? AND status = 'failed'
        `).run(now(), sessionId).changes === 1;
    }


    // ------------------------------------------------------------------
    // Reading
    // ------------------------------------------------------------------

    _toPublic(row) {

        return {
            sessionId: row.id,
            candidateName: row.candidate_name,
            company: row.company,
            role: row.role,
            round: row.round,
            startedAt: row.started_at,
            submittedAt: row.finished_at,
            completedAt: row.completed_at,
            status: PUBLIC_STATUS[row.status] || row.status,
            questionsAnswered: row.answered ?? undefined,
            totalQuestions: row.max_questions,
            queuePosition: row.queue_position ?? null,
            averageScore: row.status === "completed" ? row.average_score : null,
            canDownload: row.status === "completed",
            canRetry: row.status === "failed",
            error: row.status === "failed" ? row.error : null
        };
    }


    _publicQuery(where) {

        return `
            SELECT s.*,
                (SELECT COUNT(*) FROM answers a
                  WHERE a.session_id = s.id AND a.candidate_answer IS NOT NULL) AS answered,
                CASE WHEN s.status IN ('queued', 'evaluating') THEN
                    (SELECT COUNT(*) FROM sessions o
                      WHERE o.status IN ('queued', 'evaluating')
                        AND o.queued_at < s.queued_at) + 1
                END AS queue_position
            FROM sessions s
            WHERE ${where}
        `;
    }


    listForCandidate(candidateId, limit = 50) {

        return this.db
            .prepare(`${this._publicQuery("s.candidate_id = ?")} ORDER BY s.started_at DESC LIMIT ?`)
            .all(String(candidateId), limit)
            .map((row) => this._toPublic(row));
    }


    getPublic(sessionId) {

        const row = this.db.prepare(this._publicQuery("s.id = ?")).get(sessionId);
        return row ? this._toPublic(row) : null;
    }


    // The same shape the old in-memory session had, so reportService keeps working
    getSessionFull(sessionId) {

        const row = this.getSessionRow(sessionId);
        if (!row) return null;

        const answers = this.db.prepare(`
            SELECT * FROM answers
            WHERE session_id = ? AND candidate_answer IS NOT NULL
            ORDER BY question_number
        `).all(sessionId);

        const history = answers.map((a) => ({
            questionNumber: a.question_number,
            question: a.question,
            difficulty: a.difficulty,
            answer: a.candidate_answer,
            idealAnswer: a.ideal_answer,
            score: a.score,
            feedback: a.feedback,
            strengths: parseJson(a.strengths_json, []),
            missingConcepts: parseJson(a.missing_json, []),
            evaluatedAt: a.evaluated_at
        }));

        return {
            sessionId: row.id,
            interviewMode: "L1",
            candidateId: row.candidate_id,
            candidateName: row.candidate_name,
            company: row.company,
            role: row.role,
            round: row.round,
            topic: row.role,
            difficulty: "medium",
            maxQuestions: row.max_questions,
            questionNumber: history.length,
            currentQuestion: null,
            history,
            averageScore: row.average_score ?? 0,
            overallSummary: parseJson(row.summary_json, null),
            status: row.status === "completed" ? "completed" : row.status,
            createdAt: row.started_at,
            completedAt: row.completed_at
        };
    }


    // ------------------------------------------------------------------
    // Housekeeping
    // ------------------------------------------------------------------

    deleteOlderThan(days) {

        const cutoff = new Date(Date.now() - days * 86400000).toISOString();

        return this.db.prepare(`
            DELETE FROM sessions WHERE started_at < ? AND status IN ('completed', 'failed', 'in_progress')
        `).run(cutoff).changes;
    }


    stats() {

        return Object.fromEntries(
            this.db.prepare(`SELECT status, COUNT(*) AS n FROM sessions GROUP BY status`)
                .all().map((r) => [r.status, r.n])
        );
    }


    close() {

        this.db.close();
    }
}


module.exports = SessionStore;