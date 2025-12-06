import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function SignUp() {
  const [formData, setFormData] = useState({
    fullName: "",
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

    if (formData.password.length < 6) {
      setErrorMsg("Password minimal 6 karakter!");
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      alert("Pendaftaran berhasil! Silakan cek email verifikasi.");
    } catch (err) {
      setErrorMsg(err.message);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Registrasi</h2>

        <form onSubmit={handleSubmit} style={{ width: "100%" }}>
          <input
            name="fullName"
            placeholder="Full Name"
            required
            onChange={handleChange}
            style={styles.input}
          />

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
            Daftar
          </button>
        </form>

        <p style={styles.footerText}>
          Sudah punya akun?{" "}
          <Link to="/" style={styles.link}>
            Login
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
    background: "linear-gradient(135deg, #43cea2, #185a9d)",
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
    background: "white",
    color: "#185a9d",
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
    color: "white",
    fontWeight: "bold",
    textDecoration: "underline",
  },
};
