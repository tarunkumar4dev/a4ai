const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const razorpay = new Razorpay({
  key_id: "rzp_test_RFzfYR5zJO0IBV",
  key_secret: "3v2f1PhIOzPHiS5d7tJPa8y7",
});

// 👉 Create Order API with UPI support
app.post("/create-order", async (req, res) => {
  const { amount, payment_method } = req.body;

  const options = {
    amount: amount * 100, // convert to paise
    currency: "INR",
    receipt: "receipt_" + Date.now(),
    notes: {
      payment_method: payment_method || "general"
    }
  };

  // Add UPI-specific options if payment method is UPI
  if (payment_method === "upi") {
    options.method = "upi";
    options.upi = {
      flow: "collect", // This enables UPI intent flow
      vpa: "" // Can be pre-filled if available
    };
  }

  try {
    const order = await razorpay.orders.create(options);
    res.json({
      ...order,
      recommended_apps: payment_method === "upi" ? [
        { name: "Google Pay", package: "com.google.android.apps.nbu.paisa.user" },
        { name: "PhonePe", package: "com.phonepe.app" },
        { name: "Paytm", package: "net.one97.paytm" },
        { name: "BHIM", package: "in.org.npci.upiapp" }
      ] : null
    });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Error creating order", details: err.error ? err.error.description : err.message });
  }
});

// 👉 Create Payment Link API (Alternative for UPI)
app.post("/create-payment-link", async (req, res) => {
  const { amount, customer } = req.body;

  try {
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100,
      currency: "INR",
      accept_partial: false,
      description: "Subscription Payment for a4ai.in",
      customer: {
        name: customer.name || "Customer",
        email: customer.email || "customer@example.com",
        contact: customer.contact || "+919999999999"
      },
      notify: {
        sms: true,
        email: true
      },
      reminder_enable: true,
      notes: {
        purpose: "Subscription Payment"
      },
      upi_link: true // This enables UPI payment option in the payment link
    });

    res.json(paymentLink);
  } catch (err) {
    console.error("Payment link creation error:", err);
    res.status(500).json({ error: "Error creating payment link", details: err.error ? err.error.description : err.message });
  }
});

// 👉 Verify Payment API
app.post("/verify-payment", (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Validate required fields
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ 
      success: false, 
      error: "Missing required payment verification parameters" 
    });
  }

  try {
    const hmac = crypto.createHmac("sha256", "3v2f1PhIOzPHiS5d7tJPa8y7");
    hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
    const generatedSignature = hmac.digest("hex");

    if (generatedSignature === razorpay_signature) {
      // Payment successful - here you would typically:
      // 1. Update your database
      // 2. Send confirmation email
      // 3. Activate the user's subscription
      
      console.log("Payment verified successfully for order:", razorpay_order_id);
      res.json({ 
        success: true, 
        message: "Payment verified successfully",
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id
      });
    } else {
      console.warn("Signature verification failed for order:", razorpay_order_id);
      res.status(400).json({ 
        success: false, 
        error: "Payment verification failed: invalid signature" 
      });
    }
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error during verification" 
    });
  }
});

// 👉 Get Payment Details API
app.get("/payment-details/:paymentId", async (req, res) => {
  try {
    const payment = await razorpay.payments.fetch(req.params.paymentId);
    res.json(payment);
  } catch (err) {
    console.error("Fetch payment error:", err);
    res.status(500).json({ error: "Error fetching payment details" });
  }
});

// 👉 Get Order Details API
app.get("/order-details/:orderId", async (req, res) => {
  try {
    const order = await razorpay.orders.fetch(req.params.orderId);
    res.json(order);
  } catch (err) {
    console.error("Fetch order error:", err);
    res.status(500).json({ error: "Error fetching order details" });
  }
});

// 👉 Health Check API
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    service: "Razorpay Payment Gateway"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Run server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});