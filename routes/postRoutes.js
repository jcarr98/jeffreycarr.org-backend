const { _infoTransformers } = require("passport/lib");

module.exports = (app, pool) => {
    async function transaction(recipe, category) {
        console.log(`Inserting ${category}`);
        // Begin transaction
        return pool.getConnection(function(err, connection) {
            if(err) {
                console.log("Error getting connection");
                connection.release();
                return false;
            }
            return connection.beginTransaction(function(err) {
                if(err) {
                    console.log(err);
                    connection.release();
                    return false;
                }
    
                //* Insert category *\\
                connection.query("INSERT INTO categories (name) VALUES (?)", [category], function(err, result) {
                    // Check duplication error - just ignore it
                    if(err) {
                        if(err.errno === 1062) {
                            console.log("Duplication error - ignore");
                            console.log(result);
                        } else {
                            console.log("Error in category insertion");
                            console.log(err);
                            connection.rollback();
                            connection.release();
                            return false;
                        }
                    }
    
                    //* Insert recipe *\\
                    connection.query("INSERT INTO recipes (name, details, category) VALUES (?, ?, (SELECT id FROM categories WHERE name=? LIMIT 1))", [recipe.name, recipe.details, category], function(err) {
                        if(err) {
                            console.log("Error in recipe insertion");
                            console.log(err);
                            connection.rollback();
                            connection.release();
                            return false;
                        }
    
                        //* Insert ingredients *\\
                        // Create ingredients string
                        let ingredientsString = "INSERT INTO ingredients (name) VALUES ";
                        for(let i = 0; i < recipe.ingredients.length; i++) {
                            ingredientsString += `('${recipe.ingredients[i].name}')`;
                            if(i < recipe.ingredients.length-1) {
                                ingredientsString += ',';
                            }
                        }
    
                        connection.query(ingredientsString, function(err) {
                            if(err) {
                                console.log("Error in ingredients insertion");
                                console.log(err);
                                connection.rollback();
                                connection.release();
                                return false;
                            }

                            //* Insert rIngredients *\\
                            // Create rIngredients string
                            let rIngredientsString = "INSERT INTO rIngredients (recipe, ingredient, style, amount, optional) VALUES ";
                            for(let j = 0; j < recipe.ingredients.length; j++) {
                                rIngredientsString += `((SELECT id FROM recipes WHERE name='${recipe.name}'), (SELECT id FROM ingredients WHERE name='${recipe.ingredients[j].name}'), '${recipe.ingredients[j].style}', '${recipe.ingredients[j].amount}', ${recipe.ingredients[j].optional})`;
                                if(j < recipe.ingredients.length-1) {
                                    rIngredientsString += ',';
                                }
                            }

                            console.log("rIngredients");
                            console.log(rIngredientsString);

                            connection.query(rIngredientsString, function(err) {
                                if(err) {
                                    console.log("Error in rIngredients insertion");
                                    console.log(err);
                                    connection.rollback();
                                    connection.release();
                                    return false;
                                }

                                //* Insert directions *\\
                                // Create directions string
                                let directionsString = "INSERT INTO directions (recipe, step, step_num, optional) VALUES ";
                                for(let k = 0; k < recipe.directions.length; k++) {
                                    directionsString += `((SELECT id FROM recipes WHERE name='${recipe.name}'), '${recipe.directions[k].step}', ${recipe.directions[k].step_num}, ${recipe.directions[k].optional})`;
                                    if(k < recipe.directions.length-1) {
                                        directionsString += ',';
                                    }
                                }

                                connection.query(directionsString, function(err) {
                                    if(err) {
                                        console.log("Error in directions insertion");
                                        console.log(err);
                                        connection.rollback();
                                        connection.release();
                                        return false;
                                    }

                                    connection.commit(function(err) {
                                        if(err) {
                                            console.log("Error committing");
                                            console.log(err);
                                            connection.release();
                                            return false;
                                        }

                                        connection.release();
                                        return true;
                                    })
                                })
                            })
                        })
                    });
                });
            });
        })
    }

    app.post('/api/createRecipe', async (req, res) => {
        console.log(`Received recipe '${req.body.name}'`);

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
        console.log("Result:");
        console.log(result);
    });
}