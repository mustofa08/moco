import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import {
  Plus,
  MoreVertical,
  Edit,
  Trash,
  GripVertical,
  Wallet2,
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

/* --------------------------------------------
   Premium Wallet Card Color (clean & soft)
--------------------------------------------- */
const CARD_BG = "bg-gradient-to-br from-[#F6FAFD] to-[#E9F2F7]"; // soft fintech neutral
const ICON_COLOR = "text-[#0A3D4E]"; // harmonis dengan navbar cyan-teal tone

/* --------------------------------------------
   Sortable Wallet Card
--------------------------------------------- */
function SortableWalletCard({ wallet, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wallet.wallet_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      {children}
    </div>
  );
}

/* --------------------------------------------
   MAIN PAGE
--------------------------------------------- */
export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState(null);
  const [name, setName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 80, tolerance: 10 },
    })
  );

  /* Fetch Wallets */
  useEffect(() => {
    fetchWallets();
    const sub = supabase
      .channel("wallets_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        fetchWallets
      )
      .subscribe();

    return () => supabase.removeChannel(sub);
  }, []);

  async function fetchWallets() {
    const user = (await supabase.auth.getUser()).data.user;

    const { data } = await supabase
      .from("wallet_balance_view")
      .select("*")
      .eq("user_id", user.id)
      .order("position");

    setWallets(
      (data || []).map((w) => ({
        ...w,
        balance: Number(w.balance),
      }))
    );
  }

  /* Save Order */
  async function saveOrder(list) {
    for (let i = 0; i < list.length; i++) {
      await supabase
        .from("wallets")
        .update({ position: i })
        .eq("id", list[i].wallet_id);
    }
  }

  function handleDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = wallets.findIndex((w) => w.wallet_id === active.id);
    const newIndex = wallets.findIndex((w) => w.wallet_id === over.id);

    const newList = arrayMove(wallets, oldIndex, newIndex);
    setWallets(newList);
    saveOrder(newList);
  }

  /* CRUD */
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

  async function saveWallet() {
    const user = (await supabase.auth.getUser()).data.user;

    if (!name.trim()) return alert("Nama wajib diisi");

    if (editingWallet) {
      await supabase
        .from("wallets")
        .update({ name })
        .eq("id", editingWallet.wallet_id);
    } else {
      await supabase.from("wallets").insert({
        user_id: user.id,
        name,
        position: wallets.length,
        type: "default",
      });
    }

    setModalOpen(false);
    fetchWallets();
  }

  async function deleteWallet(id) {
    if (!confirm("Hapus wallet?")) return;
    await supabase.from("wallets").delete().eq("id", id);
    fetchWallets();
  }

  const totalBalance = wallets.reduce((s, w) => s + w.balance, 0);

  /* --------------------------------------------
     UI RENDERING (Premium Fintech Style)
  --------------------------------------------- */
  return (
    <div className="min-h-screen p-4 bg-[#F3F7FA]">
      {/* Header + Button */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-[#052A3D]">Wallets</h1>
          <p className="text-sm text-slate-500">Kelola sumber keuanganmu</p>
        </div>

        {/* Button Tambah */}
        <button
          onClick={openAddWallet}
          className="
            hidden sm:flex items-center gap-2 
            bg-[#052A3D] text-white px-4 py-2 rounded-xl 
            hover:bg-[#07344A] transition shadow
          "
        >
          <Plus size={18} />
          Tambah
        </button>

        {/* Mobile Button */}
        <button
          onClick={openAddWallet}
          className="
            sm:hidden bg-[#052A3D] text-white 
            p-3 rounded-full shadow-lg fixed right-4 top-4
          "
        >
          <Plus size={20} />
        </button>
      </div>

      {/* TOTAL SALDO CARD */}
      <div
        className="
          w-full bg-white shadow-md rounded-xl p-4 
          border border-slate-200 mb-6
        "
      >
        <p className="text-sm text-slate-500">Total Saldo</p>
        <p className="text-3xl font-bold text-[#052A3D]">
          Rp {totalBalance.toLocaleString()}
        </p>
      </div>

      {/* GRID */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={wallets.map((w) => w.wallet_id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wallets.map((w) => {
              return (
                <SortableWalletCard key={w.wallet_id} wallet={w}>
                  <div
                    className={`
                      relative rounded-xl shadow-sm p-5 group h-[160px]
                      flex flex-col justify-between
                      ${CARD_BG} text-[#052A3D]
                      hover:shadow-lg transition
                    `}
                  >
                    {/* Drag Handle */}
                    <div className="absolute left-3 top-3 opacity-40 group-hover:opacity-70 transition">
                      <GripVertical size={18} />
                    </div>

                    {/* Menu */}
                    <button
                      className="
                        absolute right-3 top-3 opacity-0 group-hover:opacity-100 
                        transition p-1 hover:bg-black/5 rounded
                      "
                      onClick={() =>
                        setMenuOpenId(
                          menuOpenId === w.wallet_id ? null : w.wallet_id
                        )
                      }
                    >
                      <MoreVertical size={18} />
                    </button>

                    {/* Dropdown */}
                    {menuOpenId === w.wallet_id && (
                      <div
                        className="
      absolute right-3 top-11 z-40 w-40 bg-white rounded-xl 
      shadow-lg border border-slate-200 overflow-hidden
    "
                      >
                        {/* EDIT */}
                        <button
                          onClick={() => {
                            openEditWallet(w);
                            setMenuOpenId(null);
                          }}
                          className="
                              flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 
                              hover:bg-slate-100 transition text-left
                            "
                        >
                          <Edit size={16} />
                          <span>Edit</span>
                        </button>

                        <div className="border-t border-slate-200"></div>

                        {/* DELETE */}
                        <button
                          onClick={() => deleteWallet(w.wallet_id)}
                          className="
                            flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 
                            hover:bg-red-50 transition text-left
                          "
                        >
                          <Trash size={16} />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}

                    {/* CONTENT */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet2 className={ICON_COLOR} size={22} />
                        <h3 className="text-lg font-semibold truncate">
                          {w.name}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-500">Saldo</p>
                      <p className="text-2xl font-bold">
                        Rp {w.balance.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </SortableWalletCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center">
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
            <h2 className="text-lg font-semibold mb-4">
              {editingWallet ? "Edit Wallet" : "Tambah Wallet"}
            </h2>

            <input
              className="w-full border p-3 rounded mb-4 text-sm"
              placeholder="Nama wallet…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-3 py-2 border rounded"
              >
                Batal
              </button>
              <button
                className="px-4 py-2 bg-[#052A3D] text-white rounded"
                onClick={saveWallet}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
