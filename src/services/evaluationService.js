class EvaluationService {

    constructor(llmService = null) {

        this.llmService =
            llmService;
    }


    async evaluateAnswer(
        question,
        answer,
        context = {}
    ) {

        const currentDifficulty =
            context.difficulty || "easy";

        if (this.llmService && typeof this.llmService.evaluateAnswer === "function") {

            try {

                const rawResponse =
                    await this.llmService.evaluateAnswer(
                        question,
                        answer,
                        context
                    );

                const parsed =
                    this.parseEvaluationJson(
                        rawResponse,
                        currentDifficulty
                    );

                if (parsed) {
                    return parsed;
                }

            } catch (error) {

                console.error(
                    "LLM evaluation error, falling back to heuristic evaluation:",
                    error.message
                );
            }
        }

        return this.heuristicEvaluation(
            question,
            answer,
            currentDifficulty
        );
    }


    async generateSummary(
        session
    ) {

        const history =
            session.history || [];

        const totalQuestions =
            history.length;

        const averageScore =
            totalQuestions > 0
                ? Number(
                    (
                        history.reduce(
                            (sum, item) => sum + (Number(item.score) || 0),
                            0
                        ) / totalQuestions
                    ).toFixed(1)
                )
                : 0;

        session.averageScore =
            averageScore;

        if (
            this.llmService &&
            typeof this.llmService.generateSessionSummary === "function" &&
            totalQuestions > 0
        ) {

            try {

                const rawSummary =
                    await this.llmService.generateSessionSummary(
                        session
                    );

                const parsed =
                    this.parseSummaryJson(
                        rawSummary,
                        averageScore,
                        history
                    );

                if (parsed) {
                    return parsed;
                }

            } catch (error) {

                console.error(
                    "LLM summary error, using computed summary:",
                    error.message
                );
            }
        }

        return this.buildFallbackSummary(
            session,
            averageScore
        );
    }


    parseEvaluationJson(
        rawText,
        currentDifficulty = "easy"
    ) {

        if (!rawText) {
            return null;
        }

        const cleaned =
            this.extractJsonBlock(rawText);

        let data;

        try {
            data = JSON.parse(cleaned);
        } catch (_) {
            return null;
        }

        const rawScore =
            Number(data.score);

        const score =
            Number.isFinite(rawScore)
                ? Math.max(1, Math.min(10, Math.round(rawScore)))
                : 6;

        const strengths =
            Array.isArray(data.strengths)
                ? data.strengths.filter(Boolean).map(String)
                : [];

        const missingConcepts =
            Array.isArray(data.missingConcepts)
                ? data.missingConcepts.filter(Boolean).map(String)
                : [];

        const feedback =
            typeof data.feedback === "string" && data.feedback.trim()
                ? data.feedback.trim()
                : "Good effort explaining the concept. Try adding concrete examples and edge cases.";

        const spokenTransition =
            typeof data.spokenTransition === "string" && data.spokenTransition.trim()
                ? data.spokenTransition.trim()
                : feedback;

        const validDifficulties = [
            "easy",
            "medium",
            "hard"
        ];

        const nextDifficulty =
            validDifficulties.includes(
                String(data.nextDifficulty || "").toLowerCase()
            )
                ? String(data.nextDifficulty).toLowerCase()
                : this.computeNextDifficulty(
                    score,
                    currentDifficulty
                );

        return {
            score,
            strengths,
            missingConcepts,
            feedback,
            spokenTransition,
            nextDifficulty
        };
    }


    parseSummaryJson(
        rawText,
        averageScore,
        history
    ) {

        if (!rawText) {
            return null;
        }

        const cleaned =
            this.extractJsonBlock(rawText);

        let data;

        try {
            data = JSON.parse(cleaned);
        } catch (_) {
            return null;
        }

        const allStrengths =
            history.flatMap(h => h.strengths || []).slice(0, 4);

        const allGaps =
            history.flatMap(h => h.missingConcepts || []).slice(0, 4);

        return {
            averageScore,
            totalQuestions: history.length,
            readinessLevel:
                data.readinessLevel ||
                this.getReadinessLabel(averageScore),
            overallFeedback:
                typeof data.overallFeedback === "string" && data.overallFeedback.trim()
                    ? data.overallFeedback.trim()
                    : `Completed ${history.length} questions with an average score of ${averageScore}/10.`,
            strongAreas:
                Array.isArray(data.strongAreas) && data.strongAreas.length > 0
                    ? data.strongAreas.map(String)
                    : allStrengths,
            skillGaps:
                Array.isArray(data.skillGaps) && data.skillGaps.length > 0
                    ? data.skillGaps.map(String)
                    : allGaps,
            recommendedTopics:
                Array.isArray(data.recommendedTopics) && data.recommendedTopics.length > 0
                    ? data.recommendedTopics.map(String)
                    : allGaps
        };
    }


    extractJsonBlock(text) {

        const trimmed =
            String(text).trim();

        const match =
            trimmed.match(/\{[\s\S]*\}/);

        return match ? match[0] : trimmed;
    }


    computeNextDifficulty(
        score,
        currentDifficulty = "easy"
    ) {

        const order = ["easy", "medium", "hard"];

        const idx =
            Math.max(0, order.indexOf(currentDifficulty));

        if (score >= 8) {
            return order[Math.min(order.length - 1, idx + 1)];
        }

        if (score <= 4) {
            return order[Math.max(0, idx - 1)];
        }

        return order[idx];
    }


    getReadinessLabel(averageScore) {

        if (averageScore >= 8) return "Strong";
        if (averageScore >= 6.5) return "Interview Ready";
        if (averageScore >= 4.5) return "Developing";
        return "Beginner";
    }


    heuristicEvaluation(
        question,
        answer,
        currentDifficulty = "easy"
    ) {

        const wordCount =
            String(answer || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean).length;

        let score = 5;
        let strengths = ["Addressed the question prompt"];
        let missingConcepts = ["Could provide deeper technical Trade-offs or examples"];
        let feedback =
            "That is a reasonable explanation. Adding a real-world use case or discussing edge cases would make your answer stronger.";

        if (wordCount >= 35) {
            score = 8;
            strengths = [
                "Provided a detailed explanation",
                "Structured thoughts clearly"
            ];
            missingConcepts = ["Time/space or edge-case trade-offs"];
            feedback =
                "Strong, thorough answer covering the core concept well. Let's increase the challenge on the next question.";
        } else if (wordCount < 10) {
            score = 4;
            strengths = ["Attempted a concise response"];
            missingConcepts = [
                "Core conceptual mechanism",
                "Practical example"
            ];
            feedback =
                "Your answer was quite brief. Try explaining how the concept works under the hood and why it matters in practice.";
        }

        const nextDifficulty =
            this.computeNextDifficulty(
                score,
                currentDifficulty
            );

        return {
            score,
            strengths,
            missingConcepts,
            feedback,
            spokenTransition: feedback,
            nextDifficulty
        };
    }


    buildFallbackSummary(
        session,
        averageScore
    ) {

        const history =
            session.history || [];

        const strongAreas =
            [...new Set(history.flatMap(h => h.strengths || []))].slice(0, 5);

        const skillGaps =
            [...new Set(history.flatMap(h => h.missingConcepts || []))].slice(0, 5);

        return {
            averageScore,
            totalQuestions: history.length,
            readinessLevel: this.getReadinessLabel(averageScore),
            overallFeedback:
                `You completed the L1 ${session.topic || "Fundamental"} interview with an average score of ${averageScore}/10 across ${history.length} questions.`,
            strongAreas:
                strongAreas.length > 0
                    ? strongAreas
                    : ["Completed fundamental interview questions"],
            skillGaps:
                skillGaps.length > 0
                    ? skillGaps
                    : ["Deepen explanations with concrete examples and trade-offs"],
            recommendedTopics:
                skillGaps.length > 0
                    ? skillGaps
                    : [`Core ${session.topic || "JavaScript"} internals and edge cases`]
        };
    }
}


module.exports =
    EvaluationService;