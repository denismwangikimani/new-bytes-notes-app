import React, { useState } from "react";
import { MessageSquare, BookOpen, FileText, Volume2 } from "lucide-react";
import {
  summarizeDocument,
  explainDocument,
  askDocumentQuestion,
  generateAudioOverview,
} from "../services/geminiService";
import "./FileSidebarAI.css";

const FileSidebarAI = ({ fileUrl, fileName, fileType }) => {
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [question, setQuestion] = useState("");
  const [audioUrl, setAudioUrl] = useState(null);

  const isPdf =
    fileType === "application/pdf" || fileName?.toLowerCase().endsWith(".pdf");

  const handleAsk = async () => {
    if (!question.trim()) return;

    setLoading(true);
    setResult("");
    try {
      const response = await askDocumentQuestion(fileUrl, question);
      setResult(response);
    } catch (error) {
      setResult("Error: Could not process your question. Please try again.");
      console.error("Error asking question:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    setLoading(true);
    setResult("");
    try {
      const response = await explainDocument(fileUrl);
      setResult(response);
    } catch (error) {
      setResult("Error: Could not explain this document. Please try again.");
      console.error("Error explaining document:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setLoading(true);
    setResult("");
    try {
      const response = await summarizeDocument(fileUrl);
      setResult(response);
    } catch (error) {
      setResult("Error: Could not summarize this document. Please try again.");
      console.error("Error summarizing document:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAudioOverview = async () => {
    setLoading(true);
    setResult("Generating detailed audio overview...");
    setAudioUrl(null);
    try {
      const { text, audioUrl, usedBrowserSpeech } = await generateAudioOverview(
        fileUrl
      );
      setResult(
        text +
          (usedBrowserSpeech
            ? "\n\n(Note: Using browser's built-in speech synthesis because server-based audio generation was unavailable.)"
            : "")
      );
      setAudioUrl(audioUrl);
    } catch (error) {
      setResult("Error: Could not generate audio overview. Please try again.");
      console.error("Error generating audio overview:", error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show AI features if not a PDF
  if (!isPdf) return null;

  return (
    <div className="file-sidebar-ai">
      <div className="ai-tabs">
        <button
          className={`ai-tab ${activeTab === "ask" ? "active" : ""}`}
          onClick={() => setActiveTab(activeTab === "ask" ? null : "ask")}
        >
          <MessageSquare size={16} />
          <span>Ask</span>
        </button>
        <button
          className={`ai-tab ${activeTab === "explain" ? "active" : ""}`}
          onClick={() =>
            setActiveTab(activeTab === "explain" ? null : "explain")
          }
        >
          <BookOpen size={16} />
          <span>Explain</span>
        </button>
        <button
          className={`ai-tab ${activeTab === "summarize" ? "active" : ""}`}
          onClick={() =>
            setActiveTab(activeTab === "summarize" ? null : "summarize")
          }
        >
          <FileText size={16} />
          <span>Summarize</span>
        </button>
        <button
          className={`ai-tab ${activeTab === "audio" ? "active" : ""}`}
          onClick={() => setActiveTab(activeTab === "audio" ? null : "audio")}
        >
          <Volume2 size={16} />
          <span>Audio</span>
        </button>
      </div>

      <div className="ai-content">
        {activeTab === "ask" && (
          <div className="ask-container">
            <div className="question-input">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask a question about this document..."
                disabled={loading}
              />
              <button
                onClick={handleAsk}
                disabled={loading || !question.trim()}
              >
                {loading ? "Asking..." : "Ask"}
              </button>
            </div>
            {result && <div className="ai-result">{result}</div>}
          </div>
        )}

        {activeTab === "explain" && (
          <div className="explain-container">
            <button
              className="action-button"
              onClick={handleExplain}
              disabled={loading}
            >
              {loading ? "Explaining..." : "Explain this document"}
            </button>
            {result && <div className="ai-result">{result}</div>}
          </div>
        )}

        {activeTab === "summarize" && (
          <div className="summarize-container">
            <button
              className="action-button"
              onClick={handleSummarize}
              disabled={loading}
            >
              {loading ? "Summarizing..." : "Summarize this document"}
            </button>
            {result && <div className="ai-result">{result}</div>}
          </div>
        )}

        {activeTab === "audio" && (
          <div className="audio-container">
            <button
              className="action-button"
              onClick={handleAudioOverview}
              disabled={loading}
            >
              {loading ? "Generating..." : "Generate Audio Overview"}
            </button>
            {result && (
              <div className="ai-result">
                {result}
                {audioUrl && (
                  <div className="audio-player">
                    <audio controls src={audioUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FileSidebarAI;
