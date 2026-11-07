import { useCallback, useEffect, useRef, useState } from "react";
import "./Games.css";

const BEST_SCORE_KEY = "veloce.emoji-rush.best.v1";
const HAZARDS = ["⚡", "🔥", "💣", "🪨", "☄️"];

function readBestScore() {
  try {
    return Number(window.localStorage.getItem(BEST_SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function Games({ onBack }) {
  const canvasRef = useRef(null);
  const gameRef = useRef({
    running: false,
    width: 0,
    height: 0,
    player: { x: 0, y: 0, radius: 19 },
    target: null,
    obstacles: [],
    keys: {},
    elapsed: 0,
    score: 0,
    nextSpawn: 0.55,
    lastHudScore: -1,
  });
  const [phase, setPhase] = useState("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(readBestScore);

  const startGame = useCallback(() => {
    const game = gameRef.current;
    game.running = true;
    game.player = {
      x: game.width / 2,
      y: game.height / 2,
      radius: 19,
    };
    game.target = null;
    game.obstacles = [];
    game.keys = {};
    game.elapsed = 0;
    game.score = 0;
    game.nextSpawn = 0.55;
    game.lastHudScore = -1;
    setScore(0);
    setPhase("playing");
  }, []);

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
        x,
        y,
        vx: (dx / distance) * speed,
        vy: (dy / distance) * speed,
        radius: 15 + Math.random() * 5,
        icon: HAZARDS[Math.floor(Math.random() * HAZARDS.length)],
      });
    };

    const draw = () => {
      const width = game.width;
      const height = game.height;
      const background = context.createLinearGradient(0, 0, width, height);
      background.addColorStop(0, "#141c3b");
      background.addColorStop(0.55, "#20204b");
      background.addColorStop(1, "#35204f");
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(188, 193, 255, .075)";
      context.lineWidth = 1;
      const gridSize = 42;
      for (let x = 0; x < width; x += gridSize) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();

      game.obstacles.forEach((hazard) => {
        context.beginPath();
        context.fillStyle = "rgba(255, 116, 143, .16)";
        context.arc(hazard.x, hazard.y, hazard.radius + 9, 0, Math.PI * 2);
        context.fill();
        context.font = `${hazard.radius * 2}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(hazard.icon, hazard.x, hazard.y);
      });

      const player = game.player;
      context.beginPath();
      context.fillStyle = "rgba(142, 244, 255, .17)";
      context.arc(player.x, player.y, player.radius + 12, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.strokeStyle = "rgba(168, 248, 255, .78)";
      context.lineWidth = 2;
      context.arc(player.x, player.y, player.radius + 4, 0, Math.PI * 2);
      context.stroke();
      context.font = `${player.radius * 2}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
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

        game.obstacles.forEach((hazard) => {
          hazard.x += hazard.vx * delta;
          hazard.y += hazard.vy * delta;
        });

        const collided = game.obstacles.some((hazard) =>
          Math.hypot(hazard.x - game.player.x, hazard.y - game.player.y) < game.player.radius + hazard.radius - 4,
        );
        game.obstacles = game.obstacles.filter((hazard) =>
          hazard.x > -60 && hazard.x < game.width + 60
          && hazard.y > -60 && hazard.y < game.height + 60,
        );
        if (collided) {
          game.running = false;
          const finalScore = game.score;
          setScore(finalScore);
          setPhase("finished");
          if (finalScore > bestScoreRef.current) {
            bestScoreRef.current = finalScore;
            setBestScore(finalScore);
            try { window.localStorage.setItem(BEST_SCORE_KEY, String(finalScore)); } catch { /* Stockage facultatif. */ }
          }
        } else if (game.score !== game.lastHudScore) {
          game.lastHudScore = game.score;
          setScore(game.score);
        }
      }

      draw();
      animationFrame = window.requestAnimationFrame(frame);
    };

    const bestScoreRef = { current: readBestScore() };
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

  return (
    <section className="games-page">
      <button type="button" className="games-back" onClick={onBack}>← Retour à Explorer</button>

      <header className="games-hero">
        <span className="games-hero-icon" aria-hidden="true">🎮</span>
        <div>
          <span className="games-eyebrow">L’ESPACE LUDIQUE DE VELOCE</span>
          <h1>Jeux</h1>
          <p>Un jeu rapide, ouvert à toute la communauté Veloce. Évite les pièges et bats ton record.</p>
        </div>
      </header>

      <section className="emoji-rush-card" aria-labelledby="emoji-rush-title">
        <div className="emoji-rush-heading">
          <div>
            <span className="games-eyebrow">JEU VELOCE · 1 JOUEUR</span>
            <h2 id="emoji-rush-title">Émoji Rush</h2>
            <p>Guide ton émoji, esquive les dangers et tiens le plus longtemps possible.</p>
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
            aria-label="Terrain de jeu Émoji Rush. Déplace le personnage avec la souris, le doigt ou les flèches du clavier."
            onPointerDown={capturePointer}
            onPointerMove={updateTarget}
          />
          {phase !== "playing" && (
            <div className="emoji-rush-overlay">
              <span className="emoji-rush-overlay-icon" aria-hidden="true">{phase === "finished" ? "💥" : "😎"}</span>
              <strong>{phase === "finished" ? "Partie terminée" : "Prêt à jouer ?"}</strong>
              <p>{phase === "finished" ? `Tu as marqué ${score} points. Essaie encore pour battre ton record.` : "Déplace la souris ou ton doigt pour guider ton émoji. Les flèches marchent aussi."}</p>
              <button type="button" onClick={startGame}>{phase === "finished" ? "Rejouer" : "Jouer maintenant"}<span aria-hidden="true"> →</span></button>
            </div>
          )}
          <div className="emoji-rush-live-score" aria-hidden="true">{phase === "playing" ? `${score} pts` : ""}</div>
        </div>

        <div className="emoji-rush-footer">
          <span><i className="emoji-rush-key-pointer" /> Souris ou doigt pour bouger</span>
          <span><i className="emoji-rush-keyboard">⌨</i> Flèches ou ZQSD</span>
          <span className="emoji-rush-growth">Plus tu avances, plus ton émoji grandit</span>
        </div>
      </section>

      <p className="games-community-note"><span aria-hidden="true">🌐</span> Le jeu est disponible pour tous les membres de Veloce. Ton record est conservé sur cet appareil.</p>
    </section>
  );
}

export default Games;
