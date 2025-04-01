const axios = require("axios");

async function fetchGoogleReviews(businessId) {
    const apiKey = process.env.GOOGLE_API_KEY;
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${businessId}&fields=reviews&key=${apiKey}&review_sort=newest`;


    try {
        const response = await axios.get(url);
        const reviews = response.data.result.reviews || [];

        // 🔥 FILTER ONLY 5-STAR REVIEWS
        const fiveStarReviews = reviews.filter(review => review.rating === 5);

        return fiveStarReviews.map(review => ({
            author: review.author_name,
            profilePhoto: review.profile_photo_url || "https://via.placeholder.com/50",
            rating: review.rating,
            time: new Date(review.time * 1000).toLocaleDateString("en-US", {
                day: "2-digit", month: "short", year: "numeric"
            }),
            text: review.text,
        }));
    } catch (error) {
        console.error("❌ Error fetching Google Reviews:", error);
        return [];
    }
}

module.exports = { fetchGoogleReviews };
