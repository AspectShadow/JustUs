"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const COLORS = ["#2E1F26", "#C97B86", "#4F9DA6", "#D9A441", "#6B8E4E", "#FFFFFF"];
const WATER_INTERVAL_MIN = 60;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function timeLabel(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return res.json();
}

export default function Home() {
  const [tab, setTab] = useState("todo");
  const [notifStatus, setNotifStatus] = useState("unknown"); // unknown | unsupported | denied | off | on

  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState("");

  const [reminders, setReminders] = useState([]);
  const [remText, setRemText] = useState("");
  const [remTime, setRemTime] = useState("");

  const [water, setWater] = useState({ enabled: false, lastDrink: Date.now() });
  const [now, setNow] = useState(Date.now());

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
        api("/api/todos"),
        api("/api/reminders"),
        api("/api/water"),
      ]);
      setTodos(t.todos || []);
      setReminders(r.reminders || []);
      setWater(w.water || { enabled: false, lastDrink: Date.now() });
    })();

    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
      navigator.serviceWorker.ready.then((reg) =>
        reg.pushManager.getSubscription().then((sub) => setNotifStatus(sub ? "on" : "off"))
      );
    } else {
      setNotifStatus("unsupported");
    }
  }, []);

  // ---------- poll shared data ----------
  useEffect(() => {
    const iv = setInterval(async () => {
      const [t, r, w] = await Promise.all([
        api("/api/todos"),
        api("/api/reminders"),
        api("/api/water"),
      ]);
      setTodos(t.todos || []);
      setReminders(r.reminders || []);
      setWater(w.water || { enabled: false, lastDrink: Date.now() });
    }, 6000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ---------- push notifications ----------
  const enableNotifications = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotifStatus("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setNotifStatus("denied");
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await api("/api/subscribe", { method: "POST", body: JSON.stringify({ subscription: sub }) });
    setNotifStatus("on");
  };

  // ---------- todo actions ----------
  const addTodo = async () => {
    const text = todoInput.trim();
    if (!text) return;
    const next = [...todos, { id: Date.now().toString(), text, done: false }];
    setTodos(next);
    setTodoInput("");
    await api("/api/todos", { method: "POST", body: JSON.stringify({ todos: next }) });
  };
  const toggleTodo = async (id) => {
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTodos(next);
    await api("/api/todos", { method: "POST", body: JSON.stringify({ todos: next }) });
  };
  const deleteTodo = async (id) => {
    const next = todos.filter((t) => t.id !== id);
    setTodos(next);
    await api("/api/todos", { method: "POST", body: JSON.stringify({ todos: next }) });
  };

  // ---------- reminder actions ----------
  const addReminder = async () => {
    if (!remText.trim() || !remTime) return;
    const next = [...reminders, { id: Date.now().toString(), text: remText.trim(), time: remTime }];
    setReminders(next);
    setRemText("");
    setRemTime("");
    await api("/api/reminders", { method: "POST", body: JSON.stringify({ reminders: next }) });
  };
  const deleteReminder = async (id) => {
    const next = reminders.filter((r) => r.id !== id);
    setReminders(next);
    await api("/api/reminders", { method: "POST", body: JSON.stringify({ reminders: next }) });
  };

  // ---------- water actions ----------
  const toggleWater = async () => {
    const next = { ...water, enabled: !water.enabled, lastDrink: Date.now(), lastNotifiedAt: 0 };
    setWater(next);
    await api("/api/water", { method: "POST", body: JSON.stringify({ water: next }) });
  };
  const drankWater = async () => {
    const next = { ...water, lastDrink: Date.now(), lastNotifiedAt: 0 };
    setWater(next);
    await api("/api/water", { method: "POST", body: JSON.stringify({ water: next }) });
  };

  const waterElapsed = now - water.lastDrink;
  const waterProgress = water.enabled ? Math.min(1, waterElapsed / (WATER_INTERVAL_MIN * 60000)) : 0;
  const waterRemaining = WATER_INTERVAL_MIN * 60000 - waterElapsed;

  // ---------- sketch ----------
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
    const res = await api("/api/sketch", { method: "POST", body: JSON.stringify({ dataUrl }) });
    if (res.ts) lastAppliedTsRef.current = res.ts;
  }, []);
  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pushCanvas();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (tab !== "sketch") return;
    let cancelled = false;
    const apply = async () => {
      const res = await api("/api/sketch");
      const data = res.sketch;
      if (!data || !data.dataUrl || cancelled) return;
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
    { id: "todo", label: "To-Do" },
    { id: "reminders", label: "Reminders" },
    { id: "sketch", label: "Sketch" },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={styles.eyebrow}>just us</p>
          <h1 style={styles.title}>our little app</h1>
        </div>

        {notifStatus !== "on" && notifStatus !== "unsupported" && (
          <button onClick={enableNotifications} style={styles.notifBanner}>
            {notifStatus === "denied"
              ? "Notifications blocked — enable them in your phone settings"
              : "Tap to turn on notifications for reminders"}
          </button>
        )}

        <div style={styles.tabBar}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...styles.tabBtn, ...(tab === t.id ? styles.tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "todo" && (
          <div style={styles.card}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTodo()}
                placeholder="Add something to remember..."
                style={styles.input}
              />
              <button onClick={addTodo} style={styles.primaryBtn}>+</button>
            </div>
            {todos.length === 0 && <p style={styles.emptyText}>Nothing on the list yet.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {todos.map((t) => (
                <div key={t.id} style={styles.row}>
                  <button
                    onClick={() => toggleTodo(t.id)}
                    style={{ ...styles.checkbox, ...(t.done ? styles.checkboxDone : {}) }}
                  >
                    {t.done ? "✓" : ""}
                  </button>
                  <span style={{ flex: 1, fontSize: 15, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--muted)" : "var(--text)" }}>
                    {t.text}
                  </span>
                  <button onClick={() => deleteTodo(t.id)} style={styles.deleteBtn}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "reminders" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", width: 56, height: 56, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke="var(--teal)" strokeWidth="3"
                    strokeDasharray={2 * Math.PI * 15.5}
                    strokeDashoffset={2 * Math.PI * 15.5 * (1 - waterProgress)}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Drink water reminder</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  {water.enabled
                    ? waterRemaining > 0 ? `Next glass in ${timeLabel(waterRemaining)}` : "It's time — go drink some water"
                    : "Off — pings every hour once on"}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                <button onClick={toggleWater} style={{ ...styles.pillBtn, ...(water.enabled ? styles.pillBtnOn : {}) }}>
                  {water.enabled ? "On" : "Off"}
                </button>
                {water.enabled && (
                  <button onClick={drankWater} style={styles.linkBtn}>I drank water</button>
                )}
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <input
                  value={remText}
                  onChange={(e) => setRemText(e.target.value)}
                  placeholder="Remind us to..."
                  style={{ ...styles.input, flex: "1 1 160px" }}
                />
                <input
                  type="time"
                  value={remTime}
                  onChange={(e) => setRemTime(e.target.value)}
                  style={{ ...styles.input, flex: "0 0 110px" }}
                />
                <button onClick={addReminder} style={styles.primaryBtn}>+</button>
              </div>
              {reminders.length === 0 && <p style={styles.emptyText}>No reminders set yet.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {reminders.map((r) => (
                  <div key={r.id} style={styles.row}>
                    <span style={{ flex: 1, fontSize: 15 }}>{r.text}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>{r.time}</span>
                    <button onClick={() => deleteReminder(r.id)} style={styles.deleteBtn}>✕</button>
                  </div>
                ))}
              </div>
              <p style={styles.footnote}>
                Notifications reach your phone even when the app is closed, as long as you've turned them on above.
              </p>
            </div>
          </div>
        )}

        {tab === "sketch" && (
          <div style={styles.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setBrushColor(c)}
                    style={{
                      width: 24, height: 24, borderRadius: "50%", background: c,
                      border: brushColor === c ? "2px solid var(--rose)" : c === "#FFFFFF" ? "1px solid var(--border)" : "2px solid transparent",
                    }}
                  />
                ))}
              </div>
              <button onClick={clearCanvas} style={styles.linkBtn}>Clear</button>
            </div>
            <input
              type="range" min="2" max="16" value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 12 }}
            />
            <canvas
              ref={canvasRef} width={560} height={400}
              style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", touchAction: "none", cursor: "crosshair" }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
            />
            <p style={styles.footnote}>Drawings sync between you both every few seconds while this tab is open.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", padding: "32px 16px", display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 520 },
  eyebrow: { textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 12, color: "var(--rose)", margin: "0 0 4px" },
  title: { fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontWeight: 500, fontSize: 30, margin: 0 },
  notifBanner: { display: "block", width: "100%", background: "var(--teal)", color: "#fff", border: "none", borderRadius: 14, padding: "12px 16px", fontSize: 13, marginBottom: 16 },
  tabBar: { display: "flex", background: "var(--surface)", borderRadius: 999, padding: 4, marginBottom: 20, border: "1px solid var(--border)" },
  tabBtn: { flex: 1, padding: "10px 0", borderRadius: 999, border: "none", background: "transparent", color: "var(--muted)", fontSize: 14 },
  tabBtnActive: { background: "var(--rose)", color: "#fff" },
  card: { background: "var(--surface)", borderRadius: 18, border: "1px solid var(--border)", padding: 20, boxShadow: "0 1px 4px rgba(46,31,38,0.04)" },
  input: { flex: 1, border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none" },
  primaryBtn: { background: "var(--text)", color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontSize: 18 },
  emptyText: { fontSize: 14, color: "var(--muted)", textAlign: "center", padding: "24px 0" },
  row: { display: "flex", alignItems: "center", gap: 12, background: "var(--bg)", borderRadius: 12, padding: "10px 14px" },
  checkbox: { width: 20, height: 20, borderRadius: "50%", border: "1px solid var(--rose)", background: "transparent", flexShrink: 0, fontSize: 12, color: "#fff", lineHeight: "18px" },
  checkboxDone: { background: "var(--green)", borderColor: "var(--green)" },
  deleteBtn: { border: "none", background: "transparent", color: "var(--muted)", fontSize: 13 },
  pillBtn: { fontSize: 12, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--muted)" },
  pillBtnOn: { background: "var(--teal)", color: "#fff", border: "none" },
  linkBtn: { border: "none", background: "transparent", color: "var(--teal)", fontSize: 12, textDecoration: "underline" },
  footnote: { fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 14, textAlign: "center" },
};
