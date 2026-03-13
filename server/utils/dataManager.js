const fs = require('fs');
const path = require('path');
const homeData = require('../var/home');

const DATA_DIR = path.resolve(__dirname, '../json');
const MARKET_FILE = path.join(DATA_DIR, 'market.json');
const COUPONS_FILE = path.join(DATA_DIR, 'coupons.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize Market Data
if (!fs.existsSync(MARKET_FILE)) {
    fs.writeFileSync(MARKET_FILE, JSON.stringify(homeData.MARKET, null, 2));
}

// Initialize Coupons Data
if (!fs.existsSync(COUPONS_FILE)) {
    // Note: COUPONS was not exported in original home.js explicitly in all versions, 
    // but based on code read, it is there. If undefined, default to empty.
    const coupons = homeData.COUPONS || [];
    fs.writeFileSync(COUPONS_FILE, JSON.stringify(coupons, null, 2));
}

const getMarket = () => {
    try {
        const data = fs.readFileSync(MARKET_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading market data:', err);
        return homeData.MARKET;
    }
};

const saveMarket = (marketData) => {
    try {
        fs.writeFileSync(MARKET_FILE, JSON.stringify(marketData, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving market data:', err);
        return false;
    }
};

const getCoupons = () => {
    try {
        const data = fs.readFileSync(COUPONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading coupons data:', err);
        return homeData.COUPONS || [];
    }
};

const saveCoupons = (couponsData) => {
    try {
        fs.writeFileSync(COUPONS_FILE, JSON.stringify(couponsData, null, 2));
        return true;
    } catch (err) {
        console.error('Error saving coupons data:', err);
        return false;
    }
};

module.exports = {
    getMarket,
    saveMarket,
    getCoupons,
    saveCoupons
};
