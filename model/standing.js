import mongoose from "mongoose";

const standingSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },

        group: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "TournamentGroup",
            default: null,
        },

        teamName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },

        position: {
            type: Number,
            required: true,
            min: 1,
        },

        played: {
            type: Number,
            default: 0,
            min: 0,
        },

        wins: {
            type: Number,
            default: 0,
            min: 0,
        },

        losses: {
            type: Number,
            default: 0,
            min: 0,
        },

        draws: {
            type: Number,
            default: 0,
            min: 0,
        },

        points: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true }
);

standingSchema.index({ event: 1, group: 1, position: 1 });

const Standing = mongoose.model("Standing", standingSchema);

export default Standing;