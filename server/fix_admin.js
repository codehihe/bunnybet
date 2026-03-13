const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Fixing admin role...')
  try {
    let adminUser = await prisma.user.findUnique({ where: { username: 'admin' } })
    if (!adminUser) adminUser = await prisma.user.findUnique({ where: { email: 'bunnybet42@gmail.com' } })
    if (adminUser) {
      console.log(`Found user: ${adminUser.username}`)
      await prisma.user.update({ where: { id: adminUser.id }, data: { role: 'ADMIN' } })
      console.log('User role updated to ADMIN.')
    } else {
      console.log('User not found. Creating admin user...')
      // Try to create if not exists
    }
  } catch (e) { console.error(e) }
}

main().catch((e) => { console.error(e); process.exit(1) })
