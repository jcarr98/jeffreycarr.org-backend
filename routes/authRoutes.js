const { googleAuth } = require("../functions/auth");

module.exports = (app, pool) => {
    app.get('/api/auth/validUser', async (req, res) => {
        // Pull authorized users
        let authedUsersQuery = await pool.query("SELECT email FROM users");
        let authedUsers;
        try {
            authedUsers = authedUsersQuery.rows;
        } catch(e) {
            console.log("Error with auth");
            res.send(false);
            return;
        }

        // Check token is valid
        // Check for tokenId
        let tokenId;
        try {
            tokenId = req.query.tokenId;
        } catch(e) {
            console.log("Error retrieving token");
            res.send(false);
            return;
        }

        let payload = await googleAuth(tokenId);

        if(payload === null) {
            res.send(false);
            return;
        }

        let authed = false;
        for(let i = 0; i < authedUsers.length; i++) {
            if(authedUsers[i].email === payload.email) {
                authed = true;
                break;
            }
        }

        if(authed) {
            console.log(`Admin ${payload.email} successfully logged in`);
        } else {
            console.log(`User ${payload.email} attempted to log in as admin and failed`);
        }

        res.send(authed);
    });
}