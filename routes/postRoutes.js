const transactions = require("../functions/transactions");
const post = require('../functions/post');
const { userAuthenticated } = require('../functions/auth');
const { checkRecipeExists } = require('../functions/get');
const { getPool } = require('../functions/getConnection');

async function confirmAuth(email) {
    // Get pool
    const pool = getPool();

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

module.exports = (app) => {
    app.post('/api/post/create', async (req, res) => {
        console.log("[/api/post/create] Received request");

        // Check user is authenticated
        if(!userAuthenticated(req.session)) {
            console.error("[/api/create] User not authenticated");
            res.send({status: "failure", code: 401 });
            return;
        }

        let recipe = req.body.recipe;

        if(recipe == undefined) {
            console.error("[/api/create] No recipe provided");
            res.send({ status: "failure", code: 400 });
            return;
        }
        else if(recipe['recipe_name'] == undefined) {
            console.error("[/api/create] Recipe must have title");
            res.send({ status: "failure", code: 400 });
            return;
        }
        else if(recipe['ingredients'] == undefined || recipe['ingredients'].length == 0) {
            console.error("[/api/create] Recipe must have at least one ingredient");
            res.send({ status: "failure", code: 400 });
            return;
        }
        else if(recipe['directions'] == undefined || recipe['directions'].length == 0) {
            console.error("[/api/create] Recipe must have at least one step");
            res.send({ status: "failure", code: 400 });
            return;
        }
        else if(await checkRecipeExists(recipe.title)) {
            console.error(`[/api/create] A recipe with the title ${req.body.recipe['title']} already exists!`);
            res.send({ status: "failure", code: 400, message: "Recipe with that title already exists" });
            return;
        } else {
            // Since description is not required, make sure we have something for it
            if(recipe['details'] == undefined) recipe['details'] = "";
            // Update author
            recipe['author'] = req.session.user['user_id'];
        }

        // Send recipe to DB
        let result = await transactions.createRecipe(recipe);

        res.send(result);
    });

    app.post('/api/post/delete', async (req, res) => {
        // Confirm user is authenticated
        if(!userAuthenticated(req.session)) {
            console.error("[/api/post/delete] User not authenticated");
            res.send({ status: "failure", code: 401 });
            return;
        }

        // Perform post to database
        let result = await post.deleteRecipe(req.body.recipe, req.session.user.user_id);

        res.send(result);
    });

    app.post('/api/post/update', async (req, res) => {
        // Confirm user is authorized
        if(!userAuthenticated(req.session)) {
            console.error("[/api/post/update] User not authenticated");
            res.send({ status: "failure", code: 401 });
            return;
        }

        // Perform update to database
        let user_id = req.session.user.user_id;
        console.log(user_id);
        let result = await post.updateRecipe(req.body.recipe, user_id);

        res.send(result);
    })

    app.post('/api/post/favorite_item', async (req, res) => {
        console.log("[/api/favorite_item] Favoriting item");

        // Check user is authenticated
        if(!req.session.authenticated) {
            console.error("[/api/favorite_item] User not authenticated");
            res.send({status: 'failure'});
            return;
        }
        // Confirm we have user info saved
        if(req.session.user['user_id'] == undefined || req.session.user['user_id'] == null) {
            console.error("[/api/favorite_item] No user data");
            res.send({status: 'failure'});
            return;
        }

        // Get recipe id
        let recipeId = req.body['id'];

        // Send request to DB
        let result = await post.addFavorite(recipeId, req.session.user['user_id']);

        // Send result to client
        console.log("[/api/favorite_item] Sending results to client");
        res.send(result);
    });

    app.post("/api/post/unfavorite_item", async (req, res) => {
        console.log("[/api/unfavorite_item] Removing item from favorites");

        // Check user is authenticated
        if(!userAuthenticated(req.session)) {
            console.error("[/api/unfavorite_item] User is not authenticated");
            res.send({ status: "failure", code: 401 });
            return;
        }

        // Get recipe id
        let recipeId = req.body['id'];

        // Confirm we have an ID
        if(recipeId == undefined || recipeId == null) {
            console.error("[/api/unfavorite_item] Malformed request");
            res.send({ status: "failure" });
        }

        // Send request to DB
        let result = await post.removeFavorite(req.body['id'], req.session.user['user_id']);

        // Return result to client
        res.send(result);
    });
}