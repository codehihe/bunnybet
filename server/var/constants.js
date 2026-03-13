module.exports = Object.freeze({
    // Mailtrap or other SMTP service credentials
    AUTH_USER: "38cabd4f0edb2c", // Your Mailtrap/SMTP User
    AUTH_PASS: "63dd4646fd5fc0", // Your Mailtrap/SMTP Password
    
    // Gmail credentials
    // Note: For Gmail, you must use an App Password, not your login password.
    // 1. Go to your Google Account -> Security.
    // 2. Enable 2-Step Verification.
    // 3. Search for "App Passwords" and create one.
    // 4. Use that generated 16-character password here.
    GMAIL_PASS: "sdofrhdqyquadtws", 
    AUTH_FROM: "bunnybet42@gmail.com",

    SECRET_KEY: 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3',
    SECRET_KEY_JWT: "hello friend",

    // This array is legacy and appears unused as the application now uses Prisma.
    // Prisma configuration is located in server/lib/prisma.js and .env files.
    /*
    DATABASE: [
        {
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'bunnybetdatabase',
            sql: "SELECT * FROM casino_users",
        },
    ],
    */
})
