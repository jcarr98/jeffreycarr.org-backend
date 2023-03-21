// We will always need all categories to display to users
async function getCategories(pool) {
  console.log("[getCategories] Connecting to DB");
  // Connect to DB
  const client = await pool.connect();

  // Get all categories
  console.log("[getCategories] Querying DB for all categories");
  let results = await client.query("SELECT * FROM categories");
  client.release();

  // Confirm results
  if(results['rowCount'] < 1) {
    return {status: "failure"};
  } else {
    return {status: "success", data: results['rows']};
  }
}

async function getFavorites(pool, user_id) {
  console.log("[getFavorites] Connecting to DB");
  const client = await pool.connect();

  let result;
  try {
    const favsResults = await client.query("SELECT rec_id FROM user_favorites WHERE user_id=$1", [user_id]);
    result = {status: "success", data: favsResults['rows']};
  } catch(e) {
    console.error("[getFavorites] Error retrieving favorites from DB");
    console.error(e);
    result = {status: "failure"};
  } finally {
    client.release();
    return result;
  }
}

async function getRecipes(pool, offset, limit) {
  console.log("[getRecipes] Connecting to DB");
  // Create client
  const client = await pool.connect();

  // Get number of recipes
  console.log("[getRecipes] Querying DB for total number of recipes");
  let numRecipesResults = await client.query("SELECT COUNT(rec_id) FROM recipes");

  let numRecipes;
  if(numRecipesResults['rowCount'] < 1) {
    return {status: "failure"}
  } else {
    numRecipes = numRecipesResults['rows'][0]['count'];
  }

  console.log(`[getRecipes] Querying DB for ${limit} recipes`)
  // Craft GET query
  let results = await client.query("SELECT * FROM recipes ORDER BY recipe_name ASC LIMIT $1 OFFSET $2", [limit, offset]);
  client.release();
  
  // Confirm results
  if(results['rowCount'] > 0) {
    return {status: "success", numRecipes: numRecipes, data: results['rows']}
  } else {
    return {status: "failure"};
  }
}

async function getRandomRecipe(pool) {
  // Connect to DB
  const client = await pool.connect();

  // Get a random item
  let finalResult;
  try {
    // Cockroach doesn't support TABLESAMPLE yet, but when that feature is implemented use that instead
    // https://stackoverflow.com/questions/5297396/quick-random-row-selection-in-postgres
    let result = await client.query("SELECT rec_id,recipe_name FROM recipes ORDER BY random() LIMIT 1");
    finalResult = {status: "success", data: result['rows'][0]};
  } catch(e) {
    console.error("[getRandomRecipe] Error retrieving random recipe from DB");
    console.error(e);
    finalResult = {status: "failure"};
  } finally {
    client.release();
    return finalResult;
  }
  
}

async function searchDB(pool, search) {
  // Connect to DB
  const client = await pool.connect();

  // Add % to search query
  let broadSearch = "%" + search + "%";

  // Send search query to DB
  let finalResult;
  try {
    let response = await client.query("SELECT * FROM recipes WHERE recipe_name ILIKE $1", [broadSearch]);
    finalResult = { status: "success", data: response['rows'] };
  } catch(e) {
    console.error("[search] Error searching DB");
    console.error(e);
    finalResult = { status: "failure" };
  } finally {
    client.release();
    return finalResult;
  }
}

module.exports = { getCategories, getFavorites, getRecipes, getRandomRecipe, searchDB };