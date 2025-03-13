BigInt.prototype.toJSON = function () {
    return this.toString(); // Convert all BigInt to string globally
};


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const authRoutes = require("./src/routes/auth");
const widgetRoutes = require("./src/routes/widget");
const subscriptionRoutes = require("./src/routes/subscription");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/widget", widgetRoutes);
app.use("/api/subscription", subscriptionRoutes);

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}...`));
