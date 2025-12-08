// src/pages/HutangPiutang.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Plus, X, Trash2, Edit, CreditCard } from "lucide-react";

export default function HutangPiutang() {
  const [items, setItems] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [filter, setFilter] = useState("all");

  const [openForm, setOpenForm] = useState(false);
  const [openPay, setOpenPay] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Payment edit
  const [isEditPayment, setIsEditPayment] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);

  const [selectedDebt, setSelectedDebt] = useState(null);
  const [payments, setPayments] = useState([]);

  const [form, setForm] = useState({
    id: null,
    type: "hutang",
    name: "",
    amount: "",
    due_date: "",
    note: "",
    wallet_id: "",
  });

  const [payment, setPayment] = useState({
    amount: "",
    note: "",
    wallet_id: "",
  });

  // ======================== FORMATTER ===========================
  const formatNumber = (value) => {
    if (!value) return "";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };
  const unformatNumber = (value = "") => String(value).replace(/\./g, "");

  // ========================== FETCH =============================
  useEffect(() => {
    fetchData();
    fetchWallets();

    // Subscribe realtime
    const subs = [
      supabase
        .channel("debts")
        .on("postgres_changes", { event: "*", table: "debts" }, fetchData)
        .subscribe(),

      supabase
        .channel("debt_payments")
        .on(
          "postgres_changes",
          { event: "*", table: "debt_payments" },
          fetchData
        )
        .subscribe(),

      supabase
        .channel("wallets")
        .on("postgres_changes", { event: "*", table: "wallets" }, fetchWallets)
        .subscribe(),
    ];

    return () => subs.forEach((s) => supabase.removeChannel(s));
  }, [filter]);

  async function fetchData() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    let query = supabase
      .from("debts")
      .select("*, debt_payments(*)")
      .eq("user_id", user.id);

    if (filter !== "all") query = query.eq("type", filter);

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) console.error("fetch debts error:", error);
    else setItems(data || []);
  }

  async function fetchWallets() {
    const user = (await supabase.auth.getUser()).data.user;
    const { data } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .order("name");

    setWallets(data || []);
  }

  // ========================= VALIDASI =========================
  const validateForm = () => {
    if (!form.name.trim()) return alert("Nama wajib diisi");
    if (!form.amount) return alert("Jumlah wajib diisi");
    if (!form.wallet_id) return alert("Pilih wallet terlebih dahulu");
    if (!form.due_date) return alert("Tanggal jatuh tempo wajib diisi");
    return true;
  };

  // ========================= SAVE / EDIT DEBT =========================
  const saveData = async () => {
    if (!validateForm()) return;

    const user = (await supabase.auth.getUser()).data.user;

    const cleanAmount = Number(unformatNumber(form.amount));

    const payload = {
      type: form.type,
      name: form.name.trim(),
      amount: cleanAmount,
      remaining_amount: cleanAmount,
      due_date: form.due_date,
      note: form.note || null,
      wallet_id: form.wallet_id,
      user_id: user.id,
      status: "belum_lunas",
    };

    if (isEdit) {
      await supabase.from("debts").update(payload).eq("id", form.id);
    } else {
      await supabase.from("debts").insert(payload);
    }

    closeForm();
    fetchData();
    fetchWallets();
  };

  // ========================= DELETE DEBT =========================
  const deleteData = async (id) => {
    if (!confirm("Hapus data ini?")) return;

    await supabase.from("debts").delete().eq("id", id);
    fetchData();
    fetchWallets();
  };

  // ===================== POPUP FORM =====================
  const openAdd = () => {
    setIsEdit(false);
    setForm({
      id: null,
      type: "hutang",
      name: "",
      amount: "",
      due_date: "",
      note: "",
      wallet_id: "",
    });
    setOpenForm(true);
  };

  const openEdit = (item) => {
    setIsEdit(true);
    setForm({
      id: item.id,
      type: item.type,
      name: item.name,
      amount: formatNumber(item.amount),
      due_date: item.due_date,
      note: item.note,
      wallet_id: item.wallet_id,
    });
    setOpenForm(true);
  };

  const closeForm = () => {
    setOpenForm(false);
    setIsEdit(false);
  };

  // ===================== CICILAN =====================
  const openPayment = (item) => {
    setSelectedDebt(item);
    setPayments(item.debt_payments || []);

    // reset mode
    setIsEditPayment(false);
    setEditingPayment(null);

    setPayment({ amount: "", note: "", wallet_id: "" });
    setOpenPay(true);
  };

  const openEditPayment = (p) => {
    setIsEditPayment(true);
    setEditingPayment(p);

    setPayment({
      amount: formatNumber(p.amount),
      note: p.note || "",
      wallet_id: p.wallet_id,
    });

    setOpenPay(true);
  };

  const deletePayment = async (id) => {
    if (!confirm("Hapus pembayaran ini?")) return;

    await supabase.from("debt_payments").delete().eq("id", id);

    fetchData();
    fetchWallets();

    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const savePayment = async () => {
    if (!payment.wallet_id) return alert("Pilih wallet terlebih dahulu");
    if (!payment.amount) return alert("Jumlah pembayaran wajib diisi");

    const user = (await supabase.auth.getUser()).data.user;
    const cleanAmount = Number(unformatNumber(payment.amount));

    try {
      if (isEditPayment) {
        await supabase
          .from("debt_payments")
          .update({
            amount: cleanAmount,
            note: payment.note || null,
            wallet_id: payment.wallet_id,
          })
          .eq("id", editingPayment.id);
      } else {
        await supabase.from("debt_payments").insert({
          debt_id: selectedDebt.id,
          user_id: user.id,
          amount: cleanAmount,
          note: payment.note || null,
          wallet_id: payment.wallet_id,
        });
      }

      setOpenPay(false);
      setIsEditPayment(false);
      setEditingPayment(null);

      fetchData();
      fetchWallets();
    } catch (err) {
      console.error("savePayment error:", err);
    }
  };

  // ========================= SUMMARY =========================
  const totalHutang = items
    .filter((v) => v.type === "hutang")
    .reduce((s, v) => s + Number(v.remaining_amount || 0), 0);

  const totalPiutang = items
    .filter((v) => v.type === "piutang")
    .reduce((s, v) => s + Number(v.remaining_amount || 0), 0);

  // ========================= RENDER =========================
  return (
    <div className="p-4 space-y-4">
      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-red-100 text-red-700 rounded shadow">
          <p className="font-semibold">Total Hutang</p>
          <p className="text-xl font-bold">{totalHutang.toLocaleString()}</p>
        </div>

        <div className="p-4 bg-green-100 text-green-700 rounded shadow">
          <p className="font-semibold">Total Piutang</p>
          <p className="text-xl font-bold">{totalPiutang.toLocaleString()}</p>
        </div>
      </div>

      {/* FILTER */}
      <div className="flex gap-2">
        {["all", "hutang", "piutang"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded ${
              filter === f ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <button
          onClick={openAdd}
          className="ml-auto bg-blue-600 text-white px-3 py-1 rounded flex items-center gap-1"
        >
          <Plus size={18} /> Tambah
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {items.map((item) => {
          const totalPaid = (item.debt_payments || []).reduce(
            (s, p) => s + Number(p.amount || 0),
            0
          );
          const sisa = Number(item.amount) - totalPaid;

          return (
            <div
              key={item.id}
              className="p-4 bg-white border rounded-lg shadow-sm space-y-2"
            >
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold capitalize">{item.type}</p>
                  <p>{item.name}</p>

                  <p className="text-sm">
                    Total: {Number(item.amount).toLocaleString()}
                  </p>
                  <p className="text-sm text-blue-600">
                    Sudah bayar: {totalPaid.toLocaleString()}
                  </p>
                  <p className="text-sm text-red-600">
                    Sisa: {sisa.toLocaleString()}
                  </p>

                  <p
                    className={`text-xs mt-1 ${
                      sisa <= 0 ? "text-green-600" : "text-orange-600"
                    }`}
                  >
                    {sisa <= 0 ? "Status: Lunas" : "Status: Belum Lunas"}
                  </p>

                  <p className="text-xs text-gray-500">
                    Wallet:{" "}
                    {wallets.find((w) => w.id === item.wallet_id)?.name ?? "-"}
                  </p>

                  {item.note && (
                    <p className="text-xs text-gray-500 mt-1">{item.note}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => openPayment(item)}
                    className="text-green-600 flex items-center gap-1"
                  >
                    <CreditCard size={16} /> Bayar
                  </button>
                  <button
                    onClick={() => openEdit(item)}
                    className="text-blue-600"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => deleteData(item.id)}
                    className="text-red-600"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* HISTORY */}
              <div className="mt-2 border-t pt-2 space-y-1">
                <p className="text-xs font-semibold">Riwayat Pembayaran:</p>

                {item.debt_payments?.length === 0 ? (
                  <p className="text-xs text-gray-400">Belum ada pembayaran</p>
                ) : (
                  item.debt_payments.map((p) => (
                    <div
                      key={p.id}
                      className="p-2 bg-gray-100 rounded flex justify-between items-center"
                    >
                      <div>
                        <p>{Number(p.amount).toLocaleString()}</p>
                        {p.note && (
                          <p className="text-xs text-gray-500">{p.note}</p>
                        )}
                        <p className="text-xs">
                          {new Date(p.paid_at || p.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => openEditPayment(p)}
                          className="text-blue-600 text-xs"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePayment(p.id)}
                          className="text-red-600 text-xs"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* POPUP ADD/EDIT DEBT */}
      {openForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-5 w-80 rounded shadow relative">
            <button className="absolute top-2 right-2" onClick={closeForm}>
              <X />
            </button>

            <h2 className="text-lg font-bold mb-3">
              {isEdit ? "Edit Data" : "Tambah Data"}
            </h2>

            <div className="space-y-3">
              <select
                className="border p-2 rounded w-full"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="hutang">Hutang</option>
                <option value="piutang">Piutang</option>
              </select>

              <select
                className="border p-2 rounded w-full"
                value={form.wallet_id}
                onChange={(e) =>
                  setForm({ ...form, wallet_id: e.target.value })
                }
              >
                <option value="">Pilih Wallet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Nama"
                className="border p-2 rounded w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <input
                type="text"
                placeholder="Jumlah"
                className="border p-2 rounded w-full"
                value={form.amount}
                onChange={(e) => {
                  const raw = unformatNumber(e.target.value);
                  if (!/^\d*$/.test(raw)) return;
                  setForm({ ...form, amount: formatNumber(raw) });
                }}
              />

              <input
                type="date"
                className="border p-2 rounded w-full"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />

              <textarea
                placeholder="Catatan"
                className="border p-2 rounded w-full"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />

              <button
                onClick={saveData}
                className="w-full bg-blue-600 text-white py-2 rounded"
              >
                {isEdit ? "Update" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP ADD/EDIT PAYMENT */}
      {openPay && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-5 w-80 rounded shadow relative">
            <button
              className="absolute top-2 right-2"
              onClick={() => setOpenPay(false)}
            >
              <X />
            </button>

            <h2 className="text-lg font-bold mb-3">
              {isEditPayment ? "Edit Pembayaran" : "Pembayaran Cicilan"}
            </h2>

            <p className="text-sm mb-2">
              <strong>{selectedDebt?.name}</strong> — Sisa:{" "}
              {(
                Number(selectedDebt?.amount || 0) -
                payments.reduce((s, p) => s + Number(p.amount || 0), 0)
              ).toLocaleString()}
            </p>

            <div className="space-y-3">
              <select
                className="border p-2 rounded w-full"
                value={payment.wallet_id}
                onChange={(e) =>
                  setPayment({ ...payment, wallet_id: e.target.value })
                }
              >
                <option value="">Pilih Wallet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Jumlah bayar"
                className="border p-2 rounded w-full"
                value={payment.amount}
                onChange={(e) => {
                  const raw = unformatNumber(e.target.value);
                  if (!/^\d*$/.test(raw)) return;
                  setPayment({ ...payment, amount: formatNumber(raw) });
                }}
              />

              <textarea
                placeholder="Catatan"
                className="border p-2 rounded w-full"
                value={payment.note}
                onChange={(e) =>
                  setPayment({ ...payment, note: e.target.value })
                }
              />

              <button
                onClick={savePayment}
                className="w-full bg-green-600 text-white py-2 rounded"
              >
                {isEditPayment ? "Update Pembayaran" : "Bayar Cicilan"}
              </button>
            </div>

            {/* HISTORY */}
            <div className="mt-4 border-t pt-3 space-y-2 max-h-40 overflow-auto">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="p-2 bg-gray-100 rounded flex justify-between items-center"
                >
                  <div>
                    <p>{Number(p.amount).toLocaleString()}</p>
                    {p.note && (
                      <p className="text-xs text-gray-500">{p.note}</p>
                    )}
                    <p className="text-xs">
                      {new Date(p.paid_at || p.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => openEditPayment(p)}
                      className="text-blue-600 text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePayment(p.id)}
                      className="text-red-600 text-xs"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
