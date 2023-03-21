const get = require('../functions/get');

module.exports = (app, pool) => {
    app.get("/api/get/categories", async (req, res) => {
        console.log("[/api/get/categories] Received request for categories");
        let categories = await get.getCategories(pool);

        if(categories['status'] == "success") {
            console.log("[/api/get/categories] Sending categories to client");
            res.send({status: "success", data: categories['data']});
        } else {
            console.error("[/api/get/categories] Failed to retrieve categories");
            res.send({status: "failure"});
        }
    });

    app.get("/api/get/favorites", async (req, res) => {
        console.log("[/api/get/favorites] Getting favorites from DB");

        // Check if this user is authenticated
        if(!req.session.authenticated) {
            console.error("[/api/get/favorites] Failure. User is not authenticated");
            res.send({status: "failure"});
            return;
        }

        // Retrieve user favorites
        let favorites = await get.getFavorites(pool, req.session.user['user_id']);
        res.send(favorites);
    })

    app.get("/api/get/recipes", async (req, res) => {
        // Collect parameters
        let page = parseInt(req.query.page, 10);
        let limit = parseInt(req.query.limit, 10);

        console.log(`[/api/get/recipes] Received request for ${limit} recipes`);

        // Confirm valid parameters
        if(isNaN(page) || isNaN(limit)) {
            console.error("Invalid parameters provided to get/recipes");
            res.send({status: "failure"});
            return;
        }

        // Calculate offset
        let offset = (page-1) * limit;

        // Perform query
        let results = await get.getRecipes(pool, offset, limit);

        if(results['status'] == "success") {
            console.log("[/api/get/recipes] Sending recipes to client");
            res.send({status: "success", numRecipes: results['numRecipes'], data: results['data']});
        } else {
            console.log("[/api/get/recipes] Failed to retrieve recipes");
            res.send({status: "failure"});
        }
    });

    app.get("/api/get/random", async (req, res) => {
        console.log("[/api/get/random] Received request for random recipe");

        let randomRecipe = await get.getRandomRecipe(pool);

        if(randomRecipe['status'] == "success") {
            console.log(`[/api/get/random] Got ${randomRecipe['data']['recipe_name']}. Sending to client`);
        } else {
            console.error("[/api/get/random] Failed to retrieve random recipe");
        }

        res.send(randomRecipe);
    });

    app.get("/api/get/search", async (req, res) => {
        // Confirm search
        if(req.query.search == undefined) {
            console.error("Received malformed search request. Reporting failure");
            res.send({ status: "failure" });
            return;
        }

        console.log(`Received search request for ${req.query.search}`);

        // Search DB
        let results = await get.searchDB(pool, req.query.search);

        results['status'] == "success" ? console.log("Retrieved search results from database") : console.error("Failed to retrieve search results from server.");

        res.send(results);
    });
}