import { useState } from "react";
import Market from "./Market";
import Profile from "./Profile";
import "./PizHub.css";

function PizHub({ initialView = "wallet", onBack }) {
  const [section, setSection] = useState(initialView === "trends" ? "trends" : "wallet");
  return <section className="piz-hub">
    <div className="piz-hub-tabs" role="tablist" aria-label="Compte PIZ">
      <button type="button" role="tab" aria-selected={section === "wallet"} className={section === "wallet" ? "is-active" : ""} onClick={() => setSection("wallet")}><span aria-hidden="true">◈</span> Portefeuille</button>
      <button type="button" role="tab" aria-selected={section === "trends"} className={section === "trends" ? "is-active" : ""} onClick={() => setSection("trends")}><span aria-hidden="true">⌁</span> Tendances PIZ</button>
    </div>
    {section === "wallet"
      ? <Profile key="piz-wallet" initialView="finance" onBack={onBack} />
      : <Market onBack={onBack} />}
  </section>;
}

export default PizHub;
