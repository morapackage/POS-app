import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import dwolla from "dwolla-v2";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // serves your index.html

// Dwolla client setup
const client = new dwolla.Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: process.env.DWOLLA_ENV || "sandbox", // default to sandbox
});

// ✅ Create Customer
app.post("/api/create-customer", async (req, res) => {
  try {
    const { firstName, lastName, email, address, city, state, postalCode, ssn, dob } = req.body;

    const customer = await client.post("customers", {
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
    });

    const customerUrl = customer.headers.get("location");
    console.log("✅ Customer created:", customerUrl);

    res.json({ customerUrl });
  } catch (err) {
    console.error("❌ Customer error:", err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ Add Bank (funding source)
app.post("/api/add-bank", async (req, res) => {
  try {
    const { customerUrl, routingNumber, accountNumber, bankName } = req.body;

    const bank = await client.post(`${customerUrl}/funding-sources`, {
      routingNumber,
      accountNumber,
      bankAccountType: "checking",
      name: bankName,
    });

    const bankUrl = bank.headers.get("location");
    console.log("✅ Bank added:", bankUrl);

    res.json({ bankUrl });
  } catch (err) {
    console.error("❌ Bank error:", err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ Trial Deposits
app.post("/api/trial-deposit", async (req, res) => {
  try {
    const { bankUrl } = req.body;

    await client.post(`${bankUrl}/micro-deposits`);
    console.log("✅ Trial deposits initiated for:", bankUrl);

    res.json({ message: "Trial deposits initiated" });
  } catch (err) {
    console.error("❌ Trial deposit error:", err);
    res.status(400).json({ error: err.message });
  }
});

// ✅ Payment Transfer
app.post("/api/payment", async (req, res) => {
  try {
    const { bankUrl, amount } = req.body;

    const transfer = await client.post("transfers", {
      _links: {
        source: { href: bankUrl },
        destination: { href: process.env.DWOLLA_MASTER_FUNDING_SOURCE },
      },
      amount: { currency: "USD", value: amount },
    });

    const transferUrl = transfer.headers.get("location");
    console.log("✅ Transfer initiated:", transferUrl);

    res.json({ message: "Payment submitted", transferUrl });
  } catch (err) {
    console.error("❌ Transfer error:", err);
    res.status(400).json({ error: err.message });
  }
});

const port = process.env.PORT || 4242;
app.listen(port, () => console.log(`🚀 Server running on http://localhost:${port}`));
