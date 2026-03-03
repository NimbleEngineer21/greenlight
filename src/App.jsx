import { Routes, Route } from "react-router-dom";
import { useStorage } from "./hooks/useStorage.js";
import { usePrices } from "./hooks/usePrices.js";
import "./App.css";
import Layout from "./components/Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Assets from "./pages/Assets.jsx";
import Import from "./pages/Import.jsx";
import CashAccounts from "./pages/CashAccounts.jsx";
import Projections from "./pages/Projections.jsx";
import Settings from "./pages/Settings.jsx";
import SetupWizard from "./pages/SetupWizard.jsx";
import PurchasePlanning from "./pages/PurchasePlanning.jsx";
import LoansCalc from "./pages/LoansCalc.jsx";
import LenderCompare from "./pages/LenderCompare.jsx";
import Readiness from "./pages/Readiness.jsx";

export default function App() {
  const [state, updateState, replaceState] = useStorage();
  const { prices, lastFetch, fetching, fetchErr, setPrice, refresh } = usePrices(state.priceOverrides);

  if (!state.setupComplete) {
    return <SetupWizard updateState={updateState} />;
  }

  const sellDate = state.sellDate || new Date().toISOString().slice(0, 10);
  const onSellDateChange = (val) => updateState(prev => ({ ...prev, sellDate: val }));
  const purchaseDate = state.purchase?.targetPurchaseDate || "";
  const onPurchaseDateChange = (val) => updateState(prev => ({
    ...prev,
    purchase: { ...prev.purchase, targetPurchaseDate: val },
  }));

  return (
    <Routes>
      <Route
        element={
          <Layout
            sellDate={sellDate}
            onSellDateChange={onSellDateChange}
            purchaseDate={purchaseDate}
            onPurchaseDateChange={onPurchaseDateChange}
            lastFetch={lastFetch}
            fetchErr={fetchErr}
            fetching={fetching}
            onRefresh={refresh}
            planningMode={state.purchase?.category || null}
          />
        }
      >
        <Route index element={<Dashboard state={state} prices={prices} setPrice={setPrice} updateState={updateState} />} />
        <Route path="assets" element={<Assets state={state} updateState={updateState} prices={prices} />} />
        <Route path="import" element={<Import state={state} updateState={updateState} />} />
        <Route path="cash" element={<CashAccounts state={state} updateState={updateState} />} />
        <Route path="projections" element={<Projections state={state} updateState={updateState} />} />
        <Route path="purchase" element={<PurchasePlanning state={state} updateState={updateState} prices={prices} />} />
        <Route path="loans" element={<LoansCalc state={state} updateState={updateState} />} />
        <Route path="compare" element={<LenderCompare state={state} updateState={updateState} />} />
        <Route path="readiness" element={<Readiness state={state} updateState={updateState} prices={prices} />} />
        <Route path="settings" element={<Settings state={state} updateState={updateState} replaceState={replaceState} />} />
      </Route>
    </Routes>
  );
}
