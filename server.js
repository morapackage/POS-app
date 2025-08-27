import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;
const DWOLLA_BASE = "https://api-sandbox.dwolla.com";

// In-memory store (replace with DB like Mongo or Postgres later)
const customers = {}; 

// 🔑 Get Dwolla access token
async function getAccessToken() {
  const res = await fetch(`${DWOLLA_BASE}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    }),
    auth: {
      user: process.env.DWOLLA_KEY,
      pass: process.env.DWOLLA_SECRET
    }
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Auth failed");
  return data.access_token;
}

// ✅ Create Customer
app.post("/api/create-customer", async (req, res) => {
  try {
    const token = await getAccessToken();

    const response = await fetch(`${DWOLLA_BASE}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.dwolla.v1.hal+json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(400).json({ error: err });
    }

    const location = response.headers.get("location"); // Customer URL
    const customerId = location.split("/").pop();

    // Save customer (with empty funding source initially)
    customers[customerId] = { customerId, fundingSourceId: null };

    res.json({ message: "Customer created", customerId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ✅ Save funding source
app.post("/api/add-funding-source", (req, res) => {
  const { customerId, fundingSourceId } = req.body;
  if (!customers[customerId]) {
    return res.status(404).json({ error: "Customer not found" });
  }
  customers[customerId].fundingSourceId = fundingSourceId;
  res.json({ message: "Funding source saved", customer: customers[customerId] });
});

// ✅ Get all saved customers
app.get("/api/customers", (req, res) => {
  res.json(Object.values(customers));
});

// ✅ Make a payment (transfer)
app.post("/api/transfer", async (req, res) => {
  const { customerId, amount } = req.body;
  const customer = customers[customerId];

  if (!customer || !customer.fundingSourceId) {
    return res.status(400).json({ error: "Customer or funding source missing" });
  }

  try {
    const token = await getAccessToken();
    const response = await fetch(`${DWOLLA_BASE}/transfers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/vnd.dwolla.v1.hal+json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        _links: {
          source: { href: `${DWOLLA_BASE}/funding-sources/${customer.fundingSourceId}` },
          destination: { href: `${DWOLLA_BASE}/funding-sources/${process.env.DWOLLA_MASTER_FUNDING_SOURCE}` }
        },
        amount: {
          currency: "USD",
          value: amount
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(400).json({ error: err });
    }

    const transferLocation = response.headers.get("location");
    res.json({ message: "Payment initiated", transfer: transferLocation });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
