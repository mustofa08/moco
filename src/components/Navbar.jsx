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

  const items = [
    { path: "/home", label: "Home", icon: <Home size={20} /> },
    { path: "/wallets", label: "Wallets", icon: <Wallet size={20} /> },
    { path: "/budget", label: "Budget", icon: <BookOpen size={20} /> },
    { path: "/goals", label: "Goals", icon: <Target size={20} /> },
    {
      path: "/transaction",
      label: "Transaction",
      icon: <ListChecks size={20} />,
    },
  ];

  return (
    <>
      {/* MOBILE */}
      <nav className="fixed bottom-0 left-0 right-0 bg-blue-950 p-2 shadow-lg rounded-t-xl z-40 lg:hidden">
        <div className="flex justify-around items-center">
          {items.map((it) => (
            <Link
              key={it.path}
              to={it.path}
              className={`flex flex-col items-center text-xs ${
                location.pathname === it.path
                  ? "text-yellow-500"
                  : "text-slate-400"
              }`}
            >
              {it.icon}
              <span>{it.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* DESKTOP */}
      <nav
        className={`hidden lg:flex flex-col h-screen fixed left-0 top-0 bg-blue-950 border-r border-slate-700 shadow-sm transition-all duration-300 ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-6">
          {!collapsed && (
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              <span className="text-yellow-500">mo</span>co
            </h1>
          )}

          <button
            onClick={() => setCollapsed((v) => !v)}
            className="text-yellow-500 bg-blue-900 hover:bg-blue-800 p-2 rounded-lg transition"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <div className="flex flex-col gap-2 px-3">
          {items.map((it) => {
            const active = location.pathname === it.path;
            return (
              <Link
                key={it.path}
                to={it.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-yellow-500 hover:bg-blue-900/50"
                }`}
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
