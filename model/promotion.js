import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            default: "",
            trim: true
        },

        image: {
            type: String,
            required: true
        },

        websiteLink: {
            type: String,
            default: ""
        },

        youtubeLink: {
            type: String,
            default: ""
        },

        instagramLink: {
            type: String,
            default: ""
        },

        discordLink: {
            type: String,
            default: ""
        },

        active: {
            type: Boolean,
            default: true
        },

        position: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;