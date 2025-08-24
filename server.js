import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// DWOLLA config
const DWOLLA_BASE = "https://api-sandbox.dwolla.com";
const DWOLLA_KEY = process.env.DWOLLA_KEY;
const DWOLLA_SECRET = process.env.DWOLLA_SECRET;

// Basic Auth
const authHeader =
  "Basic " +
  Buffer.from(`${DWOLLA_KEY}:${DWOLLA_SECRET}`).toString("base64");

// Helper: better Dwolla error handling
async function handleDwollaResponse(response, res) {
  if (!response.ok) {
    const errorText = await response.text();
    console.error("Dwolla API Error:", errorText);

    try {
      const errorJson = JSON.parse(errorText);
      return res.status(response.status).json(errorJson);
    } catch {
      return res.status(response.status).send(errorText);
    }
  }
  return response;
}

/**
 * 1️⃣ Create Customer
 */
app.post("/api/create-customer", async (req, res) => {
  try {
    const { firstName, lastName, email, address, city, state, postalCode, ssn, dob } =
      req.body;

    const response = await fetch(`${DWOLLA_BASE}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        type: "personal",
        address1: address,
        city,
        state,
        postalCode,
        ssn,
        dateOfBirth: dob,
      }),
    });

    const handled = await handleDwollaResponse(response, res);
    if (!handled.ok) return;

    const customerUrl = handled.headers.get("location");
    res.json({ message: "✅ Customer created", customerUrl });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 2️⃣ Add Bank Account
 */
app.post("/api/add-bank", async (req, res) => {
  try {
    const { customerUrl, routingNumber, accountNumber, bankName } = req.body;

    const response = await fetch(`${customerUrl}/funding-sources`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        routingNumber,
        accountNumber,
        bankAccountType: "checking",
        name: bankName || "Customer Bank",
      }),
    });

    const handled = await handleDwollaResponse(response, res);
    if (!handled.ok) return;

    const bankUrl = handled.headers.get("location");
    res.json({ message: "✅ Bank added", bankUrl });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 3️⃣ Initiate Trial Deposits
 */
app.post("/api/trial-deposit", async (req, res) => {
  try {
    const { bankUrl } = req.body;

    const response = await fetch(`${bankUrl}/micro-deposits`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
    });

    const handled = await handleDwollaResponse(response, res);
    if (!handled.ok) return;

    res.json({ message: "✅ Trial deposits started" });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 4️⃣ Verify Trial Deposits
 */
app.post("/api/verify-bank", async (req, res) => {
  try {
    const { bankUrl, amount1, amount2 } = req.body;

    const response = await fetch(`${bankUrl}/micro-deposits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount1: { value: amount1, currency: "USD" },
        amount2: { value: amount2, currency: "USD" },
      }),
    });

    const handled = await handleDwollaResponse(response, res);
    if (!handled.ok) return;

    res.json({ message: "✅ Bank verified" });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * 5️⃣ Make Payment (bank → Dwolla master funding source)
 */
app.post("/api/payment", async (req, res) => {
  try {
    const { bankUrl, amount } = req.body;

    // Dwolla's sandbox master funding source
    const masterFS = "https://api-sandbox.dwolla.com/funding-sources/MASTER_FUNDING_SOURCE_ID";

    const response = await fetch(`${DWOLLA_BASE}/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        _links: {
          source: { href: bankUrl },
          destination: { href: masterFS },
        },
        amount: {
          currency: "USD",
          value: amount,
        },
      }),
    });

    const handled = await handleDwollaResponse(response, res);
    if (!handled.ok) return;

    const transferUrl = handled.headers.get("location");
    res.json({ message: "✅ Payment initiated", transferUrl });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
