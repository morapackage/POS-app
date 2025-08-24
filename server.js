import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Dwolla credentials (Sandbox)
const DWOLLA_BASE = "https://api-sandbox.dwolla.com";
const DWOLLA_KEY = process.env.DWOLLA_KEY;
const DWOLLA_SECRET = process.env.DWOLLA_SECRET;

// Get OAuth token
async function getDwollaToken() {
  const response = await fetch(`${DWOLLA_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(`${DWOLLA_KEY}:${DWOLLA_SECRET}`).toString("base64"),
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error("Failed to get Dwolla token: " + err);
  }
  return response.json();
}

// Create customer → Add bank → Micro-deposits
app.post("/api/create-customer", async (req, res) => {
  try {
    const form = req.body;
    const tokenData = await getDwollaToken();

    // 1. Create Verified Customer
    const customerRes = await fetch(`${DWOLLA_BASE}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.dwolla.v1.hal+json",
      },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        address1: form.address1,
        city: form.city,
        state: form.state,
        postalCode: form.postalCode,
        dateOfBirth: form.dateOfBirth,
        ssn: form.ssn,
        type: "personal",
      }),
    });

    if (!customerRes.ok) {
      const errorData = await customerRes.json();
      return res.status(400).json(errorData);
    }

    const customerUrl = customerRes.headers.get("location");

    // 2. Add Funding Source (Bank)
    const fundingRes = await fetch(`${DWOLLA_BASE}/funding-sources`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.dwolla.v1.hal+json",
      },
      body: JSON.stringify({
        routingNumber: form.routingNumber,
        accountNumber: form.accountNumber,
        type: "checking",
        name: `${form.firstName} ${form.lastName} Bank`,
        _links: { customer: { href: customerUrl } },
      }),
    });

    if (!fundingRes.ok) {
      const errorData = await fundingRes.json();
      return res.status(400).json(errorData);
    }

    const fundingUrl = fundingRes.headers.get("location");

    // 3. Initiate Micro-Deposits
    const depositRes = await fetch(`${fundingUrl}/micro-deposits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!depositRes.ok) {
      const errorData = await depositRes.json();
      return res.status(400).json(errorData);
    }

    return res.json({
      message:
        "✅ Customer created, bank added, and micro-deposits sent. Please verify deposits in Sandbox Dashboard.",
      customerUrl,
      fundingUrl,
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
