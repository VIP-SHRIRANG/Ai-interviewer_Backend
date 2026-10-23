const config =
    require("../config/config");


class InterviewSession {

    constructor() {

        this.sessions = new Map();
    }


    createSession(options = {}) {

        const sessionId =
            `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const topic =
            (options.topic && String(options.topic).trim()) ||
            config.L1.DEFAULT_TOPIC;

        const difficulty =
            config.L1.DIFFICULTY_LEVELS.includes(
                String(options.difficulty || "").toLowerCase()
            )
                ? String(options.difficulty).toLowerCase()
                : config.L1.DEFAULT_DIFFICULTY;

        const requestedMax =
            Number(options.maxQuestions);

        const maxQuestions =
            Number.isFinite(requestedMax) && requestedMax >= config.L1.MIN_QUESTIONS
                ? Math.min(config.L1.MAX_QUESTIONS_LIMIT, Math.round(requestedMax))
                : config.L1.DEFAULT_MAX_QUESTIONS;

        const candidateName =
            (options.candidateName && String(options.candidateName).trim()) ||
            "Candidate";

        const company =
            (options.company && String(options.company).trim()) ||
            config.RECOMMENDER?.COMPANY ||
            "";

        const role =
            (options.role && String(options.role).trim()) ||
            config.RECOMMENDER?.ROLE ||
            "";

        const round =
            (options.round && String(options.round).trim()) ||
            config.RECOMMENDER?.ROUND ||
            "";

        const session = {

            sessionId,

            interviewMode: "L1",

            candidateName,

            company,

            role,

            round,

            topic,

            difficulty,

            maxQuestions,

            questionNumber: 0,

            currentQuestion: null,

            history: [],

            averageScore: 0,

            overallSummary: null,

            status: "active",

            createdAt: new Date().toISOString(),

            completedAt: null
        };


        this.sessions.set(
            sessionId,
            session
        );


        return session;
    }


    getSession(sessionId) {

        return this.sessions.get(
            sessionId
        );
    }


    getAllSessions() {

        return Array.from(
            this.sessions.values()
        );
    }


    setQuestion(
        sessionId,
        question
    ) {

        const session =
            this.getSession(sessionId);


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        session.questionNumber++;

        session.currentQuestion =
            question;
    }


    setDifficulty(
        sessionId,
        difficulty
    ) {

        const session =
            this.getSession(sessionId);


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        if (config.L1.DIFFICULTY_LEVELS.includes(difficulty)) {

            session.difficulty =
                difficulty;
        }
    }


    addAnswer(
        sessionId,
        answer,
        evaluation = null
    ) {

        const session =
            this.getSession(sessionId);


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        const record = {

            questionNumber:
                session.questionNumber,

            question:
                session.currentQuestion,

            difficulty:
                session.difficulty,

            answer:
                answer,

            score:
                evaluation?.score ?? null,

            feedback:
                evaluation?.feedback ?? null,

            strengths:
                evaluation?.strengths ?? [],

            missingConcepts:
                evaluation?.missingConcepts ?? [],

            evaluatedAt:
                new Date().toISOString()
        };


        session.history.push(record);


        const scoredItems =
            session.history.filter(
                item => typeof item.score === "number"
            );

        if (scoredItems.length > 0) {

            const total =
                scoredItems.reduce(
                    (sum, item) => sum + item.score,
                    0
                );

            session.averageScore =
                Number((total / scoredItems.length).toFixed(1));
        }


        return record;
    }


    completeSession(
        sessionId,
        overallSummary = null
    ) {

        const session =
            this.getSession(sessionId);


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        session.status =
            "completed";

        session.currentQuestion =
            null;

        session.completedAt =
            new Date().toISOString();

        if (overallSummary) {

            session.overallSummary =
                overallSummary;
        }


        return session;
    }
}


module.exports =
    InterviewSession;