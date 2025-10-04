// ── load env first ─────────────────────────────────────────────
require("dotenv").config({ path: ".env.local" });

const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

/** CORS (dev allowlist) */
app.use(
  cors({
    origin: function (origin, cb) {
      const allow = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:8080",
        process.env.CLIENT_ORIGIN,
      ].filter(Boolean);
      if (!origin || allow.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
  })
);

// JSON body parser
app.use(express.json());

// sanity log
console.log("Razorpay key:", process.env.RAZORPAY_KEY_ID || "(fallback)");
if (!process.env.RAZORPAY_KEY_SECRET) {
  console.warn("⚠️ RAZORPAY_KEY_SECRET is missing. Did you create Backend/.env.local ?");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RFzfYR5zJO0IBV",
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Root check
app.get("/", (_req, res) => res.send("Razorpay test backend OK"));

/** Create Order (expects amount in **paise**) */
app.post("/create-order", async (req, res) => {
  try {
    const { amount, payment_method, vpa } = req.body;
    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount (paise)" });
    }

    const options = {
      amount,                 // paise from FE
      currency: "INR",
      receipt: "receipt_" + Date.now(),
      notes: { payment_method: payment_method || "general" },
    };

    // ✅ your requested UPI "collect" hint
    if (payment_method === "upi") {
      options.method = "upi";
      options.upi = { flow: "collect" };
      // optionally prefill VPA for test mode:
      // if FE sends vpa, use it; otherwise Checkout will ask user to enter one
      if (vpa) options.upi.vpa = vpa; // e.g. "success@razorpay" in test mode
    }

    const order = await razorpay.orders.create(options);
    console.log("Order created:", order.id, order.amount, order.currency, "method:", payment_method);
    res.json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({
      error: "Error creating order",
      details: err?.error?.description || err?.message || "unknown",
    });
  }
});

/** Verify Payment */
app.post("/verify-payment", (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, error: "Missing verification params" });
    }

    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest === razorpay_signature) {
      return res.json({ success: true, order_id: razorpay_order_id, payment_id: razorpay_payment_id });
    }
    return res.status(400).json({ success: false, error: "Invalid signature" });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ success: false, error: "Internal verification error" });
  }
});

// Health
app.get("/health", (_req, res) => res.json({ status: "OK", at: new Date().toISOString() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
