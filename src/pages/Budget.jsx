// src/pages/Budget.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Pencil,
  Trash,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
} from "lucide-react";

/**
 * Budget.jsx - single-file, production-ready
 *
 * Features:
 * - Global budget (no month): income categories define total income.
 * - Expense categories allocate by percent (of total income) OR amount.
 * - Subcategories (expense-only) allocate by percent (of parent) OR amount.
 * - Validations: total allocations can't exceed income; sub allocations can't
 *   exceed parent's allocation.
 * - All CRUD operations for categories & subcategories.
 * - UI: modals for add/edit, auto-format number inputs, "FULL" red indicator
 *   when a category's subcategories already consume the full allocation.
 *
 * Notes:
 * - Assumes tables: budget_categories, budget_subcategories exist with fields
 *   used here (user_id, category, percent, amount, type, etc).
 * - Uses supabase.auth.getUser() to determine current user.
 */

/* -------------------------
   Utils: formatting/parsing
   ------------------------- */
function formatRupiah(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "-";
  return "Rp " + Number(n).toLocaleString("id-ID");
}
function formatNumberForInput(rawDigits) {
  if (!rawDigits && rawDigits !== 0) return "";
  const digits = String(rawDigits).replace(/[^\d]/g, "");
  if (digits === "") return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}
function parseInputToDigits(displayOrRaw) {
  if (
    displayOrRaw === "" ||
    displayOrRaw === null ||
    displayOrRaw === undefined
  )
    return "";
  return String(displayOrRaw).replace(/[^\d]/g, "");
}

/* -------------------------
   Component
   ------------------------- */
export default function Budget() {
  const [loading, setLoading] = useState(false);

  // data
  const [categories, setCategories] = useState([]); // { id, category, percent, amount, type }
  const [subcategories, setSubcategories] = useState([]); // { id, category_id, name, percent, amount }

  // category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({
    category: "",
    percent: "",
    amount: "",
    amountDisplay: "",
    type: "expense",
  });

  // sub modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState(null);
  const [subForm, setSubForm] = useState({
    name: "",
    percent: "",
    amount: "",
    amountDisplay: "",
  });

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchSubcategories()]);
    setLoading(false);
  }

  async function fetchCategories() {
    try {
      const r = await supabase.auth.getUser();
      const user = r?.data?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from("budget_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const normalized = (data || []).map((d) => ({
        ...d,
        type: d.type || "expense",
      }));
      setCategories(normalized);
    } catch (err) {
      console.error("fetchCategories", err);
      setCategories([]);
    }
  }

  async function fetchSubcategories() {
    try {
      const r = await supabase.auth.getUser();
      const user = r?.data?.user;
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

  /* -------------------------
     Derived values
     ------------------------- */
  const incomeCategories = categories.filter(
    (c) => (c.type || "expense") === "income"
  );
  const expenseCategories = categories.filter(
    (c) => (c.type || "expense") === "expense"
  );

  const totalIncome = incomeCategories.reduce(
    (s, c) => s + Number(c.amount || 0),
    0
  );

  function computeAllocatedForExpense(cat) {
    if (!cat) return 0;
    if (
      cat.percent !== null &&
      cat.percent !== undefined &&
      cat.percent !== ""
    ) {
      return Math.round((Number(cat.percent) / 100) * Number(totalIncome || 0));
    }
    if (cat.amount !== null && cat.amount !== undefined && cat.amount !== "") {
      return Number(cat.amount || 0);
    }
    return 0;
  }

  function computeAllocatedForSub(sub, parentAllocated) {
    if (!sub) return 0;
    if (
      sub.percent !== null &&
      sub.percent !== undefined &&
      sub.percent !== ""
    ) {
      return Math.round(
        (Number(sub.percent) / 100) * Number(parentAllocated || 0)
      );
    }
    if (sub.amount !== null && sub.amount !== undefined && sub.amount !== "") {
      return Number(sub.amount || 0);
    }
    return 0;
  }

  function sumSubAllocationsForCategory(categoryId) {
    const parentAllocated =
      computeAllocatedForExpense(categories.find((c) => c.id === categoryId)) ||
      0;
    return subcategories
      .filter((s) => s.category_id === categoryId)
      .reduce((s, x) => s + computeAllocatedForSub(x, parentAllocated), 0);
  }

  /* -------------------------
     Category CRUD
     ------------------------- */
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
        cat.amount || cat.amount === 0
          ? formatNumberForInput(String(cat.amount))
          : "",
      type: cat.type || "expense",
    });
    setShowCategoryModal(true);
  }

  async function handleDeleteCategory(id) {
    if (
      !confirm(
        "Hapus kategori? Semua jenis (subcategory) terkait juga akan dihapus."
      )
    )
      return;
    try {
      // delete subcategories first
      const { error: e1 } = await supabase
        .from("budget_subcategories")
        .delete()
        .eq("category_id", id);
      if (e1) throw e1;
      const { error } = await supabase
        .from("budget_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchCategories();
      await fetchSubcategories();
    } catch (err) {
      console.error("delete category err", err);
      alert("Gagal menghapus kategori");
    }
  }

  async function handleCategorySubmit(e) {
    e?.preventDefault?.();
    try {
      const r = await supabase.auth.getUser();
      const user = r?.data?.user;
      if (!user) return alert("User belum login");
      if (!categoryForm.category || !categoryForm.type)
        return alert("Isi nama dan tipe kategori");

      // validations
      if (categoryForm.type === "income") {
        if (categoryForm.amount === "" || Number(categoryForm.amount) <= 0) {
          return alert("Untuk kategori income, masukkan nominal (amount).");
        }
      } else {
        // expense: require percent or amount
        if (
          (categoryForm.percent === "" || categoryForm.percent === null) &&
          (categoryForm.amount === "" || categoryForm.amount === null)
        ) {
          return alert("Untuk kategori expense, isi persentase atau nominal.");
        }
      }

      const payload = {
        category: categoryForm.category.trim(),
        percent:
          categoryForm.percent !== "" ? Number(categoryForm.percent) : null,
        amount: categoryForm.amount !== "" ? Number(categoryForm.amount) : null,
        type: categoryForm.type,
      };

      // ensure expense allocations don't exceed income
      if (payload.type === "expense" && totalIncome > 0) {
        const existingAllocated = expenseCategories
          .filter((c) => (editingCategory ? c.id !== editingCategory.id : true))
          .reduce((s, c) => s + computeAllocatedForExpense(c), 0);
        const proposedAllocated = computeAllocatedForExpense(payload);
        if (existingAllocated + proposedAllocated > totalIncome) {
          return alert(
            `Total alokasi melebihi total income (${formatRupiah(
              existingAllocated + proposedAllocated
            )} > ${formatRupiah(totalIncome)}).`
          );
        }
      }

      if (editingCategory) {
        const { error } = await supabase
          .from("budget_categories")
          .update({
            category: payload.category,
            percent: payload.percent,
            amount: payload.amount,
            type: payload.type,
          })
          .eq("id", editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_categories").insert({
          user_id: user.id,
          ...payload,
        });
        if (error) throw error;
      }

      setShowCategoryModal(false);
      setEditingCategory(null);
      await fetchCategories();
      await fetchSubcategories();
    } catch (err) {
      console.error("save category err", err);
      alert("Gagal menyimpan kategori: " + (err?.message || err));
    }
  }

  /* -------------------------
     Subcategory CRUD
     ------------------------- */
  function openAddSubcategoryFor(cat) {
    setSelectedCategoryForSub(cat);
    setEditingSub(null);
    setSubForm({ name: "", percent: "", amount: "", amountDisplay: "" });
    setShowSubModal(true);
  }

  function openEditSubcategory(sub) {
    const parent = categories.find((c) => c.id === sub.category_id);
    setSelectedCategoryForSub(parent || null);
    setEditingSub(sub);
    setSubForm({
      name: sub.name || "",
      percent: sub.percent ?? "",
      amount: sub.amount ?? "",
      amountDisplay:
        sub.amount || sub.amount === 0
          ? formatNumberForInput(String(sub.amount))
          : "",
    });
    setShowSubModal(true);
  }

  async function deleteSubcategory(id) {
    if (!confirm("Hapus jenis?")) return;
    try {
      const { error } = await supabase
        .from("budget_subcategories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      await fetchSubcategories();
    } catch (err) {
      console.error("delete sub err", err);
      alert("Gagal menghapus jenis");
    }
  }

  async function handleSaveSubcategory(e) {
    e?.preventDefault?.();
    try {
      const r = await supabase.auth.getUser();
      const user = r?.data?.user;
      if (!user) return alert("User belum login");
      if (!selectedCategoryForSub)
        return alert("Pilih kategori parent terlebih dahulu");
      if (!subForm.name || !subForm.name.trim()) return alert("Isi nama jenis");

      if (
        (subForm.percent === "" || subForm.percent === null) &&
        (subForm.amount === "" || subForm.amount === null)
      ) {
        return alert("Untuk jenis: isi persentase atau nominal.");
      }

      const parentAllocated = computeAllocatedForExpense(
        selectedCategoryForSub
      );

      const newSubAmount =
        subForm.percent !== "" && subForm.percent !== null
          ? Math.round((Number(subForm.percent) / 100) * parentAllocated)
          : Number(subForm.amount || 0);

      // existing sum excluding the editing one
      const existingSubs = subcategories.filter(
        (s) =>
          s.category_id === selectedCategoryForSub.id &&
          (!editingSub || s.id !== editingSub.id)
      );
      const existingSum = existingSubs.reduce(
        (s, x) => s + computeAllocatedForSub(x, parentAllocated),
        0
      );

      if (existingSum + newSubAmount > parentAllocated) {
        return alert(
          `Total semua jenis melebihi alokasi kategori (${formatRupiah(
            existingSum + newSubAmount
          )} > ${formatRupiah(parentAllocated)}).`
        );
      }

      if (editingSub) {
        const { error } = await supabase
          .from("budget_subcategories")
          .update({
            name: subForm.name.trim(),
            percent: subForm.percent !== "" ? Number(subForm.percent) : null,
            amount: subForm.amount !== "" ? Number(subForm.amount) : null,
          })
          .eq("id", editingSub.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_subcategories").insert({
          user_id: user.id,
          category_id: selectedCategoryForSub.id,
          name: subForm.name.trim(),
          percent: subForm.percent !== "" ? Number(subForm.percent) : null,
          amount: subForm.amount !== "" ? Number(subForm.amount) : null,
        });
        if (error) throw error;
      }

      setShowSubModal(false);
      setEditingSub(null);
      setSelectedCategoryForSub(null);
      setSubForm({ name: "", percent: "", amount: "", amountDisplay: "" });
      await fetchSubcategories();
    } catch (err) {
      console.error("save sub err", err);
      alert("Gagal menyimpan jenis: " + (err?.message || err));
    }
  }

  /* -------------------------
     UI Helpers: remaining calculations for modal previews
     ------------------------- */
  const existingExpenseAllocated = expenseCategories.reduce(
    (s, c) => s + computeAllocatedForExpense(c),
    0
  );
  const remainingIncomeForExpenses = Math.max(
    0,
    totalIncome - existingExpenseAllocated
  );

  const calcRemainingIfCategory = () => {
    const existing = expenseCategories
      .filter((c) => (editingCategory ? c.id !== editingCategory.id : true))
      .reduce((s, c) => s + computeAllocatedForExpense(c), 0);
    const leftover = Math.max(0, totalIncome - existing);
    return leftover;
  };

  const parentAllocatedLive = selectedCategoryForSub
    ? computeAllocatedForExpense(selectedCategoryForSub)
    : 0;
  const existingSubsSumLive = selectedCategoryForSub
    ? subcategories
        .filter(
          (s) =>
            s.category_id === selectedCategoryForSub.id &&
            (!editingSub || s.id !== editingSub.id)
        )
        .reduce((s, x) => s + computeAllocatedForSub(x, parentAllocatedLive), 0)
    : 0;
  const remainingForSubsLive = Math.max(
    0,
    parentAllocatedLive - existingSubsSumLive
  );

  /* -------------------------
     Render
     ------------------------- */
  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <header className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Budget</h1>
              <p className="text-sm text-slate-500">
                Pengaturan budgeting global — income berasal dari kategori
                income.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-sm text-slate-500 text-right">
                <div className="text-xs">Total Income</div>
                <div className="font-medium text-lg">
                  {formatRupiah(totalIncome)}
                </div>
              </div>
            </div>
          </header>

          {/* Controls */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-slate-800">Kategori</h2>
            <div className="flex gap-2">
              <button
                onClick={() => openAddCategory("income")}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded shadow-sm text-indigo-700"
              >
                <ArrowUpRight /> Tambah Income
              </button>

              <button
                onClick={() => openAddCategory("expense")}
                className="inline-flex items-center gap-2 px-3 py-2 bg-white border rounded shadow-sm text-red-600"
              >
                <ArrowDownRight /> Tambah Expense
              </button>
            </div>
          </div>

          {/* Income */}
          <section className="mb-8">
            <h3 className="text-sm font-semibold text-indigo-700 mb-3">
              Income Categories
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {incomeCategories.length === 0 ? (
                <div className="col-span-full bg-white p-4 rounded border text-slate-600">
                  Belum ada kategori income.
                </div>
              ) : (
                incomeCategories.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-lg p-4 shadow-sm border flex justify-between items-center"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {c.category}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Income category
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm text-slate-500">Nominal</div>
                        <div className="font-semibold">
                          {formatRupiah(c.amount || 0)}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => openEditCategory(c)}
                          className="p-2 rounded bg-indigo-500 text-white"
                        >
                          <Pencil />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(c.id)}
                          className="p-2 rounded bg-red-500 text-white"
                        >
                          <Trash />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Expense */}
          <section>
            <h3 className="text-sm font-semibold text-red-600 mb-3">
              Expense Categories
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {expenseCategories.length === 0 ? (
                <div className="col-span-full bg-white p-6 rounded-lg border shadow text-slate-600">
                  Belum ada kategori expense.
                </div>
              ) : (
                expenseCategories.map((c) => {
                  const allocated = computeAllocatedForExpense(c);
                  const subs = subcategories.filter(
                    (s) => s.category_id === c.id
                  );
                  const subSum = subs.reduce(
                    (s, x) => s + computeAllocatedForSub(x, allocated),
                    0
                  );

                  const percentVal =
                    c.percent !== null &&
                    c.percent !== undefined &&
                    c.percent !== ""
                      ? Number(c.percent)
                      : allocated && totalIncome
                      ? Math.round((allocated / totalIncome) * 100)
                      : null;

                  const isFull = allocated > 0 && subSum >= allocated;

                  return (
                    <article
                      key={c.id}
                      className="bg-white rounded-lg p-4 shadow-sm border"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-800">
                              {c.category}
                            </div>
                            {isFull ? (
                              <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                FULL
                              </div>
                            ) : (
                              <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                                OK
                              </div>
                            )}
                          </div>

                          <div className="text-xs text-slate-400 mt-1">
                            {percentVal !== null ? `${percentVal}%` : ""}{" "}
                            {allocated ? `• ${formatRupiah(allocated)}` : ""}
                          </div>

                          <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                            <div
                              style={{
                                width: `${Math.min(
                                  allocated && totalIncome
                                    ? Math.round(
                                        (allocated / (totalIncome || 1)) * 100
                                      )
                                    : 0,
                                  100
                                )}%`,
                              }}
                              className="h-2 bg-gradient-to-r from-red-400 to-rose-600"
                            />
                          </div>

                          <div className="text-xs text-slate-400 mt-2">
                            Alokasi kategori: {formatRupiah(allocated)} • Jumlah
                            jenis: {formatRupiah(subSum)}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEditCategory(c)}
                              className="p-2 rounded bg-yellow-400 text-white"
                            >
                              <Pencil />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(c.id)}
                              className="p-2 rounded bg-red-500 text-white"
                            >
                              <Trash />
                            </button>
                          </div>

                          <button
                            onClick={() => openAddSubcategoryFor(c)}
                            className="text-xs text-slate-500"
                          >
                            + Tambah jenis
                          </button>
                        </div>
                      </div>

                      {/* Subcategories */}
                      <div className="mt-4 space-y-3">
                        {subs.length === 0 ? (
                          <div className="text-xs text-slate-400">
                            Belum ada jenis.
                          </div>
                        ) : (
                          subs.map((s) => {
                            const subAllocated = computeAllocatedForSub(
                              s,
                              allocated
                            );
                            const percentText =
                              s.percent !== null &&
                              s.percent !== undefined &&
                              s.percent !== ""
                                ? `${s.percent}%`
                                : "";
                            return (
                              <div
                                key={s.id}
                                className="flex items-center justify-between bg-gray-50 rounded p-3"
                              >
                                <div>
                                  <div className="text-sm text-slate-700">
                                    {s.name}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {percentText} • {formatRupiah(subAllocated)}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-sm font-medium">
                                    {formatRupiah(subAllocated)}
                                  </div>
                                  <div className="flex gap-2 mt-2 justify-end">
                                    <button
                                      onClick={() => openEditSubcategory(s)}
                                      className="text-xs text-slate-500"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => deleteSubcategory(s.id)}
                                      className="text-xs text-red-500"
                                    >
                                      Hapus
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal
          onClose={() => {
            setShowCategoryModal(false);
            setEditingCategory(null);
          }}
        >
          <h3 className="text-lg font-medium mb-3">
            {editingCategory
              ? "Edit Kategori"
              : `Tambah Kategori (${categoryForm.type})`}
          </h3>

          <label className="text-sm text-slate-600">Nama kategori</label>
          <input
            value={categoryForm.category}
            onChange={(e) =>
              setCategoryForm({ ...categoryForm, category: e.target.value })
            }
            className="w-full p-2 border rounded mt-1 mb-3"
            required
          />

          {categoryForm.type === "expense" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-600">
                    Persentase (% dari total income)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={categoryForm.percent}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        percent: e.target.value,
                        amount: "",
                        amountDisplay: "",
                      })
                    }
                    className="w-full p-2 border rounded mt-1"
                    placeholder="ex: 20"
                  />
                </div>

                <div>
                  <label className="text-sm text-slate-600">Nominal (Rp)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={categoryForm.amountDisplay}
                    onChange={(e) => {
                      const digits = parseInputToDigits(e.target.value);
                      setCategoryForm({
                        ...categoryForm,
                        amount: digits,
                        amountDisplay: formatNumberForInput(digits),
                        percent: "",
                      });
                    }}
                    className="w-full p-2 border rounded mt-1"
                    placeholder="ex: 500000"
                  />
                </div>
              </div>

              <div className="mt-3 text-sm text-slate-600">
                <div>
                  Total income: <strong>{formatRupiah(totalIncome)}</strong>
                </div>
                <div>
                  Allocated (existing expense):{" "}
                  <strong>{formatRupiah(existingExpenseAllocated)}</strong>
                </div>
                <div>
                  Sisa alokasi sebelum penambahan:{" "}
                  <strong>{formatRupiah(calcRemainingIfCategory())}</strong>
                </div>

                <div className="mt-2">
                  Preview alokasi kategori baru:{" "}
                  <strong>
                    {categoryForm.percent
                      ? formatRupiah(
                          Math.round(
                            (Number(categoryForm.percent || 0) / 100) *
                              (totalIncome || 0)
                          )
                        )
                      : categoryForm.amount
                      ? formatRupiah(Number(categoryForm.amount))
                      : "-"}
                  </strong>
                </div>

                <div className="mt-1">
                  Sisa setelah penambahan:{" "}
                  <strong>
                    {(() => {
                      const existingEx = expenseCategories
                        .filter((c) =>
                          editingCategory ? c.id !== editingCategory.id : true
                        )
                        .reduce((s, c) => s + computeAllocatedForExpense(c), 0);
                      const proposed = categoryForm.percent
                        ? Math.round(
                            (Number(categoryForm.percent || 0) / 100) *
                              (totalIncome || 0)
                          )
                        : categoryForm.amount
                        ? Number(categoryForm.amount || 0)
                        : 0;
                      const val = Math.max(
                        0,
                        totalIncome - (existingEx + proposed)
                      );
                      return formatRupiah(val);
                    })()}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <>
              <label className="text-sm text-slate-600">Nominal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                value={categoryForm.amountDisplay}
                onChange={(e) => {
                  const digits = parseInputToDigits(e.target.value);
                  setCategoryForm({
                    ...categoryForm,
                    amount: digits,
                    amountDisplay: formatNumberForInput(digits),
                  });
                }}
                className="w-full p-2 border rounded mt-1 mb-3"
                placeholder="ex: 3000000"
              />
              <div className="mt-2 text-sm text-slate-600">
                Preview nominal akan menjadi:{" "}
                <strong>
                  {formatRupiah(
                    categoryForm.amount ? Number(categoryForm.amount) : 0
                  )}
                </strong>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setShowCategoryModal(false);
                setEditingCategory(null);
              }}
              className="px-3 py-2 border rounded"
            >
              Batal
            </button>
            <button
              onClick={handleCategorySubmit}
              className={`px-3 py-2 rounded ${
                categoryForm.type === "income"
                  ? "bg-indigo-600 text-white"
                  : "bg-red-600 text-white"
              }`}
            >
              {editingCategory ? "Simpan" : "Tambah"}
            </button>
          </div>
        </Modal>
      )}

      {/* Sub Modal */}
      {showSubModal && (
        <Modal
          onClose={() => {
            setShowSubModal(false);
            setEditingSub(null);
            setSelectedCategoryForSub(null);
            setSubForm({
              name: "",
              percent: "",
              amount: "",
              amountDisplay: "",
            });
          }}
        >
          <h3 className="text-lg font-medium mb-3">
            {editingSub
              ? `Edit Jenis (${selectedCategoryForSub?.category})`
              : `Tambah Jenis untuk ${selectedCategoryForSub?.category}`}
          </h3>

          <label className="text-sm text-slate-600">Nama jenis</label>
          <input
            className="p-2 w-full border rounded mt-1 mb-3"
            placeholder="Nama jenis"
            value={subForm.name}
            onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-slate-600">
                Persentase (% dari kategori)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="w-full p-2 border rounded mt-1"
                placeholder="ex: 30"
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
              <label className="text-sm text-slate-600">Nominal (Rp)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full p-2 border rounded mt-1"
                placeholder="ex: 100000"
                value={subForm.amountDisplay}
                onChange={(e) => {
                  const digits = parseInputToDigits(e.target.value);
                  setSubForm({
                    ...subForm,
                    amount: digits,
                    amountDisplay: formatNumberForInput(digits),
                    percent: "",
                  });
                }}
              />
            </div>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            <div>
              Alokasi kategori (parent):{" "}
              <strong>{formatRupiah(parentAllocatedLive)}</strong>
            </div>
            <div>
              Sudah dialokasikan untuk jenis lain:{" "}
              <strong>{formatRupiah(existingSubsSumLive)}</strong>
            </div>
            <div>
              Sisa yang bisa dialokasikan:{" "}
              <strong>{formatRupiah(remainingForSubsLive)}</strong>
            </div>

            <div className="mt-2">
              Preview alokasi jenis baru:{" "}
              <strong>
                {subForm.percent
                  ? formatRupiah(
                      Math.round(
                        (Number(subForm.percent || 0) / 100) *
                          parentAllocatedLive
                      )
                    )
                  : subForm.amount
                  ? formatRupiah(Number(subForm.amount || 0))
                  : "-"}
              </strong>
            </div>

            <div className="mt-1">
              Sisa setelah penambahan:{" "}
              <strong>
                {(() => {
                  const proposed = subForm.percent
                    ? Math.round(
                        (Number(subForm.percent || 0) / 100) *
                          parentAllocatedLive
                      )
                    : subForm.amount
                    ? Number(subForm.amount || 0)
                    : 0;
                  return formatRupiah(
                    Math.max(0, remainingForSubsLive - proposed)
                  );
                })()}
              </strong>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => {
                setShowSubModal(false);
                setEditingSub(null);
                setSelectedCategoryForSub(null);
              }}
              className="px-3 py-2 border rounded"
            >
              Batal
            </button>
            <button
              onClick={handleSaveSubcategory}
              className="px-3 py-2 bg-red-600 text-white rounded"
            >
              Simpan
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -------------------------
   Modal component
   ------------------------- */
function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 w-full max-w-3xl">
        <div className="bg-white p-6 rounded-lg shadow">{children}</div>
      </div>
    </div>
  );
}
