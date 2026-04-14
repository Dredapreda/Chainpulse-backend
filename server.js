require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const ALCHEMY_KEY = process.env.ALCHEMY_KEY;

if (!ALCHEMY_KEY) {
  console.error("❌ Missing ALCHEMY_KEY in environment variables");
}

const URL = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

// In-memory storage
let tokens = {};

// 🔍 Fetch ERC20 transfers
async function fetchTransfers() {
  try {
    const res = await axios.post(URL, {
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [
        {
          category: ["erc20"],
          order: "desc",
          maxCount: "0x64"
        }
      ],
      id: 1
    });

    return res.data.result.transfers || [];
  } catch (err) {
    console.log("Fetch error:", err.message);
    return [];
  }
}

// 🧠 Process transfers into token stats
function processTransfers(transfers) {
  transfers.forEach(tx => {
    const token = tx.rawContract?.address;
    const wallet = tx.to;

    if (!token || !wallet) return;

    if (!tokens[token]) {
      tokens[token] = {
        symbol: tx.asset || "UNKNOWN",
        wallets: new Set(),
        txCount: 0
      };
    }

    tokens[token].wallets.add(wallet);
    tokens[token].txCount += 1;
  });
}

// 📊 Ranking logic
function getTrending() {
  let results = [];

  Object.keys(tokens).forEach(addr => {
    const t = tokens[addr];

    const walletCount = t.wallets.size;

    // Filter out junk tokens
    if (walletCount < 5 || t.txCount < 8) return;

    const score =
      walletCount * 3 +
      t.txCount * 1.2;

    results.push({
      address: addr,
      symbol: t.symbol,
      new_wallets: walletCount,
      tx_count: t.txCount,
      pulse_score: Math.round(score)
    });
  });

  return results
    .sort((a, b) => b.pulse_score - a.pulse_score)
    .slice(0, 10);
}

// 🔄 Auto update loop
async function update() {
  const transfers = await fetchTransfers();
  processTransfers(transfers);

  console.log(
    "Updated:",
    Object.keys(tokens).length,
    "tokens tracked"
  );
}

// Run every 15 seconds
setInterval(update, 15000);
update();

// 🌐 API endpoint
app.get("/trending", (req, res) => {
  res.json(getTrending());
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
