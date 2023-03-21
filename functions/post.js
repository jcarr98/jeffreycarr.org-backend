async function addFavorite(pool, id, user_id) {
  // Connect to DB
  const client = await pool.connect();

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

async function removeFavorite(pool, id, user_id) {
  // Connect to DB 
  const client = await pool.connect();

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

module.exports = { addFavorite, removeFavorite };