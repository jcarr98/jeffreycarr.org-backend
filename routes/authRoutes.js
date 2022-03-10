const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.OAUTH_ID);

const googleAuth = async (token) => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.OAUTH_ID
    });
    
    const payload = ticket.getPayload();

    return payload;
}

module.exports = (app) => {
    app.get('/api/auth/validUser', async (req, res) => {

        // Check token is valid
        let payload = await googleAuth(req.query.tokenId);

        if(payload.email === 'jeffrey.carr98@gmail.com') {
            console.log("Valid account");
            res.send(true);
        } else {
            console.log("Invalid account");
            console.log
            res.send(false);
        }
    });
}