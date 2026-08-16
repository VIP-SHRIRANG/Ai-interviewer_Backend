export class InterviewClient {

    constructor() {

        this.onAudio = null;

        this.onQuestion = null;

        this.onComplete = null;

        this.onError = null;
    }


    async startInterview() {

        await this.streamRequest(
            "/interview/start"
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

            throw new Error(
                `Server error: ${response.status}`
            );
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