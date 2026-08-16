const { spawn } = require("child_process");

class EdgeTtsProvider {

    constructor(voice) {
        this.voice = voice;
    }

    synthesize(text) {

        return new Promise((resolve, reject) => {

            const process = spawn("edge-tts", [
                "--voice",
                this.voice,
                "--text",
                text,
                "--write-media",
                "-"
            ]);

            const chunks = [];

            let errorMessage = "";

            process.stdout.on(
                "data",
                chunk => chunks.push(chunk)
            );

            process.stderr.on(
                "data",
                chunk => {
                    errorMessage +=
                        chunk.toString();
                }
            );

            process.on("close", code => {

                if (code === 0) {

                    resolve(
                        Buffer.concat(chunks)
                    );

                } else {

                    reject(
                        new Error(errorMessage)
                    );
                }
            });
        });
    }
}

module.exports = EdgeTtsProvider;