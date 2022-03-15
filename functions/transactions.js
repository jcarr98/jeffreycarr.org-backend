async function createRecipe(pool, recipe, category) {
    // Get connection from pool
    // Don't need to try/catch because client will just be undefined on failure
    const client = await pool.connect();
    let result = false;

    try {
        console.log("Beginning CREATE transaction");
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

        console.log("Committing CREATE transaction");
        await client.query('COMMIT');
        console.log(`Recipe ${recipe.name} saved to database`);
        result = true;
    } catch(e) {
        await client.query('ROLLBACK');
        console.log("Error in CREATE transaction");
        console.log(e);
    } finally {
        client.release();
        return result;
    }
}

/* 
    Delete indicated recipe from DB. ORDER MATTERS because of foreign key constraints
    Delete directions -> rIngredients -> recipe -> category
    Do NOT delete ingredients as they could be used in other recipes
*/
async function deleteRecipe(pool, id) {
    let result;
    // Get connection
    const client = await pool.connect();

    try {
        console.log("Beginning DELETE transaction");
        client.query("BEGIN");
        
        // Delete directions
        let directionsResult = await client.query("DELETE FROM directions WHERE recipe=$1", [id]);

        // Delete rIngredients
        let rIngredientsResult = await client.query("DELETE FROM rIngredients WHERE recipe=$1", [id]);

        // Get category ID
        let categoryIdQ = await client.query("SELECT category FROM recipes WHERE id=$1", [id]);
        let categoryId = categoryIdQ.rows[0].category;

        // Delete recipe
        let recipesResults = await client.query("DELETE FROM recipes WHERE id=$1", [id]);

        // Check if category is used anywhere else
        let categoryDeleted = false;
        let cQueryResult = await client.query("SELECT * FROM recipes WHERE category=$1", [categoryId]);
        if(cQueryResult.rows.length === 0) {
            let categoryResult = await client.query("DELETE FROM categories WHERE id=$1", [categoryId]);
            categoryDeleted = true;

        }

        // Commit
        console.log("Committing DELETE transaction");
        await client.query("COMMIT");
        result = {
            status: 1,
            message: "Recipe successfully deleted",
            categoryDeleted: categoryDeleted
        };
    } catch(e) {
        console.log("Error in DELETE transaction");

        // Roll back transaction
        await client.query("ROLLBACK");
        console.log(e);
        result = {
            status: -1,
            message: "Failed to delete",
            categoryDeleted: null
        }
    } finally {
        client.release();
        return result;
    }
}

module.exports = { createRecipe, deleteRecipe };