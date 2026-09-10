import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { sendChatMessage } from "../api/client";

const SUGGESTED_QUESTIONS = [
  "What is our biggest emission source?",
  "What costs us the most?",
  "Which scope has the highest emissions?",
  "Which recommendation has the shortest payback?",
  "What are our quick wins?",
  "What if we reduce diesel consumption by 20%?",
];

// The backend may key its answer differently depending on how the route
// ends up shaping the response - this just reads the first field that's
// actually there instead of assuming one exact contract.
function extractReply(data) {
  if (!data) return "I don't have enough data to answer this question.";
  if (typeof data === "string") return data;
  return (
    data.reply ??
    data.answer ??
    data.message ??
    data.text ??
    "I don't have enough data to answer this question."
  );
}

function ChatBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`chat-bubble-row ${isUser ? "from-user" : "from-bot"}`}>
      <div className="chat-avatar">
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="chat-bubble">{content}</div>
    </div>
  );
}

export default function Assistant({ companyId = 1 }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi, I'm the CarbonWise Assistant. Ask me anything about this company's emissions, costs, recommendations, or run a quick what-if scenario - I'll only answer from the numbers already in CarbonWise.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question) {
    const text = question.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const data = await sendChatMessage(companyId, text);
      setMessages((prev) => [...prev, { role: "assistant", content: extractReply(data) }]);
    } catch (err) {
      setError(err?.message || "Unable to reach the CarbonWise Assistant.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I don't have enough data to answer this question.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div>
      <div className="page-header">
        <span className="kicker">Ask</span>
        <h1>CarbonWise Assistant</h1>
        <p>
          A grounded chatbot that answers questions about this company's sustainability
          performance using only CarbonWise's own calculations - emissions, costs,
          recommendations, action plan, and what-if results. It never invents numbers.
        </p>
      </div>

      <div className="section-card chat-panel">
        <div className="chat-scroll" ref={scrollRef}>
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="chat-bubble-row from-bot">
              <div className="chat-avatar">
                <Bot size={14} />
              </div>
              <div className="chat-bubble chat-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        {error && <div className="error-banner" style={{ marginTop: 0 }}>{error}</div>}

        <div className="chat-suggestions">
          <span className="chat-suggestions-label">
            <Sparkles size={12} /> Try asking
          </span>
          <div className="chat-suggestion-chips">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                className="chat-suggestion-chip"
                onClick={() => ask(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about emissions, costs, recommendations, or a what-if scenario..."
            disabled={loading}
          />
          <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>
            <Send size={15} />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
