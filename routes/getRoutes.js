module.exports = (app, pool) => {
    // Perform general GET query
    function performQuery(query, queryValues, res) {
        pool.query(query, queryValues, (err, result) => {
            if(err) {
                console.log(err);
            }

            res.send(result.rows);
        });
    }

    // Route to get all recipes
    app.get("/api/get", (req,res) => {
        performQuery("SELECT * FROM recipes ORDER BY name", [], res);
    });

    // Route to get one recipe
    app.get("/api/get/:id", (req,res) => {
        const id = req.params.id;
        performQuery("SELECT * FROM recipes WHERE id=$1", [id], res);
    });

    // Get all categories
    app.get("/api/getCategories", (req, res) => {
        performQuery("SELECT * FROM categories ORDER BY name", [], res);
    })

    // Route to get directions for a recipe
    app.get("/api/getDirections/:id", (req, res) => {
        const id = req.params.id;
        performQuery("SELECT * FROM directions WHERE recipe=$1 ORDER BY step_num", [id], res);
    });

    // Route to get all ingredients
    app.get("/api/getIngredients", (req, res) => {
        performQuery("SELECT name FROM ingredients ORDER BY name", [], res);
    })

    // Route to get ingredients for a recipe
    app.get("/api/getIngredients/:id", (req, res) => {
        const id = req.params.id;
        performQuery("SELECT * FROM ingredients, rIngredients WHERE rIngredients.recipe=$1 AND rIngredients.ingredient=ingredients.id ORDER BY name", [id], res);
    });
}