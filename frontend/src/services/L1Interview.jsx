import { useState } from "react";

function L1Interview() {
  const [candidateName, setCandidateName] = useState("Candidate");
  const [topic, setTopic] = useState("JavaScript");
  const [difficulty, setDifficulty] = useState("easy");
  const [maxQuestions, setMaxQuestions] = useState("5");

  const [sessionStatus, setSessionStatus] = useState("IDLE");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [answer, setAnswer] = useState("");

  const [question, setQuestion] = useState(
    'Configure your L1 topic above and click "Start L1 Interview" to begin.'
  );

  const [answerOutput, setAnswerOutput] = useState(
    "Waiting for interview to start..."
  );

  const [feedback, setFeedback] = useState(
    "Your question-level score, covered strengths, and missing concepts will appear here after each answer."
  );

  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(null);
  const [showSummary, setShowSummary] = useState(false);

  const startInterview = () => {
    setSessionStarted(true);
    setSessionStatus("IN PROGRESS");
    setProgress(0);
    setScore(null);
    setShowSummary(false);
    setAnswer("");
    setAnswerOutput("Your answer will appear here.");
    setFeedback("Waiting for your first answer evaluation...");
    setQuestion(
      "Your interview session has started. Connect your backend to generate the first question."
    );
  };

  const submitAnswer = () => {
    if (!answer.trim()) {
      setAnswerOutput("Please enter or speak your answer first.");
      return;
    }

    setAnswerOutput(answer);
    setFeedback(
      "Answer submitted. Connect your existing backend to evaluate this answer."
    );
    setProgress((previous) =>
      Math.min(previous + 1, Number(maxQuestions))
    );
    setAnswer("");
  };

  const finishInterview = () => {
    setSessionStatus("COMPLETED");
    setSessionStarted(false);
    setShowSummary(true);
  };

  const downloadReport = () => {
    window.print();
  };

  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  const sectionClass =
    "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7";

  const headingClass = "text-lg font-bold tracking-tight text-slate-900";

  const outputClass =
    "mt-4 min-h-20 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700";

  const primaryButton =
    "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-50";

  const secondaryButton =
    "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-800 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">

        {/* Header */}
        <header className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
          <div>
            <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold tracking-wide text-indigo-700">
              L1 MODULE • FUNDAMENTAL INTERVIEW
            </span>

            <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Personalized AI Interviewer
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Adaptive conceptual and technical interview practice with
              real-time voice, evaluation, and PDF reporting.
            </p>
          </div>

          <div
            className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
              sessionStatus === "IN PROGRESS"
                ? "bg-emerald-50 text-emerald-700"
                : sessionStatus === "COMPLETED"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {sessionStatus}
          </div>
        </header>

        {/* Interview Configuration */}
        <section className={sectionClass}>
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              Setup
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              1. Configure Your L1 Interview
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Choose your topic and customize your interview session.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="candidate-name"
                className="text-sm font-semibold text-slate-700"
              >
                Candidate Name
              </label>
              <input
                id="candidate-name"
                type="text"
                placeholder="Enter candidate name"
                value={candidateName}
                onChange={(event) => setCandidateName(event.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="topic-select"
                className="text-sm font-semibold text-slate-700"
              >
                Fundamental Topic
              </label>
              <select
                id="topic-select"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                className={inputClass}
                disabled={sessionStarted}
              >
                <option value="JavaScript">JavaScript Fundamentals</option>
                <option value="DSA">Data Structures &amp; Algorithms</option>
                <option value="OOP">Object-Oriented Programming</option>
                <option value="DBMS">Database Management Systems</option>
                <option value="OS">Operating Systems</option>
                <option value="Computer Networks">Computer Networks &amp; Web</option>
                <option value="React & Frontend">React &amp; Modern Frontend</option>
                <option value="Node.js & Backend">Node.js &amp; Backend Engineering</option>
                <option value="Behavioral">HR &amp; Behavioral Fundamentals</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="difficulty-select"
                className="text-sm font-semibold text-slate-700"
              >
                Starting Difficulty
              </label>
              <select
                id="difficulty-select"
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                className={inputClass}
                disabled={sessionStarted}
              >
                <option value="easy">Easy — Core Concepts</option>
                <option value="medium">Medium — Applied Concepts</option>
                <option value="hard">Hard — Advanced Concepts</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="max-questions-select"
                className="text-sm font-semibold text-slate-700"
              >
                Number of Questions
              </label>
              <select
                id="max-questions-select"
                value={maxQuestions}
                onChange={(event) => setMaxQuestions(event.target.value)}
                className={inputClass}
                disabled={sessionStarted}
              >
                <option value="3">3 Questions — Quick Drill</option>
                <option value="5">5 Questions — Standard L1</option>
                <option value="8">8 Questions — Deep Practice</option>
                <option value="10">10 Questions — Full Mock</option>
              </select>
            </div>
          </div>
        </section>

        {/* Live Metrics */}
        {sessionStarted && (
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Topic
              </p>
              <p className="mt-3 break-words text-base font-bold text-slate-900">
                {topic}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Progress
              </p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900">
                {progress}
                <span className="text-base font-medium text-slate-400">
                  {" "}/ {maxQuestions}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{
                    width: `${(progress / Number(maxQuestions)) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Difficulty
              </p>
              <p className="mt-3 text-lg font-bold capitalize text-indigo-600">
                {difficulty}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Running Score
              </p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900">
                {score === null ? "— / 10" : `${score} / 10`}
              </p>
            </div>
          </section>
        )}

        {/* Session Controls */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
          <button
            id="start-btn"
            className={primaryButton}
            onClick={startInterview}
            disabled={sessionStarted}
          >
            🚀 Start L1 Interview
          </button>

          <button
            id="finish-btn"
            className={secondaryButton}
            onClick={finishInterview}
            disabled={!sessionStarted}
          >
            🏁 End &amp; Generate Summary
          </button>
        </section>

        {/* Interview Question */}
        <section className={sectionClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
              💬
            </div>
            <div>
              <h2 className={headingClass}>AI Interviewer Question</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your current interview question
              </p>
            </div>
          </div>

          <div className={outputClass}>{question}</div>
        </section>

        {/* Candidate Answer */}
        <section className={sectionClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl">
              ✍️
            </div>
            <div>
              <h2 className={headingClass}>Your Answer</h2>
              <p className="mt-1 text-sm text-slate-500">
                Type your answer below or connect your microphone feature.
              </p>
            </div>
          </div>

          <div className={outputClass}>{answerOutput}</div>

          <label
            htmlFor="manual-answer-input"
            className="mt-5 block text-sm font-semibold text-slate-700"
          >
            Write your answer
          </label>

          <textarea
            id="manual-answer-input"
            rows={5}
            placeholder="Type your answer here..."
            disabled={!sessionStarted}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            className={`${inputClass} resize-y leading-6`}
          />

          <div className="mt-4 flex justify-end">
            <button
              className={primaryButton}
              onClick={submitAnswer}
              disabled={!sessionStarted}
            >
              Submit Answer →
            </button>
          </div>
        </section>

        {/* Answer Evaluation */}
        <section className={sectionClass}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-xl">
              📊
            </div>
            <div>
              <h2 className={headingClass}>Latest Answer Evaluation</h2>
              <p className="mt-1 text-sm text-slate-500">
                Feedback on your answer
              </p>
            </div>
          </div>

          <div className={outputClass}>{feedback}</div>
        </section>

        {/* Interview Summary */}
        {showSummary && (
          <section className={sectionClass}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Session Complete
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  L1 Interview Performance Summary
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Interview completed for {candidateName || "Candidate"}.
                </p>
              </div>

              <button
                className={primaryButton}
                onClick={downloadReport}
              >
                📄 Print / Save as PDF
              </button>
            </div>

            <div className={outputClass}>
              Your interview has ended. Connect your backend to generate
              the actual performance summary.
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
                <h3 className="font-bold text-emerald-800">Key Strengths</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Your strengths will appear here after AI evaluation.
                </p>
              </div>

              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-5">
                <h3 className="font-bold text-rose-800">
                  Identified Skill Gaps
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Areas needing improvement will appear here.
                </p>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
                <h3 className="font-bold text-indigo-800">
                  Recommended Revision Topics
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Recommended revision topics will appear here.
                </p>
              </div>
            </div>
          </section>
        )}

        <footer className="pb-4 text-center text-xs text-slate-400">
          Personalized AI Interviewer · L1 Fundamental Mode
        </footer>
      </div>
    </main>
  );
}

export default L1Interview;