const express = require("express");
const path = require("path");

const OllamaProvider =
    require("./src/providers/ollamaProvider");

const EdgeTtsProvider =
    require("./src/providers/edgeTtsProvider");

const LLMService =
    require("./src/services/llmService");

const TTSService =
    require("./src/services/ttsService");

const InterviewService =
    require("./src/services/interviewService");

const InterviewController =
    require("./src/controllers/interviewController");

const app = express();


// Middleware

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ===============================
// Dependency Injection
// ===============================

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


const interviewService =
    new InterviewService(
        llmService,
        ttsService
    );


const interviewController =
    new InterviewController(
        interviewService
    );


// ===============================
// Routes
// ===============================

app.get("/", (req, res) => {
    reees.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

app.post(
    "/submit",
    interviewController.submit
);


app.listen(3000, () => {

    console.log(
        "Server running at http://localhost:3000"
    );
});