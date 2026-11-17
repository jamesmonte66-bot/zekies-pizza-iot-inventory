
import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";

import { auth } from "../firebase";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (loading) return;

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

      // App.jsx handles profile, account status, role validation,
      // dashboard redirection, and account monitoring.
    } catch (firebaseError) {
      console.error("Login error:", firebaseError);

      const invalidCredentials = [
        "auth/invalid-credential",
        "auth/user-not-found",
        "auth/wrong-password",
        "auth/invalid-email",
      ];

      if (invalidCredentials.includes(firebaseError.code)) {
        setError("Incorrect email or password.");
      } else if (firebaseError.code === "auth/too-many-requests") {
        setError("Too many login attempts. Please try again later.");
      } else if (firebaseError.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      {/* Decorative background elements */}
      <div className="login-glow login-glow-one"></div>
      <div className="login-glow login-glow-two"></div>

      {/* Left side: centered logo */}
      <section className="login-side">
        <div className="logo-frame">
          <div className="logo-ring"></div>
          <img
            src="/zekies-logo.jpg"
            alt="Zekie's Pizza Logo"
            className="login-main-logo"
          />
        </div>
      </section>

      {/* Right side: login form */}
      <section className="login-form-section">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="card-top-line"></div>

          <div className="login-heading">
            <div className="heading-icon">
              <Lock size={21} />
            </div>

            <h2>Welcome back</h2>
            <p className="login-subtitle">
              Sign in to access your inventory dashboard.
            </p>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <label htmlFor="login-email">
            <span>Email address</span>

            <div className="login-input">
              <Mail size={19} className="input-icon" aria-hidden="true" />

              <input
                id="login-email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
          </label>

          <label htmlFor="login-password">
            <span>Password</span>

            <div className="login-input">
              <Lock size={19} className="input-icon" aria-hidden="true" />

              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="current-password"
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                disabled={loading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          <button
            className="login-button"
            type="submit"
            disabled={loading}
          >
            <span>{loading ? "Signing in..." : "Sign In"}</span>
            {!loading && <ArrowRight size={19} />}
          </button>

          <div className="login-security">
            <span className="security-line"></span>
            <span className="security-icon">
              <Lock size={13} />
            </span>
            <span>Secure system access</span>
            <span className="security-line"></span>
          </div>
        </form>

        <p className="login-footer">
          Zekie's Pizza <span>•</span> Inventory Management System
        </p>
      </section>
    </main>
  );
}

export default Login;
