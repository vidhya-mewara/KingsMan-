
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
            maxlength: [50, "Name cannot exceed 50 characters"],
        },

        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: [100, "Email cannot exceed 100 characters"],
            match: [
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                "Please enter a valid email address",
            ],
        },

        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [8, "Password must be at least 8 characters"],
        },

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },

        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            default: null,
        },

        // -----------------------------
        // OTP VERIFICATION
        // -----------------------------

        otp: {
            type: String,
            default: null,
        },

        otpExpires: {
            type: Date,
            default: null,
        },

        otpAttempts: {
            type: Number,
            default: 0,
        },

        otpLastSent: {
            type: Date,
            default: null,
        },

        isVerified: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const User = mongoose.model("User", userSchema);

export default User;
