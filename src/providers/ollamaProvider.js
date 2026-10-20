class OllamaProvider {

    constructor(baseUrl = "http://localhost:11434", model = "llama3.2") {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
        this.model = model;
    }

    async stream(prompt, onToken, signal) {

        const response = await fetch(
            `${this.baseUrl}/api/generate`,
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

            buffer += decoder.decode(value, { stream: true });

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

        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer.trim());
                if (data.response) {
                    await onToken(data.response);
                }
            } catch (_) {
                // Ignore trailing incomplete JSON fragment
            }
        }
    }

    async generate(prompt, options = {}) {

        const payload = {
            model: this.model,
            prompt: prompt,
            stream: false
        };

        if (options.format === "json") {
            payload.format = "json";
        }

        const response = await fetch(
            `${this.baseUrl}/api/generate`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload),
                signal: options.signal
            }
        );

        if (!response.ok) {
            throw new Error(
                `Ollama error: ${response.status}`
            );
        }

        const data = await response.json();

        return (data.response || "").trim();
    }
}

module.exports = OllamaProvider;