import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/authContext";
import { openEmojiRushGift, startEmojiRushRun } from "../services/gameService";
import "./Games.css";

const BEST_SCORE_KEY = "veloce.emoji-rush.best.v1";
const MEMORY_BEST_KEY = "veloce.memory-flash.best.v1";
const HAZARDS = ["⚡", "🔥", "💣", "🪨", "☄️"];
const MEMORY_SYMBOLS = ["🌙", "🍀", "🎧", "🚀", "🦊", "💎"];

function readNumber(key) {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function shuffledMemoryCards() {
  return [...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]
    .map((symbol, index) => ({ id: `${symbol}-${index}`, symbol }))
    .sort(() => Math.random() - 0.5);
}

function MemoryFlash({ onShareScore }) {
  const [cards, setCards] = useState(shuffledMemoryCards);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState("ready");
  const [bestMoves, setBestMoves] = useState(() => readNumber(MEMORY_BEST_KEY));
  const locked = useRef(false);
  const timeout = useRef(null);

  useEffect(() => () => window.clearTimeout(timeout.current), []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const start = () => {
    window.clearTimeout(timeout.current);
    locked.current = false;
    setCards(shuffledMemoryCards());
    setFlipped([]);
    setMatched([]);
    setMoves(0);
    setSeconds(0);
    setPhase("playing");
  };

  const flip = (index) => {
    if (phase !== "playing" || locked.current || flipped.includes(index) || matched.includes(index)) return;
    if (flipped.length === 0) {
      setFlipped([index]);
      return;
    }

    const firstIndex = flipped[0];
    const nextMoves = moves + 1;
    const isMatch = cards[firstIndex].symbol === cards[index].symbol;
    setFlipped([firstIndex, index]);
    setMoves(nextMoves);
    locked.current = true;
    timeout.current = window.setTimeout(() => {
      if (isMatch) {
        setMatched((previous) => [...previous, firstIndex, index]);
        if (matched.length + 2 === cards.length) {
          setPhase("won");
          setBestMoves((previous) => {
            const best = previous === 0 ? nextMoves : Math.min(previous, nextMoves);
            try { window.localStorage.setItem(MEMORY_BEST_KEY, String(best)); } catch { /* Enregistrement facultatif. */ }
            return best;
          });
        }
      }
      setFlipped([]);
      locked.current = false;
    }, isMatch ? 320 : 760);
  };

  return (
    <section className="memory-flash-card" aria-labelledby="memory-flash-title">
      <div className="memory-flash-heading">
        <div>
          <span className="games-eyebrow">JEU VELOCE · MÉMOIRE</span>
          <h2 id="memory-flash-title">Mémoire Flash</h2>
          <p>Retourne les cartes et retrouve les six paires le plus vite possible.</p>
        </div>
        <div className="memory-flash-stats" aria-live="polite">
          <span><small>COUPS</small><strong>{moves}</strong></span>
          <span><small>TEMPS</small><strong>{seconds}s</strong></span>
          <span><small>RECORD</small><strong>{bestMoves ? `${bestMoves} coups` : "—"}</strong></span>
        </div>
      </div>

      <div className={`memory-flash-board is-${phase}`}>
        {cards.map((card, index) => {
          const isVisible = flipped.includes(index) || matched.includes(index);
          return (
            <button
              key={card.id}
              type="button"
              className={`memory-flash-tile${isVisible ? " is-visible" : ""}${matched.includes(index) ? " is-matched" : ""}`}
              onClick={() => flip(index)}
              disabled={phase !== "playing" || locked.current || matched.includes(index)}
              aria-label={isVisible ? `Carte ${card.symbol}` : "Retourner une carte"}
              aria-pressed={isVisible}
            >
              <span aria-hidden="true">{isVisible ? card.symbol : "✦"}</span>
            </button>
          );
        })}
        {phase !== "playing" && (
          <div className="memory-flash-overlay">
            <span aria-hidden="true">{phase === "won" ? "🏆" : "🧠"}</span>
            <strong>{phase === "won" ? "Toutes les paires trouvées !" : "À toi de jouer"}</strong>
            <p>{phase === "won" ? `Terminé en ${moves} coups et ${seconds} secondes.` : "Mémorise les symboles et associe les cartes deux par deux."}</p>
            {phase === "won" ? (
              <div className="memory-flash-actions">
                <button type="button" className="memory-flash-share" onClick={() => onShareScore?.(`🧠 J’ai trouvé les six paires dans Mémoire Flash en ${moves} coups et ${seconds} secondes sur Veloce. À ton tour !`)}>Partager mon score</button>
                <button type="button" onClick={start}>Rejouer</button>
              </div>
            ) : <button type="button" onClick={start}>Commencer</button>}
          </div>
        )}
      </div>
      <p className="memory-flash-note">Un jeu de mémoire calme, différent de la course d’obstacles. Ton meilleur nombre de coups reste enregistré sur cet appareil.</p>
    </section>
  );
}

function EmojiRushGame({ onShareScore }) {
  const { token } = useAuth();
  const canvasRef = useRef(null);
  const gameRef = useRef({
    running: false,
    width: 0,
    height: 0,
    player: { x: 0, y: 0, radius: 19 },
    target: null,
    obstacles: [],
    collectibles: [],
    keys: {},
    elapsed: 0,
    score: 0,
    nextSpawn: 0.55,
    nextCollectible: 4,
    shieldCount: 0,
    giftsFound: 0,
    runId: null,
    lastHudScore: -1,
  });
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readNumber(BEST_SCORE_KEY));
  const [shieldCount, setShieldCount] = useState(0);
  const [giftsFound, setGiftsFound] = useState(0);
  const [starting, setStarting] = useState(false);
  const [openingGift, setOpeningGift] = useState(false);
  const [giftResult, setGiftResult] = useState(null);
  const [giftError, setGiftError] = useState("");

  const startGame = useCallback(async () => {
    const game = gameRef.current;
    if (game.running || starting) return;
    setStarting(true);
    setGiftResult(null);
    setGiftError("");
    game.runId = null;
    if (token) {
      try {
        const run = await startEmojiRushRun({ token });
        game.runId = run.runId;
      } catch {
        setGiftError("La partie reste jouable, mais le service des surprises est momentanément hors ligne.");
      }
    }
    game.running = true;
    game.player = { x: game.width / 2, y: game.height / 2, radius: 19 };
    game.target = null;
    game.obstacles = [];
    game.collectibles = [];
    game.keys = {};
    game.elapsed = 0;
    game.score = 0;
    game.nextSpawn = 0.55;
    game.nextCollectible = 4;
    game.shieldCount = 0;
    game.giftsFound = 0;
    game.lastHudScore = -1;
    setScore(0);
    setShieldCount(0);
    setGiftsFound(0);
    setPhase("playing");
    setStarting(false);
  }, [starting, token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return undefined;

    const game = gameRef.current;
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      game.width = bounds.width;
      game.height = bounds.height;
      if (!game.running) {
        game.player.x = bounds.width / 2;
        game.player.y = bounds.height / 2;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const spawnHazard = () => {
      const side = Math.floor(Math.random() * 4);
      const margin = 22;
      let x = 0;
      let y = 0;
      if (side === 0) { x = -margin; y = Math.random() * game.height; }
      if (side === 1) { x = game.width + margin; y = Math.random() * game.height; }
      if (side === 2) { x = Math.random() * game.width; y = -margin; }
      if (side === 3) { x = Math.random() * game.width; y = game.height + margin; }
      const dx = game.player.x - x + (Math.random() - 0.5) * game.width * 0.35;
      const dy = game.player.y - y + (Math.random() - 0.5) * game.height * 0.35;
      const distance = Math.hypot(dx, dy) || 1;
      const speed = Math.min(430, 165 + game.elapsed * 8 + Math.random() * 45);
      game.obstacles.push({
        x, y,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        radius: 15 + Math.random() * 5,
        icon: HAZARDS[Math.floor(Math.random() * HAZARDS.length)],
      });
    };

    const spawnCollectible = () => {
      let x = game.width / 2;
      let y = game.height / 2;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        x = 28 + Math.random() * Math.max(1, game.width - 56);
        y = 28 + Math.random() * Math.max(1, game.height - 56);
        if (Math.hypot(x - game.player.x, y - game.player.y) > 72) break;
      }
      const type = Math.random() < 0.48 ? "shield" : "gift";
      game.collectibles.push({ x, y, radius: 15, type, age: 0 });
    };

    const draw = () => {
      const { width, height } = game;
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#141c3b");
      background.addColorStop(0.55, "#20204b");
      background.addColorStop(1, "#35204f");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(188, 193, 255, .075)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 42) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
      }
      for (let y = 0; y < height; y += 42) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
      }
      context.restore();

      game.collectibles.forEach((item) => {
        const pulse = 1 + Math.sin(performance.now() / 180 + item.x) * 0.08;
        const isShield = item.type === "shield";
        context.beginPath();
        context.fillStyle = isShield ? "rgba(89, 210, 255, .18)" : "rgba(255, 209, 102, .2)";
        context.arc(item.x, item.y, (item.radius + 10) * pulse, 0, Math.PI * 2);
        context.fill();
        context.font = "25px \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(isShield ? "🛡️" : "🎁", item.x, item.y);
      });

      game.obstacles.forEach((hazard) => {
        context.beginPath();
        context.fillStyle = "rgba(255, 116, 143, .16)";
        context.arc(hazard.x, hazard.y, hazard.radius + 9, 0, Math.PI * 2);
        context.fill();
        context.font = `${hazard.radius * 2}px \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(hazard.icon, hazard.x, hazard.y);
      });

      const player = game.player;
      if (game.shieldCount > 0) {
        context.beginPath();
        context.strokeStyle = "rgba(96, 224, 255, .9)";
        context.lineWidth = 3;
        context.arc(player.x, player.y, player.radius + 10 + Math.min(game.shieldCount, 2) * 3, 0, Math.PI * 2);
        context.stroke();
      }
      context.beginPath();
      context.fillStyle = "rgba(142, 244, 255, .17)";
      context.arc(player.x, player.y, player.radius + 12, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.strokeStyle = "rgba(168, 248, 255, .78)";
      context.lineWidth = 2;
      context.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      context.stroke();
      context.font = `${player.radius * 2}px \"Apple Color Emoji\", \"Segoe UI Emoji\", sans-serif`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("😎", player.x, player.y);
    };

    let animationFrame = 0;
    let previousTime = performance.now();
    const frame = (now) => {
      const delta = Math.min((now - previousTime) / 1000, 0.04);
      previousTime = now;

      if (game.running) {
        game.elapsed += delta;
        game.score = Math.floor(game.elapsed * 10);
        game.player.radius = Math.min(39, 19 + game.elapsed * 0.55);
        const horizontal = Number(game.keys.right) - Number(game.keys.left);
        const vertical = Number(game.keys.down) - Number(game.keys.up);
        if (horizontal || vertical) {
          const length = Math.hypot(horizontal, vertical) || 1;
          game.player.x += (horizontal / length) * 330 * delta;
          game.player.y += (vertical / length) * 330 * delta;
        } else if (game.target) {
          const follow = Math.min(1, delta * 11);
          game.player.x += (game.target.x - game.player.x) * follow;
          game.player.y += (game.target.y - game.player.y) * follow;
        }
        game.player.x = Math.max(game.player.radius, Math.min(game.width - game.player.radius, game.player.x));
        game.player.y = Math.max(game.player.radius, Math.min(game.height - game.player.radius, game.player.y));

        if (game.elapsed >= game.nextSpawn) {
          spawnHazard();
          game.nextSpawn += Math.max(0.27, 0.85 - game.elapsed * 0.009);
        }
        if (game.elapsed >= game.nextCollectible) {
          spawnCollectible();
          game.nextCollectible += Math.max(3.8, 7.5 - game.elapsed * 0.025);
        }

        game.obstacles.forEach((hazard) => {
          hazard.x += hazard.vx * delta;
          hazard.y += hazard.vy * delta;
        });

        let shieldsChanged = false;
        let giftsChanged = false;
        game.collectibles.forEach((item) => {
          item.age += delta;
          if (item.age < 15 && Math.hypot(item.x - game.player.x, item.y - game.player.y) < game.player.radius + item.radius) {
            item.age = 99;
            if (item.type === "shield") {
              game.shieldCount = Math.min(2, game.shieldCount + 1);
              shieldsChanged = true;
            } else {
              game.giftsFound += 1;
              giftsChanged = true;
            }
          }
        });
        game.collectibles = game.collectibles.filter((item) => item.age < 15);
        if (shieldsChanged) setShieldCount(game.shieldCount);
        if (giftsChanged) setGiftsFound(game.giftsFound);

        const hitHazard = game.obstacles.find((hazard) =>
          Math.hypot(hazard.x - game.player.x, hazard.y - game.player.y) < game.player.radius + hazard.radius - 4,
        );
        game.obstacles = game.obstacles.filter((hazard) =>
          hazard.x > -60 && hazard.x < game.width + 60 && hazard.y > -60 && hazard.y < game.height + 60,
        );
        if (hitHazard && game.shieldCount > 0) {
          game.obstacles = game.obstacles.filter((hazard) => hazard !== hitHazard);
          game.shieldCount -= 1;
          setShieldCount(game.shieldCount);
        } else if (hitHazard) {
          game.running = false;
          const finalScore = game.score;
          setScore(finalScore);
          setPhase("finished");
          if (finalScore > bestScoreRef.current) {
            bestScoreRef.current = finalScore;
            setBestScore(finalScore);
            try { window.localStorage.setItem(BEST_SCORE_KEY, String(finalScore)); } catch { /* Enregistrement facultatif. */ }
          }
        } else if (game.score !== game.lastHudScore) {
          game.lastHudScore = game.score;
          setScore(game.score);
        }
      }

      draw();
      animationFrame = window.requestAnimationFrame(frame);
    };

    const bestScoreRef = { current: readNumber(BEST_SCORE_KEY) };
    animationFrame = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, []);

  const updateTarget = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const game = gameRef.current;
    game.target = {
      x: ((event.clientX - bounds.left) / bounds.width) * game.width,
      y: ((event.clientY - bounds.top) / bounds.height) * game.height,
    };
  };

  const capturePointer = (event) => {
    updateTarget(event);
    if (event.pointerType === "touch") event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const openGift = async () => {
    const game = gameRef.current;
    if (!token || !game.runId || giftsFound < 1 || openingGift || giftResult) return;
    setOpeningGift(true);
    setGiftError("");
    try {
      const result = await openEmojiRushGift({ token, runId: game.runId, score, giftCount: giftsFound });
      setGiftResult(result);
    } catch (error) {
      setGiftError(error.message || "La surprise n’a pas pu être ouverte.");
    } finally {
      setOpeningGift(false);
    }
  };

  useEffect(() => {
    const movementKeys = {
      ArrowUp: "up", z: "up", Z: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", q: "left", Q: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const handleKeyDown = (event) => {
      const direction = movementKeys[event.key];
      if (!direction || !gameRef.current.running) return;
      event.preventDefault();
      gameRef.current.keys[direction] = true;
    };
    const handleKeyUp = (event) => {
      const direction = movementKeys[event.key];
      if (direction) gameRef.current.keys[direction] = false;
    };
    const releaseKeys = () => { gameRef.current.keys = {}; };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseKeys);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseKeys);
    };
  }, []);

  const shareRushScore = () => onShareScore?.(`🎮 J’ai marqué ${score} points dans Émoji Rush sur Veloce. Qui peut battre mon score ?`);

  return (
    <div className="games-detail">
      <section className="emoji-rush-card" aria-labelledby="emoji-rush-title">
        <div className="emoji-rush-heading">
          <div>
            <span className="games-eyebrow">JEU VELOCE · RÉFLEXES</span>
            <h2 id="emoji-rush-title">Émoji Rush</h2>
            <p>Esquive les dangers, ramasse les boucliers et garde les cadeaux pour la fin.</p>
          </div>
          <div className="emoji-rush-scores" aria-live="polite">
            <div><small>SCORE</small><strong>{score}</strong></div>
            <div><small>RECORD</small><strong>{bestScore}</strong></div>
          </div>
        </div>

        <div className={`emoji-rush-arena is-${phase}`}>
          <canvas
            ref={canvasRef}
            className="emoji-rush-canvas"
            aria-label="Terrain Émoji Rush. Guide ton personnage avec la souris, le doigt ou les flèches. Ramasse les boucliers et cadeaux."
            onPointerDown={capturePointer}
            onPointerMove={updateTarget}
          />
          {phase !== "playing" && (
            <div className="emoji-rush-overlay">
              <span className="emoji-rush-overlay-icon" aria-hidden="true">{phase === "finished" ? "💥" : "😎"}</span>
              <strong>{phase === "finished" ? "Partie terminée" : "Prêt à jouer ?"}</strong>
              <p>{phase === "finished" ? `Tu as marqué ${score} points. ${giftsFound ? `Tu as récupéré ${giftsFound} cadeau${giftsFound > 1 ? "x" : ""}.` : "Essaie de récupérer un cadeau pendant la prochaine partie."}` : "Déplace la souris ou ton doigt pour guider ton émoji. Les flèches marchent aussi."}</p>
              <button type="button" onClick={startGame} disabled={starting}>{starting ? "Préparation…" : phase === "finished" ? "Rejouer" : "Jouer maintenant"}<span aria-hidden="true"> →</span></button>
            </div>
          )}
          <div className="emoji-rush-live-score" aria-hidden="true">{phase === "playing" ? `${score} pts` : ""}</div>
          {phase === "playing" && <div className="emoji-rush-pickup-status" aria-live="polite"><span>🛡️ {shieldCount}</span><span>🎁 {giftsFound}</span></div>}
        </div>

        {phase === "finished" && (
          <div className="emoji-rush-result" aria-live="polite">
            <div className="emoji-rush-result-copy">
              <strong>Ton score : {score} points</strong>
              {giftsFound > 0
                ? <p>Tu as trouvé {giftsFound} cadeau{giftsFound > 1 ? "x" : ""}. Ouvre ta surprise : elle peut contenir jusqu’à 5 Piz.</p>
                : <p>Pas de cadeau cette fois. Récupère-en un dans l’arène pour tenter ta surprise de fin de partie.</p>}
              {giftError && <small role="status">{giftError}</small>}
              {giftResult && <small className="emoji-rush-prize" role="status">{giftResult.rewardPiz > 0 ? `🎉 Surprise : ${giftResult.rewardPiz} Piz ajoutés à ton portefeuille.` : "Tu as déjà atteint la limite quotidienne de 5 Piz de jeu."}</small>}
            </div>
            <div className="emoji-rush-result-actions">
              {giftsFound > 0 && <button type="button" className="emoji-rush-gift-button" onClick={openGift} disabled={openingGift || Boolean(giftResult) || !gameRef.current.runId}>{openingGift ? "Ouverture…" : giftResult ? "Cadeau ouvert" : "🎁 Ouvrir ma surprise"}</button>}
              <button type="button" className="emoji-rush-share-button" onClick={shareRushScore}>Partager mon score</button>
            </div>
          </div>
        )}

        <div className="emoji-rush-footer">
          <span><i className="emoji-rush-key-pointer" /> Souris ou doigt pour bouger</span>
          <span><i className="emoji-rush-keyboard">⌨</i> Flèches ou ZQSD</span>
          <span>🛡️ Un bouclier absorbe un choc</span>
          <span className="emoji-rush-growth">Plus tu avances, plus ton émoji grandit</span>
        </div>
      </section>
    </div>
  );
}

function Games({ onBack, onShareScore }) {
  const [selectedGame, setSelectedGame] = useState(null);
  const isEmojiRush = selectedGame === "emoji-rush";

  return (
    <section className="games-page">
      <button
        type="button"
        className="games-back"
        onClick={() => selectedGame ? setSelectedGame(null) : onBack?.()}
      >
        {selectedGame ? "← Tous les jeux" : "← Retour à Explorer"}
      </button>

      {selectedGame ? <>
        <header className="games-detail-title">
          <span className="games-eyebrow">JEU VELOCE · {isEmojiRush ? "RÉFLEXES" : "MÉMOIRE"}</span>
          <h1>{isEmojiRush ? "Émoji Rush" : "Mémoire Flash"}</h1>
          <p>{isEmojiRush ? "Esquive les dangers et ramasse des boucliers." : "Retourne les cartes et retrouve les six paires."}</p>
        </header>
        {isEmojiRush
          ? <EmojiRushGame onShareScore={onShareScore} />
          : <MemoryFlash onShareScore={onShareScore} />}
        {isEmojiRush && <p className="games-community-note"><span aria-hidden="true">🌐</span> Les records sont conservés sur cet appareil. Les surprises Piz sont distribuées par le serveur, avec une limite de 5 Piz par jour et par compte.</p>}
      </> : <>
        <header className="games-hero">
          <span className="games-hero-icon" aria-hidden="true">🎮</span>
          <div>
            <span className="games-eyebrow">L’ESPACE LUDIQUE DE VELOCE</span>
            <h1>Jeux</h1>
            <p>Choisis un jeu, bats tes records et partage tes scores.</p>
          </div>
        </header>

        <div className="games-catalog" aria-label="Catalogue des jeux">
          <button type="button" className="games-catalog-card" onClick={() => setSelectedGame("emoji-rush")}>
            <span className="games-catalog-icon rush" aria-hidden="true">😎</span>
            <span className="games-catalog-category">RÉFLEXES · ACTION</span>
            <strong>Émoji Rush</strong>
            <span className="games-catalog-description">Esquive les obstacles, grandis et collecte des surprises.</span>
            <span className="games-catalog-play"><span>Jouer</span><span aria-hidden="true">→</span></span>
          </button>
          <button type="button" className="games-catalog-card" onClick={() => setSelectedGame("memory-flash")}>
            <span className="games-catalog-icon memory" aria-hidden="true">🧠</span>
            <span className="games-catalog-category">MÉMOIRE · RÉFLEXION</span>
            <strong>Mémoire Flash</strong>
            <span className="games-catalog-description">Retrouve les paires avec le moins de coups possible.</span>
            <span className="games-catalog-play"><span>Jouer</span><span aria-hidden="true">→</span></span>
          </button>
        </div>

        <p className="games-community-note"><span aria-hidden="true">🌐</span> Les jeux seront ajoutés ici sous forme de vignettes compactes. Tes records sont conservés sur cet appareil.</p>
      </>}
    </section>
  );
}

export default Games;
