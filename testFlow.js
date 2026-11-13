const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const SessionStore = require("./src/db/sessionStore");
const IdealAnswerBank = require("./src/services/idealAnswerBank");
const EvaluationWorker = require("./src/services/evaluationWorker");
const { InterviewService } = require("./src/services/interviewService");
const InterviewController = require("./src/controllers/interviewController");
const createRoutes = require("./src/routes/interviewRoutes");

const QUESTIONS = ["What is a closure?", "What is an index in a database?", "What is a deadlock?", "What is REST?", "What is OOP?"];
const idealCsvPath = path.join(os.tmpdir(), "ideal.csv");

fs.writeFileSync(idealCsvPath, "question,expected_answer\n" +
    QUESTIONS.slice(0, 4).map((q) => `"${q}","IDEAL for ${q}"`).join("\n") + "\n");   // the 5th question has NO ideal answer

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { const v = await fn(); if (v) return v; await sleep(40); } throw new Error("timeout"); };

// ---- stubs for the parts that need Ollama / TTS / PDF ----
const calls = [];
let failEvaluation = 0;
const questionService = {
    async generateQuestion(n, onAudio, ctx, onText) { const q = QUESTIONS[0]; await onAudio?.(Buffer.from("a"), q); await onText?.(q); return q; },
    async generateNextQuestion(question, answer, n, onAudio, ctx, onText) {
        const q = QUESTIONS.find((x) => !ctx.previousQuestions.includes(x)); await onAudio?.(Buffer.from("a"), q); await onText?.(q); return q; }
};
const evaluationService = {
    async evaluateAnswer(question, answer, ctx) {
        await sleep(30); calls.push({ question, ctx });
        if (failEvaluation > 0) { failEvaluation--; throw new Error("evaluator down"); }
        return { score: 8, strengths: ["clear"], missingConcepts: ["edge cases"], feedback: "Good." };
    },
    async generateSummary(session) {
        const scores = session.history.map((h) => h.score);
        return { averageScore: scores.reduce((a, b) => a + b, 0) / scores.length, overallFeedback: "ok", strongAreas: [], skillGaps: [], recommendedTopics: [], readinessLevel: "Developing" };
    }
};
const reportService = { async generatePdfBuffer(s) { return Buffer.from("%PDF-stub " + s.sessionId + " q=" + s.history.length); } };

(async () => {
    const store = new SessionStore(":memory:");
    const worker = new EvaluationWorker({ store, evaluationService, pollMs: 40, maxAttempts: 2, backoffMs: 20, logger: { log() {}, error() {} } });
    const service = new InterviewService(questionService, store, new IdealAnswerBank(idealCsvPath), { limits: { min: 1, max: 15, default: 5 }, onQueued: () => worker.notify() });
    const controller = new InterviewController(service, reportService, null);

    const app = express(); app.use(express.json()); app.use("/interview", createRoutes(controller));
    const server = app.listen(0); const base = `http://localhost:${server.address().port}/interview`;
    worker.start();

    const as = (id) => ({ "Content-Type": "application/json", "x-candidate-id": id });
    const stream = async (path, body, id) => {
        const res = await fetch(base + path, { method: "POST", headers: as(id), body: JSON.stringify(body) });
        if (!(res.headers.get("content-type") || "").includes("event-stream")) return { status: res.status, json: await res.json() };
        const text = await res.text();
        return { status: res.status, events: text.split("\n\n").filter(Boolean).map((b) => JSON.parse(b.replace(/^data: /, ""))) };
    };
    const get = async (path, id) => { const r = await fetch(base + path, { headers: as(id) }); return { status: r.status, json: (r.headers.get("content-type") || "").includes("json") ? await r.json() : null, buf: r }; };
    let passed = 0; const ok = (name) => { passed++; console.log("  ok -", name); };

    // 1) login required
    assert.strictEqual((await fetch(base + "/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status, 401); ok("start without login -> 401");
    assert.strictEqual((await fetch(base + "/sessions")).status, 401); ok("dashboard without login -> 401");

    // 2) a full 3-question interview
    const s1 = await stream("/start", { company: "nCircle", role: "Backend Developer", maxQuestions: 3, candidateName: "Asha" }, "A");
    const q1 = s1.events.find((e) => e.type === "question"); assert.ok(q1.sessionId && q1.question && s1.events.some((e) => e.type === "audio")); ok("start streams audio + question + sessionId");
    const sid = q1.sessionId;
    assert.strictEqual((await get("/sessions", "A")).json.sessions[0].status, "in_progress"); ok("dashboard shows in_progress");

    worker.running = false; await worker.stop();   // hold the worker so we can observe the queued state
    let a = await stream("/answer", { sessionId: sid, answer: "answer one" }, "A"); assert.ok(a.events.find((e) => e.type === "question")); assert.ok(!a.events.some((e) => e.type === "submitted"));
    a = await stream("/answer", { sessionId: sid, answer: "answer two" }, "A");
    const dup = await stream("/answer", { sessionId: sid, answer: "answer two" }, "A");   // a new question exists now, so this is the 3rd answer
    assert.ok(dup.events.some((e) => e.type === "submitted")); ok("last answer -> 'submitted' event (no evaluation during the interview)");
    const queued = (await get("/sessions", "A")).json.sessions[0];
    assert.strictEqual(queued.status, "under_evaluation"); assert.strictEqual(queued.queuePosition, 1); assert.strictEqual(queued.canDownload, false); ok("dashboard shows under_evaluation, position 1, no download");
    assert.strictEqual((await get("/report/" + sid, "A")).status, 409); ok("report before completion -> 409");
    assert.strictEqual((await stream("/answer", { sessionId: sid, answer: "late" }, "A")).status, 409); ok("answering a submitted interview -> 409");

    worker.start(); worker.notify();
    await waitFor(async () => (await get("/sessions/" + sid, "A")).json.status === "completed");
    const done = (await get("/sessions/" + sid, "A")).json; assert.strictEqual(done.canDownload, true); assert.strictEqual(done.averageScore, 8); ok("worker completed it: status completed, average score 8");
    const pdf = await get("/report/" + sid, "A"); assert.strictEqual(pdf.status, 200); const body = await pdf.buf.text(); assert.ok(body.includes(sid) && body.includes("q=3")); ok("download returns the report built from stored data");
    assert.ok(calls.filter((c) => c.ctx.idealAnswer).length === 3 && calls.every((c) => c.ctx.strict === true)); ok("every evaluation got its ideal answer and strict mode");

    // 3) privacy between candidates
    assert.strictEqual((await get("/sessions", "B")).json.sessions.length, 0);
    assert.strictEqual((await get("/sessions/" + sid, "B")).status, 404);
    assert.strictEqual((await get("/report/" + sid, "B")).status, 404); ok("another candidate cannot see, poll or download it");

    // 4) a question without an ideal answer (5th) is stored with null
    const s2 = await stream("/start", { company: "nCircle", role: "Backend Developer", maxQuestions: 5 }, "A"); const sid2 = s2.events.find((e) => e.type === "question").sessionId;
    for (let i = 0; i < 4; i++) await stream("/answer", { sessionId: sid2, answer: "x" + i }, "A");
    assert.strictEqual(store.getCurrentQuestion(sid2).ideal_answer, null); ok("question with no ideal answer is stored with null");

    // 5) early finish evaluates only what was answered
    const fin = await (await fetch(base + "/finish", { method: "POST", headers: as("A"), body: JSON.stringify({ sessionId: sid2 }) })).json(); assert.strictEqual(fin.status, "under_evaluation");
    await waitFor(async () => (await get("/sessions/" + sid2, "A")).json.status === "completed");
    assert.strictEqual(store.getSessionFull(sid2).history.length, 4); ok("early finish: unanswered question dropped, 4 answers evaluated");

    const s3 = await stream("/start", { company: "x", role: "y" }, "A"); const sid3 = s3.events.find((e) => e.type === "question").sessionId;
    assert.strictEqual((await fetch(base + "/finish", { method: "POST", headers: as("A"), body: JSON.stringify({ sessionId: sid3 }) })).status, 400); ok("early finish with 0 answers -> 400");

    // 6) worker retry and failure handling
    failEvaluation = 1;
    const s4 = await stream("/start", { company: "x", role: "y", maxQuestions: 1 }, "A"); const sid4 = s4.events.find((e) => e.type === "question").sessionId;
    await stream("/answer", { sessionId: sid4, answer: "retry test" }, "A");
    await waitFor(async () => (await get("/sessions/" + sid4, "A")).json.status === "completed"); ok("worker retries transient evaluation error and succeeds");

    failEvaluation = 5;
    const s5 = await stream("/start", { company: "x", role: "y", maxQuestions: 1 }, "A"); const sid5 = s5.events.find((e) => e.type === "question").sessionId;
    await stream("/answer", { sessionId: sid5, answer: "fail test" }, "A");
    await waitFor(async () => (await get("/sessions/" + sid5, "A")).json.status === "failed"); ok("worker marks session failed after maxAttempts");

    await worker.stop();
    server.close();
    console.log(`\nAll ${passed} checks passed!`);
})();
