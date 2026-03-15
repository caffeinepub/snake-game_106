import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type GameStatus = "idle" | "playing" | "over";

const GRID = 20;
const CELL = 26; // px
const BASE_INTERVAL = 200;
const MIN_INTERVAL = 80;
const SPEED_REDUCTION = 4;

function getInterval(score: number): number {
  return Math.max(MIN_INTERVAL, BASE_INTERVAL - score * SPEED_REDUCTION);
}

function randomPoint(snake: Point[]): Point {
  let p: Point;
  do {
    p = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

const INITIAL_SNAKE: Point[] = [
  { x: 11, y: 10 },
  { x: 10, y: 10 },
  { x: 9, y: 10 },
];
const INITIAL_DIR: Direction = "RIGHT";
const INITIAL_FOOD: Point = { x: 15, y: 10 };

const OPPOSITE: Record<Direction, Direction> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

const KEY_MAP: Record<string, Direction> = {
  ArrowUp: "UP",
  ArrowDown: "DOWN",
  ArrowLeft: "LEFT",
  ArrowRight: "RIGHT",
};

function speedLabel(score: number): string {
  if (score < 5) return "SLOW";
  if (score < 12) return "MEDIUM";
  if (score < 22) return "FAST";
  if (score < 35) return "TURBO";
  return "MAX";
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function App() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>(INITIAL_FOOD);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return Number.parseInt(localStorage.getItem("snake-high") ?? "0", 10);
    } catch {
      return 0;
    }
  });
  const [status, setStatus] = useState<GameStatus>("idle");
  const [scoreKey, setScoreKey] = useState(0);

  const dirRef = useRef<Direction>(INITIAL_DIR);
  const pendingDirRef = useRef<Direction | null>(null);
  const snakeRef = useRef<Point[]>(INITIAL_SNAKE);
  const foodRef = useRef<Point>(INITIAL_FOOD);
  const scoreRef = useRef(0);
  const statusRef = useRef<GameStatus>("idle");

  snakeRef.current = snake;
  foodRef.current = food;
  scoreRef.current = score;
  statusRef.current = status;

  const tick = useCallback(() => {
    if (statusRef.current !== "playing") return;

    if (pendingDirRef.current) {
      dirRef.current = pendingDirRef.current;
      pendingDirRef.current = null;
    }

    const dir = dirRef.current;
    const currentSnake = snakeRef.current;
    const head = currentSnake[0];

    const newHead: Point = {
      x: head.x + (dir === "RIGHT" ? 1 : dir === "LEFT" ? -1 : 0),
      y: head.y + (dir === "DOWN" ? 1 : dir === "UP" ? -1 : 0),
    };

    if (
      newHead.x < 0 ||
      newHead.x >= GRID ||
      newHead.y < 0 ||
      newHead.y >= GRID
    ) {
      endGame();
      return;
    }

    if (currentSnake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      endGame();
      return;
    }

    const ateFood =
      newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
    const newSnake = ateFood
      ? [newHead, ...currentSnake]
      : [newHead, ...currentSnake.slice(0, -1)];

    if (ateFood) {
      const newScore = scoreRef.current + 1;
      setScore(newScore);
      setScoreKey((k) => k + 1);
      setFood(randomPoint(newSnake));
      if (newScore > highScore) {
        setHighScore(newScore);
        try {
          localStorage.setItem("snake-high", String(newScore));
        } catch {
          /* noop */
        }
      }
    }

    setSnake(newSnake);
  }, [highScore]);

  function endGame() {
    statusRef.current = "over";
    setStatus("over");
  }

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(tick, getInterval(score));
    return () => clearInterval(id);
  }, [status, score, tick]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const dir = KEY_MAP[e.key];
      if (!dir) return;
      e.preventDefault();

      if (statusRef.current === "idle") {
        dirRef.current = dir;
        setStatus("playing");
        statusRef.current = "playing";
        return;
      }

      if (statusRef.current === "playing") {
        if (dir !== OPPOSITE[dirRef.current]) {
          pendingDirRef.current = dir;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function restart() {
    const newSnake = [...INITIAL_SNAKE];
    const newFood = randomPoint(newSnake);
    setSnake(newSnake);
    setFood(newFood);
    setScore(0);
    dirRef.current = INITIAL_DIR;
    pendingDirRef.current = null;
    snakeRef.current = newSnake;
    foodRef.current = newFood;
    scoreRef.current = 0;
    setStatus("playing");
    statusRef.current = "playing";
  }

  function handleMobileDir(dir: Direction) {
    if (status === "idle") {
      dirRef.current = dir;
      setStatus("playing");
      statusRef.current = "playing";
      return;
    }
    if (status === "playing" && dir !== OPPOSITE[dirRef.current]) {
      pendingDirRef.current = dir;
    }
  }

  const snakeSet = new Map<string, number>();
  snake.forEach((s, i) => snakeSet.set(`${s.x},${s.y}`, i));
  const boardSize = GRID * CELL;

  // Build grid lines arrays
  const gridIndices = Array.from({ length: GRID + 1 }, (_, i) => i);

  // Build cells to render
  const cells: Array<{
    key: string;
    col: number;
    row: number;
    snakeIdx: number | undefined;
    isFood: boolean;
  }> = [];
  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const key = `${col},${row}`;
      const snakeIdx = snakeSet.get(key);
      const isFood = food.x === col && food.y === row;
      if (snakeIdx !== undefined || isFood) {
        cells.push({ key, col, row, snakeIdx, isFood });
      }
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-between py-8 px-4 font-mono">
      <header className="text-center mb-6">
        <h1
          className="text-3xl md:text-4xl font-display font-bold tracking-widest uppercase"
          style={{
            color: "oklch(var(--snake-head))",
            textShadow: "0 0 20px oklch(var(--snake-head) / 0.5)",
          }}
        >
          SNAKE
        </h1>
        <p className="text-muted-foreground text-xs tracking-[0.3em] mt-1">
          TERMINAL v2.6
        </p>
      </header>

      <div
        data-ocid="score.panel"
        className="flex gap-8 md:gap-16 mb-6 px-8 py-3 rounded-sm border border-border bg-card"
      >
        <div className="text-center">
          <div className="text-xs text-muted-foreground tracking-widest mb-1">
            SCORE
          </div>
          <div
            key={scoreKey}
            className="text-2xl font-bold score-tick"
            style={{
              color: "oklch(var(--snake-head))",
              textShadow: "0 0 12px oklch(var(--snake-head) / 0.6)",
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
            className="text-2xl font-bold"
            style={{ color: "oklch(var(--muted-foreground))" }}
          >
            {String(highScore).padStart(4, "0")}
          </div>
        </div>
        <div className="w-px bg-border" />
        <div className="text-center">
          <div className="text-xs text-muted-foreground tracking-widest mb-1">
            SPEED
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: "oklch(var(--accent))" }}
          >
            {speedLabel(score)}
          </div>
        </div>
      </div>

      <main className="relative">
        <div className="p-3 md:p-5 rounded-md bg-secondary shadow-screen">
          <div
            data-ocid="game.canvas_target"
            className="relative scanlines crt-flicker overflow-hidden rounded-sm"
            style={{
              width: boardSize,
              height: boardSize,
              backgroundColor: "oklch(var(--grid-bg))",
              boxShadow: "inset 0 0 40px oklch(0.78 0.18 145 / 0.04)",
            }}
          >
            {/* Grid lines */}
            <svg
              aria-hidden="true"
              className="absolute inset-0 opacity-20"
              width={boardSize}
              height={boardSize}
              style={{ pointerEvents: "none" }}
            >
              {gridIndices.map((i) => (
                <g key={i}>
                  <line
                    x1={i * CELL}
                    y1={0}
                    x2={i * CELL}
                    y2={boardSize}
                    stroke="oklch(0.4 0.02 200)"
                    strokeWidth="0.5"
                  />
                  <line
                    x1={0}
                    y1={i * CELL}
                    x2={boardSize}
                    y2={i * CELL}
                    stroke="oklch(0.4 0.02 200)"
                    strokeWidth="0.5"
                  />
                </g>
              ))}
            </svg>

            {/* Cells */}
            {cells.map(({ key, col, row, snakeIdx, isFood }) => {
              const isHead = snakeIdx === 0;
              return (
                <div
                  key={key}
                  className={isFood ? "food-pulse" : isHead ? "head-glow" : ""}
                  style={{
                    position: "absolute",
                    left: col * CELL + 1,
                    top: row * CELL + 1,
                    width: CELL - 2,
                    height: CELL - 2,
                    borderRadius: isHead ? 4 : isFood ? "50%" : 2,
                    backgroundColor: isFood
                      ? "oklch(var(--food-color))"
                      : isHead
                        ? "oklch(var(--snake-head))"
                        : `oklch(${0.68 - (snakeIdx ?? 0) * 0.015} 0.17 148)`,
                    transition: "background-color 0.1s",
                  }}
                />
              );
            })}

            {/* Idle overlay */}
            <AnimatePresence>
              {status === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ backgroundColor: "oklch(0.10 0.012 240 / 0.88)" }}
                >
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{
                      duration: 1.2,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                    className="text-sm md:text-base tracking-widest text-center px-4"
                    style={{
                      color: "oklch(var(--snake-head))",
                      textShadow: "0 0 12px oklch(var(--snake-head) / 0.6)",
                    }}
                  >
                    PRESS ARROW KEY TO START
                  </motion.div>
                  <div className="mt-4 text-xs text-muted-foreground tracking-wider">
                    USE ↑ ↓ ← → TO MOVE
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Game Over overlay */}
            <AnimatePresence>
              {status === "over" && (
                <motion.div
                  key="gameover"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4"
                  style={{ backgroundColor: "oklch(0.08 0.012 240 / 0.92)" }}
                >
                  <motion.div
                    initial={{ y: -10 }}
                    animate={{ y: 0 }}
                    className="text-xl md:text-2xl font-bold tracking-widest"
                    style={{
                      color: "oklch(var(--destructive))",
                      textShadow: "0 0 16px oklch(var(--destructive) / 0.6)",
                    }}
                  >
                    GAME OVER
                  </motion.div>
                  <div className="text-xs text-muted-foreground tracking-widest">
                    SCORE:{" "}
                    <span style={{ color: "oklch(var(--snake-head))" }}>
                      {String(score).padStart(4, "0")}
                    </span>
                  </div>
                  {score >= highScore && score > 0 && (
                    <motion.div
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 0.8, repeat: 3 }}
                      className="text-xs tracking-widest"
                      style={{ color: "oklch(var(--accent))" }}
                    >
                      ★ NEW HIGH SCORE ★
                    </motion.div>
                  )}
                  <button
                    type="button"
                    data-ocid="game.restart_button"
                    onClick={restart}
                    className="mt-2 px-6 py-2 text-sm tracking-widest font-bold rounded-sm border transition-all duration-150 hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: "oklch(var(--primary) / 0.15)",
                      borderColor: "oklch(var(--primary) / 0.6)",
                      color: "oklch(var(--snake-head))",
                      textShadow: "0 0 8px oklch(var(--snake-head) / 0.5)",
                      boxShadow: "0 0 12px oklch(var(--primary) / 0.2)",
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

      {/* Mobile controls */}
      <div className="mt-6 flex flex-col items-center gap-2 md:hidden">
        <MobileBtn dir="UP" label="▲" onClick={() => handleMobileDir("UP")} />
        <div className="flex gap-2">
          <MobileBtn
            dir="LEFT"
            label="◄"
            onClick={() => handleMobileDir("LEFT")}
          />
          <div className="w-12 h-12" />
          <MobileBtn
            dir="RIGHT"
            label="►"
            onClick={() => handleMobileDir("RIGHT")}
          />
        </div>
        <MobileBtn
          dir="DOWN"
          label="▼"
          onClick={() => handleMobileDir("DOWN")}
        />
      </div>

      <footer className="mt-8 text-center text-xs text-muted-foreground">
        <p>
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
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

// ── Mobile button ──────────────────────────────────────────────────────────
function MobileBtn({
  label,
  onClick,
}: { dir: Direction; label: string; onClick: () => void }) {
  const [pressing, setPressing] = useState(false);

  function handlePress() {
    setPressing(true);
    setTimeout(() => setPressing(false), 150);
    onClick();
  }

  return (
    <button
      type="button"
      onPointerDown={handlePress}
      className={`w-12 h-12 rounded-sm border text-lg font-bold flex items-center justify-center select-none transition-colors ${
        pressing ? "btn-press" : ""
      }`}
      style={{
        backgroundColor: "oklch(var(--secondary))",
        borderColor: "oklch(var(--border))",
        color: "oklch(var(--snake-head))",
      }}
    >
      {label}
    </button>
  );
}
