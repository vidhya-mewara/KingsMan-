import mongoose from "mongoose";

const playoffSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },

        round: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30,
        },

        matchNumber: {
            type: Number,
            default: 1,
            min: 1,
        },

        teamA: {
            type: String,
            trim: true,
            default: "",
        },

        teamB: {
            type: String,
            trim: true,
            default: "",
        },

        scoreA: {
            type: Number,
            default: 0,
            min: 0,
        },

        scoreB: {
            type: Number,
            default: 0,
            min: 0,
        },

        winner: {
            type: String,
            trim: true,
            default: "",
        },
    },
    { timestamps: true }
);

playoffSchema.index({ event: 1, round: 1, matchNumber: 1 });

const Playoff = mongoose.model("Playoff", playoffSchema);

export default Playoff;