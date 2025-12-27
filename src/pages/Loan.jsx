import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import { Plus, X, Trash2, Edit, CreditCard, GripVertical } from "lucide-react";

// dnd-kit
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

/* -------------------------------------------------------------------
   Helper Formatter
------------------------------------------------------------------- */
const fmt = (num) => Number(num || 0).toLocaleString("id-ID");
const softGreen = "bg-[#E8F8F2]";
const softRed = "bg-[#FDECEC]";
const navy = "#052A3D";

/* -------------------------------------------------------------------
   Sortable Card Wrapper
------------------------------------------------------------------- */
function SortableDebtCard({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-full max-w-full overflow-hidden"
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------
   Drag Overlay — Full Soft Card
------------------------------------------------------------------- */
function DragCard({ item, wallets }) {
  if (!item) return null;

  const totalPaid = (item.debt_payments || []).reduce(
    (s, p) => s + Number(p.amount),
    0
  );
  const sisa = Number(item.amount) - totalPaid;

  return (
    <div
      className={`
    w-[90vw] max-w-[320px]
    p-5 rounded-xl shadow-2xl border 
    ${item.type === "hutang" ? softRed : softGreen}
  `}
      style={{ transform: "scale(1.03)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold capitalize text-lg" style={{ color: navy }}>
            {item.type}
          </p>
          <p className="text-sm text-slate-700">{item.name}</p>
        </div>
        <GripVertical className="opacity-40" />
      </div>

      <p className="text-sm">Total: {fmt(item.amount)}</p>
      <p className="text-sm text-blue-700">Sudah bayar: {fmt(totalPaid)}</p>
      <p className="text-sm text-red-600">Sisa: {fmt(sisa)}</p>

      <p
        className={`text-xs mt-2 ${
          sisa <= 0 ? "text-green-600" : "text-orange-600"
        }`}
      >
        {sisa <= 0 ? "Lunas" : "Belum Lunas"}
      </p>

      <p className="text-xs text-gray-600 mt-1">
        Wallet: {wallets.find((w) => w.id === item.wallet_id)?.name}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------
   MAIN PAGE
------------------------------------------------------------------- */
export default function Loan() {
  const [items, setItems] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [filter, setFilter] = useState("all");

  const [openForm, setOpenForm] = useState(false);
  const [openPay, setOpenPay] = useState(false);

  const [isEdit, setIsEdit] = useState(false);
  const [isEditPayment, setIsEditPayment] = useState(false);

  const [editingPayment, setEditingPayment] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);

  const [activeItem, setActiveItem] = useState(null);

  /* FORM STATE --------------------------------------------------- */
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
    paid_at: "",
  });

  /* FORMAT INPUT --------------------------------------------------- */
  const formatNumber = (v) =>
    v ? v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
  const unformatNumber = (v = "") => v.replace(/\./g, "");

  /* SENSORS -------------------------------------------------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 80, tolerance: 8 },
    })
  );

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        if (openForm) setOpenForm(false);
        if (openPay) setOpenPay(false);
      }

      if (e.key === "Enter") {
        if (openForm) {
          e.preventDefault();
          saveData();
        }

        if (openPay) {
          e.preventDefault();
          savePayment();
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openForm, openPay, form, payment]);

  /* FETCH DATA ----------------------------------------------------- */
  useEffect(() => {
    fetchAll();
    fetchWallets();
  }, [filter]);

  async function fetchAll() {
    const user = (await supabase.auth.getUser()).data.user;
    let query = supabase
      .from("debts")
      .select("*, debt_payments(*)")
      .eq("user_id", user.id)
      .order("order_index");

    if (filter !== "all") query = query.eq("type", filter);

    const { data } = await query;
    setItems(data || []);
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

  /* SAVE DEBT ------------------------------------------------------ */
  const saveData = async () => {
    if (!form.name.trim()) return alert("Nama wajib diisi");
    if (!form.amount) return alert("Jumlah wajib diisi");
    if (!form.wallet_id) return alert("Wallet wajib dipilih");

    const user = (await supabase.auth.getUser()).data.user;
    const payload = {
      type: form.type,
      name: form.name.trim(),
      amount: Number(unformatNumber(form.amount)),
      due_date: form.due_date,
      note: form.note || null,
      wallet_id: form.wallet_id,
      user_id: user.id,
    };

    if (isEdit) {
      await supabase.from("debts").update(payload).eq("id", form.id);
    } else {
      payload.order_index = items.length; // for DnD
      await supabase.from("debts").insert(payload);
    }

    setOpenForm(false);
    fetchAll();
  };

  /* DELETE DEBT ----------------------------------------------------- */
  const deleteDebt = async (id) => {
    if (!confirm("Hapus data ini?")) return;
    await supabase.from("debts").delete().eq("id", id);
    fetchAll();
  };

  /* PAYMENT --------------------------------------------------------- */
  const savePayment = async () => {
    if (!payment.wallet_id) return alert("Pilih wallet");
    if (!payment.amount) return alert("Jumlah bayar wajib diisi");
    if (payment.paid_at && new Date(payment.paid_at) > new Date()) {
      return alert("Tanggal tidak boleh di masa depan");
    }

    const user = (await supabase.auth.getUser()).data.user;
    const cleanAmount = Number(unformatNumber(payment.amount));

    if (isEditPayment) {
      await supabase
        .from("debt_payments")
        .update({
          amount: cleanAmount,
          wallet_id: payment.wallet_id,
          note: payment.note || null,
          paid_at: payment.paid_at || null,
        })
        .eq("id", editingPayment.id);
    } else {
      await supabase.from("debt_payments").insert({
        debt_id: selectedDebt.id,
        user_id: user.id,
        amount: cleanAmount,
        wallet_id: payment.wallet_id,
        note: payment.note || null,
        paid_at: payment.paid_at || new Date().toISOString(),
      });
    }

    setOpenPay(false);
    setIsEditPayment(false);
    setEditingPayment(null);
    fetchAll();
  };

  const deletePayment = async (id) => {
    if (!confirm("Hapus pembayaran?")) return;
    await supabase.from("debt_payments").delete().eq("id", id);
    fetchAll();
  };

  /* DnD -------------------------------------------------------------- */
  function onDragStart(e) {
    const itm = items.find((x) => x.id === e.active.id);
    setActiveItem(itm);
  }

  async function onDragEnd(e) {
    const { active, over } = e;
    setActiveItem(null);
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((x) => x.id === active.id);
    const newIndex = items.findIndex((x) => x.id === over.id);

    const newList = arrayMove(items, oldIndex, newIndex);
    setItems(newList);

    await Promise.all(
      newList.map((it, i) =>
        supabase.from("debts").update({ order_index: i }).eq("id", it.id)
      )
    );
  }

  /* TOTALS ----------------------------------------------------------- */
  const totalHutang = items
    .filter((x) => x.type === "hutang")
    .reduce((s, v) => s + Number(v.amount || 0), 0);

  const totalPiutang = items
    .filter((x) => x.type === "piutang")
    .reduce((s, v) => s + Number(v.amount || 0), 0);

  /* -------------------------------------------------------------------
     RENDER
  ------------------------------------------------------------------- */
  return (
    <div className="w-full overflow-x-hidden space-y-4">
      {/* SUMMARY */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl shadow bg-[#FDECEC] text-red-700">
          <p className="font-semibold">Total Hutang</p>
          <p className="text-xl font-bold">{fmt(totalHutang)}</p>
        </div>
        <div className="p-4 rounded-xl shadow bg-[#E8F8F2] text-green-700">
          <p className="font-semibold">Total Piutang</p>
          <p className="text-xl font-bold">{fmt(totalPiutang)}</p>
        </div>
      </div>

      {/* FILTER + ADD BUTTON */}
      <div className="flex gap-2 items-center">
        {["all", "hutang", "piutang"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <button
          onClick={() => {
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
          }}
          className="ml-auto bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-1"
        >
          <Plus size={18} /> Tambah
        </button>
      </div>

      {/* DnD LIST */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((v) => v.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((item) => {
              const paid = (item.debt_payments || []).reduce(
                (s, p) => s + Number(p.amount || 0),
                0
              );
              const sisa = item.amount - paid;

              return (
                <SortableDebtCard key={item.id} id={item.id}>
                  <div
                    className={`
                      p-4 rounded-xl shadow-sm border
                      ${item.type === "hutang" ? softRed : softGreen}
                    `}
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                      {/* LEFT */}
                      <div>
                        <p
                          className="font-bold capitalize text-lg"
                          style={{ color: navy }}
                        >
                          {item.type}
                        </p>
                        <p className="text-sm">{item.name}</p>

                        <p className="text-sm mt-1">
                          Total: {fmt(item.amount)}
                        </p>
                        <p className="text-sm text-blue-700">
                          Sudah bayar: {fmt(paid)}
                        </p>
                        <p className="text-sm text-red-600">
                          Sisa: {fmt(sisa)}
                        </p>

                        <p
                          className={`text-xs mt-1 ${
                            sisa <= 0 ? "text-green-600" : "text-orange-600"
                          }`}
                        >
                          {sisa <= 0 ? "Lunas" : "Belum Lunas"}
                        </p>

                        <p className="text-xs text-gray-600 mt-1">
                          Wallet:{" "}
                          {wallets.find((w) => w.id === item.wallet_id)?.name}
                        </p>
                      </div>

                      {/* ACTIONS */}
                      <div
                        className="
    flex flex-row justify-between items-center mt-3
    sm:mt-0
    sm:flex-col sm:items-end sm:justify-start sm:gap-1
  "
                      >
                        {/* LEFT (Mobile) / TOP (Desktop) */}
                        <div className="sm:mb-2">
                          <GripVertical className="opacity-40" />
                        </div>

                        {/* ACTION BUTTONS */}
                        <div
                          className="
      flex items-center gap-2
      sm:flex-col sm:items-end
    "
                        >
                          {/* BAYAR – PRIMARY */}
                          <button
                            onClick={() => {
                              setSelectedDebt(item);
                              setIsEditPayment(false);
                              setEditingPayment(null);
                              setPayment({
                                amount: "",
                                note: "",
                                wallet_id: "",
                                paid_at: new Date().toISOString().slice(0, 10),
                              });
                              setOpenPay(true);
                            }}
                            className="
        flex items-center gap-1
        px-3 py-1.5 rounded-lg
        text-sm font-medium
        bg-green-100 text-green-700
        hover:bg-green-200
      "
                          >
                            <CreditCard size={16} />
                            Bayar
                          </button>

                          {/* EDIT */}
                          <button
                            onClick={() => {
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
                            }}
                            className="
                              p-2 rounded-lg
                              text-blue-600 hover:bg-blue-100
                            "
                            aria-label="Edit"
                          >
                            <Edit size={18} />
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() => deleteDebt(item.id)}
                            className="
                              p-2 rounded-lg
                              text-red-600 hover:bg-red-100
                            "
                            aria-label="Hapus"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* HISTORY */}
                    <div className="mt-3 border-t pt-2 space-y-2">
                      <p className="text-xs font-semibold">
                        Riwayat Pembayaran:
                      </p>

                      {(item.debt_payments || []).length === 0 && (
                        <p className="text-xs text-gray-500">
                          Belum ada pembayaran
                        </p>
                      )}

                      {(item.debt_payments || [])
                        .sort(
                          (a, b) =>
                            new Date(b.paid_at || b.created_at) -
                            new Date(a.paid_at || a.created_at)
                        )
                        .map((p) => (
                          <div
                            key={p.id}
                            className="p-2 rounded bg-white border flex justify-between items-start"
                          >
                            <div>
                              <p className="font-medium">{fmt(p.amount)}</p>

                              <p className="text-xs text-gray-500">
                                {new Date(
                                  p.paid_at || p.created_at
                                ).toLocaleDateString("id-ID")}
                              </p>

                              {p.note && (
                                <p className="mt-1 text-xs italic text-slate-600">
                                  “{p.note}”
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => {
                                  setSelectedDebt(item);
                                  setIsEditPayment(true);
                                  setEditingPayment(p);
                                  setPayment({
                                    amount: formatNumber(p.amount),
                                    note: p.note || "",
                                    wallet_id: p.wallet_id,
                                    paid_at: p.paid_at
                                      ? p.paid_at.slice(0, 10)
                                      : p.created_at.slice(0, 10),
                                  });
                                  setOpenPay(true);
                                }}
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
                </SortableDebtCard>
              );
            })}
          </div>
        </SortableContext>

        {/* DRAG OVERLAY */}
        <DragOverlay>
          {activeItem && <DragCard item={activeItem} wallets={wallets} />}
        </DragOverlay>
      </DndContext>

      {/* ============= FORM MODAL ============= */}
      {openForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 w-full max-w-md rounded-xl shadow relative">
            <button
              className="absolute top-2 right-2"
              onClick={() => setOpenForm(false)}
            >
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
                autoFocus
                type="text"
                placeholder="Nama"
                className="border p-2 rounded w-full"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <input
                required
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
                required
                type="date"
                className="border p-2 rounded w-full"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />

              <textarea
                placeholder="Catatan"
                className="border p-2 rounded w-full"
                value={payment.note}
                onChange={(e) =>
                  setPayment({ ...payment, note: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
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

      {/* ============= PAYMENT MODAL ============= */}
      {openPay && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 w-80 rounded-xl shadow relative">
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
              <strong>{selectedDebt?.name}</strong>
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
                type="date"
                className="border p-2 rounded w-full"
                value={payment.paid_at}
                onChange={(e) =>
                  setPayment({ ...payment, paid_at: e.target.value })
                }
              />
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />
              <textarea
                placeholder="Catatan"
                className="border p-2 rounded w-full"
                value={payment.note}
                onChange={(e) =>
                  setPayment({ ...payment, note: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.stopPropagation();
                }}
              />

              <button
                onClick={savePayment}
                className="w-full bg-green-600 text-white py-2 rounded"
              >
                {isEditPayment ? "Update Pembayaran" : "Bayar Cicilan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
