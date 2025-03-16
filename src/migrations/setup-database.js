const db = require('../config/db');

/**
 * Database migration script to create all tables
 * 
 * This script can be run by new developers to set up the database schema
 * Run with: node src/migrations/setup-database.js
 */

async function setupDatabase() {
  let conn;
  
  try {
    conn = await db.getConnection();
    console.log('Connected to database. Creating tables...');
    
    // Create users table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        company_name VARCHAR(255),
        password VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Users table created');
    
    // Create subscriptions table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        plan VARCHAR(255),
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Subscriptions table created');
    
    // Create widgets table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS widgets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        widget_name VARCHAR(255),
        website_url VARCHAR(255),
        business_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        layout_type VARCHAR(20),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    console.log('✅ Widgets table created');
    
    // Create google_reviews table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS google_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        widget_id INT,
        author_name VARCHAR(255),
        rating INT,
        text TEXT,
        relative_time_description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        profile_photo_url TEXT,
        FOREIGN KEY (widget_id) REFERENCES widgets(id)
      )
    `);
    console.log('✅ Google reviews table created');
    
    // Create api_requests table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS api_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        widget_id INT,
        request_type VARCHAR(50),
        response_size INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (widget_id) REFERENCES widgets(id)
      )
    `);
    console.log('✅ API requests table created');
    
    console.log('All tables created successfully!');
    
    // Display database schema information
    console.log('\nDatabase Schema Information:');
    
    const tables = await conn.query(`SHOW TABLES`);
    console.log('\nTables in database:');
    tables.forEach(table => {
      const tableName = Object.values(table)[0];
      console.log(`- ${tableName}`);
    });
    
    // For each table, show its structure
    for (const table of tables) {
      const tableName = Object.values(table)[0];
      console.log(`\nStructure of ${tableName} table:`);
      const columns = await conn.query(`DESCRIBE ${tableName}`);
      console.log('+-----------------+--------------+------+-----+-------------------+----------------+');
      console.log('| Field           | Type         | Null | Key | Default           | Extra          |');
      console.log('+-----------------+--------------+------+-----+-------------------+----------------+');
      columns.forEach(column => {
        console.log(`| ${column.Field.padEnd(15)} | ${column.Type.padEnd(12)} | ${column.Null.padEnd(4)} | ${column.Key.padEnd(3)} | ${(column.Default || 'NULL').toString().padEnd(17)} | ${(column.Extra || '').padEnd(14)} |`);
      });
      console.log('+-----------------+--------------+------+-----+-------------------+----------------+');
    }
    
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Database setup completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to set up database:', err);
    process.exit(1);
  }); 