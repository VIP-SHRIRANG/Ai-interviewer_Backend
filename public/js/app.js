import {
    SpeechRecognitionService
} from "./speechRecognition.js";

import {
    AudioPlayer
} from "./audioPlayer.js";

import {
    InterviewClient
} from "./interviewClient.js";


// ========================================
// Services
// ========================================

let speechRecognition = null;

try {
    speechRecognition =
        new SpeechRecognitionService();
} catch (err) {
    console.warn(
        "Browser SpeechRecognition unavailable; text input mode enabled:",
        err.message
    );
}

const audioPlayer =
    new AudioPlayer();

const interviewClient =
    new InterviewClient();


// ========================================
// DOM Elements
// ========================================

const startBtn =
    document.getElementById("start-btn");

const micBtn =
    document.getElementById("mic-btn");

const stopBtn =
    document.getElementById("stop-btn");

const finishBtn =
    document.getElementById("finish-btn");

const downloadReportBtn =
    document.getElementById("download-report-btn");

const candidateNameInput =
    document.getElementById("candidate-name");

const topicSelect =
    document.getElementById("topic-select");

const difficultySelect =
    document.getElementById("difficulty-select");

const maxQuestionsSelect =
    document.getElementById("max-questions-select");

const statusBadge =
    document.getElementById("session-status-badge");

const metricsBar =
    document.getElementById("metrics-bar");

const metricTopic =
    document.getElementById("metric-topic");

const metricProgress =
    document.getElementById("metric-progress");

const metricDifficulty =
    document.getElementById("metric-difficulty");

const metricScore =
    document.getElementById("metric-score");

const questionOutput =
    document.getElementById("question-output");

const answerOutput =
    document.getElementById("answer-output");

const manualAnswerInput =
    document.getElementById("manual-answer-input");

const feedbackOutput =
    document.getElementById("feedback-output");

const summarySection =
    document.getElementById("summary-section");

const summaryReadiness =
    document.getElementById("summary-readiness");

const summaryOverallFeedback =
    document.getElementById("summary-overall-feedback");

const summaryStrengths =
    document.getElementById("summary-strengths");

const summaryGaps =
    document.getElementById("summary-gaps");

const summaryRecommendations =
    document.getElementById("summary-recommendations");


// ========================================
// State
// ========================================

let sessionId = null;
let interviewActive = false;
let isListening = false;
let sseStreamComplete = false;
let candidateAnswer = "";
let maxQuestions = 5;


// ========================================
// Helpers
// ========================================

function setStatus(label, cssState = "") {
    statusBadge.innerText = label;
    statusBadge.className = `status-pill ${cssState}`.trim();
}

function updateDifficultyBadge(difficulty = "easy") {
    const clean = String(difficulty || "easy").toLowerCase();
    metricDifficulty.innerText = clean.toUpperCase();
    metricDifficulty.className = `diff-badge diff-${clean}`;
}

function startCandidateTurn() {
    if (!interviewActive) {
        return;
    }

    candidateAnswer = "";
    manualAnswerInput.value = "";
    manualAnswerInput.disabled = false;
    stopBtn.disabled = false;
    finishBtn.disabled = false;

    if (speechRecognition) {
        micBtn.disabled = false;
        try {
            speechRecognition.start();
            isListening = true;
            micBtn.innerText = "🎙 Listening...";
            setStatus("LISTENING", "active");
            answerOutput.innerText = "🎤 Speak your answer now, or type below and click 'Submit Answer'.";
        } catch (_) {
            setStatus("YOUR TURN", "active");
            answerOutput.innerText = "Type your answer below or click 'Start Speaking'.";
        }
    } else {
        setStatus("YOUR TURN (TEXT MODE)", "active");
        answerOutput.innerText = "Speech recognition is not supported in this browser. Type your answer below and click 'Submit Answer'.";
    }
}

function renderListItems(ulElement, items = []) {
    ulElement.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
        const li = document.createElement("li");
        li.innerText = "None noted";
        ulElement.appendChild(li);
        return;
    }
    for (const item of items) {
        const li = document.createElement("li");
        li.innerText = item;
        ulElement.appendChild(li);
    }
}

function renderEvaluationCard(evaluation) {
    if (!evaluation || typeof evaluation === "string") {
        feedbackOutput.innerText = evaluation || "Evaluation recorded.";
        return;
    }

    const strengths =
        (evaluation.strengths || []).map(s => `<li>${s}</li>`).join("") ||
        "<li>Addressed the question</li>";

    const missing =
        (evaluation.missingConcepts || []).map(m => `<li>${m}</li>`).join("") ||
        "<li>None identified</li>";

    feedbackOutput.innerHTML = `
        <div class="eval-card">
            <div class="eval-score-row">
                <span>Question ${evaluation.questionNumber || ""} Evaluation</span>
                <span class="score-pill">Score: ${evaluation.score ?? "—"}/10 • Next Difficulty: ${String(evaluation.nextDifficulty || "easy").toUpperCase()}</span>
            </div>
            <div>${evaluation.feedback || ""}</div>
            <div class="eval-lists">
                <div class="eval-list-box">
                    <h4>Strengths Covered</h4>
                    <ul>${strengths}</ul>
                </div>
                <div class="eval-list-box">
                    <h4>Concepts to Deepen</h4>
                    <ul>${missing}</ul>
                </div>
            </div>
        </div>
    `;
}

function renderSummary(data) {
    interviewActive = false;
    isListening = false;

    if (speechRecognition) {
        try {
            speechRecognition.stop();
        } catch (_) {}
    }

    micBtn.disabled = true;
    stopBtn.disabled = true;
    finishBtn.disabled = true;
    manualAnswerInput.disabled = true;
    startBtn.disabled = false;
    startBtn.innerText = "🔄 Start New L1 Interview";

    setStatus("COMPLETED", "completed");

    const summary = data.summary || {};
    const avgScore = data.averageScore ?? summary.averageScore ?? 0;

    metricScore.innerText = `${avgScore} / 10`;

    summarySection.classList.remove("hidden");
    summaryReadiness.innerText =
        `Average Score: ${avgScore}/10 • Readiness Level: ${summary.readinessLevel || "Completed"}`;
    summaryOverallFeedback.innerText =
        summary.overallFeedback || "L1 Interview completed.";

    renderListItems(summaryStrengths, summary.strongAreas);
    renderListItems(summaryGaps, summary.skillGaps);
    renderListItems(summaryRecommendations, summary.recommendedTopics);
}


// ========================================
// Load Available L1 Topics on Boot
// ========================================

(async function initTopics() {
    try {
        const configData = await interviewClient.fetchTopics();
        if (Array.isArray(configData.topics) && configData.topics.length > 0) {
            topicSelect.innerHTML = "";
            for (const t of configData.topics) {
                const opt = document.createElement("option");
                opt.value = t.id;
                opt.innerText = t.label;
                topicSelect.appendChild(opt);
            }
        }
    } catch (err) {
        console.warn("Using default topic options:", err.message);
    }
})();


// ========================================
// START L1 INTERVIEW
// ========================================

startBtn.addEventListener(
    "click",
    async () => {

        try {

            audioPlayer.stop();

            interviewActive = true;
            sseStreamComplete = false;
            sessionId = null;

            const selectedTopic = topicSelect.value;
            const selectedDifficulty = difficultySelect.value;
            maxQuestions = Number(maxQuestionsSelect.value) || 5;
            const candidateName = candidateNameInput.value.trim() || "Candidate";

            startBtn.disabled = true;
            micBtn.disabled = true;
            stopBtn.disabled = true;
            finishBtn.disabled = true;
            manualAnswerInput.disabled = true;
            summarySection.classList.add("hidden");

            metricsBar.classList.remove("hidden");
            metricTopic.innerText = selectedTopic;
            metricProgress.innerText = `1 / ${maxQuestions}`;
            updateDifficultyBadge(selectedDifficulty);
            metricScore.innerText = "— / 10";

            setStatus("AI THINKING...", "speaking");

            questionOutput.innerText =
                `Generating L1 ${selectedTopic} question...`;

            answerOutput.innerText =
                "Waiting for the AI interviewer to finish asking the question...";

            feedbackOutput.innerText =
                "Waiting for your first answer...";

            await interviewClient.startInterview({
                topic: selectedTopic,
                difficulty: selectedDifficulty,
                maxQuestions,
                candidateName
            });

        } catch (error) {

            console.error(error);

            setStatus("ERROR");

            questionOutput.innerText =
                `Error starting interview: ${error.message}`;

            startBtn.disabled = false;
            interviewActive = false;
        }
    }
);


// ========================================
// MICROPHONE TOGGLE
// ========================================

micBtn.addEventListener(
    "click",
    () => {

        if (!speechRecognition || !interviewActive) {
            return;
        }

        if (isListening) {
            speechRecognition.stop();
            isListening = false;
            micBtn.innerText = "🎤 Start Speaking";
        } else {
            speechRecognition.start();
            isListening = true;
            micBtn.innerText = "🎙 Listening...";
        }
    }
);


// ========================================
// SPEECH RECOGNITION EVENTS
// ========================================

if (speechRecognition) {

    speechRecognition.onFinalResult =
        (text) => {

            candidateAnswer = text;
            answerOutput.innerText = text;
            manualAnswerInput.value = text;
        };

    speechRecognition.onInterimResult =
        (text) => {

            const combined =
                (candidateAnswer + " " + text).trim();

            answerOutput.innerText = combined;
            manualAnswerInput.value = combined;
        };

    speechRecognition.onEnd =
        () => {
            isListening = false;
            micBtn.innerText = "🎤 Start Speaking";
        };
}


// ========================================
// SUBMIT ANSWER
// ========================================

stopBtn.addEventListener(
    "click",
    async () => {

        if (!interviewActive || !sessionId) {
            return;
        }

        if (speechRecognition && isListening) {
            speechRecognition.stop();
            isListening = false;
            micBtn.innerText = "🎤 Start Speaking";
        }

        const spokenTranscript =
            speechRecognition
                ? speechRecognition.getTranscript()
                : "";

        const manualText =
            manualAnswerInput.value.trim();

        const finalAnswer =
            manualText || spokenTranscript || candidateAnswer.trim();

        if (!finalAnswer) {
            answerOutput.innerText =
                "No answer detected. Please speak or type your answer before submitting.";
            return;
        }

        stopBtn.disabled = true;
        micBtn.disabled = true;
        manualAnswerInput.disabled = true;
        sseStreamComplete = false;

        setStatus("EVALUATING...", "speaking");
        answerOutput.innerText = finalAnswer;
        feedbackOutput.innerText = "Evaluating your answer and preparing next step...";

        try {

            await interviewClient.submitAnswer(
                sessionId,
                finalAnswer
            );

        } catch (error) {

            console.error(error);

            setStatus("ERROR");
            answerOutput.innerText = `Error: ${error.message}`;
            stopBtn.disabled = false;
            manualAnswerInput.disabled = false;
        }
    }
);


// ========================================
// END INTERVIEW EARLY & GENERATE SUMMARY
// ========================================

finishBtn.addEventListener(
    "click",
    async () => {

        if (!sessionId) {
            return;
        }

        try {

            audioPlayer.stop();

            if (speechRecognition && isListening) {
                speechRecognition.stop();
            }

            setStatus("GENERATING REPORT...", "speaking");

            const result =
                await interviewClient.finishInterview(sessionId);

            renderSummary(result);

        } catch (error) {

            console.error(error);
            feedbackOutput.innerText = `Unable to finish interview: ${error.message}`;
        }
    }
);


// ========================================
// DOWNLOAD PDF REPORT
// ========================================

downloadReportBtn.addEventListener(
    "click",
    async () => {

        if (!sessionId) {
            return;
        }

        const originalText = downloadReportBtn.innerText;

        try {

            downloadReportBtn.disabled = true;
            downloadReportBtn.innerText = "⏳ Preparing PDF...";

            await interviewClient.downloadReport(sessionId);

        } catch (error) {

            console.error(error);
            alert(error.message || "Failed to download PDF report");

        } finally {

            downloadReportBtn.disabled = false;
            downloadReportBtn.innerText = originalText;
        }
    }
);


// ========================================
// INTERVIEW CLIENT & AUDIO CALLBACKS
// ========================================

interviewClient.onQuestion =
    (data) => {

        sessionId =
            data.sessionId || sessionId;

        if (data.maxQuestions) {
            maxQuestions = data.maxQuestions;
        }

        if (data.topic) {
            metricTopic.innerText = data.topic;
        }

        if (data.difficulty) {
            updateDifficultyBadge(data.difficulty);
        }

        if (typeof data.averageScore === "number" && data.averageScore > 0) {
            metricScore.innerText = `${data.averageScore} / 10`;
        }

        metricProgress.innerText =
            `${data.questionNumber} / ${maxQuestions}`;

        questionOutput.innerText =
            `Question ${data.questionNumber} (${String(data.difficulty || difficultySelect.value).toUpperCase()}):\n\n` +
            data.question;

        answerOutput.innerText =
            "🔊 Listening to the AI interviewer...";
    };


interviewClient.onAudio =
    (audio) => {

        setStatus("AI SPEAKING...", "speaking");
        audioPlayer.addAudio(audio);
    };


interviewClient.onFeedback =
    (data) => {

        const evaluation =
            data.evaluation || data.feedback;

        if (evaluation && typeof evaluation.averageScore === "number") {
            metricScore.innerText = `${evaluation.averageScore} / 10`;
        }

        renderEvaluationCard(evaluation);
    };


interviewClient.onSessionCompleted =
    (data) => {

        renderSummary(data);
    };


interviewClient.onComplete =
    () => {

        sseStreamComplete = true;

        if (!interviewActive) {
            return;
        }

        // Only start microphone once AudioPlayer finishes playing all queued TTS sentences
        if (!audioPlayer.hasPendingAudio()) {
            startCandidateTurn();
        }
    };


audioPlayer.onQueueEmpty =
    () => {

        if (interviewActive && sseStreamComplete) {
            startCandidateTurn();
        }
    };


interviewClient.onError =
    (error) => {

        console.error(
            "Interview error:",
            error
        );

        setStatus("ERROR");
        questionOutput.innerText = `Error: ${error}`;
        startBtn.disabled = false;
    };