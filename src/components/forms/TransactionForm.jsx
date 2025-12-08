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
      .order("created_at", { ascending: true });
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
      .eq("user_id", user.id)
      .single();
    if (!data) return;

    setDate(data.date);
    setAmountDisplay(
      data.amount ? new Intl.NumberFormat("id-ID").format(data.amount) : ""
    );
    setNote(data.note || "");
    setTab(data.type);

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

  async function loadSubcategories(catId, keepSub = false) {
    setCategoryId(catId);
    if (!keepSub) setSubcategoryId("");
    const user = (await supabase.auth.getUser()).data.user;
    const { data: subs } = await supabase
      .from("budget_subcategories")
      .select("*")
      .eq("user_id", user.id)
      .eq("category_id", catId);
    setSubcategories(subs || []);
  }

  function onChangeAmount(e) {
    const cleaned = String(e.target.value || "").replace(/\D/g, "");
    setAmountDisplay(
      cleaned ? new Intl.NumberFormat("id-ID").format(Number(cleaned)) : ""
    );
  }
  function parseNumber(text) {
    return Number(String(text || "").replace(/\D/g, "")) || 0;
  }

  async function handleSave() {
    const user = (await supabase.auth.getUser())?.data?.user;
    if (!user) return alert("User invalid");

    const amountNum = parseNumber(amountDisplay);
    if (amountNum <= 0) return alert("Nominal tidak valid");

    setLoading(true);

    try {
      if (editId) {
        const payload = { date, amount: amountNum, note, type: tab };
        if (tab === "transfer") {
          payload.transfer_from = transferFrom;
          payload.transfer_to_id = transferTo;
          payload.wallet_id = null;
          payload.category_id = null;
          payload.subcategory_id = null;
        } else {
          payload.wallet_id = walletId;
          payload.transfer_from = null;
          payload.transfer_to_id = null;
          payload.category_id = categoryId || null;
          payload.subcategory_id =
            tab === "expense" ? subcategoryId || null : null;
        }
        await supabase.from("transactions").update(payload).eq("id", editId);
        onSaved();
        setLoading(false);
        return;
      }

      if (tab === "transfer") {
        await supabase.from("transactions").insert({
          user_id: user.id,
          date,
          type: "transfer",
          amount: amountNum,
          note: note || "Transfer",
          transfer_from: transferFrom,
          transfer_to_id: transferTo,
        });
      } else {
        await supabase.from("transactions").insert({
          user_id: user.id,
          date,
          type: tab,
          amount: amountNum,
          note,
          wallet_id: walletId,
          category_id: categoryId || null,
          subcategory_id: tab === "expense" ? subcategoryId || null : null,
        });
      }

      onSaved();
    } catch (err) {
      console.error("handleSave error", err);
      alert("Gagal menyimpan transaksi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex gap-3 mb-4">
        {["income", "expense", "transfer"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md border text-sm ${
              tab === t
                ? t === "income"
                  ? "bg-blue-500 text-white"
                  : t === "expense"
                  ? "bg-red-500 text-white"
                  : "bg-gray-600 text-white"
                : "bg-white text-gray-600"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <label className="text-sm text-gray-500">Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border-b py-2 mb-3 bg-transparent"
        />

        <label className="text-sm text-gray-500">Nominal</label>
        <div className="border-b py-2 mb-3 flex items-center">
          <span className="mr-3">Rp</span>
          <input
            value={amountDisplay}
            onChange={onChangeAmount}
            inputMode="numeric"
            className="w-full text-right bg-transparent"
          />
        </div>

        {tab !== "transfer" && (
          <>
            <label className="text-sm text-gray-500">Kategori</label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                if (tab === "expense") loadSubcategories(e.target.value);
              }}
              className="w-full border rounded-lg px-3 py-2 mb-3"
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

            {tab === "expense" && (
              <>
                <label className="text-sm text-gray-500">Subkategori</label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mb-3"
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
              </>
            )}
          </>
        )}

        <label className="text-sm text-gray-500">
          {tab === "transfer" ? "Dari" : "Wallet"}
        </label>

        {tab === "transfer" ? (
          <>
            <select
              value={transferFrom}
              onChange={(e) => setTransferFrom(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <label className="text-sm text-gray-500">Ke</label>
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-3"
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
            className="w-full border rounded-lg px-3 py-2 mb-3"
          >
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        )}

        <label className="text-sm text-gray-500">Catatan</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 mb-3"
          placeholder="contoh: gaji, makan malam"
        />

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3 rounded-lg text-white bg-indigo-600 hover:bg-indigo-700"
        >
          {loading ? "Saving..." : editId ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
