const express = require("express");
const db = require("../config/db");

const router = express.Router();

// ✅ Check Subscription Status
router.get("/status/:user_id", async (req, res) => {
    try {

        const subscription = await db.query("SELECT * FROM subscriptions WHERE user_id = ?", [req.params.user_id]);

        if (!subscription.length) {
            return res.status(404).json({ error: "❌ No active subscription found." });
        }

        res.json({ message: "✅ Active subscription found", subscription: subscription[0] });
    } catch (err) {
        console.error("❌ Error checking subscription:", err);
        res.status(500).json({ error: "Failed to check subscription status." });
    }
});

// ✅ Handle successful Stripe payment
router.post("/success", async (req, res) => {
    try {
        const { user_id, website_url, business_id, plan } = req.body;

        if (!user_id || !website_url || !business_id) {
            return res.status(400).json({ error: "❌ All fields are required." });
        }

        console.log(`🔍 Creating new subscription for User ID: ${user_id}`);

        // ✅ Create a subscription record - using the actual table structure
        await db.query(
            "INSERT INTO subscriptions (user_id, plan) VALUES (?, ?)",
            [user_id, plan || 'basic'] // Default to 'basic' plan if not provided
        );

        console.log(`🔍 Creating new widget for User ID: ${user_id}`);

        // ✅ Insert a new widget entry without overwriting existing ones
        const newWidget = await db.query(
            "INSERT INTO widgets (user_id, widget_name, website_url, business_id) VALUES (?, ?, ?, ?)",
            [user_id, `Widget for ${website_url}`, website_url, business_id]
        );

        res.status(201).json({ 
            message: "✅ Subscription and Widget Created Successfully!", 
            widget_id: String(newWidget.insertId) 
        });

    } catch (err) {
        console.error("❌ Error creating subscription:", err);
        res.status(500).json({ error: "❌ Failed to create subscription." });
    }
});

module.exports = router;