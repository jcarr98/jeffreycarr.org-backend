const crypto = require('crypto');
const uuid = require('uuid');
const https = require('https');

function generateTokens() {
    console.log("[generateTokens] Generating tokens for client");
    let max = 1000000;
    let csrf, csrfFailure = false;
    try {
        // Generate UUID (for csrf)
        csrf = uuid.v4();
    } catch(e) {
        csrf = Math.random() * max;
        csrfFailure = true;
    }
    let nonce, nonceFailure = false;
    try {
        // Generate nonce
        let nonceArray = new Uint16Array(1);
        crypto.getRandomValues(nonceArray);
        nonce = nonceArray[0];
    } catch(e) {
        let nonce = Math.random() * max;
        nonceFailure = true
    }
    
    return { status: "success", CSRF: csrf, nonce: nonce, csrfFailure: csrfFailure, nonceFailure: nonceFailure };
}

async function sendTokenRequest(code) {
    console.log("[sendTokenRequest] Sending token request to Google");
    // Build token request
    let requestData = `code=${code}&client_id=${process.env.GOOGLE_CLIENT_ID}&client_secret=${process.env.GOOGLE_CLIENT_SECRET}&redirect_uri=${process.env.BASE_URL}/login&grant_type=authorization_code`;
    
    // Create HTTPS options
    let options = {
        hostname: 'oauth2.googleapis.com',
        path: '/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    // Send HTTP request
    let answer = await doRequest(options, requestData);

    return answer;
}

function doRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {

            if(res.statusCode != 200) {
                reject({status: 'failure', data: 'Bad status code'});
            }

            let responseData = [];

            res.on('data', (d) => {
                responseData.push(d);
            });
            res.on('end', () => {
                let allData = JSON.parse(Buffer.concat(responseData).toString('utf-8'));
                resolve({status: 'success', data: allData});
            });
        });

        req.on('error', (e) => {
            reject(e)
        });
    
        req.write(data);
        req.end();
    })
}

function decodeJWT(jwt) {
    console.log("Decoding JWT");
    // JWT should be separated into header, payload, and signature split by '.'
    // We really only need the payload
    let encodedPayload = jwt.split(".")[1];

    // Decode JWT
    let payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8'));

    // Return the payload
    return payload;
}

function userAuthenticated(session) {
    console.log("[userAuthenticated] Checking user authentication...");
    if(session.user == undefined || session.user.user_id == undefined || session.user.user_id == null) {
        console.log("[userAuthenticated] No user data saved");
        return false;
    } 
    else if(!session.authenticated) {
        console.log("[userAuthenticated] User not authenticated");
        return false;
    }
    else {
        console.log("[userAuthenticated] User successfully authenticated");
        return true;
    }
}

module.exports = {  userAuthenticated, generateTokens, sendTokenRequest, decodeJWT };
