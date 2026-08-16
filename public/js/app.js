import {
    SpeechRecognitionService
} from "./speechRecognition.js";

import {
    AudioPlayer
} from "./audioPlayer.js";

import {
    InterviewClient
} from "./interviewClient.js";


// ==========================================
// Initialize services
// ==========================================

const speechRecognition =
    new SpeechRecognitionService();


const audioPlayer =
    new AudioPlayer();


const interviewClient =
    new InterviewClient(
        audioPlayer
    );


// ==========================================
// DOM
// ==========================================

const startBtn =
    document.getElementById(
        "start-btn"
    );

const stopBtn =
    document.getElementById(
        "stop-btn"
    );

const questionOutput =
    document.getElementById(
        "question-output"
    );

const answerOutput =
    document.getElementById(
        "answer-output"
    );


// ==========================================
// Start interview question
// ==========================================

startBtn.addEventListener(
    "click",
    () => {

        questionOutput.innerText =
            "Listening...";

        answerOutput.innerText =
            "Waiting for answer...";

        speechRecognition.start();
    }
);


// ==========================================
// Stop speaking
// ==========================================

stopBtn.addEventListener(
    "click",
    async () => {

        speechRecognition.stop();


        const question =
            speechRecognition.getTranscript();


        if (!question) {

            questionOutput.innerText =
                "No question detected.";

            return;
        }


        questionOutput.innerText =
            question;


        answerOutput.innerText =
            "AI is thinking...";


        try {

            await interviewClient
                .submitQuestion(
                    question
                );

        } catch (error) {

            console.error(error);

            answerOutput.innerText =
                `Error: ${error.message}`;
        }
    }
);


// ==========================================
// Receive AI sentence
// ==========================================

interviewClient.onText =
    (text) => {

        if (
            answerOutput.innerText ===
            "AI is thinking..."
        ) {

            answerOutput.innerText = "";
        }


        answerOutput.innerText +=
            text + " ";
    };


// ==========================================
// AI completed
// ==========================================

interviewClient.onComplete =
    (answer) => {

        console.log(
            "Complete AI answer:",
            answer
        );
    };


// ==========================================
// Error
// ==========================================

interviewClient.onError =
    (error) => {

        console.error(
            "Interview error:",
            error
        );
    };