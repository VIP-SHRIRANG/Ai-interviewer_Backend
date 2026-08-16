const express =
    require("express");

const path =
    require("path");


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

const InterviewService =
    require(
        "./src/services/interviewService"
    );

const InterviewSession =
    require(
        "./src/services/interviewSession"
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
        "http://localhost:11434",
        "llama3.2"
    );


const edgeTtsProvider =
    new EdgeTtsProvider(
        "en-US-AriaNeural"
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


const interviewSession =
    new InterviewSession();


const interviewService =
    new InterviewService(
        questionService,
        interviewSession
    );


const interviewController =
    new InterviewController(
        interviewService
    );


// ==========================================
// Routes
// ==========================================

app.use(
    "/interview",
    createInterviewRoutes(
        interviewController
    )
);


// ==========================================
// Start server
// ==========================================

app.listen(
    3000,
    () => {

        console.log(
            "Server running at http://localhost:3000"
        );

    }
);