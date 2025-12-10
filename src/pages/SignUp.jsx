import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { Eye, EyeOff, UserPlus } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setErrorMsg("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    if (formData.password.length < 6) {
      setErrorMsg("Password minimal 6 karakter!");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName },
          emailRedirectTo: window.location.origin + "/login",
        },
      });

      if (error) throw error;

      navigate("/login?verify=1");
    } catch (err) {
      setErrorMsg(err.message || "Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#052A3D] to-[#0A4D65] flex items-center justify-center px-6 relative overflow-hidden">
      {/* Glow Soft Background */}
      <div className="absolute w-[450px] h-[450px] bg-cyan-400 opacity-20 blur-[120px] -top-16 -left-10 rounded-full"></div>
      <div className="absolute w-[400px] h-[400px] bg-blue-500 opacity-10 blur-[140px] -bottom-10 -right-10 rounded-full"></div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 text-white animate-fade-in">
        {/* Branding */}
        <h1 className="text-center text-4xl font-extrabold tracking-tight mb-1">
          <span className="text-cyan-400">mo</span>co
        </h1>
        <p className="text-center text-gray-200 text-sm mb-6">
          Buat akun baru untuk mulai mengelola keuanganmu
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <input
            name="fullName"
            placeholder="Full Name"
            required
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-800 placeholder-gray-500 shadow-sm
                   focus:ring-2 focus:ring-cyan-400 outline-none"
          />

          {/* Email */}
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-800 placeholder-gray-500 shadow-sm
                   focus:ring-2 focus:ring-cyan-400 outline-none"
          />

          {/* Password with Eye Icon */}
          <div className="relative">
            <input
              name="password"
              type={showPass ? "text" : "password"}
              placeholder="Password"
              required
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-800 placeholder-gray-500 shadow-sm
                     focus:ring-2 focus:ring-cyan-400 outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-800"
            >
              {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {/* Error message */}
          {errorMsg && (
            <p className="text-red-200 bg-red-500/20 p-2 text-sm rounded-lg text-center">
              {errorMsg}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition
              ${
                loading
                  ? "bg-gray-300 cursor-not-allowed text-gray-600"
                  : "bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg active:scale-[0.98]"
              }
            `}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            ) : (
              <>
                <UserPlus size={18} /> Daftar
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center mt-6 text-sm text-gray-200">
          Sudah punya akun?{" "}
          <Link
            to="/login"
            className="text-cyan-300 font-semibold hover:underline"
          >
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
