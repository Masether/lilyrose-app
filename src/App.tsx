import { useMemo, useState } from "react";
import { assembleBrief, scanGithub, type LilyBrief } from "./lib/loop";

const KEYS = "lilyrose.kraken";

type Keys = { key: string; secret: string; paper: boolean };

function loadKeys(): Keys {
  try {
    const raw = localStorage.getItem(KEYS);
    if (raw) return JSON.parse(raw) as Keys;
  } catch {
    /* ignore */
  }
  return { key: "", secret: "", paper: true };
}

export default function App() {
  const [phase, setPhase] = useState<"idle" | "assign" | "execute" | "verify">("idle");
  const [brief, setBrief] = useState<LilyBrief | null>(null);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<Keys>(loadKeys);
  const [showKeys, setShowKeys] = useState(false);

  const attached = Boolean(keys.key && keys.secret);

  const when = useMemo(() => {
    if (!brief) return "";
    return new Date(brief.generatedAt).toLocaleString();
  }, [brief]);

  async function run() {
    setError("");
    setPhase("assign");
    await wait(280);
    setPhase("execute");
    try {
      const hits = await scanGithub();
      setPhase("verify");
      const next = assembleBrief({ hits, fundConnected: attached, paper: keys.paper });
      setBrief(next);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "cycle failed");
      setPhase("idle");
    }
  }

  function saveKeys() {
    localStorage.setItem(KEYS, JSON.stringify(keys));
    setShowKeys(false);
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <div className="mark" aria-hidden />
          <h1 style={{ marginTop: 12 }}>LilyRose</h1>
          <p className="sub">assign → execute → verify. One brief. Walk away.</p>
        </div>
        <div className="status">
          <span className={attached ? "dot on" : "dot"} />
          {attached ? "fund keys attached" : "fund idle"}
        </div>
      </header>

      <section className="jobs">
        <div className="job">
          <b>Job 1</b>
          <p>Scan live GitHub + web for new AI products.</p>
        </div>
        <div className="job">
          <b>Job 2</b>
          <p>Pull what people actually said about them.</p>
        </div>
        <div className="job">
          <b>Job 3</b>
          <p>Kill engagement bait. Cross-check. Ship one structured brief.</p>
        </div>
      </section>

      <div className="row">
        <button className="btn" onClick={run} disabled={phase !== "idle"}>
          {phase === "idle" ? "Run cycle" : phase}
        </button>
        <button className="btn ghost" onClick={() => setShowKeys((v) => !v)}>
          {showKeys ? "Hide fund" : "Connect fund"}
        </button>
      </div>

      {showKeys && (
        <div className="panel">
          <h2>Kraken sleeve</h2>
          <p className="meta">
            Keys stay in this browser. LilyRose does not place orders. She only notes that a fund is attached.
          </p>
          <label>API key</label>
          <input
            value={keys.key}
            onChange={(e) => setKeys({ ...keys, key: e.target.value })}
            autoComplete="off"
          />
          <label>Private key</label>
          <input
            type="password"
            value={keys.secret}
            onChange={(e) => setKeys({ ...keys, secret: e.target.value })}
            autoComplete="off"
          />
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={saveKeys}>
              Save locally
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                localStorage.removeItem(KEYS);
                setKeys({ key: "", secret: "", paper: true });
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && <p className="meta">{error}</p>}

      {brief && (
        <article className="panel">
          <h2>Brief {brief.id}</h2>
          <p className="meta">
            {when} · raw {brief.raw} → kept {brief.kept} · bait killed {brief.killedBait} · {brief.action} ·{" "}
            {(brief.confidence * 100).toFixed(0)}%
          </p>
          <p className="quote">{brief.verdict}</p>
          <div className="paths">
            {brief.paths.map((p) => (
              <div className="path" key={p.path}>
                <strong>{p.path}</strong>
                {p.note}
              </div>
            ))}
          </div>
          {brief.products.map((p) => (
            <div className="product" key={p.name}>
              <strong>{p.name}</strong>
              {p.maker ? <span className="meta"> · {p.maker}</span> : null}
              <p className="quote">{p.claims[0]}</p>
              {p.urls[0] && (
                <a href={p.urls[0]} target="_blank" rel="noreferrer">
                  {p.urls[0]}
                </a>
              )}
            </div>
          ))}
        </article>
      )}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
