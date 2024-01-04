const nodemailer = require("nodemailer")

// secret JWT key
global.jwtSecret = "jwtSecret1234567890"
global.mainURL = "http://localhost:4000"
global.connectionString = "mongodb://localhost:27017"

module.exports = {

    categories: [
        { title: "Bank", keywords: ["bank", "finance", "money"], icon: "fa fa-bank" },
        { title: "Travel Insurance Company", keywords: ["travel", "insurance"], icon: "fa fa-plane" },
        { title: "Car Dealer", keywords: ["car", "vehicle", "motor"], icon: "fa fa-car" },
        { title: "Furniture Store", keywords: ["furniture", "house"], icon: "fa fa-bed" },
        { title: "Jewelry Store", keywords: ["jewelry"], icon: "fa fa-diamond" },
        { title: "Clothing Store", keywords: ["cloth", "dress", "wear"], icon: "fa fa-shopping-cart" },
        { title: "Electronics & Technology", keywords: ["electronics", "tech", "mobile", "laptop", "gadgets", "programming", "coding", "php", "python", "java"], icon: "fa fa-laptop" },
        { title: "Fitness & Nutrition Centre", keywords: ["fitness", "nutrition", "gym", "exercise"], icon: "fa fa-stethoscope" },
    ],

    getStarColor(stars) {
        let color = "green"
        if (stars == 4) {
            color = "pale-green"
        } else if (stars == 3) {
            color = "yellow"
        } else if (stars == 3) {
            color = "yellow"
        } else if (stars == 2) {
            color = "orange"
        } else if (stars == 1) {
            color = "red"
        }
        return color
    },

    prependHttp (url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        return url;
    }
}