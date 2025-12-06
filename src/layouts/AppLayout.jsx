import { useState } from "react";
import Navbar from "../components/Navbar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <Navbar collapsed={collapsed} setCollapsed={setCollapsed} />

      <div
        className={`min-h-screen p-4 bg-slate-50 dark:bg-slate-900 transition-all duration-300 ${
          collapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        <Outlet />
      </div>
    </>
  );
}
