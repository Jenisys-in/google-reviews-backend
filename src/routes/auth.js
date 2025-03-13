const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const router = express.Router();

// ✅ Register a User
router.post("/register", async (req, res) => {
    const { email, name, company_name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const result = await pool.query(
            "INSERT INTO users (email, name, company_name, password) VALUES (?, ?, ?, ?)",
            [email, name, company_name, hashedPassword]
        );

        res.status(201).json({ message: "✅ User registered successfully!" });
    } catch (err) {
        console.error("❌ Error registering user:", err);
        res.status(500).json({ error: "Error registering user" });
    }
});

// ✅ Login a User
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
        if (!user.length) return res.status(404).json({ error: "User not found" });

        const validPassword = await bcrypt.compare(password, user[0].password);
        if (!validPassword) return res.status(401).json({ error: "Invalid password" });

        const token = jwt.sign({ id: user[0].id }, process.env.JWT_SECRET, { expiresIn: "1h" });
        res.json({ token, user: user[0] });
    } catch (err) {
        console.error("❌ Error logging in user:", err);
        res.status(500).json({ error: "Error logging in" });
    }
});

module.exports = router;
