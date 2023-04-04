const get = require('../functions/get');

module.exports = (app) => {
    app.get("/api/get/categories", async (req, res) => {
        console.log("[/api/get/categories] Received request for categories");
        let categories = await get.getCategories();

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
        let favorites = await get.getFavorites(req.session.user['user_id']);
        res.send(favorites);
    })

    app.get("/api/get/recipes", async (req, res) => {
        // Collect parameters
        let page = parseInt(req.query.page, 10);
        let limit = parseInt(req.query.limit, 10);
        let author = req.query.author;

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
        let results;
        if(author != undefined) {
            results = await get.getRecipes(offset, limit, author);
        } else {
            results = await get.getRecipes(offset, limit);
        }

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

        let randomRecipe = await get.getRandomRecipe();

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
            console.error("[/api/get/search] Received malformed search request. Reporting failure");
            res.send({ status: "failure" });
            return;
        }

        console.log(`Received search request for ${req.query.search}`);

        // Search DB
        let results = await get.searchDB(req.query.search);

        results['status'] == "success" ? console.log("Retrieved search results from database") : console.error("Failed to retrieve search results from server.");

        res.send(results);
    });

    app.get("/api/get/recipe_info", async (req, res) => {
        console.log("[/api/get/recipe_info] Getting recipe info...");
        // Confirm search
        if(req.query.recipeId == undefined) {
            console.error("[/api/get/recipe] Received malformed recipe request. Reporting failure");
            res.send({ status: "failure", code: 400 });
            return;
        }

        // Get recipe info from database
        let recipeInfo = await get.getRecipeInfo(req.query.recipeId);
        console.log(`[/api/get/recipe_info] [${recipeInfo['status']}] retrieving recipe info`);
        res.send(recipeInfo);
    });

    app.get("/api/get/recipe_ingredients", async (req, res) => {
        console.log("[/api/get/recipe_info] Getting recipe ingredients...");
        // Confirm search
        if(req.query.recipeId == undefined) {
            console.error("[/api/get/recipe] Received malformed recipe request");
            res.send({ status: "failure", code: 400 });
            return;
        }

        // Get recipe ingredients from database
        let recipeIngredients = await get.getRecipeIngredients(req.query.recipeId);
        console.log(`[/api/get/recipe_ingredients] [${recipeIngredients['status']}] retrieving recipe ingredients`);

        res.send(recipeIngredients);
    });

    app.get("/api/get/recipe_directions", async (req, res) => {
        console.log("[/api/get/recipe_info] Getting recipe directions...");
        // Confirm search
        if(req.query.recipeId == undefined) {
            console.error("[/api/get/recipe_directions] Received malformed recipe request");
            res.send({ status: "failure", code: 400 });
            return;
        }

        let recipeDirections = await get.getRecipeDirections(req.query.recipeId);
        console.log(`[/api/get/recipe_directions] [${recipeDirections['status']}] retrieving recipe directions`);

        res.send(recipeDirections);
    })
}