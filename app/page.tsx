"use client";

import { useMemo, useState } from "react";

const DEFAULT_VALUES = [
  1, 5, 10, 25, 50, 100, 250, 500, 750, 1000, 2500, 5000,
  7500, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 300000,
  500000, 750000, 1000000,
];

type CaseItem = { id: number; value: number; opened: boolean };

function shuffledCases(values: number[]): CaseItem[] {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((value, index) => ({ id: index + 1, value, opened: false }));
}

function formatValue(value: number, label: string) {
  return label === "₱" ? `₱${value.toLocaleString()}` : `${value.toLocaleString()} ${label}`;
}

export default function Home() {
  const [unit, setUnit] = useState("Points");
  const [cases, setCases] = useState<CaseItem[]>(() => shuffledCases(DEFAULT_VALUES));
  const [playerCase, setPlayerCase] = useState<number | null>(null);
  const [round, setRound] = useState(1);
  const [openedThisRound, setOpenedThisRound] = useState(0);
  const [offer, setOffer] = useState<number | null>(null);
  const [lastOpened, setLastOpened] = useState<CaseItem | null>(null);
  const [message, setMessage] = useState("Choose your personal case to begin.");
  const [gameOver, setGameOver] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [draftValues, setDraftValues] = useState(DEFAULT_VALUES.join(", "));
  const [soundOn, setSoundOn] = useState(true);
  const [finalReveal, setFinalReveal] = useState<"idle" | "suspense" | "flash" | "revealed">("idle");

  const remaining = useMemo(() => cases.filter((item) => !item.opened), [cases]);
  const remainingValues = useMemo(() => remaining.map((item) => item.value), [remaining]);
  const casesThisRound = Math.max(1, 6 - round);

  function ping(frequency = 620, duration = 0.12) {
    if (!soundOn || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioCtx();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "triangle";
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  function reset(values = DEFAULT_VALUES) {
    setCases(shuffledCases(values));
    setPlayerCase(null);
    setRound(1);
    setOpenedThisRound(0);
    setOffer(null);
    setLastOpened(null);
    setGameOver(false);
    setFinalReveal("idle");
    setMessage("Choose your personal case to begin.");
    setShowSetup(false);
  }

  function selectCase(id: number) {
    if (gameOver || offer !== null) return;
    if (playerCase === null) {
      setPlayerCase(id);
      setMessage(`Case ${id} is yours. Open ${casesThisRound} other cases.`);
      ping(820, 0.18);
      return;
    }
    if (id === playerCase) return;
    const selected = cases.find((item) => item.id === id);
    if (!selected || selected.opened) return;
    const updated = cases.map((item) => item.id === id ? { ...item, opened: true } : item);
    const openedInRoundAfter = openedThisRound + 1;
    setCases(updated);
    setOpenedThisRound(openedInRoundAfter);
    setLastOpened(selected);
    ping(selected.value >= 5000 ? 210 : 720, 0.22);

    const stillClosed = updated.filter((item) => !item.opened);
    if (stillClosed.length === 2) {
      setMessage("Only two cases remain. The Banker is calling!");
      makeOffer(stillClosed, round);
    } else if (openedInRoundAfter >= casesThisRound) {
      setMessage("The Banker is calling…");
      window.setTimeout(() => makeOffer(stillClosed, round), 450);
    } else {
      setMessage(`Open ${casesThisRound - openedInRoundAfter} more case${casesThisRound - openedInRoundAfter === 1 ? "" : "s"}.`);
    }
  }

  function makeOffer(closed: CaseItem[], currentRound: number) {
    const average = closed.reduce((sum, item) => sum + item.value, 0) / closed.length;
    const riskFactor = Math.min(0.93, 0.48 + currentRound * 0.075);
    const calculated = Math.max(1, Math.round((average * riskFactor) / 5) * 5);
    setOffer(calculated);
    ping(390, 0.45);
  }

  function noDeal() {
    if (remaining.length === 2 && playerCase !== null) {
      const mine = cases.find((item) => item.id === playerCase);
      if (!mine) return;
      setOffer(null);
      setLastOpened(null);
      setFinalReveal("suspense");
      setMessage("NO DEAL! Your case will now be revealed…");
      ping(170, 0.7);

      window.setTimeout(() => {
        setFinalReveal("flash");
        ping(1050, 0.3);
      }, 1800);

      window.setTimeout(() => {
        setCases((current) => current.map((item) =>
          item.id === playerCase ? { ...item, opened: true } : item
        ));
        setLastOpened(mine);
        setFinalReveal("revealed");
        setGameOver(true);
        setMessage(`Your case contained ${formatValue(mine.value, unit)}!`);
        ping(mine.value >= 100000 ? 1150 : 720, 0.85);
      }, 2350);
      return;
    }

    const nextRound = round + 1;
    setOffer(null);
    setRound(nextRound);
    setOpenedThisRound(0);
    setLastOpened(null);
    const nextCount = Math.max(1, 6 - nextRound);
    setMessage(`No Deal! Open ${nextCount} more case${nextCount === 1 ? "" : "s"}.`);
    ping(760, 0.2);
  }

  function deal() {
    if (offer === null) return;
    setGameOver(true);
    setMessage(`DEAL! You won ${formatValue(offer, unit)}.`);
    ping(980, 0.65);
  }

  function revealPlayerCase() {
    if (playerCase === null) return;
    const mine = cases.find((item) => item.id === playerCase);
    if (!mine) return;
    setCases((current) => current.map((item) => item.id === playerCase ? { ...item, opened: true } : item));
    setLastOpened(mine);
    setGameOver(true);
    setOffer(null);
    setMessage(`Your case contained ${formatValue(mine.value, unit)}!`);
    ping(900, 0.5);
  }

  function applySetup() {
    const parsed = draftValues
      .split(/[,\n]/)
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .slice(0, 30);
    if (parsed.length < 6) {
      setMessage("Please enter at least 6 valid prize values.");
      return;
    }
    reset(parsed);
  }

  const sortedValues = [...new Set(cases.map((item) => item.value))].sort((a, b) => a - b);
  const boardSplit = Math.ceil(sortedValues.length / 2);
  const activeValueSet = new Set(remainingValues);

  return (
    <main className="game-shell">
      <div className="stage-lights" aria-hidden="true" />
      <header className="topbar">
        <button className="brand" onClick={() => reset()} aria-label="Start a new game">
          <span>DEAL</span><i>OR</i><span>NO DEAL</span>
        </button>
        <div className="top-actions">
          <button onClick={() => setSoundOn(!soundOn)}>{soundOn ? "🔊 Sound" : "🔇 Muted"}</button>
          <button onClick={() => setShowRules(true)}>How to play</button>
          <button className="gold-button" onClick={() => setShowSetup(true)}>Game setup</button>
        </div>
      </header>

      <section className="score-strip">
        <div><small>ROUND</small><strong>{round}</strong></div>
        <div className="status"><span className="live-dot" />{message}</div>
        <div><small>CASES LEFT</small><strong>{remaining.length}</strong></div>
      </section>

      <section className="game-board">
        <aside className="money-board left">
          {sortedValues.slice(0, boardSplit).map((value) => (
            <div key={value} className={activeValueSet.has(value) ? "" : "gone"}>{formatValue(value, unit)}</div>
          ))}
        </aside>

        <div className="center-stage">
          <div className="case-grid">
            {cases.map((item) => {
              const isMine = item.id === playerCase;
              return (
                <button
                  key={item.id}
                  className={`case ${item.opened ? "opened" : ""} ${isMine ? "mine" : ""}`}
                  onClick={() => selectCase(item.id)}
                  disabled={item.opened || gameOver || offer !== null}
                  aria-label={item.opened ? `Case ${item.id}, opened` : `Open case ${item.id}`}
                >
                  <span className="handle" />
                  <span className="case-face">{item.opened ? formatValue(item.value, unit) : item.id}</span>
                  {isMine && !item.opened && <em>YOUR CASE</em>}
                </button>
              );
            })}
          </div>

          {lastOpened && !offer && (
            <div className="reveal-banner" role="status">
              <small>CASE {lastOpened.id} CONTAINED</small>
              <strong>{formatValue(lastOpened.value, unit)}</strong>
            </div>
          )}

          {gameOver && (
            <div className="final-card">
              <span>GAME COMPLETE</span>
              <h2>{message}</h2>
              {playerCase && !cases.find((item) => item.id === playerCase)?.opened && (
                <button onClick={revealPlayerCase}>Reveal my case</button>
              )}
              <button className="gold-button" onClick={() => reset(cases.map((item) => item.value))}>Play again</button>
            </div>
          )}
        </div>

        <aside className="money-board right">
          {sortedValues.slice(boardSplit).map((value) => (
            <div key={value} className={activeValueSet.has(value) ? "" : "gone"}>{formatValue(value, unit)}</div>
          ))}
        </aside>
      </section>

      <footer className="control-desk">
        <div className="progress-copy">
          <small>NEXT BANKER CALL</small>
          <strong>{playerCase === null ? "Select your case" : `${Math.max(0, casesThisRound - openedThisRound)} case${Math.max(0, casesThisRound - openedThisRound) === 1 ? "" : "s"} to open`}</strong>
        </div>
        <button className="reset-button" onClick={() => reset(cases.map((item) => item.value))}>↻ New game</button>
      </footer>

      {offer !== null && !gameOver && (
        <div className="modal-backdrop">
          <section className="banker-modal" role="dialog" aria-modal="true" aria-label="Banker offer">
            <div className="phone">☎</div>
            <p>THE BANKER OFFERS</p>
            <h2>{formatValue(offer, unit)}</h2>
            <div className="decision-buttons">
              <button className="deal" onClick={deal}>DEAL</button>
              <button className="no-deal" onClick={noDeal}>NO DEAL</button>
            </div>
          </section>
        </div>
      )}

      {finalReveal !== "idle" && (
        <div className={`final-reveal-overlay ${finalReveal}`} role="status" aria-live="assertive">
          <div className="reveal-glow" aria-hidden="true" />
          {finalReveal === "revealed" ? (
            <div className="revealed-prize">
              <small>YOUR CASE CONTAINED</small>
              <strong>{lastOpened ? formatValue(lastOpened.value, unit) : ""}</strong>
              <span>CONGRATULATIONS!</span>
              <button className="gold-button" onClick={() => setFinalReveal("idle")}>Continue</button>
            </div>
          ) : (
            <>
              <p>NO DEAL</p>
              <small>THE MOMENT OF TRUTH</small>
              <div className="mystery-case">
                <span className="handle" />
                <strong>{playerCase}</strong>
                <em>YOUR CASE</em>
              </div>
              <h2>{finalReveal === "flash" ? "REVEAL!" : "WHAT'S INSIDE?"}</h2>
            </>
          )}
        </div>
      )}

      {showSetup && (
        <div className="modal-backdrop">
          <section className="setup-modal" role="dialog" aria-modal="true" aria-label="Game setup">
            <button className="close" onClick={() => setShowSetup(false)}>×</button>
            <p className="eyebrow">TEACHER CONTROLS</p>
            <h2>Customize your classroom game</h2>
            <label>
              Prize label
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                <option>Points</option>
                <option>Stars</option>
                <option>Coins</option>
                <option>₱</option>
              </select>
            </label>
            <label>
              Prize values <span>(comma-separated, 6–30 cases)</span>
              <textarea value={draftValues} onChange={(event) => setDraftValues(event.target.value)} rows={5} />
            </label>
            <button className="gold-button wide" onClick={applySetup}>Shuffle & start game</button>
          </section>
        </div>
      )}

      {showRules && (
        <div className="modal-backdrop">
          <section className="setup-modal rules" role="dialog" aria-modal="true" aria-label="How to play">
            <button className="close" onClick={() => setShowRules(false)}>×</button>
            <p className="eyebrow">QUICK GUIDE</p>
            <h2>How to play</h2>
            <ol>
              <li>Choose one case to keep as the player’s personal case.</li>
              <li>Open the required number of cases each round.</li>
              <li>When the Banker calls, decide as a class: Deal or No Deal?</li>
              <li>Accept the offer, or keep playing for the value inside your case.</li>
            </ol>
            <p className="teacher-tip">Teacher tip: Ask a review question before allowing the student or team to open a case.</p>
          </section>
        </div>
      )}
    </main>
  );
}
