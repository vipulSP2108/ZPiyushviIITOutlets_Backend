// npx nodemon app

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 5001;

const app = express();
app.use(express.json());

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

app.get("/", (req, res) => {
    res.send({ status: "started" });
});

// ----------------------------- register ----------------------------- //
app.post("/register", async (req, res) => {
    const { name, contactinfo, password, role } = req.body;

    if (!name || !contactinfo || !password || !role) {
        return res.status(400).send({ status: "error", data: "All fields are required" });
    }

    try {

        // Check if user with the same contactinfo and role already exists
        const oldUser = await User.findOne({ contactinfo: contactinfo, role: role });
        if (oldUser) {
            return res.status(400).send({ status: "error", data: "User with this contact info and role already exists" });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);
        const user = new User({
            name: name,
            contactinfo: contactinfo,
            password: encryptedPassword,
            role: role
        });

        await user.save();

        res.status(201).send({ status: "ok", data: "User Created" });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).send({ status: "error", data: "Duplicate key error: contact info and role already exist" });
        }
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
            return res.status(400).send({ status: "error", data: 'Incorrect role. The appropriate role is ${oldUser.role}' });
        }

        const isPasswordMatch = await bcrypt.compare(password, oldUser.password);
        if (isPasswordMatch) {
    const token = jwt.sign({ contactinfo: oldUser.contactinfo }, jwtSecret, { expiresIn: '30d' });
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
        const user = jwt.verify(token, jwtSecret);
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

        let outlet;
        if (id) {
            outlet = await OutletInfo.findOneAndUpdate({ id, userId }, {
                name, shopkeeperName, upiId, details, image, location, type,
                openingTime, closingTime, leaveDay, featured, offDays, menuType,
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
                openingTime, closingTime, leaveDay, featured, offDays, userId, menuType,
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


app.post("/getorderseller", async (req, res) => {
    const { contactinfo } = req.body;
    if (!contactinfo) {
        return res.status(400).send({ status: "error", data: "Contact info is required" });
    }

    try {
        const orderSeller = await OrderInfo.find({ "items.userId": contactinfo });
        if (orderSeller.length === 0) {
            return res.status(400).send({ status: "error", data: "Seller not found" });
        }
        res.status(200).send({ status: 'ok', data: orderSeller });
    } catch (err) {
        console.log(err);
        res.status(500).send({ status: "error", data: "Internal server error" });
    }
});




app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

