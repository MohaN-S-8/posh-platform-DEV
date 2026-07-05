import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";
import { LoadingOverlay } from "../../components/LoadingOverlay";

export function VideoListPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [publishingId, setPublishingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [overlay, setOverlay] = useState(null);
  const [lastUploadedVideo, setLastUploadedVideo] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [assetForms, setAssetForms] = useState({});
  const [questionForms, setQuestionForms] = useState({});
  const [form, setForm] = useState({
    title: "",
    description: "",
    category_id: "",
    duration_minutes: "",
    quality_label: "720p",
    transcript_text: "",
  });

  const fetchVideos = async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");
    try {
      const res = await apiClient.get("/videos/");
      setVideos(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to load videos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      fetchVideos({ showLoading: false });
      apiClient
        .get("/admin/languages")
        .then((res) => setLanguages(res.data || []))
        .catch(() => setLanguages([]));
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      setError("Please select a video file.");
      return;
    }
    setUploading(true);
    setOverlay({
      title: "Uploading video",
      message: "Keep this page open while the video is uploaded.",
    });
    setError("");
    setUploadProgress("Uploading...");

    const formData = new FormData();
    formData.append("file", fileInputRef.current.files[0]);
    formData.append("title", form.title);
    if (form.description) formData.append("description", form.description);
    if (form.category_id) formData.append("category_id", form.category_id);
    if (form.duration_minutes) {
      formData.append("duration_minutes", form.duration_minutes);
    }
    formData.append("quality_label", form.quality_label);
    if (form.transcript_text) {
      formData.append("transcript_text", form.transcript_text);
    }

    try {
      const res = await apiClient.post("/videos/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setLastUploadedVideo(res.data);
      setVideos((current) => {
        const withoutDuplicate = current.filter(
          (video) => video.video_id !== res.data.video_id,
        );
        return [res.data, ...withoutDuplicate];
      });
      setUploadProgress("Upload successful. Video is saved as Draft. Publish it now so employees can watch it.");
      setForm({
        title: "",
        description: "",
        category_id: "",
        duration_minutes: "",
        quality_label: "720p",
        transcript_text: "",
      });
      fileInputRef.current.value = "";
      await fetchVideos();
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed.");
      setUploadProgress("");
    } finally {
      setUploading(false);
      setOverlay(null);
    }
  };

  const updateAssetForm = (videoId, patch) => {
    setAssetForms((current) => ({
      ...current,
      [videoId]: {
        quality_label: "720p",
        language_id: "1",
        qualityFile: null,
        subtitleFile: null,
        audioFile: null,
        ...(current[videoId] || {}),
        ...patch,
      },
    }));
  };

  const defaultQuestionForm = {
    question_text: "",
    question_type: "MCQ",
    correct_option: "A",
    options: [
      { option_label: "A", option_text: "" },
      { option_label: "B", option_text: "" },
      { option_label: "C", option_text: "" },
      { option_label: "D", option_text: "" },
    ],
  };

  const updateQuestionForm = (videoId, patch) => {
    setQuestionForms((current) => ({
      ...current,
      [videoId]: {
        ...defaultQuestionForm,
        ...(current[videoId] || {}),
        ...patch,
      },
    }));
  };

  const uploadQualityVariant = async (videoId) => {
    const asset = assetForms[videoId];
    if (!asset?.qualityFile) {
      setError("Please select a quality video file.");
      return;
    }
    setOverlay({ title: "Uploading quality", message: "Uploading the selected video variant." });
    setError("");
    const formData = new FormData();
    formData.append("file", asset.qualityFile);
    formData.append("quality_label", asset.quality_label || "720p");
    try {
      await apiClient.post(`/videos/${videoId}/qualities`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateAssetForm(videoId, { qualityFile: null });
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to upload quality variant.");
    } finally {
      setOverlay(null);
    }
  };

  const uploadLanguageTrack = async (videoId) => {
    const asset = assetForms[videoId];
    if (!asset?.subtitleFile && !asset?.audioFile) {
      setError("Please select a subtitle or audio file.");
      return;
    }
    setOverlay({ title: "Uploading language track", message: "Uploading subtitle/audio files." });
    setError("");
    const formData = new FormData();
    formData.append("language_id", asset.language_id || "1");
    if (asset.subtitleFile) formData.append("subtitle_file", asset.subtitleFile);
    if (asset.audioFile) formData.append("audio_file", asset.audioFile);
    try {
      await apiClient.post(`/videos/${videoId}/language-tracks`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateAssetForm(videoId, { subtitleFile: null, audioFile: null });
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to upload language track.");
    } finally {
      setOverlay(null);
    }
  };

  const createQuestion = async (videoId) => {
    const form = questionForms[videoId] || defaultQuestionForm;
    setOverlay({ title: "Saving question", message: "Adding this assessment question." });
    setError("");
    try {
      await apiClient.post("/assessments/questions", {
        video_id: videoId,
        question_text: form.question_text,
        question_type: form.question_type,
        correct_option: form.correct_option,
        options: form.options,
      });
      updateQuestionForm(videoId, defaultQuestionForm);
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to create assessment question.");
    } finally {
      setOverlay(null);
    }
  };

  const publishVideo = async (videoId) => {
    setPublishingId(videoId);
    setOverlay({
      title: "Publishing video",
      message: "Making this training available to assigned employees.",
    });
    setError("");
    try {
      await apiClient.patch(`/videos/${videoId}/publish`);
      setLastUploadedVideo((current) =>
        current?.video_id === videoId ? { ...current, status: "Published" } : current,
      );
      setVideos((current) =>
        current.map((video) =>
          video.video_id === videoId ? { ...video, status: "Published" } : video,
        ),
      );
      await fetchVideos();
    } catch (err) {
      setError(err.response?.data?.detail || "Unable to publish video.");
    } finally {
      setPublishingId(null);
      setOverlay(null);
    }
  };

  const statusStyle = (status) => {
    if (status === "Published") {
      return { background: "#e8f5ee", color: "#1f7a4d" };
    }
    if (status === "Archived") {
      return { background: "#f2f3f5", color: "#667085" };
    }
    return { background: "#fff5df", color: "#9a6400" };
  };

  return (
    <div style={{ padding: "32px", background: "#f6f8fb", minHeight: "100vh" }}>
      <div style={{ marginBottom: "24px" }}>
        <button
          onClick={() => navigate("/admin")}
          style={{
            background: "none",
            border: "none",
            color: "#17324d",
            cursor: "pointer",
            marginBottom: "8px",
          }}
        >
          Back to Dashboard
        </button>
        <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
          Video Management
        </h1>
      </div>

      {error && (
        <div
          style={{
            background: "#fdf0f0",
            border: "1px solid #e74c3c",
            borderRadius: "8px",
            padding: "12px 16px",
            color: "#c0392b",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          marginBottom: "24px",
        }}
      >
        <h3 style={{ color: "#17324d", marginTop: 0 }}>Upload New Video</h3>
        <p style={{ color: "#666", fontSize: "13px", marginBottom: "20px" }}>
          Supported formats: MP4, AVI, MOV. Maximum size: 500MB. Videos are
          stored securely and remain private until published.
        </p>
        <form onSubmit={handleUpload}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              marginBottom: "16px",
            }}
          >
            <div>
              <label style={labelStyle}>Video Title *</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Duration (minutes)</label>
              <input
                type="number"
                value={form.duration_minutes}
                onChange={(e) =>
                  setForm({ ...form, duration_minutes: e.target.value })
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Quality *</label>
              <select
                value={form.quality_label}
                onChange={(e) => setForm({ ...form, quality_label: e.target.value })}
                style={inputStyle}
              >
                {["360p", "480p", "720p", "1080p"].map((quality) => (
                  <option key={quality} value={quality}>
                    {quality}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Transcript / Subtitle Text</label>
            <textarea
              value={form.transcript_text}
              onChange={(e) => setForm({ ...form, transcript_text: e.target.value })}
              rows={4}
              placeholder="Paste WEBVTT content or plain transcript text."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Video File *</label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".mp4,.avi,.mov"
              style={{ fontSize: "14px" }}
            />
          </div>
          {uploadProgress && (
            <div
              style={{
                padding: "14px",
                background: "#e8f5ee",
                borderRadius: "6px",
                color: "#1f7a4d",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: "8px" }}>{uploadProgress}</div>
              {lastUploadedVideo?.status === "Draft" && (
                <button
                  type="button"
                  onClick={() => publishVideo(lastUploadedVideo.video_id)}
                  disabled={publishingId === lastUploadedVideo.video_id}
                  style={{
                    padding: "8px 16px",
                    background:
                      publishingId === lastUploadedVideo.video_id ? "#93a4b7" : "#17324d",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor:
                      publishingId === lastUploadedVideo.video_id ? "not-allowed" : "pointer",
                  }}
                >
                  {publishingId === lastUploadedVideo.video_id
                    ? "Publishing..."
                    : "Publish Now"}
                </button>
              )}
              {lastUploadedVideo?.status === "Published" && (
                <div style={{ color: "#1f7a4d", fontWeight: 700 }}>
                  Published. Employees can watch it after assignment.
                </div>
              )}
            </div>
          )}
          <button
            type="submit"
            disabled={uploading}
            style={{
              padding: "10px 24px",
              background: uploading ? "#93a4b7" : "#17324d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            {uploading ? "Uploading..." : "Upload Video"}
          </button>
        </form>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <h3 style={{ color: "#17324d", margin: 0 }}>Uploaded Videos</h3>
          <button
            type="button"
            onClick={fetchVideos}
            style={{
              padding: "8px 14px",
              background: "#eef4f8",
              color: "#17324d",
              border: "1px solid #cdd9e2",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <p style={{ color: "#666" }}>Loading videos...</p>
        ) : videos.length === 0 ? (
          <p style={{ color: "#666" }}>No videos uploaded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {videos.map((video) => (
              <div
                key={video.video_id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                  padding: "16px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                }}
              >
                <div style={{ flex: "1 1 280px" }}>
                  <h4 style={{ color: "#17324d", margin: "0 0 6px" }}>
                    {video.title}
                  </h4>
                  <p style={{ color: "#667085", margin: 0, fontSize: "13px" }}>
                    ID: {video.video_id}
                    {video.duration_minutes
                      ? ` - ${video.duration_minutes} min`
                      : ""}
                  </p>
                  <div style={toolsGridStyle}>
                    <div style={toolBoxStyle}>
                      <strong style={toolTitleStyle}>Quality Variant</strong>
                      <select
                        value={assetForms[video.video_id]?.quality_label || "720p"}
                        onChange={(e) =>
                          updateAssetForm(video.video_id, { quality_label: e.target.value })
                        }
                        style={compactInputStyle}
                      >
                        {["360p", "480p", "720p", "1080p"].map((quality) => (
                          <option key={quality} value={quality}>
                            {quality}
                          </option>
                        ))}
                      </select>
                      <input
                        type="file"
                        accept=".mp4,.avi,.mov"
                        onChange={(e) =>
                          updateAssetForm(video.video_id, {
                            qualityFile: e.target.files?.[0] || null,
                          })
                        }
                        style={fileInputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => uploadQualityVariant(video.video_id)}
                        style={smallButtonStyle}
                      >
                        Upload Quality
                      </button>
                    </div>
                    <div style={toolBoxStyle}>
                      <strong style={toolTitleStyle}>Language Track</strong>
                      <select
                        value={assetForms[video.video_id]?.language_id || "1"}
                        onChange={(e) =>
                          updateAssetForm(video.video_id, { language_id: e.target.value })
                        }
                        style={compactInputStyle}
                      >
                        {(languages.length ? languages : [{ language_id: 1, language_name: "English" }]).map(
                          (language) => (
                            <option key={language.language_id} value={language.language_id}>
                              {language.language_name}
                            </option>
                          ),
                        )}
                      </select>
                      <input
                        type="file"
                        accept=".vtt,.txt"
                        onChange={(e) =>
                          updateAssetForm(video.video_id, {
                            subtitleFile: e.target.files?.[0] || null,
                          })
                        }
                        style={fileInputStyle}
                      />
                      <input
                        type="file"
                        accept=".mp3,.m4a,.aac,.wav"
                        onChange={(e) =>
                          updateAssetForm(video.video_id, {
                            audioFile: e.target.files?.[0] || null,
                          })
                        }
                        style={fileInputStyle}
                      />
                      <button
                        type="button"
                        onClick={() => uploadLanguageTrack(video.video_id)}
                        style={smallButtonStyle}
                      >
                        Upload Language
                      </button>
                    </div>
                    <div style={toolBoxStyle}>
                      <strong style={toolTitleStyle}>Assessment Question</strong>
                      <textarea
                        rows={2}
                        placeholder="Question text"
                        value={
                          (questionForms[video.video_id] || defaultQuestionForm).question_text
                        }
                        onChange={(e) =>
                          updateQuestionForm(video.video_id, { question_text: e.target.value })
                        }
                        style={{ ...compactInputStyle, resize: "vertical" }}
                      />
                      {(questionForms[video.video_id] || defaultQuestionForm).options.map(
                        (option, index) => (
                          <input
                            key={option.option_label}
                            placeholder={`${option.option_label} option`}
                            value={option.option_text}
                            onChange={(e) => {
                              const current =
                                questionForms[video.video_id] || defaultQuestionForm;
                              const nextOptions = current.options.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, option_text: e.target.value }
                                  : row,
                              );
                              updateQuestionForm(video.video_id, { options: nextOptions });
                            }}
                            style={compactInputStyle}
                          />
                        ),
                      )}
                      <select
                        value={(questionForms[video.video_id] || defaultQuestionForm).correct_option}
                        onChange={(e) =>
                          updateQuestionForm(video.video_id, { correct_option: e.target.value })
                        }
                        style={compactInputStyle}
                      >
                        {["A", "B", "C", "D"].map((label) => (
                          <option key={label} value={label}>
                            Correct: {label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => createQuestion(video.video_id)}
                        style={smallButtonStyle}
                      >
                        Add Question
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span
                    style={{
                      ...statusStyle(video.status),
                      padding: "5px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    {video.status}
                  </span>
                  {video.status === "Draft" && (
                    <button
                      type="button"
                      onClick={() => publishVideo(video.video_id)}
                      disabled={publishingId === video.video_id}
                      style={{
                        padding: "8px 16px",
                        background:
                          publishingId === video.video_id ? "#93a4b7" : "#17324d",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor:
                          publishingId === video.video_id ? "not-allowed" : "pointer",
                      }}
                    >
                      {publishingId === video.video_id ? "Publishing..." : "Publish"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <LoadingOverlay
        show={Boolean(overlay) || loading}
        title={overlay?.title || "Loading videos"}
        message={overlay?.message || "Fetching the latest video list."}
      />
    </div>
  );
}

const labelStyle = {
  display: "block",
  marginBottom: "4px",
  fontWeight: 500,
  fontSize: "14px",
};

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "6px",
  fontSize: "14px",
  boxSizing: "border-box",
};

const toolsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
  marginTop: "14px",
};

const toolBoxStyle = {
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "12px",
  display: "grid",
  gap: "8px",
};

const toolTitleStyle = {
  color: "#17324d",
  fontSize: "13px",
};

const compactInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #d8e1ea",
  borderRadius: "6px",
  fontSize: "13px",
  boxSizing: "border-box",
};

const fileInputStyle = {
  fontSize: "12px",
  color: "#64748b",
};

const smallButtonStyle = {
  padding: "8px 10px",
  background: "#17324d",
  color: "white",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: "12px",
};
