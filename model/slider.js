import mongoose from "mongoose";

const sliderSchema = new mongoose.Schema(
    {
        image: {
            type: String,
            required: true
        },

        tag: {
            type: String,
            default: "KINGSMAN ESPORTS"
        },

        title: {
            type: String,
            required: true
        },

        description: {
            type: String,
            default: ""
        },

        // Event details
        eventDate: {
            type: String,
            default: ""
        },

        eventLocation: {
            type: String,
            default: ""
        },

        eventDescription: {
            type: String,
            default: ""
        },

        eventLink: {
            type: String,
            default: ""
        },

        buttonText: {
            type: String,
            default: ""
        },

        buttonLink: {
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

const Slider = mongoose.model("Slider", sliderSchema);

export default Slider;