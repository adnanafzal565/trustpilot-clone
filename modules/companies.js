const express = require("express")
const auth = require("./auth")
const globals = require("./globals")
// const jsdom = require("jsdom")
const urlMetadata = require("url-metadata")
const Nightmare = require("nightmare")
const fs = require("fs")
const { ObjectId } = require("mongodb")
const jwt = require("jsonwebtoken")

module.exports =  {
    async hasReviewed(user, domain) {
        return new Promise(async function (callback) {
            const alreadyReviewed = await db.collection("reviews")
                .findOne({
                    $and: [{
                        "user._id": user._id
                    }, {
                        "company.domain": domain
                    }]
                })
            callback(alreadyReviewed != null)
        })
    },

    async addCompany(domain) {

        return new Promise(async function (callback) {
            let domainWithServer = globals.prependHttp(domain)
            let title = ""
            let description = ""
            let keywords = ""
            let author = ""
            let favicons = []
            try {
                const metadata = await urlMetadata(domainWithServer)
                title = metadata["title"] || ""
                description = metadata["description"] || ""
                keywords = metadata["keywords"] || ""
                author = metadata["author"] || ""
                favicons = metadata.favicons || []
            } catch (exp) {
                // 
            }
            
            const faviconsArr = []
            for (let a = 0; a < favicons.length; a++) {
                faviconsArr.push(favicons[a].href)
            }

            const possibleCategories = []
            const categories = globals.categories
            for (let a = 0; a < categories.length; a++) {
                for (let b = 0; b < categories[a].keywords.length; b++) {
                    const lcKeyword = categories[a].keywords[b].toLowerCase()
                    if (title.toLowerCase().includes(lcKeyword)
                        || description.toLowerCase().includes(lcKeyword)
                        || keywords.toLowerCase().includes(lcKeyword)) {
                        possibleCategories.push(categories[a].title)
                        break
                    }
                }
            }

            const screenshot = "uploads/screenshots/" + (new Date().getTime()) + "-" + domain + ".png"
            const companyObj = {
                domain: domain,
                title: title,
                description: description,
                keywords: keywords,
                author: author,
                favicons: faviconsArr,
                screenshot: screenshot,
                categories: possibleCategories,
                ratings: 0,
                reviews: 0,
                isClaimed: false,
                createdAt: new Date().toUTCString(),
                updatedAt: new Date().toUTCString()
            }

            const nightmare = Nightmare({
                show: false,
                width: 1920,
                height: 2000,
                gotoTimeout: 10000000
            })
                
            nightmare
                .goto(domainWithServer)
                .screenshot(screenshot)
                .end()
                .then(async function () {
                    console.log("Captured: " + domainWithServer)

                    await db.collection("companies")
                        .insertOne(companyObj)

                    callback(companyObj)
                })
                .catch(async function (error) {
                    console.log("screenshot failed:", error)

                    companyObj.screenshot = ""
                    await db.collection("companies")
                        .insertOne(companyObj)

                    callback(companyObj)
                })

            // const response = await fetch(domainWithServer);
            // if (response.ok) {
            //     // Convert the HTML string into a document object
            //     const html = response.text()
            //     const dom = new jsdom.JSDOM(html)
            //     const p = dom.window.document.querySelector('p').textContent
            //     console.log(p) 
            // }
        })

    },

    init(app) {
        const self = this
        const router = express.Router()

        router.post("/fetchByCategory", async function (request, result) {
            const category = request.fields.category || ""
            /*if (!category) {
                result.json({
                    status: "error",
                    message: "Category field is required."
                })
                return
            }*/
            let filter = {}
            if (category) {
                filter = {
                    categories: category
                }
            }

            // number of records you want to show per page
            const perPage = 10
         
            // total number of records from database
            // const total = await db.collection("companies").count()
         
            // Calculating number of pagination links required
            // const pages = Math.ceil(total / perPage)
         
            // get current page number
            const pageNumber = (request.query.page == null) ? 1 : request.query.page
         
            // get records to skip
            const startFrom = (pageNumber - 1) * perPage

            let companies = await db.collection("companies")
                .find(filter)
                .sort({
                    ratings: -1
                })
                .skip(startFrom)
                .limit(perPage)
                .toArray()

            for (let a = 0; a < companies.length; a++) {
                companies[a].screenshot = mainURL + "/" + companies[a].screenshot
                companies[a].starColor = globals.getStarColor(companies[a].ratings)
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                companies: companies
            })
            return
        })

        router.get("/fetch-image/:_id", async function (request, result) {
            const _id = request.params._id

            var fileData = await fs.readFileSync("public/img/placeholder-image.png")
            var buffer = Buffer.from(fileData, "base64")

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
            }

            const company = await db.collection("companies")
                .findOne({
                    $or: filter
                })

            if (company != null && company.screenshot) {

                /*const files = await bucket
                    .find({
                        filename: user.profileImage
                    })
                    .toArray()
             
                if (!files || files.length === 0) {
                    result.writeHead(200, {
                        "Content-Type": "image/png",
                        "Content-Length": buffer.length
                    })

                    result.end(buffer)
                    return
                }
             
                bucket.openDownloadStreamByName(user.profileImage).pipe(result)
                return*/

                const fileData = await fs.readFileSync(company.screenshot)
                const buffer = Buffer.from(fileData, "base64")
                result.writeHead(200, {
                    "Content-Type": "image/png",
                    "Content-Length": buffer.length
                })

                result.end(buffer)
                return

                /*let base64 = user.profileImage.buffer

                result.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': base64.length
                })
                result.end(base64)
                return*/
            }

            result.writeHead(200, {
                "Content-Type": "image/png",
                "Content-Length": buffer.length
            })

            result.end(buffer)
            return
        })

        router.post("/reviews", async function (request, result) {
            const domain = request.fields.domain || ""
            const perPage = 10
            const page = request.fields.page || 1

            if (page <= 0) {
                result.json({
                    status: "error",
                    message: "'page' must be an un-signed integer."
                })
                return
            }

            const reviews = await db.collection("reviews")
                .find({
                    "company.domain": domain
                })
                .limit(perPage)
                .skip((page - 1) * perPage)
                .sort({
                    createdAt: -1
                })
                .toArray()

            result.json({
                status: "success",
                message: "Data has been fetched.",
                reviews: reviews
            })
            return
        })

        router.post("/fetch", async function (request, result) {
            const domain = request.fields.domain

            if (!domain) {
                result.json({
                    status: "error",
                    message: "'domain' field is required."
                })
                return
            }

            const company = await db.collection("companies")
                .findOne({
                    domain: domain
                })

            if (company == null) {
                result.json({
                    status: "error",
                    message: "Company not found."
                })
                return
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                company: company
            })
            return
        })

        router.post("/deleteReview", auth, async function (request, result) {
            const user = request.user
            const _id = request.fields._id ?? ""
            if (!_id) {
                result.json({
                    status: "error",
                    message: "ID field is required."
                })
                return
            }

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "Invalid ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    $and: [{
                        _id: ObjectId(_id)
                    }, {
                        "user._id": user._id
                    }]
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            await db.collection("reviews")
                .deleteOne({
                    _id: review._id
                })

            db.collection("reviews")
                .aggregate([
                    {
                        $match: {
                            "company._id": review.company._id
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            ratings: {
                                $sum: "$ratings"
                            }
                        }
                    }
                ]).toArray(function (error, reviewsArr) {
                    let totalRatings = 0
                    for (let a = 0; a < reviewsArr.length; a++) {
                        totalRatings += reviewsArr[a].ratings
                    }

                    db.collection("reviews")
                        .countDocuments({
                            "company._id": review.company._id
                        }, function (error, totalReviews) {
                            db.collection("companies")
                                .findOneAndUpdate({
                                    _id: review.company._id
                                }, {
                                    $set: {
                                        ratings: Math.abs((totalRatings / totalReviews).toFixed(2)),
                                        updatedAt: new Date().toUTCString()
                                    },

                                    $inc: {
                                        reviews: -1
                                    }
                                })
                        })
                })

            db.collection("users")
                .findOneAndUpdate({
                    _id: user._id
                }, {
                    $inc: {
                        reviews: -1
                    }
                })

            db.collection("reviews")
                .updateMany({
                    $and: [{
                        "user._id": user._id
                    }, {
                        _id: {
                            $ne: review._id
                        }
                    }]
                }, {
                    $inc: {
                        "user.reviews": -1
                    }
                })

            result.json({
                status: "success",
                message: "Review has been deleted."
            })
        })

        router.post("/review", auth, async function (request, result) {
            const user = request.user
            const domain = request.fields.domain
            const ratings = request.fields.ratings
            const title = request.fields.title
            const review = request.fields.review
            const files = request.files.files

            if (!domain || !ratings || !title || !review) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            if (ratings < 1 || ratings > 5) {
                result.json({
                    status: "error",
                    message: "Ratings must be in-between 1 and 5."
                })
                return
            }

            const alreadyReviewed = await self.hasReviewed(user, domain)
            if (alreadyReviewed) {
                result.json({
                    status: "error",
                    message: "You have already gave your reviews about this company."
                })
                return
            }

            try {
                const filesArr = []

                /*if (ratings < 3) {
                    if (Array.isArray(files)) {
                        for (let a = 0; a < files.length; a++) {
                            const tempType = files[a].type.toLowerCase()
                            if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg") || tempType.includes("pdf") || files[a].size > 0) {
                                filesArr.push(files[a])
                            }
                        }
                    } else {
                        const tempType = files.type.toLowerCase()
                        if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg") || tempType.includes("pdf") || files[a].size > 0) {
                            filesArr.push(files)
                        }
                    }

                    if (filesArr.length == 0) {
                        result.json({
                            status: "error",
                            message: "Please select file (JPEG, PNG or PDF) as a proof."
                        })
                        return
                    }
                }*/

                const company = await db.collection("companies")
                    .findOne({
                        domain: domain
                    })

                let companyObj = company
                if (company == null) {
                    companyObj = await self.addCompany(domain)
                }

                const proofs = []
                for (let a = 0; a < filesArr.length; a++) {
                    const fileData = await fs.readFileSync(filesArr[a].path)
                    const fileLocation = "uploads/reviews/" + (new Date().getTime()) + "-" + filesArr[a].name
                    await fs.writeFileSync(fileLocation, fileData)
                    await fs.unlinkSync(filesArr[a].path)
                    proofs.push(fileLocation)
                }

                const reviewObj = {
                    company: {
                        _id: companyObj._id,
                        domain: domain,
                        title: companyObj.title
                    },
                    user: {
                        _id: user._id,
                        name: user.name,
                        reviews: ++user.reviews,
                        location: user.location?.countryCode ?? ""
                    },
                    ratings: Math.abs(ratings),
                    title: title,
                    review: review,
                    proofs: proofs,
                    replies: [],
                    createdAt: new Date().toUTCString(),
                    updatedAt: new Date().toUTCString()
                }
                await db.collection("reviews")
                    .insertOne(reviewObj)

                db.collection("reviews")
                    .aggregate([
                        {
                            $match: {
                                "company._id": companyObj._id
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                ratings: {
                                    $sum: "$ratings"
                                }
                            }
                        }
                    ]).toArray(function (error, reviewsArr) {
                        let totalRatings = 0
                        for (let a = 0; a < reviewsArr.length; a++) {
                            totalRatings += reviewsArr[a].ratings
                        }

                        db.collection("reviews")
                            .countDocuments({
                                "company._id": companyObj._id
                            }, function (error, totalReviews) {
                                db.collection("companies")
                                    .findOneAndUpdate({
                                        _id: companyObj._id
                                    }, {
                                        $set: {
                                            ratings: Math.abs((totalRatings / totalReviews).toFixed(2)),
                                            updatedAt: new Date().toUTCString()
                                        },

                                        $inc: {
                                            reviews: 1
                                        }
                                    })
                            })
                    })

                db.collection("users")
                    .findOneAndUpdate({
                        _id: user._id
                    }, {
                        $inc: {
                            reviews: 1
                        }
                    })

                db.collection("reviews")
                    .updateMany({
                        $and: [{
                            "user._id": user._id
                        }, {
                            _id: {
                                $ne: reviewObj["_id"]
                            }
                        }]
                    }, {
                        $set: {
                            "user.location": user.location?.countryCode ?? ""
                        },

                        $inc: {
                            "user.reviews": 1
                        }
                    })

                result.json({
                    status: "success",
                    message: "Review has been posted.",
                    review: reviewObj
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        router.post("/search", async function (request, result) {
            const query = request.fields.query

            if (!query) {
                result.json({
                    status: "error",
                    message: "'query' field is required."
                })
                return
            }

            try {
                const companies = await db.collection("companies")
                    .find({
                        $or: [{
                            domain: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            title: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            description: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            keywords: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            author: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }]
                    })
                    .sort({
                        updatedAt: -1
                    })
                    .toArray()

                for (let a = 0; a < companies.length; a++) {
                    companies[a].screenshot = mainURL + "/" + companies[a].screenshot
                    companies[a].starColor = globals.getStarColor(companies[a].ratings)
                    // companies[a].domainWithServer = globals.prependHttp(companies[a].domain)
                }

                result.json({
                    status: "success",
                    message: "Data has been fetched.",
                    companies: companies
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        router.post("/find", async function (request, result) {
            const domain = request.fields.domain
            let user = null
            try {
                const accessToken = request.headers.authorization.split(" ")[1]
                const decoded = jwt.verify(accessToken, jwtSecret)
                const userId = decoded.userId
         
                user = await db.collection("users").findOne({
                    accessToken: accessToken
                })
            } catch (exp) {
                // console.log(exp)
            }

            if (!domain) {
                result.json({
                    status: "error",
                    message: "'domain' field is required."
                })
                return
            }

            try {
                const company = await db.collection("companies")
                    .findOne({
                        domain: domain
                    })

                let companyObj = company
                if (company == null) {
                    companyObj = await self.addCompany(domain)
                }

                companyObj.screenshot = mainURL + "/" + companyObj.screenshot
                companyObj.domainWithServer = globals.prependHttp(companyObj.domain)
                companyObj.starColor = globals.getStarColor(companyObj.ratings)

                const perPage = 10
                const page = request.fields.page || 1

                if (page <= 0) {
                    result.json({
                        status: "error",
                        message: "'page' must be an un-signed integer."
                    })
                    return
                }

                const reviews = await db.collection("reviews")
                    .find({
                        "company._id": companyObj._id
                    })
                    .limit(perPage)
                    .skip((page - 1) * perPage)
                    .sort({
                        createdAt: -1
                    })
                    .toArray()

                let hasReviewed = false
                if (user != null) {
                    hasReviewed = await self.hasReviewed(user, companyObj.domain)
                }

                result.json({
                    status: "success",
                    message: "Data has been fetched.",
                    company: companyObj,
                    reviews: reviews,
                    hasReviewed: hasReviewed
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        app.use("/companies", router)
    }
}