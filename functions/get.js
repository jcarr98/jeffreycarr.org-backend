const { getPool } = require('./getConnection');

// Make this a helper function since we do the same process for each query
async function doQuery(query, queryValues=[]) {
  let pool, client;
  try {
    // Get pool
    pool = getPool();
    // Connect to DB
    client = await pool.connect();
  } catch (e) {
    console.error("Error connecting to DB");
    return { status: "failure", code: 500 };
  }

  // Do query
  let finalResult;
  try {
    let result = await client.query(query, queryValues);
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
  let result = await doQuery("SELECT * FROM categories");
  
  if(result['status'] == "failure") {
    return { status: "failure" };
  } else {
    return { status: "success", data: result['data']['rows'] };
  }
}

async function getIngredients() {
  // Perform query
  let result = await doQuery("SELECT * FROM ingredients");

  if(result['status'] == "success") {
    return { status: "success", data: result['data']['rows'] };
  } else {
    return { status: "failure" };
  }
}

async function getFavorites(user_id) {
  console.log("[getFavorites] Connecting to DB");

  // Get all user favorites
  const query = "SELECT rec_id FROM user_favorites WHERE user_id=$1";
  const queryValues = [user_id];

  let result = await doQuery(query, queryValues);

  let ids;
  if(result['status'] == "success") {
    ids = result['data']['rows'];
  } else {
    return { status: "failure" };
  }

  // Get the names of each favorite item
  let userFavorites = [];
  for(let i=0; i < ids.length; i++) {
    let recipeName = await doQuery("SELECT recipe_name FROM recipes WHERE rec_id=$1", [ids[i]['rec_id']]);
    if(recipeName['status'] != "success") return { status: "failure" };

    userFavorites.push({ rec_id: ids[i]['rec_id'], name: recipeName['data']['rows'][0]['recipe_name']});  // This is gross
  }

  return { status: "success", data: userFavorites };
}

async function checkIfFavorited(recipeId, userId) {
  console.log("[checkIfFavorited] Checking favorites...");
  // Get user's favorites
  let idRequest = await doQuery("SELECT rec_id FROM user_favorites WHERE user_id=$1", [userId]);
  
  if(idRequest['status'] == "success") {
    // Check if any ids match our requested id
    for(let i=0; i < idRequest['data']['rows'].length; i++) {
      console.log(`Comparing ${idRequest['data']['rows'][i]['rec_id']} to ${recipeId}: ${idRequest['data']['rows'][i]['rec_id'] == recipeId}`)
      if(idRequest['data']['rows'][i]['rec_id'] == recipeId) {
        return { status: "success", favorited: true };
      }
    }

    return { status: "success", favorited: false };
  } else {
    return { status: "failure", code: 500 };
  }
}

async function getRecipes(offset, limit, authors, categories) {
  console.log("[getRecipes] Connecting to DB");

  // Get count of recipes in DB
  console.log("[getRecipes] Querying DB for total number of recipes");
  let countQuery = "SELECT COUNT(rec_id) FROM recipes";
  let countQueryValues = [];
  // Add authors to query if provided
  let variableCount = 1;
  if(authors.length > 0) {
    countQuery = countQuery + " WHERE (author=$1";
    countQueryValues.push(authors[0]);
    variableCount += 1;
    for(let i=1; i < authors.length; i++) {
      countQuery += ` OR author=$${variableCount}`;
      countQueryValues.push(authors[i]);
      variableCount += 1;
    }
    countQuery += ")";
  }
  if(categories.length > 0) {
    countQuery += `${authors.length > 0 ? " AND" : " WHERE"} (category=$${variableCount}`;
    countQueryValues.push(categories[0]['cat_id']);
    variableCount += 1;
    for(let i=1; i < categories.length; i++) {
      countQuery += ` OR category=$${variableCount}`;
      countQueryValues.push(categories[i]['cat_id']);
      variableCount += 1;
    }
    countQuery += ")";
  }

  console.log("[getRecipes] Count query: ", countQuery);
  console.log("[getRecipes] Count query values: ", countQueryValues);

  let countResult = await doQuery(countQuery, countQueryValues);

  let numRecipes;
  if(countResult['status'] == "success") {
    numRecipes = countResult['data']['rows'][0]['count'];
  } else {
    return { status: "failure" };
  }

  // Get recipes from DB
  console.log(`[getRecipes] Querying DB for ${limit} recipes`);
  // Query with author is too different to just append to the end
  let recipeQuery = "SELECT * FROM recipes"; 
  let recipeValues = [];
  variableCount = 1;
  if(authors.length > 0) {
    recipeQuery += " WHERE (author=$1";
    recipeValues.push(authors[0]);
    variableCount += 1;
    for(let i=1; i < authors.length; i++) {
      recipeQuery += ` OR author=$${variableCount}`;
      recipeValues.push(authors[i]);
      variableCount += 1;
    }
    recipeQuery += ")";
  }
  if(categories.length > 0) {
    // Put AND if there are also authors being filtered, put WHERE if it's just categories
    recipeQuery += `${authors.length > 0 ? " AND" : " WHERE"} (category=$${variableCount}`;
    recipeValues.push(categories[0]['cat_id']);
    variableCount += 1;
    for(let i=1; i < categories.length; i++) {
      recipeQuery += ` OR category=$${variableCount}`;
      recipeValues.push(categories[i]['cat_id']);
      variableCount += 1;
    }
    recipeQuery += ")";
  }

  // Add order, limit, and offset to query
  recipeQuery += ` ORDER BY recipe_name ASC LIMIT $${variableCount} OFFSET $${variableCount+1}`;
  recipeValues.push(limit);
  recipeValues.push(offset);

  console.log("[getRecipes] Query:", recipeQuery);
  console.log("[getRecipes] Values:", recipeValues);

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

async function getAllAuthors() {
  let authors = [];

  try {
    // Get all users
    let result = await doQuery("SELECT user_id, fname, lname FROM users", []);
    if(result['status'] == "failure") {
      return { status: "failure", code: 500 };
    }

    let allUsers = result['data']['rows'];

    // Find which users have written recipes
    for(let i=0; i < allUsers.length; i++) {
      let authorRecipes = await doQuery("SELECT recipe_name FROM recipes WHERE author=$1", [allUsers[i]['user_id']]);
      if(authorRecipes['status'] == "failure") return { status: "failure", code: 500 };
      else if(authorRecipes['data']['rowCount'] > 0)  authors.push(allUsers[i]);
    }

    return { status: "success", data: authors };
  } catch (e) {
    console.error(e);
    return { status: "failure", code: 500 };
  }
}

async function getAuthorNames(ids) {
  // Make query for each author
  let authors = [];
  
  try {
    for(let i=0; i < ids.length; i++) {
      let result = await doQuery("SELECT fname, lname FROM users WHERE user_id=$1", [ids[i]]);
      if(result['status'] == "failure") {
        console.error("[getAuthorNames] Error retrieving author from DB");
        return { status: "failure", code: 500 };
      } 
      else if(result['data']['rowCount'] == 0) {
        continue;
      }
      else {
        authors.push({
          user_id: ids[i],
          fname: result['data']['rows'][0]['fname'],
          lname: result['data']['rows'][0]['lname']
        });
      }
    }
  } catch (e) {
    console.error("Error getting authors");
    return { status: "failure", code: 500 };
  }

  return { status: "success", data: authors };
}

async function searchDB(search) {
  // Add % to search query
  let broadSearch = "%" + search + "%";

  // Write query
  // ILIKE isn't the most efficient search, but cockroachDB doesn't support faster search yet
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

async function checkRecipeExists(name) {
   let results = await doQuery("SELECT recipe_name FROM recipes WHERE recipe_name=$1", [name]);
   return (results['data']['rowCount'] > 0);
}

async function getRecipeInfo(recipeId) {
  const query = "SELECT recipe_name,details,category,author FROM recipes WHERE rec_id=$1";
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

module.exports = { checkIfFavorited, checkRecipeExists, getAllAuthors, getAuthorNames, getCategories, getFavorites, getIngredients, getRandomRecipe, getRecipeDirections, getRecipeInfo, getRecipeIngredients, getRecipes, searchDB };