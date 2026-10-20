module.exports = {
    PORT: process.env.PORT || 3000,

    OLLAMA: {
        BASE_URL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        MODEL: process.env.OLLAMA_MODEL || "llama3.2"
    },

    TTS: {
        VOICE: process.env.TTS_VOICE || "en-US-AriaNeural"
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
