const config =
    require("../config/config");


class InterviewController {

    constructor(
        interviewService,
        reportService = null,
        questionRecommender = null
    ) {

        this.interviewService =
            interviewService;

        this.reportService =
            reportService;

        this.questionRecommender =
            questionRecommender;
    }


    // The current candidate. Adjust this ONE function when you add a real login
    // (for example req.user.id set by your auth middleware or JWT).
    //
    // Until then the browser sends a random ID (kept in its localStorage) in the
    // x-candidate-id header. That is identity by possession, not security: anyone
    // who has the ID can see that candidate's reports. Set ALLOW_DEV_IDENTITY=false
    // in production once real login exists.
    candidateOf = (req) => {

        const devAllowed =
            process.env.ALLOW_DEV_IDENTITY !== "false";

        const headerId =
            devAllowed
                ? String(req.headers["x-candidate-id"] || "")
                : "";

        const id =
            req.user?.id ??
            req.auth?.userId ??
            (/^[A-Za-z0-9-]{8,64}$/.test(headerId) ? headerId : null);

        if (!id) return null;

        return {
            id: String(id),
            name: req.user?.name ?? req.body?.candidateName ?? "Candidate"
        };
    };


    _fail = (res, error, fallbackStatus = 500) => {

        const status = error.status || fallbackStatus;

        if (status >= 500) {
            console.error("Interview request error:", error);
        }

        return res.status(status).json({
            error: error.message
        });
    };


    _sse = (res, payload) => {

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };


    _openStream = (res) => {

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
    };


    _audioWriter = (res) => async (audio, text) => {

        this._sse(res, {
            type: "audio",
            text,
            audio: audio.toString("base64")
        });
    };


    // Company / role lists for the setup dropdowns
    getOptions = async (req, res) => {

        try {

            const opts =
                this.questionRecommender
                    ? await this.questionRecommender.options()
                    : {};

            return res.status(200).json({
                companies: opts.companies || [],
                roles: config.RECOMMENDER?.ROLES || [],
                rounds: opts.rounds || []
            });

        } catch (error) {

            return this._fail(res, error);
        }
    };


    start = async (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) {

            return res.status(401).json({
                error: "Please log in to start an interview"
            });
        }

        const {
            company,
            role,
            round,
            maxQuestions
        } = req.body || {};

        let opened = false;

        try {

            this._openStream(res);
            opened = true;

            const result =
                await this.interviewService.startInterview(
                    {
                        candidateId: candidate.id,
                        candidateName: req.body?.candidateName || candidate.name,
                        company,
                        role,
                        round,
                        maxQuestions
                    },
                    this._audioWriter(res),
                    (questionPayload) => {

                        // sent as soon as the question text is known, before its audio finishes
                        this._sse(res, { type: "question", ...questionPayload });
                    }
                );

            this._sse(res, { type: "done" });
            res.end();

            return result;

        } catch (error) {

            console.error("Start interview error:", error);

            if (!opened || !res.headersSent) {
                return this._fail(res, error);
            }

            this._sse(res, { type: "error", error: error.message });
            res.end();
        }
    };


    answer = async (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) {

            return res.status(401).json({
                error: "Please log in"
            });
        }

        const { sessionId, answer } = req.body || {};

        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }

        if (!answer?.trim()) {
            return res.status(400).json({ error: "Answer is required" });
        }

        try {

            // proper HTTP errors (404 / 409) before the stream is opened
            this.interviewService.assertCanAnswer(sessionId, candidate.id);

        } catch (error) {

            return this._fail(res, error);
        }

        try {

            this._openStream(res);

            const result =
                await this.interviewService.processAnswer(
                    sessionId,
                    candidate.id,
                    answer.trim(),
                    this._audioWriter(res),
                    (questionPayload) => {

                        this._sse(res, { type: "question", ...questionPayload });
                    }
                );

            if (result.submitted) {

                // last answer: the interview is now waiting in the evaluation queue
                this._sse(res, {
                    type: "submitted",
                    sessionId: result.sessionId,
                    status: result.status,
                    questionsAnswered: result.questionsAnswered
                });
            }

            this._sse(res, { type: "done" });
            res.end();

        } catch (error) {

            console.error("Answer processing error:", error);

            this._sse(res, { type: "error", error: error.message });
            res.end();
        }
    };


    // "Finish Interview" before the last question
    finish = (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) return res.status(401).json({ error: "Please log in" });

        try {

            const session =
                this.interviewService.finishInterview(
                    req.body?.sessionId || req.params.sessionId,
                    candidate.id
                );

            return res.status(200).json(session);

        } catch (error) {

            return this._fail(res, error);
        }
    };


    // Dashboard: the candidate's interviews, newest first
    listSessions = (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) return res.status(401).json({ error: "Please log in" });

        try {

            return res.status(200).json({
                sessions: this.interviewService.listSessions(candidate.id)
            });

        } catch (error) {

            return this._fail(res, error);
        }
    };


    getSessionStatus = (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) return res.status(401).json({ error: "Please log in" });

        try {

            return res.status(200).json(
                this.interviewService.getSessionStatus(req.params.sessionId, candidate.id)
            );

        } catch (error) {

            return this._fail(res, error);
        }
    };


    retry = (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) return res.status(401).json({ error: "Please log in" });

        try {

            return res.status(200).json(
                this.interviewService.retryEvaluation(req.params.sessionId, candidate.id)
            );

        } catch (error) {

            return this._fail(res, error);
        }
    };


    downloadReport = async (req, res) => {

        const candidate = this.candidateOf(req);

        if (!candidate) return res.status(401).json({ error: "Please log in" });

        try {

            const { sessionId } = req.params;

            const session =
                this.interviewService.getReportData(sessionId, candidate.id);

            if (!this.reportService) {

                return res.status(500).json({
                    error: "Report service is not configured"
                });
            }

            const pdfBuffer =
                await this.reportService.generatePdfBuffer(session);

            res.setHeader("Content-Type", "application/pdf");

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="interview-report-${sessionId}.pdf"`
            );

            return res.status(200).send(pdfBuffer);

        } catch (error) {

            return this._fail(res, error);
        }
    };
}


module.exports =
    InterviewController;