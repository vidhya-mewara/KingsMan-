import mongoose from 'mongoose';

    const playerSchema = new mongoose.Schema(
        {
            name: {
                type: String,
                required: true,
                trim: true,
                maxlength: 50,
            },

            uid: {
                type: String,
                required: true,
                unique: true,
                trim: true,
            },

            ign: {
                type: String,
                required: true,
                trim: true,
                maxlength: 30,
            },

            role: {
                type: [String],
                required: true,
                enum: [
                    "Duelist",
                    "Initiator",
                    "Controller",
                    "Sentinel",
                    "Flex",
                ],
            },
            agents: {
                type: [String],
                required: true,
                enum: [
                    "Jett",
                    "Raze",
                    "Neon",
                    "Yoru",
                    "Iso",
                    "Phoenix",
                    "Reyna",
                    "Waylay",
                    "Sova",
                    "Fade",
                    "Breach",
                    "K/O",
                    "Tejo",
                    "Gekko",
                    "Skye",
                    "Brimstone",
                    "Omen",
                    "Harbour",
                    "Astra",
                    "Viper",
                    "Clove",
                    "Cypher",
                    "Killjoy",
                    "Chamber",
                    "Vyse",
                    "Deadlock",
                    "Sage"
                ]
            },
            country: {
                type: String,
                required: true,
                trim: true,
            },

            region: {
                type: String,
                required: true,
                trim: true,
            },

            inTeam: {
                type: Boolean,
                default: false,
            },

            teamName: {
                type: String,
                trim: true,
                maxlength: 50,
            },
            socialMedia: {
                instagram: {
                    type: String,
                    trim: true,
                },
                facebook: {
                    type: String,
                    trim: true,
                },
                youtube: {
                    type: String,
                    trim: true,
                },
                twitch: {
                    type: String,
                    trim: true,
                },
                kick: {
                    type: String,
                    trim: true,
                },
            },


            verificationScreenshot: {
                type: String,
                required: true,
            },

            verificationStatus: {
                type: String,
                enum: ["pending", "verified", "unverified"],
                default: "pending",
            },
            owner: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
                unique: true,
            },


        },
        {
            timestamps: true,
        }
    );

// ================================
// INDEXES
// ================================

// UID exact lookup
playerSchema.index({ uid: 1 });
playerSchema.index({ ign: 1 });

// Common filters
playerSchema.index({
    verificationStatus: 1,
    country: 1,
    region: 1,
});

// Role filtering
playerSchema.index({
    role: 1,
    verificationStatus: 1,
});

// Team filtering
playerSchema.index({
    inTeam: 1,
    verificationStatus: 1,
});

// Cursor pagination
playerSchema.index({
    createdAt: -1,
    _id: -1,
});

    const Player = mongoose.model("Player", playerSchema);

    export default Player;
    