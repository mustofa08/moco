// src/pages/Dashboard.jsx
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Wallet,
  TrendingDown,
  RefreshCw,
  BarChart2,
  LogOut,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";

/* -------------------------------
   Helpers
--------------------------------*/
const formatRupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

function computeCategorySpent(category, txMonth = [], subs = []) {
  const subIds = subs
    .filter((s) => s.category_id === category.id)
    .map((s) => s.id);

  return (txMonth || [])
    .filter(
      (t) =>
        t.type === "expense" &&
        (t.category_id === category.id || subIds.includes(t.subcategory_id))
    )
    .reduce((a, b) => a + Number(b.amount || 0), 0);
}

function computeSubSpent(sub, txMonth = []) {
  return (txMonth || [])
    .filter((t) => t.type === "expense" && t.subcategory_id === sub.id)
    .reduce((a, b) => a + Number(b.amount || 0), 0);
}

const COLORS = {
  income: "#16a34a",
  expense: "#ef4444",
  palette: ["#0ea5a3", "#60a5fa", "#f97316", "#f43f5e", "#a78bfa", "#34d399"],
};

/* -------------------------------
   Main component
--------------------------------*/
export default function Dashboard() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());

  const [wallets, setWallets] = useState([]);
  const [txMonth, setTxMonth] = useState([]);
  const [txAll, setTxAll] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subs, setSubs] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [loadingBtn, setLoadingBtn] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data?.user;
      if (!user) return;

      const start = `${year}-${String(month).padStart(2, "0")}-01`;
      const end = new Date(year, month, 0).toISOString().slice(0, 10);

      const [wRes, tMonthRes, tAllRes, cRes, sRes, gRes] = await Promise.all([
        // ✅ Perbaikan: Ambil saldo dari VIEW, bukan tabel wallets
        supabase.from("wallet_balance_view").select("*").eq("user_id", user.id),

        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .gte("date", start)
          .lte("date", end),

        supabase.from("transactions").select("*").eq("user_id", user.id),

        supabase.from("budget_categories").select("*").eq("user_id", user.id),
        supabase
          .from("budget_subcategories")
          .select("*")
          .eq("user_id", user.id),

        supabase.from("goals").select("*").eq("user_id", user.id),
      ]);

      setWallets(wRes.data || []);
      setTxMonth(tMonthRes.data || []);
      setTxAll(tAllRes.data || []);
      setCategories(
        (cRes.data || []).map((c) => ({ ...c, type: c.type || "expense" }))
      );
      setSubs(sRes.data || []);
      setGoals(gRes.data || []);
    } catch (err) {
      console.error("loadAll err", err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRefresh = async () => {
    setLoadingBtn(true);
    await loadAll();
    setTimeout(() => setLoadingBtn(false), 300);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login"; // redirect ke halaman login
  };

  /* -------------------------------
     Derived values
  --------------------------------*/

  const incomeMonth = useMemo(
    () =>
      (txMonth || [])
        .filter((t) => t.type === "income")
        .reduce((a, b) => a + Number(b.amount || 0), 0),
    [txMonth]
  );

  const monthlyExpense = useMemo(
    () =>
      (txMonth || [])
        .filter((t) => t.type === "expense")
        .reduce((a, b) => a + Number(b.amount || 0), 0),
    [txMonth]
  );

  // ✅ TOTAL SALDO – pakai saldo dari VIEW
  const totalBalance = useMemo(() => {
    return (wallets || []).reduce((sum, w) => sum + Number(w.balance || 0), 0);
  }, [wallets]);

  // Wallet list
  const walletData = useMemo(() => {
    return (wallets || []).map((w) => ({
      name: w.name,
      value: Number(w.balance || 0),
    }));
  }, [wallets]);

  /* Line chart */
  const lineData = useMemo(() => {
    const last = new Date(year, month, 0).getDate();
    const days = Array.from({ length: last }, (_, i) => ({
      day: String(i + 1),
      income: 0,
      expense: 0,
    }));
    const map = {};
    days.forEach((d) => (map[d.day] = d));

    (txMonth || []).forEach((t) => {
      const d = Number(String(t.date).slice(8, 10));
      if (!map[d]) return;
      if (t.type === "income") map[d].income += Number(t.amount || 0);
      if (t.type === "expense") map[d].expense += Number(t.amount || 0);
    });

    return days;
  }, [txMonth, month, year]);

  /* Pie chart */
  const expenseByCategory = useMemo(() => {
    return (categories || [])
      .filter((c) => c.type === "expense")
      .map((c) => ({
        name: c.category,
        value: computeCategorySpent(c, txMonth || [], subs || []),
      }))
      .filter((c) => c.value > 0);
  }, [categories, txMonth, subs]);

  /* Budget calculation */
  const budgetData = useMemo(() => {
    const catList = (categories || []).filter((c) => c.type === "expense");

    return catList.map((cat) => {
      let allocated = 0;

      if (cat.amount) allocated = Number(cat.amount);
      else if (cat.percent)
        allocated = (Number(cat.percent) / 100) * (incomeMonth || 0);
      else {
        const relatedSubs = subs.filter((s) => s.category_id === cat.id);
        allocated = relatedSubs.reduce((a, b) => a + Number(b.amount || 0), 0);
      }

      const spent = computeCategorySpent(cat, txMonth || [], subs || []);

      const subsOfCat = subs.filter((s) => s.category_id === cat.id);
      const subItems = subsOfCat.map((s) => {
        let allocatedSub = 0;

        if (s.amount) allocatedSub = Number(s.amount);
        else if (s.percent)
          allocatedSub = (Number(s.percent) / 100) * allocated;

        const spentSub = computeSubSpent(s, txMonth || []);
        const pctSub =
          allocatedSub > 0
            ? Math.min(100, Math.round((spentSub / allocatedSub) * 100))
            : 0;

        return {
          ...s,
          allocated: allocatedSub,
          spent: spentSub,
          percentOfAllocated: pctSub,
        };
      });

      const pct =
        allocated > 0
          ? Math.min(100, Math.round((spent / allocated) * 100))
          : 0;

      return {
        ...cat,
        allocated,
        spent,
        percentUsed: pct,
        subs: subItems,
      };
    });
  }, [categories, subs, incomeMonth, txMonth]);

  /* -------------------------------
     UI small components
  --------------------------------*/

  const MonthDropdown = () => (
    <select
      value={month}
      onChange={(e) => setMonth(Number(e.target.value))}
      className="px-3 py-2 rounded-xl border shadow-sm bg-white"
    >
      {[
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ].map((m, i) => (
        <option key={i} value={i + 1}>
          {m}
        </option>
      ))}
    </select>
  );

  const YearDropdown = () => (
    <select
      value={year}
      onChange={(e) => setYear(Number(e.target.value))}
      className="px-3 py-2 rounded-xl border shadow-sm bg-white"
    >
      {Array.from({ length: 7 }, (_, i) => year - 3 + i).map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  );

  const SummaryCard = ({ icon, label, value, accent }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4">
      <div
        className="p-3 rounded-lg"
        style={{ background: accent.bg, color: accent.fg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </div>
    </div>
  );

  /* -------------------------------
     Render UI
  --------------------------------*/
  return (
    <div className="p-4 md:p-6 pb-14 bg-[#F3F7FA] min-h-screen">
      {/* HEADER */}
      {/* HEADER */}
      <div className="mb-6">
        {/* TOP ROW: title + buttons (mobile: horizontal, desktop: space-between) */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Ringkasan keuanganmu
            </p>
          </div>

          {/* BUTTONS RIGHT SIDE */}
          <div className="flex items-center gap-2">
            {/* REFRESH BUTTON */}
            <button
              onClick={handleRefresh}
              disabled={loadingBtn}
              className={`flex items-center gap-2 px-3 py-2 bg-white border rounded-xl shadow-sm 
          transition text-sm
          ${loadingBtn ? "opacity-70 cursor-not-allowed" : "hover:bg-slate-100"}
        `}
            >
              <RefreshCw
                size={16}
                className={`${loadingBtn ? "animate-spin" : ""} transition`}
              />
            </button>

            {/* LOGOUT BUTTON */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-50 text-red-600 border border-red-200 
          hover:bg-red-100 transition flex items-center"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* FILTERS (always under the title) */}
        <div className="flex gap-3 mt-2">
          <MonthDropdown />
          <YearDropdown />
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          icon={<BarChart2 />}
          label="Income Bulan Ini"
          value={formatRupiah(incomeMonth)}
          accent={{ bg: "#ECFDF5", fg: "#065f46" }}
        />
        <SummaryCard
          icon={<TrendingDown />}
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(monthlyExpense)}
          accent={{ bg: "#FFF1F2", fg: "#991b1b" }}
        />
        <SummaryCard
          icon={<Wallet />}
          label="Total Saldo"
          value={formatRupiah(totalBalance)}
          accent={{ bg: "#EEF2FF", fg: "#3730A3" }}
        />
      </div>

      {/* MAIN GRID FIXED LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-6">
          {/* LINE CHART – FIXED HEIGHT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-[260px] flex flex-col">
            <div className="mb-3">
              <h3 className="font-semibold text-slate-800 text-sm">
                Income vs Expense
              </h3>
              <p className="text-xs text-slate-500">Tren harian bulan ini</p>
            </div>

            <div className="flex-1 min-h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lineData}
                  margin={{ top: 5, right: 15, bottom: 5, left: 0 }}
                >
                  {/* Garis bantu */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                  {/* Sumbu X */}
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickLine={false}
                  />

                  {/* Sumbu Y */}
                  <YAxis
                    tick={{ fontSize: 11, fill: "#6b7280" }}
                    tickFormatter={(v) => formatRupiah(v).replace("Rp ", "")}
                    tickLine={false}
                    axisLine={false}
                  />

                  {/* Tooltip modern */}
                  <ReTooltip
                    formatter={(v) => formatRupiah(v)}
                    contentStyle={{
                      background: "white",
                      borderRadius: 8,
                      border: "1px solid #e5e7eb",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 12,
                    }}
                  />

                  {/* Legend lebih simple */}
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    iconType="circle"
                    formatter={(value) => (
                      <span style={{ color: "#374151", fontSize: 12 }}>
                        {value}
                      </span>
                    )}
                  />

                  {/* Garis Expense */}
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />

                  {/* Garis Income */}
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* WALLETS – FIXED HEIGHT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-[260px] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-slate-800">Wallets</h4>
              <span className="text-xs px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                {walletData.length} wallet
              </span>
            </div>

            {/* Wallet List */}
            <div className="space-y-2 overflow-auto pr-1">
              {walletData.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200
                 bg-white hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                >
                  {/* Left: Icon + Name */}
                  <div className="flex items-center gap-3">
                    {/* Soft Icon Circle */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm"
                      style={{
                        background: [
                          "#0ea5e9",
                          "#22c55e",
                          "#6366f1",
                          "#f97316",
                          "#ef4444",
                          "#14b8a6",
                        ][i % 6],
                      }}
                    >
                      {w.name.charAt(0).toUpperCase()}
                    </div>

                    <span className="text-slate-800 font-medium truncate max-w-[120px]">
                      {w.name}
                    </span>
                  </div>

                  {/* Right: Balance */}
                  <span className="font-semibold text-slate-900 text-xs px-2.5 py-1 rounded-lg bg-slate-100 shadow-inner">
                    {formatRupiah(w.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN */}
        <div className="flex flex-col gap-6">
          {/* PIE CHART – FIXED HEIGHT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-[260px] flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-slate-800">
                Pengeluaran per Kategori
              </h4>
              <span className="text-xs text-slate-500">
                {formatRupiah(
                  expenseByCategory.reduce((s, c) => s + c.value, 0)
                )}
              </span>
            </div>

            {/* Chart Area — fixed height */}
            <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 5, bottom: 5 }}>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={70}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {expenseByCategory.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={COLORS.palette[i % COLORS.palette.length]}
                      />
                    ))}
                  </Pie>

                  <ReTooltip formatter={(v) => formatRupiah(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend compact */}
            <div className="flex justify-center gap-5 mt-1 text-xs">
              {expenseByCategory.map((cat, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{
                      background: COLORS.palette[i % COLORS.palette.length],
                    }}
                  />
                  <span className="text-slate-600">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SAVING GOALS – FIXED HEIGHT */}
          <div className="bg-white p-5 rounded-xl shadow-sm border h-[260px] flex flex-col">
            <div className="flex justify-between mb-2">
              <h4 className="font-semibold text-slate-800">Saving Goals</h4>
              <span className="text-xs text-slate-500">
                {goals.length} total
              </span>
            </div>

            <div className="space-y-3 overflow-auto pr-1">
              {goals.map((g, i) => {
                const saved = (txAll || [])
                  .filter((t) => t.wallet_id === g.wallet_id)
                  .reduce((a, b) => a + Number(b.amount || 0), 0);

                const pct = Math.min(
                  100,
                  Math.round((saved / (g.target_amount || 1)) * 100)
                );

                return (
                  <div
                    key={g.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      {/* Left */}
                      <div className="flex items-center gap-3">
                        {/* Soft Icon */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow"
                          style={{
                            background: [
                              "#0ea5e9",
                              "#10b981",
                              "#6366f1",
                              "#f97316",
                            ][i % 4],
                          }}
                        >
                          {g.name.charAt(0).toUpperCase()}
                        </div>

                        <span className="font-medium text-slate-800 truncate max-w-[120px]">
                          {g.name}
                        </span>
                      </div>

                      {/* Percent */}
                      <span className="text-sm font-semibold text-slate-700">
                        {pct}%
                      </span>
                    </div>

                    {/* Amount */}
                    <p className="text-xs text-slate-500 mt-1">
                      {formatRupiah(saved)} / {formatRupiah(g.target_amount)}
                    </p>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: [
                            "#0ea5e9",
                            "#10b981",
                            "#6366f1",
                            "#f97316",
                          ][i % 4],
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — BUDGET – VERY TALL + SCROLL */}
        <div className="bg-white p-5 rounded-xl shadow-sm border h-[540px] flex flex-col">
          <h3 className="font-semibold text-slate-800 mb-3">Budget Progress</h3>

          {/* SCROLL AREA */}
          <div className="space-y-6 overflow-auto pr-2">
            {budgetData.map((cat) => (
              <div key={cat.id} className="space-y-3">
                {/* CATEGORY HEADER */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">
                      {cat.category}
                    </p>
                    <p className="text-xs text-slate-500">
                      Alokasi: {formatRupiah(cat.allocated)}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-slate-800">
                      {cat.percentUsed}%
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatRupiah(cat.spent)} terpakai
                    </p>
                  </div>
                </div>

                {/* CATEGORY PROGRESS */}
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-3 bg-indigo-500"
                    style={{ width: `${cat.percentUsed}%` }}
                  />
                </div>

                {/* SUBCATEGORIES */}
                <div className="space-y-2">
                  {cat.subs.map((s) => (
                    <div
                      key={s.id}
                      className="bg-slate-50 p-3 rounded-lg space-y-2"
                    >
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{s.name}</span>
                        <span className="font-medium text-slate-900">
                          {formatRupiah(s.spent)} / {formatRupiah(s.allocated)}
                        </span>
                      </div>

                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-emerald-500"
                          style={{ width: `${s.percentOfAllocated}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-500">
                        {s.percentOfAllocated}%
                      </p>
                    </div>
                  ))}
                </div>

                {/* Divider between categories */}
                <div className="border-b border-slate-200 pt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
