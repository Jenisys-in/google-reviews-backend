const express = require("express");
const db = require("../config/db");
const { fetchGoogleReviews } = require("../config/googleAPI");
const cron = require('node-cron');
const axios = require('axios');
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
        const reviews = await db.query("SELECT * FROM google_reviews WHERE widget_id = ?", [widget_id]);

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

        console.log(`🔍 Fetching Google reviews via SERP API for Widget ID: ${widget_id}`);

        // Fetch widget details
        const [widget] = await db.query("SELECT * FROM widgets WHERE id = ?", [widget_id]);

        if (!widget) {
            return res.status(404).json({ error: "❌ Widget not found." });
        }

        const business_id = widget.business_id;

        if (!business_id) {
            return res.status(400).json({ error: "❌ Business ID is missing." });
        }

        // Fetch reviews from SERP API
        const serpApiURL = `https://serpapi.com/search.json`;
        const searchParams = {
            engine: "google_maps_reviews",
            place_id: business_id,
            hl: "sk",
            sort_by: "ratingHigh",
            api_key: process.env.SERP_API_KEY
        };

        const response = await axios.get(serpApiURL, { params: searchParams });
        const data = response.data;

        console.log("✅ SERP API Response received");

        if (!data.reviews) {
            return res.status(404).json({ error: "❌ No reviews found in SERP API response." });
        }

        // Map SERP API response to our database structure
        const reviews = data.reviews.map(review => {
            // Try to extract a timestamp if possible
            let timestamp = null;
            if (review.time) {
                timestamp = review.time;
            } else if (review.date) {
                // If there's a date string but no timestamp, we'll use it as is
                // The formatDate function will handle this
            }
            
            return {
                widget_id: widget_id,
                author_name: review.user?.name || "Anonymous",
                rating: review.rating || 0,
                text: review.snippet || "",
                relative_time_description: review.date || "",
                profile_photo_url: review.user?.thumbnail || "",
                time: timestamp
            };
        });
        const sortedReviews = reviews.sort((a, b) => b.rating - a.rating);

        // Store reviews in the database
        for (let review of reviews) {
            // Check if review already exists to avoid duplicates
            const [existingReview] = await db.query(
                "SELECT id FROM google_reviews WHERE widget_id = ? AND author_name = ? AND text = ?",
                [review.widget_id, review.author_name, review.text]
            );

            if (!existingReview) {
                await db.query(
                    "INSERT INTO google_reviews (widget_id, author_name, rating, text, relative_time_description, profile_photo_url) VALUES (?, ?, ?, ?, ?, ?)",
                    [review.widget_id, review.author_name, review.rating, review.text, review.relative_time_description, review.profile_photo_url]
                );
            }
        }

        res.json({ message: "✅ Google reviews fetched successfully via SERP API!", stored: true });
    } catch (err) {
        console.error("❌ Error fetching Google reviews via SERP API:", err);
        res.status(500).json({ error: "❌ Failed to fetch Google reviews." });
    }
});


router.get("/user-widgets/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;

        console.log(`🔍 Fetching all widgets for User ID: ${user_id}`);

        const widgets = await db.query("SELECT * FROM widgets WHERE user_id = ?", [user_id]);

        if (widgets.length === 0) {
            return res.status(404).json({ error: "❌ No widgets found for this user." });
        }

        res.json({ widgets });

    } catch (err) {
        console.error("❌ Error fetching widgets:", err);
        res.status(500).json({ error: "❌ Failed to fetch widgets." });
    }
});

// Added a new endpoint to update widget settings
router.post("/update-settings/:widget_id", async (req, res) => {
    try {
        const { widget_id } = req.params;
        const { layout_type } = req.body;
        
        if (!['vertical', 'horizontal'].includes(layout_type)) {
            return res.status(400).json({ error: "❌ Invalid layout type. Must be 'vertical' or 'horizontal'." });
        }

        // Get the user_id for this widget
        const [widget] = await db.query("SELECT user_id FROM widgets WHERE id = ?", [widget_id]);
        
        if (!widget) {
            return res.status(404).json({ error: "❌ Widget not found." });
        }
        
        // Check if user has an active subscription - using the actual table structure
        const subscription = await db.query(
            "SELECT * FROM subscriptions WHERE user_id = ?",
            [widget.user_id]
        );
        
        if (!subscription.length) {
            return res.status(403).json({ 
                error: "❌ Active subscription required to change layout settings.",
                message: "Please subscribe to access layout customization features."
            });
        }

        await db.query(
            "UPDATE widgets SET layout_type = ? WHERE id = ?",
            [layout_type, widget_id]
        );

        const widgetEmbedCode = `<script src="${process.env.API_BASE_URL}/api/widget/reviews.js?widget_id=${widget_id}"></script>`;

        res.json({ 
            message: "✅ Widget settings updated successfully", 
            embed_code: widgetEmbedCode 
        });
    } catch (err) {
        console.error("❌ Error updating widget settings:", err);
        res.status(500).json({ error: "Failed to update widget settings." });
    }
});

// Added a dashboard endpoint
router.get("/dashboard/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;
        
        const widgets = await db.query(`
            SELECT 
                w.*,
                COUNT(gr.id) AS total_reviews,
                AVG(gr.rating) AS average_rating
            FROM 
                widgets w
            LEFT JOIN 
                google_reviews gr ON w.id = gr.widget_id
            WHERE 
                w.user_id = ?
            GROUP BY 
                w.id
        `, [user_id]);
        
        if (widgets.length === 0) {
            return res.json({ widgets: [] });
        }
        
        const widgetsWithEmbedCode = widgets.map(widget => {
            const embedCode = `<script src="${process.env.API_BASE_URL}/api/widget/reviews.js?widget_id=${widget.id}"></script>`;
            return {
                ...widget,
                embed_code: embedCode
            };
        });
        
        res.json({ widgets: widgetsWithEmbedCode });
    } catch (err) {
        console.error("❌ Error fetching widgets dashboard:", err);
        res.status(500).json({ error: "Failed to fetch widgets dashboard." });
    }
});


function estimateExactDate(relativeString) {
    const now = new Date();
    if (!relativeString || typeof relativeString !== 'string') return now;
  
    // Translate Slovak phrases to English
    relativeString = relativeString
      .replace('pred ', '') // remove "pred" = "ago"
      .replace('mesiacmi', 'months')
      .replace('mes.', 'months')
      .replace('rokmi', 'years')
      .replace('rokom', 'year')
      .replace('týždňami', 'weeks')
      .replace('dňami', 'days')
      .replace('deň', '1 day')
      .replace('dnami', 'days');
  
    // Convert "a year ago" or "an hour ago" → "1 year ago"
    relativeString = relativeString
      .replace(/^a /, '1 ')
      .replace(/^an /, '1 ')
      .replace(/^yesterday$/, '1 day')
      .replace(/^today$/, '0 day');
  
    const [amount, unitRaw] = relativeString.trim().split(' ');
    const unit = unitRaw?.toLowerCase().replace(/s$/, '');
    const num = parseInt(amount);
  
    if (isNaN(num)) return now;
  
    switch (unit) {
      case 'year':
        now.setFullYear(now.getFullYear() - num);
        break;
      case 'month':
        now.setMonth(now.getMonth() - num);
        break;
      case 'week':
        now.setDate(now.getDate() - num * 7);
        break;
      case 'day':
        now.setDate(now.getDate() - num);
        break;
      default:
        return now;
    }
  
    return now;
  }
  
  
router.get('/reviews.js', async (req, res) => {
    try {
        const { widget_id } = req.query;
        if (!widget_id) return res.status(400).json({ error: 'Missing widget_id' });


        const referer = req.get('Referer') || "";
        let isHomepage = false;

        try {
            const url = new URL(referer);
            isHomepage = url.hostname.includes("toprecenzie.sk") && (url.pathname === "/" || url.pathname === "");
        } catch (err) {
            console.warn("Invalid referer URL:", referer);
        }


        // Fetch widget details from database
       // Fetch widget details from database
const [widget] = await db.query('SELECT layout_type, business_id, user_id FROM widgets WHERE id = ?', [widget_id]);
if (!widget) return res.status(404).json({ error: 'Widget not found' });

        // Check if user has an active subscription
        const subscription = await db.query(
            "SELECT * FROM subscriptions WHERE user_id = ? AND plan = 'basic'",
            [widget.user_id]
        );
        
        const hasActiveSubscription = subscription.length > 0;
        
        const layout_type = widget.layout_type || 'vertical'; // Fetch the layout from database
        const initialView = isHomepage ? 'vertical' : layout_type; // Show both layouts on client site
        

        const place_id = widget.business_id; // Retrieve Google Place ID from database

        // ✅ Generate the correct Google Review Link dynamically
        const googleReviewLink = `https://search.google.com/local/writereview?placeid=${place_id}`;

        // Track API request
        await db.query(
            "INSERT INTO api_requests (user_id, widget_id, request_type) VALUES (?, ?, ?)",
            [widget.user_id, widget_id, "google_places_details"]
        );

        const searchParams = {
            engine: "google_maps_reviews",
            place_id: place_id,
            hl: "sk",
            sort_by: "ratingHigh",
            api_key: process.env.SERP_API_KEY
        };

        // ✅ Check if 5-star reviews already exist in DB
        let rows = [];
        try {
          const result = await db.query(
            "SELECT * FROM google_reviews WHERE widget_id = ? AND rating = 5",
            [widget_id]
          );
          rows = Array.isArray(result[0]) ? result[0] : [];
        } catch (err) {
          console.error("❌ Error fetching DB rows:", err);
        }
        
  
  let reviews = [];
  
  if (rows.length > 0) {
    console.log("✅ Using cached 5-star reviews from DB");
  
    reviews = rows.map((r) => {
        const createdAtRaw = r.created_at;
        let formattedDate = '';
      
        try {
          const parsedDate = new Date(createdAtRaw.replace(' ', 'T'));
          if (!isNaN(parsedDate)) {
            formattedDate = parsedDate.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });
          } else {
            console.warn("⚠️ Invalid date format from DB:", createdAtRaw);
          }
        } catch (err) {
          console.error("❌ Error formatting date:", err);
        }
      
        return {
          widget_id: r.widget_id,
          author_name: r.author_name,
          rating: r.rating,
          text: r.text,
          relative_time_description: formattedDate,
          profile_photo_url: r.profile_photo_url,
          time: new Date(createdAtRaw.replace(' ', 'T')).getTime() / 1000
        };
      });
      
  
    overallRating = 5;
    totalReviews = reviews.length;
    nextPageToken = null;
  } else {
    console.log("🚀 Fetching fresh reviews from SerpAPI");
  
    let data;
    try {
      const response = await axios.get("https://serpapi.com/search.json", { params: searchParams });
      data = response.data;
    } catch (err) {
      console.error("❌ SerpAPI call failed:", err);
      return res.status(500).json({ error: "SerpAPI request failed" });
    }
    
  
    // Track API response size
    const responseSize = JSON.stringify(data).length;
    await db.query(
      "UPDATE api_requests SET response_size = ?, status = 'completed' WHERE user_id = ? AND widget_id = ? ORDER BY created_at DESC LIMIT 1",
      [responseSize, widget.user_id, widget_id]
    );
  
    if (!data.reviews) {
      return res.status(500).json({ error: 'No reviews found for this place' });
    }
  
    const fiveStarReviews = data.reviews.filter(r => r.rating === 5);
  
    reviews = fiveStarReviews.map(review => {
        let reviewDate;
      
        if (review.time) {
          reviewDate = new Date(review.time * 1000);
        } else if (review.date) {
          reviewDate = estimateExactDate(review.date);
        } else {
          reviewDate = new Date(); // fallback
        }
      
        const formattedDate = reviewDate.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      
        return {
          widget_id: widget_id,
          author_name: review.user?.name || "Anonymous",
          rating: review.rating,
          text: review.snippet || "",
          relative_time_description: formattedDate,
          profile_photo_url: review.user?.thumbnail || "",
          time: Math.floor(reviewDate.getTime() / 1000)
        };
      });
      
  
    overallRating = data.place_info?.rating || 5;
    totalReviews = data.place_info.reviews || 0;
    nextPageToken = data.next_page_token || null;
  
    console.log("✅ 5-star Reviews fetched:", reviews.length);
  
    for (const review of reviews) {
      let reviewDate;
      try {
        if (review.time) {
          reviewDate = new Date(review.time * 1000).toISOString().slice(0, 19).replace('T', ' ');
        } else {
          reviewDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        }
      } catch (err) {
        console.error("❌ Error parsing review date:", err);
        reviewDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
      }
  
      const [existingReview] = await db.query(
        `SELECT id FROM google_reviews 
         WHERE widget_id = ? AND author_name = ? AND text = ?`,
        [widget_id, review.author_name, review.text]
      );
  
      if (!existingReview) {
        console.log("📌 Inserting new 5-star review:", review.author_name);
        await db.query(
          `INSERT INTO google_reviews (widget_id, author_name, rating, text, created_at, profile_photo_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [widget_id, review.author_name, review.rating, review.text, reviewDate, review.profile_photo_url || 'https://via.placeholder.com/50']
        );
      } else {
        console.log("📌 Skipping existing 5-star review:", review.author_name);
      }
    }
  }
  
        // ✅ Define tab navigation as an empty string by default
let tabNavigation = "";





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



const isHomepage = window.location.hostname.includes("toprecenzie.sk") && 
                   (window.location.pathname === "/" || window.location.pathname === "");


                console.log("isHomepage in frontend:", isHomepage);

const googleReviewLink = "${googleReviewLink}";


                function formatDate(timestamp) {
                    if (!timestamp) {
                        return "Recently"; // Default text for missing timestamps
                    }
                    try {
                        return new Date(timestamp * 1000).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'long', year: 'numeric'
                        });
                    } catch (err) {
                        console.error("Error formatting date:", err);
                        return "Recently"; // Fallback for invalid dates
                    }
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
                    const hiddenReviews = document.querySelectorAll(".review.hidden");
                    
                    // If there are hidden reviews, show them first
                    if (hiddenReviews.length > 0) {
                        hiddenReviews.forEach(review => review.classList.remove("hidden"));
                    } 
                    // If no hidden reviews or we've shown them all, fetch more with next_page_token
                    else if (window.nextPageToken) {
                        const currentScript = document.currentScript || document.querySelector('script[src*="reviews.js"]');
                        const widgetId = new URLSearchParams(currentScript.src.split('?')[1]).get('widget_id');
                        
                        // Create a new script element to fetch more reviews
                        const newScript = document.createElement('script');
                        newScript.src = \`\${currentScript.src.split('?')[0]}?widget_id=\${widgetId}&next_page_token=\${window.nextPageToken}&num=10\`;
                        document.body.appendChild(newScript);
                        
                        // Show loading state
                        document.querySelector(".load-more-btn").innerText = "Loading...";
                    } else {
                        // No more reviews to load
                        document.querySelector(".load-more-btn").style.display = "none";
                    }
                };

                // Store next_page_token for pagination
                window.nextPageToken = "${nextPageToken || ''}";

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
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background-color: #4285F4;
    color: white;
    text-decoration: none;
    font-weight: bold;
    font-size: 16px;
    padding: 10px 20px;
    border-radius: 999px;
    white-space: nowrap;
    gap: 8px;
    max-width: 100%;
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
    display: flex; /* Initially hidden */
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





                               let reviewsData = ${JSON.stringify(reviews)};

                               const isHomepage = window.location.hostname.includes("toprecenzie.sk") && 
                   (window.location.pathname === "/" || window.location.pathname === "");

let tabNavigationHTML = "";
if (isHomepage) {
    tabNavigationHTML = \`
        <div class="tabs">
            <button id="tab-vertical" class="tab active" onclick="switchTab('vertical')">Comments Vertically</button>
            <button id="tab-horizontal" class="tab" onclick="switchTab('horizontal')">Comments Horizontally</button>
        </div>
    \`;
}

                               console.log("✅ Review dates:", reviewsData.map(r => r.relative_time_description));



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

       
                    ${tabNavigationHTML}


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
                                    <span class="review-date">\${review.relative_time_description}</span>
                                </div>
                            </div>
                        \`).join('')}
                    </div>

 <!-- Horizontal Reviews Section -->
       
        <div id="horizontal-reviews" class="horizontal-reviews-container">
                        \${reviewsData.map((review, index) => \`
                            <div class="review \${index >= 3 ? 'hidden' : ''}">
                                <div class="review-photo" style="background-image: url('\${review.profile_photo_url || 'https://via.placeholder.com/50'}');"></div>
                                <div class="review-content">
                                    <span class="review-header">\${review.author_name}</span>
                                    <div class="review-stars">\${generateStars(review.rating)}</div>
                                    <p class="review-text \${review.text.length > 150 ? 'long' : ''}">\${review.text}</p>
                                    <span class="read-more" onclick="toggleReadMore(event)">Čítať viac...</span>
                                    <span class="review-date">\${review.relative_time_description}</span>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                  

<div class="button-container">
    <a href="\${googleReviewLink}"
        class="leave-review-btn" target="_blank" rel="noopener noreferrer"">
        <img src="https://www.gstatic.com/images/branding/product/1x/gsa_64dp.png" alt="Google Logo"> Ohodnoťte nás
    </a>
    <button class="load-more-btn" onclick="loadMoreReviews()">Načítať viac...</button>
</div>

                \`;

                document.currentScript.parentNode.insertBefore(container, document.currentScript);

                let verticalReviews = document.createElement('div');
                verticalReviews.id = 'vertical-reviews';
                verticalReviews.style.display = '${initialView === "vertical" ? "block" : "none"}';

                let horizontalReviews = document.createElement('div');
                horizontalReviews.id = 'horizontal-reviews';
                horizontalReviews.style.display = '${initialView === "horizontal" ? "block" : "none"}';

                container.appendChild(verticalReviews);
                container.appendChild(horizontalReviews);
                document.currentScript.parentNode.insertBefore(container, document.currentScript);
                
                // ✅ Ensure the correct layout is displayed initially
                window.switchTab = function(tabName) {
    document.getElementById('vertical-reviews').style.display = (tabName === 'vertical') ? 'block' : 'none';
    document.getElementById('horizontal-reviews').style.display = (tabName === 'horizontal') ? 'flex' : 'none';

    // ✅ Ensure elements exist before modifying classList
    let verticalTab = document.getElementById('tab-vertical');
    let horizontalTab = document.getElementById('tab-horizontal');

    if (verticalTab) verticalTab.classList.toggle('active', tabName === 'vertical');
    if (horizontalTab) horizontalTab.classList.toggle('active', tabName === 'horizontal');
};


                
                window.switchTab(isHomepage ? 'vertical' : '${layout_type}');
            })();
        `;

        res.setHeader('Content-Type', 'application/javascript');
        res.send(widgetScript);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server Error' });
    }
});




cron.schedule('0 0 * * 1', async () => { // Runs every 30 minutes
    console.log("🔄 Running Cron Job: Fetching new 5-star reviews...");
    
    try {
        const widgets = await db.query("SELECT id, business_id, user_id FROM widgets");

        for (const widget of widgets) {
            const place_id = widget.business_id;
            const widget_id = widget.id;
            const user_id = widget.user_id;

            console.log(`📢 Checking Widget ID: ${widget_id} for new reviews`);

            // ✅ Fetch only 5-star reviews
            const googleReviewsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews&review_sort=newest&key=${process.env.GOOGLE_API_KEY}&language=sk`;
            const response = await axios.get(googleReviewsURL);
            const data = response.data;

            if (!data.result || !data.result.reviews) {
                console.log(`⚠ No reviews found for Widget ID: ${widget_id}`);
                continue;
            }

            

            // ✅ Filter only new 5-star reviews
            const fiveStarReviews = data.result.reviews.filter(review => review.rating === 5);

            // ✅ Get the latest review timestamp from DB
            const [latestReview] = await db.query(
                "SELECT created_at FROM google_reviews WHERE widget_id = ? ORDER BY created_at DESC LIMIT 1",
                [widget_id]
            );
            const latestReviewTime = latestReview ? new Date(latestReview.created_at).getTime() / 1000 : 0;

            // ✅ Only process reviews newer than the last stored review
            const newReviews = fiveStarReviews.filter(review => review.time > latestReviewTime);

            console.log(`✅ Found ${newReviews.length} new 5-star reviews for Widget ID: ${widget_id}`);

            for (const review of newReviews) {
                const reviewDate = new Date(review.time * 1000).toISOString().slice(0, 19).replace('T', ' ');
                await db.query(`
                    INSERT INTO google_reviews (widget_id, author_name, rating, text, created_at, profile_photo_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE text = VALUES(text), profile_photo_url = VALUES(profile_photo_url), created_at = NOW();
                `, [widget_id, review.author_name, review.rating, review.text, reviewDate, review.profile_photo_url || 'https://via.placeholder.com/50']);
            }
        }
    } catch (error) {
        console.error("❌ Error fetching reviews in cron job:", error);
    }
});



// ✅ Temporary endpoint to trigger the cron job for testing
// ✅ Manually Trigger Cron Job
router.get("/trigger-cron", async (req, res) => {
    console.log("🔄 Manually triggering cron job: Fetching new 5-star reviews...");

    try {
        const widgets = await db.query("SELECT id, business_id, user_id FROM widgets");

        for (const widget of widgets) {
            const place_id = widget.business_id;
            const widget_id = widget.id;
            const user_id = widget.user_id;

            console.log(`📢 Checking Widget ID: ${widget_id} for new reviews`);

            // ✅ Fetch only 5-star reviews
            const googleReviewsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=reviews&review_sort=newest&key=${process.env.GOOGLE_API_KEY}&language=sk`;
            const response = await axios.get(googleReviewsURL);
            const data = response.data;

            if (!data.result || !data.result.reviews) {
                console.log(`⚠ No reviews found for Widget ID: ${widget_id}`);
                continue;
            }

            // ✅ Filter only new 5-star reviews
            const fiveStarReviews = data.result.reviews.filter(review => review.rating === 5);

            // ✅ Get the latest review timestamp from DB
            const [latestReview] = await db.query(
                "SELECT created_at FROM google_reviews WHERE widget_id = ? ORDER BY created_at DESC LIMIT 1",
                [widget_id]
            );
            const latestReviewTime = latestReview ? new Date(latestReview.created_at).getTime() / 1000 : 0;

            // ✅ Only process reviews newer than the last stored review
            const newReviews = fiveStarReviews.filter(review => review.time > latestReviewTime);

            console.log(`✅ Found ${newReviews.length} new 5-star reviews for Widget ID: ${widget_id}`);

            for (const review of newReviews) {
                const reviewDate = new Date(review.time * 1000).toISOString().slice(0, 19).replace('T', ' ');
                await db.query(`
                    INSERT INTO google_reviews (widget_id, author_name, rating, text, created_at, profile_photo_url)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE text = VALUES(text), profile_photo_url = VALUES(profile_photo_url), created_at = NOW();
                `, [widget_id, review.author_name, review.rating, review.text, reviewDate, review.profile_photo_url || 'https://via.placeholder.com/50']);
            }
        }

        res.json({ message: "✅ Manual cron job triggered successfully" });
    } catch (error) {
        console.error("❌ Error in manual cron trigger:", error);
        res.status(500).json({ error: "Failed to trigger cron job" });
    }
});
module.exports = router;