const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const homeData = require('../var/home')

async function main() {
  console.log('Seeding data...')
  
  // Market
  try {
    const marketCount = await prisma.market.count()
    if (marketCount === 0) {
      console.log('Seeding Market...')
      for (const item of homeData.MARKET) {
        try {
          await prisma.market.create({
            data: {
              id: item.id,
              name_eng: item.name_eng,
              name_ro: item.name_ro,
              name_fr: item.name_fr,
              name_de: item.name_de,
              name_es: item.name_es,
              name_it: item.name_it,
              name_pt: item.name_pt,
              name_ru: item.name_ru,
              name_zh: item.name_zh,
              price: parseFloat(item.price),
              value: parseInt(item.value)
            }
          })
        } catch (e) {
          console.error(`Error seeding market item ${item.id}: ${e.message}`)
        }
      }
    } else {
      console.log('Market data already exists.')
    }
  } catch (e) {
    console.error('Error checking market count:', e)
  }

  // Coupons
  try {
    const couponCount = await prisma.coupon.count()
    if (couponCount === 0) {
      console.log('Seeding Coupons...')
      const seenNames = new Set()
      for (const item of homeData.COUPONS) {
        if (seenNames.has(item.name)) {
          console.log(`Skipping duplicate coupon name: ${item.name}`)
          continue
        }
        seenNames.add(item.name)
        
        try {
          await prisma.coupon.create({
            data: {
              name: item.name,
              discount: parseInt(item.discount)
            }
          })
        } catch (e) {
           console.error(`Error seeding coupon ${item.name}: ${e.message}`)
        }
      }
    } else {
      console.log('Coupons data already exists.')
    }
  } catch (e) {
    console.error('Error checking coupon count:', e)
  }
  
  // Update Admin User
  try {
    const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' }
    })
  
    if (adminUser) {
        console.log(`Found Admin User: ${adminUser.email}. Updating to bunnybet42@gmail.com...`)
        await prisma.user.update({
        where: { id: adminUser.id },
        data: { email: 'bunnybet42@gmail.com' }
        })
        console.log('Admin email updated.')
    } else {
        console.log('No Admin User found with role "ADMIN".')
    }
  } catch (e) {
    console.error('Error updating admin email:', e.message)
  }
  
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
