class LLMService {

    constructor(llmProvider, questionRecommender = null) {

        this.llmProvider =
            llmProvider;

        this.questionRecommender =
            questionRecommender;
    }


    async _recommendQuestion(
        context,
        previousQuestions
    ) { 
        //Log for checking if everything is working.
        console.log("Recommender:", context.company, "|", context.role, "|", context.round, "| asked so far:", previousQuestions.length);

        if (!this.questionRecommender) {
            return null;
        }

        try {

            return await this.questionRecommender.recommend({
                ...context,
                previousQuestions
            });

        } catch (err) {

            console.error(
                "Recommender failed, falling back to LLM question:",
                err.message
            );

            return null;
        }
    }


    async generateQuestion(
        questionNumber,
        onToken,
        context = {}
    ) {

        // Try the recommender first (no questions asked yet)
        const recommended =
            await this._recommendQuestion(
                context,
                []
            );

        if (recommended?.question) {

            await onToken(
                recommended.question
            );

            return;
        }

        // Fallback: generate with the LLM
        const topic =
            context.topic || "JavaScript";

        const difficulty =
            context.difficulty || "easy";

        const prompt = `
You are a professional technical interviewer conducting an L1 (Fundamental) interview.

Generate ONE fundamental interview question on the topic: "${topic}".
Difficulty level: ${difficulty.toUpperCase()}
Question number: ${questionNumber}

Rules:
- Ask ONLY ONE clear, direct conceptual or behavioral question appropriate for a spoken interview.
- Do not provide the answer or hints.
- Do not include greetings, preambles, or explanations before or after the question.
- Keep it concise (1 to 2 sentences maximum).
- The question must be spoken-answer friendly (do not ask the candidate to write code syntax).
`.trim();

        await this.llmProvider.stream(
            prompt,
            onToken
        );
    }


    async generateNextQuestion(
        question,
        answer,
        questionNumber,
        onToken,
        context = {}
    ) {

        // Questions asked so far (including the most recent one)
        const askedQuestions = [
            ...(
                Array.isArray(context.previousQuestions)
                    ? context.previousQuestions
                    : []
            ),
            question
        ].filter(Boolean);

        // Try the recommender first
        const recommended =
            await this._recommendQuestion(
                context,
                askedQuestions
            );

        if (recommended?.question) {

            await onToken(
                recommended.question
            );

            return;
        }

        // Fallback: generate with the LLM
        const topic =
            context.topic || "JavaScript";

        const difficulty =
            context.difficulty || "medium";

        const previousQuestions =
            Array.isArray(context.previousQuestions) && context.previousQuestions.length > 0
                ? context.previousQuestions.map((q, idx) => `${idx + 1}. ${q}`).join("\n")
                : question;

        const missingConcepts =
            Array.isArray(context.missingConcepts) && context.missingConcepts.length > 0
                ? `Candidate previously missed or could go deeper on: ${context.missingConcepts.join(", ")}.`
                : "";

        const prompt = `
You are conducting an L1 (Fundamental) interview on the topic: "${topic}".

Questions asked so far:
${previousQuestions}

Most recent question:
${question}

Candidate's answer:
${answer}

${missingConcepts}

Generate the next L1 interview question.
Question number: ${questionNumber}
Target difficulty level: ${difficulty.toUpperCase()}

Rules:
- Ask ONLY ONE question on "${topic}" at ${difficulty.toUpperCase()} difficulty.
- Do not repeat any question already asked above.
- Do not evaluate the candidate or say "correct" or "incorrect".
- Do not provide the answer.
- Keep the question concise (1 to 2 sentences maximum).
- The question must be theory/concept based so the candidate can answer verbally without writing code.
`.trim();

        await this.llmProvider.stream(
            prompt,
            onToken
        );
    }


    async evaluateAnswer(
        question,
        answer,
        context = {}
    ) {

        const topic =
            context.topic || "JavaScript";

        const currentDifficulty =
            context.difficulty || "easy";

        const prompt = `
You are an expert technical interviewer evaluating a candidate's spoken answer in an L1 (Fundamental) interview.

Topic: ${topic}
Question Difficulty: ${currentDifficulty}
Question: ${question}
Candidate's Answer: ${answer}

Evaluate the answer fairly for a spoken technical interview and respond ONLY with a valid JSON object matching this exact schema:
{
  "score": <integer from 1 to 10>,
  "strengths": ["<point 1>", "<point 2>"],
  "missingConcepts": ["<missing concept 1>", "<missing concept 2>"],
  "feedback": "<1-2 concise sentences of constructive feedback addressed to the candidate>",
  "spokenTransition": "<1 short, encouraging spoken sentence acknowledging the answer before moving on>",
  "nextDifficulty": "<easy | medium | hard>"
}

Difficulty adaptation rules:
- If score >= 8, increase nextDifficulty (easy -> medium, medium -> hard, hard -> hard).
- If score <= 4, decrease nextDifficulty (hard -> medium, medium -> easy, easy -> easy).
- Otherwise, keep nextDifficulty at "${currentDifficulty}".
`.trim();

        return await this.llmProvider.generate(
            prompt,
            { format: "json" }
        );
    }


    async generateSessionSummary(
        session
    ) {

        const historyText =
            (session.history || [])
                .map((item, idx) => (
                    `Q${idx + 1} (${item.difficulty || "easy"}): ${item.question}\n` +
                    `Answer: ${item.answer}\n` +
                    `Score: ${item.score ?? "N/A"}/10\n` +
                    `Feedback: ${item.feedback || ""}\n` +
                    `Missing Concepts: ${(item.missingConcepts || []).join(", ") || "None"}`
                ))
                .join("\n\n");

        const prompt = `
You are an expert technical interviewer preparing the final L1 (Fundamental) interview summary report.

Topic: ${session.topic || "JavaScript"}
Total Questions Answered: ${(session.history || []).length}
Average Score: ${session.averageScore ?? 0}/10

Interview Transcript & Evaluations:
${historyText}

Respond ONLY with a valid JSON object matching this exact schema:
{
  "overallFeedback": "<2-3 sentences summarizing the candidate's overall performance in this L1 interview>",
  "strongAreas": ["<strength 1>", "<strength 2>"],
  "skillGaps": ["<skill gap 1>", "<skill gap 2>"],
  "recommendedTopics": ["<revision topic 1>", "<revision topic 2>", "<revision topic 3>"],
  "readinessLevel": "<Beginner | Developing | Interview Ready | Strong>"
}
`.trim();

        return await this.llmProvider.generate(
            prompt,
            { format: "json" }
        );
    }
}


module.exports =
    LLMService;