// src/components/GoalForm.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatRupiah } from "../lib/goalUtils";

export default function GoalForm({
  goal = null,
  onSaved = () => {},
  onCancel = () => {},
}) {
  const [name, setName] = useState(goal?.name || "");
  const [description, setDescription] = useState(goal?.description || "");
  const [targetAmountDisplay, setTargetAmountDisplay] = useState(
    goal ? formatRupiah(goal.target_amount) : ""
  );
  const [savingAmountDisplay, setSavingAmountDisplay] = useState(
    goal ? formatRupiah(goal.saving_amount) : ""
  );
  const [savingFrequency, setSavingFrequency] = useState(
    goal?.saving_frequency || "monthly"
  ); // monthly | weekly
  const [priority, setPriority] = useState(goal?.priority || "medium");
  const [walletId, setWalletId] = useState(goal?.wallet_id || "");
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWallets();
  }, []);

  async function loadWallets() {
    const u = (await supabase.auth.getUser())?.data?.user;
    if (!u) return;
    const { data } = await supabase
      .from("wallets")
      .select("id,name")
      .eq("user_id", u.id)
      .order("created_at", { ascending: true });

    setWallets(data || []);
    if (!walletId && data?.length) setWalletId(data[0].id);
  }

  // format helpers
  function unformatNumber(str) {
    return Number(String(str || "").replace(/[^\d]/g, "")) || 0;
  }

  function onChangeTarget(e) {
    const numeric = String(e.target.value).replace(/[^\d]/g, "");
    setTargetAmountDisplay(
      numeric ? new Intl.NumberFormat("id-ID").format(Number(numeric)) : ""
    );
  }

  function onChangeSavingAmount(e) {
    const numeric = String(e.target.value).replace(/[^\d]/g, "");
    setSavingAmountDisplay(
      numeric ? new Intl.NumberFormat("id-ID").format(Number(numeric)) : ""
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const u = (await supabase.auth.getUser())?.data?.user;
    if (!u) return alert("User belum login");

    const payload = {
      user_id: u.id,
      name: name.trim(),
      description: description.trim(),
      target_amount: unformatNumber(targetAmountDisplay),
      saving_amount: unformatNumber(savingAmountDisplay),
      saving_frequency: savingFrequency,
      priority,
      wallet_id: walletId || null,
    };

    if (!payload.name) return alert("Nama goal wajib diisi");
    if (!payload.target_amount || payload.target_amount <= 0)
      return alert("Target amount harus lebih dari 0");
    if (!payload.wallet_id) return alert("Pilih wallet");

    setLoading(true);
    try {
      if (goal?.id) {
        await supabase.from("goals").update(payload).eq("id", goal.id);
      } else {
        await supabase.from("goals").insert(payload);
      }
      onSaved();
    } catch (err) {
      console.error("save goal:", err);
      alert("Gagal menyimpan goal: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-xl shadow">
      <div className="grid gap-3">
        <div>
          <label className="text-sm text-slate-600">Nama Goal</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div>
          <label className="text-sm text-slate-600">Deskripsi</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded p-2 mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-600">Target Amount</label>
            <div className="flex items-center border rounded p-2 mt-1">
              <span className="mr-2">Rp</span>
              <input
                value={targetAmountDisplay}
                onChange={onChangeTarget}
                inputMode="numeric"
                className="w-full outline-none"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">
              Saving per {savingFrequency === "monthly" ? "bulan" : "minggu"}
            </label>
            <div className="flex items-center border rounded p-2 mt-1">
              <span className="mr-2">Rp</span>
              <input
                value={savingAmountDisplay}
                onChange={onChangeSavingAmount}
                inputMode="numeric"
                className="w-full outline-none"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <div>
            <label className="text-sm text-slate-600">Frequency</label>
            <select
              value={savingFrequency}
              onChange={(e) => setSavingFrequency(e.target.value)}
              className="border rounded p-2 mt-1"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="border rounded p-2 mt-1"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="text-sm text-slate-600">Wallet</label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="border rounded p-2 mt-1 w-full"
            >
              <option value="">Pilih wallet</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 border rounded"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded"
          >
            {loading ? "Menyimpan..." : goal?.id ? "Update" : "Simpan"}
          </button>
        </div>
      </div>
    </form>
  );
}
