import { useState, useEffect, useRef, useCallback } from "react";
import { ListChecks, Bell, PenTool, Plus, Trash2, Check, Droplet, Eraser, X } from "lucide-react";

const COLORS = ["#2E1F26", "#C97B86", "#4F9DA6", "#D9A441", "#6B8E4E", "#FFFFFF"];
const WATER_INTERVAL_MIN = 60;

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });
  } catch (e) {}
}

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, true);
    if (res && res.value) return JSON.parse(res.value);
    return fallback;
  } catch (e) {
    return fallback;
  }
}

async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
  } catch (e) {}
}

function timeLabel(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function JustUsApp() {
  const [tab, setTab] = useState("todo");
  const [loaded, setLoaded] = useState(false);

  // Todo
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState("");

  // Reminders
  const [reminders, setReminders] = useState([]);
  const [remText, setRemText] = useState("");
  const [remTime, setRemTime] = useState("");
  const [activeAlerts, setActiveAlerts] = useState([]);
  const firedTodayRef = useRef({});

  // Water
  const [water, setWater] = useState({ enabled: false, lastDrink: Date.now() });
  const [now, setNow] = useState(Date.now());

  // Sketch
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const lastAppliedTsRef = useRef(0);
  const [brushColor, setBrushColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);

  // ---------- initial load ----------
  useEffect(() => {
    (async () => {
      const [t, r, w] = await Promise.all([
        loadKey("todos", []),
        loadKey("reminders", []),
        loadKey("water", { enabled: false, lastDrink: Date.now() }),
      ]);
      setTodos(t);
      setReminders(r);
      setWater(w);
      setLoaded(true);
    })();
  }, []);

  // ---------- poll shared data (todo/reminders/water) ----------
  useEffect(() => {
    if (!loaded) return;
    const iv = setInterval(async () => {
      const [t, r, w] = await Promise.all([
        loadKey("todos", todos),
        loadKey("reminders", reminders),
        loadKey("water", water),
      ]);
      setTodos(t);
      setReminders(r);
      setWater((prev) => (w.lastDrink !== prev.lastDrink || w.enabled !== prev.enabled ? w : prev));
    }, 5000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // ---------- ticking clock ----------
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ---------- reminder + water check loop ----------
  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date();
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      const nowLabel = `${hh}:${mm}`;
      const todayKey = d.toDateString();

      reminders.forEach((r) => {
        if (r.time === nowLabel) {
          const fireKey = `${r.id}-${todayKey}`;
          if (!firedTodayRef.current[fireKey]) {
            firedTodayRef.current[fireKey] = true;
            playChime();
            setActiveAlerts((prev) => [...prev, { id: `${r.id}-${Date.now()}`, text: r.text }]);
          }
        }
      });

      if (water.enabled) {
        const dueAt = water.lastDrink + WATER_INTERVAL_MIN * 60000;
        if (Date.now() >= dueAt) {
          const fireKey = `water-${Math.floor(dueAt / 60000)}`;
          if (!firedTodayRef.current[fireKey]) {
            firedTodayRef.current[fireKey] = true;
            playChime();
            setActiveAlerts((prev) => [...prev, { id: `water-${Date.now()}`, text: "Time to drink some water 💧" }]);
          }
        }
      }
    }, 15000);
    return () => clearInterval(iv);
  }, [reminders, water]);

  // ---------- todo actions ----------
  const addTodo = async () => {
    const text = todoInput.trim();
    if (!text) return;
    const next = [...todos, { id: Date.now().toString(), text, done: false }];
    setTodos(next);
    setTodoInput("");
    await saveKey("todos", next);
  };
  const toggleTodo = async (id) => {
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    await saveKey("todos", next);
  };
  const deleteTodo = async (id) => {
    const next = todos.filter((t) => t.id !== id);
    setTodos(next);
    await saveKey("todos", next);
  };

  // ---------- reminder actions ----------
  const addReminder = async () => {
    if (!remText.trim() || !remTime) return;
    const next = [...reminders, { id: Date.now().toString(), text: remText.trim(), time: remTime }];
    setReminders(next);
    setRemText("");
    setRemTime("");
    await saveKey("reminders", next);
  };
  const deleteReminder = async (id) => {
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    await saveKey("reminders", next);
  };
  const dismissAlert = (id) => setActiveAlerts((prev) => prev.filter((a) => a.id !== id));

  // ---------- water actions ----------
  const toggleWater = async () => {
    const next = { ...water, enabled: !water.enabled, lastDrink: Date.now() };
    setWater(next);
    await saveKey("water", next);
  };
  const drankWater = async () => {
    const next = { ...water, lastDrink: Date.now() };
    setWater(next);
    await saveKey("water", next);
  };

  const waterElapsed = now - water.lastDrink;
  const waterProgress = water.enabled ? Math.min(1, waterElapsed / (WATER_INTERVAL_MIN * 60000)) : 0;
  const waterRemaining = WATER_INTERVAL_MIN * 60000 - waterElapsed;

  // ---------- sketch: canvas helpers ----------
  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvasRef.current.width,
      y: ((clientY - rect.top) / rect.height) * canvasRef.current.height,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getPos(e);
  };
  const draw = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
  };
  const endDraw = async () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    await pushCanvas();
  };

  const pushCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const ts = Date.now();
    lastAppliedTsRef.current = ts;
    await saveKey("sketch-canvas", { dataUrl, ts });
  }, []);

  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pushCanvas();
  };

  // init canvas background once mounted
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // load + poll sketch only while on sketch tab
  useEffect(() => {
    if (tab !== "sketch") return;
    let cancelled = false;
    const apply = async () => {
      const data = await loadKey("sketch-canvas", null);
      if (!data || cancelled) return;
      if (data.ts && data.ts !== lastAppliedTsRef.current) {
        lastAppliedTsRef.current = data.ts;
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = data.dataUrl;
      }
    };
    apply();
    const iv = setInterval(apply, 3000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [tab]);

  const tabs = [
    { id: "todo", label: "To-Do", icon: ListChecks },
    { id: "reminders", label: "Reminders", icon: Bell },
    { id: "sketch", label: "Sketch", icon: PenTool },
  ];

  return (
    <div className="min-h-screen w-full bg-[#FBF6F3] flex flex-col items-center py-8 px-4 font-sans text-[#2E1F26]">
      <div className="w-full max-w-xl">
        <div className="text-center mb-6">
          <p className="uppercase tracking-widest text-xs text-[#C97B86] mb-1">just us</p>
          <h1 className="text-3xl" style={{ fontFamily: "Georgia, 'Playfair Display', serif", fontStyle: "italic" }}>
            our little app
          </h1>
        </div>

        {/* Alerts */}
        {activeAlerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {activeAlerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between bg-[#4F9DA6] text-white rounded-xl px-4 py-3 shadow-md animate-pulse"
              >
                <span className="text-sm">{a.text}</span>
                <button onClick={() => dismissAlert(a.id)} className="ml-3 opacity-90 hover:opacity-100">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-white rounded-full p-1 shadow-sm mb-6 border border-[#EFE1DC]">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm transition-colors ${
                  active ? "bg-[#C97B86] text-white" : "text-[#8A6B75] hover:text-[#2E1F26]"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* TODO */}
        {tab === "todo" && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#EFE1DC] p-5">
            <div className="flex gap-2 mb-4">
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
                placeholder="Add something to remember..."
                className="flex-1 border border-[#EFE1DC] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C97B86]"
              />
              <button onClick={addTodo} className="bg-[#2E1F26] text-white rounded-xl px-4 hover:bg-[#452C38]">
                <Plus size={18} />
              </button>
            </div>
            {todos.length === 0 && (
              <p className="text-sm text-[#8A6B75] text-center py-6">Nothing on the list yet.</p>
            )}
            <div className="space-y-2">
              {todos.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 bg-[#FBF6F3] rounded-xl px-4 py-3 group"
                >
                  <button
                    onClick={() => toggleTodo(t.id)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                      t.done ? "bg-[#6B8E4E] border-[#6B8E4E]" : "border-[#C97B86]"
                    }`}
                  >
                    {t.done && <Check size={12} color="white" />}
                  </button>
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-[#8A6B75]" : ""}`}>
                    {t.text}
                  </span>
                  <button
                    onClick={() => deleteTodo(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-[#8A6B75] hover:text-[#C97B86] transition-opacity"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REMINDERS */}
        {tab === "reminders" && (
          <div className="space-y-5">
            {/* Water card */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#EFE1DC] p-5 flex items-center gap-4">
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EFE1DC" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="#4F9DA6"
                    strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 15.5}
                    strokeDashoffset={2 * Math.PI * 15.5 * (1 - waterProgress)}
                    strokeLinecap="round"
                  />
                </svg>
                <Droplet size={18} className="absolute inset-0 m-auto text-[#4F9DA6]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Drink water reminder</p>
                <p className="text-xs text-[#8A6B75]">
                  {water.enabled
                    ? waterRemaining > 0
                      ? `Next glass in ${timeLabel(waterRemaining)}`
                      : "It's time — go drink some water"
                    : "Off — every hour while this is open"}
                </p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <button
                  onClick={toggleWater}
                  className={`text-xs px-3 py-1.5 rounded-full ${
                    water.enabled ? "bg-[#4F9DA6] text-white" : "bg-[#FBF6F3] text-[#8A6B75] border border-[#EFE1DC]"
                  }`}
                >
                  {water.enabled ? "On" : "Off"}
                </button>
                {water.enabled && (
                  <button onClick={drankWater} className="text-xs text-[#4F9DA6] underline">
                    I drank water
                  </button>
                )}
              </div>
            </div>

            {/* Custom reminders */}
            <div className="bg-white rounded-2xl shadow-sm border border-[#EFE1DC] p-5">
              <div className="flex gap-2 mb-4">
                <input
                  value={remText}
                  onChange={(e) => setRemText(e.target.value)}
                  placeholder="Remind us to..."
                  className="flex-1 border border-[#EFE1DC] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#C97B86]"
                />
                <input
                  type="time"
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                  className="border border-[#EFE1DC] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#C97B86]"
                />
                <button onClick={addReminder} className="bg-[#2E1F26] text-white rounded-xl px-4 hover:bg-[#452C38]">
                  <Plus size={18} />
                </button>
              </div>
              {reminders.length === 0 && (
                <p className="text-sm text-[#8A6B75] text-center py-6">No reminders set yet.</p>
              )}
              <div className="space-y-2">
                {reminders.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-[#FBF6F3] rounded-xl px-4 py-3 group">
                    <Bell size={15} className="text-[#C97B86] shrink-0" />
                    <span className="flex-1 text-sm">{r.text}</span>
                    <span className="text-xs text-[#8A6B75]">{r.time}</span>
                    <button
                      onClick={() => deleteReminder(r.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#8A6B75] hover:text-[#C97B86] transition-opacity"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[#8A6B75] mt-4 italic">
                Reminders only ring while this app is open in a browser tab — they're not push notifications.
              </p>
            </div>
          </div>
        )}

        {/* SKETCH */}
        {tab === "sketch" && (
          <div className="bg-white rounded-2xl shadow-sm border border-[#EFE1DC] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrushColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${brushColor === c ? "border-[#C97B86]" : "border-transparent"}`}
                    style={{ background: c, boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px #EFE1DC" : "none" }}
                  />
                ))}
              </div>
              <button onClick={clearCanvas} className="flex items-center gap-1 text-xs text-[#8A6B75] hover:text-[#C97B86]">
                <Eraser size={14} /> Clear
              </button>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="w-full mb-3 accent-[#C97B86]"
            />
            <canvas
              ref={canvasRef}
              width={560}
              height={400}
              className="w-full rounded-xl border border-[#EFE1DC] touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            <p className="text-xs text-[#8A6B75] mt-3 italic text-center">
              Drawings sync between you both every few seconds while this tab is open.
            </p>
          </div>
        )}
      </div>
    </div>
  );
    }
