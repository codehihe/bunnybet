# Deployment Guide

This guide describes how to deploy the Casino Master application. Because the application requires persistent WebSockets for real-time multiplayer features, the recommended architecture is deploying the frontend to Vercel and the backend (server) to Railway.

## 1. Prerequisites
- A Vercel account (https://vercel.com/) for the frontend.
- A Render account (https://render.com/) for the backend and database.
- A connected GitHub repository (recommended).
- Node.js installed locally to verify build scripts.

## 2. Local Build Commands
We have added convenient commands to the root `package.json` to verify the build before deploying:

- **Install all dependencies:** `npm run install-all`
- **Update all dependencies:** `npm run update-all`
- **Build the project:** `npm run build` (Builds the React client and generates the Prisma database client in the server simultaneously).
- **Run the project locally:** `npm run dev`

## 3. Deploying the Backend (Server) to Render
1. **Create a New Web Service:**
   - Go to your Render Dashboard and click **New** -> **Web Service**.
   - Connect your GitHub repository.
2. **Configure the Service:**
   - **Name:** Enter a name for your service (e.g., `casino-backend`).
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm run build` (This runs `npx prisma generate`)
   - **Start Command:** `npm start` (This runs `node index.js`)
3. **Environment Variables:**
   - Click **Advanced** and add your environment variables:
     - `DATABASE_URL` (Your database connection string)
     - `NODE_ENV=production`
     - `PORT` (Render sets this automatically, but ensure your code uses `process.env.PORT || 5000`)
     - Razorpay keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)
     - Any other secrets from your `.env` file.
4. **Database (Optional):**
   - If you don't have a database, you can create a **PostgreSQL** (or MySQL) instance on Render as well and use its internal connection string.
5. **Finalize:**
   - Click **Create Web Service**. Render will build and deploy your backend.
   - Once deployed, you will get a URL like `https://casino-backend.onrender.com`. Use this URL for your frontend API configuration.

## 4. Deploying the Frontend (Client) to Vercel
1. Go to the Vercel Dashboard and click **Add New** -> **Project**.
2. Import your GitHub repository.
3. **Configure the Project Options:**
   - **Framework Preset:** `Create React App`
   - **Root Directory:** Edit this and select the `client` folder.
4. **Environment Variables on Vercel:**
   - Add any necessary `.env` variables for the frontend.
   - *Important:* Ensure your frontend configuration/requests are pointing to the Render public URL you generated in Step 3 (e.g., `https://casino-backend.onrender.com`).
5. Click **Deploy**. Vercel will build and deploy the React application.

## 5. Verification
Once both deployments are successful:
- Visit your newly generated Vercel frontend URL.
- Test authentication, deposits (Razorpay), and real-time game updates to confirm that the WebSocket connection to your Render backend is fully functional.
