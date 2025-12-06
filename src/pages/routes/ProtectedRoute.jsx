import { Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then((res) => {
      setLoggedIn(!!res.data.user);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return loggedIn ? children : <Navigate to="/login" replace />;
}
