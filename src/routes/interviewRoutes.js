const express =
    require("express");


function createInterviewRoutes(
    controller
) {

    const router =
        express.Router();


    router.get("/options", controller.getOptions);

    // interview
    router.post("/start", controller.start);
    router.post("/answer", controller.answer);
    router.post("/finish", controller.finish);

    // dashboard
    router.get("/sessions", controller.listSessions);
    router.get("/sessions/:sessionId", controller.getSessionStatus);
    router.post("/sessions/:sessionId/retry", controller.retry);
    router.get("/report/:sessionId", controller.downloadReport);


    return router;
}


module.exports =
    createInterviewRoutes;