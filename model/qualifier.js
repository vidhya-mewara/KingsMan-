import mongoose from "mongoose";

const qualifierSchema = new mongoose.Schema(
    {
        event: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },

        teamName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },

        position: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: ["qualified", "eliminated", "pending"],
            default: "pending",
        },
    },
    { timestamps: true }
);

qualifierSchema.index({ event: 1, position: 1 });

const Qualifier = mongoose.model("Qualifier", qualifierSchema);

export default Qualifier;