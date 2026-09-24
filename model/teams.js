import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
    {
        // ================================
        // BASIC TEAM INFORMATION
        // ================================

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },

        tag: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
            maxlength: 10,
        },

        logo: {
            type: String,
            trim: true,
            default: "",
        },

        // ================================
        // TEAM PLAYERS
        // ================================

        players: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Player",
            },
        ],

        // ================================
        // TEAM LEADERSHIP
        // ================================

        captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            default: null,
        },

        coach: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            default: null,
        },

        // ================================
        // TEAM STATUS
        // ================================

        status: {
            type: String,
            enum: [
                "active",
                "inactive",
                "eliminated",
                "disqualified",
            ],
            default: "active",
        },

        // ================================
        // TEAM INFORMATION
        // ================================

        country: {
            type: String,
            trim: true,
            default: "",
        },

        region: {
            type: String,
            trim: true,
            default: "",
        },

        description: {
            type: String,
            trim: true,
            maxlength: 500,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

// ================================
// INDEXES
// ================================

// Team name lookup
teamSchema.index({
    name: 1,
});

// Team tag lookup
teamSchema.index({
    tag: 1,
});

// Common team filtering
teamSchema.index({
    status: 1,
    region: 1,
});

// ================================
// MODEL
// ================================

const Team = mongoose.model("Team", teamSchema);

export default Team;