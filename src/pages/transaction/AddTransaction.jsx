import React from "react";
import TransactionForm from "../../components/forms/TransactionForm";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function AddTransactionPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-4 ">
      <div className="max-w-3xl mx-auto mt-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-md bg-white shadow border hover:bg-gray-100"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>

          <h1 className="text-xl font-semibold text-gray-800">
            Add Transaction
          </h1>
        </div>

        <TransactionForm
          onSaved={() => {
            navigate("/transaction");
          }}
        />
      </div>
    </div>
  );
}
