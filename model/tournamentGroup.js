import mongoose from "mongoose";

const tournamentGroupSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30,
        },
    },
    { timestamps: true }
);

tournamentGroupSchema.index({ event: 1 });

const TournamentGroup = mongoose.model(
    "TournamentGroup",
    tournamentGroupSchema
);

export default TournamentGroup;