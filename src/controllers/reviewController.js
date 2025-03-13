const pool = require("../config/db");
const { fetchGoogleReviews } = require("../config/googleAPI");

// ✅ Fetch & Cache Google Reviews
async function getReviews(widget_id) {
    try {
        // Check if the widget exists
        const widget = await pool.query("SELECT * FROM widgets WHERE id = ?", [widget_id]);
        if (!widget.length) return { error: "❌ Widget not found." };

        const business_id = widget[0].business_id;

        // Fetch Google Reviews
        const reviews = await fetchGoogleReviews(business_id);

        return {
            overallRating: reviews.length ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "N/A",
            totalReviews: reviews.length,
            reviews
        };
    } catch (error) {
        console.error("❌ Error retrieving reviews:", error);
        return { error: "Failed to fetch reviews" };
    }
}

module.exports = { getReviews };
