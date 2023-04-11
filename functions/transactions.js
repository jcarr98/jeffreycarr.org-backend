const { getPool } = require('./getConnection');

async function cleanCategories(cat_id) {
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[cleanCategories] Error cleaning ${cat_id}: could not connect to DB`);
        return;
    }

    try {
        // Check if this category is used in any recipes
        let categoryQuery = await client.query("SELECT category FROM recipes WHERE category=$1", [cat_id]);
        
        if(categoryQuery['rowCount'] == 0) {
            await client.query("DELETE FROM categories WHERE cat_id=$1", [cat_id]);
        }
    } catch (e) {
        console.error(`[cleanCategories] Error cleaning ${cat_id}: ${e}`);
    } finally {
        client.release();
    }
}

async function cleanIngredients(ingredients) {
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[cleanCategories] Error cleaning ${cat_id}: could not connect to DB`);
        return;
    }

    try {
        for(let i=0; i < ingredients.length; i++) {
            let ingredientQuery = await client.query("SELECT ing_id FROM recipe_ingredients WHERE ing_id=$1", [ingredients[i]]);
            if(ingredientQuery['rowCount'] == 0) {
                client.query("DELETE FROM ingredients WHERE ing_id=$1", [ingredients[i]]);
            }
        }
    } catch (e) {
        console.error("Error cleaning ingredients");
        console.error(e);
    } finally {
        client.release();
    }
}

async function createRecipe(recipe) {
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[createRecipe] Error creating recipe: could not connect to DB`);
        return;
    }

    // Start transaction
    let result;
    try {
        console.log("Beginning INSERT transaction into table 'recipes'");
        await client.query("BEGIN");

        // Insert category
        // Category name must be unique, ignore on conflict
        let categoryResult = await client.query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING cat_id", [recipe['category']]);
        // Get category ID from the transaction
        let categoryId;
        if(categoryResult.rows.length == 0) {
            let categoryIdQuery = await client.query("SELECT cat_id FROM categories WHERE name=$1", [recipe['category']]);
            categoryId = categoryIdQuery['rows'][0]['cat_id'];
        } else {
            categoryId = categoryResult['rows'][0]['cat_id'];
        }

        // Insert recipe
        // Category name must be unique. Throw error on conflict (this should be checked before transaction)
        let recipeResult = await client.query("INSERT INTO recipes (recipe_name, details, category, author) VALUES ($1, $2, $3, $4) RETURNING rec_id", [recipe['recipe_name'], recipe['details'], categoryId, recipe['author']]);
        // Get recipe ID from transaction
        const recipeId = recipeResult['rows'][0]['rec_id'];

        // Insert ingredients and recipe_ingredients
        for(let i=0; i < recipe['ingredients'].length; i++) {
            let ingredient = recipe['ingredients'][i];
            // Insert into ingredients table
            let ingredientsResult = await client.query("INSERT INTO ingredients (ingredient_name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING ing_id", [ingredient['name']]);
            // Get ingredient ID
            let ingredientId;
            if(ingredientsResult.rows.length == 0) {
                let ingredientIdQuery = await client.query("SELECT ing_id FROM ingredients WHERE ingredient_name=$1", [ingredient['name']]);
                ingredientId = ingredientIdQuery['rows'][0]['ing_id'];
            } else {
                ingredientId = ingredientsResult['rows'][0]['ing_id'];
            }

            // Insert into recipe_ingredients
            let rIngredientsResult = await client.query("INSERT INTO recipe_ingredients (rec_id, ing_id, prep, amount, optional) VALUES ($1, $2, $3, $4, $5)", [recipeId, ingredientId, ingredient['prep'], ingredient['amount'], ingredient['optional']]);
        }

        // Insert directions
        for(let i=0; i < recipe['directions'].length; i++) {
            let direction = recipe['directions'][i];
            await client.query("INSERT INTO directions (rec_id, step, step_num) VALUES ($1, $2, $3)", [recipeId, direction['step'], direction['step_num']]);
        }

        // Commit changes to database
        console.log("Commiting transaction...");
        await client.query("COMMIT");
        console.log("Transaction committed!");
        result = true;
    } catch(e) {
        console.error(e);
        console.error("Error creating recipe, rolling back");
        await client.query("ROLLBACK");
        result = false;
    } finally {
        client.release();
        return (result ? { status: "success" } : { status: "failure"} );
    }
}

/* 
    Delete indicated recipe from DB. ORDER MATTERS because of foreign key constraints
    Delete directions -> rIngredients -> recipe -> category
    Do NOT delete ingredients as they could be used in other recipes
*/
async function deleteRecipe(id) {
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[deleteRecipe] Error deleting recipe: could not connect to DB`);
        return;
    }

    let result;
    try {
        console.log("Beginning DELETE transaction");
        client.query("BEGIN");

        // Delete recipe ingredients
        await client.query("DELETE FROM recipe_ingredients WHERE rec_id=$1", [id]);

        // Delete directions
        await client.query("DELETE FROM directions WHERE rec_id=$1", [id]);

        // Delete recipe
        let recipeDeleteResult = await client.query("DELETE FROM recipes WHERE rec_id=$1 RETURNING category", [id]);
        let categoryId = recipeDeleteResult['rows'][0]['category'];

        // Check if category is used anywhere else
        let categoryDeleted = false;
        let cQueryResult = await client.query("SELECT * FROM recipes WHERE category=$1", [categoryId]);
        if(cQueryResult.rows.length == 0) {
            await client.query("DELETE FROM categories WHERE cat_id=$1", [categoryId]);
            categoryDeleted = true;
        }

        // Commit
        console.log("Committing DELETE transaction");
        await client.query("COMMIT");
        result = {
            status: "success",
            code: 200,
            categoryDeleted: categoryDeleted
        };
    } catch(e) {
        console.log("Error in DELETE transaction");

        // Roll back transaction
        await client.query("ROLLBACK");
        console.log(e);
        result = {
            status: "failure",
            code: 500
        }
    } finally {
        client.release();
        return result;
    }
}

/* 
    Instead of pulling, comparing, and updating each individual ingredient & direction, delete the ones for this recipe and reinsert them
    Update recipe info
*/
async function updateRecipe(recipe) {
    // Connect to DB
    console.log("[transactions/updateRecipe] Connecting to database...");
    let client;
     try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error("[updateRecipe] Error connecting to database");
        return { status: "failure", code: 500 };
    }

    console.log("[transactions/updateRecipe] Connected to database!");

    let result;
    try {
        // Start transaction
        console.log("Beginning update transaction...")
        client.query("BEGIN");

        // Insert category
        // Category name must be unique, ignore on conflict
        let categoryResult = await client.query("INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING cat_id", [recipe['category']]);
        // Get category ID from the transaction
        let newCategoryId;
        if(categoryResult.rows.length == 0) {
            let categoryIdQuery = await client.query("SELECT cat_id FROM categories WHERE name=$1", [recipe['category']]);
            newCategoryId = categoryIdQuery['rows'][0]['cat_id'];
        } else {
            newCategoryId = categoryResult['rows'][0]['cat_id'];
        }

        // Get all current recipe ingredients
        let ingredients = [];
        let recipeIngredientsResult = await client.query("SELECT ing_id FROM recipe_ingredients WHERE rec_id=$1", [recipe['rec_id']]);
        for(let i=0; i < recipeIngredientsResult['rows'].length; i++) {
            ingredients.push(recipeIngredientsResult['rows'][i]['ing_id']);
        }
        // Delete current recipe ingredients
        await client.query("DELETE FROM recipe_ingredients WHERE rec_id=$1", [recipe['rec_id']]);
        // Insert all ingredients
        for(let i=0; i < recipe['ingredients'].length; i++) {
            let ingredient = recipe['ingredients'][i];
            // Insert into ingredients table
            let ingredientsResult = await client.query("INSERT INTO ingredients (ingredient_name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING ing_id", [ingredient['name']]);
            // Get ingredient ID
            let ingredientId;
            if(ingredientsResult['rowCount'] == 0) {
                let ingredientIdQuery = await client.query("SELECT ing_id FROM ingredients WHERE ingredient_name=$1", [ingredient['name']]);
                ingredientId = ingredientIdQuery['rows'][0]['ing_id'];
            } else {
                ingredientId = ingredientsResult['rows'][0]['ing_id'];
            }

            // Save ingredient ID for cleanup later
            ingredients.push(ingredientId);

            // Insert into recipe_ingredients
            await client.query("INSERT INTO recipe_ingredients (rec_id, ing_id, prep, amount, optional) VALUES ($1, $2, $3, $4, $5)", [recipe['rec_id'], ingredientId, ingredient['prep'], ingredient['amount'], ingredient['optional']]);
        }

        // Delete current recipe directions
        await client.query("DELETE FROM directions WHERE rec_id=$1", [recipe['rec_id']]);
        // Insert all directions
        for(let i=0; i < recipe['directions'].length; i++) {
            let direction = recipe['directions'][i];
            await client.query("INSERT INTO directions (rec_id, step, step_num) VALUES ($1, $2, $3)", [recipe['rec_id'], direction['step'], direction['step_num']]);
        }

        // Get old category id
        let categoryQuery = await client.query("SELECT category FROM recipes WHERE rec_id=$1", [recipe['rec_id']]);
        let oldCategoryId = categoryQuery['rows'][0]['category'];

        // Update recipe
        await client.query("UPDATE recipes SET recipe_name=$1,details=$2,category=$3 WHERE rec_id=$4", [recipe['recipe_name'], recipe['details'], newCategoryId, recipe['rec_id']]);

        client.query("COMMIT");
        console.log("[transactions/updateRecipe] Transaction committed!");

        // Clean up categories and ingredients
        cleanCategories(oldCategoryId);
        cleanIngredients(ingredients);

        // Set result
        result = { status: "success" };
    } catch (e) {
        console.error("Error in update transaction");
        result = { status: "failure", code: 500 };
    } finally {
        client.release();
        return result;
    }
}

/*
    Gets user by email address
*/
async function getUser(email) {
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[getUser] Error getting user: could not connect to DB`);
        return;
    }

    let result;
    try {
        let user = await client.query("SELECT * FROM users WHERE email=$1", [email]);
        result = {status: "success", data: user};
    } catch(e) {
        console.error("Error with retrieving user");
        console.error(e);
        result = {status: "failure"};
    } finally {
        client.release();
        return result;
    }
}

// Update user logged in time
async function updateLogin(uuid) {
    console.log("Updating user login");
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[updateLogin] Error updating login: could not connect to DB`);
        return;
    }
    const date = new Date();

    let result;
    try {
        await client.query("UPDATE users SET last_login=$1 WHERE user_id=$2", [date.toISOString(), uuid]);
        result = {status: "success"};
    } catch(e) {
        // No need to rollback here because we are only updating one record
        console.error("Error updating user's last login time")
        console.error(e);
        result = {status: "failure"};
    } finally {
        client.release();
        return result;
    }
}

// Create new user
async function createUser(fname=null, lname=null, email) {
    console.log("Creating new user");
    // Connect to DB
    let client;
    try {
        const pool = getPool();
        client = await pool.connect();
    } catch (e) {
        console.error(`[createUser] Error creating user: could not connect to DB`);
        return;
    }
    
    let result;
    try {
        let newUser = await client.query("INSERT INTO users (fname, lname, email) VALUES ($1, $2, $3) RETURNING user_id", [fname, lname, email]);
        result = {
            status: "sucess", 
            data: newUser['rows'][0]['user_id']
        };
    } catch(e) {
        // No need to rollback here because we are only creating one record
        console.error("Error creating new user");
        console.error(e);
        result = {status: "failure"};
    } finally {
        client.release();
        return result;
    }
}

module.exports = { createRecipe, deleteRecipe, updateRecipe, getUser, updateLogin, createUser };