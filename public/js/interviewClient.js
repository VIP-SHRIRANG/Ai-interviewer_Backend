export class InterviewClient {

    constructor(audioPlayer) {

        this.audioPlayer =
            audioPlayer;

        this.onText = null;

        this.onComplete = null;

        this.onError = null;
    }


    async submitQuestion(question) {

        const response =
            await fetch(
                "/submit",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        question
                    })
                }
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
                decoder.decode(value, {
                    stream: true
                });


            const events =
                buffer.split("\n\n");


            buffer =
                events.pop();


            for (const event of events) {

                if (!event.startsWith("data:")) {
                    continue;
                }


                const json =
                    event
                        .replace("data:", "")
                        .trim();


                if (!json) {
                    continue;
                }


                const data =
                    JSON.parse(json);


                // Audio sentence

                if (data.type === "audio") {

                    if (this.onText) {

                        this.onText(
                            data.text
                        );
                    }


                    this.audioPlayer.addAudio(
                        data.audio
                    );
                }


                // Complete

                if (data.type === "done") {

                    if (this.onComplete) {

                        this.onComplete(
                            data.answer
                        );
                    }
                }


                // Error

                if (data.type === "error") {

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