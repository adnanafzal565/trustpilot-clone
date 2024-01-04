const ReviewComponent = {
    template: `<div class="card card-body" style="padding-left: 0px; margin-top: 10px;">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-1">
                    <img v-bind:src="mainURL + '/userProfileImage/' + review.user._id"
                        style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;" />
                </div>

                <div class="col-md-11">
                    <p style="margin-bottom: 0px; font-weight: bold;" v-text="review.user.name"></p>
                    <p style="color: gray;">
                        <span v-text="review.user.reviews"></span> reviews

                        <span style="margin-left: 10px;">
                            <i class="fa fa-map-marker"></i>&nbsp;
                            <span v-text="review.user.location"></span>
                        </span>
                    </p>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <hr style="background-color: #b7b7b7;" />

                    <div class="stars">
                        <i v-for="i in 5" v-bind:class="'fa fa-star star ' + (i > review.ratings ? 'initial' : getStarColor(review.ratings))"
                            style="font-size: 16px;"></i>
                    </div>

                    <h3 v-text="review.title"></h3>
                    <p v-text="review.review"></p>
                    <p>
                        <b>Date of experience: </b>
                        <span v-text="new Date(review.createdAt + ' UTC')"></span>
                    </p>

                    <template v-if="user != null && review.user._id.toString() == user._id.toString()">
                        <hr style="background-color: #b7b7b7;" />

                        <button type="button" id="btn-delete" v-on:click="deleteReview">
                            <i class="fa fa-trash"></i>
                            <span>Delete</span>
                        </button>
                    </template>
                </div>
            </div>
        </div>
    </div>`,

    props: {
        review: Object
    },

    data() {
        return {
            mainURL: "",
            getStarColor: getStarColor,
            user: null
        }
    }
}

function onmouseenterStar(star) {
    try {
        const nodes = document.querySelectorAll(".rating-stars")
        for (let a = 0; a < nodes.length; a++) {
            let element = nodes[a].children[0]
            element.className = "fa fa-star star"
        }
        for (let a = 1; a <= star; a++) {
            let color = getStarColor(star)
            if (a > star) {
                color = "initial"
            }

            let element = nodes[a - 1].children[0]
            element.className = "fa fa-star star " + color
        }
    } catch (exp) {
        console.log(exp)
    }
}

function relativeReview(stars) {
    if (stars >= 5) {
        return "Excellent"
    }
    if (stars >= 4) {
        return "Great"
    }
    if (stars >= 3) {
        return "Average"
    }
    if (stars >= 2) {
        return "Poor"
    }
    if (stars >= 1) {
        return "Bad"
    }
    return ""
}

function getStarColor(stars) {
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
}