const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.OAUTH_ID);

async function googleAuth(token) {
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.OAUTH_ID
        });
        
        payload = ticket.getPayload();
    } catch (e) {
        console.log("Log in error:");
        console.log(e);
        return null;
    }

    return payload;
}

module.exports = { googleAuth };