const express =
    require("express");

const path =
    require("path");

const SessionStore = require("./src/db/sessionStore");
const IdealAnswerBank = require("./src/services/idealAnswerBank");
const EvaluationWorker = require("./src/services/evaluationWorker");

const cors =
    require("cors");

const config =
    require("./src/config/config");


// Providers

const OllamaProvider =
    require(
        "./src/providers/ollamaProvider"
    );

const QuestionRecommenderService =
    require(
        "./src/services/questionRecommenderService"
    );

const EdgeTtsProvider =
    require(
        "./src/providers/edgeTtsProvider"
    );


// Services

const LLMService =
    require(
        "./src/services/llmService"
    );

const TTSService =
    require(
        "./src/services/ttsService"
    );

const QuestionService =
    require(
        "./src/services/questionService"
    );

const EvaluationService =
    require(
        "./src/services/evaluationService"
    );

const { InterviewService } =
    require(
        "./src/services/interviewService"
    );

const ReportService =
    require(
        "./src/services/reportService"
    );


// Controller

const InterviewController =
    require(
        "./src/controllers/interviewController"
    );


// Routes

const createInterviewRoutes =
    require(
        "./src/routes/interviewRoutes"
    );


const app =
    express();


app.use(
    express.json()
);

app.use(
    express.urlencoded({
        extended: true
    })
);

//Added CORS middleware to allow requests from frontend
app.use(cors({
  origin: "http://localhost:5173",       // your Vite URL
  exposedHeaders: ["x-session-id"],
}));

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ==========================================
// Dependency Injection
// ==========================================

const ollamaProvider =
    new OllamaProvider(
        config.OLLAMA.BASE_URL,
        config.OLLAMA.MODEL
    );

ollamaProvider
    .generate("Reply with the word OK.", { maxTokens: 5 })
    .then(() => console.log("Ollama model warmed up"))
    .catch((e) => console.error("Ollama warm-up failed:", e.message));


const edgeTtsProvider =
    new EdgeTtsProvider(
        config.TTS.VOICE
    );
    
    const store = new SessionStore(config.DB.PATH);
    
    const idealAnswers = new IdealAnswerBank(config.EVALUATION.IDEAL_ANSWERS_CSV);

const questionRecommender = config.RECOMMENDER.ENABLED
    ? new QuestionRecommenderService({

        artifactsDir: config.RECOMMENDER.ARTIFACTS_DIR,
        pooling: config.RECOMMENDER.POOLING,
        defaults: { company: config.RECOMMENDER.COMPANY, role: config.RECOMMENDER.ROLE, round: config.RECOMMENDER.ROUND },
        sessionOptions: {
            pool: config.RECOMMENDER.POOL,
            temperature: config.RECOMMENDER.TEMPERATURE,
            topicPenalty: config.RECOMMENDER.TOPIC_PENALTY,
            exposurePenalty: config.RECOMMENDER.EXPOSURE_PENALTY
        },
        exposureHalfLifeHours: config.RECOMMENDER.EXPOSURE_HALF_LIFE_HOURS
    })
    : null;

    questionRecommender?.init()
    .then(() => console.log("Question recommender ready"))
    .catch((e) => console.error("Recommender failed to load, using LLM questions:", e.message));

const llmService = 
    new LLMService(ollamaProvider, questionRecommender);

const ttsService =
    new TTSService(
        edgeTtsProvider
    );



const evaluationService =
    new EvaluationService(
        llmService
    );


const questionService =
    new QuestionService(
        llmService,
        ttsService
    );


const evaluationWorker = new EvaluationWorker({
    store,
    evaluationService,
    pollMs: config.EVALUATION.POLL_MS,
    maxAttempts: config.EVALUATION.MAX_ATTEMPTS,
    leaseMs: config.EVALUATION.LEASE_MS,
    backoffMs: config.EVALUATION.BACKOFF_MS
});


const interviewService = new InterviewService(questionService, store, idealAnswers, {
    limits: {
        min: config.L1.MIN_QUESTIONS,
        max: config.L1.MAX_QUESTIONS_LIMIT,
        default: config.L1.DEFAULT_MAX_QUESTIONS
    },
    onQueued: () => evaluationWorker.notify()
});


const reportService =
    new ReportService();


const interviewController =
    new InterviewController(
        interviewService,
        reportService,
        questionRecommender
    );


// ==========================================
// Routes
// ==========================================

const interviewRouter =
    createInterviewRoutes(
        interviewController
    );

app.use(
    "/interview",
    interviewRouter
);

app.use(
    "/api/interview",
    interviewRouter
);


// ==========================================
// Start server
// ==========================================

if (require.main === module) {
    if (config.EVALUATION.RUN_WORKER) evaluationWorker.start();

    setInterval(() => store.deleteOlderThan(config.EVALUATION.RETENTION_DAYS), 6 * 60 * 60 * 1000);

    process.on("SIGINT", async () => {
        await evaluationWorker.stop();
        store.close();
        process.exit(0);
    });

    app.listen(
        
        config.PORT,
        () => {

            console.log(
                `Server running at http://localhost:${config.PORT}`
            );

        }
    );
}


module.exports = {
    app,
    interviewService,
    evaluationService,
    reportService
};