"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("https://askari-test.truid.ai/rest-auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await res.json();

      // Store token in cookie
      document.cookie = `userKey=${data.key}; path=/`;

      router.push("/dashboard");
    } catch (err) {
      setError("Login failed. Please check credentials.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2>Welcome Back</h2>
        <p>Login to your dashboard</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input required value={username} onChange={(e) => setUsername(e.target.value)} />
            <label>Username</label>
          </div>

          <div className="input-group">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label>Password</label>
          </div>

          {error && <span className="error">{error}</span>}

          <button className="login-btn">Login</button>
        </form>
      </div>
    </div>
  );
}
