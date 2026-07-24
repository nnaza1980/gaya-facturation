"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { ancienneteJours, cleRepartitionStandard, libelleTranche, partsValides, type Parametres } from "@/lib/calculs";

type Agent = { id: string; prenom: string; nom: string };
type Nego = { agent_id: string; role: "entree" | "sortie"; part: number; taux: number };

export default function NouveauDossier() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [params, setParams] = useState<Parametres | null>(null);
  const [tauxParAgent, setTauxParAgent] = useState<Record<string, number>>({});

  // Champs dossier
  const [activite, setActivite] = useState<"transaction" | "location">("transaction");
  const [numeroMandat, setNumeroMandat] = useState("");
  const [vendeur, setVendeur] = useState("");
  const [acquereur, setAcquereur] = useState("");
  const [bien, setBien] = useState("");
  const [datePriseMandat, setDatePriseMandat] = useState("");
  const [datePriseOffre, setDatePriseOffre] = useState("");
  const [dateActeBail, setDateActeBail] = useState("");
  const [honoraires, setHonoraires] = useState("");
  const [statut, setStatut] = useState("compromis");

  // Négociateurs
  const [manuel, setManuel] = useState(false);
  const [negos, setNegos] = useState<Nego[]>([
    { agent_id: "", role: "entree", part: 0, taux: 0 },
    { agent_id: "", role: "sortie", part: 0, taux: 0 },
  ]);

  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("agents").select("id, prenom, nom").eq("est_agent", true).order("nom")
      .then(({ data }) => { if (data) setAgents(data as Agent[]); });
    supabase.from("parametres").select("*").eq("id", 1).single()
      .then(({ data }) => { if (data) setParams(data as Parametres); });
    supabase.from("taux_agents").select("agent_id, taux, date_effet")
      .then(({ data }) => {
        if (!data) return;
        const latest: Record<string, { taux: number; date: string }> = {};
        data.forEach((t: any) => {
          if (!latest[t.agent_id] || t.date_effet > latest[t.agent_id].date) latest[t.agent_id] = { taux: Number(t.taux), date: t.date_effet };
        });
        const map: Record<string, number> = {};
        Object.entries(latest).forEach(([id, v]) => (map[id] = v.taux));
        setTauxParAgent(map);
      });
  }, []);

  // Calcul auto de la clé standard (2 négociateurs, non manuel)
  const jours = datePriseMandat && datePriseOffre ? ancienneteJours(datePriseMandat, datePriseOffre) : null;
  const cleAuto = jours !== null && params ? cleRepartitionStandard(jours, params) : null;

  function updateNego(i: number, patch: Partial<Nego>) {
    setNegos((prev) => prev.map((n, idx) => (idx === i ? { ...n, ...patch } : n)));
  }
  function ajouterNego() {
    setManuel(true);
    setNegos((prev) => [...prev, { agent_id: "", role: "sortie", part: 0, taux: 0 }]);
  }
  function retirerNego(i: number) {
    setNegos((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Parts effectives : si non manuel et 2 négos -> clé auto ; sinon parts saisies
  const partsEffectives: number[] = (!manuel && negos.length === 2 && cleAuto)
    ? [cleAuto.partEntree, cleAuto.partSortie]
    : negos.map((n) => n.part);

  const sommeParts = partsEffectives.reduce((a, b) => a + b, 0);
  const partsOK = partsValides(partsEffectives);

  async function enregistrer() {
    setMsg("");
    // Validations
    if (!numeroMandat || !vendeur || !bien || !datePriseMandat || !honoraires) {
      setMsg("Merci de remplir les champs obligatoires (mandat, vendeur/bailleur, bien, date de mandat, honoraires).");
      return;
    }
    if (negos.some((n) => !n.agent_id)) {
      setMsg("Chaque négociateur doit être associé à un agent.");
      return;
    }
    if (!partsOK) {
      setMsg(`La somme des parts doit faire exactement 100 % (actuellement ${Math.round(sommeParts * 100)} %).`);
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: d, error: e1 } = await supabase.from("dossiers").insert({
      activite, numero_mandat: numeroMandat, nom_vendeur_bailleur: vendeur,
      nom_acquereur_locataire: acquereur || null, bien_adresse: bien,
      date_prise_mandat: datePriseMandat, date_prise_offre: datePriseOffre || null,
      date_acte_ou_bail: dateActeBail || null, honoraires_ht: Number(honoraires),
      statut, repartition_manuelle: manuel,
    }).select("id").single();

    if (e1 || !d) { setSaving(false); setMsg("Erreur à l'enregistrement du dossier : " + (e1?.message || "")); return; }

    const lignes = negos.map((n, i) => ({
      dossier_id: d.id, agent_id: n.agent_id, role: n.role,
      part_figee: partsEffectives[i],
      taux_indiv_fige: n.taux || tauxParAgent[n.agent_id] || 0,
    }));
    const { error: e2 } = await supabase.from("dossiers_negociateurs").insert(lignes);
    setSaving(false);
    if (e2) { setMsg("Dossier créé, mais erreur sur les négociateurs : " + e2.message); return; }

    setMsg("✅ Dossier enregistré avec succès.");
    setNumeroMandat(""); setVendeur(""); setAcquereur(""); setBien("");
    setDatePriseMandat(""); setDatePriseOffre(""); setDateActeBail(""); setHonoraires("");
    setManuel(false);
    setNegos([{ agent_id: "", role: "entree", part: 0, taux: 0 }, { agent_id: "", role: "sortie", part: 0, taux: 0 }]);
  }

  const lbl = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--muted)", marginBottom: 6 } as const;
  const field = { marginBottom: 16 } as const;

  return (
    <div style={{ maxWidth: 820 }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>Nouveau dossier</h1>
      <p style={{ color: "var(--muted)", marginBottom: 24 }}>Vente ou location. La répartition entrée/sortie se calcule automatiquement, sauf cas à 3 négociateurs.</p>

      <div className="card" style={{ padding: 26, marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={field}>
            <label style={lbl}>Activité</label>
            <select className="input" value={activite} onChange={(e) => setActivite(e.target.value as any)}>
              <option value="transaction">Vente (transaction)</option>
              <option value="location">Location</option>
            </select>
          </div>
          <div style={field}>
            <label style={lbl}>N° de mandat *</label>
            <input className="input" value={numeroMandat} onChange={(e) => setNumeroMandat(e.target.value)} placeholder="V-2026-120" />
          </div>
          <div style={field}>
            <label style={lbl}>{activite === "transaction" ? "Vendeur *" : "Bailleur *"}</label>
            <input className="input" value={vendeur} onChange={(e) => setVendeur(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>{activite === "transaction" ? "Acquéreur" : "Locataire"}</label>
            <input className="input" value={acquereur} onChange={(e) => setAcquereur(e.target.value)} />
          </div>
          <div style={{ ...field, gridColumn: "1 / -1" }}>
            <label style={lbl}>Bien / Adresse *</label>
            <input className="input" value={bien} onChange={(e) => setBien(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Date de prise de mandat *</label>
            <input type="date" className="input" value={datePriseMandat} onChange={(e) => setDatePriseMandat(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Date de prise d&apos;offre</label>
            <input type="date" className="input" value={datePriseOffre} onChange={(e) => setDatePriseOffre(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Date {activite === "transaction" ? "d'acte" : "de bail"}</label>
            <input type="date" className="input" value={dateActeBail} onChange={(e) => setDateActeBail(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Honoraires HT (€) *</label>
            <input type="number" className="input" value={honoraires} onChange={(e) => setHonoraires(e.target.value)} />
          </div>
          <div style={field}>
            <label style={lbl}>Statut</label>
            <select className="input" value={statut} onChange={(e) => setStatut(e.target.value)}>
              {activite === "transaction" ? (
                <>
                  <option value="compromis">Compromis</option>
                  <option value="acte">Acté</option>
                </>
              ) : (
                <option value="bail_signe">Bail signé</option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Négociateurs */}
      <div className="card" style={{ padding: 26, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--gaya-green-dark)" }}>Négociateurs</h2>
          {!manuel && cleAuto && jours !== null && (
            <div style={{ fontSize: 13, color: "var(--gaya-green)", fontWeight: 600 }}>
              Clé auto : {libelleTranche(jours, params!)} — ancienneté {jours} j
            </div>
          )}
        </div>

        {negos.map((n, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: 10, marginBottom: 10, alignItems: "end" }}>
            <div>
              {i === 0 && <label style={lbl}>Agent</label>}
              <select className="input" value={n.agent_id} onChange={(e) => updateNego(i, { agent_id: e.target.value })}>
                <option value="">— choisir —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>)}
              </select>
            </div>
            <div>
              {i === 0 && <label style={lbl}>Rôle</label>}
              <select className="input" value={n.role} onChange={(e) => updateNego(i, { role: e.target.value as any })}>
                <option value="entree">Entrée</option>
                <option value="sortie">Sortie</option>
              </select>
            </div>
            <div>
              {i === 0 && <label style={lbl}>Part %</label>}
              <input type="number" className="input"
                value={!manuel && negos.length === 2 && cleAuto ? Math.round(partsEffectives[i] * 100) : (n.part ? Math.round(n.part * 100) : "")}
                disabled={!manuel && negos.length === 2}
                onChange={(e) => updateNego(i, { part: Number(e.target.value) / 100 })}
                placeholder="auto" />
            </div>
            <div>
              {i === 0 && <label style={lbl}>Taux perso %</label>}
              <input type="number" className="input"
                value={n.taux ? Math.round(n.taux * 100) : (n.agent_id && tauxParAgent[n.agent_id] ? Math.round(tauxParAgent[n.agent_id] * 100) : "")}
                onChange={(e) => updateNego(i, { taux: Number(e.target.value) / 100 })}
                placeholder="défaut agent" />
            </div>
            <div>
              {negos.length > 2 && (
                <button onClick={() => retirerNego(i)} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: "var(--danger)" }}>✕</button>
              )}
            </div>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <button onClick={ajouterNego} className="btn btn-ghost">+ Ajouter un négociateur (cas exceptionnel)</button>
          <div style={{ fontSize: 13, fontWeight: 600, color: partsOK ? "var(--gaya-green)" : "var(--danger)" }}>
            Somme des parts : {Math.round(sommeParts * 100)} % {partsOK ? "✓" : "(doit faire 100 %)"}
          </div>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.startsWith("✅") ? "var(--gaya-green-light)" : "#fbeae9", color: msg.startsWith("✅") ? "var(--gaya-green-dark)" : "var(--danger)", padding: "12px 14px", borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
          {msg}
        </div>
      )}

      <button onClick={enregistrer} className="btn btn-primary" disabled={saving} style={{ fontSize: 15, padding: "12px 24px" }}>
        {saving ? "Enregistrement…" : "Enregistrer le dossier"}
      </button>
    </div>
  );
}
