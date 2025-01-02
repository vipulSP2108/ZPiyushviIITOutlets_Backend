const mongoose = require('mongoose');

const itemOrdersSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    image: { type: String, required: true },
    rating: { type: Number, required: true },
    ratingcount: { type: Number, required: true },
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    quantity: { type: Number, required: true }
});

const ordersDetailsSchema = new mongoose.Schema({
    _idssss: { type: mongoose.Schema.Types.ObjectId, required: true },
    id: { type: String, required: true },
    massage: { type: String },
    status: { type: String, required: true },
    date: { type: String, required: true },
    totalPrice: { type: Number, required: true },
    userInfocontactinfo: { type: String, required: true },
    issue: { type: String },
    orders: { type: [itemOrdersSchema], required: true },
});

const orderHistorySchema = new mongoose.Schema({
    storeInfocontactinfo: { type: String, required: true, unique: true }, // Ensure unique store contact info
    orderDetails: { type: [ordersDetailsSchema], required: true },
});

module.exports = mongoose.model('OrderHistoryInfo', orderHistorySchema);




// const mongoose = require('mongoose');

// const itemOrdersSchema = new mongoose.Schema({
//     id: { type: String, required: true },
//     item: { type: String, required: true },
//     price: { type: Number, required: true },
//     type: { type: String, required: true },
//     // description: { type: String, required: true },
//     // status: { type: Boolean, required: true },
//     category: { type: String, required: true },
//     image: { type: String, required: true },
//     rating: { type: Number, required: true },
//     ratingcount: { type: Number, required: true },
//     _id: { type: mongoose.Schema.Types.ObjectId, required: true },
//     quantity: { type: Number, required: true }
// });

// const orderHistorySchema = new mongoose.Schema({
//     _idssss: { type: mongoose.Schema.Types.ObjectId, required: true },
//     id: { type: String, required: true },
//     massage: { type: String },
//     status: { type: String, required: true },
//     date: { type: String, required: true },
//     // name: { type: userInfo, required: true },
//     // items: { type: OrderItemsSchema, required: true },
//     totalPrice: { type: Number, required: true },
//     userInfocontactinfo: { type: String, required: true }, // Ensure this field is not null and unique if needed
//     storeInfocontactinfo: { type: String, required: true },
//     orders: { type: [itemOrdersSchema], required: true },
//     // timer: { type: Number, default: 0 },
//     issue: {type: String },
//     // startTime: { type: Date }, //default: new Date()
// });

// module.exports = mongoose.model('OrderHistoryInfo', orderHistorySchema);