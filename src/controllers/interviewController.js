const config =
    require("../config/config");


class InterviewController {

    constructor(
        interviewService,
        reportService = null
    ) {

        this.interviewService =
            interviewService;

        this.reportService =
            reportService;
    }


    getTopics = (req, res) => {

        return res.status(200).json({
            mode: "L1",
            defaultTopic: config.L1.DEFAULT_TOPIC,
            defaultDifficulty: config.L1.DEFAULT_DIFFICULTY,
            defaultMaxQuestions: config.L1.DEFAULT_MAX_QUESTIONS,
            topics: config.L1.TOPICS,
            difficultyLevels: config.L1.DIFFICULTY_LEVELS
        });
    };


    start = async (req, res) => {

        try {

            const {
                topic,
                difficulty,
                maxQuestions,
                candidateName
            } = req.body || {};

            res.setHeader(
                "Content-Type",
                "text/event-stream"
            );

            res.setHeader(
                "Cache-Control",
                "no-cache"
            );

            res.setHeader(
                "Connection",
                "keep-alive"
            );

            res.flushHeaders();


            const result =
                await this.interviewService
                    .startInterview(
                        {
                            topic,
                            difficulty,
                            maxQuestions,
                            candidateName
                        },
                        async (audio, text) => {

                            res.write(
                                `data: ${JSON.stringify({
                                    type: "audio",
                                    text: text,
                                    audio:
                                        audio.toString(
                                            "base64"
                                        )
                                })}\n\n`
                            );
                        }
                    );


            res.write(
                `data: ${JSON.stringify({
                    type: "question",
                    question:
                        result.question,
                    sessionId:
                        result.sessionId,
                    interviewMode:
                        result.interviewMode,
                    topic:
                        result.topic,
                    difficulty:
                        result.difficulty,
                    questionNumber:
                        result.questionNumber,
                    maxQuestions:
                        result.maxQuestions
                })}\n\n`
            );


            res.write(
                `data: ${JSON.stringify({
                    type: "done"
                })}\n\n`
            );


            res.end();

        } catch (error) {

            console.error(
                "Start interview error:",
                error
            );

            if (!res.headersSent) {

                return res.status(500).json({
                    error: error.message
                });
            }

            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    error: error.message
                })}\n\n`
            );

            res.end();
        }
    };


    answer = async (req, res) => {

        try {

            const {
                sessionId,
                answer
            } = req.body || {};


            if (!sessionId) {

                return res.status(400).json({
                    error:
                        "sessionId is required"
                });
            }


            if (!answer?.trim()) {

                return res.status(400).json({
                    error:
                        "Answer is required"
                });
            }


            res.setHeader(
                "Content-Type",
                "text/event-stream"
            );

            res.setHeader(
                "Cache-Control",
                "no-cache"
            );

            res.setHeader(
                "Connection",
                "keep-alive"
            );

            res.flushHeaders();


            const result =
                await this.interviewService
                    .processAnswer(
                        sessionId,
                        answer.trim(),
                        async (audio, text) => {

                            res.write(
                                `data: ${JSON.stringify({
                                    type: "audio",
                                    text: text,
                                    audio:
                                        audio.toString(
                                            "base64"
                                        )
                                })}\n\n`
                            );
                        },
                        (evaluationPayload) => {

                            res.write(
                                `data: ${JSON.stringify({
                                    type: "feedback",
                                    feedback: evaluationPayload.feedback,
                                    evaluation: evaluationPayload
                                })}\n\n`
                            );
                        }
                    );


            if (result.completed) {

                res.write(
                    `data: ${JSON.stringify({
                        type: "completed",
                        sessionId: result.sessionId,
                        averageScore: result.averageScore,
                        summary: result.summary
                    })}\n\n`
                );

            } else {

                res.write(
                    `data: ${JSON.stringify({
                        type: "question",
                        question:
                            result.question,
                        questionNumber:
                            result.questionNumber,
                        maxQuestions:
                            result.maxQuestions,
                        difficulty:
                            result.difficulty,
                        averageScore:
                            result.averageScore
                    })}\n\n`
                );
            }


            res.write(
                `data: ${JSON.stringify({
                    type: "done"
                })}\n\n`
            );


            res.end();

        } catch (error) {

            console.error(
                "Answer processing error:",
                error
            );


            if (!res.headersSent) {

                const statusCode =
                    error.message === "Interview session not found"
                        ? 404
                        : 500;

                return res.status(statusCode).json({
                    error:
                        error.message
                });
            }

            res.write(
                `data: ${JSON.stringify({
                    type: "error",
                    error: error.message
                })}\n\n`
            );

            res.end();
        }
    };


    finish = async (req, res) => {

        try {

            const sessionId =
                req.params.sessionId ||
                req.body?.sessionId;

            if (!sessionId) {

                return res.status(400).json({
                    error: "sessionId is required"
                });
            }

            const session =
                await this.interviewService
                    .finishInterview(sessionId);

            return res.status(200).json({
                sessionId: session.sessionId,
                status: session.status,
                averageScore: session.averageScore,
                summary: session.overallSummary,
                history: session.history
            });

        } catch (error) {

            const statusCode =
                error.message === "Interview session not found"
                    ? 404
                    : 500;

            return res.status(statusCode).json({
                error: error.message
            });
        }
    };


    getSession = (req, res) => {

        try {

            const session =
                this.interviewService
                    .getSession(req.params.sessionId);

            return res.status(200).json(session);

        } catch (error) {

            return res.status(404).json({
                error: error.message
            });
        }
    };


    downloadReport = async (req, res) => {

        try {

            const { sessionId } = req.params;

            const session =
                await this.interviewService
                    .finishInterview(sessionId);

            if (!this.reportService) {

                return res.status(500).json({
                    error: "Report service is not configured"
                });
            }

            const pdfBuffer =
                await this.reportService
                    .generatePdfBuffer(session);

            res.setHeader(
                "Content-Type",
                "application/pdf"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="interview-report-${sessionId}.pdf"`
            );

            return res.status(200).send(pdfBuffer);

        } catch (error) {

            const statusCode =
                error.message === "Interview session not found"
                    ? 404
                    : 500;

            return res.status(statusCode).json({
                error: error.message
            });
        }
    };
}


module.exports =
    InterviewController;