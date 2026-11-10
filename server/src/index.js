import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from "mongoose";
import Order from "./models/Order.js";
import { products } from "./data/catalogue.js";
import { parseOrder } from "./services/orderParser.js";
import { transcribeWithPrisma, speakWithTimbre } from "./services/gnani.js";

const app = express();
const inMemoryOrders = [];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "VoiceKirana API" }));
app.get("/api/products", (_req, res) => res.json(products));

app.post("/api/voice/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Audio file is required" });
    const result = await transcribeWithPrisma(req.file);
    res.json({ transcript: result.transcript, model: result.model || "prisma-v2.5" });
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

app.post("/api/voice/speak", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text || text.length > 1000) return res.status(400).json({ message: "Text must be 1–1000 characters" });
    const audio = await speakWithTimbre(text);
    res.set("Content-Type", "audio/wav").send(audio);
  } catch (error) {
    res.status(502).json({ message: error.message });
  }
});

app.post("/api/orders/parse", (req, res) => {
  const transcript = String(req.body?.transcript || "").trim();
  if (!transcript) return res.status(400).json({ message: "Transcript is required" });
  res.json({ transcript, ...parseOrder(transcript) });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, phone, channel = "web", transcript = "", items } = req.body || {};
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: "At least one order item is required" });
    }
    // Re-price against server catalogue. Never trust client-submitted prices.
    const safeItems = items.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) throw new Error(`Unknown product: ${item.productId}`);
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) throw new Error("Invalid quantity");
      return {
        name: product.name, quantity, unit: product.unit,
        price: product.price, subtotal: quantity * product.price
      };
    });
    const totalAmount = safeItems.reduce((sum, item) => sum + item.subtotal, 0);
    const payload = {
      customerName: customerName || "Guest",
      phone: phone || "",
      channel,
      language: "hinglish",
      transcript,
      items: safeItems,
      totalAmount
    };
    let order;
    if (mongoose.connection.readyState === 1) {
      order = await Order.create(payload);
    } else {
      order = { ...payload, _id: `local-${Date.now()}`, createdAt: new Date(), status: "confirmed" };
      inMemoryOrders.unshift(order);
    }
    res.status(201).json(order);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.get("/api/orders", async (_req, res) => {
  const orders = mongoose.connection.readyState === 1
    ? await Order.find().sort({ createdAt: -1 }).limit(100)
    : inMemoryOrders;
  res.json(orders);
});

app.patch("/api/orders/:id/status", async (req, res) => {
  const allowed = ["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
  if (!allowed.includes(req.body?.status)) return res.status(400).json({ message: "Invalid status" });

  if (mongoose.connection.readyState === 1) {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    return res.json(order);
  }

  const order = inMemoryOrders.find(o => String(o._id) === String(req.params.id));
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.status = req.body.status;
  res.json(order);
});

// Telephony channel integration endpoint (e.g. Twilio / Exotel / IVR webhook)
app.post("/api/telephony/incoming", async (req, res) => {
  try {
    const callerPhone = req.body?.From || req.body?.callerPhone || req.body?.phone || "Unknown Phone";
    const transcript = String(req.body?.SpeechResult || req.body?.transcript || req.body?.text || "").trim();

    if (!transcript) {
      return res.status(400).json({ message: "SpeechResult or transcript is required" });
    }

    const parsed = parseOrder(transcript);
    if (!parsed.items.length) {
      return res.json({
        replyText: "Maaf kijiye, hum aapka order samajh nahi paaye. Kripya do kilo chawal ya tel jaise items batayein.",
        parsed
      });
    }

    const payload = {
      customerName: `Caller (${callerPhone.slice(-4)})`,
      phone: callerPhone,
      channel: "phone",
      language: "hinglish",
      transcript,
      items: parsed.items,
      totalAmount: parsed.totalAmount,
      status: "confirmed"
    };

    let order;
    if (mongoose.connection.readyState === 1) {
      order = await Order.create(payload);
    } else {
      order = { ...payload, _id: `phone-${Date.now()}`, createdAt: new Date() };
      inMemoryOrders.unshift(order);
    }

    const replyText = `Ji, aapka ${parsed.items.length} items ka order confirm ho gaya hai. Total ${order.totalAmount} rupaye hain. Dhanyavaad!`;
    res.status(201).json({ order, replyText });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

const port = process.env.PORT || 5000;
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(err => console.error("MongoDB connection failed:", err.message));
}
app.listen(port, () => console.log(`VoiceKirana API running on http://localhost:${port}`));
