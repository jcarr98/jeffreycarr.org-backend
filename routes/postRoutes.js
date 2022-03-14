const { googleAuth } = require("../functions/auth");
const transactions = require("../functions/transactions");

module.exports = (app, pool) => {
    app.post('/api/createRecipe', async (req, res) => {
        console.log(`Received CREATE request for ${req.body.name}`);

        // Configure category
        let category;
        if(req.body.category === '0') {
            // Validate custom name
            let nospaces = req.body.categoryName.replace(" ", "");
            if(!/^[a-z]+$/i.test(nospaces)) {
                console.log("Invalid category name");
                res.send({
                    status: -1,
                    message: "Category can only contain letters"
                });
                return;
            } else {
                category = req.body.categoryName;
            }
        } else {
            category = req.body.category;
        }

        let result = await transactions.createRecipe(pool, req.body, category);
        
        result ? console.log("CREATE success") : console.log("CREATE failures");

        res.send(result);
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
        let authUserRequest = await pool.query("SELECT email FROM users WHERE delete_recipe='t'");
        let authedUsers = authUserRequest.rows;
        console.log(`Authed users:`);
        console.log(authUserRequest.rows);
        let payload = await googleAuth(token);

        let authed = false;
        for(let i = 0; i < authedUsers.length; i++) {
            if(authedUsers[i].email === payload.email) {
                authed = true;
                break;
            }
        }

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