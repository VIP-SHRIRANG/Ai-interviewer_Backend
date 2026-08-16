class InterviewController {

    constructor(interviewService) {

        this.interviewService =
            interviewService;
    }


    start = async (req, res) => {

        try {

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

                    questionNumber:
                        result.questionNumber
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


            res.end();
        }
    };


    answer = async (req, res) => {

        try {

            const {
                sessionId,
                answer
            } = req.body;


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

                        answer,

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
                        (feedback)=>{
                            res.write(
                                `data: ${JSON.stringify({
                                    type: "feedback",
                                    feedback: feedback
                                })}\n\n`
                            );
                        }
                    );


            res.write(
                `data: ${JSON.stringify({
                    type: "question",
                    question:
                        result.question,

                    questionNumber:
                        result.questionNumber
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
                "Answer processing error:",
                error
            );


            if (!res.headersSent) {

                return res.status(500).json({
                    error:
                        error.message
                });
            }


            res.end();
        }
    };
}


module.exports =
    InterviewController;