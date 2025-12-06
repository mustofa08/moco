// src/pages/Dashboard.jsx
import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import { Wallet, TrendingDown, RefreshCw } from "lucide-react";

/* -------------------------------------------------------------
   UTIL
-------------------------------------------------------------- */
const formatRupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

// Wallet balance (global)
function computeWalletBalance(walletId, transactions) {
  let balance = 0;

  (transactions || [])
    .filter((t) => t.wallet_id === walletId)
    .forEach((t) => {
      if (t.type === "income") balance += Number(t.amount || 0);
      if (t.type === "expense") balance -= Number(t.amount || 0);
    });

  (transactions || [])
    .filter((t) => t.type === "transfer")
    .forEach((t) => {
      if (t.transfer_from === walletId) balance -= Number(t.amount || 0);
      if (t.transfer_to_id === walletId) balance += Number(t.amount || 0);
    });

  return balance;
}

/* -------------------------------------------------------------
   SUBCATEGORY ALLOCATION
-------------------------------------------------------------- */
function computeAllocatedForSub(sub, parentAllocated) {
  if (!sub) return 0;

  if (sub.percent !== null && sub.percent !== "") {
    return parentAllocated
      ? Math.round((Number(sub.percent) / 100) * parentAllocated)
      : 0;
  }
  if (sub.amount !== null && sub.amount !== "") {
    return Number(sub.amount || 0);
  }
  return 0;
}

/* -------------------------------------------------------------
   CATEGORY ALLOCATION
-------------------------------------------------------------- */
function computeAllocatedForExpense(cat, totalIncome, subcategories = []) {
  if (!cat) return 0;

  if (cat.percent !== null && cat.percent !== "") {
    return Math.round((Number(cat.percent) / 100) * Number(totalIncome || 0));
  }

  if (cat.amount !== null && cat.amount !== "") {
    return Number(cat.amount || 0);
  }

  const subsOfCat = subcategories.filter((s) => s.category_id === cat.id);
  const sumSubNominal = subsOfCat.reduce(
    (acc, s) => acc + (s.amount ? Number(s.amount) : 0),
    0
  );

  return sumSubNominal > 0 ? sumSubNominal : 0;
}

/* -------------------------------------------------------------
   SPENT
-------------------------------------------------------------- */
function computeCategorySpent(category, transactions, subcategories = []) {
  const subs = subcategories.filter((s) => s.category_id === category.id);
  const subIds = subs.map((s) => s.id);

  return transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        (t.category_id === category.id || subIds.includes(t.subcategory_id))
    )
    .reduce((a, b) => a + Number(b.amount || 0), 0);
}

/* -------------------------------------------------------------
   DASHBOARD
-------------------------------------------------------------- */
export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  const [wallets, setWallets] = useState([]);
  const [txMonth, setTxMonth] = useState([]);
  const [txAll, setTxAll] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subs, setSubs] = useState([]);
  const [goals, setGoals] = useState([]);

  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  /* AUTO REFRESH every 30s */
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 30000);
    return () => clearInterval(id);
  }, [month, year]);

  function manualRefresh() {
    loadAll();
  }

  async function loadAll() {
    setLoading(true);

    const userRes = await supabase.auth.getUser();
    const user = userRes?.data?.user;
    if (!user) return;

    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = new Date(year, month, 0).toISOString().slice(0, 10);

    const [wRes, tMonthRes, tAllRes, cRes, sRes, gRes] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", user.id),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase.from("transactions").select("*").eq("user_id", user.id),
      supabase.from("budget_categories").select("*").eq("user_id", user.id),
      supabase.from("budget_subcategories").select("*").eq("user_id", user.id),
      supabase.from("goals").select("*").eq("user_id", user.id),
    ]);

    const w = wRes.data || [];
    const tM = tMonthRes.data || [];
    const tA = tAllRes.data || [];
    const c = (cRes.data || []).map((d) => ({
      ...d,
      type: d.type || "expense",
    }));
    const s = sRes.data || [];
    const g = gRes.data || [];

    setWallets(w);
    setTxMonth(tM);
    setTxAll(tA);
    setCategories(c);
    setSubs(s);
    setGoals(g);

    // compute global balance
    let sum = 0;
    for (const wallet of w) sum += computeWalletBalance(wallet.id, tA);
    setTotalBalance(sum);

    // monthly expense
    const exp = tM
      .filter((x) => x.type === "expense")
      .reduce((a, b) => a + Number(b.amount || 0), 0);
    setMonthlyExpense(exp);

    setLoading(false);
  }

  /* derived */
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income"),
    [categories]
  );

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );

  const totalIncome = incomeCategories.reduce(
    (s, c) => s + Number(c.amount || 0),
    0
  );

  const goalsPreview = goals.slice(0, 3);

  /* UI Components */
  const SummaryCard = ({ icon, label, value, color }) => (
    <div className="bg-white/90 dark:bg-slate-800 p-5 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-${color}-100 text-${color}-600`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold dark:text-white">{value}</p>
      </div>
    </div>
  );

  const BudgetRow = ({ category }) => {
    const allocated = computeAllocatedForExpense(category, totalIncome, subs);
    const spent = computeCategorySpent(category, txMonth, subs);

    const percent = allocated
      ? Math.min(100, Math.round((spent / allocated) * 100))
      : 0;

    const subsOfCat = subs.filter((s) => s.category_id === category.id);

    return (
      <div className="bg-white/90 dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow mt-4">
        <div className="flex justify-between items-center">
          <p className="font-semibold dark:text-white">{category.category}</p>
          <p className="text-xs text-slate-400">{subsOfCat.length} sub</p>
        </div>

        <p className="text-xs mt-1 text-slate-500">
          {percent}% • {formatRupiah(spent)} / {formatRupiah(allocated)}
        </p>

        <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <div
            className="h-2 bg-indigo-500 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>

        {subsOfCat.map((sub) => {
          const subAllocated = computeAllocatedForSub(sub, allocated);
          const spentSub = txMonth
            .filter((t) => t.subcategory_id === sub.id)
            .reduce((a, b) => a + Number(b.amount || 0), 0);

          const subPercent = subAllocated
            ? Math.min(100, Math.round((spentSub / subAllocated) * 100))
            : 0;

          return (
            <div key={sub.id} className="mt-3 ml-2">
              <p className="text-sm dark:text-white">{sub.name}</p>
              <p className="text-xs text-slate-500">
                {subPercent}% • {formatRupiah(spentSub)} /{" "}
                {formatRupiah(subAllocated)}
              </p>
              <div className="w-full h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-2 bg-blue-400 rounded-full"
                  style={{ width: `${subPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const GoalCard = ({ goal }) => {
    const saved = txAll
      .filter((t) => t.wallet_id === goal.wallet_id)
      .reduce((a, b) => a + Number(b.amount || 0), 0);

    const percent = Math.min(
      100,
      Math.round((saved / Number(goal.target_amount || 0)) * 100)
    );

    return (
      <div className="bg-white/90 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow">
        <div className="flex justify-between items-center">
          <p className="font-semibold dark:text-white">{goal.name}</p>
          <p className="font-semibold text-slate-500">{percent}%</p>
        </div>

        <p className="text-xs text-slate-500 mt-1">
          {formatRupiah(saved)} / {formatRupiah(goal.target_amount)}
        </p>

        <div className="w-full h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
          <div
            className="h-2 bg-green-500 rounded-full"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  };

  /* Month navigation */
  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  /* render */
  return (
    <div className="p-6 min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Ringkasan keuanganmu
          </p>
        </div>

        <button
          onClick={manualRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Month Selector */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Prev
        </button>

        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="p-2 rounded-lg border bg-white dark:bg-slate-800 dark:text-white"
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
            <option key={i + 1} value={i + 1}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="p-2 rounded-lg border bg-white dark:bg-slate-800 dark:text-white"
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const y = new Date().getFullYear() - 5 + i;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>

        <button
          onClick={nextMonth}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Next
        </button>
      </div>

      {loading ? (
        <p className="text-slate-500 dark:text-slate-400">Loading...</p>
      ) : (
        <>
          {/* --- SUMMARY CARDS --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <SummaryCard
              icon={<Wallet />}
              label="Total Saldo"
              value={formatRupiah(totalBalance)}
              color="blue"
            />

            <SummaryCard
              icon={<TrendingDown />}
              label="Pengeluaran Bulan Ini"
              value={formatRupiah(monthlyExpense)}
              color="red"
            />
          </div>

          {/* --- BUDGET PROGRESS --- */}
          <h3 className="text-xl font-semibold dark:text-white mb-4">
            Budget Progress —{" "}
            {new Date(year, month - 1).toLocaleString("id-ID", {
              month: "long",
              year: "numeric",
            })}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {expenseCategories.map((c) => (
              <BudgetRow key={c.id} category={c} />
            ))}
          </div>

          {/* --- SAVING GOALS --- */}
          <h3 className="text-xl font-semibold dark:text-white mt-10 mb-4">
            Saving Goals
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {goalsPreview.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
