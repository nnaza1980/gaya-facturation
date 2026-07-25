"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase";

type Agent = { id: string; prenom: string; nom: string };
type Taux = { agent_id: string; taux: number; date_effet: string };

function isoDate(d: Date) { const m = String(d.getMonth() + 1).padStart(2, "0"); const j = String(d.getDate()).padStart(2, "0"); return `${d.getFullYear()}-${m}-${j}`; }
function dateLisible(s: string) { const [y, m, j] = s.split("-"); return `${j}/${m}/${y}`; }

export default function TauxAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [taux, setTaux] = useState<Taux[]>([]);
  const [loading, setLoading] = useState(true);
  const [saisieTaux, setSaisieTaux] = useState<Record<string, string>>({});
  const [saisieDate, setSaisieDate] = useState<Record<string, string>>({});
  const [historiqueOuvert, setHistoriqueOuvert] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: ag } = await supabase.from("agents").select("id, prenom, nom").eq("est_agent", true).order("nom");
    const { data: tx } = await supabase.from("taux_agents").select("agent_id, taux, date_effet").order("date_effet", { ascending: false });
    setAgents((ag as Agent[]) || []);
    setTaux((tx as Taux[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const aujourdhui = isoDate(new Date());

  // Taux courant d'un agent = ligne avec la date_effet la plus récente <= aujourd'hui
  function tauxCourant(agentId: string): Taux | null {
    const lignes = taux
      .filter((t) => t.agent_id === agentId && t.date_effet <= aujourdhui)
      .sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1));
    return lignes[0] || null;
  }
  function historique(agentId: string): Taux[] {
    return taux.filter((t) => t.agent_id === agentId).sort((a, b) => (a.date_effet < b.date_effet ? 1 : -1));
  }

  async function enregistrer(agentId: string) {
    setMsg("");
    const valStr = saisieTaux[agentId];
    if (!valStr || isNaN(Number(valStr))) { setMsg("Entrez un pourcentage valide."); return; }
    const pct = Number(valStr);
    if (pct < 0 || pct > 100) { setMsg("Le taux doit être entre 0 et 100 %."); return; }
    const dateEffet = saisieDate[agentId] || aujourdhui;

    setSavingId(agentId);
    const supabase = createClient();
    const { error } = await supabase.from("taux_agents").insert({
      agent_id: agentId,
      taux: Math.round(pct * 100) / 10000, // 20 (%) -> 0.20
      date_effet: dateEffet,
    });
    setSavingId(null);
    if (error) { setMsg("Erreur : " + error.message); return; }
    const ag = agents.find((a) => a.id === agentId);
    setMsg(`✅ Nouveau taux ${pct} % enregistré pour ${ag?.prenom} ${ag?.nom} (effet au ${dateLisible(dateEffet)}).`);
    setSaisieTaux((s) => ({ ...s, [agentId]: "" }));
    setSaisieDate((s) => ({ ...s, [agentId]: "" }));
    charger();
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 30, fontWeight: 600, marginBottom: 6 }}>Taux de facturation par agent</h1>
      <p style={{ color: "var(--muted)", marginBottom: 8 }}>
        Le pourcentage du chiffre d'affaires hors-gestion (transaction &amp; location) que chaque agent facture à Gaya.
      </p>
      <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: 13 }}>
        Chaque changement crée un nouveau taux daté : l'historique est conservé et les dossiers déjà facturés ne sont jamais recalculés.
        La gestion locative reste à taux fixe de 15 % pour tous les agents.
      </p>

      {loading ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Chargement…</div>
      ) : agents.length === 0 ? (
        <div className="card" style={{ padding: 28, color: "var(--muted)" }}>Aucun agent.</div>
      ) : (
        <>
          {msg && (
            <div style={{ background: msg.startsWith("✅") ? "var(--gaya-green-light)" : "#fbeae9", color: msg.startsWith("✅") ? "var(--gaya-green-dark)" : "var(--danger)", padding: "12px 14px", borderRadius: 10, fontSize: 14, marginBottom: 16 }}>
              {msg}
            </div>
          )}

          <div className="card" style={{ overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--gaya-green-light)" }}>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Agent</th>
                  <th style={{ textAlign: "center", padding: "10px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Taux actuel</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Nouveau taux (%)</th>
                  <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 600, color: "var(--gaya-green-dark)" }}>Date d'effet</th>
                  <th style={{ padding: "10px 14px" }}></th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => {
                  const courant = tauxCourant(a.id);
                  const hist = historique(a.id);
                  const ouvert = historiqueOuvert[a.id];
                  return (
                    <Fragment key={a.id}>
                      <tr style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 600 }}>{a.prenom} {a.nom}</td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          {courant ? (
                            <span style={{ fontWeight: 700, color: "var(--gaya-green)", fontSize: 15 }}>{Math.round(courant.taux * 100)} %</span>
                          ) : (
                            <span style={{ color: "var(--danger)", fontSize: 12 }}>non défini</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <input type="number" className="input" placeholder="ex. 20" style={{ width: 100, padding: "7px 9px" }}
                            value={saisieTaux[a.id] ?? ""} onChange={(e) => setSaisieTaux((s) => ({ ...s, [a.id]: e.target.value }))} />
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <input type="date" className="input" style={{ padding: "7px 9px" }}
                            value={saisieDate[a.id] ?? aujourdhui} onChange={(e) => setSaisieDate((s) => ({ ...s, [a.id]: e.target.value }))} />
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }}
                            disabled={savingId === a.id} onClick={() => enregistrer(a.id)}>
                            {savingId === a.id ? "…" : "Enregistrer"}
                          </button>
                          {hist.length > 0 && (
                            <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: 12, marginLeft: 8 }}
                              onClick={() => setHistoriqueOuvert((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                              Historique ({hist.length})
                            </button>
                          )}
                        </td>
                      </tr>
                      {ouvert && hist.length > 0 && (
                        <tr key={a.id + "-hist"} style={{ background: "#fafcfb" }}>
                          <td colSpan={5} style={{ padding: "6px 14px 14px 28px" }}>
                            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Historique des taux :</div>
                            {hist.map((h, i) => {
                              const actuel = courant && h.date_effet === courant.date_effet;
                              const futur = h.date_effet > aujourdhui;
                              return (
                                <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "4px 0", fontSize: 13 }}>
                                  <span style={{ fontWeight: 600, minWidth: 60 }}>{Math.round(h.taux * 100)} %</span>
                                  <span style={{ color: "var(--muted)" }}>à partir du {dateLisible(h.date_effet)}</span>
                                  {actuel && <span style={{ fontSize: 11, background: "var(--gaya-green)", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>actuel</span>}
                                  {futur && <span style={{ fontSize: 11, background: "var(--gaya-accent)", color: "#fff", padding: "2px 8px", borderRadius: 20 }}>à venir</span>}
                                </div>
                              );
                            })}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
