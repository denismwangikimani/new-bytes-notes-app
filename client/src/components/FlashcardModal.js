import React, { useState, useEffect } from "react";
import "./AIAssistant.css";

const FlashcardModal = ({ isOpen, onClose, noteContent }) => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Import here to avoid circular dependency
  const { generateFlashcards } = require("../services/geminiService");

  useEffect(() => {
    // Reset state when modal opens
    if (isOpen) {
      setSelectedAnswer(null);
      setShowExplanation(false);
      loadFlashcards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, noteContent]);

  const loadFlashcards = async () => {
    if (!noteContent) {
      setError("No note content available to generate flashcards.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateFlashcards(noteContent);

      if (result.error) {
        setError(result.error);
      } else if (Array.isArray(result) && result.length > 0) {
        setFlashcards(result);
        setCurrentIndex(0);
      } else {
        setError("Failed to generate flashcards. Please try again.");
      }
    } catch (err) {
      setError("Error generating flashcards: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (optionId) => {
    setSelectedAnswer(optionId);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const isAnswerCorrect = (optionId) => {
    return flashcards[currentIndex]?.correctAnswer === optionId;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="ai-modal-backdrop" onClick={onClose} />
      <div className="ai-modal flashcard-modal">
        <div className="ai-modal-header">
          <div className="ai-modal-title">Revision Flashcards</div>
          <button className="ai-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {loading ? (
          <div className="ai-loading">
            <div className="ai-loading-dot"></div>
            <div className="ai-loading-dot"></div>
            <div className="ai-loading-dot"></div>
            <div style={{ marginLeft: 10 }}>Generating flashcards...</div>
          </div>
        ) : error ? (
          <div className="flashcard-error">{error}</div>
        ) : flashcards.length > 0 ? (
          <div className="flashcard-container">
            <div className="flashcard-progress">
              Question {currentIndex + 1} of {flashcards.length}
            </div>

            <div className="flashcard-question">
              {flashcards[currentIndex].question}
            </div>

            <div className="flashcard-options">
              {flashcards[currentIndex].options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id)}
                  className={`flashcard-option ${
                    selectedAnswer === option.id
                      ? isAnswerCorrect(option.id)
                        ? "correct"
                        : "incorrect"
                      : ""
                  }`}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-label">{option.id}:</span>{" "}
                  {option.text}
                </button>
              ))}
            </div>

            {showExplanation && (
              <div className="flashcard-explanation">
                <div className="explanation-header">
                  {isAnswerCorrect(selectedAnswer) ? (
                    <span className="correct-text">Correct!</span>
                  ) : (
                    <span className="incorrect-text">
                      Incorrect. The correct answer is:{" "}
                      {flashcards[currentIndex].correctAnswer}
                    </span>
                  )}
                </div>
                <div className="explanation-content">
                  {flashcards[currentIndex].explanation}
                </div>
              </div>
            )}

            <div className="flashcard-navigation">
              <button
                onClick={prevQuestion}
                disabled={currentIndex === 0}
                className="nav-button"
              >
                Previous
              </button>

              {showExplanation && currentIndex < flashcards.length - 1 && (
                <button onClick={nextQuestion} className="nav-button primary">
                  Next Question
                </button>
              )}

              {currentIndex === flashcards.length - 1 && showExplanation && (
                <button onClick={onClose} className="nav-button primary">
                  Finish
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flashcard-empty">
            <p>
              No flashcards available. Click generate to create flashcards from
              your note.
            </p>
            <button onClick={loadFlashcards} className="ai-modal-submit">
              Generate Flashcards
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default FlashcardModal;
