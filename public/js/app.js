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

const speechRecognition =
    new SpeechRecognitionService();


const audioPlayer =
    new AudioPlayer();


const interviewClient =
    new InterviewClient();


// ========================================
// DOM
// ========================================

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


const feedbackOutput =
    document.getElementById(
        "feedback-output"
    );


const answerOutput =
    document.getElementById(
        "answer-output"
    );


// ========================================
// State
// ========================================

let sessionId =
    null;

let interviewActive =
    false;

let candidateAnswer =
    "";


// ========================================
// START INTERVIEW
// ========================================

startBtn.addEventListener(
    "click",
    async () => {

        try {

            interviewActive =
                true;


            startBtn.disabled =
                true;


            questionOutput.innerText =
                "Generating question...";


            answerOutput.innerText =
                "Waiting for your answer...";


            await interviewClient
                .startInterview();


        } catch (error) {

            console.error(error);

            questionOutput.innerText =
                error.message;

            startBtn.disabled =
                false;
        }
    }
);


// ========================================
// SPEECH RECOGNITION
// ========================================

speechRecognition.onFinalResult =
    (text) => {

        candidateAnswer =
            text;


        answerOutput.innerText =
            text;
    };


speechRecognition.onInterimResult =
    (text) => {

        answerOutput.innerText =
            candidateAnswer +
            " " +
            text;
    };


// ========================================
// STOP / SUBMIT ANSWER
// ========================================

stopBtn.addEventListener(
    "click",
    async () => {

        if (!interviewActive) {
            return;
        }


        speechRecognition.stop();


        const answer =
            speechRecognition
                .getTranscript();


        if (!answer) {

            answerOutput.innerText =
                "No answer detected.";

            return;
        }


        console.log(
            "Candidate answer:",
            answer
        );


        answerOutput.innerText =
            "Processing answer...";


        try {

            await interviewClient
                .submitAnswer(
                    sessionId,
                    answer
                );

        } catch (error) {

            console.error(error);

            answerOutput.innerText =
                error.message;
        }
    }
);


// ========================================
// RECEIVE AI QUESTION
// ========================================

interviewClient.onQuestion =
    (data) => {

        sessionId =
            data.sessionId ||
            sessionId;


        questionOutput.innerText =
            `Question ${data.questionNumber}:\n\n` +
            data.question;


        answerOutput.innerText =
            "Listening will begin after the question.";
    };


// ========================================
// RECEIVE AUDIO
// ========================================

interviewClient.onAudio =
    (audio) => {

        audioPlayer.addAudio(
            audio
        );
    };
// ========================================
// AI GIVING INTERVIEW FEEDBACK
// ========================================

interviewClient.onFeedback =
    (feedback) => {

        feedbackOutput.innerText =
            feedback;
    };

// ========================================
// AI FINISHED SPEAKING
// ========================================

interviewClient.onComplete =
    () => {

        if (!interviewActive) {
            return;
        }


        console.log(
            "AI finished speaking."
        );


        // Automatically start listening

        candidateAnswer =
            "";


        answerOutput.innerText =
            "🎤 Your turn. Speak now.";


        speechRecognition.start();
    };


// ========================================
// ERROR
// ========================================

interviewClient.onError =
    (error) => {

        console.error(
            "Interview error:",
            error
        );
    };