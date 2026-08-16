class EvaluationService {

    evaluateAnswer(
        question,
        answer
    ) {

        console.log(
            "Evaluating answer..."
        );

        console.log(
            "Question:",
            question
        );

        console.log(
            "Answer:",
            answer
        );


        // Temporary hardcoded feedback

        const feedback = [
            "That's a good answer. Let's move to the next question.",

            "Good explanation. Let's explore another concept.",

            "That's a reasonable answer. Let's continue.",

            "Good attempt. Let's move on to the next question.",

            "I understand your approach. Let's continue with another question."
        ];


        const randomIndex =
            Math.floor(
                Math.random() *
                feedback.length
            );


        return feedback[
            randomIndex
        ];
    }
}


module.exports =
    EvaluationService;