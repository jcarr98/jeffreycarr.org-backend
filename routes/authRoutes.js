const auth = require('../functions/auth');
const transactions = require('../functions/transactions');

module.exports = (app) => {
    // Check if user is authenticated
    app.get("/auth/check_authentication", (req, res) => {
        console.log('[/auth/check_authentication] Received authentication request');
        if(req.session.authenticated == true && req.session.user != undefined) {
            console.log("[/auth/check_authentication] Sending successful authentication");
            res.send({authenticated: true, user: req.session.user});
        } else {
            console.log("[/auth/check_authentication] Sending unsuccessful authentication");
            res.send({authenticated: false});
        }
    });

    // Destroy this session
    app.get("/auth/logout", (req, res) => {
        req.session.destroy();
        res.send( {status: "success"} );
    })

    // Route to get all recipes
    app.get("/auth/tokens", (req,res) => {
        console.log("[/auth/tokens] Generating new tokens...");
        // Generate tokens
        let tokens = auth.generateTokens();

        if(tokens['status'] == "failure") {
            console.error("Error")
            console.error(tokens['e']);
            res.send(tokens);
            return;
        }

        // Save CSRF to user session
        console.log(`Setting CSRF token: ${tokens['CSRF']}`);
        req.session.csrf = tokens['CSRF'];
        console.log(req.session.id);
        console.log(req.session.sid);
        console.log(req.session);
        console.log("[/auth/tokens] Saved auth tokens to session");

        // Return tokens to webapp
        res.send(tokens);
    });

    app.get('/auth/google/verify_login', async (req, res) => {
        console.log("[/auth/google/verify_login] Verifying user's login tokens");
        if(!req.session) res.send({ status: "failure", message: "No session!" });
        // Confirm CSRF token
        if(req.query.csrf != req.session.csrf) {
            console.error("[/auth/google/verify_login] Incorrect CSRF Token!");
            console.error(req.session);
            res.send({ status: "failure", message: `Incorrect CSRF token! ${req.query.csrf} != ${req.session.csrf}` });
            return;
        }

        // Send POST request to Google
        let result = await auth.sendTokenRequest(req.query.code);
        if(result['status'] == "failure") {
            console.error("[/auth/google/verify_login] Unsuccessful request to Google")
            console.error(result['data']);
            res.send({ status: "failure", message: "Unsuccessful request to Google" });
            return;
        }

        // Decode token data
        let tokenData = auth.decodeJWT(result['data']['id_token']);

        // Note this user is logged in
        req.session.authenticated = true;

        // Clean up user session
        delete req.session.csrf;

        // Get user
        let queryResult = await transactions.getUser(tokenData['email']);
        
        // If user exists, save their email
        let user_id, is_admin;
        if(queryResult['data']['rowCount'] > 0) {
            let user = queryResult['data']['rows'][0];
            console.log("User already exists. Updating last logged in.");
            // Note relevant info
            user_id = queryResult['data']['rows'][0]['user_id'];
            is_admin = queryResult['data']['rows'][0]['is_admin'];
            // Update login time
            await transactions.updateLogin(user['user_id']);
        } else {
            // User does not exist in database, let's create one
            let newUser = await transactions.createUser(tokenData['given_name'], tokenData['family_name'], tokenData['email']);
            // newUser returns status and (if successful) the new user's ID
            user_id = newUser['data'];
            // Because this is a new user, it is defaulted to false
            is_admin = false;
        }

        // Create user object to save all relevant info
        let user = {
            user_id: user_id,
            fname: tokenData['given_name'],
            lname: tokenData['family_name'],
            email: tokenData['email'],
            is_admin: is_admin
        };

        req.session.user = user;
        
        // Send successful login notification to client
        res.send({status: "success"});
    });
}
