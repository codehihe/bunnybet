const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    select: { email: true, role: true }
  })
  console.log('Users:', users)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
