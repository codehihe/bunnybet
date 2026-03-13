const express = require("express")
const app = express()
const cors = require("cors")
// const bodyParser = require('body-parser')

var http = require('http').createServer(app)
const { Server } = require("socket.io");
const io = new Server(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors())
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/razorpay/webhook')) {
      req.rawBody = buf.toString();
    }
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const dotenv = require('dotenv')
const path = require('path')

// Load default .env file first (for DATABASE_URL etc.)
dotenv.config({ path: path.resolve(__dirname, '.env') })

var NODE_ENV = (process.env.NODE_ENV || 'development').trim()
dotenv.config({
  path: path.resolve(__dirname, `.env.${NODE_ENV}`)
})

const PORT = process.env.PORT || 1111
const razorpayPayment = require("./payments/razorpayPayment")
app.use(razorpayPayment)

var withdrawPayment = require("./payments/withdrawPayment")
app.use(withdrawPayment)

var routes = require("./routes")
app.use(routes)

const { encrypt, decrypt } = require('./utils/crypto')
const { get_device, get_extra_data, check_streak, isValidPhone } = require("./utils/other")
const { sendEmail, sendVerificationEmail } = require("./utils/mail")
const crypto = require('crypto')

const { roulette } = require("./games/roulette")
const { blackjack } = require("./games/blackjack")
const { slots } = require("./games/slots")
const { craps } = require("./games/craps")
const { race } = require("./games/race")
const { keno } = require("./games/keno")
const { poker } = require("./games/poker")
const { baccarat } = require("./games/baccarat")

// const { getCoupons } = require('./utils/dataManager')

const account_type = 1
const user_money = 100
const how_lucky = 7

var chatroom_users = []

const prisma = require('./lib/prisma')

io.on('connection', (socket) => {
  socket.on('signin_send', async (data) => {
    const { email, pass } = data
    try {
      const user_found = await prisma.user.findFirst({ where: { email } })

      if (user_found && decrypt(JSON.parse(user_found.password)) === pass) {
        let id = user_found.id
        const login_found = await prisma.loginUser.findMany({ where: { userId: id } })

        let uuid = crypto.randomBytes(20).toString('hex')
        let device = get_device(socket.request.headers) // 0 = computer, 1 = mobile, 2 = other

        let date01 = new Date().setHours(0, 0, 0, 0)
        let logs = login_found.filter((x) => {
          let date02 = new Date(parseInt(x.loginDate)).setHours(0, 0, 0, 0)
          return date01 === date02
        })

        let obj = {
          uuid,
          user: user_found.username,
          email: user_found.email,
          phone: user_found.phone,
          account_type: (user_found.role && user_found.role.toUpperCase() === 'ADMIN') ? 2 : 1,
          money: user_found.balance,
          device,
          profile_pic: user_found.avatar,
          logs: logs.length,
          logsTotal: login_found.length,
        }

        if (user_found.isVerified === true) {
          try {
            io.to(socket.id).emit('signin_read', { success: true, exists: true, is_verified: true, obj: obj })
          } catch (e) { console.log(e) }

          get_extra_data().then(async (res) => {
            let extra_data = { city: "", country: "", ip_address: "" }
            if (res && res.data) {
              extra_data = {
                city: res.data.city || "",
                country: res.data.country_name || "",
                ip_address: res.data.ip || "",
              }
            }
            let timestamp = new Date().getTime() + ""

            await prisma.user.update({
              where: { id: user_found.id },
              data: { uuid: uuid }
            })

            await prisma.loginUser.create({
              data: {
                userId: user_found.id,
                loginDate: timestamp,
                device: device,
                ipAddress: extra_data.ip_address,
                city: extra_data.city,
                country: extra_data.country
              }
            })
          })
        } else {
          try { io.to(socket.id).emit('signin_read', { success: false, exists: true, is_verified: false, obj, details: 'token_is_not_verified' }) } catch (e) { }
        }
      } else {
        try { io.to(socket.id).emit('signin_read', { success: false, exists: false, obj: {}, details: 'no_user' }) } catch (e) { }
      }
    } catch (err) {
      console.log(err)
      try { io.to(socket.id).emit('signin_read', { success: false, exists: false, obj: {}, details: 'signin_error' }) } catch (e) { }
    }
  })

  socket.on('signup_send', async (data) => {
    const { user, pass, email, phone, lang } = data
    try {
      if (!isValidPhone(phone)) {
        try {
          io.to(socket.id).emit('signup_read', { success_mail: false, exists: false, validate: true, details: 'validate_message_phone', email, phone })
        } catch (e) { }
        return
      }
      const existingUser = await prisma.user.findFirst({ where: { email } })
      if (!existingUser) {
        let verificationToken = crypto.randomBytes(20).toString('hex')

        sendVerificationEmail(email, lang, verificationToken).then(async (res) => {
          if (res && res.success_mail) {
            try { io.to(socket.id).emit('signup_read', { ...res, exists: false, validate: false, email, phone }) } catch (e) { }

            get_extra_data().then(async (extraRes) => {
              let uuid = crypto.randomBytes(20).toString('hex')
              let extra_data = { city: "", country: "", ip_address: "" }
              if (extraRes && extraRes.data) {
                extra_data = {
                  city: extraRes.data.city || "",
                  country: extraRes.data.country_name || "",
                  ip_address: extraRes.data.ip || "",
                }
              }
              let pass_encrypt = JSON.stringify(encrypt(pass))

              const createdUser = await prisma.user.create({
                data: {
                  uuid,
                  username: user,
                  email,
                  phone,
                  password: pass_encrypt,
                  role: 'USER',
                  balance: user_money,
                  verificationToken: verificationToken,
                  isVerified: false
                }
              })
            })
          } else {
            try { io.to(socket.id).emit('signup_read', { ...res, exists: false, validate: false, email }) } catch (e) { }
          }
        })
      } else {
        try { io.to(socket.id).emit('signup_read', { exists: true, validate: true, details: "email_in_use", email }) } catch (e) { }
      }
    } catch (err) {
      console.log(err)
    }
  })

  socket.on('forgotPassword_send', async (data) => {
    const { email } = data
    try {
      const user = await prisma.user.findFirst({ where: { email } })
      if (user) {
        let payload = { ...user, ...data, user: user.username }
        sendEmail('forgot_password', payload).then(async (res) => {
          try {
            await resetPassword(user)
            io.to(socket.id).emit('forgotPassword_read', res)
          } catch (e) { }
        })
      } else {
        try { io.to(socket.id).emit('forgotPassword_read', { send: "no_user" }) } catch (e) { }
      }
    } catch (err) { console.log(err) }
  })

  async function resetPassword(user) {
    if (user) {
      let new_pass_value = "Password001!"
      let new_pass = JSON.stringify(encrypt(new_pass_value))
      await prisma.user.update({
        where: { uuid: user.uuid },
        data: { password: new_pass }
      })
    }
  }

  socket.on('signup_verification_send', async (data) => {
    const { email, lang } = data
    try {
      let verificationToken = crypto.randomBytes(20).toString('hex')
      await prisma.user.updateMany({
        where: { email: email },
        data: { verificationToken: verificationToken }
      })
      sendVerificationEmail(email, lang, verificationToken).then((res) => {
        try { io.to(socket.id).emit('signup_verification_read', res) } catch (e) { }
      })
    } catch (err) { console.log(err) }
  })

  socket.on('sign_problem_send', (data) => {
    sendEmail('sign_problem', data).then((res) => {
      try { io.to(socket.id).emit('sign_problem_read', res) } catch (e) { }
    })
  })

  // GAMES
  socket.on('game_send', async (data) => {
    if (data.uuid) {
      try {
        const user = await prisma.user.findFirst({ where: { uuid: data.uuid } })
        let payload = { streak: 1, prize: 0 }
        if (user) {
          const login_user = await prisma.loginUser.findMany({ where: { userId: user.id } })
          payload = updateStreak([user], login_user)
          try { io.to(socket.id).emit('game_read', payload) } catch (e) { }
        }
      } catch (err) { console.log(err) }
    }
  })

  socket.on('streakClainPrize_send', (data) => {
    if (data.uuid) {
      try { io.to(socket.id).emit('streakClainPrize_read', { prize: data.prize }) } catch (e) { }
    }
  })

  function updateStreak(user_found, login_user) {
    let streak = 1
    if (user_found[0]) {
      streak = check_streak(login_user)
    }
    let prize = 0
    if (streak > 0 && streak % 10 === 0) {
      prize = 10
    }
    return { streak, prize }
  }

  // NOTE: updateMoney logic changed to Prisma (though it wasn't called in game_send in original code directly, I'll keep it)

  socket.on('roulette_send', (data) => {
    if (data.uuid) {
      let room = data.room
      let payload = roulette(data, how_lucky)
      try { io.to(room).emit('roulette_read', payload) } catch (e) { }
    }
  })
  socket.on('blackjack_send', (data) => {
    if (data.uuid) {
      let room = data.room
      let payload = blackjack(data, chatroom_users, how_lucky)
      try { io.to(room).emit('blackjack_read', payload) } catch (e) { }
    }
  })
  socket.on('poker_send', (data) => {
    if (data.uuid) {
      let room = data.room
      let payload = poker(data, chatroom_users)
      try { io.to(room).emit('poker_read', payload) } catch (e) { }
    }
  })
  socket.on('slots_send', (data) => {
    if (data.uuid) {
      let room = data.room
      let payload = slots(data)
      try { io.to(room).emit('slots_read', payload) } catch (e) { }
    }
  })
  socket.on('craps_send', (data) => {
    if (data.uuid) {
      let room = data.room
      let payload = craps(data, how_lucky)
      try { io.to(room).emit('craps_read', payload) } catch (e) { }
    }
  })
  socket.on('race_send', (data) => {
    if (data.uuid) {
      let payload = race(data, how_lucky)
      try { io.emit('race_read', payload) } catch (e) { }
    }
  })
  socket.on('keno_send', (data) => {
    if (data.uuid) {
      let payload = keno(data, how_lucky)
      try { io.emit('keno_read', payload) } catch (e) { }
    }
  })
  socket.on('baccarat_send', (data) => {
    let payload = baccarat(data, how_lucky)
    try { io.emit('baccarat_read', payload) } catch (e) { }
  })

  socket.on('game_results_send', async (data) => {
    if (data.uuid) {
      try {
        const user = await prisma.user.findFirst({ where: { uuid: data.uuid } })
        if (user) {
          let table_name = data.game.table_name ? data.game.table_name : ""
          let table_id = data.game.table_id ? data.game.table_id : table_name
          let table_type = data.game.table_type ? data.game.table_type : table_name
          let status = data.status == "win" ? 1 : 0
          let timestamp = new Date().getTime() + ""

          await prisma.user.update({
            where: { id: user.id },
            data: { balance: data.money }
          })
          await prisma.gameHistory.create({
            data: {
              userId: user.id,
              gameName: table_name,
              // gameId relation is omitted since we don't always have actual Game records yet in their DB, just name
              // I will set result correctly
              result: table_id,
              amount: data.bet,
              gameType: table_type,
              date: timestamp,
              status: status
            }
          })
        }
      } catch (err) { console.log(err) }
    }
  })

  // DASHBOARD, CART, ORDER, WITHDRAW, NEWSLETTERS
  socket.on('dashboardChanges_send', async (data) => {
    const { uuid, value } = data
    if (uuid) {
      try {
        switch (data.type) {
          case "pic":
            await prisma.user.updateMany({ where: { uuid: uuid }, data: { avatar: value } })
            break
          case "user":
            await prisma.user.updateMany({ where: { uuid: uuid }, data: { username: value } })
            break
          case "pass":
            let new_pass = JSON.stringify(encrypt(value))
            await prisma.user.updateMany({ where: { uuid: uuid }, data: { password: new_pass } })
            break
        }
      } catch (err) { console.log(err) }
    }
  })

  socket.on('promo_send', (text) => {
    let coupon = {}
    let coupons = getCoupons()
    for (let i in coupons) {
      if (coupons[i].name === text) {
        coupon = coupons[i]
        break
      }
    }
    try { io.to(socket.id).emit('promo_read', coupon) } catch (e) { }
  })

  socket.on('order_send', async (details) => {
    const { uuid, carrots_update, order_date, payment_id, amount, method, description, currency, exchange_rates, currencyExchange } = details
    if (uuid) {
      try {
        const user = await prisma.user.findFirst({ where: { uuid: uuid } })
        if (user) {
          let money = user.balance + carrots_update
          let orderDate = (typeof order_date === 'number') ? order_date + "" : new Date(order_date).getTime() + ""
          let exchange_rate = exchange_rates[currencyExchange]

          function getOrDefault(obj, key, defaultValue = '-') {
            return obj[key] !== undefined ? obj[key] : defaultValue
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { balance: money }
          })

          await prisma.order.create({
            data: {
              userId: user.id,
              paymentId: payment_id,
              customerId: getOrDefault(details, 'customer_id'),
              orderDate: orderDate,
              amount: parseFloat(amount) || 0,
              method: method,
              country: getOrDefault(details, 'country'),
              city: getOrDefault(details, 'city'),
              email: getOrDefault(details, 'email'),
              phone: getOrDefault(details, 'phone'),
              description: description,
              currency: currency,
              currencyExchange: currencyExchange,
              exchangeRate: parseFloat(exchange_rate) || 0
            }
          })
          try { io.to(socket.id).emit('order_read', { ...details, money }) } catch (e) { }
        } else {
          try { io.to(socket.id).emit('order_read', { error: 'no_user' }) } catch (e) { }
        }
      } catch (err) { console.log(err) }
    } else {
      try { io.to(socket.id).emit('order_read', { error: 'no_uuid' }) } catch (e) { }
    }
  })

  socket.on('getOrdersWithdraws_send', async (data) => {
    const { uuid } = data
    if (uuid) {
      try {
        const user = await prisma.user.findFirst({ where: { uuid: uuid } })
        if (user) {
          const orders = await prisma.order.findMany({ where: { userId: user.id } })
          const withdraws = await prisma.withdraw.findMany({ where: { userId: user.id } })

          // MAP property names
          let orders_found = orders.map(x => ({ ...x, user_id: x.userId, order_date: x.orderDate, customer_id: x.customerId, exchange_rate: x.exchangeRate }))
          let withdraws_found = withdraws.map(x => ({ ...x, user_id: x.userId }))
          try { io.to(socket.id).emit('getOrdersWithdraws_read', { orders_found, withdraws_found }) } catch (e) { }
        } else {
          try { io.to(socket.id).emit('getOrdersWithdraws_read', { error: 'no_user' }) } catch (e) { }
        }
      } catch (err) { console.log(err) }
    } else {
      try { io.to(socket.id).emit('getOrdersWithdraws_read', { error: 'no_uuid' }) } catch (e) { }
    }
  })


  socket.on('newsletter_send', async (data) => {
    const { uuid, email } = data
    if (uuid && email) {
      try {
        const user = await prisma.user.findFirst({ where: { uuid: uuid } })
        if (user) {
          const existing = await prisma.newsletter.findFirst({ where: { email: email } })
          if (existing) {
            try { io.to(socket.id).emit('newsletter_read', { success: false, send: "already_subscribed" }) } catch (e) { }
          } else {
            await prisma.newsletter.create({ data: { userId: user.id, email: email } })
            try { io.to(socket.id).emit('newsletter_read', { success: false, send: "subscribed" }) } catch (e) { }
          }
        } else {
          try { io.to(socket.id).emit('newsletter_read', { success: false, send: "error" }) } catch (e) { }
        }
      } catch (err) {
        try { io.to(socket.id).emit('newsletter_read', { success: false, send: "error" }) } catch (e) { }
      }
    } else {
      try { io.to(socket.id).emit('newsletter_read', { success: false, send: "error" }) } catch (e) { }
    }
  })

  // CHATROOM
  socket.on('join_room', (data) => {
    let room = data.room
    socket.join(data.room)

    let timestamp = new Date().getTime()
    let message = { text: 'join', timestamp: timestamp, user: data.user }

    let index = chatroom_users.findIndex((x) => x.uuid === data.uuid)
    if (index === -1) {
      chatroom_users.push({ uuid: data.uuid, user: data.user, room: room, timestamp: timestamp })
    } else {
      chatroom_users[index].room = room
      chatroom_users[index].timestamp = timestamp
    }

    try {
      io.to(room).emit('message_read', message)
      io.to(room).emit('chatroom_users_read', chatroom_users)
    } catch (e) { }
  })
  socket.on('leave_room', (data) => {
    let room = data.room
    socket.leave(room)
    let timestamp = new Date().getTime()
    let message = { text: 'leave', timestamp: timestamp, user: data.user }

    let new_chatroom_users = chatroom_users.filter((x) => x.uuid !== data.uuid)
    chatroom_users = new_chatroom_users

    try {
      io.to(room).emit('message_read', message)
      io.to(room).emit('chatroom_users_read', chatroom_users)
    } catch (e) { }
  })
  socket.on('message_send', async (data) => {
    let room = data.room
    let timestamp = new Date().getTime()
    let message = { text: data.text, timestamp: timestamp, user: data.user }
    try {
      const user = await prisma.user.findFirst({ where: { username: data.user } })
      await prisma.chatMessage.create({
        data: {
          message: data.text,
          userId: user ? user.id : null,
          userStr: data.user,
        }
      })
      io.to(room).emit('message_read', message)
    } catch (e) { }
  })

  socket.on('heartbeat', (data) => {
  })
  socket.on('disconnect', () => {
  })
})

if (process.env.NODE_ENV !== 'production') {
  http.listen(PORT, () => { console.log(`Server listening on ${PORT}`) })
}
module.exports = app;
