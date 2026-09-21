import mongoose from "mongoose";

const promotionSchema = new mongoose.Schema(
    {
        image: {
            type: String,
            required: true
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
        }
    },
    {
        timestamps: true
    }
);

const Promotion = mongoose.model("Promotion", promotionSchema);

export default Promotion;