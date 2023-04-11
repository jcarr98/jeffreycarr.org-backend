const { getPool } = require('./getConnection');
const transactions = require('./transactions');

async function userOwnsRecipe(rec_id, user_id) {
  // Connect to DB
  const pool = getPool();
  const client = await pool.connect();

  // Get recipe author
  try {
    let recipeResult = await client.query("SELECT author FROM recipes WHERE rec_id=$1", [rec_id]);

    if(recipeResult['rowCount'] == 0) {
      return false;
    }

    let recipeAuthor = recipeResult['rows'][0]['author'];

    return user_id == recipeAuthor;
  } catch (e) {
    console.error("[userOwnsRecipe] Error validating author");
    return false;
  }
}

async function recipeNameIsUnique(recipe_name) {
  try {
    const pool = getPool();
    const client = await pool.connect();

    // Check recipe name
    let recipeResult = await client.query("SELECT recipe_name FROM recipes WHERE recipe_name=$1", [recipe_name]);
    return recipeResult['rowCount'] == 0;
  } catch (e) {
    console.error("[recipeNameIsUnique] Error validating recipe name");
    return false;
  }
}

async function deleteRecipe(id, user_id) {
  // Connect to DB
  const pool = getPool();
  const client = await pool.connect();

  // Validate id is provided
  if(id == undefined || id == null) {
    console.error("[deleteRecipe] Malformed request");
    return { status: "failure", code: 400 };
  }

  // Get recipe info
  let recipeResponse = await client.query("SELECT * FROM recipes WHERE rec_id=$1", [id]);
  let recipe;
  if(recipeResponse['rowCount'] == 0) {
    // If we don't have any recipes, we can consider it deleted
    return { status: "success" };
  } else {
    recipe = recipeResponse['rows'][0];
  }

  // Confirm user owns this recipe
  if(recipe['author'] != user_id) {
    console.error("[deleteRecipe] User is not authorized to delete this recipe");
    return { status: "failure", code: 401 };
  }

  // Delete this recipe
  return await transactions.deleteRecipe(id);
}

async function updateRecipe(recipe, user_id) {
  // Validate parameters
  console.log("[post/updateRecipe] Validating parameters...");
  if(recipe == undefined || user_id == undefined) {
    console.error("[updateRecipe] Malformed request");
    return { status: "failure", code: 400 };
  }
  console.log("[post/updateRecipe] Parameters validated!");

  // Validate user can update this recipe
  console.log("[post/updateRecipe] Verifying user ownership...");
  if(!userOwnsRecipe(recipe['rec_id'], user_id)) {
    console.error("[updateRecipe] User not authorized to update this recipe");
    return { status: "failure", code: 401 };
  } else {
    console.log("[post/updateRecipe] User ownership verified!");
    recipe['author'] = user_id;
  }

  // Validate new recipe name is not taken
  console.log("[post/updateRecipe] Validating new recipe name...");
  if(!recipeNameIsUnique(recipe['recipe_name'])) {
    console.error("[updateRecipe] Recipe name is not unique");
    return { status: "failure", code: 400, message: "Recipe name is already taken" };
  }
  console.log("[post/updateRecipe] New recipe name validated!");

  // Perform update transaction
  return await transactions.updateRecipe(recipe);
}

async function addFavorite(id, user_id) {
  // Connect to DB
  let pool, client;
  try {
    pool = getPool();
    client = await pool.connect();
  } catch (e) {
    console.error("[addFavorite] Error connecting to DB");
    return { status: "failure", code: 500 };
  }

  // Perform request
  console.log("[addFavorite] Sending data to DB");
  let finalResult;
  try {
    let results = await client.query("INSERT INTO user_favorites(user_id, rec_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [user_id,  id]);
    finalResult = {status: "success"}
    console.log("[addFavorite] Item successfully saved to DB");
  } catch(e) {
    console.error("[addFavorite] Error inserting into DB");
    console.error(e);
    finalResult = {status: "failure"};
  } finally {
    // Release client
    client.release();

    // Return result
    return finalResult;
  }
}

async function removeFavorite(id, user_id) {
  // Connect to DB
  let pool, client;
  try {
    pool = getPool();
    client = await pool.connect();
  } catch (e) {
    console.error("[removeFavorite] Error connecting to DB");
    return { status: "failure", code: 500 };
  }

  // Perform request
  console.log("[removeFavorite] Deleting favorited item from DB");
  let finalResult;
  try {
    let results = await client.query("DELETE FROM user_favorites WHERE rec_id=$1 AND user_id=$2", [id, user_id]);
    finalResult = {status: "success"};
    console.log("[removeFavorites] Favorite successfully deleted from database.");
  } catch(e) {
    console.error("[removeFavorite] Error deleting favorite");
    console.error(e);
    finalResult = {status: "failure"};
  } finally {
    // Release client
    client.release();

    // Return result
    return finalResult;
  }
}

module.exports = { deleteRecipe, updateRecipe, addFavorite, removeFavorite };