const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

async function main() {
    console.log('Start seeding...')

    // Clean up
    await prisma.bet.deleteMany()
    await prisma.transaction.deleteMany()
    await prisma.wallet.deleteMany()
    await prisma.chatMessage.deleteMany()
    await prisma.gameHistory.deleteMany()
    await prisma.marketItem.deleteMany()
    await prisma.loginUser.deleteMany()
    await prisma.order.deleteMany()
    await prisma.withdraw.deleteMany()
    await prisma.newsletter.deleteMany()
    await prisma.game.deleteMany()
    await prisma.user.deleteMany()

    // 1. Admin user & Demo players
    const admin = await prisma.user.create({
        data: {
            username: 'admin',
            email: 'admin@casino.com',
            password: 'encrypted_admin_pass', // Use proper encryption or mock string
            balance: 10000.0,
            role: 'ADMIN',
            avatar: 'admin.png',
            isVerified: true
        }
    })

    const player1 = await prisma.user.create({
        data: {
            username: 'player1',
            email: 'player1@mail.com',
            password: 'encrypted_player1_pass',
            balance: 500.0,
            role: 'USER',
            avatar: 'player1.png',
            isVerified: true
        }
    })

    const player2 = await prisma.user.create({
        data: {
            username: 'player2',
            email: 'player2@mail.com',
            password: 'encrypted_player2_pass',
            balance: 100.0,
            role: 'USER',
            avatar: 'player2.png',
            isVerified: true
        }
    })

    // 2. Sample games
    const roulette = await prisma.game.create({
        data: { name: 'Roulette', type: 'Table Game' }
    })
    const blackjack = await prisma.game.create({
        data: { name: 'Blackjack', type: 'Card Game' }
    })
    const slots = await prisma.game.create({
        data: { name: 'Slots', type: 'Machine Game' }
    })

    // 3. Example bets
    await prisma.bet.create({
        data: { amount: 50.0, gameId: roulette.id, userId: player1.id }
    })
    await prisma.bet.create({
        data: { amount: 20.0, gameId: blackjack.id, userId: player2.id }
    })

    // 4. Market items
    await prisma.marketItem.create({
        data: { name: 'Golden Avatar', price: 10.0, image: 'golden_avatar.png' }
    })
    await prisma.marketItem.create({
        data: { name: 'Fortune Coin', price: 50.0, image: 'fortune_coin.png' }
    })

    // 5. Chat messages
    await prisma.chatMessage.create({
        data: { message: 'Hello everyone!', userId: player1.id }
    })
    await prisma.chatMessage.create({
        data: { message: 'Good luck!', userId: player2.id }
    })
    await prisma.chatMessage.create({
        data: { message: 'Welcome to the Casino!', userId: admin.id }
    })

    console.log('Seeding finished.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
