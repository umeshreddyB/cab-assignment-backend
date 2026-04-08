const express = require("express");
const cors = require("cors");
require("dotenv").config();

const cabRoutes = require("./routes/cabRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/", cabRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use((err, _req, res, _next) => {
  
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
