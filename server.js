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
const apiConsumptionRoutes = require("./src/routes/api_consumptions");

const app = express();
app.use(cors());
app.use(express.json());

// Add a route for the root path
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Google Reviews API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/widget", widgetRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/api_consumption", apiConsumptionRoutes);

const PORT = process.env.PORT || 5051;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}...`));
