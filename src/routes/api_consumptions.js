const express = require("express");
const db = require("../config/db");

const router = express.Router();

// ✅ Track API consumption by user
router.get("/api-consumption", async (req, res) => {
    try {
        
        const currentMonthUsage = await db.query(`
            SELECT 
                u.id AS user_id,
                u.name,
                u.email,
                u.company_name,
                COUNT(ar.id) AS total_requests,
                SUM(ar.response_size) AS total_response_size,
                MAX(ar.created_at) AS last_request
            FROM 
                users u
            LEFT JOIN 
                api_requests ar ON u.id = ar.user_id
            WHERE 
                MONTH(ar.created_at) = MONTH(CURRENT_DATE())
                AND YEAR(ar.created_at) = YEAR(CURRENT_DATE())
            GROUP BY 
                u.id
            ORDER BY 
                total_response_size DESC
        `);

        const monthlyHistory = await db.query(`
            SELECT 
                u.id AS user_id,
                u.name,
                CONCAT(YEAR(ar.created_at), '-', MONTH(ar.created_at)) AS month,
                COUNT(ar.id) AS requests,
                SUM(ar.response_size) AS response_size
            FROM 
                users u
            LEFT JOIN 
                api_requests ar ON u.id = ar.user_id
            WHERE
                ar.created_at >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            GROUP BY 
                u.id, YEAR(ar.created_at), MONTH(ar.created_at)
            ORDER BY 
                u.id, YEAR(ar.created_at), MONTH(ar.created_at)
        `);

        res.json({
            current_month: currentMonthUsage,
            monthly_history: monthlyHistory
        });
    } catch (err) {
        console.error("❌ Error fetching API consumption:", err);
        res.status(500).json({ error: "Failed to fetch API consumption data." });
    }
});

// ✅ Get detailed consumption for a specific user
router.get("/api-consumption/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        const [user] = await db.query("SELECT * FROM users WHERE id = ?", [user_id]);
        if (!user) {
            return res.status(404).json({ error: "❌ User not found." });
        }
        
        const apiRequests = await db.query(`
            SELECT 
                ar.id,
                ar.widget_id,
                w.widget_name,
                w.website_url,
                ar.request_type,
                ar.response_size,
                ar.status,
                ar.created_at
            FROM 
                api_requests ar
            JOIN
                widgets w ON ar.widget_id = w.id
            WHERE 
                ar.user_id = ?
            ORDER BY 
                ar.created_at DESC
            LIMIT 100
        `, [user_id]);
        
        const totals =await db.query(`
            SELECT 
                COUNT(id) AS total_requests,
                SUM(response_size) AS total_size,
                MAX(created_at) AS last_request
            FROM 
                api_requests
            WHERE 
                user_id = ?
        `, [user_id]);
        
        res.json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                company_name: user.company_name
            },
            api_requests: apiRequests,
            totals: totals[0]
        });
    } catch (err) {
        console.error("❌ Error fetching user API consumption:", err);
        res.status(500).json({ error: "Failed to fetch user API consumption data." });
    }
});

module.exports = router;