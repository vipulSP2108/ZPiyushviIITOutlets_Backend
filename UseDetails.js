const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    contactinfo: {type: String, required: true}, 
    phone: { type: String },
    password: { type: String, required: true },
    role: { type: String, required: true },
    otp: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, required: true },
    DeviceFCM: { type: String },
    DeviceEXPO: { type: String }
});
// userSchema.index({ contactinfo: 1, role: 1 }, { unique: true });

mongoose.model("UserInfo", userSchema);