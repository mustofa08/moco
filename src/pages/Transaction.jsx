import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  Search as SearchIcon,
  Wallet,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Transaction() {
  const navigate = useNavigate();

  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [transactions, setTransactions] = useState([]);
  const [grouped, setGrouped] = useState({});
  const [raw, setRaw] = useState([]);

  const [search, setSearch] = useState("");
  const [walletFilter, setWalletFilter] = useState("all");

  /* --------------------------------------------
     INIT & REALTIME SYNC
  -------------------------------------------- */
  useEffect(() => {
    let mounted = true;

    async function init() {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      await loadTransactions();
      await loadTotalWalletBalance();

      const channel = supabase
        .channel(`transactions-sync-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            filter: `user_id=eq.${user.id}`,
          },
          () => mounted && loadTransactions()
        )
        .subscribe();

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
      };
    }

    init();
    // eslint-disable-next-line
  }, [month, year, search, walletFilter]);

  /* --------------------------------------------
     FETCH TRANSACTIONS
  -------------------------------------------- */
  async function loadTransactions() {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data } = await supabase
      .from("transactions")
      .select(
        `
        id, date, time, created_at, type, amount, note,
        wallet_id, wallet:wallet_id(name),
        transfer_from, from_wallet:transfer_from(name),
        transfer_to_id, to_wallet:transfer_to_id(name),
        category_id, category:category_id(category),
        subcategory_id, subcategory:subcategory_id(name)
      `
      )
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("time", { ascending: false })
      .order("created_at", { ascending: false });

    const cleaned = (data || []).map((tx) => ({
      ...tx,
      date: String(tx.date).slice(0, 10),
      time: tx.time ? tx.time.slice(0, 5) : "00:00",
      walletName: tx.wallet?.name || "-",
      walletFromName: tx.from_wallet?.name || "-",
      walletToName: tx.to_wallet?.name || "-",
      categoryName: tx.category?.category || "-",
      subcategoryName: tx.subcategory?.name || "-",
    }));

    setRaw(cleaned);
    applyFilter(cleaned);
  }

  /* --------------------------------------------
     FILTERING
  -------------------------------------------- */
  function applyFilter(list) {
    const s = search.toLowerCase();

    const filtered = list.filter((tx) => {
      const matchSearch =
        !search ||
        tx.note?.toLowerCase().includes(s) ||
        tx.categoryName?.toLowerCase().includes(s) ||
        tx.subcategoryName?.toLowerCase().includes(s) ||
        tx.walletName?.toLowerCase().includes(s);

      const matchWallet =
        walletFilter === "all"
          ? true
          : tx.wallet_id === walletFilter ||
            tx.transfer_from === walletFilter ||
            tx.transfer_to_id === walletFilter;

      return matchSearch && matchWallet;
    });

    setTransactions(filtered);

    const byDate = {};
    filtered.forEach((tx) => {
      if (!byDate[tx.date]) byDate[tx.date] = [];
      byDate[tx.date].push(tx);
    });

    // 🔥 SORT BY TIME DESC PER DAY
    Object.keys(byDate).forEach((d) => {
      byDate[d].sort((a, b) => b.time.localeCompare(a.time));
    });

    setGrouped(
      Object.fromEntries(
        Object.entries(byDate).sort(([a], [b]) => new Date(b) - new Date(a))
      )
    );
  }

  async function deleteTx(id) {
    if (!confirm("Hapus transaksi ini?")) return;
    await supabase.from("transactions").delete().eq("id", id);
    loadTransactions();
  }

  /* --------------------------------------------
     SUMMARY
  -------------------------------------------- */
  const incomeSum = transactions
    .filter((t) => t.type === "income")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const expenseSum = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, b) => a + Number(b.amount || 0), 0);

  const [totalWalletBalance, setTotalWalletBalance] = useState(0);

  async function loadTotalWalletBalance() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data } = await supabase
      .from("wallet_balance_view")
      .select("balance")
      .eq("user_id", user.id);

    const total = (data || []).reduce(
      (sum, w) => sum + Number(w.balance || 0),
      0
    );

    setTotalWalletBalance(total);
  }

  const walletOptions = useMemo(() => {
    const map = {};
    raw.forEach((tx) => {
      if (tx.wallet_id) map[tx.wallet_id] = tx.walletName;
      if (tx.transfer_from) map[tx.transfer_from] = tx.walletFromName;
      if (tx.transfer_to_id) map[tx.transfer_to_id] = tx.walletToName;
    });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [raw]);

  const monthName = new Date(year, month - 1).toLocaleString("id-ID", {
    month: "long",
  });

  /* --------------------------------------------
     UI
  -------------------------------------------- */
  return (
    <div className="min-h-screen p-4 pb-24 bg-[#F3F7FA] dark:bg-slate-900">
      {/* HEADER */}
      <div className="sticky top-0 z-20 pb-4 bg-[#F3F7FA] dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-4 flex items-center justify-between">
          <button onClick={() => setMonth(month === 1 ? 12 : month - 1)}>
            <ChevronLeft size={24} />
          </button>

          <h1 className="text-xl font-bold">
            {monthName} {year}
          </h1>

          <button onClick={() => setMonth(month === 12 ? 1 : month + 1)}>
            <ChevronRight size={24} />
          </button>
        </div>

        {/* SEARCH */}
        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400" />
            <input
              placeholder="Cari transaksi…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 p-2 rounded-lg border"
            />
          </div>

          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="p-2 rounded-lg border"
          >
            <option value="all">Semua Wallet</option>
            {walletOptions.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-3 mt-2">
        <Summary label="Income" color="text-green-600" value={incomeSum} />
        <Summary label="Expense" color="text-red-500" value={expenseSum} />
        <Summary
          label="Uang Saat Ini"
          color="text-blue-600"
          value={totalWalletBalance}
        />
      </div>

      {/* LIST */}
      <div className="mt-6 space-y-6">
        {Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <p className="font-semibold text-slate-700 mb-1">
              {new Date(date).getDate()} {monthName}
            </p>

            <div className="rounded-xl bg-white shadow">
              {txs.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 flex justify-between items-center hover:bg-slate-50 group"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {tx.note || "(Tanpa catatan)"}
                    </p>

                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock size={12} /> {tx.time}
                      {tx.type === "transfer" ? (
                        <>
                          <ArrowRightLeft size={12} /> {tx.walletFromName} →
                          {tx.walletToName}
                        </>
                      ) : (
                        <>
                          <Wallet size={12} />
                          {tx.categoryName}
                          {tx.type === "expense" &&
                            tx.subcategoryName !== "-" &&
                            ` — ${tx.subcategoryName}`}
                        </>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        tx.type === "income"
                          ? "text-green-600"
                          : tx.type === "expense"
                          ? "text-red-500"
                          : "text-slate-700"
                      }`}
                    >
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                        ? "-"
                        : ""}
                      Rp {Number(tx.amount).toLocaleString()}
                    </p>

                    <div className="opacity-0 group-hover:opacity-100 flex gap-3 justify-end mt-1">
                      <button
                        onClick={() => navigate(`/transaction/edit/${tx.id}`)}
                      >
                        <Edit size={16} />
                      </button>
                      <button onClick={() => deleteTx(tx.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ADD */}
      <button
        onClick={() => navigate("/transaction/add")}
        className="fixed bottom-20 right-4 bg-blue-600 text-white p-4 rounded-full shadow-lg"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}

function Summary({ label, value, color }) {
  return (
    <div className="text-center rounded-xl p-3 bg-white shadow">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${color}`}>
        Rp {Number(value).toLocaleString()}
      </p>
    </div>
  );
}
