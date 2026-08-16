const express =
    require("express");


function createInterviewRoutes(
    controller
) {

    const router =
        express.Router();


    router.post(
        "/start",
        controller.start
    );


    router.post(
        "/answer",
        controller.answer
    );


    return router;
}


module.exports =
    createInterviewRoutes;