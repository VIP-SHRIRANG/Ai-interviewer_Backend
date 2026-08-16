class OllamaProvider {

    constructor(baseUrl, model) {
        this.baseUrl = baseUrl;
        this.model = model;
    }

    async stream(prompt, onToken, signal) {

        const response = await fetch(
            `http://localhost:11434/api/generate`,
            {
                method: "POST",   

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    model: this.model,
                    prompt: prompt,
                    stream: true
                }),

                signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `Ollama error: ${response.status}`
            );
        }

        const reader =
            response.body.getReader();

        const decoder =
            new TextDecoder();

        let buffer = "";

        while (true) {

            const { value, done } =
                await reader.read();

            if (done) {
                break;
            }

            buffer += decoder.decode(value);

            const lines =
                buffer.split("\n");

            buffer = lines.pop();

            for (const line of lines) {

                if (!line.trim()) {
                    continue;
                }

                const data =
                    JSON.parse(line);

                if (data.response) {
                    await onToken(data.response);
                }
            }
        }
    }
}

module.exports = OllamaProvider;