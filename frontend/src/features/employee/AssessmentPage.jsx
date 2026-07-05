import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../../api/client";

export function AssessmentPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    const loadAssessment = async () => {
      setLoading(true);
      setError("");
      try {
        const availableRes = await apiClient.get(`/assessments/${videoId}/availability`);
        setAvailability(availableRes.data);
        if (!availableRes.data.available) {
          setError(
            availableRes.data.message ||
              "Please complete the training video before taking the assessment.",
          );
          return;
        }
        const questionRes = await apiClient.get(`/assessments/${videoId}/questions`);
        setQuestions(questionRes.data);
      } catch (err) {
        setError(err.response?.data?.detail || "Unable to load assessment.");
      } finally {
        setLoading(false);
      }
    };
    loadAssessment();
  }, [videoId]);

  const submit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        video_id: Number(videoId),
        answers: questions.map((question) => ({
          question_id: question.question_id,
          selected_option: answers[question.question_id],
        })),
      };
      const res = await apiClient.post("/assessments/submit", payload);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Assessment submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.question_id]);

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <button
        onClick={() => navigate("/employee/courses")}
        style={{
          background: "none",
          border: "none",
          color: "#17324d",
          cursor: "pointer",
          marginBottom: "16px",
        }}
      >
        Back to Courses
      </button>

      <h1 style={{ color: "#17324d", margin: "0 0 24px", fontSize: "30px" }}>
        Assessment
      </h1>

      {loading ? (
        <p style={{ color: "#666" }}>Loading assessment...</p>
      ) : error ? (
        <div style={{ background: "white", borderRadius: "8px", padding: "28px" }}>
          <h3 style={{ color: "#c0392b", marginTop: 0 }}>Assessment Locked</h3>
          <p style={{ color: "#666" }}>{error}</p>
          {availability?.question_count === 0 && (
            <p style={{ color: "#666" }}>No questions have been configured for this video yet.</p>
          )}
          <button
            type="button"
            onClick={() => navigate(`/employee/video/${videoId}`)}
            style={{
              marginTop: "12px",
              padding: "10px 18px",
              background: "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Back to Video
          </button>
        </div>
      ) : questions.length === 0 ? (
        <div style={{ background: "white", borderRadius: "8px", padding: "28px" }}>
          <h3 style={{ color: "#17324d", marginTop: 0 }}>No questions available</h3>
          <p style={{ color: "#666" }}>Please contact your HR team.</p>
        </div>
      ) : result ? (
        <div style={{ background: "white", borderRadius: "8px", padding: "28px" }}>
          <h3 style={{ color: result.result === "Pass" ? "#1f7a4d" : "#c0392b", marginTop: 0 }}>
            {result.result}
          </h3>
          <p style={{ color: "#17324d", fontSize: "20px", fontWeight: 700 }}>
            Score: {result.score}%
          </p>
          <p style={{ color: "#666" }}>{result.message}</p>
          <button
            onClick={() =>
              navigate(result.result === "Pass" ? "/employee/certificates" : "/employee/courses")
            }
            style={{
              marginTop: "18px",
              padding: "10px 18px",
              background: "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {result.result === "Pass" ? "View Certificates" : "Back to Courses"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {questions.map((question, index) => (
            <div
              key={question.question_id}
              style={{
                background: "white",
                borderRadius: "8px",
                padding: "22px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
            >
              <h3 style={{ color: "#17324d", marginTop: 0, fontSize: "18px" }}>
                {index + 1}. {question.question_text}
              </h3>
              <div style={{ display: "grid", gap: "10px" }}>
                {question.options.map((option) => (
                  <label
                    key={option.option_id}
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                      padding: "10px 12px",
                      border: "1px solid #d7dee7",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name={`question-${question.question_id}`}
                      checked={answers[question.question_id] === option.option_label}
                      onChange={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.question_id]: option.option_label,
                        }))
                      }
                    />
                    <span style={{ color: "#333" }}>
                      <strong>{option.option_label}.</strong> {option.option_text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            disabled={!allAnswered || submitting}
            onClick={submit}
            style={{
              justifySelf: "start",
              padding: "12px 22px",
              background: !allAnswered || submitting ? "#b8c2cc" : "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: !allAnswered || submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Submitting..." : "Submit Assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
