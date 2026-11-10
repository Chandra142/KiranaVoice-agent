import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  customerName: { type: String, default: "Guest" },
  phone: { type: String, default: "" },
  channel: { type: String, enum: ["web", "phone"], default: "web" },
  language: { type: String, default: "hinglish" },
  transcript: { type: String, default: "" },
  items: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 }
  }],
  totalAmount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: ["confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"],
    default: "confirmed"
  }
}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
