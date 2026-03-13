var express = require("express")
var bodyParser = require('body-parser')
var withdrawPayment = express.Router()

var jsonParser = bodyParser.json()

const prisma = require('../lib/prisma')
const { sendEmail } = require("../utils/mail")

withdrawPayment.post("/api/withdraw", jsonParser, (req, res, next) => {
  const { uuid, name, email, phone, country, city, iban, amount, currency, withdraw_method, withdraw_details } = req.body

  let finalIban = iban
  if (!finalIban && withdraw_details) {
    finalIban = withdraw_method ? `${withdraw_method}: ${withdraw_details}` : withdraw_details
  }

  if (!uuid) {
    return res.json({ type: "withdraw", result: "error", payload: 'error_charge' })
  }

  if (!amount) {
    return res.json({ type: "withdraw", result: "error", payload: 'no_money' })
  }

  if (!currency) {
    return res.json({ type: "withdraw", result: "error", payload: 'no_currency' })
  }

  if (!name || !email || !phone || !country || !city) {
    return res.json({ type: "withdraw", result: "error", payload: 'no_data' })
  }

  // processing withdraw
  prisma.user.findUnique({
    where: { uuid: uuid }
  }).then(async (user_found) => {
    if (user_found) {
      const withdrawAmount = parseFloat(amount)
      
      // Check for sufficient balance
      if (user_found.balance < withdrawAmount) {
         return res.json({ type: "withdraw", result: "error", payload: 'insufficient_funds' })
      }

      let id = user_found.id
      let timestamp = new Date().getTime()

      try {
          await prisma.$transaction([
              // Deduct from user balance
              prisma.user.update({
                  where: { id: id },
                  data: { balance: { decrement: withdrawAmount } }
              }),
              // Create withdrawal record
              prisma.withdraw.create({
                  data: {
                    userId: id,
                    amount: withdrawAmount,
                    currency: currency,
                    name: name,
                    phone: phone,
                    email: email,
                    country: country,
                    city: city,
                    iban: finalIban,
                    date: timestamp + "",
                  }
              })
          ])

          let payload_email = { ...req.body, id }
          sendEmail('withdraw', payload_email).then((data) => {
            try {
              return res.json({ type: "withdraw", result: "success", payload: data.send })
            } catch (e) {
              console.log('[error]', 'withdraw email error--> ', e)
              // We return success anyway because the balance was already deducted and record created
              return res.json({ type: "withdraw", result: "success", payload: 'withdraw_processed_email_failed' })
            }
          })
      } catch (error) {
          console.error('[error]', 'withdraw transaction error--> ', error)
          return res.json({ type: "withdraw", result: "error", payload: 'withdraw_failed' })
      }
    } else {
        return res.json({ type: "withdraw", result: "error", payload: 'user_not_found' })
    }
  }).catch((err) => {
      console.error('[error]', 'withdraw find user error--> ', err)
      return res.json({ type: "withdraw", result: "error", payload: 'withdraw_failed' })
  })
})

module.exports = withdrawPayment