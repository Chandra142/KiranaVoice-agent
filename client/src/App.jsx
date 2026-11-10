import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, ShoppingBasket, Package, IndianRupee, RefreshCw, CheckCircle2, Volume2, Phone, Leaf, Clock3 } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function App() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState(null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const recorder = useRef(null);
  const chunks = useRef([]);

  async function refreshOrders() {
    try {
      const r = await fetch(`${API}/api/orders`);
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data)) setOrders(data);
      }
    } catch {
      // API may not be ready or reachable yet; keep existing state
    }
  }

  useEffect(() => {
    refreshOrders();
    const id = setInterval(refreshOrders, 5000);
    return () => clearInterval(id);
  }, []);

  async function startRecording() {
    setError("");
    setDraft(null);
    setTranscript("");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone access is not supported in this browser or over insecure HTTP.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
      const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      media.ondataavailable = e => {
        if (e.data.size) chunks.current.push(e.data);
      };
      media.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
        await processAudio(blob);
      };
      recorder.current = media;
      media.start();
      setRecording(true);
    } catch (e) {
      setError(e.message || "Microphone permission is needed. Please allow microphone access.");
    }
  }

  function stopRecording() {
    if (recorder.current && recorder.current.state === "recording") {
      recorder.current.stop();
      setRecording(false);
      setBusy(true);
    }
  }

  async function processAudio(blob) {
    try {
      const form = new FormData();
      form.append("audio", blob, "voice-order.webm");
      const response = await fetch(`${API}/api/voice/transcribe`, { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Transcription failed (${response.status})`);
      setTranscript(data.transcript);

      const parsedResponse = await fetch(`${API}/api/orders/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: data.transcript })
      });
      const parsed = await parsedResponse.json().catch(() => ({}));
      if (!parsedResponse.ok) throw new Error(parsed.message || "Failed to parse order");
      setDraft(parsed);
      if (parsed.needsClarification) {
        setError("I couldn't identify an item. Try saying: do kilo chawal aur ek litre tel.");
      }
    } catch (e) {
      setError(e.message || "Failed to process audio.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrder() {
    if (!draft?.items?.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Web Customer",
          channel: "web",
          transcript,
          items: draft.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Could not save order (${response.status})`);

      // Attempt to play confirmation audio (fallback gracefully if TTS fails)
      const reply = `Ji, aapka order confirm ho gaya hai. Total ${data.totalAmount} rupaye hain. Dhanyavaad!`;
      try {
        const audioResponse = await fetch(`${API}/api/voice/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: reply })
        });
        if (audioResponse.ok) {
          const audioBlob = await audioResponse.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.onended = () => URL.revokeObjectURL(audioUrl);
          await audio.play().catch(() => {});
        }
      } catch (audioErr) {
        console.warn("TTS playback error:", audioErr);
      }

      setDraft(null);
      setTranscript("");
      await refreshOrders();
    } catch (e) {
      setError(e.message || "Could not confirm order.");
    } finally {
      setBusy(false);
    }
  }

  const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark"><ShoppingBasket size={22}/></span>
          <span>Voice<span className="brand-accent">Kirana</span><small> बोलकर ऑर्डर करें</small></span>
        </a>
        <div className="top-status"><span className="live-dot"/> AI assistant online</div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Leaf size={14}/> YOUR NEIGHBOURHOOD, MADE EASIER</span>
            <h1>Grocery shopping.<br/><em>Just say it.</em></h1>
            <p>Apni language mein boliye. Hum aapka order ready kar denge.</p>
            <div className="hero-tags"><span>● Hinglish voice</span><span>● Easy ordering</span><span>● Shopkeeper verified</span></div>
          </div>
          <div className="voice-card">
            <div className="voice-card-head">
              <span className="assistant-avatar"><ShoppingBasket size={20}/></span>
              <div><b>Kirana Assistant</b><small>Namaste! Main aapki kya help kar sakta hoon?</small></div>
              <span className="online-pill">ONLINE</span>
            </div>
            <div className={`voice-orb ${recording ? "is-recording" : ""} ${busy ? "is-busy" : ""}`}>
              <div className="orb-ring ring-one"/><div className="orb-ring ring-two"/>
              <button
                className="mic-button"
                onClick={recording ? stopRecording : startRecording}
                disabled={busy}
                aria-label={recording ? "Stop recording" : "Start recording"}
              >
                {recording ? <Square fill="currentColor" size={25}/> : busy ? <RefreshCw className="spin" size={28}/> : <Mic size={30}/>}
              </button>
            </div>
            <h3>{recording ? "Listening to you…" : busy ? "Processing your order…" : "Tap and speak"}</h3>
            <p className="voice-hint">{recording ? "Speak clearly, then tap stop" : "Try: Do kilo chawal aur ek litre tel"}</p>
            <div className="voice-wave"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
            {error && <div className="error-box">{error}</div>}
          </div>
        </section>

        <section className="workspace">
          <div className="section-heading">
            <div><span className="eyebrow">ORDER PREVIEW</span><h2>Your order</h2></div>
            <span className="secure-note"><CheckCircle2 size={15}/> You confirm before we place it</span>
          </div>
          {transcript && <div className="transcript"><span>YOU SAID</span><p>“{transcript}”</p></div>}
          {draft?.items?.length ? (
            <div className="order-card">
              <div className="order-card-title">
                <div><ShoppingBasket size={19}/><b>Order summary</b></div>
                <span className="draft-pill">DRAFT · NOT PLACED</span>
              </div>
              {draft.items.map((item, i) => (
                <div className="item-row" key={i}>
                  <div><b>{item.name}</b><small>{item.quantity} {item.unit} × {money(item.price)}</small></div>
                  <strong>{money(item.subtotal)}</strong>
                </div>
              ))}
              <div className="total-row">
                <span>Total amount</span>
                <strong>{money(draft.totalAmount)}</strong>
              </div>
              <button className="confirm-button" onClick={confirmOrder} disabled={busy}>
                <CheckCircle2 size={18}/>{busy ? "Please wait…" : "Confirm my order"}
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <span><ShoppingBasket size={25}/></span>
              <b>Your basket is waiting</b>
              <p>Use the microphone above to add grocery items by voice.</p>
            </div>
          )}
        </section>

        <section className="dashboard">
          <div className="section-heading">
            <div><span className="eyebrow">SHOPKEEPER VIEW</span><h2>Recent orders</h2></div>
            <button className="refresh-button" onClick={refreshOrders}><RefreshCw size={15}/> Refresh</button>
          </div>
          <div className="stats">
            <div className="stat-card">
              <span><Package size={17}/></span>
              <small>Total orders shown</small>
              <b>{orders.length}</b>
            </div>
            <div className="stat-card">
              <span><IndianRupee size={17}/></span>
              <small>Revenue shown</small>
              <b>{money(orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0))}</b>
            </div>
            <div className="stat-card">
              <span><Clock3 size={17}/></span>
              <small>Awaiting preparation</small>
              <b>{orders.filter(o => o.status === "confirmed").length}</b>
            </div>
          </div>
          <div className="orders-table">
            <div className="table-head">
              <span>ORDER</span>
              <span>ITEMS</span>
              <span>CHANNEL</span>
              <span>TOTAL</span>
              <span>STATUS</span>
            </div>
            {orders.length ? orders.map(o => (
              <div className="table-row" key={o._id}>
                <span>#{String(o._id).slice(-6)}</span>
                <span>{o.items?.map(i => `${i.name} ×${i.quantity}`).join(", ")}</span>
                <span className="channel"><Phone size={13}/>{o.channel}</span>
                <b>{money(o.totalAmount)}</b>
                <span className="status">{o.status}</span>
              </div>
            )) : <div className="table-empty">No orders yet. Confirm a voice order to see it here.</div>}
          </div>
        </section>
      </main>
      <footer>
        <span>Voice<span className="brand-accent">Kirana</span></span>
        <span>Built for local stores across India 🇮🇳</span>
      </footer>
    </div>
  );
}
