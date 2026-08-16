class LLMService {

    constructor(llmProvider) {
        this.llmProvider = llmProvider;
    }

    async generateAnswer(
        question,
        onToken,
        signal
    ) {

        const prompt = `
You are a technical interviewer.

Answer the candidate's question
clearly and concisely.

Candidate question:
${question}
        `;

        await this.llmProvider.stream(
            prompt,
            onToken,
            signal
        );
    }
}

module.exports = LLMService;