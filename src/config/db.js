const mariadb = require("mariadb");

const db = mariadb.createPool({
    host: "127.0.0.1",
    port: 3306,  // Ensure it's correct
    user: "root",
    password: "my-secret-pw",
    database: "google_reviews",
    connectionLimit: 5
});

module.exports = db;
