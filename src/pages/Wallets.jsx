// src/pages/Wallets.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Plus } from "lucide-react";

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    let mounted = true;
    fetchWallets();

    // subscribe to underlying tables so we can re-fetch the view when anything changes
    const subs = [
      supabase
        .channel("wallets")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "wallets" },
          () => mounted && fetchWallets()
        )
        .subscribe(),
      supabase
        .channel("transactions")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "transactions" },
          () => mounted && fetchWallets()
        )
        .subscribe(),
      supabase
        .channel("debts")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "debts" },
          () => mounted && fetchWallets()
        )
        .subscribe(),
      supabase
        .channel("debt_payments")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "debt_payments" },
          () => mounted && fetchWallets()
        )
        .subscribe(),
    ];

    return () => {
      mounted = false;
      // remove channels
      try {
        subs.forEach((s) => supabase.removeChannel(s));
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchWallets() {
    setLoading(true);
    const userRes = await supabase.auth.getUser();
    const user = userRes?.data?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    // NOTE: use wallet_balance_view instead of wallets table
    const { data, error } = await supabase
      .from("wallet_balance_view")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      console.error("fetchWallets error:", error);
      setWallets([]);
    } else {
      // view returns balance column — normalize object so UI uses same keys as previous code
      setWallets(
        (data || []).map((w) => ({ ...w, balance: Number(w.balance || 0) }))
      );
    }
    setLoading(false);
  }

  function openAddWallet() {
    setEditingWallet(null);
    setName("");
    setModalOpen(true);
  }

  function openEditWallet(wallet) {
    setEditingWallet(wallet);
    setName(wallet.name);
    setModalOpen(true);
  }

  async function deleteWallet(id) {
    if (!confirm("Hapus wallet ini?")) return;
    try {
      await supabase.from("wallets").delete().eq("id", id);
      fetchWallets();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus wallet");
    }
  }

  async function saveWallet() {
    const userRes = await supabase.auth.getUser();
    const user = userRes?.data?.user;
    if (!user) return;

    if (!name.trim()) {
      alert("Nama wallet wajib diisi");
      return;
    }

    try {
      if (editingWallet) {
        await supabase
          .from("wallets")
          .update({ name: name.trim() })
          .eq("id", editingWallet.id);
      } else {
        await supabase.from("wallets").insert({
          user_id: user.id,
          name: name.trim(),
          type: "default",
          balance: 0,
        });
      }
      setModalOpen(false);
      fetchWallets();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan wallet");
    }
  }

  const totalBalance = wallets.reduce(
    (sum, w) => sum + Number(w.balance || 0),
    0
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-6 ">
        <div className="mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Wallets</h1>
              <p className="text-slate-500 text-sm">
                Saldo dihitung dari database (wallet_balance_view).
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Saldo</p>
                <p className="text-lg font-semibold">
                  Rp {totalBalance.toLocaleString()}
                </p>
              </div>

              <button
                onClick={openAddWallet}
                className="bg-white px-4 py-2 rounded-lg border shadow-sm flex items-center gap-2"
              >
                <Plus size={18} /> Tambah Wallet
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center text-slate-500">
                Loading...
              </div>
            ) : wallets.length === 0 ? (
              <div className="col-span-full bg-white p-6 rounded-lg border shadow text-center">
                <p className="text-slate-600">Belum ada wallet.</p>
                <button
                  onClick={openAddWallet}
                  className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg"
                >
                  Tambah Wallet
                </button>
              </div>
            ) : (
              wallets.map((w) => (
                <div
                  key={w.wallet_id || w.id}
                  className="bg-white border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-slate-500">Wallet</p>
                      <h3 className="text-lg font-semibold">{w.name}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Saldo</p>
                      <p className="text-lg font-semibold">
                        Rp {Number(w.balance).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() =>
                        openEditWallet({
                          id: w.wallet_id || w.id,
                          name: w.name,
                        })
                      }
                      className="px-3 py-2 text-sm bg-yellow-400 text-white rounded-lg"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteWallet(w.wallet_id || w.id)}
                      className="px-3 py-2 text-sm bg-red-500 text-white rounded-lg"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative z-50 bg-white p-6 rounded-xl w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              {editingWallet ? "Edit Wallet" : "Tambah Wallet"}
            </h2>

            <label className="text-sm text-slate-600">Nama Wallet</label>
            <input
              className="w-full border p-2 rounded mt-1 mb-3"
              placeholder="Cash, BCA, Gopay..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 border rounded"
              >
                Batal
              </button>
              <button
                onClick={saveWallet}
                className="px-3 py-2 bg-slate-900 text-white rounded"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
