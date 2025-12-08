import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit,
  Search as SearchIcon,
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

  useEffect(() => {
    let mounted = true;

    async function init() {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      await loadTransactions();

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

      // also listen to debts/debt_payments because they can affect wallet choices or balances
      const subs = [
        supabase
          .channel("debts")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "debts" },
            () => mounted && loadTransactions()
          )
          .subscribe(),
        supabase
          .channel("debt_payments")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "debt_payments" },
            () => mounted && loadTransactions()
          )
          .subscribe(),
      ];

      return () => {
        mounted = false;
        supabase.removeChannel(channel);
        subs.forEach((s) => supabase.removeChannel(s));
      };
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, search, walletFilter]);

  async function loadTransactions() {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(
      lastDay
    ).padStart(2, "0")}`;

    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("transactions")
      .select(
        `
        id, date, created_at, type, amount, note,
        wallet_id, wallet:wallet_id (name),
        transfer_from, from_wallet:transfer_from (name),
        transfer_to_id, to_wallet:transfer_to_id (name),
        category_id, category:category_id (category),
        subcategory_id, subcategory:subcategory_id (name)
      `
      )
      .eq("user_id", user.id)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return console.error(error);

    const cleaned = (data || []).map((tx) => ({
      ...tx,
      date: String(tx.date).slice(0, 10),
      walletName: tx.wallet?.name || "-",
      walletFromName: tx.from_wallet?.name || "-",
      walletToName: tx.to_wallet?.name || "-",
      categoryName: tx.category?.category || "-",
      subcategoryName: tx.subcategory?.name || "-",
    }));

    setRaw(cleaned);
    applyFilter(cleaned);
  }

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

    setGrouped(
      Object.fromEntries(
        Object.entries(byDate).sort(([a], [b]) => new Date(b) - new Date(a))
      )
    );
  }

  async function deleteTx(id) {
    if (!confirm("Hapus transaksi ini?")) return;
    try {
      await supabase.from("transactions").delete().eq("id", id);
      loadTransactions();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus transaksi");
    }
  }

  const incomeSum = transactions
    .filter((t) => t.type === "income")
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const expenseSum = transactions
    .filter((t) => t.type === "expense")
    .reduce((a, b) => a + Number(b.amount || 0), 0);
  const netTotal = incomeSum - expenseSum;

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="sticky top-0 pb-3 pt-2 bg-slate-50 dark:bg-slate-900 z-20">
        <div className="flex justify-between items-center">
          <button onClick={() => setMonth(month === 1 ? 12 : month - 1)}>
            <ChevronLeft size={26} className="text-slate-600 dark:text-white" />
          </button>
          <h1 className="text-xl font-bold dark:text-white">
            {monthName} {year}
          </h1>
          <button onClick={() => setMonth(month === 12 ? 1 : month + 1)}>
            <ChevronRight
              size={26}
              className="text-slate-600 dark:text-white"
            />
          </button>
        </div>

        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari catatan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 pl-10 rounded-lg border dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            value={walletFilter}
            onChange={(e) => setWalletFilter(e.target.value)}
            className="p-2 rounded-lg border dark:bg-slate-800 dark:text-white"
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

      <div className="flex justify-around bg-white dark:bg-slate-800 py-3 rounded-xl shadow mt-3">
        <Summary label="Income" color="text-blue-600" value={incomeSum} />
        <Summary label="Expense" color="text-red-500" value={expenseSum} />
        <Summary label="Total" color="dark:text-white" value={netTotal} />
      </div>

      <div className="mt-6 space-y-6">
        {Object.entries(grouped).map(([date, txs]) => (
          <div key={date}>
            <p className="font-semibold dark:text-white mb-1">
              {new Date(date).getDate()} {monthName}
            </p>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow divide-y">
              {txs.map((tx) => (
                <div
                  key={tx.id}
                  className="p-4 flex justify-between items-center group"
                >
                  <div>
                    <p className="text-sm font-medium dark:text-white">
                      {tx.note || "(Tanpa catatan)"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {tx.type === "transfer" ? (
                        <>
                          Transfer — {tx.walletFromName} → {tx.walletToName}
                        </>
                      ) : (
                        <>
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
                        tx.type === "transfer"
                          ? "text-black"
                          : tx.type === "income"
                          ? "text-blue-600"
                          : "text-red-500"
                      }`}
                    >
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                        ? "-"
                        : ""}{" "}
                      Rp {Number(tx.amount).toLocaleString()}
                    </p>

                    <div className="opacity-0 group-hover:opacity-100 flex gap-3 justify-end mt-1 transition">
                      <button
                        onClick={() => navigate(`/transaction/edit/${tx.id}`)}
                      >
                        <Edit size={16} className="text-blue-400" />
                      </button>
                      <button onClick={() => deleteTx(tx.id)}>
                        <Trash2 size={16} className="text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/transaction/add")}
        className="fixed bottom-20 right-4 bg-red-500 text-white p-4 rounded-full shadow-lg hover:bg-red-600 active:scale-95 transition z-50"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}

function Summary({ label, value, color }) {
  return (
    <div className="text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${color}`}>
        Rp {Number(value).toLocaleString()}
      </p>
    </div>
  );
}
