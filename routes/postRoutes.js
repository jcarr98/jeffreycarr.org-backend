const { googleAuth } = require("../functions/auth");
const transactions = require("../functions/transactions");

async function confirmAuth(pool, token, method) {
    // Get all authed users for method
    const authQ = await pool.query(`SELECT email FROM users WHERE $1='1'`, [method]);
    const authedUsers = authQ.rows;

    // Check authenticity of token provided
    let payload, payloadEmail;
    try {
        payload = await googleAuth(token);
        payloadEmail = payload.email;
    } catch(e) {
        console.log("Error authenticating user");
        return false;
    }

    for(let i = 0; i < authedUsers.length; i++) {
        if(authedUsers[i].email === payloadEmail) {
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

        // Confirm user is authenticated
        let authed = confirmAuth(pool, token, "create_recipe");

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

        let result = await transactions.createRecipe(pool, recipe, category);
        
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
        let authed = confirmAuth(pool, token, "delete_recipe");

        if(authed) {
            console.log("User is authorized to delete");
        } else {
            console.log("User is not authorized to delete");
            return;
        }

        // Perform delete transaction
        let result = await transactions.deleteRecipe(pool, recipeId);

        result ? console.log("DELETE success") : console.log("DELETE failure");

        res.send(result);
    })
}