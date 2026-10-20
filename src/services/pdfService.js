// Completed questions
session.history.forEach(
    (item, index) => {

        // existing PDF code
    }
);


// =================================
// CURRENT QUESTION
// =================================

if (
    session.currentQuestion &&
    session.status === "active"
) {

    document
        .fontSize(16)
        .text(
            `Question ${
                session.questionNumber
            }`
        );

    document.moveDown(0.5);


    document
        .font("Helvetica-Bold")
        .text(
            "Question:"
        );


    document
        .font("Helvetica")
        .text(
            session.currentQuestion
        );


    document.moveDown(0.5);


    document
        .font("Helvetica-Bold")
        .text(
            "Candidate Answer:"
        );


    document
        .font("Helvetica")
        .text(
            "Not answered yet."
        );


    document.moveDown(0.5);


    document
        .font("Helvetica-Bold")
        .text(
            "Feedback:"
        );


    document
        .font("Helvetica")
        .text(
            "Pending"
        );
}