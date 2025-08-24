import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const DWOLLA_BASE = "https://api-sandbox.dwolla.com";
const DWOLLA_KEY = process.env.DWOLLA_KEY;
const DWOLLA_SECRET = process.env.DWOLLA_SECRET;

async function getToken() {
  const res = await fetch(`${DWOLLA_BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${DWOLLA_KEY}:${DWOLLA_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return res.json();
}

// Create Customer
app.post("/api/create-customer", async (req, res) => {
  try {
    const { access_token } = await getToken();
    const response = await fetch(`${DWOLLA_BASE}/customers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) return res.status(400).json(await response.json());
    const location = response.headers.get("location");
    res.json({ customerUrl: location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Funding Source
app.post("/api/add-funding-source", async (req, res) => {
  try {
    const { customerUrl, routingNumber, accountNumber } = req.body;
    const { access_token } = await getToken();
    const response = await fetch(`${customerUrl}/funding-sources`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        routingNumber,
        accountNumber,
        bankAccountType: "checking",
        name: "Customer Bank",
      }),
    });

    if (!response.ok) return res.status(400).json(await response.json());
    const location = response.headers.get("location");
    res.json({ fundingSourceUrl: location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initiate Micro-Deposits
app.post("/api/initiate-micro-deposits", async (req, res) => {
  try {
    const { fundingSourceUrl } = req.body;
    const { access_token } = await getToken();
    const response = await fetch(`${fundingSourceUrl}/micro-deposits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return res.status(400).json(await response.json());
    res.json({ message: "Micro-deposits initiated." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Make Payment
app.post("/api/make-payment", async (req, res) => {
  try {
    const { fundingSourceUrl, amount } = req.body;
    const { access_token } = await getToken();

    const response = await fetch(`${DWOLLA_BASE}/transfers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _links: {
          source: { href: fundingSourceUrl },
          destination: { href: "https://api-sandbox.dwolla.com/funding-sources/YOUR_MASTER_FUNDING_SOURCE_ID" }
        },
        amount: { currency: "USD", value: amount }
      }),
    });

    if (!response.ok) return res.status(400).json(await response.json());
    const location = response.headers.get("location");
    res.json({ transferUrl: location });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(4242, () => console.log("🚀 Server running on port 4242"));
