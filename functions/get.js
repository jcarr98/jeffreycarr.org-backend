const db = require('./getConnection');

// Make this a helper function since we do the same process for each query
async function doQuery(query, queryValues=[]) {
  // Get pool
  const pool = db.getPool();
  // Connect to DB
  const client = await pool.connect();

  // Do query
  let finalResult;
  try {
    const result = await client.query(query, queryValues);
    finalResult = { status: "success", data: result };
  } catch(e) {
    console.error("Error performing query");
    console.error(e);
    finalResult = { status: "failure" };
  } finally {
    client.release();
    return finalResult;
  }
}

// We will always need all categories to display to users
async function getCategories() {
  console.log("[getCategories] Connecting to DB");

  // Perform query
  const query = "SELECT * FROM categories";
  let result = await doQuery(query);
  
  if(result['status'] == "failure") {
    return { status: "failure" };
  } else {
    return { status: "success", data: result['data']['rows'] };
  }
}

async function getFavorites(user_id) {
  console.log("[getFavorites] Connecting to DB");

  const query = "SELECT rec_id FROM user_favorites WHERE user_id=$1";
  const queryValues = [user_id];

  let result = await doQuery(query, queryValues);

  if(result['status'] == "success") {
    return { status: "success", data: result['data']['rows'] };
  } else {
    return { status: "failure" };
  }
}

async function getRecipes(offset, limit) {
  console.log("[getRecipes] Connecting to DB");

  // Get count of recipes in DB
  console.log("[getRecipes] Querying DB for total number of recipes");
  const countQuery = "SELECT COUNT(rec_id) FROM recipes";
  let countResult = await doQuery(countQuery);

  let numRecipes;
  if(countResult['status'] == "success") {
    numRecipes = countResult['data']['rows'][0]['count'];
  } else {
    return { status: "failure" };
  }

  console.log(`[getRecipes] Querying DB for ${limit} recipes`)
  const recipeQuery = "SELECT * FROM recipes ORDER BY recipe_name ASC LIMIT $1 OFFSET $2";
  const recipeValues = [limit, offset];
  let recipeResults = await doQuery(recipeQuery, recipeValues);

  if(recipeResults['status'] == "success") {
    return { status: "success", numRecipes: numRecipes, data: recipeResults['data']['rows'] };
  } else {
    return { status: "failure" };
  }
}

async function getRandomRecipe() {
  // Perform query
  const query = "SELECT rec_id,recipe_name FROM recipes ORDER BY random() LIMIT 1";

  let result = await doQuery(query);

  if(result['status'] == "success") {
    return { status: "success", data: result['data']['rows'][0] };
  } else {
    return { status: "failure" };
  }
}

async function searchDB(search) {
  // Add % to search query
  let broadSearch = "%" + search + "%";

  // Write query
  const query = "SELECT * FROM recipes WHERE recipe_name ILIKE $1";
  const queryValues = [broadSearch];

  // Search for results
  let results = await doQuery(query, queryValues);

  if(results['status'] == "success") {
    return { status: "success", data: results['data']['rows'] };
  } else {
    return { status: "failure" };
  }
}

async function getRecipeInfo(recipeId) {
  const query = "SELECT recipe_name,details,category,author_fname,author_lname FROM recipes WHERE rec_id=$1";
  const queryValues = [recipeId];
  const queryResult = await doQuery(query, queryValues);

  if(queryResult['status'] == "failure" || queryResult['data']['rowCount'] == 0) {
    return { status: "failure" };
  }

  let recipe = queryResult['data']['rows'][0];

  // Get category name
  const categoryName = await getCategoryName(recipe['category']);

  if(categoryName['status'] == "failure") {
    console.error("[getRecipeInfo] Failed to retrieve category name");
    return { status: "failure" };
  } else {
    recipe['category'] = categoryName['name'];
    return { status: "success", recipe: recipe };
  }
}

async function getCategoryName(categoryId) {
  // Send search query to DB
  const query = "SELECT name FROM categories WHERE cat_id=$1";
  const queryValues = [categoryId];
  let result = await doQuery(query, queryValues);
  
  if(result['status'] == "success") {
    const catName = (result['data']['rowCount'] > 0 ? result['data']['rows'][0]['name'] : "");
    return { status: "success", name: catName };
  } else {
    return result;
  }
}

async function getRecipeIngredients(recipeId) {
  // Perform query
  const query = "SELECT ing_id,prep,amount,optional FROM recipe_ingredients WHERE rec_id=$1";
  const queryValues = [recipeId];

  let result = await doQuery(query, queryValues);

  if(result['status'] == "failure") {
    console.error("[getReicpeIngredients] Error retrieving recipe's ingredients from DB");
    // If there is an error, we will not be searching any further
    return { status: "failure" };
  }
  else if(result['data']['rowCount'] == 0) {
    // If there are no ingredients in this recipe (somehow) we can just return an empty array
    return { status: "success", ingredients: []};
  }

  const rawRecipeIngredients = result['data']['rows'];
  let ingredientNamesPromises = [];

  // Query for each ingredient name
  // This is done asynchronously to speed up searches
  console.log("[getRecipeIngredients] Querying for each ingredient name");
  for(let i=0; i < rawRecipeIngredients.length; i++) {
    ingredientNamesPromises.push(getIngredientName(rawRecipeIngredients[i]['ing_id']));
  }

  // Wait for all searches to complete
  console.log("[getRecipeIngredients] Resolving all recipe name promises");
  const recipeIngredientNames = await Promise.all(ingredientNamesPromises);
  console.log("[getRecipeIngredients] Resolved all promises");

  // This is our final product!
  let recipeIngredients = [];

  // Put each ingredient name in 
  for(let j=0; j < recipeIngredientNames.length; j++) {
    // Check if there was a failure
    if(recipeIngredientNames[j]['status'] == "failure") {
      return { status: "failure" };
    } else {
      let currentIngredient = rawRecipeIngredients[j];
      recipeIngredients.push({
        ingredientName: recipeIngredientNames[j]['name'],
        prep: currentIngredient['prep'],
        amount: currentIngredient['amount'],
        optional: currentIngredient['optional']
      });
    }
  }

  return { status: "success", ingredients: recipeIngredients };
}

async function getIngredientName(ingredientId) {
  // Query for ingredient name
  const query = "SELECT ing_id,ingredient_name FROM ingredients WHERE ing_id=$1";
  const queryValues = [ingredientId];

  let result = await doQuery(query, queryValues);

  if(result['status'] == "success") {
    return { status: "success", name: result['data']['rows'][0]['ingredient_name'] };
  } else {
    return { status: "failure" };
  }
}

async function getRecipeDirections(recipeId) {
  // Query for directions
  const query = "SELECT step,step_num FROM directions WHERE rec_id=$1 ORDER BY step_num";
  const queryValues = [recipeId];

  let result = await doQuery(query, queryValues);

  return (result['status'] == "success" ? { status: "success", directions: result['data']['rows'] } : { status: "failure" });
}

module.exports = { getCategories, getFavorites, getRecipes, getRandomRecipe, searchDB, getRecipeInfo, getRecipeIngredients, getRecipeDirections };