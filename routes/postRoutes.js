module.exports = (app, pool) => {
    async function transaction(recipe, category) {
        // console.log(ingredients);
        // Create recipe object
        let r = {
            name: recipe.name,
            details: recipe.details
        }
        return await performQuery("CALL InsertRecipe(?, ?, ?, ?)", [category, JSON.stringify(r), JSON.stringify(recipe.ingredients), JSON.stringify(recipe.directions)]);
    }

    function performQuery(query, queryValues) {
        return new Promise((resolve, reject) => {
            pool.query(query, queryValues, (err, result) => {
                if(err) {
                    return reject(err);
                } else {
                    return resolve(result);
                }
            })
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