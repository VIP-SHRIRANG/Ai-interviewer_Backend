class InterviewController {

    constructor(interviewService) {
        this.interviewService =
            interviewService;
    }

    submit = async (req, res) => {

        try {

            const question =
                req.body.question;

            if (!question?.trim()) {

                return res.status(400).json({
                    error: "Question is required"
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

            await this.interviewService.processQuestion(

                question,

                async (audio, text) => {

                    res.write(
                        `data: ${JSON.stringify({
                            type: "audio",
                            text: text,
                            audio:
                                audio.toString("base64")
                        })}\n\n`
                    );
                },
            );


            res.write(
                `data: ${JSON.stringify({
                    type: "done"
                })}\n\n`
            );


            res.end();

        } catch (error) {

            console.error(error);

            if (!res.headersSent) {

                res.status(500).json({
                    error: error.message
                });

                return;
            }

            res.end();
        }
    };
}

module.exports =
    InterviewController;