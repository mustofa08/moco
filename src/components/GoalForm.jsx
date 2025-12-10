// src/components/GoalForm.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatRupiah } from "../lib/goalUtils";

const NAVY = "#052A3D";

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
  );
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
      console.error(err);
      alert("Gagal menyimpan goal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto"
    >
      {/* ================================
          SECTION: GOAL INFO
      ================================= */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: NAVY }}>
          Goal Information
        </h2>

        <div className="space-y-3">
          <div>
            <label className="text-sm text-slate-600">Nama Goal</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 focus:ring-2 focus:ring-[##052A3D]/40"
              placeholder="Contoh: Beli Laptop"
            />
          </div>

          <div>
            <label className="text-sm text-slate-600">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 h-20 resize-none focus:ring-2 focus:ring-[##052A3D]/40"
              placeholder="Tuliskan detail goal…"
            />
          </div>
        </div>
      </div>

      {/* ================================
          SECTION: TARGET & SAVING
      ================================= */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: NAVY }}>
          Target & Saving Plan
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Target Amount */}
          <div>
            <label className="text-sm text-slate-600">Target Amount</label>
            <div className="flex items-center border rounded-lg p-3 mt-1 bg-slate-50">
              <span className="mr-2 text-slate-500">Rp</span>
              <input
                value={targetAmountDisplay}
                onChange={onChangeTarget}
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                placeholder="0"
              />
            </div>
          </div>

          {/* Saving Amount */}
          <div>
            <label className="text-sm text-slate-600">
              Saving per {savingFrequency === "monthly" ? "bulan" : "minggu"}
            </label>
            <div className="flex items-center border rounded-lg p-3 mt-1 bg-slate-50">
              <span className="mr-2 text-slate-500">Rp</span>
              <input
                value={savingAmountDisplay}
                onChange={onChangeSavingAmount}
                inputMode="numeric"
                className="w-full bg-transparent outline-none"
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================================
          SECTION: PREFERENCES
      ================================= */}
      <div>
        <h2 className="text-lg font-semibold mb-3" style={{ color: NAVY }}>
          Preferences
        </h2>

        <div className="grid grid-cols-3 gap-4">
          {/* Frequency */}
          <div>
            <label className="text-sm text-slate-600">Frequency</label>
            <select
              value={savingFrequency}
              onChange={(e) => setSavingFrequency(e.target.value)}
              className="border rounded-lg p-3 mt-1 w-full bg-slate-50"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm text-slate-600">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="border rounded-lg p-3 mt-1 w-full bg-slate-50"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Wallet */}
          <div>
            <label className="text-sm text-slate-600">Wallet</label>
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="border rounded-lg p-3 mt-1 w-full bg-slate-50"
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
      </div>

      {/* ================================
          ACTION BUTTONS
      ================================= */}
      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border rounded-lg hover:bg-slate-100 transition"
        >
          Batal
        </button>

        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 rounded-lg text-white shadow hover:opacity-90 transition"
          style={{ background: NAVY }}
        >
          {loading ? "Menyimpan..." : goal?.id ? "Update Goal" : "Simpan Goal"}
        </button>
      </div>
    </form>
  );
}
