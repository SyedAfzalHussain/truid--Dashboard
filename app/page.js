"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  // Helper functions for cookies
  const getCookie = (name) => {
    return document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.split("=")[1];
  };

  const getDashboardRoute = (username) => {
    if (username === "afzal") {
      return "/dashboard-truid";
    }
    return "/dashboard";
  };

  // Check if user is already logged in and redirect
  useEffect(() => {
    const token = getCookie("userKey");
    const storedUsername = getCookie("username");

    if (token && storedUsername) {
      const dashboardRoute = getDashboardRoute(storedUsername);
      router.replace(dashboardRoute);
    } else {
      setChecking(false);
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("https://trueidmapp.askaribank.com.pk/rest-auth/login/", {
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

      // Store token and username in cookies
      document.cookie = `userKey=${data.key}; path=/`;
      document.cookie = `username=${username}; path=/`;

      // Redirect to appropriate dashboard based on username
      const dashboardRoute = getDashboardRoute(username);
      router.push(dashboardRoute);
    } catch (err) {
      setError("Login failed. Please check credentials.");
    }
  };

  // Show loading while checking authentication
  if (checking) {
    return null;
  }

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
