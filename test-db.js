require("dotenv").config();
const pool = require("./src/config/db");

(async () => {
    try {
        const result = await pool.query("SELECT NOW()");
        console.log("✅ Database Connection Successful! Current Time:", result);
    } catch (err) {
        console.error("❌ Database Connection Failed:", err);
    }
})();
