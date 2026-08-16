class LLMService {

    constructor(llmProvider) {

        this.llmProvider =
            llmProvider;
    }


    async generateQuestion(
        questionNumber,
        onToken
    ) {

        const prompt = `

You are a professional technical interviewer.

Generate ONE technical interview question.

The interview question number is:
${questionNumber}

Rules:

- Ask only one question.
- Do not provide the answer.
- Do not explain the question.
- Keep it concise.
- Ask a JavaScript technical interview question.

        `;


        await this.llmProvider.stream(
            prompt,
            onToken
        );
    }


    async generateNextQuestion(
        question,
        answer,
        questionNumber,
        onToken
    ) {

        const prompt = `

You are conducting a technical interview.

Previous question:
${question}

Candidate's answer:
${answer}

Generate the next technical interview question.

Question number:
${questionNumber}

Rules:

- Ask exactly ONE question.
- Do not evaluate the candidate yet.
- Do not provide the answer.
- Do not say "correct" or "incorrect".
- Keep the question concise.
-Question should be theory based. and should not ask any candidate to write any code
- Continue the JavaScript interview.

        `;


        await this.llmProvider.stream(
            prompt,
            onToken
        );
    }
}


module.exports =
    LLMService;