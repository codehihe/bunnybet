var express = require("express")
// var bodyParser = require('body-parser')
var path = require("path")
var router = express.Router()

var products = require('./var/home').PRODUCTS
// var market = require('./utils/dataManager').getMarket() // Removed static load
var profiles = require('./var/home').PROFILES
var donations = require('./var/home').DONATIONS
var race_rabbits = require('./var/home').RACE_RABBITS
var keno_prizes = require('./var/home').KENO_PRIZES
var contact = require('./var/home').CONTACT
var finances = require('./var/home').FINANCES
var career = require('./var/career').CAREER_ARRAY
var questions = require('./var/questions').QUESTION_ARRAY
const { sendEmail } = require("./utils/mail")
const { get_exchangerate, filterRates } = require("./utils/other")
// const { getMarket, saveMarket, getCoupons, saveCoupons } = require('./utils/dataManager') // Removed
const { encrypt } = require('./utils/crypto')

const prisma = require('./lib/prisma')

var jsonParser = express.json({ limit: '50mb' });
router.use(express.static(path.resolve(__dirname, '../client/build')))

router.get("/api/home", async (req, res) => {
  try {
    let market = await prisma.market.findMany({ orderBy: { id: 'asc' } })
    let config = await prisma.config.findMany()
    let configMap = {}
    config.forEach(c => { configMap[c.key] = c.value })
    let donations_out = donations.map(d => {
      if (d.type === 'bank') {
        return {
          ...d,
          title: configMap.DONATION_BANK_TITLE || d.title,
          text: configMap.DONATION_BANK_TEXT || d.text
        }
      }
      return d
    })
    let payload = { products, market, finances, profiles, donations: donations_out, career, questions, race_rabbits, keno_prizes, contact }
    res.json(payload)
  } catch (e) {
    console.error('Error fetching home data (GET):', e)
    res.status(500).json({ error: true, message: e.message })
  }
})

router.post("/api/home", async (req, res) => {
  try {
    let market = await prisma.market.findMany({ orderBy: { id: 'asc' } })
    let config = await prisma.config.findMany()
    let configMap = {}
    config.forEach(c => { configMap[c.key] = c.value })
    let donations_out = donations.map(d => {
      if (d.type === 'bank') {
        return {
          ...d,
          title: configMap.DONATION_BANK_TITLE || d.title,
          text: configMap.DONATION_BANK_TEXT || d.text
        }
      }
      return d
    })
    let payload = { products, market, finances, profiles, donations: donations_out, career, questions, race_rabbits, keno_prizes, contact }
    res.json(payload)
  } catch (e) {
    console.error('Error fetching home data (POST):', e)
    res.status(500).json({ error: true, message: e.message })
  }
})

// ADMIN ROUTES
router.get("/api/admin/market", async (req, res, next) => {
  try {
    const market = await prisma.market.findMany({ orderBy: { id: 'asc' } })
    res.send(market)
  } catch (e) {
    res.send([])
  }
})

router.post("/api/admin/market/update", async (req, res, next) => {
  if(req.body && req.body.market){
    try {
      for(const item of req.body.market){
        const data = {}
        if (item.price !== undefined) data.price = parseFloat(item.price)
        if (item.value !== undefined) data.value = parseInt(item.value)
        if (item.name_eng !== undefined) data.name_eng = item.name_eng
        await prisma.market.update({
          where: { id: item.id },
          data
        })
      }
      res.send({success: true})
    } catch (e) {
      console.error(e)
      res.send({success: false})
    }
  } else {
    res.send({success: false})
  }
})

router.post("/api/admin/market/add", async (req, res, next) => {
  console.log('[ADMIN] Adding market item:', req.body)
  const { id, name_eng, price, value } = req.body || {}
  
  // Robust validation
  if (!id || !name_eng) {
    console.warn('[ADMIN] Add market item failed: Missing ID or Name')
    return res.status(400).send({ success: false, message: 'ID and Name are required' })
  }

  const numericPrice = parseFloat(price)
  const numericValue = parseInt(value)

  if (isNaN(numericPrice) || isNaN(numericValue)) {
    console.warn('[ADMIN] Add market item failed: Invalid numeric values', { price, value })
    return res.status(400).send({ success: false, message: 'Price and Value must be numbers' })
  }

  try {
    // Check for existing ID to avoid unique constraint violation
    const existing = await prisma.market.findUnique({ where: { id: id.toString() } })
    if (existing) {
      console.warn('[ADMIN] Add market item failed: ID already exists', id)
      return res.send({ success: false, message: 'Market item with this ID already exists' })
    }

    const newItem = await prisma.market.create({
      data: {
        id: id.toString(),
        name_eng,
        name_ro: name_eng,
        name_fr: name_eng,
        name_de: name_eng,
        name_es: name_eng,
        name_it: name_eng,
        name_pt: name_eng,
        name_ru: name_eng,
        name_zh: name_eng,
        price: numericPrice,
        value: numericValue
      }
    })
    console.log('[ADMIN] Market item added successfully:', newItem.id)
    res.send({ success: true })
  } catch (e) {
    console.error('[ADMIN] Error adding market item:', e)
    res.send({ success: false, message: 'Internal server error: ' + e.message })
  }
})

router.post("/api/admin/market/delete", async (req, res, next) => {
  const { id } = req.body || {}
  if (id) {
    try {
      await prisma.market.delete({
        where: { id: id.toString() }
      })
      res.send({ success: true })
    } catch (e) {
      console.error(e)
      res.send({ success: false })
    }
  } else {
    res.send({ success: false })
  }
})

router.get("/api/admin/coupons", async (req, res, next) => {
  try {
    const coupons = await prisma.coupon.findMany()
    res.send(coupons)
  } catch (e) {
    res.send([])
  }
})

router.post("/api/admin/coupons/add", async (req, res, next) => {
  console.log('[ADMIN] Creating coupon:', req.body)
  if (req.body && req.body.name && req.body.discount !== undefined) {
    const numericDiscount = parseInt(req.body.discount)
    if (isNaN(numericDiscount)) {
      console.warn('[ADMIN] Create coupon failed: Invalid discount', req.body.discount)
      return res.status(400).send({ success: false, message: 'Discount must be a number' })
    }

    try {
      // Check for existing coupon name
      const existing = await prisma.coupon.findUnique({ where: { name: req.body.name } })
      if (existing) {
        console.warn('[ADMIN] Create coupon failed: Name already exists', req.body.name)
        return res.send({ success: false, message: 'Coupon with this name already exists' })
      }

      const newCoupon = await prisma.coupon.create({
        data: {
          name: req.body.name,
          discount: numericDiscount
        }
      })
      console.log('[ADMIN] Coupon created successfully:', newCoupon.name)
      res.send({ success: true })
    } catch (e) {
      console.error('[ADMIN] Error adding coupon:', e)
      res.send({ success: false, message: 'Internal server error: ' + e.message })
    }
  } else {
    console.warn('[ADMIN] Create coupon failed: Missing fields', req.body)
    res.send({ success: false, message: 'Missing required fields' })
  }
})

router.post("/api/admin/coupons/update", async (req, res, next) => {
  console.log('[ADMIN] Updating coupon:', req.body)
  if (req.body && req.body.originalName && req.body.coupon && req.body.coupon.name && req.body.coupon.discount !== undefined) {
    const numericDiscount = parseInt(req.body.coupon.discount)
    if (isNaN(numericDiscount)) {
      console.warn('[ADMIN] Update coupon failed: Invalid discount', req.body.coupon.discount)
      return res.status(400).send({ success: false, message: 'Discount must be a number' })
    }

    try {
      await prisma.coupon.update({
        where: { name: req.body.originalName },
        data: {
          name: req.body.coupon.name,
          discount: numericDiscount
        }
      })
      console.log('[ADMIN] Coupon updated successfully:', req.body.coupon.name)
      res.send({ success: true })
    } catch (e) {
      console.error('[ADMIN] Error updating coupon:', e)
      res.send({ success: false, message: 'Internal server error: ' + e.message })
    }
  } else {
    console.warn('[ADMIN] Update coupon failed: Missing fields', req.body)
    res.send({ success: false, message: 'Missing required fields' })
  }
})

router.post("/api/admin/coupons/delete", async (req, res, next) => {
  if(req.body && req.body.name){
    try {
      await prisma.coupon.delete({
        where: { name: req.body.name }
      })
      res.send({success: true})
    } catch (e) {
      console.error(e)
      res.send({success: false})
    }
  } else {
    res.send({success: false})
  }
})

router.post("/api/admin/change_password", async (req, res, next) => {
  if(req.body && req.body.email && req.body.newPassword){
    try {
      const encryptedPass = JSON.stringify(encrypt(req.body.newPassword))
      await prisma.user.update({
        where: { email: req.body.email },
        data: { password: encryptedPass }
      })
      res.send({success: true})
    } catch (e) {
      console.error(e)
      res.send({success: false})
    }
  } else {
    res.send({success: false})
  }
})

router.get("/api/admin/config", async (req, res, next) => {
  try {
    const config = await prisma.config.findMany()
    let result = {}
    config.forEach(c => { result[c.key] = c.value })
    res.send(result)
  } catch (e) {
    res.send({})
  }
})

router.post("/api/admin/config/update", async (req, res, next) => {
  if(req.body && req.body.key && req.body.value !== undefined){
    try {
      await prisma.config.upsert({
        where: { key: req.body.key },
        update: { value: req.body.value.toString() },
        create: { key: req.body.key, value: req.body.value.toString() }
      })
      res.send({ success: true })
    } catch (e) {
      console.error(e)
      res.send({ success: false })
    }
  } else {
    res.send({ success: false })
  }
})


router.post("/api/contact", jsonParser, (req, res, next) => {
  sendEmail('contact', req.body).then((data) => {
    try {
      res.send(data)
    } catch (e) {
      console.log('[error]', 'contact--> ', e)
      res.send({ send: "email_no_send" })
    }
  })
})

router.post("/api/exchange_rates", jsonParser, (req, res, next) => {
  get_exchangerate().then((e) => {
    if (e && e.data && e.data.conversion_rates) {
      const allowedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'CHF', 'RON']
      const filteredRates = filterRates(e.data.conversion_rates, allowedCurrencies)
      res.send({ conversion_rates: filteredRates })
    } else {
      res.send({ conversion_rates: {} })
    }
  })
})

router.post("/api/verify-email", jsonParser, (req, res, next) => {

  // 2: "no_token",
  // 3: "error_during_verification",
  // 4: "invalid_expired_token",
  // 5: "email_verify_success"
  // 6: "email_already_verified"

  const { token } = req.body
  if (token) {
    try {
      prisma.user.findFirst({
        where: { verificationToken: token }
      }).then((result) => {
        if (result) {
          if (result.isVerified) {
            //email_already_verified
            res.send({ success: true, send: 6 })
          } else {
            //email_verify_success
            res.send({ success: true, send: 5 })

            // update is_verified to 1
            prisma.user.updateMany({
              where: { verificationToken: token },
              data: { isVerified: true }
            }).then(() => { })
          }
        } else {
          console.log('[error]', 'verify-email-invalid_expired_token--> ', token)
          res.send({ error: true, send: 4 }) //invalid_expired_token
        }
      })
    } catch (e) {
      console.log('[error]', 'verify-email-error_during_verification--> ', e)
      res.send({ error: true, send: 3 }) //error_during_verification
    }
  } else {
    console.log('[error]', 'verify-email-/no_token--> ', token)
    res.send({ error: true, send: 2 }) //no_token
  }
})

router.post("/api/apply_job", jsonParser, (req, res, next) => {
  sendEmail('apply_job', req.body).then((data) => {
    try {
      res.send(data)
    } catch (e) {
      console.log('[error]', 'apply_job--> ', e)
      res.send({ send: "email_no_send" })
    }
  })
})



router.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../client/build', 'index.html'))
})

module.exports = router
