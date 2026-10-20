const express =
    require("express");

const path =
    require("path");

const config =
    require("./src/config/config");


// Providers

const OllamaProvider =
    require(
        "./src/providers/ollamaProvider"
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


const llmService =
    new LLMService(
        ollamaProvider
    );


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
        reportService
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