const express =
    require("express");


function createInterviewRoutes(
    controller
) {

    const router =
        express.Router();


    router.get(
        "/topics",
        controller.getTopics
    );


    router.post(
        "/start",
        controller.start
    );


    router.post(
        "/answer",
        controller.answer
    );


    router.post(
        "/:sessionId/answer",
        (req, res) => {
            req.body = {
                ...req.body,
                sessionId: req.params.sessionId
            };
            return controller.answer(req, res);
        }
    );


    router.post(
        "/finish",
        controller.finish
    );


    router.post(
        "/:sessionId/finish",
        controller.finish
    );


    router.get(
        "/report/:sessionId",
        controller.downloadReport
    );


    router.get(
        "/:sessionId",
        controller.getSession
    );


    return router;
}


module.exports =
    createInterviewRoutes;