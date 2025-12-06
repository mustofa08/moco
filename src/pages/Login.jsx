import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errorMsg, setErrorMsg] = useState("");

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrorMsg("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (error) throw error;
      navigate("/home");
    } catch (err) {
      setErrorMsg(err.message || "Email atau password salah.");
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Login</h2>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            onChange={handleChange}
            style={styles.input}
          />

          <input
            name="password"
            type="password"
            placeholder="Password"
            required
            onChange={handleChange}
            style={styles.input}
          />

          {errorMsg && <p style={styles.error}>{errorMsg}</p>}

          <button type="submit" style={styles.button}>
            Login
          </button>
        </form>

        <p style={styles.footerText}>
          Belum punya akun?{" "}
          <Link to="/signup" style={styles.link}>
            Daftar
          </Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #6a11cb, #2575fc)",
    padding: 20,
  },
  card: {
    width: 330,
    padding: "25px 30px",
    background: "rgba(255, 255, 255, 0.15)",
    backdropFilter: "blur(10px)",
    borderRadius: 16,
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    textAlign: "center",
    color: "white",
  },
  title: {
    marginBottom: 20,
    fontSize: 26,
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "12px",
    borderRadius: 10,
    border: "none",
    outline: "none",
    marginBottom: 15,
    fontSize: 14,
  },
  button: {
    width: "100%",
    padding: "12px",
    background: "#ffffff",
    color: "#2575fc",
    borderRadius: 10,
    border: "none",
    fontWeight: "bold",
    fontSize: 16,
    cursor: "pointer",
    marginTop: 5,
  },
  error: {
    color: "#ffcccc",
    marginBottom: 10,
    fontSize: 13,
  },
  footerText: {
    marginTop: 15,
    fontSize: 14,
  },
  link: {
    color: "#fff",
    fontWeight: "bold",
    textDecoration: "underline",
  },
};
