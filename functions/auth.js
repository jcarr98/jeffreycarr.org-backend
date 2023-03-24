const crypto = require('crypto');
const uuid = require('uuid');
const https = require('https');

function generateTokens() {
    console.log("[generateTokens] Generating tokens for client");
    let finalResult;
    try {
        // Generate UUID (for csrf)
        let csrf = uuid.v4();

        // Generate nonce
        let nonceArray = new Uint16Array(1);
        crypto.getRandomValues(nonceArray);
        let nonce = nonceArray[0];
        return { status: "success", CSRF: csrf, nonce: nonce };
    } catch(e) {
        return { status: "failure", e: e };
    }
}

async function sendTokenRequest(code) {
    console.log("[sendTokenRequest] Sending token request to Google");
    // Build token request
    let requestData = `code=${code}&client_id=${process.env.GOOGLE_CLIENT_ID}&client_secret=${process.env.GOOGLE_CLIENT_SECRET}&redirect_uri=${process.env.BASE_URL}/login.html&grant_type=authorization_code`;
    
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

module.exports = { generateTokens, sendTokenRequest, decodeJWT };