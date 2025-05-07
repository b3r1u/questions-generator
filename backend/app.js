const express = require("express");
const cors = require("cors");
const pdfRoutes = require("./routes/pdf");
require("dotenv").config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.use("/api/pdf", pdfRoutes);

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});
