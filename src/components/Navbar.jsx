// src/components/Navbar.jsx

import {
  Home,
  BookOpen,
  Target,
  ListChecks,
  Wallet,
  Handshake,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Link, useLocation } from "react-router-dom";

export default function Navbar({ collapsed, setCollapsed }) {
  const location = useLocation();

  // Fintech Premium Color Theme (Option B)
  const BG_NAVY = "bg-[#052A3D]";
  const ACTIVE_COLOR = "text-[#19D1E6]"; // Cyan Premium
  const INACTIVE_COLOR = "text-[#86A7B3]"; // Soft Slate
  const HOVER_COLOR = "hover:bg-[#07344A]"; // Slightly brighter teal navy

  const items = [
    { path: "/home", label: "Home", icon: <Home size={20} /> },
    { path: "/wallets", label: "Wallets", icon: <Wallet size={20} /> },
    { path: "/budget", label: "Budget", icon: <BookOpen size={20} /> },
    { path: "/goals", label: "Goals", icon: <Target size={20} /> },
    {
      path: "/loan",
      label: "Loan",
      icon: <Handshake size={20} />,
    },
    {
      path: "/transaction",
      label: "Transaction",
      icon: <ListChecks size={20} />,
    },
  ];

  return (
    <>
      {/* ----------------------- MOBILE NAV ------------------------ */}
      <nav
        className={`fixed bottom-0 left-0 right-0 ${BG_NAVY} p-2 rounded-t-xl shadow-lg z-40 lg:hidden`}
      >
        <div className="flex justify-around items-center">
          {items.map((it) => {
            const isActive = location.pathname === it.path;
            return (
              <Link
                key={it.path}
                to={it.path}
                className={`flex flex-col items-center text-xs transition 
                  ${isActive ? ACTIVE_COLOR : INACTIVE_COLOR}`}
              >
                {it.icon}
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ----------------------- DESKTOP NAV ------------------------ */}
      <nav
        className={`hidden lg:flex flex-col h-screen fixed left-0 top-0 
          ${BG_NAVY} border-r border-[#0B3B50] shadow-xl 
          transition-all duration-300
          ${collapsed ? "w-20" : "w-64"}`}
      >
        {/* Logo + Collapse Button */}
        <div className="flex items-center justify-between px-5 py-6">
          {!collapsed && (
            <h1 className="text-2xl font-bold tracking-tight text-white">
              <span className="text-[#19D1E6]">mo</span>co
            </h1>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-[#19D1E6] bg-[#07344A] hover:bg-[#0A4D65] p-2 rounded-lg transition"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex flex-col gap-2 px-3 mt-2">
          {items.map((it) => {
            const isActive = location.pathname === it.path;

            return (
              <Link
                key={it.path}
                to={it.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                  ${
                    isActive
                      ? `${ACTIVE_COLOR} bg-[#07344A] shadow-md`
                      : `${INACTIVE_COLOR} ${HOVER_COLOR}`
                  }
                  hover:translate-x-1
                `}
              >
                {it.icon}
                {!collapsed && <span>{it.label}</span>}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
