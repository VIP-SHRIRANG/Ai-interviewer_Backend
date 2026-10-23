const express =
    require("express");

const path =
    require("path");

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

const InterviewService =
    require(
        "./src/services/interviewService"
    );

const InterviewSession =
    require(
        "./src/services/interviewSession"
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


const edgeTtsProvider =
    new EdgeTtsProvider(
        config.TTS.VOICE
    );

const questionRecommender = config.RECOMMENDER.ENABLED
    ? new QuestionRecommenderService({
        artifactsDir: config.RECOMMENDER.ARTIFACTS_DIR,
        pooling: config.RECOMMENDER.POOLING,
        defaults: {
            company: config.RECOMMENDER.COMPANY,
            role: config.RECOMMENDER.ROLE,
            round: config.RECOMMENDER.ROUND
        }
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


const questionService =
    new QuestionService(
        llmService,
        ttsService
    );


const evaluationService =
    new EvaluationService(
        llmService
    );


const interviewSession =
    new InterviewSession();


const reportService =
    new ReportService();


const interviewService =
    new InterviewService(
        questionService,
        interviewSession,
        evaluationService
    );


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
    interviewSession,
    evaluationService,
    reportService
};