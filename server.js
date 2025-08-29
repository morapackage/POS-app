import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const DWOLLA_BASE = "https://api-sandbox.dwolla.com";

async function dwollaFetch(endpoint, method, body) {
  const res = await fetch(DWOLLA_BASE + endpoint, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.dwolla.v1.hal+json",
      "Authorization": `Basic ${Buffer.from(process.env.DWOLLA_KEY + ":" + process.env.DWOLLA_SECRET).toString("base64")}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text);
  }
  return res.json();
}

// Create customer
app.post("/api/create-customer", async (req, res) => {
  try {
    const customer = await dwollaFetch("/customers", "POST", {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      type: "personal",
      address1: req.body.address1,
      city: req.body.city,
      state: req.body.state,
      postalCode: req.body.postalCode,
      ssn: req.body.ssn
    });
    res.json({ customerId: customer._links.self.href.split("/").pop() });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Add bank
app.post("/api/add-bank", async (req, res) => {
  try {
    const bank = await dwollaFetch(`/customers/${req.body.customerId}/funding-sources`, "POST", {
      routingNumber: req.body.routingNumber,
      accountNumber: req.body.accountNumber,
      bankAccountType: req.body.accountType,
      name: req.body.accountName
    });
    const fundingSourceId = bank._links.self.href.split("/").pop();
    const iavLink = `https://dashboard-sandbox.dwolla.com/funding-sources/${fundingSourceId}/iav`;
    res.json({ fundingSourceId, iavLink });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Verify deposits
app.post("/api/verify-deposits", async (req, res) => {
  try {
    await dwollaFetch(`/funding-sources/${req.body.fundingSourceId}/micro-deposits`, "POST", {
      amount1: { value: req.body.amounts[0], currency: "USD" },
      amount2: { value: req.body.amounts[1], currency: "USD" }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Payment
app.post("/api/payment", async (req, res) => {
  try {
    const transfer = await dwollaFetch("/transfers", "POST", {
      _links: {
        source: { href: `${DWOLLA_BASE}/funding-sources/${req.body.fundingSourceId}` },
        destination: { href: process.env.DWOLLA_MASTER_FUNDING_SOURCE }
      },
      amount: { currency: "USD", value: req.body.amount }
    });
    res.json({ transfer });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.listen(4242, () => console.log("🚀 Server running on port 4242"));
