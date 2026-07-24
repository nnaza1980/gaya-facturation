"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { formatEuros } from "@/lib/calculs";

type Agent = { id: string; prenom: string; nom: string };

export default function NouveauMandat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tauxGestion, setTauxGestion] = useState(0.15);

  const [numeroMandat, setNumeroMandat] = useState("");
  const [bailleur, setBailleur] = useState("");
  const [locataire, setLocataire] = useState("");
  const [bien, setBien] = useState("");
  const [agentId, setAgentId] = useState("");
  const [dateActivation, setDateActivation] = useState("");
  const [loyer, setLoyer] = useState("");
  const [tauxMandat, setTauxMandat] = useState("6");

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("agents").select("id, prenom, nom").eq("est_agent", true).order("nom")
      .then(({ data }) => { if (data) setAgents(data as Agent[]); });
    supabase.from("parametres").select("taux_gestion").eq("id", 1).single()
      .then(({ data }) => { if (data) setTauxGestion(Number(data.taux_gestion)); });
  }, []);

  const loyerNum = Number(loyer) || 0;
  const tauxNum = (Number(tauxMandat) || 0) / 100;
  const honorairesGestion = Math.round(loyerNum * tauxNum * 100) / 100;
  const commissionAgent = Math.round(honorairesGestion * tauxGestion * 100) / 100;

  async function enregistrer() {
    setMsg("");
    if (!numeroMandat || !bailleur || !bien || !agentId || !dateActivation || !loyer) {
      setMsg("Merci de remplir tous les champs obligatoires.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("mandats_gestion").insert({
      numero_mandat: numeroMandat, nom_bailleur: bailleur, nom_locataire: locataire || null,
      bien_adresse: bien, agent_apporteur_id: agentId, date_activation: dateActivation,
      honoraires_gestion_mensuels: honorairesGestion,
    });
    setSaving(false);
    if (error) { setMsg("Erreur : " + error.message); return; }
    setMsg("✅ Mandat de gestion activé avec succès.");
    setNumeroMandat(""); setBailleur(""); setLocataire(""); setBien("");
    setAgentId(""); setDateActivation(""); setLoyer("");
  }

  const lbl = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 } as const;
  const field = { marginBottom: 16 } as const;

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>Activer un mandat de gestion</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>À la 1ère mise en location ou à une relocation. Déclenche la commission récurrente de l&apos;agent apporteur.</p>

      <div className="card" style={{ padding: 26, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={field}>
            <label style={lbl}>N° de mandat *</label>
            <input className="input" value={numeroMandat} onChange={(e) => setNumeroMandat(e.target.value)} placeholder="G-2026-020" />
          </div>
          <div style={field}>
            <label style={lbl}>Agent apporteur *</label>
            <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">— choisir —</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={lbl}>Bailleur *</label>
            <input className="input" value={bailleur} onChange={(e) => setBailleur(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Locataire</label>
            <input className="input" value={locataire} onChange={(e) => setLocataire(e.target.value)} />
          </div>
          <div style={{ ...field, gridColumn: "1 / -1" }}>
            <label style={lbl}>Bien / Adresse *</label>
            <input className="input" value={bien} onChange={(e) => setBien(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Date d&apos;activation *</label>
            <input type="date" className="input" value={dateActivation} onChange={(e) => setDateActivation(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Loyer mensuel CC (€) *</label>
            <input type="number" className="input" value={loyer} onChange={(e) => setLoyer(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Taux de gestion appliqué (%)</label>
            <input type="number" className="input" value={tauxMandat} onChange={(e) => setTauxMandat(e.target.value)} placeholder="6" />
          </div>
        </div>

        {loyerNum > 0 && (
          <div style={{ background: "var(--gaya-green-light)", borderRadius: 10, padding: "14px 16px", marginTop: 6, fontSize: 14 }}>
            <div style={{ marginBottom: 4 }}>Honoraires de gestion mensuels : <strong>{formatEuros(honorairesGestion)}</strong> ({tauxMandat}% du loyer)</div>
            <div>Commission mensuelle de l&apos;agent : <strong style={{ color: "var(--gaya-green)" }}>{formatEuros(commissionAgent)}</strong> ({Math.round(tauxGestion * 100)}% des honoraires, récurrent)</div>
          </div>
        )}
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✅") ? "var(--gaya-green-light)" : "#fbeae9", color: msg.startsWith("✅") ? "var(--gaya-green-dark)" : "var(--danger)", padding: "12px 14px", borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <button onClick={enregistrer} className="btn btn-primary" disabled={saving} style={{ fontSize: 15, padding: "12px 24px" }}>
        {saving ? "Enregistrement…" : "Activer le mandat"}
      </button>
    </div>
  );
}
