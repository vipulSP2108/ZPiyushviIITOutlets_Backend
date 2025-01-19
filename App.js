// npx nodemon app
// npx expo start

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Expo } = require('expo-server-sdk');

const PORT = process.env.PORT || 5001;
const { v4: uuidv4 } = require('uuid'); // For unique OTP generation
const nodemailer = require('nodemailer'); // For sending OTP via email

const app = express();
app.use(express.json());

const expo = new Expo()

const jwtSecret = "aasjldjdspu29073ekjwhd2u8-u[uuwpiqwhdhuoy1028dhw";
const mongoUrl = "mongodb+srv://vipulpatil:e1UzKh7o5ewlOQ7U@cluster0.drh80rq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(process.env.MONGO_URL || mongoUrl).then(() => {
    console.log("Database Connected");
}).catch((err) => {
    console.log("error", err);
});

require('./UseDetails');
const User = mongoose.model("UserInfo");

require('./Schema/Outlets');
const OutletInfo = mongoose.model("OutletInfo");

require('./Schema/Order');
const OrderInfo = mongoose.model("OrderInfo");

require('./Schema/OrderHistory');
const OrderHistoryInfo = mongoose.model("OrderHistoryInfo");

app.get("/", (req, res) => {
    res.send({ status: "started" });
});

const token = 'ExponentPushToken[uEcEo1LhkSBZCOfnm2cOG8]';

app.post('/sample', async (_, res) => {
    expo.sendPushNotificationsAsync([
        {
            to: token,
            title: "Soil Water Level too Low!",
            body: "Water your plant",
            sound: "./assets/sounds/notification.mp3",
        },
    ]);
    res.status(200).send("success");
});



// ----------------------------- storetoken ----------------------------- //
app.post("/storetoken", async (req, res) => {
    const { contactinfo, storetokenFCM, storetokenEXPO } = req.body;
    // console.log('contactinfo', contactinfo, storetokenFCM)

    if (!contactinfo || !storetokenFCM || !storetokenEXPO) {
        return res.status(400).send({ status: "error", data: "Contact info and storetokenFCM are required" });
    }

    try {
        const oldUser = await User.findOne({ contactinfo: contactinfo });
        if (!oldUser) {
            return res.status(400).send({ status: "error", data: "User not exist" });
        }

        oldUser.DeviceFCM = storetokenFCM;
        oldUser.DeviceEXPO = storetokenEXPO
        await oldUser.save();

        res.status(200).send({ status: "ok", data: 'stored token' });

    } catch (err) {
        console.log(err)
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- Otp ----------------------------- //

// Email setup for OTP (example using nodemailer)
let transporter = nodemailer.createTransport({
    secure: true,
    host: 'smtp.gmail.com',
    // sendmail: true,
    // newline: 'unix',
    path: 465, // '/usr/sbin/sendmail'
    auth: {
        user: 'vipulapatil21@gmail.com',
        pass: 'sznr ksdc eltm oyyf'
    }
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000)
function generateOtpAndExpiry() {
    const otp = generateOTP(); // Use your preferred OTP generation method
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000).toString(); // 5 minutes in milliseconds
    return { otp, otpExpiry };
}


// ----------------------------- register ----------------------------- //

app.post("/register", async (req, res) => {
    const { name, contactinfo, phone, password, role } = req.body;

    if (!name || !contactinfo || !password || !role || !phone) {
        return res.status(400).send({ status: "error", data: "All fields are required" });
    }

    try {
        const oldUser = await User.findOne({ contactinfo, role });
        if (oldUser) {
            return res.status(400).send({ status: "error", data: "User with this contact info and role already exists" });
        }

        const { otp, otpExpiry } = generateOtpAndExpiry();
        const encryptedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name,
            contactinfo,
            password: encryptedPassword,
            role,
            phone,
            otp,
            otpExpiry,
            isVerified: false,
        });

        await user.save();

        transporter.sendMail({
            to: contactinfo,
            subject: 'Your OTP Code',
            html: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        });

        res.status(201).send({ status: "ok", data: "OTP sent to your contact info" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- Verify OTP -----------------------------  //
app.post("/verifyotp", async (req, res) => {
    const { contactinfo, otp } = req.body;

    try {
        const user = await User.findOne({ contactinfo });
        if (!user) {
            return res.status(400).send({ status: "error", data: "User not found" });
        }

        if (user.otpExpiry < Date.now()) {
            return res.status(400).send({ status: "error", data: "OTP expired" });
        }

        if (user.otp !== otp) {
            return res.status(400).send({ status: "error", data: "OTP InCorrect" });
        }

        // Clear OTP and activate the user
        user.otp = null;
        user.otpExpiry = null;
        user.isVerified = true;
        await user.save();

        res.status(200).send({ status: "ok", data: "OTP verified, user registered" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- Resend OTP ----------------------------- //
app.post("/resendotp", async (req, res) => {
    const { contactinfo } = req.body;

    try {
        const user = await User.findOne({ contactinfo });

        if (!user) {
            return res.status(400).send({ status: "error", data: "User not found" });
        }

        if (user.isVerified) {
            return res.status(400).send({ status: "error", data: "User already verified" });
        }

        // Check if OTP expiry is within a reasonable timeframe (e.g., 1 minute)
        const now = new Date();
        const otpExpiryDate = new Date(user.otpExpiry);
        const isRecent = now - otpExpiryDate < 60 * 1000; // 1 minute in milliseconds

        if (isRecent) {
            return res.status(429).send({ status: "error", data: "OTP resend limit reached. Try again later." });
        }

        const { otp, otpExpiry } = generateOtpAndExpiry();

        user.otp = otp;
        user.otpExpiry = otpExpiry;
        await user.save();

        transporter.sendMail({
            to: contactinfo,
            subject: 'Your OTP Code',
            html: `Your OTP is ${otp}. It is valid for 5 minutes.`,
        });

        res.status(200).send({ status: "ok", data: "OTP sent to your contact info" });
    } catch (error) {
        console.error(error);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- login ----------------------------- //
app.post("/login", async (req, res) => {
    const { contactinfo, password, role } = req.body;
    if (!contactinfo || !password || !role) {
        return res.status(400).send({ status: "error", data: "Contact info, role and password are required" });
    }

    try {
        const oldUser = await User.findOne({ contactinfo: contactinfo });
        if (!oldUser) {
            return res.status(400).send({ status: "error", data: "User not exist" });
        }

        if (oldUser.role !== role) {
            return res.status(400).send({ status: "error", data: `Incorrect role. The appropriate role is ${oldUser.role}` });
        }

        if (oldUser.isVerified == false) {
            return res.status(400).send({ status: "notVerified", data: "Not Verified" });
        }

        const isPasswordMatch = await bcrypt.compare(password, oldUser.password);
        if (isPasswordMatch) {
            const token = jwt.sign({ contactinfo: oldUser.contactinfo }, jwtSecret, { expiresIn: '365d' });
            res.status(200).send({ status: "ok", data: token });
        } else {
            res.status(400).send({ status: "error", data: "Invalid credentials" });
        }
    } catch (err) {
        console.log(err)
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- user_getdata ----------------------------- //
app.post('/userdata', async (req, res) => {
    const { token } = req.body;
    try {
        const user = jwt.verify(token, jwtSecret, (err, res) => {
            if (err) {
                return 'token expired'
            }
            return res;
        });
        if (user == 'token expired') {
            return res.send({ status: "error", data: 'token expired' });
        }

        const usercontactinfo = user.contactinfo;
        User.findOne({ contactinfo: usercontactinfo }).then((data) => {
            return res.send({ status: "ok", data: data });
        })
    } catch (err) {
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
})

// ----------------------------- outletseller ----------------------------- //
app.post('/addoutlet', async (req, res) => {
    const {
        id, name, shopkeeperName, upiId, image, details, token, location, type, featured,
        openingTime,
        closingTime,
        leaveDay,
        offDays,
        menuType,
        menu,
    } = req.body;

    if (!name || !shopkeeperName || !upiId || !token || !details || !image || !location || !type || featured === undefined
        || !openingTime || !closingTime || !offDays || !menuType
    ) {
        return res.status(400).send({ status: "error", data: "All fields are required" });
    }

    try {
        const user = jwt.verify(token, jwtSecret);
        const userId = user.contactinfo;

        const getPhone = async () => {
            const user = await User.findOne({ contactinfo: userId });
            return user ? user.phone : null;
        };

        const phone = await getPhone(); 

        let outlet;
        if (id) {
            outlet = await OutletInfo.findOneAndUpdate({ id, userId }, {
                name, shopkeeperName, upiId, details, image, location, type,
                openingTime, closingTime, leaveDay, featured, offDays, menuType, phone
            }, { new: true });
            if (!outlet) {
                return res.status(404).send({ status: "error", data: "Outlet not found" });
            }
        } else {
            // No user with more than 1 store 
            // const oldoutlet = await OutletInfo.findOne({ userId: userId });
            // if (oldoutlet) {
            //     return res.status(400).send({ status: "error", data: "User with this contact info oldoutlet already exists" });
            // }

            outlet = new OutletInfo({
                id: Date.now().toString(),
                rating: 3,
                ratingcount: 7,
                name, shopkeeperName, upiId, details, image, location, type,
                openingTime, closingTime, leaveDay, featured, offDays, userId, menuType, phone
            });
            await outlet.save();
        }

        res.status(201).send({ status: "ok", data: "Outlet saved successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- menu seller ----------------------------- //
app.post('/addmenu', async (req, res) => {
    const { menu, token } = req.body;

    if (!menu || !token) {
        return res.status(400).send({ status: "error", data: "All fields are required" });
    }

    try {
        const user = jwt.verify(token, jwtSecret);
        const userId = user.contactinfo;

        let outlet = await OutletInfo.findOne({ userId });
        if (!outlet) {
            return res.status(404).send({ status: "error", data: "Outlet not found" });
        }

        outlet = await OutletInfo.findOneAndUpdate({ userId }, {
            menu,
            // rating: 3,
            // ratingcount: 7,
        }, { new: true });

        await outlet.save();

        res.status(201).send({ status: "ok", data: "Menu saved successfully" });
    } catch (err) {
        console.error("Error saving menu:", err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- user menu ----------------------------- //
app.post('/usermenu', async (req, res) => {
    const { token } = req.body;

    try {
        const user = jwt.verify(token, jwtSecret);
        const usercontactinfo = user.contactinfo;

        const outlets = await OutletInfo.find({ usercontactinfo });

        res.status(200).send({ status: "ok", data: outlets });

    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- user outlets ----------------------------- //
app.post('/useroutlets', async (req, res) => {
    const { token } = req.body;

    try {
        const user = jwt.verify(token, jwtSecret);
        const usercontactinfo = user.contactinfo;

        const outlets = await OutletInfo.find({ userId: usercontactinfo });

        res.status(200).send({ status: "ok", data: outlets });

    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- outlet owner user order history ----------------------------- //
app.post('/orderhistorydata', async (req, res) => {
    const { token } = req.body;

    try {
        const user = jwt.verify(token, jwtSecret);
        const usercontactinfo = user.contactinfo;

        const outlets = await OrderHistoryInfo.find({ storeInfocontactinfo: usercontactinfo });

        res.status(200).send({ status: "ok", data: outlets });

    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- Get all outlets with full menu ----------------------------- //
app.post('/alloutlets', async (req, res) => {
    try {
        const outlets = await OutletInfo.find({});

        res.status(200).send({ status: "ok", data: outlets });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});


app.get('/alloutlets2', async (req, res) => { // Use GET instead of POST
    try {
        const outlets = await OutletInfo.find({});
        res.status(200).send({ status: 'ok', data: outlets });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: 'error', data: 'Internal server error' });
    }
});

// ----------------------------- Create a new order endpoint ----------------------------- //
app.post('/createorder', async (req, res) => {
    try {
        const { items, totalPrice, name, date, status, massage, id } = req.body;
        let order = await OrderInfo.findOne({ id });
        // console.log(name)

        if (order) {
            // Update existing order
            order.name = name;
            order.items = items;
            order.totalPrice = totalPrice;
            order.date = date;
            order.status = status;
            order.massage = massage;
            
            await order.save();

            res.status(200).send({ status: "ok", data: order });
        } else {
            // Create a new order
            const newOrder = new OrderInfo({
                id,
                name,
                items,
                totalPrice,
                date,
                status,
                massage
            });

            await newOrder.save();

            res.status(201).send({ status: "ok", data: newOrder });
        }

        const outletOwner = await User.findOne({ contactinfo: items.userId });
        if (outletOwner?.DeviceEXPO) {
            const messages = [
                {
                    to: outletOwner.DeviceEXPO,
                    title: "New Order Alert!",
                    body: `You have received a new order worth ${totalPrice}. Please check your dashboard for details.`,
                    sound: 'default',
                    data: { orderStatus: 'new', totalAmount: totalPrice },
                },
            ];
            try {
                const ticketChunk = await expo.sendPushNotificationsAsync(messages);
                // console.log(ticketChunk);
            } catch (error) {
                console.error('Error sending push notification:', error);
            }
        } else {
            console.log('No device token found for outlet owner.');
        }
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// app.post('/createorder', async (req, res) => {
//     try {
//         const { items, totalPrice, name, date,
//             status, massage, id} = req.body;

//         const newOrder = new OrderInfo({
//             id,
//             name,
//             items,
//             totalPrice,
//             date,
//             status,
//             massage
//         });

//         await newOrder.save();

//         res.status(201).send({ status: "ok", data: newOrder });
//     } catch (err) {
//         console.log(err);
//         res.status(500).send({ status: "error", data: "Internal server error" });
//     }
// });

app.post("/getorderbuyer", async (req, res) => {
    const { contactinfo } = req.body;
    if (!contactinfo) {
        return res.status(400).send({ status: "error", data: "Contact info is required" });
    }

    try {
        const orderSeller = await OrderInfo.find({ "name.contactinfo": contactinfo });
        if (orderSeller.length === 0) {
            return res.status(300).send({ status: 'alert', data: "No orders Found" });
        }
        res.status(200).send({ status: 'ok', data: orderSeller });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

app.post("/getorderseller", async (req, res) => {
    const { contactinfo } = req.body;
    if (!contactinfo) {
        return res.status(400).send({ status: "error", data: "Contact info is required" });
    }

    try {
        const orderSeller = await OrderInfo.find({ "items.userId": contactinfo });
        if (orderSeller.length === 0) {
            return res.status(300).send({ status: 'alert', data: "No orders Found" });
        }
        res.status(200).send({ status: 'ok', data: orderSeller });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// ----------------------------- order status endpoint ----------------------------- //


// Accept an Order and Set Timer
app.post('/acceptOrder', async (req, res) => {
    try {
        const { orderId, timer } = req.body;
        const order = await OrderInfo.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).send({ status: "error", data: "Order not found" });
        }

        // Update order status to "Accepted"
        order.status = "Accepted";

        // Set the timer for the order
        order.startTime = new Date();  // Sets the current timestamp
        order.timer = timer;

        // Check if startTime is undefined before saving
        if (!order.startTime) {
            return res.status(400).send({ status: "error", data: "Start time is required." });
        }

        // Save the order
        await order.save();

        res.status(200).send({ status: "ok", data: order });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// Decline an Order
app.post('/declineOrder', async (req, res) => {
    try {
        const { orderId } = req.body;

        // Find the order by ID
        const order = await OrderInfo.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).send({ status: "error", data: "Order not found" });
        }

        // Update order status to "Declined"
        order.status = "Declined";
        await order.save();

        const orderHistoryData = {
            _idssss: order._id,
            id: order.id,
            massage: order.massage,
            status: order.status,
            date: order.date,
            totalPrice: order.totalPrice,
            userInfocontactinfo: order.name.contactinfo,
            storeInfocontactinfo: order.items.userId,
            orders: order.items.orders.map(item => ({
                id: item.id,
                name: item.item,
                price: item.price,
                type: item.type,
                category: item.category,
                image: item.image,
                rating: item.rating,
                ratingcount: item.ratingcount,
                _id: item._id,
                quantity: item.quantity
            })),
        };

        const existingOrderHistory = await OrderHistoryInfo.findOne({ storeInfocontactinfo: order.items.userId });

        if (existingOrderHistory) {
            existingOrderHistory.orderDetails.unshift(orderHistoryData);
            await existingOrderHistory.save();
        } else {
            const newOrderHistory = new OrderHistoryInfo({
                storeInfocontactinfo: order.items.userId,
                orderDetails: [orderHistoryData]
            });
            await newOrderHistory.save();
        }

        // Now delete the order if status is "Declined"
        await OrderInfo.deleteOne({ _id: orderId });

        res.status(200).send({ status: "ok", data: "Order declined and deleted" });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});

// app.post('/changeOrderStatus', async (req, res) => {
//     try {
//         // const { orderId, newStatus } = req.body;
//         const { orderId, newStatus, issue } = req.body;

//         // Find the order by ID
//         const order = await OrderInfo.findOne({ _id: orderId });
//         console.log(order)

//         if (!order) {
//             return res.status(404).send({ status: "error", data: "Order not found" });
//         }

//         if (issue) {
//             order.issue = issue;
//             await order.save();
//         }

//         // Update order status to "Closed"
//         order.status = newStatus;
//         await order.save();

//         // delete the order if outlet wants only
//         // if (newStatus == "Delivered"){
//         //     await OrderInfo.deleteOne({ _id: orderId });
//         // }

//         // delete the order if both wants
//         if (newStatus == "Received" || newStatus == "Complaint_Registered") {
//             await OrderInfo.deleteOne({ _id: orderId });
//         }
//         // if (newStatus == "Complaint_Registered") {
//         //     await OrderInfo.deleteOne({ _id: orderId });    
//         // }

//         res.status(200).send({ status: "ok", data: "Order closed and deleted" });
//     } catch (err) {
//         console.log(err);
//         res.status(500).send({ status: "error", data: "Internal server error" });
//     }
// });

app.post('/changeOrderStatus', async (req, res) => {
    try {
        const { orderId, newStatus, issue } = req.body;

        const order = await OrderInfo.findOne({ _id: orderId });

        if (!order) {
            return res.status(404).send({ status: "error", data: "Order not found" });
        }

        if (issue) {
            order.issue = issue;
            await order.save();
        }

        // Update the order status
        order.status = newStatus;
        await order.save();

        if (newStatus == "Received" || newStatus == "Complaint_Registered") {
            const orderHistoryData = {
                _idssss: order._id,
                id: order.id,
                massage: order.massage,
                status: newStatus,
                date: order.date,
                totalPrice: order.totalPrice,
                userInfocontactinfo: order.name.contactinfo,
                storeInfocontactinfo: order.items.userId,
                orders: order.items.orders.map(item => ({
                    id: item.id,
                    name: item.item,
                    price: item.price,
                    type: item.type,
                    category: item.category,
                    image: item.image,
                    rating: item.rating,
                    ratingcount: item.ratingcount,
                    _id: item._id,
                    quantity: item.quantity
                })),
                issue: issue || null
            };

            const existingOrderHistory = await OrderHistoryInfo.findOne({ storeInfocontactinfo: order.items.userId });

            if (existingOrderHistory) {
                existingOrderHistory.orderDetails.push(orderHistoryData);
                await existingOrderHistory.save();
            } else {
                const newOrderHistory = new OrderHistoryInfo({
                    storeInfocontactinfo: order.items.userId,
                    orderDetails: [orderHistoryData]
                });
                await newOrderHistory.save();
            }

            await OrderInfo.deleteOne({ _id: orderId });

            res.status(200).send({ status: "ok", data: "Order closed, history saved, and deleted" });
        } else {
            res.status(200).send({ status: "ok", data: "Order status updated" });
        }

    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});














app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});