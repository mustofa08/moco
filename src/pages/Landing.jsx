import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        navigate("/home");
      } else {
        setChecking(false);
      }
    }
    checkUser();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#052A3D]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-400 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#052A3D] to-[#0A4D65] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* BACKGROUND CIRCLE EFFECT */}
      <div className="absolute w-[380px] h-[380px] bg-cyan-500 opacity-[0.15] blur-[150px] -top-10 -left-10 rounded-full"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-400 opacity-[0.12] blur-[160px] -bottom-12 -right-12 rounded-full"></div>

      {/* BRAND LOGO */}
      <h1 className="text-5xl font-extrabold tracking-tight drop-shadow-md animate-fade-in">
        <span className="text-cyan-400">mo</span>co
      </h1>

      <p className="text-center text-sm mt-3 text-gray-200 max-w-xs animate-fade-in delay-200">
        Kelola keuanganmu dengan mudah, teratur, dan capai financial freedom.
      </p>

      {/* BUTTON SECTION */}
      <div className="flex flex-col gap-4 mt-10 w-full max-w-xs animate-fade-in delay-300">
        <Link
          to="/login"
          className="w-full bg-white text-[#052A3D] font-semibold py-3 rounded-xl text-center shadow-lg hover:bg-gray-100 transition transform hover:scale-[1.03]"
        >
          Login
        </Link>

        <Link
          to="/signup"
          className="w-full bg-cyan-500 text-white font-semibold py-3 rounded-xl text-center shadow-lg border border-cyan-300 hover:bg-cyan-600 transition transform hover:scale-[1.03]"
        >
          Sign Up
        </Link>
      </div>

      {/* FOOTER */}
      <p className="absolute bottom-3 text-xs text-gray-400">
        MOCO App • v1.0.0
      </p>
    </div>
  );
}
