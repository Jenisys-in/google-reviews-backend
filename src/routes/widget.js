const express = require("express");
const db = require("../config/db");
const { fetchGoogleReviews } = require("../config/googleAPI");
const cron = require('node-cron');

const router = express.Router();


router.post("/create", async (req, res) => {
    const { user_id, website_url, business_id, widget_name } = req.body;

    try {
        const newWidget = await db.query(
            "INSERT INTO widgets (user_id, website_url, business_id, widget_name) VALUES (?, ?, ?, ?)",
            [user_id, website_url, business_id, widget_name]
        );

        res.status(201).json({ message: "✅ Widget created successfully", widget: newWidget.insertId });
    } catch (err) {
        console.error("❌ Error creating widget:", err);
        res.status(500).json({ error: "Failed to create widget." });
    }
});

// ✅ Route to fetch reviews for a given widget ID
router.get("/fetch/:widget_id", async (req, res) => {
    try {
        const { widget_id } = req.params;

        console.log(`🔍 Fetching reviews for Widget ID: ${widget_id}`);

        // Fetch widget details
        const [widget] = await db.query("SELECT * FROM widgets WHERE id = ?", [widget_id]);

        if (!widget) {
            return res.status(404).json({ error: "❌ Widget not found." });
        }

        // Fetch reviews for the widget
        const reviews = await pool.query("SELECT * FROM google_reviews WHERE widget_id = ?", [widget_id]);

        console.log(`✅ Found ${reviews.length} reviews.`);

        res.json({ widget, reviews });
    } catch (err) {
        console.error("❌ Error fetching reviews:", err);
        res.status(500).json({ error: "❌ Failed to fetch reviews." });
    }
});

// ✅ Route to fetch reviews from Google Places API and store them
router.get("/fetch-google-reviews/:widget_id", async (req, res) => {
    try {
        const { widget_id } = req.params;

        console.log(`🔍 Fetching Google reviews for Widget ID: ${widget_id}`);

        // Fetch widget details
        const [widget] = await db.query("SELECT * FROM widgets WHERE id = ?", [widget_id]);

        if (!widget) {
            return res.status(404).json({ error: "❌ Widget not found." });
        }

        const business_id = widget.business_id;

        if (!business_id) {
            return res.status(400).json({ error: "❌ Business ID is missing." });
        }

        // Fetch reviews from Google API
        const googleAPIURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${business_id}&fields=reviews&key=${process.env.GOOGLE_API_KEY}`;
        const response = await fetch(googleAPIURL);
        const data = await response.json();

        console.log("✅ Google API Response:", data);

        if (!data.result || !data.result.reviews) {
            return res.status(404).json({ error: "❌ No reviews found in Google API response." });
        }

        const reviews = data.result.reviews.map(review => ({
            widget_id: widget_id,
            author_name: review.author_name,
            rating: review.rating,
            text: review.text,
            relative_time_description: review.relative_time_description
        }));

        // Store reviews in the database
        for (let review of reviews) {
            await pool.query(
                "INSERT INTO google_reviews (widget_id, author_name, rating, text, relative_time_description) VALUES (?, ?, ?, ?, ?)",
                [review.widget_id, review.author_name, review.rating, review.text, review.relative_time_description]
            );
        }

        res.json({ message: "✅ Google reviews fetched successfully!", stored: true });
    } catch (err) {
        console.error("❌ Error fetching Google reviews:", err);
        res.status(500).json({ error: "❌ Failed to fetch Google reviews." });
    }
});


router.get("/user-widgets/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;

        console.log(`🔍 Fetching all widgets for User ID: ${user_id}`);

        const widgets = await pool.query("SELECT * FROM widgets WHERE user_id = ?", [user_id]);

        if (widgets.length === 0) {
            return res.status(404).json({ error: "❌ No widgets found for this user." });
        }

        res.json({ widgets });

    } catch (err) {
        console.error("❌ Error fetching widgets:", err);
        res.status(500).json({ error: "❌ Failed to fetch widgets." });
    }
});


router.get('/reviews.js', async (req, res) => {
    try {
        const { widget_id } = req.query;
        if (!widget_id) return res.status(400).json({ error: 'Missing widget_id' });


 const referer = req.get('Referer') || "";
const isClientWebsite = referer.includes("toprecenzie.sk"); // Change to actual domain

console.log("Referer:", referer, "→ isClientWebsite:", isClientWebsite);


        // Fetch widget details from database
        const [widget] = await db.query('SELECT * FROM widgets WHERE id = ?', [widget_id]);
        if (!widget) return res.status(404).json({ error: 'Widget not found' });

        const place_id = widget.business_id; // Retrieve Google Place ID from database

// ✅ Generate the correct Google Review Link dynamically
        const googleReviewLink = `https://search.google.com/local/writereview?placeid=${place_id}`;

        // Google Places API Request (Slovak Language Forced)
        const googleAPIKey = process.env.GOOGLE_API_KEY;
        const googleReviewsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews,rating,user_ratings_total&key=${googleAPIKey}&language=sk`;

        const response = await axios.get(googleReviewsURL);
        const data = response.data;



        if (!data.result || !data.result.reviews) {
            return res.status(500).json({ error: 'No reviews found for this place' });
return res.status(500).json({ error: 'No reviews found for this place' });
        }

        const reviews = data.result.reviews ? data.result.reviews.filter(review => review.text.trim() !== "") : [];
        const sortedReviews = reviews.sort((a, b) => b.rating - a.rating);

 const overallRating = data.result.rating;
        const totalReviews = data.result.user_ratings_total || 0;

console.log("✅ Reviews fetched:", reviews.length, "reviews found.");


for (const review of reviews) {
const reviewDate = new Date(review.time * 1000).toISOString().slice(0, 19).replace('T', ' ');
console.log("📌 Inserting review:", review.author_name);
    await db.query(
        `INSERT INTO google_reviews (widget_id, author_name, rating, text, created_at, profile_photo_url)
         SELECT ?, ?, ?, ?, ?, ? FROM DUAL
         WHERE NOT EXISTS (
            SELECT 1 FROM google_reviews
            WHERE widget_id = ?
            AND author_name = ?
            AND created_at = ?
                     )`,
        [
            widget_id, review.author_name, review.rating, review.text, reviewDate,
            review.profile_photo_url || 'https://via.placeholder.com/50', // ✅ Default profile image if missing
            widget_id, review.author_name, reviewDate
        ]
    );
}




        // ✅ Generate JavaScript snippet
        const widgetScript = `
            (function() {
                function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating % 1 >= 0.25) && (rating % 1 < 0.75);

    let stars = "";
    for (let i = 0; i < fullStars; i++) {
        stars += '<span class="star full">&#9733;</span>';
    }
    if (hasHalfStar) {
        stars += '<span class="star half"><span class="half-fill">&#9733;</span>&#9734;</span>';
    }
    for (let i = 0; i < 5 - fullStars - (hasHalfStar ? 1 : 0); i++) {
        stars += '<span class="star empty">&#9734;</span>';
    }
    return stars;
}



const isClientWebsite = ${JSON.stringify(isClientWebsite)};

                console.log("isClientWebsite in frontend:", isClientWebsite);

const googleReviewLink = "${googleReviewLink}";


                function formatDate(timestamp) {
                    return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
                        day: '2-digit', month: 'long', year: 'numeric'
                    });
                }

                window.toggleReadMore = function(event) {
                    let reviewText = event.target.previousElementSibling;
                    if (reviewText.classList.contains("expanded")) {
                        reviewText.classList.remove("expanded");
                        event.target.innerText = "Čítať viac...";
                                            } else {
                        reviewText.classList.add("expanded");
                        event.target.innerText = "Čítať menej...";
                    }
                                        };






                window.loadMoreReviews = function() {
                    document.querySelectorAll(".review.hidden").forEach(review => review.classList.remove("hidden"));
                    document.querySelector(".load-more-btn").style.display = "none";
                };

                let container = document.createElement('div');
                container.classList.add('review-widget');
                let style = document.createElement('style');
                style.innerHTML = \`
                    .review-widget {
                        font-family: 'Roboto', sans-serif;
                        max-width: 100%;
width: calc(100% - 20px) !important;
                        margin: auto;
                        background: none;
                        padding: 20px;
                        border-radius: 0;
                        box-shadow: none;
                        text-align: center;
 margin-bottom: 10px; /* Adds a 10px gap between each review */
    padding-bottom: 10px; /* Ensures spacing inside each review */
                    }
                    .review-widget h2 {
                        font-size: 22px;
                        color: #333;
                    }
                    .overall-rating {
                        font-size: 18px;
                        margin-bottom: 10px;
                    }
                    .star {
                        font-size: 20px;
                        display: inline-block;
                    }
                    .star.full {
                        color: #FFB400 !important; /* Golden stars */
                    }
                    .star.half {
                        position: relative;
                        display: inline-block;
                        color: #A0A0A0 !important;
                    }
                    .star.half .half-fill {
                        position: absolute;
                        overflow: hidden;
                        width: 50%;
                        color: #FFB400 !important;
                        font-size: 20px !important; /* ✅ Fixed half-star size */
                                  }
                    .star.empty {
                        color: #ccc !important; /* Grey empty stars */
                    }
                                            .reviews-container {
                        margin-top: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }
                    .review {
                        padding: 15px;
                        border: 1px solid #ddd;
                        border-radius: 10px;
                        background: #fff;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        justify-content: flex-start;
                        text-align: left;
                    }
                    .review.hidden {
                        display: none;
                    }
                    .review-photo {
                        width: 50px;
                        height: 50px;
                        border-radius: 50%;
                        background-size: cover;
                        background-position: center;
                        flex-shrink: 0;
                    }
                    .review-content {
                        flex-grow: 1;
                    }
                    .review-header {
                        font-weight: bold;
                        font-size: 1.2em;
                        color: #555;
                    }
                    .review-text {
                        font-size: 14px;
                        color: #777;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 3;
                        -webkit-box-orient: vertical;
                    }
                    .review-text.expanded {
                        -webkit-line-clamp: unset;
                    }
                    .review-date {
                        font-size: 12px;
                                                color: #999;
                        text-align: right;
                        display: block;
                        margin-top: 5px;
                    }
                    .read-more {
                        color: blue;
                                                cursor: pointer;
                        font-size: 14px;
                        display: none;
                    }
                    .review-text.long + .read-more {
                        display: inline;
                    }
                    .load-more-btn {
                        display: block;
                        background: #FFB400;
                        color: white;
                        padding: 10px;
                        border-radius: 5px;
                        text-align: center;
                        cursor: pointer;
                        border: none;
                        width: 150px;
                        margin: 0;
                        font-weight: bold;
                    }
                    .leave-review-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #4285F4;
                        color: white;
                        text-align: center;
                        padding: 10px;
                        border-radius: 5px;
                        margin-top: 10px;
                        text-decoration: none;
                        width: 250px;
                        margin: 0;
                        font-weight: bold;
                    }
                    .leave-review-btn img {
                        width: 20px;
                        height: 20px;
                        margin-right: 10px;
                    }
.leave {
display: flex;
align-items: center;
justify-content: center;
font-weight: bold;
gap:8px;
}
.leave img{
width: 24px;
height:24px;
margin: 0;
}

.button-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px; /* Space between the buttons */
    margin-top: 20px;
}


/* Tab Navigation */
.tabs {
display: flex;
    justify-content: center;
    gap: 20px; /* Adds spacing between tabs */
    border-bottom: 2px solid #ddd; /* Light border under all tabs */
    padding-bottom: 8px;
    margin-bottom: 10px;
    max-width: calc(100% - 20px); /* Prevents tabs from exceeding screen width */
    margin-left: auto;
    margin-right: auto;
}

.tab {
    background: none;
    border: none;
    padding: 8px 15px;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    transition: background 0.3s;
color: black;
position: relative;
}

.tab.active {
    color: black;
}

.tab.active::after {
    content: "";
    display: block;
    width: 100%;
    height: 3px;
    background-color: black;
    position: absolute;
    bottom: -10px;
    left: 0;
}

/* Vertical Scrolling */
.vertical-reviews-container {
   max-height: 400px;
max-width: 100%;
width: calc(100% - 20px);
margin :auto;
    overflow-y: auto;
    padding: 10px;
}

/* ✅ Add Bottom Spacing Between Each Vertical Review */
.vertical-reviews-container .review {
    margin-bottom: 10px; /* Adds a 10px gap between each review */
    padding-bottom: 10px; /* Ensures spacing inside each review */
}

.vertical-reviews-container::-webkit-scrollbar {
    width: 8px;
}

.vertical-reviews-container::-webkit-scrollbar-thumb {
    background-color: #ccc;
    border-radius: 10px;
}

/* Horizontal Scrolling */
.horizontal-reviews-container {
    display: none; /* Initially hidden */
    flex-wrap: nowrap;
max-width: 100%;
width: calc(100% - 20px);
margin: auto;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 10px;
    padding: 10px;
}

.horizontal-reviews-container::-webkit-scrollbar {
    height: 8px;
}

.horizontal-reviews-container::-webkit-scrollbar-thumb {
    background-color: #ccc;
    border-radius: 10px;
}

/* Each review should snap while scrolling */
.horizontal-reviews-container .review {
    flex: 0 0 auto;
    width: 300px;
    scroll-snap-align: start;
}


                \`;
                               document.head.appendChild(style);


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
shuffleArray(reviews);


                                let reviewsData = ${JSON.stringify(sortedReviews)};


shuffleArray(reviewsData);

function openGoogleReview(event) {
    event.preventDefault(); // Prevent default link behavior
    window.open(
        event.currentTarget.href,
        'GoogleReviewWindow',
        'width=600,height=600,left=200,top=200'
    );
}






                container.innerHTML = \`
                    <h2 class="leave"><img src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png"> Google Recenzie</h2>
                    <div class="overall-rating">
                        <div class="rating-stars">\${generateStars(${overallRating})}</div>
                        <span>(${overallRating}/5) ${totalReviews} recenzií</span>
                    </div>


                    <!-- Tab Navigation -->

       \${isClientWebsite ? \`
        <div class="tabs">
            <button id="tab-vertical" class="tab active" onclick="switchTab('vertical')">Comments Vertically</button>
            <button id="tab-horizontal" class="tab" onclick="switchTab('horizontal')">Comments Horizontally</button>
        </div>
      \` : ''}
 <!-- Vertical Reviews Section -->
                    <div id="vertical-reviews" class="reviews-container">
                        \${reviewsData.map((review, index) => \`
                            <div class="review \${index >= 3 ? 'hidden' : ''}">
                                <div class="review-photo" style="background-image: url('\${review.profile_photo_url || 'https://via.placeholder.com/50'}');"></div>
                                <div class="review-content">
                                    <span class="review-header">\${review.author_name}</span>
                                    <div class="review-stars">\${generateStars(review.rating)}</div>
                                    <p class="review-text \${review.text.length > 150 ? 'long' : ''}">\${review.text}</p>
                                  <span class="read-more" onclick="toggleReadMore(event)">Čítať viac...</span>
                                    <span class="review-date">\${formatDate(review.time)}</span>
                                </div>
                            </div>
                        \`).join('')}
                    </div>

 <!-- Horizontal Reviews Section -->
       \${isClientWebsite ? \`
        <div id="horizontal-reviews" class="horizontal-reviews-container">
                        \${reviewsData.map((review, index) => \`
                            <div class="review \${index >= 3 ? 'hidden' : ''}">
                                <div class="review-photo" style="background-image: url('\${review.profile_photo_url || 'https://via.placeholder.com/50'}');"></div>
                                <div class="review-content">
                                    <span class="review-header">\${review.author_name}</span>
                                    <div class="review-stars">\${generateStars(review.rating)}</div>
                                    <p class="review-text \${review.text.length > 150 ? 'long' : ''}">\${review.text}</p>
                                    <span class="read-more" onclick="toggleReadMore(event)">Čítať viac...</span>
                                    <span class="review-date">\${formatDate(review.time)}</span>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                  \` : ''}

<div class="button-container">
    <a href="\${googleReviewLink}"
        class="leave-review-btn" target="_blank" rel="noopener noreferrer"">
        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png" alt="Google Logo"> Ohodnoťte nás
    </a>
    <button class="load-more-btn" onclick="loadMoreReviews()">Načítať viac...</button>
</div>

                \`;

                document.currentScript.parentNode.insertBefore(container, document.currentScript);





// ✅ Attach switchTab to window if on Client's Website
                if (isClientWebsite) {
                    window.switchTab = function(view) {
                        const verticalReviews = document.getElementById('vertical-reviews');
                        const horizontalReviews = document.getElementById('horizontal-reviews');

                        if (verticalReviews && horizontalReviews) {
                            verticalReviews.style.display = (view === 'vertical') ? 'block' : 'none';
                            horizontalReviews.style.display = (view === 'horizontal') ? 'flex' : 'none';
                        }

                        document.getElementById('tab-vertical')?.classList.toggle('active', view === 'vertical');
                        document.getElementById('tab-horizontal')?.classList.toggle('active', view === 'horizontal');
                    };
                       document.getElementById("tab-vertical").addEventListener("click", () => switchTab("vertical"));
                    document.getElementById("tab-horizontal").addEventListener("click", () => switchTab("horizontal"));
                }



            })();
        `;

        res.setHeader('Content-Type', 'application/javascript');
        res.send(widgetScript);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});



cron.schedule('0 2 * * 1', async () => {
    console.log("🔄 Fetching latest reviews from Google Places API...");

    try {
        const businesses = await db.query("SELECT widget_id, business_id FROM widgets");

        for (const business of businesses) {
            const place_id = business.business_id;
            const widget_id = business.widget_id;

            const googleReviewsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews,rating,user_ratings_total&key=${process.env.GOOGLE_API_KEY}&language=sk`;

            const response = await axios.get(googleReviewsURL);
            const data = response.data;

            if (data.result && data.result.reviews) {
                for (const review of data.result.reviews) {
                    await db.query(
                        `INSERT INTO google_reviews (widget_id, author_name, rating, text, time, profile_photo_url)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                         text = VALUES(text), rating = VALUES(rating), time = VALUES(time), profile_photo_url = VALUES(profile_photo_url)`,
                        [
                            widget_id, review.author_name, review.rating, review.text, review.time,
                            review.profile_photo_url || 'https://via.placeholder.com/50'
                        ]
                    );
                }
            }
        }
    } catch (error) {
        console.error("❌ Error fetching reviews:", error);
    }
});


module.exports = router;
