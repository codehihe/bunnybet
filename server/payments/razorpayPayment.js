var express = require("express")
var router = express.Router()
const crypto = require("crypto")
const Razorpay = require("razorpay")
var jsonParser = express.json({ limit: '50mb' })
const prisma = require("../lib/prisma")
const { sendEmail } = require("../utils/mail")

// Initialize Razorpay SDK using Environment Variables
// We instantiate inside the endpoints or globally if env is guaranteed.
// Using a getter function ensures we use the latest env vars if they load late.
const getRazorpayInstance = () => {
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    })
}

// 1. Create Order
router.post("/api/razorpay/order", jsonParser, async (req, res, next) => {
    try {
        const { amount, currency, receipt, notes } = req.body

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
             return res.status(500).json({ success: false, message: "Razorpay keys not configured" })
        }

        const instance = getRazorpayInstance()

        const options = {
            amount: amount, // amount in the smallest currency unit
            currency: currency || "INR",
            receipt: receipt || `receipt_${Date.now()}`,
            notes: notes || {}
        }

        const order = await instance.orders.create(options)
        
        if (!order) {
            return res.status(500).json({ success: false, message: "Order creation failed" })
        }

        res.json({ success: true, order })
    } catch (error) {
        console.error("Error creating Razorpay order:", error)
        res.status(500).json({ success: false, message: "Something went wrong", error: error.message })
    }
})

// 2. Verify Payment Signature
router.post("/api/razorpay/verify", jsonParser, async (req, res, next) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount,      // Pass down from frontend for saving
            currency,    // Pass down from frontend for saving
            uuid,        // User uuid for saving order
            description  // Description of item bought
        } = req.body

        if (!process.env.RAZORPAY_KEY_SECRET) {
             return res.status(500).json({ success: false, message: "Razorpay secret not configured" })
        }

        const secret = process.env.RAZORPAY_KEY_SECRET

        // Creating hmac object
        let hmac = crypto.createHmac("sha256", secret)

        // Passing the data to be hashed
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id)
        
        // Creating the hmac in the required format
        const generated_signature = hmac.digest("hex")

        if (generated_signature === razorpay_signature) {
             // Payment is successful
             // 1. Check if this payment was already processed (idempotency)
             const existingOrder = await prisma.order.findFirst({ where: { paymentId: razorpay_payment_id } })
             if (existingOrder) {
                 return res.json({ success: true, message: "Payment already verified" })
             }

             // 2. Save the payment in DB
            const user = await prisma.user.findFirst({ where: { uuid: uuid } })
             if(user) {
                  const depositAmount = amount / 100 // razorpay gives subunits
                  
                  await prisma.$transaction([
                      prisma.user.update({
                          where: { id: user.id },
                          data: { balance: { increment: depositAmount } }
                      }),
                      prisma.order.create({
                          data: {
                              userId: user.id,
                              description: description || 'Razorpay Payment',
                              amount: depositAmount,
                              currency: currency || 'INR',
                              paymentId: razorpay_payment_id,
                              method: 'razorpay'
                          }
                      })
                  ])
             }

             res.json({ success: true, message: "Payment has been verified" })
        } else {
             // Payment verification failed
             res.status(400).json({ success: false, message: "Payment verification failed" })
        }
    } catch (error) {
         console.error("Error verifying Razorpay payment:", error)
         res.status(500).json({ success: false, message: "Internal Server Error", error: error.message })
    }
})

// 3. Webhook Handler
router.post("/api/razorpay/webhook", jsonParser, async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET
        if (!secret) {
            console.error("RAZORPAY_WEBHOOK_SECRET not set")
            return res.status(400).send('Webhook secret not set')
        }

        const signature = req.headers["x-razorpay-signature"]
        const shasum = crypto.createHmac("sha256", secret)
        shasum.update(req.rawBody || JSON.stringify(req.body))
        const digest = shasum.digest("hex")

        if (signature !== digest) {
            return res.status(400).send('Invalid signature')
        }

        // Handle event
        const event = req.body.event
        if (event === "payment.captured") {
            const payment = req.body.payload.payment.entity
            const paymentId = payment.id
            const amount = payment.amount / 100 // Convert to main unit
            const currency = payment.currency
            const notes = payment.notes || {}
            
            // We expect the user's UUID in payment notes to link back if verify failed
            const uuid = notes.uuid

            if (uuid) {
                // Check if already processed
                const existingOrder = await prisma.order.findFirst({ where: { paymentId: paymentId } })
                if (!existingOrder) {
                    const user = await prisma.user.findFirst({ where: { uuid: uuid } })
                    if (user) {
                        await prisma.$transaction([
                            prisma.user.update({
                                where: { id: user.id },
                                data: { balance: { increment: amount } }
                            }),
                            prisma.order.create({
                                data: {
                                    userId: user.id,
                                    description: notes.description || 'Razorpay Webhook Payment',
                                    amount: amount,
                                    currency: currency,
                                    paymentId: paymentId,
                                    method: 'razorpay'
                                }
                            })
                        ])
                        console.log(`Payment ${paymentId} processed via webhook for user ${uuid}`)
                    }
                }
            }
        }

        res.json({ status: 'ok' })
    } catch (error) {
        console.error("Webhook Error:", error)
        res.status(500).send("Webhook Error")
    }
})

module.exports = router
