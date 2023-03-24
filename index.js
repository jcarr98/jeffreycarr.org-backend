// Imports
const https = require('https'); // DEV ONLY
const fs = require('fs'); // DEV ONLY
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

// Load local environment variables
if(process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

// Set up app
const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Set up sessions
app.use(session({
    name: "recipebook-session",
    secret: process.env.SESSION_SECRET,
    cookie: {
        maxAge: 86400000, // 1 day
        secure: true,
        sameSite: 'none'
    },
    saveUninitialized: false,
    resave: false
}));

// Set up CORS
let corsOptions = {
    origin: process.env.BASE_URL,
    credentials: true
}
app.use(cors(corsOptions));

// Connect to DB
const connectionString = process.env.DB_URL;
const pool = new Pool({connectionString});

// Import routes
require('./routes/getRoutes')(app);
require('./routes/postRoutes')(app, pool);
require('./routes/authRoutes')(app, pool);

// Set up server
const PORT = process.env.PORT || 5001;
if(process.env.NODE_ENV !== 'production') {
    // DEV ONLY
    const httpsOptions = {
        key: fs.readFileSync('certs/localhost+1-key.pem'),
        cert: fs.readFileSync('certs/localhost+1.pem')
    };

    https.createServer(httpsOptions, app).listen(PORT, console.log(`Secure server running on port ${PORT}`));
} else {
    app.listen(PORT, () => {
        console.log("Listening on port: ", PORT);
    });
}