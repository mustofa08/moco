// src/components/forms/TransactionForm.jsx
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function TransactionForm({
  initialDate,
  onSaved = () => {},
  defaultType = "expense",
  editId = null,
}) {
  const [tab, setTab] = useState(defaultType);
  const [date, setDate] = useState(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [amountDisplay, setAmountDisplay] = useState("");
  const [note, setNote] = useState("");

  const [wallets, setWallets] = useState([]);
  const [walletId, setWalletId] = useState("");

  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategories, setSubcategories] = useState([]);
  const [subcategoryId, setSubcategoryId] = useState("");

  const [loading, setLoading] = useState(false);

  /* ------------------------------------------
      INITIAL LOAD
  ------------------------------------------ */
  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (editId) loadEditData();
  }, [editId]);

  async function loadInitial() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data: w } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    setWallets(w || []);
    if (w?.length) {
      setWalletId(w[0].id);
      setTransferFrom(w[0].id);
      setTransferTo(w[1]?.id || w[0].id);
    }

    const { data: cats } = await supabase
      .from("budget_categories")
      .select("*")
      .eq("user_id", user.id);

    setCategories(cats || []);
  }

  async function loadEditData() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", editId)
      .single();

    if (!data) return;

    setTab(data.type);
    setDate(data.date);
    setAmountDisplay(new Intl.NumberFormat("id-ID").format(data.amount));
    setNote(data.note || "");

    if (data.type === "transfer") {
      setTransferFrom(data.transfer_from);
      setTransferTo(data.transfer_to_id);
    } else {
      setWalletId(data.wallet_id);
      if (data.category_id) {
        loadSubcategories(data.category_id, true);
        setCategoryId(data.category_id);
        setSubcategoryId(data.subcategory_id || "");
      }
    }
  }

  /* ------------------------------------------
      SUBCATEGORY FETCH
  ------------------------------------------ */
  async function loadSubcategories(catId, keep = false) {
    setCategoryId(catId);
    if (!keep) setSubcategoryId("");

    const user = (await supabase.auth.getUser()).data.user;

    const { data } = await supabase
      .from("budget_subcategories")
      .select("*")
      .eq("user_id", user.id)
      .eq("category_id", catId);

    setSubcategories(data || []);
  }

  /* ------------------------------------------
      AMOUNT
  ------------------------------------------ */
  function onChangeAmount(e) {
    const cleaned = String(e.target.value).replace(/\D/g, "");
    setAmountDisplay(
      cleaned ? new Intl.NumberFormat("id-ID").format(Number(cleaned)) : ""
    );
  }

  function parseNumber(str) {
    return Number(String(str || "").replace(/\D/g, "")) || 0;
  }

  /* ------------------------------------------
      SAVE
  ------------------------------------------ */
  async function handleSave() {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const amount = parseNumber(amountDisplay);
    if (!amount) return alert("Nominal tidak valid");

    setLoading(true);

    const payload = {
      user_id: user.id,
      date,
      amount,
      note,
      type: tab,
    };

    if (tab === "transfer") {
      payload.transfer_from = transferFrom;
      payload.transfer_to_id = transferTo;
      payload.wallet_id = null;
      payload.category_id = null;
      payload.subcategory_id = null;
    } else {
      payload.wallet_id = walletId;
      payload.category_id = categoryId || null;
      payload.subcategory_id = tab === "expense" ? subcategoryId || null : null;
    }

    try {
      if (editId) {
        await supabase.from("transactions").update(payload).eq("id", editId);
      } else {
        await supabase.from("transactions").insert(payload);
      }

      onSaved();
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan transaksi");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------
      TAB ACTIVE BG COLORS
  ------------------------------------------ */
  const activeColor = {
    income: "bg-green-100 text-green-700",
    expense: "bg-red-100 text-red-700",
    transfer: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="max-w-lg mx-auto mt-3 pb-10">
      {/* ---------- SEGMENTED TABS ---------- */}
      <div className="flex bg-white rounded-xl shadow p-1 mb-5 border">
        {[
          { key: "income", label: "Income" },
          { key: "expense", label: "Expense" },
          { key: "transfer", label: "Transfer" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex-1 py-2 rounded-lg text-sm font-medium transition
              ${
                tab === t.key
                  ? `${activeColor[t.key]} shadow`
                  : "text-slate-600"
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---------- FORM CARD ---------- */}
      <div className="p-5 rounded-2xl shadow border bg-white space-y-4">
        {/* DATE */}
        <div>
          <label className="text-sm text-slate-600">Tanggal</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
          />
        </div>

        {/* NOMINAL */}
        <div>
          <label className="text-sm text-slate-600">Nominal</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              Rp
            </span>
            <input
              value={amountDisplay}
              onChange={onChangeAmount}
              inputMode="numeric"
              className="
                w-full pl-10 pr-3 py-2 rounded-lg border bg-slate-50 
                text-right font-medium text-slate-700 focus:outline-none
              "
              placeholder="0"
            />
          </div>
        </div>

        {/* CATEGORY */}
        {tab !== "transfer" && (
          <div>
            <label className="text-sm text-slate-600">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (tab === "expense") loadSubcategories(e.target.value);
              }}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
            >
              <option value="">Pilih kategori</option>
              {categories
                .filter((c) => !c.type || c.type === tab)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* SUBCATEGORY */}
        {tab === "expense" && (
          <div>
            <label className="text-sm text-slate-600">Subkategori</label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
            >
              <option value="">
                {subcategories.length
                  ? "Pilih subkategori"
                  : "Tidak ada subkategori"}
              </option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* WALLET / TRANSFER */}
        <div>
          <label className="text-sm text-slate-600">
            {tab === "transfer" ? "Transfer Dari" : "Wallet"}
          </label>

          {tab === "transfer" ? (
            <>
              <select
                value={transferFrom}
                onChange={(e) => setTransferFrom(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>

              <label className="text-sm text-slate-600 mt-3 block">
                Transfer Ke
              </label>

              <select
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
              >
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* NOTE */}
        <div>
          <label className="text-sm text-slate-600">Catatan</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="contoh: makan malam, gaji, bensin"
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-slate-50"
          />
        </div>

        {/* SAVE BUTTON */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="
            w-full py-3 rounded-xl bg-[#052A3D] text-white 
            font-semibold hover:bg-[#083a52] transition
          "
        >
          {loading ? "Menyimpan..." : editId ? "Update" : "Simpan"}
        </button>
      </div>
    </div>
  );
}
