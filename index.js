// Imports
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Set up app
const app = express();
app.use(express.json());

// Set up CORS
let corsOptions = {
    origin: process.env.CORS_ORIGIN
}
app.use(cors(corsOptions));

// Set up server
const PORT = process.env.PORT || 5001;

// Connect to DB
const connectionString = process.env.DB_URL;
const pool = new Pool({connectionString});

require('./routes/getRoutes')(app, pool);
require('./routes/postRoutes')(app, pool);
require('./routes/authRoutes')(app);

app.listen(PORT, () => {
    console.log("Listening on port: ", PORT);
});