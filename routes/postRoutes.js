const { auth } = require("google-auth-library");
const { googleAuth } = require("../functions/auth");
const transactions = require("../functions/transactions");

async function confirmAuth(pool, email) {
    // Get all authed users for method
    const authQ = await pool.query(`SELECT email FROM users WHERE admin='t'`);
    const authedUsers = authQ.rows;

    for(let i = 0; i < authedUsers.length; i++) {
        if(authedUsers[i].email === email) {
            return true;
        }
    }

    return false;
}

module.exports = (app, pool) => {
    app.post('/api/createRecipe', async (req, res) => {
        console.log(`Received CREATE request`);

        // Confirm all data is passed
        let recipe, token;
        try {
            recipe = req.body.data.recipe;
            token = req.body.data.token;
        } catch(e) {
            console.log("Error retrieving data");
            console.log(e);
            return;
        }

        // Get payload from Google
        let payload, authed;
        try {
            payload = await googleAuth(token);
            authed = await confirmAuth(pool, payload.email);
        } catch(e) {
            console.log('Error confirming auth token');
            console.log(e);
            return;
        }

        if(!authed) {
            console.log("User not authorized to create recipes");
            return;
        }

        // Configure category
        let category;
        if(recipe.category === '0') {
            // Validate custom name
            let nospaces = recipe.categoryName.replace(" ", "");
            if(!/^[a-z]+$/i.test(nospaces)) {
                console.log("Invalid category name");
                res.send({
                    status: -1,
                    message: "Category can only contain letters"
                });
                return;
            } else {
                category = recipe.categoryName;
            }
        } else {
            category = recipe.category;
        }

        let result = await transactions.createRecipe(pool, recipe, category, payload.email);
        
        result ? console.log("CREATE success") : console.log("CREATE failures");

        if(result) {
            res.send({
                status: 1,
                message: "Recipe added successfully!"
            });
        } else {
            res.send({
                status: -1,
                message: "Saving recipe failed"
            });
        }
    });

    app.post('/api/deleteRecipe', async (req, res) => {
        console.log("Received DELETE request");
        // Get required data
        let recipeId, token;
        try {
            recipeId = req.body.data.recipeId;
            token = req.body.data.token;
        } catch (e) {
            console.log("Error retrieving data");
            console.log(e);
            return;
        }

        // Confirm user is authorized
        let payload, authed;
        try {
            payload = await googleAuth(token);
            authed = await confirmAuth(pool, payload.email);
        } catch(e) {
            console.log('Error confirming auth token');
            console.log(e);
            return;
        }

        if(!authed) {
            console.log("User not authorized to delete recipes");
            return;
        }

        // Perform delete transaction
        let result = await transactions.deleteRecipe(pool, recipeId);

        result ? console.log("DELETE success") : console.log("DELETE failure");

        res.send(result);
    })
}