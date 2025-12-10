// src/pages/transaction/EditTransaction.jsx
import { useParams, useNavigate } from "react-router-dom";
import TransactionForm from "../../components/forms/TransactionForm";
import { ArrowLeft } from "lucide-react";

export default function EditTransaction() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F3F7FA] p-4">
      <div className="max-w-3xl mx-auto mt-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl bg-white shadow border hover:bg-slate-100"
          >
            <ArrowLeft size={20} className="text-slate-700" />
          </button>

          <h1 className="text-xl font-bold text-slate-800">Edit Transaksi</h1>
        </div>

        <TransactionForm editId={id} onSaved={() => navigate(-1)} />
      </div>
    </div>
  );
}
