import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f6f1",
          fontFamily: "'DM Sans', sans-serif",
          padding: "20px"
        }}>
          <div style={{
            maxWidth: "500px",
            width: "100%",
            backgroundColor: "#fff",
            border: "1px solid #e0e7dc",
            borderRadius: "18px",
            padding: "32px",
            boxShadow: "0 12px 36px rgba(16, 37, 31, 0.08)",
            textAlign: "center"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              backgroundColor: "#fff0ed",
              color: "#a94436",
              display: "grid",
              placeItems: "center",
              fontSize: "26px",
              fontWeight: "bold"
            }}>
              !
            </div>
            <h2 style={{
              margin: "0 0 8px",
              color: "#17231f",
              fontFamily: "Manrope, sans-serif",
              fontSize: "22px"
            }}>
              Kuch gadbad ho gayi (Something went wrong)
            </h2>
            <p style={{
              color: "#617067",
              fontSize: "14px",
              lineHeight: "1.6",
              margin: "0 0 20px"
            }}>
              VoiceKirana encountered an unexpected issue while loading the interface.
            </p>
            {this.state.error && (
              <div style={{
                textAlign: "left",
                backgroundColor: "#f8f9f6",
                border: "1px solid #e6ebe2",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: "#a94436",
                marginBottom: "20px",
                overflowX: "auto"
              }}>
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: "#1e382a",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={e => e.target.style.backgroundColor = "#31553a"}
              onMouseOut={e => e.target.style.backgroundColor = "#1e382a"}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

