import FullscreenIcon from "@mui/icons-material/Fullscreen";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ReplayIcon from "@mui/icons-material/Replay";
import StopIcon from "@mui/icons-material/Stop";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import apiClient from "../../api/client";

const buttonStyle = {
  border: "1px solid #d8e1ea",
  background: "#ffffff",
  color: "#17324d",
  borderRadius: "6px",
  width: "42px",
  height: "42px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const selectStyle = {
  border: "1px solid #d8e1ea",
  borderRadius: "6px",
  padding: "10px 12px",
  color: "#17324d",
  background: "#fff",
  minWidth: "132px",
};

function formatTime(value) {
  if (!value || Number.isNaN(value)) return "00:00";
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function VideoPlayerPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const playerRef = useRef(null);
  const progressTimer = useRef(0);
  const maxWatched = useRef(0);
  const blockedSeek = useRef(false);
  const internalSeek = useRef(false);
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState("Loading video...");
  const [completion, setCompletion] = useState(0);
  const [unlocked, setUnlocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [resumePosition, setResumePosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  useEffect(() => {
    apiClient
      .get(`/videos/${videoId}/stream-url`)
      .then((res) => {
        setStream(res.data);
        setSelectedQuality(res.data.qualities?.[0]?.label || "source");
        setSelectedLanguage(res.data.subtitles?.[0]?.language_name || "English");
        setCompletion(res.data.completion_percent || 0);
        setUnlocked((res.data.completion_percent || 0) >= 95);
        maxWatched.current = Math.max(
          res.data.resume_position || 0,
          res.data.furthest_position || 0,
        );
        setResumePosition(res.data.resume_position || 0);
        setCurrentTime(0);
        setStatus(
          res.data.resume_position
            ? `Ready. Resume available at ${formatTime(res.data.resume_position)}.`
            : "Ready",
        );
      })
      .catch((err) => {
        setStatus(err.response?.data?.detail || "Unable to load this video.");
      });
  }, [videoId]);

  const saveProgress = async (position, videoDuration) => {
    if (!videoDuration || Number.isNaN(videoDuration) || blockedSeek.current) return;
    try {
      const res = await apiClient.post(`/videos/${videoId}/progress`, {
        current_position: Math.floor(position),
        total_duration: Math.floor(videoDuration),
      });
      setCompletion(res.data.completion_percent || 0);
      setUnlocked(Boolean(res.data.assessment_unlocked));
      maxWatched.current = Math.max(
        maxWatched.current,
        res.data.furthest_position || 0,
      );
      setStatus(res.data.assessment_unlocked ? "Assessment unlocked" : "Progress saved");
    } catch (err) {
      setStatus(err.response?.data?.detail || "Progress could not be saved.");
    }
  };

  const onLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
  };

  const onTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    if (!blockedSeek.current && !video.seeking) {
      maxWatched.current = Math.max(maxWatched.current, video.currentTime);
    }
    const audio = audioRef.current;
    if (audio && Math.abs(audio.currentTime - video.currentTime) > 0.5) {
      audio.currentTime = video.currentTime;
    }
    const now = Date.now();
    if (!blockedSeek.current && now - progressTimer.current > 2000) {
      progressTimer.current = now;
      saveProgress(video.currentTime, video.duration);
    }
  };

  const guardSeek = (targetTime) => {
    const video = videoRef.current;
    if (!video || blockedSeek.current) return;
    if (internalSeek.current) {
      setCurrentTime(video.currentTime);
      return;
    }
    const allowedTarget = maxWatched.current + 2;
    if (targetTime > allowedTarget) {
      const shouldResume = !video.paused;
      blockedSeek.current = true;
      video.pause();
      setIsPlaying(false);
      setIsBuffering(false);
      setCurrentTime(maxWatched.current);
      setStatus("Please complete the training video before moving ahead.");
      window.setTimeout(() => {
        internalSeek.current = true;
        video.currentTime = maxWatched.current;
        window.setTimeout(() => {
          internalSeek.current = false;
          blockedSeek.current = false;
          setIsBuffering(false);
          if (shouldResume) {
            playVideo();
          }
        }, 150);
      }, 0);
      return;
    }
    internalSeek.current = true;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
    window.setTimeout(() => {
      internalSeek.current = false;
      setIsBuffering(false);
    }, 150);
  };

  const jumpToAllowedPosition = (targetTime) => {
    const video = videoRef.current;
    if (!video) return;
    const safeTarget = Math.min(Math.max(0, targetTime), maxWatched.current);
    internalSeek.current = true;
    video.currentTime = safeTarget;
    setCurrentTime(safeTarget);
    setIsBuffering(false);
    window.setTimeout(() => {
      internalSeek.current = false;
      setIsBuffering(false);
    }, 150);
  };

  const playVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      if (audioRef.current) {
        audioRef.current.currentTime = video.currentTime;
        await audioRef.current.play();
        video.muted = true;
      }
      setIsPlaying(true);
      setStatus("Playing");
    } catch {
      setStatus("Unable to play video. Please check your browser permissions.");
    }
  };

  const pauseVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    audioRef.current?.pause();
    setIsPlaying(false);
    setIsBuffering(false);
    saveProgress(video.currentTime, video.duration);
    setStatus("Paused");
  };

  const stopVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    audioRef.current?.pause();
    internalSeek.current = true;
    video.currentTime = 0;
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsPlaying(false);
    setIsBuffering(false);
    setStatus("Stopped");
    window.setTimeout(() => {
      internalSeek.current = false;
      setIsBuffering(false);
    }, 150);
  };

  const replayFromResume = async () => {
    jumpToAllowedPosition(resumePosition || maxWatched.current || 0);
    window.setTimeout(() => {
      playVideo();
    }, 180);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    if (audioRef.current) {
      audioRef.current.muted = video.muted;
    }
    setIsMuted(video.muted);
  };

  const changeVolume = (event) => {
    const nextVolume = Number(event.target.value);
    const video = videoRef.current;
    setVolume(nextVolume);
    if (video) {
      video.volume = nextVolume;
      video.muted = nextVolume === 0;
      setIsMuted(video.muted);
    }
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
      audioRef.current.muted = nextVolume === 0;
    }
  };

  const changeLanguage = (event) => {
    const languageName = event.target.value;
    setSelectedLanguage(languageName);
    const selected = stream?.subtitles?.find(
      (subtitle) => subtitle.language_name === languageName,
    );
    const video = videoRef.current;
    const audio = audioRef.current;
    if (video && audio && selected?.audio_url) {
      audio.currentTime = video.currentTime;
      audio.volume = volume;
      audio.muted = isMuted;
      video.muted = true;
      if (!video.paused) {
        audio.play().catch(() => setStatus("Unable to play selected audio language."));
      }
    } else if (video && !selected?.audio_url) {
      video.muted = isMuted;
    }
    const tracks = video?.textTracks || [];
    for (let index = 0; index < tracks.length; index += 1) {
      tracks[index].mode = tracks[index].label === languageName ? "showing" : "disabled";
    }
  };

  const enterFullscreen = async () => {
    try {
      await playerRef.current?.requestFullscreen?.();
    } catch {
      setStatus("Full-screen mode is not available in this browser.");
    }
  };

  const changeQuality = (event) => {
    const nextQuality = event.target.value;
    const selected = stream?.qualities?.find((quality) => quality.label === nextQuality);
    const video = videoRef.current;
    if (!selected || !video) return;
    const resumeAt = video.currentTime;
    const wasPlaying = !video.paused;
    setSelectedQuality(nextQuality);
    setStream((current) => ({ ...current, stream_url: selected.stream_url }));
    window.setTimeout(() => {
      const nextVideo = videoRef.current;
      if (!nextVideo) return;
      internalSeek.current = true;
      nextVideo.currentTime = Math.min(resumeAt, maxWatched.current);
      window.setTimeout(() => {
        internalSeek.current = false;
        if (wasPlaying) playVideo();
      }, 150);
    }, 100);
  };

  const onEnded = () => {
    const video = videoRef.current;
    setIsPlaying(false);
    setIsBuffering(false);
    if (video) {
      saveProgress(video.duration, video.duration);
    }
  };

  const onVideoError = () => {
    setIsPlaying(false);
    setIsBuffering(false);
    setStatus("Unable to load video. Please check your network.");
  };

  const canOpenAssessment = unlocked || completion >= 95;
  const selectedLanguageTrack = stream?.subtitles?.find(
    (subtitle) => subtitle.language_name === selectedLanguage,
  );

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
          padding: 0,
        }}
      >
        Back to Courses
      </button>

      <div style={{ display: "grid", gap: "18px" }}>
        <div>
          <h1 style={{ color: "#17324d", margin: 0, fontSize: "30px" }}>
            Training Video
          </h1>
          <p style={{ color: "#666", marginTop: "6px" }}>
            {isBuffering ? "Loading..." : status}
          </p>
        </div>

        <div
          ref={playerRef}
          style={{
            background: "#111827",
            borderRadius: "8px",
            overflow: "hidden",
            minHeight: "clamp(220px, 52vh, 620px)",
            position: "relative",
          }}
        >
          {stream?.stream_url ? (
            <>
              <video
                key={stream.stream_url}
                ref={videoRef}
                preload="metadata"
                controls={false}
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onSeeking={(event) => {
                  if (!internalSeek.current) {
                    guardSeek(event.currentTarget.currentTime);
                  }
                }}
                onSeeked={() => setIsBuffering(false)}
                onEnded={onEnded}
                onError={onVideoError}
                onLoadedData={() => setIsBuffering(false)}
                onCanPlay={() => setIsBuffering(false)}
                onWaiting={() => {
                  if (
                    !videoRef.current?.paused &&
                    !blockedSeek.current &&
                    !internalSeek.current
                  ) {
                    setIsBuffering(true);
                  }
                }}
                onPlaying={() => {
                  setIsBuffering(false);
                  setIsPlaying(true);
                }}
                onPause={() => {
                  setIsPlaying(false);
                  setIsBuffering(false);
                  audioRef.current?.pause();
                }}
                onClick={isPlaying ? pauseVideo : playVideo}
                style={{
                  width: "100%",
                  height: "clamp(220px, 52vh, 620px)",
                  maxHeight: "100vh",
                  display: "block",
                  objectFit: "contain",
                  background: "#111827",
                }}
              >
                <source src={stream.stream_url} type="video/mp4" />
                {(stream.subtitles?.length
                  ? stream.subtitles
                  : [{ language_name: "English", subtitle_url: "data:text/vtt,WEBVTT%0A%0A" }]
                )
                  .filter((subtitle) => subtitle.subtitle_url)
                  .map((subtitle, index) => (
                    <track
                      key={`${subtitle.language_name}-${index}`}
                      kind="subtitles"
                      src={subtitle.subtitle_url}
                      srcLang={subtitle.language_name?.toLowerCase().slice(0, 2) || "en"}
                      label={subtitle.language_name}
                      default={subtitle.language_name === selectedLanguage || index === 0}
                    />
                  ))}
              </video>
              {selectedLanguageTrack?.audio_url && (
                <audio ref={audioRef} src={selectedLanguageTrack.audio_url} preload="metadata" />
              )}
              {isBuffering && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "#ffffff",
                    background: "rgba(17,24,39,0.52)",
                    fontWeight: 700,
                    pointerEvents: "none",
                  }}
                >
                  Loading...
                </div>
              )}
              {!isPlaying && !isBuffering && (
                <button
                  type="button"
                  onClick={playVideo}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "68px",
                    height: "68px",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(255,255,255,0.92)",
                    color: "#17324d",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
                  }}
                  title="Play"
                >
                  <PlayArrowIcon fontSize="large" />
                </button>
              )}
            </>
          ) : (
            <div style={{ color: "white", padding: "32px" }}>{status}</div>
          )}
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: "8px",
            padding: "18px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            display: "grid",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#17324d", fontWeight: 700 }}>
              {formatTime(currentTime)}
            </span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={Math.min(currentTime, duration || currentTime)}
              onChange={(event) => guardSeek(Number(event.target.value))}
              style={{ width: "100%" }}
              aria-label="Video progress"
            />
            <span style={{ color: "#17324d", fontWeight: 700 }}>
              {formatTime(duration)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={isPlaying ? pauseVideo : playVideo}
                style={buttonStyle}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </button>
              <button type="button" onClick={stopVideo} style={buttonStyle} title="Stop">
                <StopIcon />
              </button>
              <button
                type="button"
                onClick={replayFromResume}
                style={buttonStyle}
                title={`Resume from ${formatTime(resumePosition)}`}
              >
                <ReplayIcon />
              </button>
              <button
                type="button"
                onClick={toggleMute}
                style={buttonStyle}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={changeVolume}
                aria-label="Volume"
                style={{ width: "112px" }}
              />
              <button
                type="button"
                onClick={enterFullscreen}
                style={buttonStyle}
                title="Full screen"
              >
                <FullscreenIcon />
              </button>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <select
                style={selectStyle}
                value={selectedLanguage}
                onChange={changeLanguage}
                aria-label="Subtitle language"
              >
                {(stream?.subtitles?.length ? stream.subtitles : [{ language_name: "English" }]).map(
                  (subtitle) => (
                    <option key={subtitle.language_name} value={subtitle.language_name}>
                      {subtitle.language_name}
                    </option>
                  ),
                )}
              </select>
              <select
                style={selectStyle}
                value={selectedQuality}
                onChange={changeQuality}
                aria-label="Video quality"
              >
                {(stream?.qualities?.length ? stream.qualities : [{ label: "source" }]).map(
                  (quality) => (
                    <option key={quality.label} value={quality.label}>
                      {quality.label}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong style={{ color: "#17324d" }}>Completion</strong>
              <span style={{ color: "#17324d" }}>{Math.round(completion)}%</span>
            </div>
            <div
              style={{
                height: "8px",
                background: "#e8edf2",
                borderRadius: "999px",
                marginTop: "10px",
              }}
            >
              <div
                style={{
                  width: `${Math.min(completion, 100)}%`,
                  height: "100%",
                  background: "#2d6a8e",
                  borderRadius: "999px",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              disabled={!canOpenAssessment}
              onClick={() => navigate(`/employee/assessment/${videoId}`)}
              style={{
                padding: "10px 18px",
                background: canOpenAssessment ? "#17324d" : "#b8c2cc",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: canOpenAssessment ? "pointer" : "not-allowed",
              }}
            >
              Go to Assessment
            </button>
            {!canOpenAssessment && (
              <span style={{ color: "#6b7280" }}>
                Please complete the training video before taking the assessment.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
