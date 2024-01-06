// include express framework
const express = require("express")
 
// create an instance of it
const app = express()
 
// create http server from express instance
const http = require("http").createServer(app)
 
// database module
const mongodb = require("mongodb")
 
// client used to connect with database
const MongoClient = mongodb.MongoClient
 
// each Mongo document's unique ID
const ObjectId = mongodb.ObjectId

// Add headers before the routes are defined
// app.use(function (req, res, next) {
 
//     // Website you wish to allow to connect
//     res.setHeader("Access-Control-Allow-Origin", "*")
 
//     // Request methods you wish to allow
//     res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE")
 
//     // Request headers you wish to allow
//     res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,Authorization")
 
//     // Set to true if you need the website to include cookies in the requests sent
//     // to the API (e.g. in case you use sessions)
//     res.setHeader("Access-Control-Allow-Credentials", true)
 
//     // Pass to next layer of middleware
//     next()
// })

// module required for parsing FormData values
const expressFormidable = require("express-formidable")
 
// setting the middleware
app.use(expressFormidable({
    multiples: true
}))
app.use("/public", express.static(__dirname + "/public"))
app.use("/uploads", express.static(__dirname + "/uploads"))
app.set("view engine", "ejs")

const ejs = require("ejs")
const fs = require("fs")
const bcryptjs = require("bcryptjs")
const cron = require("node-cron")
const requestModule = require("request")

// JWT used for authentication
const jwt = require("jsonwebtoken")

const auth = require("./modules/auth")
const globals = require("./modules/globals")
const companies = require("./modules/companies")

const port = (process.env.PORT || 4000)
 
// start the server at port 3000 (for local) or for hosting server port
http.listen(port, function () {
    console.log("Server has been started at: " + port)
 
    // connect with database
    MongoClient.connect(connectionString, function (error, client) {
        if (error) {
            console.error(error)
            return
        }
 
        // database name
        global.db = client.db("trustpilot")
        console.log("Database connected")

        // # ┌────────────── second (optional)
        // # │ ┌──────────── minute
        // # │ │ ┌────────── hour
        // # │ │ │ ┌──────── day of month
        // # │ │ │ │ ┌────── month
        // # │ │ │ │ │ ┌──── day of week
        // # │ │ │ │ │ │
        // # │ │ │ │ │ │
        // # * * * * * *

        // cron.schedule("57 17 * * *", function () {
        //     console.log("Cron job")
        // })

        companies.init(app)

        app.get("/userProfileImage/:_id", async function (request, result) {
            const _id = request.params._id

            const fileData = await fs.readFileSync("public/img/user-placeholder.png")
            const buffer = Buffer.from(fileData, "base64")

            if (!_id) {
                result.writeHead(200, {
                    "Content-Type": "image/png",
                    "Content-Length": buffer.length
                })

                result.end(buffer)
                return
            }

            const filter = []
            if (ObjectId.isValid(_id)) {
                filter.push({
                    _id: ObjectId(_id)
                })
            } else {
                filter.push({
                    email: _id
                })
            }

            const user = await db.collection("users")
                .findOne({
                    $or: filter
                })

            if (user != null && user.profileImage?.path) {
                if (await fs.existsSync(user.profileImage?.path)) {
                    const fileData = await fs.readFileSync(user.profileImage.path)
                    const buffer = Buffer.from(fileData, "base64")
                    result.writeHead(200, {
                        "Content-Type": "image/png",
                        "Content-Length": buffer.length
                    })

                    result.end(buffer)
                    return
                }
            }

            result.writeHead(200, {
                "Content-Type": "image/png",
                "Content-Length": buffer.length
            })

            result.end(buffer)
            return
        })

        app.get("/review/:_id", async function (request, result) {
            const _id = request.params._id
            if (!_id) {
                result.send("Review not found")
                return
            }

            if (!ObjectId.isValid(_id)) {
                result.send("Review not found")
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    _id: ObjectId(_id)
                })

            if (review == null) {
                result.send("Review not found")
                return
            }

            result.render("review-detail", {
                review: review
            })
        })

        app.get("/evaluate/:domain/:stars?", async function (request, result) {
            const domain = request.params.domain
            const stars = request.params.stars ?? 0
            // if (stars <= 0) {
            //     result.send("Please select ratings ranging from 1 to 5")
            //     return
            // }

            result.render("evaluate-company", {
                domain: domain,
                stars: stars
            })
        })

        app.get("/company/:domain", async function (request, result) {
            const domain = request.params.domain

            result.render("company-detail", {
                domain: domain
            })
        })

        app.post("/save-profile", auth, async function (request, result) {
            const user = request.user
            const name = request.fields.name || ""

            if (!name) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })

                return
            }

            if (Array.isArray(request.files.profileImage)) {
                result.json({
                    status: "error",
                    message: "Only 1 file is allowed."
                })

                return
            }

            const profileImage = request.files.profileImage
            let profileImageObj = user.profileImage || {}

            // const files = []
            // if (Array.isArray(request.files.profileImage)) {
            //     for (let a = 0; a < request.files.profileImage.length; a++) {
            //         if (request.files.profileImage[a].size > 0) {
            //             files.push(request.files.profileImage[a])
            //         }
            //     }
            // } else if (request.files.profileImage.size > 0) {
            //     files.push(request.files.profileImage)
            // }

            if (profileImage?.size > 0) {

                const tempType = profileImage.type.toLowerCase()
                if (!tempType.includes("jpeg") && !tempType.includes("jpg") && !tempType.includes("png")) {
                    result.json({
                        status: "error",
                        message: "Only JPEG, JPG or PNG is allowed."
                    })
                    return
                }

                if (await fs.existsSync(profileImageObj.path))
                    await fs.unlinkSync(profileImageObj.path)

                const fileData = await fs.readFileSync(profileImage.path)
                const fileLocation = "uploads/profiles/" + (new Date().getTime()) + "-" + profileImage.name
                await fs.writeFileSync(fileLocation, fileData)
                await fs.unlinkSync(profileImage.path)

                profileImageObj = {
                    size: profileImage.size,
                    path: fileLocation,
                    name: profileImage.name,
                    type: profileImage.type
                }
            }

            await db.collection("users")
                .findOneAndUpdate({
                    _id: user._id
                }, {
                    $set: {
                        name: name,
                        profileImage: profileImageObj
                    }
                })

            result.json({
                status: "success",
                message: "Profile has been updated.",
                profileImage: profileImageObj
            })
        })

        // route for logout request
        app.post("/logout", auth, async function (request, result) {
            const user = request.user
         
            // update JWT of user in database
            await db.collection("users").findOneAndUpdate({
                _id: user._id
            }, {
                $set: {
                    accessToken: ""
                }
            })
         
            result.json({
                status: "success",
                message: "Logout successfully."
            })
        })

        app.post("/me", auth, async function (request, result) {
            const user = request.user

            let hasLocationExpired = true
            if (typeof user.location !== "undefined") {
                const currentTimestamp = new Date().setDate(new Date().getDate() + 1)
                if (currentTimestamp > user.location.createdAt) {
                    hasLocationExpired = false
                }
            }

            if (hasLocationExpired) {
                requestModule.post("http://www.geoplugin.net/json.gp", {
                    formData: null
                }, async function(err, res, data) {
                    if (!err && res.statusCode === 200) {
                        // console.log(data)

                        data = JSON.parse(data)
                        // console.log(data)

                        const city = data.geoplugin_city
                        const continent = data.geoplugin_continentName
                        const continentCode = data.geoplugin_continentCode
                        const country = data.geoplugin_countryName
                        const countryCode = data.geoplugin_countryCode
                        const currencyCode = data.geoplugin_currencyCode
                        const currencySymbol = data.geoplugin_currencySymbol
                        const currencyConverter = data.geoplugin_currencyConverter
                        const latitude = parseFloat(data.geoplugin_latitude)
                        const longitude = parseFloat(data.geoplugin_longitude)
                        const region = data.geoplugin_region
                        const ipAddress = data.geoplugin_request
                        const timezone = data.geoplugin_timezone

                        const locationObj = {
                            city: city,
                            continent: continent,
                            continentCode: continentCode,
                            country: country,
                            countryCode: countryCode,
                            currencyCode: currencyCode,
                            currencySymbol: currencySymbol,
                            currencyConverter: currencyConverter,
                            latitude: latitude,
                            longitude: longitude,
                            region: region,
                            ipAddress: ipAddress,
                            timezone: timezone,
                            createdAt: new Date().getTime()
                        }

                        await db.collection("users").findOneAndUpdate({
                            _id: user._id
                        }, {
                            $set: {
                                location: locationObj
                            }
                        })

                        user.location = locationObj
                    }
                })
            }
         
            result.json({
                status: "success",
                message: "Data has been fetched.",
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    profileImage: (user.profileImage?.path ? (mainURL + "/" + user.profileImage.path) : "")
                }
            })
        })

        // route for login requests
        app.post("/login", async function (request, result) {
         
            // get values from login form
            const email = request.fields.email
            const password = request.fields.password

            if (!email || !password) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })

                return
            }
         
            // check if email exists
            const user = await db.collection("users").findOne({
                email: email
            })
         
            if (user == null) {
                result.json({
                    status: "error",
                    message: "Email does not exists."
                })

                return
            }

            // check if password is correct
            const isVerify = await bcryptjs.compareSync(password, user.password)

            if (isVerify) {
         
                // generate JWT of user
                const accessToken = jwt.sign({
                    userId: user._id.toString(),
                    time: new Date().getTime()
                }, jwtSecret, {
                    expiresIn: (60 * 60 * 24 * 30) // 30 days
                })
     
                // update JWT of user in database
                await db.collection("users").findOneAndUpdate({
                    email: email
                }, {
                    $set: {
                        accessToken: accessToken
                    }
                })
     
                result.json({
                    status: "success",
                    message: "Login successfully.",
                    accessToken: accessToken,
                    user: {
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        profileImage: user.profileImage
                    }
                })
     
                return
            }
     
            result.json({
                status: "error",
                message: "Password is not correct."
            })
        })

        app.post("/register", async function (request, result) {
            const name = request.fields.name
            const email = request.fields.email
            const password = request.fields.password
            const createdAt = new Date().toUTCString()
     
            if (!name || !email || !password) {
                result.json({
                    status: "error",
                    message: "Please enter all values."
                })

                return
            }
     
            // check if email already exists
            const user = await db.collection("users").findOne({
                email: email
            })
     
            if (user != null) {
                result.json({
                    status: "error",
                    message: "Email already exists."
                })

                return
            }

            const salt = bcryptjs.genSaltSync(10)
            const hash = await bcryptjs.hashSync(password, salt)

            const minimum = 0
            const maximum = 999999
            const verificationToken = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
            
            // insert in database
            await db.collection("users").insertOne({
                name: name,
                email: email,
                password: hash,
                profileImage: {},
                accessToken: "",
                verificationToken: verificationToken,
                isVerified: true,
                reviews: 0,
                createdAt: createdAt
            })
 
            result.json({
                status: "success",
                message: "Your account has been registered."
            })
        })

        app.get("/change-password", function (request, result) {
            result.render("change-password", {
                mainURL: mainURL
            })
        })

        app.get("/profile", function (request, result) {
            result.render("profile", {
                mainURL: mainURL
            })
        })

        app.get("/profile", function (request, result) {
            result.render("profile", {
                mainURL: mainURL
            })
        })

        app.get("/register", function (request, result) {
            result.render("register", {
                mainURL: mainURL
            })
        })

        app.get("/login", function (request, result) {
            result.render("login", {
                mainURL: mainURL
            })
        })

        app.get("/categories/:title?", async function (request, result) {
            const title = request.params.title || ""
            const html = await ejs.renderFile("views/category.ejs", {
                mainURL: mainURL,
                globals: globals,
                title: title
            }, {
                async: true
            })
            result.send(html)
        })

        app.get("/", async function (request, result) {

            const reviews = await db.collection("reviews")
                .find({})
                .sort({
                    createdAt: -1
                })
                .skip(0)
                .limit(12)
                .toArray()

            const html = await ejs.renderFile("views/index.ejs", {
                mainURL: mainURL,
                globals: globals,
                reviews: reviews
            }, {
                async: true
            })
            result.send(html)
        })

        // app._router.stack.forEach(function(r){
        //     if (r.route){
        //         console.log({
        //             path: r.route.path,
        //             method: r.route.methods.post ? "POST" : "GET"
        //         })
        //     }
        // })
    })
 
})