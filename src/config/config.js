module.exports = {
    PORT: process.env.PORT || 3000,

    OLLAMA: {
        BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        MODEL: process.env.OLLAMA_MODEL || "llama3.2"
    },

    TTS: {
        VOICE: process.env.TTS_VOICE || "en-US-AriaNeural"
    },

    DB: { PATH: process.env.DB_PATH || "data/interviews.db" },

    EVALUATION: {
        IDEAL_ANSWERS_CSV: process.env.IDEAL_ANSWERS_CSV || "artifacts/questions_with_answers.clean.csv",
        RUN_WORKER: process.env.RUN_WORKER !== "false",
        POLL_MS: Number(process.env.EVAL_POLL_MS) || 2000,
        MAX_ATTEMPTS: Number(process.env.EVAL_MAX_ATTEMPTS) || 3,
        LEASE_MS: Number(process.env.EVAL_LEASE_MS) || 300000,
        BACKOFF_MS: Number(process.env.EVAL_BACKOFF_MS) || 30000,
        RETENTION_DAYS: Number(process.env.RETENTION_DAYS) || 30
    },
    
    //Added roles
    ROLES: [
        "Backend Developer", "Frontend Developer", "Full Stack Developer",
        "Software Engineer", "Android Developer", "Data Analyst",
        "Data Scientist", "DevOps Engineer", "QA Engineer"
    ],

    RECOMMENDER: {
        POOL: Number(process.env.RECOMMENDER_POOL) || 80,
        TEMPERATURE: Number(process.env.RECOMMENDER_TEMPERATURE) || 1.0,
        TOPIC_PENALTY: Number(process.env.RECOMMENDER_TOPIC_PENALTY) || 0.8,
        EXPOSURE_PENALTY: Number(process.env.RECOMMENDER_EXPOSURE_PENALTY) || 1.5,
        EXPOSURE_HALF_LIFE_HOURS: Number(process.env.RECOMMENDER_EXPOSURE_HALF_LIFE_HOURS) || 6,
        ENABLED: process.env.USE_RECOMMENDER !== "false",
        ARTIFACTS_DIR: process.env.RECOMMENDER_DIR || "artifacts",
        POOLING: process.env.RECOMMENDER_POOLING || "mean",
        COMPANY: process.env.RECOMMENDER_COMPANY || "nCircle",
        ROLE: process.env.RECOMMENDER_ROLE || "Backend Developer",
        ROUND: process.env.RECOMMENDER_ROUND || "L1 Technical Interview"
    },

    L1: {
        DEFAULT_TOPIC: "JavaScript",
        DEFAULT_DIFFICULTY: "easy",
        DEFAULT_MAX_QUESTIONS: 5,
        MIN_QUESTIONS: 1,
        MAX_QUESTIONS_LIMIT: 15,

        TOPICS: [
            {
                id: "JavaScript",
                label: "JavaScript Fundamentals",
                description: "Closures, event loop, promises, prototypes, scope, async/await, and ES6+ concepts."
            },
            {
                id: "DSA",
                label: "Data Structures & Algorithms",
                description: "Arrays, linked lists, trees, graphs, sorting, hashing, and time/space complexity."
            },
            {
                id: "OOP",
                label: "Object-Oriented Programming",
                description: "Encapsulation, inheritance, polymorphism, abstraction, SOLID principles, and design patterns."
            },
            {
                id: "DBMS",
                label: "Database Management Systems (DBMS)",
                description: "SQL vs NoSQL, normalization, ACID properties, indexing, transactions, and joins."
            },
            {
                id: "OS",
                label: "Operating Systems",
                description: "Processes, threads, CPU scheduling, deadlocks, virtual memory, and concurrency."
            },
            {
                id: "Computer Networks",
                label: "Computer Networks & Web",
                description: "OSI/TCP-IP layers, HTTP/HTTPS, DNS, REST APIs, WebSockets, and TLS handshake."
            },
            {
                id: "React & Frontend",
                label: "React & Modern Frontend",
                description: "Virtual DOM, state & props, hooks, component lifecycle, rendering, and performance."
            },
            {
                id: "Node.js & Backend",
                label: "Node.js & Backend Engineering",
                description: "Event-driven architecture, streams, middleware, RESTful API design, authentication, and scaling."
            },
            {
                id: "Behavioral",
                label: "HR & Behavioral Fundamentals",
                description: "Teamwork, conflict resolution, problem-solving approach, ownership, and communication."
            }
        ],

        DIFFICULTY_LEVELS: ["easy", "medium", "hard"]
    }
};
