const express = require('express');
const mysql = require('mysql2/promise'); // Using mysql2/promise for async/await
const cors = require('cors');

// Load environment variables from .env file
require('dotenv').config(); // <--- ADD THIS LINE AT THE VERY TOP

const app = express();
const port = 5000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // To parse JSON request bodies

// MySQL Connection Pool Configuration - USING ENVIRONMENT VARIABLES
const pool = mysql.createPool({
    host: process.env.DB_HOST,      // Loaded from .env
    user: process.env.DB_USER,      // Loaded from .env
    password: process.env.DB_PASSWORD, // Loaded from .env
    database: process.env.DB_NAME, // Loaded from .env
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test MySQL connection
pool.getConnection()
    .then(connection => {
        console.log('Successfully connected to MySQL database!');
        connection.release(); // Release the connection back to the pool
    })
    .catch(err => {
        console.error('Error connecting to MySQL database:', err);
        console.error('Please ensure your .env file is correctly configured with DB_HOST, DB_USER, DB_PASSWORD, DB_DATABASE.');
        process.exit(1); // Exit the application if database connection fails
    });

// API Routes

// GET all schedules
app.get('/api/schedules', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM SMP_USER_MASTER_SCHEDULES');
        res.json(rows);
    } catch (err) {
        console.error('Error fetching schedules:', err);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// ADD a new schedule
app.post('/api/schedules', async (req, res) => {
    const { SCHEDULER_TYPE, SCHEDULER_DETAILS, NUMBER_OF_DAYS, STATUS, VENDOR_ID } = req.body;

    // --- CRITICAL DEBUGGING LOG ---
    // This will show exactly what data the backend received from the frontend
    console.log("Received data from frontend for insert:", {
        SCHEDULER_TYPE,
        SCHEDULER_DETAILS,
        NUMBER_OF_DAYS,
        STATUS,
        VENDOR_ID // Check this value when the error occurs
    });
    // --- END DEBUGGING LOG ---

    try {
    const [result] = await pool.execute(
    `INSERT INTO SMP_USER_MASTER_SCHEDULES (SCHEDULER_TYPE, SCHEDULER_DETAILS, NUMBER_OF_DAYS, STATUS, VENDOR_ID, INSERT_ID)
     VALUES (?, ?, ?, ?, ?, ?)`, // <-- ADDED INSERT_ID and an extra '?'
    [SCHEDULER_TYPE, SCHEDULER_DETAILS, NUMBER_OF_DAYS || null, STATUS || null, VENDOR_ID, 1] // <-- ADDED the value '1' for INSERT_ID
);
        res.status(201).json({ message: 'Schedule added successfully!', id: result.insertId });
    } catch (err) {
        console.error('Error adding schedule:', err);
        res.status(500).json({ error: 'Error adding schedule: ' + err.message });
    }
});

// UPDATE a schedule
app.put('/api/schedules/:id', async (req, res) => {
     const { id } = req.params;
     // ONLY extract NUMBER_OF_DAYS as it's the only field sent from the frontend for update
     const { NUMBER_OF_DAYS } = req.body;

     // --- Existing Server-Side Validation for NUMBER_OF_DAYS ---
     // Ensure NUMBER_OF_DAYS is not undefined/null and is less than 7
     if (NUMBER_OF_DAYS === undefined || NUMBER_OF_DAYS === null || isNaN(NUMBER_OF_DAYS) || NUMBER_OF_DAYS >= 7) {
         return res.status(400).json({ error: 'Number of Days must be a valid number and less than 7.' });
     }
     // --- End Validation ---

     // Log the received data for update
     console.log(`Received data for update (ID: ${id}):`, { NUMBER_OF_DAYS }); // Log only what's received

     try {
         const [result] = await pool.execute(
             // ONLY UPDATE THE NUMBER_OF_DAYS COLUMN
             `UPDATE SMP_USER_MASTER_SCHEDULES
              SET NUMBER_OF_DAYS = ?
              WHERE USER_SCHD_ID = ?`,
             [NUMBER_OF_DAYS, id] // Only pass NUMBER_OF_DAYS and the ID
         );

         if (result.affectedRows === 0) {
             return res.status(404).json({ error: 'Schedule not found' });
         }
         res.json({ message: 'Schedule updated successfully!' });
     } catch (err) {
         console.error('Error updating schedule:', err);
         // Provide a more specific error message from the database if available
         res.status(500).json({ error: 'Error updating schedule: ' + err.message || 'Unknown database error' });
     }
 });

// DELETE a schedule
app.delete('/api/schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await pool.execute('DELETE FROM SMP_USER_MASTER_SCHEDULES WHERE USER_SCHD_ID = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Schedule not found' });
        }
        res.json({ message: 'Schedule deleted successfully!' });
    } catch (err) {
        console.error('Error deleting schedule:', err);
        res.status(500).json({ error: 'Error deleting schedule: ' + err.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Backend server running on http://localhost:${port}`);
    // Log both host and database name for clarity
    console.log(`Ensure your MySQL database (${process.env.DB_NAME}) is accessible from this machine at ${process.env.DB_HOST}`);
});