import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const CANVAS_W = 360;
const CANVAS_H = 600;
const ROAD_MARGIN = 28;
const ROAD_W = CANVAS_W - 2 * ROAD_MARGIN;
const LANE_W = ROAD_W / 3;
const LANE_CENTERS: number[] = [0, 1, 2].map(
  (i) => ROAD_MARGIN + LANE_W * i + LANE_W / 2,
);

const CAR_W = 42;
const CAR_H = 68;
const PLAYER_Y = CANVAS_H - 120;
const BASE_SPEED = 3.2;
const DASH_LENGTH = 28;
const DASH_GAP = 18;
const DASH_TOTAL = DASH_LENGTH + DASH_GAP;

const ENEMY_COLORS = ["#ff3d3d", "#ff7a1f", "#ff5a5a", "#e84545"];

type GameStatus = "idle" | "playing" | "over";

interface EnemyCar {
  lane: number;
  y: number;
  color: string;
}

function getSpeed(score: number): number {
  return BASE_SPEED * (1 + Math.floor(score / 5) * 0.1);
}

function randomEnemyColor(): string {
  return ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)];
}

function initEnemies(): EnemyCar[] {
  return [0, 1, 2].map((i) => ({
    lane: i,
    y: -(CAR_H + 80 + i * 180),
    color: randomEnemyColor(),
  }));
}

// ── Draw Helpers (literal colors — cannot use CSS vars in Canvas API) ────────

function drawRoad(ctx: CanvasRenderingContext2D, offset: number) {
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#0d1a0e";
  ctx.fillRect(0, 0, ROAD_MARGIN, CANVAS_H);
  ctx.fillRect(CANVAS_W - ROAD_MARGIN, 0, ROAD_MARGIN, CANVAS_H);

  const grad = ctx.createLinearGradient(
    ROAD_MARGIN,
    0,
    CANVAS_W - ROAD_MARGIN,
    0,
  );
  grad.addColorStop(0, "#16161f");
  grad.addColorStop(0.5, "#1c1c28");
  grad.addColorStop(1, "#16161f");
  ctx.fillStyle = grad;
  ctx.fillRect(ROAD_MARGIN, 0, ROAD_W, CANVAS_H);

  ctx.fillStyle = "rgba(255,255,255,0.012)";
  ctx.fillRect(ROAD_MARGIN + ROAD_W / 2 - 6, 0, 12, CANVAS_H);

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ROAD_MARGIN, 0);
  ctx.lineTo(ROAD_MARGIN, CANVAS_H);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(CANVAS_W - ROAD_MARGIN, 0);
  ctx.lineTo(CANVAS_W - ROAD_MARGIN, CANVAS_H);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([DASH_LENGTH, DASH_GAP]);
  ctx.lineDashOffset = -(offset % DASH_TOTAL);
  for (let lane = 1; lane <= 2; lane++) {
    const x = ROAD_MARGIN + LANE_W * lane;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  const leftGlow = ctx.createLinearGradient(0, 0, ROAD_MARGIN + 20, 0);
  leftGlow.addColorStop(0, "rgba(0,212,255,0.0)");
  leftGlow.addColorStop(1, "rgba(0,212,255,0.04)");
  ctx.fillStyle = leftGlow;
  ctx.fillRect(0, 0, ROAD_MARGIN + 20, CANVAS_H);

  const rightGlow = ctx.createLinearGradient(
    CANVAS_W - ROAD_MARGIN - 20,
    0,
    CANVAS_W,
    0,
  );
  rightGlow.addColorStop(0, "rgba(0,212,255,0.04)");
  rightGlow.addColorStop(1, "rgba(0,212,255,0.0)");
  ctx.fillStyle = rightGlow;
  ctx.fillRect(CANVAS_W - ROAD_MARGIN - 20, 0, ROAD_MARGIN + 20, CANVAS_H);
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  bodyColor: string,
  glassColor: string,
  glowColor: string | null,
) {
  const x = cx - CAR_W / 2;
  const y = cy;

  if (glowColor) {
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 22;
  }
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(x, y, CAR_W, CAR_H, 6);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = glassColor;
  ctx.beginPath();
  ctx.roundRect(x + 7, y + 6, CAR_W - 14, 19, 3);
  ctx.fill();

  ctx.fillStyle = glassColor;
  ctx.beginPath();
  ctx.roundRect(x + 7, y + CAR_H - 23, CAR_W - 14, 15, 3);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x + CAR_W / 2 - 3, y + 2, 6, CAR_H - 4);

  ctx.fillStyle = "#111118";
  const ww = 6;
  const wh = 14;
  ctx.fillRect(x - ww + 1, y + 10, ww, wh);
  ctx.fillRect(x + CAR_W - 1, y + 10, ww, wh);
  ctx.fillRect(x - ww + 1, y + CAR_H - 24, ww, wh);
  ctx.fillRect(x + CAR_W - 1, y + CAR_H - 24, ww, wh);

  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(x - ww + 2, y + 13, 2, 4);
  ctx.fillRect(x + CAR_W, y + 13, 2, 4);
  ctx.fillRect(x - ww + 2, y + CAR_H - 21, 2, 4);
  ctx.fillRect(x + CAR_W, y + CAR_H - 21, 2, 4);

  if (glowColor !== null) {
    ctx.fillStyle = "rgba(220,240,255,0.95)";
    ctx.beginPath();
    ctx.roundRect(x + 5, y + CAR_H - 8, 10, 6, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + CAR_W - 15, y + CAR_H - 8, 10, 6, 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "rgba(255,60,60,0.9)";
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 3, 9, 5, 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + CAR_W - 14, y + 3, 9, 5, 2);
    ctx.fill();
  }
}

function drawSpeedLines(
  ctx: CanvasRenderingContext2D,
  speed: number,
  frame: number,
) {
  const level = Math.min((speed - BASE_SPEED) / (BASE_SPEED * 2), 1);
  if (level <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(0,212,255,${0.07 * level})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const seed = (frame * 7 + i * 31) % 100;
    const y1 = (seed * 63) % CANVAS_H;
    const len = 20 + (seed % 50);
    const lx = 4 + (seed % (ROAD_MARGIN - 8));
    ctx.beginPath();
    ctx.moveTo(lx, y1);
    ctx.lineTo(lx, y1 + len);
    ctx.stroke();
    const rx = CANVAS_W - ROAD_MARGIN + 4 + (seed % (ROAD_MARGIN - 8));
    ctx.beginPath();
    ctx.moveTo(rx, y1);
    ctx.lineTo(rx, y1 + len);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return Number.parseInt(localStorage.getItem("car-race-high") ?? "0", 10);
    } catch {
      return 0;
    }
  });
  const [gameStatus, setGameStatus] = useState<GameStatus>("idle");

  const statusRef = useRef<GameStatus>("idle");
  const rafRef = useRef<number>(0);
  const frameRef = useRef(0);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const playerXRef = useRef(LANE_CENTERS[1]);
  const playerTargetXRef = useRef(LANE_CENTERS[1]);
  const roadOffsetRef = useRef(0);
  const enemiesRef = useRef<EnemyCar[]>([]);

  highScoreRef.current = highScore;

  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    scoreRef.current = 0;
    frameRef.current = 0;
    playerXRef.current = LANE_CENTERS[1];
    playerTargetXRef.current = LANE_CENTERS[1];
    roadOffsetRef.current = 0;
    enemiesRef.current = initEnemies();
    statusRef.current = "playing";
    setScore(0);
    setGameStatus("playing");
  }, []);

  const gameLoop = useCallback(() => {
    if (statusRef.current !== "playing") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    frameRef.current += 1;
    const speed = getSpeed(scoreRef.current);

    const dx = playerTargetXRef.current - playerXRef.current;
    playerXRef.current += dx * 0.2;

    const minX = ROAD_MARGIN + CAR_W / 2 + 2;
    const maxX = CANVAS_W - ROAD_MARGIN - CAR_W / 2 - 2;
    if (playerXRef.current < minX) playerXRef.current = minX;
    if (playerXRef.current > maxX) playerXRef.current = maxX;

    roadOffsetRef.current += speed;

    for (const enemy of enemiesRef.current) {
      enemy.y += speed;

      if (enemy.y > CANVAS_H + CAR_H + 20) {
        const newScore = scoreRef.current + 1;
        scoreRef.current = newScore;
        setScore(newScore);
        if (newScore > highScoreRef.current) {
          highScoreRef.current = newScore;
          setHighScore(newScore);
          try {
            localStorage.setItem("car-race-high", String(newScore));
          } catch {
            /* noop */
          }
        }
        const occupiedLanes = enemiesRef.current
          .filter((e) => e !== enemy && e.y > -CAR_H * 2)
          .map((e) => e.lane);
        const freeLanes = [0, 1, 2].filter((l) => !occupiedLanes.includes(l));
        enemy.lane =
          freeLanes.length > 0
            ? freeLanes[Math.floor(Math.random() * freeLanes.length)]
            : Math.floor(Math.random() * 3);
        enemy.y = -(CAR_H + 60 + Math.random() * 160);
        enemy.color = randomEnemyColor();
      }
    }

    const px = playerXRef.current - CAR_W / 2;
    const py = PLAYER_Y;
    for (const enemy of enemiesRef.current) {
      const ex = LANE_CENTERS[enemy.lane] - CAR_W / 2;
      const ey = enemy.y;
      const overlap =
        px < ex + CAR_W - 4 &&
        px + CAR_W - 4 > ex &&
        py < ey + CAR_H - 4 &&
        py + CAR_H - 4 > ey;
      if (overlap) {
        statusRef.current = "over";
        setGameStatus("over");
        return;
      }
    }

    drawRoad(ctx, roadOffsetRef.current);
    drawSpeedLines(ctx, speed, frameRef.current);
    for (const enemy of enemiesRef.current) {
      drawCar(
        ctx,
        LANE_CENTERS[enemy.lane],
        enemy.y,
        enemy.color,
        "rgba(18,2,2,0.85)",
        null,
      );
    }
    drawCar(
      ctx,
      playerXRef.current,
      PLAYER_Y,
      "#00d4ff",
      "rgba(0,16,28,0.85)",
      "#00d4ff",
    );

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    if (gameStatus === "playing") {
      rafRef.current = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [gameStatus, gameLoop]);

  useEffect(() => {
    if (gameStatus !== "idle") return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawRoad(ctx, 0);
    drawCar(
      ctx,
      LANE_CENTERS[1],
      PLAYER_Y,
      "#00d4ff",
      "rgba(0,16,28,0.85)",
      "#00d4ff",
    );
    drawCar(ctx, LANE_CENTERS[0], 120, "#ff3d3d", "rgba(18,2,2,0.85)", null);
    drawCar(ctx, LANE_CENTERS[2], 260, "#ff7a1f", "rgba(18,2,2,0.85)", null);
  }, [gameStatus]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
      if (
        statusRef.current === "idle" &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        startGame();
        return;
      }
      if (statusRef.current !== "playing") return;
      const minX = ROAD_MARGIN + CAR_W / 2 + 2;
      const maxX = CANVAS_W - ROAD_MARGIN - CAR_W / 2 - 2;
      if (e.key === "ArrowLeft") {
        playerTargetXRef.current = Math.max(
          minX,
          playerTargetXRef.current - LANE_W,
        );
      } else if (e.key === "ArrowRight") {
        playerTargetXRef.current = Math.min(
          maxX,
          playerTargetXRef.current + LANE_W,
        );
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [startGame]);

  function handleTouchStart(_e: React.TouchEvent) {
    if (statusRef.current === "idle") {
      startGame();
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (statusRef.current !== "playing") return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const scale = CANVAS_W / rect.width;
    const canvasTouchX = touchX * scale;
    const minX = ROAD_MARGIN + CAR_W / 2 + 2;
    const maxX = CANVAS_W - ROAD_MARGIN - CAR_W / 2 - 2;
    playerTargetXRef.current = Math.max(minX, Math.min(maxX, canvasTouchX));
  }

  const levelDisplay = Math.floor(score / 5) + 1;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between py-6 px-4 font-mono">
      <header className="text-center mb-4">
        <h1
          className="text-4xl md:text-5xl font-display font-black tracking-widest uppercase"
          style={{
            color: "oklch(var(--race-cyan))",
            textShadow:
              "0 0 30px oklch(var(--race-cyan) / 0.7), 0 0 60px oklch(var(--race-cyan) / 0.3)",
          }}
        >
          SPEED RUSH
        </h1>
        <p className="text-muted-foreground text-xs tracking-[0.35em] mt-1 uppercase">
          Neon Racer
        </p>
      </header>

      <div
        data-ocid="score.panel"
        className="flex gap-6 md:gap-12 mb-4 px-6 py-3 rounded-sm border border-border bg-card"
      >
        <div className="text-center">
          <div className="text-xs text-muted-foreground tracking-widest mb-1">
            SCORE
          </div>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{
              color: "oklch(var(--race-cyan))",
              textShadow: "0 0 12px oklch(var(--race-cyan) / 0.5)",
            }}
          >
            {String(score).padStart(4, "0")}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-xs text-muted-foreground tracking-widest mb-1">
            BEST
          </div>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            {String(highScore).padStart(4, "0")}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-xs text-muted-foreground tracking-widest mb-1">
            LEVEL
          </div>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{
              color: "oklch(var(--race-orange))",
              textShadow: "0 0 10px oklch(var(--race-orange) / 0.5)",
            }}
          >
            {String(levelDisplay).padStart(2, "0")}
          </div>
        </div>
      </div>

      <main className="relative flex-shrink-0">
        <div
          className="p-2 rounded-lg bg-secondary"
          style={{
            boxShadow:
              "0 0 0 2px oklch(var(--border)), 0 0 0 5px oklch(var(--secondary)), 0 24px 64px oklch(0 0 0 / 0.75)",
          }}
        >
          <div className="relative overflow-hidden rounded-sm">
            <canvas
              ref={canvasRef}
              data-ocid="game.canvas_target"
              width={CANVAS_W}
              height={CANVAS_H}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              style={{
                display: "block",
                touchAction: "none",
                maxWidth: "min(360px, calc(100vw - 32px))",
                height: "auto",
              }}
            />

            <AnimatePresence>
              {gameStatus === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ backgroundColor: "rgba(8,8,16,0.80)" }}
                >
                  <motion.p
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{
                      duration: 1.4,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                    className="text-sm tracking-widest text-center px-6"
                    style={{
                      color: "oklch(var(--race-cyan))",
                      textShadow: "0 0 14px oklch(var(--race-cyan) / 0.7)",
                    }}
                  >
                    PRESS ARROW OR TAP TO START
                  </motion.p>
                  <p className="mt-3 text-xs tracking-wider text-muted-foreground">
                    ← → TO STEER
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {gameStatus === "over" && (
                <motion.div
                  key="gameover"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                  style={{ backgroundColor: "rgba(6,6,12,0.93)" }}
                >
                  <motion.div
                    initial={{ y: -12 }}
                    animate={{ y: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="text-2xl font-black tracking-widest uppercase"
                    style={{
                      color: "oklch(var(--race-red))",
                      textShadow:
                        "0 0 24px oklch(var(--race-red) / 0.8), 0 0 48px oklch(var(--race-red) / 0.4)",
                    }}
                  >
                    GAME OVER
                  </motion.div>

                  <div
                    className="text-sm tracking-widest"
                    style={{ color: "oklch(var(--muted-foreground))" }}
                  >
                    SCORE:{" "}
                    <span
                      style={{
                        color: "oklch(var(--race-cyan))",
                        textShadow: "0 0 8px oklch(var(--race-cyan) / 0.6)",
                      }}
                    >
                      {String(score).padStart(4, "0")}
                    </span>
                  </div>

                  {score > 0 && score >= highScore && (
                    <motion.div
                      animate={{ opacity: [1, 0.35, 1] }}
                      transition={{ duration: 0.7, repeat: 4 }}
                      className="text-xs tracking-widest"
                      style={{
                        color: "oklch(var(--race-orange))",
                        textShadow: "0 0 8px oklch(var(--race-orange) / 0.6)",
                      }}
                    >
                      ★ NEW HIGH SCORE ★
                    </motion.div>
                  )}

                  <button
                    type="button"
                    data-ocid="game.restart_button"
                    onClick={startGame}
                    className="mt-1 px-8 py-2.5 text-sm tracking-widest font-bold rounded-sm border transition-all duration-150 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: "rgba(0,212,255,0.08)",
                      borderColor: "oklch(var(--race-cyan) / 0.55)",
                      color: "oklch(var(--race-cyan))",
                      boxShadow: "0 0 20px oklch(var(--race-cyan) / 0.18)",
                    }}
                  >
                    PLAY AGAIN
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <p className="mt-4 text-xs text-muted-foreground tracking-wider md:hidden">
        DRAG LEFT / RIGHT TO STEER
      </p>

      <footer className="mt-6 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.hostname : "",
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Built with ♥ using caffeine.ai
          </a>
        </p>
      </footer>
    </div>
  );
}
