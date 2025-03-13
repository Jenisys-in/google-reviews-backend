const axios = require("axios");

async function fetchGoogleReviews(businessId) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${businessId}&fields=reviews&key=${apiKey}&language=sk`; // Slovak Language for Review Text

    try {
        const response = await axios.get(url);
        const reviews = response.data.result.reviews || [];

        return reviews.map(review => ({
            author: review.author_name,
            profilePhoto: review.profile_photo_url || "https://via.placeholder.com/50", // Default if missing
            rating: review.rating,
            time: new Date(review.time * 1000).toLocaleDateString("en-US", {
                day: "2-digit", month: "short", year: "numeric"
            }), // Dates in English (e.g., "15 Feb 2024")
            text: review.text,
        }));
    } catch (error) {
        console.error("❌ Error fetching Google Reviews:", error);
        return [];
    }
}

module.exports = { fetchGoogleReviews };
