// src/pages/Budget.jsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Pencil,
  Trash,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
} from "lucide-react";

// dnd-kit
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";

import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/* =========================
   Theme
   ========================= */
const NAVY = "#052A3D";
const GOLD = "#E8C174";

/* =========================
   Helpers
   ========================= */
function formatRupiah(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "Rp 0";
  return "Rp " + Number(n).toLocaleString("id-ID");
}
function parseDigits(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[^\d]/g, "");
}
function fmtInput(v) {
  if (v === undefined || v === null || v === "") return "";
  const digits = String(v).replace(/[^\d]/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

/* =========================
   Sortable Card (dnd-kit)
   - hide original card while dragging (opacity: 0)
   ========================= */
function SortableCard({ id, children }) {
  // id is like "income-123" or "expense-456"
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
    zIndex: isDragging ? 60 : undefined,
    opacity: isDragging ? 0 : 1, // <-- hide original card during drag
    pointerEvents: isDragging ? "none" : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="w-full"
    >
      {children}
    </div>
  );
}

/* =========================
   MenuActions component (three-dots menu)
   - full-width clickable rows
   ========================= */
function MenuActions({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="p-2 rounded hover:bg-slate-100"
        title="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-md z-40"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setOpen(false);
              onEdit && onEdit();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-3"
          >
            <Pencil size={14} />
            <span>Edit</span>
          </button>

          <button
            onClick={() => {
              setOpen(false);
              onDelete && onDelete();
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 text-red-600 flex items-center gap-3"
          >
            <Trash size={14} />
            <span>Hapus</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* =========================
   Component
   ========================= */
export default function Budget() {
  // data
  const [categories, setCategories] = useState([]); // both income & expense
  const [subcategories, setSubcategories] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSub, setEditingSub] = useState(null);
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState(null);

  // forms
  const [categoryForm, setCategoryForm] = useState({
    category: "",
    percent: "",
    amount: "",
    amountDisplay: "",
    type: "expense",
  });
  const [subForm, setSubForm] = useState({
    name: "",
    percent: "",
    amount: "",
    amountDisplay: "",
  });

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 80, tolerance: 8 },
    })
  );

  // overlay item for nicer lift effect
  const [activeId, setActiveId] = useState(null);
  const [activeItem, setActiveItem] = useState(null); // full item object

  /* -------------- load ---------------- */
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchSubcategories()]);
    setLoading(false);
  }, []);

  async function fetchCategories() {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user) return;
      const { data, error } = await supabase
        .from("budget_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      // normalize
      setCategories(
        (data || []).map((c) => ({ ...c, type: c.type || "expense" }))
      );
    } catch (err) {
      console.error("fetchCategories", err);
      setCategories([]);
    }
  }

  async function fetchSubcategories() {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user) return;
      const { data, error } = await supabase
        .from("budget_subcategories")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSubcategories(data || []);
    } catch (err) {
      console.error("fetchSubcategories", err);
      setSubcategories([]);
    }
  }

  /* -------------- derived ---------------- */
  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  const totalIncome = incomeCategories.reduce(
    (s, c) => s + Number(c.amount || 0),
    0
  );

  function calcAllocated(cat) {
    if (!cat) return 0;
    if (cat.percent || cat.percent === 0)
      return Math.round((Number(cat.percent) / 100) * totalIncome);
    return Number(cat.amount || 0);
  }

  function calcAllocatedSub(sub, parentAllocated) {
    if (!sub) return 0;
    if (sub.percent || sub.percent === 0)
      return Math.round((Number(sub.percent) / 100) * parentAllocated);
    return Number(sub.amount || 0);
  }

  const totalExpenseAllocated = expenseCategories.reduce(
    (s, c) => s + calcAllocated(c),
    0
  );
  const usedPercent =
    totalIncome > 0
      ? Math.min(Math.round((totalExpenseAllocated / totalIncome) * 100), 100)
      : 0;
  const remainingIncome = Math.max(0, totalIncome - totalExpenseAllocated);

  /* -------------- DnD-kit handlers ---------------- */
  function parseId(fullId) {
    // fullId format "income-<id>" or "expense-<id>"
    if (!fullId) return { group: null, id: null };
    const idx = String(fullId).indexOf("-");
    if (idx === -1) return { group: null, id: fullId };
    const group = String(fullId).slice(0, idx);
    const id = String(fullId).slice(idx + 1);
    return { group, id };
  }

  async function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    setActiveItem(null);
    if (!over) return;

    const a = parseId(active.id);
    const b = parseId(over.id);

    // require same group
    if (a.group !== b.group) return;

    const group = a.group; // "income" or "expense"
    const list =
      group === "income" ? [...incomeCategories] : [...expenseCategories];

    const oldIndex = list.findIndex((it) => String(it.id) === a.id);
    const newIndex = list.findIndex((it) => String(it.id) === b.id);
    if (oldIndex === -1 || newIndex === -1) return;
    if (oldIndex === newIndex) return;

    const moved = arrayMove(list, oldIndex, newIndex);

    // update local categories: assign order_index within its group
    const updatedGroup = moved.map((it, idx) => ({ ...it, order_index: idx }));
    const otherGroup =
      group === "income" ? expenseCategories : incomeCategories;

    const merged =
      group === "income"
        ? [...updatedGroup, ...otherGroup]
        : [...otherGroup, ...updatedGroup];
    // normalize merged by order_index (if all set)
    const normalized = merged
      .slice()
      .sort((x, y) => (x.order_index ?? 0) - (y.order_index ?? 0));

    setCategories(normalized);

    // persist only updatedGroup
    try {
      await Promise.all(
        updatedGroup.map((it) =>
          supabase
            .from("budget_categories")
            .update({ order_index: it.order_index })
            .eq("id", it.id)
        )
      );
    } catch (err) {
      console.error("save order failed", err);
    }
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
    // find full item and set as activeItem for overlay
    const parsed = parseId(event.active.id);
    const group = parsed.group;
    const id = parsed.id;
    const list = group === "income" ? incomeCategories : expenseCategories;
    const found = list.find((it) => String(it.id) === String(id));
    setActiveItem(found || null);
  }

  /* -------------- modal open/close & operations ---------------- */
  function openAddCategory(type = "expense") {
    setEditingCategory(null);
    setCategoryForm({
      category: "",
      percent: "",
      amount: "",
      amountDisplay: "",
      type,
    });
    setShowCategoryModal(true);
  }
  function openEditCategory(cat) {
    setEditingCategory(cat);
    setCategoryForm({
      category: cat.category || "",
      percent: cat.percent ?? "",
      amount: cat.amount ?? "",
      amountDisplay:
        cat.amount || cat.amount === 0 ? fmtInput(String(cat.amount)) : "",
      type: cat.type || "expense",
    });
    setShowCategoryModal(true);
  }

  function openAddSubcategoryFor(cat) {
    setSelectedCategoryForSub(cat);
    setEditingSub(null);
    setSubForm({ name: "", percent: "", amount: "", amountDisplay: "" });
    setShowSubModal(true);
  }
  function openEditSubcategory(sub) {
    const parent = categories.find((c) => c.id === sub.category_id) || null;
    setSelectedCategoryForSub(parent);
    setEditingSub(sub);
    setSubForm({
      name: sub.name || "",
      percent: sub.percent ?? "",
      amount: sub.amount ?? "",
      amountDisplay:
        sub.amount || sub.amount === 0 ? fmtInput(String(sub.amount)) : "",
    });
    setShowSubModal(true);
  }

  async function saveCategory() {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user) return alert("User belum login");
      const prepared = {
        category: (categoryForm.category || "").trim(),
        percent:
          categoryForm.percent !== "" ? Number(categoryForm.percent) : null,
        amount: categoryForm.amount !== "" ? Number(categoryForm.amount) : null,
        type: categoryForm.type || "expense",
        user_id: user.id,
      };
      if (!prepared.category) return alert("Nama kategori wajib diisi");

      if (!editingCategory) {
        // determine next order_index within group
        const group = prepared.type;
        const groupItems = categories.filter((c) => c.type === group);
        prepared.order_index = groupItems.length;
        const { error } = await supabase
          .from("budget_categories")
          .insert(prepared);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("budget_categories")
          .update(prepared)
          .eq("id", editingCategory.id);
        if (error) throw error;
      }
      setShowCategoryModal(false);
      await loadAll();
    } catch (err) {
      console.error("saveCategory", err);
      alert("Gagal menyimpan kategori");
    }
  }

  async function saveSubcategory() {
    try {
      const user = (await supabase.auth.getUser())?.data?.user;
      if (!user) return alert("User belum login");
      if (!selectedCategoryForSub)
        return alert("Pilih kategori terlebih dahulu");
      if (!subForm.name || !String(subForm.name).trim())
        return alert("Nama jenis wajib diisi");

      const prepared = {
        name: subForm.name.trim(),
        percent: subForm.percent !== "" ? Number(subForm.percent) : null,
        amount: subForm.amount !== "" ? Number(subForm.amount) : null,
        category_id: selectedCategoryForSub.id,
        user_id: user.id,
      };

      if (!editingSub) {
        const { error } = await supabase
          .from("budget_subcategories")
          .insert(prepared);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("budget_subcategories")
          .update(prepared)
          .eq("id", editingSub.id);
        if (error) throw error;
      }

      setShowSubModal(false);
      await loadAll();
    } catch (err) {
      console.error("saveSubcategory", err);
      alert("Gagal menyimpan jenis");
    }
  }

  async function deleteCategory(id) {
    if (!confirm("Hapus kategori?")) return;
    try {
      await supabase
        .from("budget_subcategories")
        .delete()
        .eq("category_id", id);
      await supabase.from("budget_categories").delete().eq("id", id);
      await loadAll();
    } catch (err) {
      console.error("deleteCategory", err);
      alert("Gagal menghapus kategori");
    }
  }

  async function deleteSub(id) {
    if (!confirm("Hapus jenis?")) return;
    try {
      await supabase.from("budget_subcategories").delete().eq("id", id);
      await loadAll();
    } catch (err) {
      console.error("deleteSub", err);
      alert("Gagal menghapus jenis");
    }
  }

  /* =========================
     Render
     ========================= */

  /* Helper: render overlay card (full card) */
  function renderOverlayCard() {
    if (!activeItem) return null;
    const parsed = parseId(activeId);
    const type = parsed.group;
    const allocated = type === "expense" ? calcAllocated(activeItem) : null;
    const subsForActive = subcategories.filter(
      (s) => s.category_id === activeItem.id
    );
    const subSum = allocated
      ? subsForActive.reduce((s, x) => s + calcAllocatedSub(x, allocated), 0)
      : 0;
    const remainingForCat = allocated ? Math.max(0, allocated - subSum) : 0;
    const pct = allocated
      ? Math.min(Math.round((subSum / allocated) * 100), 100)
      : 0;
    const isExpense = type === "expense";

    // Overlay card style + scale animation
    return (
      <div
        className="w-96 bg-white border rounded-xl p-5 shadow-2xl"
        style={{
          transform: "scale(1.03)",
          transition:
            "transform 180ms cubic-bezier(.2,.9,.2,1), box-shadow 180ms",
          boxShadow:
            "0 10px 30px rgba(2,6,23,0.15), 0 4px 10px rgba(2,6,23,0.06)",
        }}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-semibold text-base" style={{ color: NAVY }}>
              {activeItem.category}
            </div>
            <div className="text-xs text-slate-500">
              {isExpense
                ? `Alokasi: ${formatRupiah(allocated)}`
                : "Income Category"}
            </div>
          </div>

          <div className="text-sm font-semibold" style={{ color: NAVY }}>
            {isExpense ? `${pct}%` : formatRupiah(activeItem.amount)}
          </div>
        </div>

        {isExpense ? (
          <>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${NAVY} 0%, ${GOLD} 100%)`,
                }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-500 mb-3">
              <div>Terpakai: {formatRupiah(subSum)}</div>
              <div>Sisa: {formatRupiah(remainingForCat)}</div>
            </div>

            <div className="space-y-2 max-h-36 overflow-auto pr-1">
              {subsForActive.length === 0 ? (
                <div className="text-xs text-slate-500">Belum ada jenis</div>
              ) : (
                subsForActive.map((s) => {
                  const val = calcAllocatedSub(s, allocated);
                  return (
                    <div
                      key={s.id}
                      className="bg-slate-50 p-3 rounded-lg flex justify-between items-center"
                    >
                      <div>
                        <div className="text-sm" style={{ color: NAVY }}>
                          {s.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.percent ? `${s.percent}%` : ""} •{" "}
                          {formatRupiah(val)}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatRupiah(val)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="mt-3">
            <div
              className="text-lg font-bold tracking-tight"
              style={{ color: NAVY }}
            >
              {formatRupiah(activeItem.amount)}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Income category details
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-[#F3F7FA]">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: NAVY }}>
              Budget Planner
            </h1>
            <p className="text-sm text-slate-500">
              Modern bank-style budget view
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg text-white flex items-center gap-2"
                style={{ background: NAVY }}
                type="button"
                onClick={() => openAddCategory("income")}
              >
                <ArrowUpRight size={16} /> Income
              </button>

              <button
                className="px-3 py-2 rounded-lg flex items-center gap-2"
                style={{ background: GOLD, color: NAVY }}
                type="button"
                onClick={() => openAddCategory("expense")}
              >
                <ArrowDownRight size={16} /> Expense
              </button>
            </div>
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Income */}
          <section className="mb-8">
            <div className="bg-white rounded-2xl border shadow-md px-6 py-4 mb-4">
              <div className="text-xs text-slate-500">Total Income</div>

              <div className="flex items-end justify-between mt-1">
                <div
                  className="text-3xl font-bold tracking-tight"
                  style={{ color: NAVY }}
                >
                  {formatRupiah(totalIncome)}
                </div>

                <div className="text-right">
                  <div className="text-xs text-slate-500">Remaining</div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: GOLD }}
                  >
                    {formatRupiah(remainingIncome)}
                  </div>
                </div>
              </div>
            </div>

            <SortableContext
              items={incomeCategories.map((c) => `income-${c.id}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {incomeCategories.map((c) => (
                  <SortableCard key={`income-${c.id}`} id={`income-${c.id}`}>
                    <div
                      className="
                        bg-white 
                        border 
                        rounded-xl 
                        p-5 
                        shadow-sm 
                        flex flex-col 
                        justify-between 
                        h-full 
                        transition-all 
                        hover:shadow-md
                      "
                      role="group"
                    >
                      {/* TOP SECTION */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div
                              className="font-semibold text-base"
                              style={{ color: NAVY }}
                            >
                              {c.category}
                            </div>
                            <div className="text-xs text-slate-500 leading-tight">
                              Income Category
                            </div>
                          </div>
                        </div>

                        {/* ACTION MENU */}
                        <div>
                          <MenuActions
                            onEdit={() => openEditCategory(c)}
                            onDelete={() => deleteCategory(c.id)}
                          />
                        </div>
                      </div>

                      {/* AMOUNT */}
                      <div className="mt-auto">
                        <div
                          className="text-lg font-bold tracking-tight"
                          style={{ color: NAVY }}
                        >
                          {formatRupiah(c.amount)}
                        </div>
                      </div>
                    </div>
                  </SortableCard>
                ))}
              </div>
            </SortableContext>
          </section>

          {/* Expense */}
          <section>
            <div className="mb-3">
              <h2
                className="text-lg font-semibold mb-2"
                style={{ color: NAVY }}
              >
                Expense
              </h2>

              {/* total expense summary box */}
              <div className="w-full mb-4">
                <div className="bg-white border rounded-xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-slate-600">Total Expense</div>
                    <div
                      className="text-sm font-semibold"
                      style={{ color: NAVY }}
                    >
                      {usedPercent}% dari Income
                    </div>
                  </div>

                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full"
                      style={{
                        width: `${usedPercent}%`,
                        background: `linear-gradient(90deg, ${NAVY} 0%, ${GOLD} 100%)`,
                      }}
                    />
                  </div>

                  <div className="text-xs text-slate-500 mt-2">
                    Income: <strong>{formatRupiah(totalIncome)}</strong> •
                    Expense:{" "}
                    <strong>{formatRupiah(totalExpenseAllocated)}</strong> •
                    Sisa: <strong>{formatRupiah(remainingIncome)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <SortableContext
              items={expenseCategories.map((c) => `expense-${c.id}`)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {expenseCategories.map((c) => {
                  const allocated = calcAllocated(c);
                  const subs = subcategories.filter(
                    (s) => s.category_id === c.id
                  );
                  const subSum = subs.reduce(
                    (s, x) => s + calcAllocatedSub(x, allocated),
                    0
                  );
                  const remainingForCat = Math.max(0, allocated - subSum);
                  const pct =
                    allocated > 0
                      ? Math.min(Math.round((subSum / allocated) * 100), 100)
                      : 0;

                  return (
                    <SortableCard
                      key={`expense-${c.id}`}
                      id={`expense-${c.id}`}
                    >
                      <div className="bg-white border rounded-xl p-5 shadow-sm flex flex-col h-full">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div
                              className="font-semibold"
                              style={{ color: NAVY }}
                            >
                              {c.category}
                            </div>
                            <div className="text-xs text-slate-500">
                              Alokasi: {formatRupiah(allocated)}
                            </div>
                          </div>

                          <div>
                            <MenuActions
                              onEdit={() => openEditCategory(c)}
                              onDelete={() => deleteCategory(c.id)}
                            />
                          </div>
                        </div>

                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                          <div
                            className="h-full"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${NAVY} 0%, ${GOLD} 100%)`,
                            }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-500 mb-3">
                          <div>Terpakai: {formatRupiah(subSum)}</div>
                          <div>
                            Sisa Alokasi: {formatRupiah(remainingForCat)}
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            className="text-xs text-[#052A3D]"
                            onClick={() => openAddSubcategoryFor(c)}
                          >
                            + Tambah jenis
                          </button>

                          <div className="mt-3 space-y-2">
                            {subs.map((s) => {
                              const val = calcAllocatedSub(s, allocated);
                              return (
                                <div
                                  key={s.id}
                                  className="bg-slate-50 p-3 rounded-lg flex justify-between items-center"
                                >
                                  <div>
                                    <div
                                      className="text-sm"
                                      style={{ color: NAVY }}
                                    >
                                      {s.name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {s.percent ? `${s.percent}%` : ""} •{" "}
                                      {formatRupiah(val)}
                                    </div>
                                  </div>

                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      className="text-xs text-slate-500"
                                      onClick={() => openEditSubcategory(s)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="text-xs text-red-500"
                                      onClick={() => deleteSub(s.id)}
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </SortableCard>
                  );
                })}
              </div>
            </SortableContext>
          </section>

          {/* Drag overlay for lifted card */}
          <DragOverlay
            dropAnimation={{
              duration: 180,
              easing: "cubic-bezier(.2,.9,.2,1)",
            }}
          >
            {activeItem ? renderOverlayCard() : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* ===================== Category Modal ===================== */}
      {showCategoryModal && (
        <Modal onClose={() => setShowCategoryModal(false)}>
          <form
            className="max-w-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();

              setCategoryForm((prev) => ({
                ...prev,
                amount: prev.amount !== "" ? Number(prev.amount) : "",
                percent: prev.percent !== "" ? Number(prev.percent) : "",
              }));

              await saveCategory();
            }}
          >
            <h3 className="text-lg font-semibold mb-3">
              {editingCategory
                ? "Edit Kategori"
                : `Tambah Kategori (${categoryForm.type})`}
            </h3>

            <label className="text-sm">Nama kategori</label>
            <input
              className="w-full p-2 border rounded mt-1 mb-3"
              value={categoryForm.category}
              onChange={(e) =>
                setCategoryForm({ ...categoryForm, category: e.target.value })
              }
              autoFocus
            />

            {categoryForm.type === "expense" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                <div>
                  <label className="text-sm">Persentase (%)</label>
                  <input
                    className="w-full p-2 border rounded mt-1"
                    type="number"
                    min="0"
                    max="100"
                    value={categoryForm.percent}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        percent: e.target.value,
                        amount: "",
                        amountDisplay: "",
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm">Nominal (Rp)</label>
                  <input
                    className="w-full p-2 border rounded mt-1"
                    value={categoryForm.amountDisplay}
                    onChange={(e) => {
                      const d = parseDigits(e.target.value);
                      setCategoryForm({
                        ...categoryForm,
                        amount: d,
                        amountDisplay: fmtInput(d),
                        percent: "",
                      });
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                <label className="text-sm">Nominal (Rp)</label>
                <input
                  className="w-full p-2 border rounded mt-1 mb-3"
                  value={categoryForm.amountDisplay}
                  onChange={(e) => {
                    const d = parseDigits(e.target.value);
                    setCategoryForm({
                      ...categoryForm,
                      amount: d,
                      amountDisplay: fmtInput(d),
                    });
                  }}
                />
              </>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="px-4 py-2 border rounded"
                onClick={() => setShowCategoryModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded text-white"
                style={{ background: NAVY }}
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ===================== Sub Modal ===================== */}
      {showSubModal && (
        <Modal onClose={() => setShowSubModal(false)}>
          <form
            className="max-w-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();

              setSubForm((prev) => ({
                ...prev,
                amount: prev.amount !== "" ? Number(prev.amount) : "",
                percent: prev.percent !== "" ? Number(prev.percent) : "",
              }));

              await saveSubcategory();
            }}
          >
            <h3 className="text-lg font-semibold mb-3">
              {editingSub
                ? "Edit Jenis"
                : `Tambah Jenis untuk ${
                    selectedCategoryForSub?.category || ""
                  }`}
            </h3>

            <label className="text-sm">Nama jenis</label>
            <input
              className="w-full p-2 border rounded mt-1 mb-3"
              value={subForm.name}
              onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Persentase (%)</label>
                <input
                  className="w-full p-2 border rounded mt-1"
                  type="number"
                  min="0"
                  max="100"
                  value={subForm.percent}
                  onChange={(e) =>
                    setSubForm({
                      ...subForm,
                      percent: e.target.value,
                      amount: "",
                      amountDisplay: "",
                    })
                  }
                />
              </div>

              <div>
                <label className="text-sm">Nominal (Rp)</label>
                <input
                  className="w-full p-2 border rounded mt-1"
                  value={subForm.amountDisplay}
                  onChange={(e) => {
                    const d = parseDigits(e.target.value);
                    setSubForm({
                      ...subForm,
                      amount: d,
                      amountDisplay: fmtInput(d),
                      percent: "",
                    });
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                className="px-4 py-2 border rounded"
                onClick={() => setShowSubModal(false)}
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded text-white"
                style={{ background: NAVY }}
              >
                Simpan
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

/* =========================
   Modal component (fixed)
   ========================= */
function Modal({ children, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* content */}
      <div className="relative w-full max-w-xl">
        <div
          className="bg-white rounded-xl shadow-xl p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>

        {/* close btn */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-white rounded-full p-1 shadow border"
          type="button"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
