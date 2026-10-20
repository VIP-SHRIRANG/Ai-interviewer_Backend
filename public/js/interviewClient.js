export class InterviewClient {

    constructor() {

        this.onAudio = null;

        this.onQuestion = null;

        this.onFeedback = null;

        this.onSessionCompleted = null;

        this.onComplete = null;

        this.onError = null;
    }


    async fetchTopics() {

        const response =
            await fetch("/interview/topics");

        if (!response.ok) {

            throw new Error(
                `Failed to load L1 topics: ${response.status}`
            );
        }

        return await response.json();
    }


    async startInterview(options = {}) {

        await this.streamRequest(
            "/interview/start",
            options
        );
    }


    async submitAnswer(
        sessionId,
        answer
    ) {

        await this.streamRequest(
            "/interview/answer",
            {
                sessionId,
                answer
            }
        );
    }


    async finishInterview(
        sessionId
    ) {

        const response =
            await fetch(
                `/interview/${encodeURIComponent(sessionId)}/finish`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ sessionId })
                }
            );

        if (!response.ok) {

            throw new Error(
                `Failed to finish interview: ${response.status}`
            );
        }

        return await response.json();
    }


    async downloadReport(
        sessionId
    ) {

        const response =
            await fetch(
                `/interview/report/${encodeURIComponent(sessionId)}`,
                {
                    method: "GET"
                }
            );

        if (!response.ok) {

            throw new Error(
                "Unable to download interview report"
            );
        }

        const blob =
            await response.blob();

        const url =
            window.URL.createObjectURL(blob);

        const link =
            document.createElement("a");

        link.href = url;

        link.download =
            `interview-report-${sessionId}.pdf`;

        document.body.appendChild(link);

        link.click();

        link.remove();

        window.URL.revokeObjectURL(url);
    }


    async streamRequest(
        url,
        body = null
    ) {

        const options = {

            method: "POST",

            headers: {
                "Content-Type":
                    "application/json"
            }
        };


        if (body) {

            options.body =
                JSON.stringify(body);
        }


        const response =
            await fetch(
                url,
                options
            );


        if (!response.ok) {

            let errMsg = `Server error: ${response.status}`;

            try {
                const errJson = await response.json();
                if (errJson.error) {
                    errMsg = errJson.error;
                }
            } catch (_) {
                // ignore JSON parse error
            }

            throw new Error(errMsg);
        }


        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder();


        let buffer = "";


        while (true) {

            const {
                value,
                done
            } = await reader.read();


            if (done) {
                break;
            }


            buffer +=
                decoder.decode(
                    value,
                    {
                        stream: true
                    }
                );


            const events =
                buffer.split("\n\n");


            buffer =
                events.pop();


            for (
                const event of events
            ) {

                if (
                    !event.startsWith(
                        "data:"
                    )
                ) {
                    continue;
                }


                const json =
                    event
                        .replace(
                            /^data:\s*/,
                            ""
                        )
                        .trim();


                if (!json) {
                    continue;
                }


                const data =
                    JSON.parse(json);


                if (
                    data.type ===
                    "audio"
                ) {

                    if (this.onAudio) {

                        this.onAudio(
                            data.audio
                        );
                    }
                }


                if (
                    data.type ===
                    "question"
                ) {

                    if (this.onQuestion) {

                        this.onQuestion(
                            data
                        );
                    }
                }


                if (
                    data.type ===
                    "feedback"
                ) {

                    if (this.onFeedback) {

                        this.onFeedback(
                            data
                        );
                    }
                }


                if (
                    data.type ===
                    "completed"
                ) {

                    if (this.onSessionCompleted) {

                        this.onSessionCompleted(
                            data
                        );
                    }
                }


                if (
                    data.type ===
                    "done"
                ) {

                    if (this.onComplete) {

                        this.onComplete();
                    }
                }


                if (
                    data.type ===
                    "error"
                ) {

                    if (this.onError) {

                        this.onError(
                            data.error
                        );
                    }
                }
            }
        }
    }
}