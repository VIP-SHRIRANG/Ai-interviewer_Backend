class InterviewSession {

    constructor() {

        this.sessions = new Map();
    }


    createSession() {

        const sessionId =
            Date.now().toString();

        const session = {

            sessionId,

            questionNumber: 0,

            currentQuestion: null,

            history: [],

            status: "active"
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


    addAnswer(
        sessionId,
        answer
    ) {

        const session =
            this.getSession(sessionId);


        if (!session) {

            throw new Error(
                "Interview session not found"
            );
        }


        session.history.push({

            question:
                session.currentQuestion,

            answer:
                answer
        });
    }
}


module.exports =
    InterviewSession;