import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        logo: {
            type: String,
            required: true
        },

        startDate: {
            type: Date,
            required: true
        },

        endDate: {
            type: Date,
            required: true
        },

        prizeAmount: {
            type: Number,
            default: 0,
            min: 0
        },

        mode: {
            type: String,
            enum: ["online", "offline"],
            required: true
        },

        status: {
            type: String,
            enum: ["upcoming", "ongoing", "completed"],
            default: "upcoming"
        }
    },
    {
        timestamps: true
    }
);

const Event = mongoose.model("Event", eventSchema);

export default Event;