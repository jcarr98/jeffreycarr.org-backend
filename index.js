// Imports
const express = require('express');
const cors = require('cors');
const mysql = require('mysql');

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

let pool = mysql.createPool(process.env.DB_URL);

require('./routes/getRoutes')(app, pool);
require('./routes/postRoutes')(app, pool);
require('./routes/authRoutes')(app);

app.listen(PORT, () => {
    console.log("Listening on port: ", PORT);
});