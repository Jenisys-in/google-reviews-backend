# 🌟 Google Reviews Widget System

A full-stack, multilingual system that allows businesses to generate, manage, and embed Google Reviews widgets on their websites. Developed by [Jenisys](https://jenisys.in), this project combines a WordPress admin interface, customizable frontend review widgets, and a backend API connected to a remote MariaDB database.

---

## 🧩 What This Project Includes

| Component | Description |
|----------|-------------|
| 🔧 **Admin Plugin** | WordPress plugin for managing widget users, layout types, Google Place IDs, and embed codes. |
| 🌐 **Frontend Widget Plugin** | WordPress shortcode plugin that renders reviews dynamically using a JS snippet (`/reviews.js`). |
| ⚙️ **Node.js Backend API** | Fetches, caches, and serves Google Reviews from SerpAPI. Includes layout rendering and DB syncing. |
| 🗃 **MariaDB Database** | Hosted on Hetzner, stores widgets, reviews, users, and subscription status. |
| 🔁 **Subscription Auto Cleanup** | Automatically deletes widget + reviews if the user cancels membership via Paid Memberships Pro. |

---

## 🚀 Features

- 🔐 Secure admin panel with role + nonce protection
- ✍️ Customizable review layout: `vertical` or `horizontal`
- 📦 Embeddable JS snippet and shortcode
- 🔁 SerpAPI-powered review fetching with DB caching
- 💾 Remote MariaDB sync for fast backend access
- 🧹 Auto-deletion of user & reviews on membership cancel
- 🌍 Slovak frontend + multilingual support
- 📊 Logs SerpAPI API requests per user

---

## 📁 Folder Structure

project-root/ ├── wp-admin-plugin/ # Google Reviews Widget Admin (WordPress) ├── wp-widget-plugin/ # Shortcode-based frontend plugin ├── node-api-server/ # Express-based backend ├── sql/ # MariaDB schema files └── README.md # This file


---

## 🛠 Setup & Configuration

### 1. WordPress Admin Plugin

- Copy plugin folder into `wp-content/plugins/google-reviews-widget-admin/`
- Update DB connection:
  ```php
  $hetzner_db = new wpdb('root', 'Toprecenzie', 'google_reviews', '128.140.124.88');
Activate from WordPress admin
2. Node.js Backend API
Located at: https://api.toprecenzie.sk/api/widget/reviews.js
Handles:
Google Reviews caching
Layout rendering
SerpAPI interaction
3. Database Schema
Tables:

users (id, email, name, company_name, password, created_at)
widgets (id, user_id, widget_name, website_url, business_id, layout_type)
google_reviews (id, widget_id, author_name, text, rating, created_at, profile_photo_url)
subscriptions (id, user_id, plan, status)
api_requests (user_id, widget_id, request_type, status, response_size)
Hosted on: Hetzner VPS

📦 Shortcode & Embeddable Widget

Embed Code Example:
<script async src="https://api.toprecenzie.sk/api/widget/reviews.js?widget_id=123&layout=vertical"></script>
Shortcode:
[google_reviews_widget id="123" layout="horizontal"]
🔁 Membership Integration

Using Paid Memberships Pro, the system:

Checks if a user has an active plan
Deletes widget + reviews from DB on cancellation
Ensures only subscribed users have access to widget creation
🌐 Live Example

Visit: https://toprecenzie.sk
Widgets are embedded throughout client websites and tested across pages.

📦 API Request Management

Each SerpAPI request is logged with:
user_id
widget_id
request_type
response_size
Only fetches fresh reviews if no cached reviews exist in the DB
✅ Roadmap / TODO

 Add pagination for admin widget table
 User-level customization (fonts, colors)
 Caching next_page_token results
 Dashboard widget performance analytics
👨‍💻 Developed By

Tuhin Das – Founder & CEO of Jenisys
AI Engineer • Full Stack Dev • Automation Consultant
📩 support@jenisys.in

📄 License

This project is proprietary and licensed to Jenisys clients only.
To request white-label licensing or commercial use, contact us at jenisys.in.