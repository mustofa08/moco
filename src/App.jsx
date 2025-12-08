import { Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";

import Dashboard from "./pages/Dashboard";
import Budget from "./pages/Budget";
import Goals from "./pages/Goals";
import Transaction from "./pages/Transaction";
import AddTransactionPage from "./pages/transaction/AddTransaction";
import EditTransactionPage from "./pages/transaction/EditTransaction";
import Wallets from "./pages/Wallets";
import HutangPiutang from "./pages/HutangPiutang";

import AppLayout from "./layouts/AppLayout";
import ProtectedRoute from "./pages/routes/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected Pages with AppLayout applied ONCE */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<Dashboard />} />
        <Route path="wallets" element={<Wallets />} />
        <Route path="budget" element={<Budget />} />
        <Route path="goals" element={<Goals />} />
        <Route path="transaction" element={<Transaction />} />

        <Route path="Transaction/add" element={<AddTransactionPage />} />
        <Route path="Transaction/edit/:id" element={<EditTransactionPage />} />
        <Route path="hutangpiutang" element={<HutangPiutang />} />
      </Route>
    </Routes>
  );
}
