// src/pages/Goals.jsx
import { useEffect, useState, useCallback } from "react";
import GoalForm from "../components/GoalForm";
import { supabase } from "../lib/supabaseClient";
import { GripVertical, MoreVertical, Pencil, Trash } from "lucide-react";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from "@dnd-kit/core";

import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  computeWalletBalance,
  computeETA,
  formatRupiah as formatRupiahUtil,
} from "../lib/goalUtils";

/* THEME */
const NAVY = "#052A3D";
const GOLD = "#E8C174";
const CARD_BG = "bg-gradient-to-br from-[#F7FAFC] to-[#EBF0F6]"; // Soft fintech blue

const formatRupiah = (n) => formatRupiahUtil(n);

/* ================================
   Sortable Card (Card asli hilang saat drag)
================================ */
function SortableGoalCard({ id, children }) {
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
    zIndex: isDragging ? 999 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="w-full"
      {...attributes}
      {...listeners}
    >
      {children()}
    </div>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const [activeGoal, setActiveGoal] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState(null);

  /* DRAG Sensors */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 90, tolerance: 10 },
    })
  );

  /* FETCH GOALS */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await supabase.auth.getUser())?.data?.user;
      if (!u) return;

      const [gRes, tRes] = await Promise.all([
        supabase
          .from("goals")
          .select("*")
          .eq("user_id", u.id)
          .order("order_index"),
        supabase.from("transactions").select("*").eq("user_id", u.id),
      ]);

      setGoals(gRes.data || []);
      setTxs(tRes.data || []);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll(); // removed auto refresh
  }, [fetchAll]);

  /* OPEN CREATE */
  const openCreate = () => {
    setEditing(null);
    setOpenForm(true);
  };

  /* OPEN EDIT */
  const openEdit = (g) => {
    setEditing(g);
    setOpenForm(true);
  };

  /* DELETE */
  const handleDelete = async (id) => {
    if (!confirm("Hapus goal?")) return;
    await supabase.from("goals").delete().eq("id", id);
    fetchAll();
  };

  /* DRAG START */
  const handleDragStart = (e) => {
    const goal = goals.find((g) => g.id === e.active.id);
    if (!goal) return;

    const saved = computeWalletBalance(txs, goal.wallet_id);
    const target = Number(goal.target_amount || 0);
    const progress =
      target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

    const { etaLabel } = computeETA({
      saved,
      target,
      savingAmount: Number(goal.saving_amount || 0),
      frequency: goal.saving_frequency || "weekly",
    });

    setActiveGoal({
      ...goal,
      saved,
      progress,
      eta: etaLabel,
    });
  };

  /* DRAG END */
  async function handleDragEnd(e) {
    const { active, over } = e;
    setActiveGoal(null);

    if (!over || active.id === over.id) return;

    const oldIndex = goals.findIndex((g) => g.id === active.id);
    const newIndex = goals.findIndex((g) => g.id === over.id);
    const arranged = arrayMove(goals, oldIndex, newIndex);
    setGoals(arranged);

    await Promise.all(
      arranged.map((g, i) =>
        supabase.from("goals").update({ order_index: i }).eq("id", g.id)
      )
    );
  }

  /* =============================
        UI Layout
  ============================= */
  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: NAVY }}>
            Goals
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Kelola, pantau & capai tujuan finansialmu ✨
          </p>
        </div>

        <button
          onClick={openCreate}
          className="px-5 py-2.5 rounded-xl text-white shadow-md"
          style={{ background: NAVY }}
        >
          + Tambah Goal
        </button>
      </div>

      {/* FORM MODAL */}
      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpenForm(false)}
          />
          <div className="relative w-full max-w-lg z-50">
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

      {loading ? (
        <div className="text-center text-slate-500">Memuat data...</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={goals.map((g) => g.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {goals.map((g) => {
                const saved = computeWalletBalance(txs, g.wallet_id);
                const target = Number(g.target_amount || 0);
                const progress =
                  target > 0
                    ? Math.min(100, Math.round((saved / target) * 100))
                    : 0;

                const { etaLabel } = computeETA({
                  saved,
                  target,
                  savingAmount: Number(g.saving_amount || 0),
                  frequency: g.saving_frequency || "weekly",
                });

                return (
                  <SortableGoalCard key={g.id} id={g.id}>
                    {() => (
                      <div
                        className={`relative rounded-2xl shadow-sm p-6 group h-[220px] flex flex-col justify-between 
                        ${CARD_BG} text-[#052A3D] hover:shadow-lg transition`}
                      >
                        {/* HANDLE */}
                        <div className="absolute left-3 top-3 opacity-40 group-hover:opacity-80 transition cursor-grab">
                          <GripVertical size={20} />
                        </div>

                        {/* MENU */}
                        <button
                          className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition p-1 hover:bg-black/5 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenId(menuOpenId === g.id ? null : g.id);
                          }}
                        >
                          <MoreVertical size={20} />
                        </button>

                        {/* DROPDOWN */}
                        {menuOpenId === g.id && (
                          <div className="absolute right-3 top-11 z-40 w-40 bg-white rounded-xl shadow-md border overflow-hidden">
                            {/* Edit */}
                            <button
                              onClick={() => {
                                openEdit(g);
                                setMenuOpenId(null);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-slate-100 text-left"
                            >
                              <Pencil size={14} />
                              <span>Edit</span>
                            </button>

                            <div className="border-t" />

                            {/* Delete */}
                            <button
                              onClick={() => {
                                setMenuOpenId(null);
                                handleDelete(g.id);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 text-left"
                            >
                              <Trash size={14} />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}

                        {/* CONTENT */}
                        <div>
                          <h3 className="text-lg font-bold truncate mb-1">
                            {g.name}
                          </h3>
                          <p className="text-xs text-slate-600 line-clamp-2">
                            {g.description}
                          </p>
                        </div>

                        {/* FOOTER */}
                        <div>
                          <div className="flex justify-between text-xs text-slate-600 mb-2">
                            <span>Saved</span>
                            <span>{progress}%</span>
                          </div>

                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-3">
                            <div
                              className="h-full rounded-full transition"
                              style={{
                                width: `${progress}%`,
                                background:
                                  progress >= 100
                                    ? "#16a34a"
                                    : progress >= 50
                                    ? GOLD
                                    : NAVY,
                              }}
                            />
                          </div>

                          <div className="flex justify-between text-xs text-slate-600">
                            <span>{formatRupiah(saved)}</span>
                            <span>ETA: {etaLabel || "-"}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </SortableGoalCard>
                );
              })}
            </div>
          </SortableContext>

          {/* DRAG OVERLAY */}
          <DragOverlay>
            {activeGoal && (
              <div
                className={`w-[280px] rounded-2xl shadow-xl p-6 h-[220px] 
                ${CARD_BG} border flex flex-col justify-between`}
              >
                <h3 className="text-lg font-bold truncate mb-1">
                  {activeGoal.name}
                </h3>
                <p className="text-xs text-slate-600">
                  {activeGoal.description}
                </p>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-2">
                    <span>Saved</span>
                    <span>{activeGoal.progress}%</span>
                  </div>

                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${activeGoal.progress}%`,
                        background:
                          activeGoal.progress >= 100
                            ? "#16a34a"
                            : activeGoal.progress >= 50
                            ? GOLD
                            : NAVY,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{formatRupiah(activeGoal.saved)}</span>
                    <span>ETA: {activeGoal.eta || "-"}</span>
                  </div>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
