const API_BASE = "/interview";

export class InterviewClient {
  constructor() {
    this.sessionId = null;
    this.onQuestion = null;
    this.onAudio = null;
    this.onFeedback = null;
    this.onSessionCompleted = null;
    this.onComplete = null;
    this.onError = null;
  }

  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        message || `Request failed: ${response.status}`
      );
    }

    return response;
  }

  // Get interview topics from the backend
  async fetchTopics() {
    const response = await this.request(`${API_BASE}/topics`);
    const data = await response.json();

    return Array.isArray(data)
      ? data
      : data.topics ?? [];
  }

  // Start a new interview
  async startInterview({
    topic,
    difficulty,
    maxQuestions,
    candidateName,
  }) {
    try {
      this.sessionId = null;

      const response = await this.request(
        `${API_BASE}/start`,
        {
          method: "POST",
          body: JSON.stringify({
            topic,
            difficulty,
            maxQuestions,
            candidateName,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      // Handle streaming responses
      if (contentType.includes("text/event-stream")) {
        await this.readEventStream(response);

        if (!this.sessionId) {
          console.warn(
            "No session ID was received in the streaming events."
          );
        }

        return {
          sessionId: this.sessionId,
        };
      }

      // Handle normal JSON responses
      const data = await response.json();

      this.saveSessionId(data);

      const payload = data.data ?? data;

      if (payload.question) {
        this.onQuestion?.(payload);
      }

      if (payload.audio || payload.audioBase64) {
        this.onAudio?.(payload);
      }

      return {
        ...data,
        sessionId:
          this.sessionId ??
          data.sessionId ??
          data.session_id ??
          data.data?.sessionId ??
          data.data?.session_id,
      };
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  // Submit the candidate's answer
  async submitAnswer(sessionId, answer) {
    try {
      const activeSessionId =
        sessionId ?? this.sessionId;

      if (!activeSessionId) {
        throw new Error(
          "Cannot submit answer: session ID is missing."
        );
      }

      const response = await this.request(
        `${API_BASE}/answer`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId: activeSessionId,
            answer,
          }),
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        await this.readEventStream(response);

        return {
          sessionId: this.sessionId,
        };
      }

      const data = await response.json();
      this.saveSessionId(data);

      const payload = data.data ?? data;

      if (payload.feedback) {
        this.onFeedback?.(payload.feedback);
      } else if (
        payload.score !== undefined ||
        payload.evaluation !== undefined
      ) {
        this.onFeedback?.(
          payload.evaluation ?? payload
        );
      }

      if (payload.question) {
        this.onQuestion?.(payload);
      }

      if (payload.audio || payload.audioBase64) {
        this.onAudio?.(payload);
      }

      if (
        payload.completed ||
        payload.sessionCompleted
      ) {
        this.onSessionCompleted?.(payload);
      }

      return data;
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  // Finish the interview
  async finishInterview(sessionId) {
    try {
      const activeSessionId =
        sessionId ?? this.sessionId;

      if (!activeSessionId) {
        throw new Error(
          "Cannot finish interview: session ID is missing."
        );
      }

      const response = await this.request(
        `${API_BASE}/${encodeURIComponent(
          activeSessionId
        )}/finish`,
        {
          method: "POST",
        }
      );

      const contentType =
        response.headers.get("content-type") || "";

      let data;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (
        data &&
        typeof data === "object" &&
        (data.summary ||
          data.report ||
          data.completed ||
          data.sessionCompleted)
      ) {
        this.onSessionCompleted?.(data);
      }

      return data;
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  // Download the interview report
  async downloadReport(sessionId) {
    try {
      const activeSessionId =
        sessionId ?? this.sessionId;

      if (!activeSessionId) {
        throw new Error(
          "Cannot download report: session ID is missing."
        );
      }

      const response = await this.request(
        `${API_BASE}/report/${encodeURIComponent(
          activeSessionId
        )}`
      );

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "interview-report.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  // Extract and save session ID from backend data
  saveSessionId(data) {
    if (!data || typeof data !== "object") {
      return;
    }

    const sessionId =
      data.sessionId ??
      data.session_id ??
      data.session?.id ??
      data.data?.sessionId ??
      data.data?.session_id ??
      data.data?.session?.id;

    if (sessionId !== undefined && sessionId !== null) {
      this.sessionId = sessionId;
    }
  }

  // Read server-sent events
  async readEventStream(response) {
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error(
        "Streaming response is not supported."
      );
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, {
          stream: true,
        });

        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? "";

        for (const eventBlock of events) {
          this.processEventBlock(eventBlock);
        }
      }

      buffer += decoder.decode();

      if (buffer.trim()) {
        this.processEventBlock(buffer);
      }

      this.onComplete?.();
    } catch (error) {
      this.onError?.(error);
      throw error;
    }
  }

  // Process each streaming event
  processEventBlock(block) {
    let eventName = "message";
    const dataLines = [];

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }

    if (!dataLines.length) {
      return;
    }

    const rawData = dataLines.join("\n");
    let data = rawData;

    try {
      data = JSON.parse(rawData);
    } catch {
      // The event may contain plain text.
    }

    // Save session ID from any event that contains one
    this.saveSessionId(data);

    // Some backends put the event type inside the JSON
    const payload =
      data && typeof data === "object"
        ? data.data ?? data
        : data;

    const type =
      data && typeof data === "object"
        ? data.type ?? data.event ?? eventName
        : eventName;

    switch (type) {
      case "question":
        this.onQuestion?.(payload);
        break;

      case "audio":
        this.onAudio?.(payload);
        break;

      case "feedback":
        this.onFeedback?.(payload);
        break;

      case "sessionCompleted":
      case "session-completed":
      case "completed":
        this.onSessionCompleted?.(payload);
        break;

      case "error":
        this.onError?.(
          new Error(
            payload?.message ??
              String(rawData)
          )
        );
        break;

      default:
        // Handle messages that include question or feedback
        // data without a recognized event name.
        if (
          payload &&
          typeof payload === "object"
        ) {
          if (payload.question) {
            this.onQuestion?.(payload);
          }

          if (
            payload.audio ||
            payload.audioBase64
          ) {
            this.onAudio?.(payload);
          }

          if (payload.feedback) {
            this.onFeedback?.(payload.feedback);
          }

          if (
            payload.completed ||
            payload.sessionCompleted
          ) {
            this.onSessionCompleted?.(payload);
          }
        }
    }
  }
}