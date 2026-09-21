import mongoose from "mongoose";

const matchSchema = new mongoose.Schema(
    {
        // Example: "KingsMan Invitational - Semi Final"
        seriesName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        // Team names
        teamA: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50
        },

        teamB: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50
        },

        // Match score
        teamAScore: {
            type: Number,
            default: 0,
            min: 0
        },

        teamBScore: {
            type: Number,
            default: 0,
            min: 0
        },

        // Match date/time
        date: {
            type: Date,
            required: true
        },

        // Used for homepage tabs
        status: {
            type: String,
            enum: ["ongoing", "upcoming", "past"],
            required: true,
            default: "upcoming"
        },

        // Player statistics
        players: [
            {
                player: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Player",
                    required: true
                },

                team: {
                    type: String,
                    enum: ["teamA", "teamB"],
                    required: true
                },

                kills: {
                    type: Number,
                    default: 0,
                    min: 0
                },

                deaths: {
                    type: Number,
                    default: 0,
                    min: 0
                },

                assists: {
                    type: Number,
                    default: 0,
                    min: 0
                },

                mvp: {
                    type: Boolean,
                    default: false
                }
            }
        ]
    },
    {
        timestamps: true
    }
);

const Match = mongoose.model("Match", matchSchema);

export default Match;