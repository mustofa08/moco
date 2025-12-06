// src/pages/transaction/EditTransaction.jsx
import { useParams, useNavigate } from "react-router-dom";
import TransactionForm from "../../components/forms/TransactionForm";
import { ArrowLeft } from "lucide-react";

export default function EditTransaction() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4">
      <div className="max-w-3xl mx-auto mt-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md bg-white dark:bg-slate-800 shadow border hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
        </button>

        <h1 className="text-xl font-semibold mb-4 dark:text-white">
          Edit Transaksi
        </h1>

        <TransactionForm editId={id} onSaved={() => navigate(-1)} />
      </div>
    </div>
  );
}
