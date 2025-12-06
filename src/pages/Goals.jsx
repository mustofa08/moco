// src/pages/Goals.jsx
import { useEffect, useState } from "react";
import GoalForm from "../components/GoalForm";
import { supabase } from "../lib/supabaseClient";
import {
  computeWalletBalance,
  computeETA,
  formatRupiah,
} from "../lib/goalUtils";

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, []);

  async function fetchAll() {
    setLoading(true);
    const u = (await supabase.auth.getUser())?.data?.user;
    if (!u) {
      setLoading(false);
      return;
    }

    const [gRes, tRes] = await Promise.all([
      supabase
        .from("goals")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false }),
      supabase.from("transactions").select("*").eq("user_id", u.id),
    ]);

    setGoals(gRes.data || []);
    setTxs(tRes.data || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setOpenForm(true);
  }

  function openEdit(g) {
    setEditing(g);
    setOpenForm(true);
  }

  async function handleDelete(id) {
    if (!confirm("Hapus goal ini?")) return;

    await supabase.from("goals").delete().eq("id", id);

    // Jika kamu memutuskan untuk tetap menyimpan tabel goal_history:
    // await supabase.from("goal_history").delete().eq("goal_id", id);

    fetchAll();
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Tambah Goal
        </button>
      </div>

      {/* ========== POPUP MODAL ========== */}
      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpenForm(false)}
          />
          <div className="relative z-50 w-full max-w-lg">
            <GoalForm
              goal={editing}
              onSaved={() => {
                setOpenForm(false);
                fetchAll();
              }}
              onCancel={() => setOpenForm(false)}
            />
          </div>
        </div>
      )}

      {/* ========== LIST GOALS ========== */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => {
            const saved = computeWalletBalance(txs, g.wallet_id);
            const progress = Math.min(
              100,
              Math.round((saved / Number(g.target_amount || 0)) * 100) || 0
            );

            const { etaLabel } = computeETA({
              saved,
              target: Number(g.target_amount || 0),
              savingAmount: Number(g.saving_amount || 0),
              frequency: g.saving_frequency || "weekly",
            });

            return (
              <div key={g.id} className="bg-white p-4 rounded shadow">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold">
                      {g.name}{" "}
                      <span className="text-xs text-slate-400">
                        ({g.priority})
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {g.description}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Target</div>
                    <div className="font-semibold">
                      Rp {formatRealRupiah(g.target_amount)}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <div>Saved: Rp {formatRealRupiah(saved)}</div>
                    <div>{progress}%</div>
                  </div>

                  <div className="w-full h-3 bg-slate-200 rounded mb-2">
                    <div
                      className="h-3 rounded"
                      style={{
                        width: `${progress}%`,
                        backgroundColor:
                          progress >= 100
                            ? "#16a34a"
                            : progress > 50
                            ? "#0ea5e9"
                            : "#f97316",
                      }}
                    />
                  </div>

                  <div className="text-xs text-slate-500 flex justify-between">
                    <div>
                      {g.saving_frequency
                        ? `${g.saving_frequency} Rp ${formatRealRupiah(
                            g.saving_amount
                          )}`
                        : "Plan: -"}
                    </div>
                    <div>ETA: {etaLabel || "-"}</div>
                  </div>

                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      onClick={() => openEdit(g)}
                      className="px-3 py-1 bg-yellow-400 text-white rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRealRupiah(n) {
  return Number(n || 0).toLocaleString("id-ID");
}
