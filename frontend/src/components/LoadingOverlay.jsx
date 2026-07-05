import PropTypes from "prop-types";

export function LoadingOverlay({ show, title = "Working...", message = "Please wait." }) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        background: "rgba(15, 23, 42, 0.38)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: "min(360px, calc(100vw - 40px))",
          background: "white",
          borderRadius: "8px",
          padding: "24px",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.22)",
          textAlign: "center",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: "4px solid #d9e4ec",
            borderTopColor: "#17324d",
            margin: "0 auto 16px",
            animation: "posh-spin 0.9s linear infinite",
          }}
        />
        <h3 style={{ margin: "0 0 6px", color: "#17324d", fontSize: "18px" }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: "#667085", fontSize: "14px" }}>{message}</p>
      </div>
      <style>
        {`
          @keyframes posh-spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}

LoadingOverlay.propTypes = {
  show: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string,
};
