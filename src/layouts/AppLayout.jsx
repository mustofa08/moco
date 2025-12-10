import { useState } from "react";
import Navbar from "../components/Navbar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex bg-[#F3F7FA] min-h-screen">
      {/* NAVBAR */}
      <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* MAIN CONTENT */}
      <main
        className={`
          flex-1 transition-all duration-300 
          p-4 sm:p-6 
          ${collapsed ? "lg:ml-20" : "lg:ml-64"}
        `}
      >
        {/* CONTENT WRAPPER */}
        <div className="max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
