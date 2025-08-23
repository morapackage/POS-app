import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import dwolla from "dwolla-v2";

dotenv.config();

const app = express();
app.use(bodyParser.json());
const PORT = process.env.PORT || 4242;

// ✅ Dwolla client
const client = new dwolla.Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: "sandbox", // change to 'production' later
});

// Create customer + funding source + simulate deposit
app.post("/api/create-customer", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, address, routingNumber, accountNumber } = req.body;

    // Step 1 — Create Customer
    const customerRes = await client.post("customers", {
      firstName,
      lastName,
      email,
      type: "personal",
    });
    const customerUrl = customerRes.headers.get("location");

    // Step 2 — Add Bank (Funding Source)
    const fsRes = await client.post(`${customerUrl}/funding-sources`, {
      routingNumber,
      accountNumber,
      bankAccountType: "checking",
      name: `${firstName} ${lastName} Checking`,
    });
    const fundingUrl = fsRes.headers.get("location");

    // Step 3 — Initiate Micro-Deposit (Simulated in Sandbox)
    await client.post(`${fundingUrl}/micro-deposits`);

    // Step 4 — (Sandbox auto-verification simulation)
    await client.post(`${fundingUrl}/micro-deposits/verify`, {
      amount1: { value: "0.03", currency: "USD" },
      amount2: { value: "0.09", currency: "USD" },
    });

    // Step 5 — Make a $1 Payment to Dwolla Master Account (for demo)
    const masterAccount = "https://api-sandbox.dwolla.com/accounts/MASTER_ACCOUNT_ID"; // replace later
    await client.post("transfers", {
      _links: {
        source: { href: fundingUrl },
        destination: { href: masterAccount },
      },
      amount: { currency: "USD", value: "1.00" },
    });

    res.json({ success: true, message: "Customer created, bank linked, verified, and payment sent!" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Serve frontend
app.use(express.static("public"));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));