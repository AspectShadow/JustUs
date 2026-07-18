"use client";
import { useState } from "react";
export default function CopyKeysPage() {
  const [secret, setSecret] = useState("");
  const [keys, setKeys] = useState(null);
  const [copied, setCopied] = useState("");
  const generate = async () => {
    const res = await fetch(`/api/debug-push/gen-keys?secret=${encodeURIComponent(secret)}`);
    setKeys(await res.json());
  };
  const copy = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };
  return (
    <div style={{ padding: 24, maxWidth: 500, margin: "0 auto" }}>
      <h2>Generate VAPID keys</h2>
      <input placeholder="Your CRON_SECRET" value={secret} onChange={(e) => setSecret(e.target.value)} style={{ width: "100%", padding: 10, fontSize: 16, marginBottom: 10 }} />
      <button onClick={generate} style={{ padding: "10px 16px", fontSize: 16 }}>Generate</button>
      {keys && (
        <div style={{ marginTop: 24 }}>
          <label><b>PUBLIC KEY</b></label>
          <input readOnly value={keys.publicKey} style={{ width: "100%", padding: 10, fontSize: 14, marginTop: 6 }} />
          <button onClick={() => copy(keys.publicKey, "public")} style={{ marginTop: 6, padding: "8px 14px" }}>{copied === "public" ? "Copied!" : "Copy public key"}</button>
          <label style={{ display: "block", marginTop: 20 }}><b>PRIVATE KEY</b></label>
          <input readOnly value={keys.privateKey} style={{ width: "100%", padding: 10, fontSize: 14, marginTop: 6 }} />
          <button onClick={() => copy(keys.privateKey, "private")} style={{ marginTop: 6, padding: "8px 14px" }}>{copied === "private" ? "Copied!" : "Copy private key"}</button>
        </div>
      )}
    </div>
  );
}
