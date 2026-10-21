import { useCallback, useEffect, useRef, useState } from "react";
import { InterviewClient } from "./services/InterviewClient.js";
import { AudioPlayer } from "./services/audioPlayer.js";
import { SpeechRecognitionService } from "./services/speechRecognition.js";

const INITIAL_FORM = {
  candidateName: "",
  topic: "",
  difficulty: "Medium",
  maxQuestions: 5,
};

const DEFAULT_TOPICS = [
  "JavaScript",
  "React",
  "Node.js",
  "Express.js",
  "MongoDB",
  "Java",
  "Python",
  "SQL",
  "Data Structures and Algorithms",
  "OOP",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
  "Full Stack Development",
];

const INITIAL_METRICS = {
  questionNumber: 0,
  totalQuestions: 5,
  score: 0,
  progress: 0,
};

function getMessage(error) {
  if (typeof error === "string") return error;
  return error?.message || "Something went wrong. Please try again.";
}

function getTopicValue(item) {
  if (typeof item === "string") return item.trim();

  if (item && typeof item === "object") {
    return String(
      item.value ?? item.topic ?? item.name ?? item.label ?? ""
    ).trim();
  }

  return "";
}

function getTopicLabel(item) {
  if (typeof item === "string") return item.trim();

  if (item && typeof item === "object") {
    return String(
      item.label ?? item.name ?? item.topic ?? item.value ?? ""
    ).trim();
  }

  return "";
}

function extractText(data) {
  if (typeof data === "string") return data;

  return (
    data?.question ??
    data?.text ??
    data?.message ??
    data?.feedback ??
    ""
  );
}

function getSessionId(data) {
  return (
    data?.sessionId ??
    data?.session_id ??
    data?.session?.id ??
    data?.data?.sessionId ??
    data?.data?.session_id ??
    null
  );
}

export default function App() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [topics, setTopics] = useState(DEFAULT_TOPICS);
  const [topicsLoaded, setTopicsLoaded] = useState(false);

  const [sessionStatus, setSessionStatus] = useState("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerOutput, setAnswerOutput] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [summary, setSummary] = useState(null);

  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState(
    "Configure your interview and select Start Interview."
  );

  const clientRef = useRef(null);
  const audioRef = useRef(null);
  const speechRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const sessionIdRef = useRef(null);
  const answerRef = useRef("");
  const mountedRef = useRef(false);
  const submittingRef = useRef(false);

  if (!clientRef.current) {
    clientRef.current = new InterviewClient();
  }

  if (!audioRef.current) {
    audioRef.current = new AudioPlayer();
  }

  if (!speechRef.current) {
    speechRef.current = new SpeechRecognitionService();
  }

  const clearAnswerTimer = useCallback(() => {
    if (inactivityTimerRef.current !== null) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const updateAnswer = useCallback((value) => {
    answerRef.current = value;
    setAnswer(value);
  }, []);

  const updateMetrics = useCallback((data = {}) => {
    setMetrics((previous) => {
      const questionNumber =
        data.questionNumber ??
        data.currentQuestion ??
        previous.questionNumber;

      const totalQuestions =
        data.totalQuestions ??
        data.maxQuestions ??
        previous.totalQuestions;

      return {
        ...previous,
        questionNumber,
        totalQuestions,
        score: data.score ?? data.totalScore ?? previous.score,
        progress:
          data.progress ??
          (questionNumber && totalQuestions
            ? Math.round((questionNumber / totalQuestions) * 100)
            : previous.progress),
      };
    });
  }, []);

  const handleQuestion = useCallback(
    (data) => {
      if (!mountedRef.current) return;

      const nextQuestion = extractText(data);
      if (!nextQuestion) return;

      clearAnswerTimer();

      setQuestion(nextQuestion);
      setFeedback(null);
      setAnswerOutput("");
      updateAnswer("");

      updateMetrics({
        questionNumber: data?.questionNumber ?? data?.currentQuestion,
        totalQuestions: data?.totalQuestions ?? data?.maxQuestions,
        progress: data?.progress,
      });

      setSessionStatus("active");
      setIsStarting(false);
      setIsSubmitting(false);
      submittingRef.current = false;
      setStatusMessage("Your next interview question is ready.");

      const audioData = data?.audio ?? data?.audioBase64;

      if (audioData) {
        const player = audioRef.current;

        if (typeof player?.enqueue === "function") {
          player.enqueue(audioData);
        } else if (typeof player?.play === "function") {
          player.play(audioData);
        }
      }
    },
    [clearAnswerTimer, updateAnswer, updateMetrics]
  );

  const handleAudio = useCallback((data) => {
    if (!mountedRef.current || !data) return;

    const audioData =
      typeof data === "string"
        ? data
        : data.audio ?? data.audioBase64 ?? data.data;

    if (!audioData) return;

    const player = audioRef.current;

    if (typeof player?.enqueue === "function") {
      player.enqueue(audioData);
    } else if (typeof player?.play === "function") {
      player.play(audioData);
    }
  }, []);

  const handleFeedback = useCallback(
    (data) => {
      if (!mountedRef.current) return;

      setFeedback(data);
      setAnswerOutput(
        typeof data === "string"
          ? data
          : data?.feedback ??
            data?.message ??
            data?.evaluation ??
            ""
      );

      if (data && typeof data === "object") {
        updateMetrics(data);
      }

      setIsSubmitting(false);
      submittingRef.current = false;
      setStatusMessage("Your answer has been evaluated.");
    },
    [updateMetrics]
  );

  const handleSessionCompleted = useCallback((data) => {
    if (!mountedRef.current) return;

    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;

    setSummary(data?.summary ?? data?.report ?? data ?? null);
    setSessionStatus("completed");
    setIsStarting(false);
    setIsSubmitting(false);
    setIsFinishing(false);
    setIsListening(false);
    submittingRef.current = false;
    setStatusMessage("Interview completed.");

    try {
      speechRef.current?.stop?.();
    } catch {
      // Ignore speech cleanup errors.
    }
  }, []);

  const handleError = useCallback((err) => {
    if (!mountedRef.current) return;

    setError(getMessage(err));
    setIsStarting(false);
    setIsSubmitting(false);
    setIsFinishing(false);
    submittingRef.current = false;
    setStatusMessage("An error occurred.");
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const client = clientRef.current;

    client.onQuestion = handleQuestion;
    client.onAudio = handleAudio;
    client.onFeedback = handleFeedback;
    client.onSessionCompleted = handleSessionCompleted;
    client.onComplete = () => {
      if (!mountedRef.current) return;

      setIsStarting(false);
      setIsSubmitting(false);
      setIsFinishing(false);
      submittingRef.current = false;
    };
    client.onError = handleError;

    return () => {
      mountedRef.current = false;
      clearAnswerTimer();

      try {
        speechRef.current?.stop?.();
        audioRef.current?.stop?.();
      } catch {
        // Ignore cleanup errors.
      }

      client.onQuestion = null;
      client.onAudio = null;
      client.onFeedback = null;
      client.onSessionCompleted = null;
      client.onComplete = null;
      client.onError = null;
    };
  }, [
    clearAnswerTimer,
    handleQuestion,
    handleAudio,
    handleFeedback,
    handleSessionCompleted,
    handleError,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadTopics() {
      setIsLoadingTopics(true);

      try {
        const result = await clientRef.current.fetchTopics();

        if (cancelled) return;

        let list = Array.isArray(result)
          ? result
          : result?.topics ?? result?.data?.topics ?? [];

        list = list
          .map((item) => ({
            value: getTopicValue(item),
            label: getTopicLabel(item),
          }))
          .filter((item) => item.value);

        if (list.length > 0) {
          setTopics(list);

          setForm((previous) => ({
            ...previous,
            topic: list.some((item) => item.value === previous.topic)
              ? previous.topic
              : "",
          }));
        } else {
          setTopics(DEFAULT_TOPICS);
        }

        setTopicsLoaded(true);
      } catch (err) {
        if (cancelled) return;

        setTopics(DEFAULT_TOPICS);
        setTopicsLoaded(true);
        setError(
          `Could not load topics from the backend. Default topics are available. ${getMessage(err)}`
        );
      } finally {
        if (!cancelled) setIsLoadingTopics(false);
      }
    }

    loadTopics();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleFormChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: name === "maxQuestions" ? Number(value) : value,
    }));

    if (name === "topic" && value.trim()) {
      setError("");
    }
  }

  async function startInterview(event) {
    event?.preventDefault();

    if (isStarting || sessionStatus === "active") return;

    const candidateName = form.candidateName.trim();
    const selectedTopic = String(form.topic ?? "").trim();

    if (!candidateName) {
      setError("Please enter your name.");
      return;
    }

    if (!selectedTopic) {
      setError("Please select an interview topic.");
      return;
    }

    setError("");
    setSummary(null);
    setFeedback(null);
    setAnswerOutput("");
    setQuestion("");
    updateAnswer("");
    clearAnswerTimer();

    sessionIdRef.current = null;
    clientRef.current.sessionId = null;
    submittingRef.current = false;

    setMetrics({
      questionNumber: 0,
      totalQuestions: form.maxQuestions,
      score: 0,
      progress: 0,
    });

    setIsStarting(true);
    setSessionStatus("starting");
    setStatusMessage("Starting your interview...");

    try {
      const result = await clientRef.current.startInterview({
        topic: selectedTopic,
        difficulty: form.difficulty,
        maxQuestions: form.maxQuestions,
        candidateName,
      });

      const newSessionId =
        getSessionId(result) ?? clientRef.current.sessionId;

      if (newSessionId) {
        sessionIdRef.current = newSessionId;
      } else {
        setSessionStatus("idle");
        setIsStarting(false);
        setError(
          "The backend did not return a session ID. Check the /interview/start response and streaming events."
        );
        return;
      }

      setIsStarting(false);

      if (result?.question || result?.data?.question) {
        handleQuestion(result?.data ?? result);
      } else {
        setSessionStatus((previous) =>
          previous === "starting" ? "active" : previous
        );
        setStatusMessage("Interview started. Waiting for a question...");
      }
    } catch (err) {
      setSessionStatus("idle");
      setIsStarting(false);
      handleError(err);
    }
  }

  async function submitAnswer({ automatic = false } = {}) {
    clearAnswerTimer();

    if (submittingRef.current) return;

    if (sessionStatus !== "active") {
      setError("Please start an interview first.");
      return;
    }

    const sessionId =
      sessionIdRef.current ?? clientRef.current?.sessionId;

    if (!sessionId) {
      setError(
        "Interview session ID is missing. Please start a new interview."
      );
      return;
    }

    const finalAnswer = answerRef.current.trim();

    if (!finalAnswer) {
      if (!automatic) {
        setError("Please enter or speak your answer first.");
      }
      return;
    }

    sessionIdRef.current = sessionId;
    submittingRef.current = true;
    setError("");
    setIsSubmitting(true);
    setFeedback(null);
    setAnswerOutput("");
    setStatusMessage("Submitting your answer for evaluation...");

    try {
      const result = await clientRef.current.submitAnswer(
        sessionId,
        finalAnswer
      );

      if (result?.feedback || result?.evaluation) {
        handleFeedback(result.feedback ?? result.evaluation);
      }

      if (result?.question || result?.data?.question) {
        handleQuestion(result?.data ?? result);
      }

      if (result?.completed || result?.sessionCompleted) {
        handleSessionCompleted(result);
      }

      const hasResult =
        result?.feedback ||
        result?.evaluation ||
        result?.question ||
        result?.data?.question ||
        result?.completed ||
        result?.sessionCompleted;

      if (!hasResult) {
        setIsSubmitting(false);
        submittingRef.current = false;
        setStatusMessage(
          "The answer request returned without feedback. Check the backend response."
        );
      }
    } catch (err) {
      setIsSubmitting(false);
      submittingRef.current = false;
      handleError(err);
    }
  }

  async function finishInterview() {
    const sessionId =
      sessionIdRef.current ?? clientRef.current?.sessionId;

    if (
      isFinishing ||
      !sessionId ||
      sessionStatus !== "active"
    ) {
      return;
    }

    clearAnswerTimer();

    try {
      speechRef.current?.stop?.();
    } catch {
      // Ignore speech cleanup errors.
    }

    setIsListening(false);
    setIsFinishing(true);
    setError("");
    setStatusMessage("Finishing your interview...");

    try {
      const result = await clientRef.current.finishInterview(sessionId);

      if (result?.summary || result?.report || result?.completed) {
        handleSessionCompleted(result);
      } else {
        setIsFinishing(false);
        setStatusMessage("Finish request sent. Waiting for summary...");
      }
    } catch (err) {
      setIsFinishing(false);
      handleError(err);
    }
  }

  async function downloadReport() {
    const sessionId =
      sessionIdRef.current ?? clientRef.current?.sessionId;

    if (!sessionId) {
      setError("No interview session is available for the report.");
      return;
    }

    setError("");

    try {
      await clientRef.current.downloadReport(sessionId);
    } catch (err) {
      handleError(err);
    }
  }

  function toggleSpeechRecognition() {
    const speech = speechRef.current;

    if (isListening) {
      try {
        speech?.stop?.();
      } catch {
        // Ignore stop errors.
      }

      setIsListening(false);
      clearAnswerTimer();
      setStatusMessage("Microphone stopped.");
      return;
    }

    if (!speech || typeof speech.start !== "function") {
      setError("Speech recognition is not available. Please type your answer.");
      return;
    }

    setError("");

    try {
      speech.start(
  (recognizedText) => {
    if (!mountedRef.current) return;

    const text =
      typeof recognizedText === "string"
        ? recognizedText
        : recognizedText?.transcript ?? "";

    if (!text.trim()) return;

    updateAnswer(text.trim());
    clearAnswerTimer();

    inactivityTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        submitAnswer({ automatic: true });
      }
    }, 3000);
  },
  (message) => {
    if (!mountedRef.current) return;

    setIsListening(false);
    setError(message);
    setStatusMessage("Microphone stopped. Check the error message.");
  }
);

      setIsListening(true);
      setStatusMessage("Listening... speak your answer.");
    } catch (err) {
      setIsListening(false);
      setError(getMessage(err));
    }
  }

  const isActive = sessionStatus === "active";
  const isBusy = isStarting || isSubmitting || isFinishing;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xl font-extrabold tracking-tight text-indigo-700">
              AI Interviewer
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Practice interviews. Improve with every answer.
            </p>
          </div>

          <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
            {isActive
              ? "Interview in progress"
              : sessionStatus === "completed"
                ? "Completed"
                : "Practice mode"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Prepare for your next interview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Choose a topic and difficulty, answer questions, and review your interview feedback.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              className="font-bold"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-1">
            <h2 className="text-lg font-bold text-slate-900">Interview setup</h2>
            <p className="mt-1 text-sm text-slate-500">Customize your practice session.</p>

            <form onSubmit={startInterview} className="mt-6 space-y-5">
              <div>
                <label htmlFor="candidateName" className="mb-2 block text-sm font-semibold text-slate-700">
                  Candidate name
                </label>
                <input
                  id="candidateName"
                  name="candidateName"
                  value={form.candidateName}
                  onChange={handleFormChange}
                  placeholder="Enter your name"
                  disabled={isActive || isStarting}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                  required
                />
              </div>

              <div>
                <label htmlFor="topic" className="mb-2 block text-sm font-semibold text-slate-700">
                  Interview topic
                </label>
                <select
                  id="topic"
                  name="topic"
                  value={form.topic}
                  onChange={handleFormChange}
                  disabled={isActive || isStarting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                  required
                >
                  <option value="">
                    {isLoadingTopics ? "Loading topics..." : "Select a topic"}
                  </option>
                  {topics.map((item, index) => {
                    const value = getTopicValue(item);
                    const label = getTopicLabel(item);

                    if (!value) return null;

                    return (
                      <option key={`${value}-${index}`} value={value}>
                        {label || value}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  {isLoadingTopics
                    ? "Loading topics from the backend..."
                    : topicsLoaded
                      ? `${topics.length} topics available`
                      : "Select a topic to continue."}
                </p>
              </div>

              <div>
                <label htmlFor="difficulty" className="mb-2 block text-sm font-semibold text-slate-700">
                  Difficulty
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  value={form.difficulty}
                  onChange={handleFormChange}
                  disabled={isActive || isStarting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxQuestions" className="mb-2 block text-sm font-semibold text-slate-700">
                  Number of questions
                </label>
                <select
                  id="maxQuestions"
                  name="maxQuestions"
                  value={form.maxQuestions}
                  onChange={handleFormChange}
                  disabled={isActive || isStarting}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
                >
                  {[3, 5, 10, 15].map((count) => (
                    <option key={count} value={count}>
                      {count} questions
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isStarting || isActive}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isStarting ? "Starting..." : "Start Interview"}
              </button>

              <button
                type="button"
                onClick={finishInterview}
                disabled={!isActive || isFinishing}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFinishing ? "Finishing..." : "Finish Interview"}
              </button>
            </form>
          </section>

          <div className="space-y-6 lg:col-span-2">
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MetricCard label="Question" value={`${metrics.questionNumber}/${metrics.totalQuestions}`} />
              <MetricCard label="Score" value={metrics.score} />
              <MetricCard label="Progress" value={`${metrics.progress}%`} />
              <MetricCard label="Difficulty" value={form.difficulty} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">Interview question</h2>
              <div className="mt-5 min-h-36 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
                <p className="whitespace-pre-wrap text-base leading-7 text-slate-800">
                  {question || "Your first interview question will appear here after you start the interview."}
                </p>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, metrics.progress))}%` }}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Your answer</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Type your answer or use speech recognition.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  disabled={!isActive || isBusy}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    isListening
                      ? "bg-red-100 text-red-700 hover:bg-red-200"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {isListening ? "Stop listening" : "Use microphone"}
                </button>
              </div>

              <textarea
                value={answer}
                onChange={(event) => updateAnswer(event.target.value)}
                disabled={!isActive || isBusy}
                placeholder="Write your answer here..."
                rows={7}
                className="mt-5 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
              />

              {isListening && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  Listening for your answer...
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{answer.trim().length} characters</p>
                <button
                  type="button"
                  onClick={() => submitAnswer()}
                  disabled={!isActive || isBusy || !answer.trim()}
                  className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Evaluating..." : "Submit Answer"}
                </button>
              </div>
            </section>

            {(feedback || answerOutput) && (
              <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Evaluation and feedback</h2>
                <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {answerOutput || extractText(feedback) || "Your answer has been evaluated."}
                  </p>
                </div>
                {feedback && typeof feedback === "object" && (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <FeedbackValue label="Score" value={feedback.score ?? feedback.marks} />
                    <FeedbackValue label="Result" value={feedback.result ?? feedback.rating} />
                    <FeedbackValue label="Difficulty" value={feedback.difficulty} />
                  </div>
                )}
              </section>
            )}

            {sessionStatus === "completed" && (
              <section className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Interview summary</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your session is complete. Review the result below or download your report.
                </p>
                <SummaryContent summary={summary} />
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={downloadReport}
                    className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
                  >
                    Download PDF report
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Print page
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>

        <p aria-live="polite" className="mt-6 text-center text-xs text-slate-500">
          {statusMessage}
        </p>
      </main>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold text-slate-900">
        {value ?? "—"}
      </p>
    </div>
  );
}

function FeedbackValue({ label, value }) {
  if (value === undefined || value === null || value === "") return null;

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">
        {String(value)}
      </p>
    </div>
  );
}
function SummaryContent({ summary }) {
  if (!summary) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        Your final summary will appear here when the backend returns it.
      </p>
    );
  }

  if (typeof summary === "string") {
    return (
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {summary}
      </p>
    );
  }

  const entries = Object.entries(summary).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      typeof value !== "object"
  );

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {entries.length > 0 ? (
        entries.map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-slate-200 p-4"
          >
            <p className="text-xs font-medium capitalize text-slate-500">
              {key.replace(/([A-Z])/g, " $1").replace(/[_-]/g, " ")}
            </p>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm font-semibold text-slate-800">
              {String(value)}
            </p>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-600">
          Interview completed. No summary details were provided.
        </p>
      )}
    </div>
  );
}
