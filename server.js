import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import dwolla from "dwolla-v2";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4242;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Dwolla client
const client = new dwolla.Client({
  key: process.env.DWOLLA_KEY,
  secret: process.env.DWOLLA_SECRET,
  environment: "sandbox"
});

// API: Create customer + attach funding source
app.post("/api/create-customer", async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, address,
      city, state, postalCode, dateOfBirth, ssn,
      routingNumber, accountNumber
    } = req.body;

    // Create customer
    const customerRes = await client.post("customers", {
      firstName,
      lastName,
      email,
      type: "personal",
      address1: address,
      city,
      state,
      postalCode,
      dateOfBirth,
      ssn,
      phone
    });

    const customerUrl = customerRes.headers.get("location");

    // Add funding source
    const fundingRes = await client.post(`${customerUrl}/funding-sources`, {
      routingNumber,
      accountNumber,
      type: "checking",
      name: `${firstName} ${lastName} Bank Account`
    });

    res.json({
      success: true,
      message: "Customer and funding source created successfully",
      customer: customerUrl,
      fundingSource: fundingRes.headers.get("location")
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({
      success: false,
      message: err.body ? JSON.stringify(err.body) : err.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
