const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contactinfo: {type: String, required: true}, 
    // contactinfo: { type: String, required: true, unique: false },
    password: { type: String, required: true },
    role: { type: String, required: true },
    otp: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, required: true },
});
// userSchema.index({ contactinfo: 1, role: 1 }, { unique: true });

mongoose.model("UserInfo", userSchema);
