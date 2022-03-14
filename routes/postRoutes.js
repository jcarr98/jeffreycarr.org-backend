const { _infoTransformers } = require("passport/lib");

module.exports = (app, pool) => {
    async function transaction(recipe, category) {
        // Get connection from pool
        // Don't need to try/catch because client will just be undefined on failure
        const client = await pool.connect();

        try {
            console.log("Beginning transaction");
            await client.query('BEGIN');

            let categoryResult = await client.query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id", [category]);
            let categoryId;
            if(categoryResult.rows.length === 0) {
                let categoryIdQuery = await client.query("SELECT id FROM categories WHERE name=$1", [category]);
                categoryId = categoryIdQuery.rows[0].id;
            } else {
                categoryId = categoryResult.rows[0].id;
            }

            let recipeResult = await client.query("INSERT INTO recipes (name, details, category) VALUES ($1, $2, (SELECT id FROM categories WHERE name=$3)) RETURNING id", [recipe.name, recipe.details, category]);
            let recipeId = recipeResult.rows[0].id;

            // Insert ingredients and rIngredients
            for(let i = 0; i < recipe.ingredients.length; i++) {
                let ingredient = recipe.ingredients[i];
                // Insert into ingredients table
                let ingredientResult = await client.query("INSERT INTO ingredients (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id", [ingredient.name]);
                let ingredientId;
                if(ingredientResult.rows.length === 0) {
                    let ingredientIdQuery = await client.query("SELECT id FROM ingredients WHERE name=$1", [ingredient.name]);
                    ingredientId = ingredientIdQuery.rows[0].id;
                } else {
                    ingredientId = ingredientResult.rows[0].id;
                }
                // Insert into rIngredients table
                await client.query("INSERT INTO rIngredients (recipe, ingredient, style, amount, optional) VALUES ($1, $2, $3, $4, $5)", [recipeId, ingredientId, ingredient.style, ingredient.amount, ingredient.optional]);
            }

            for(let i = 0; i < recipe.directions.length; i++) {
                let direction = recipe.directions[i];
                await client.query("INSERT INTO directions (recipe, step, step_num, optional) VALUES ($1, $2, $3, $4)", [recipeId, direction.step, direction.step_num, direction.optional]);
            }

            console.log("Committing transaction");
            await client.query('COMMIT');
            console.log("Recipe saved to database");
        } catch(e) {
            await client.query('ROLLBACK');
            console.log("Error in transaction");
            console.log(e);
        } finally {
            client.release();
        }

        return 'Finished';
    }

    app.post('/api/createRecipe', async (req, res) => {
        console.log(`Received post request for ${req.body.name}`);

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

        let result = await transaction(req.body, category);
        console.log(result);
    });
}