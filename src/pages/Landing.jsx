import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/home"); // LANGSUNG KE DASHBOARD
      }
    }
    checkUser();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
        background: "linear-gradient(135deg, #1e90ff, #00c6ff)",
        color: "white",
      }}
    >
      <h1 style={{ fontSize: 40, margin: 0 }}>MOCO</h1>
      <p
        style={{
          fontSize: 16,
          maxWidth: 300,
          textAlign: "center",
          marginTop: 10,
        }}
      >
        Kelola keuanganmu dengan mudah dan capai financial freedom.
      </p>

      <div style={{ marginTop: 30, display: "flex", gap: 15 }}>
        <Link
          to="/login"
          style={{
            background: "white",
            color: "#007bff",
            padding: "10px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: "bold",
          }}
        >
          Login
        </Link>

        <Link
          to="/signup"
          style={{
            background: "#0044ff",
            color: "white",
            padding: "10px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: "bold",
            border: "1px solid white",
          }}
        >
          Sign Up
        </Link>
      </div>
    </div>
  );
}
