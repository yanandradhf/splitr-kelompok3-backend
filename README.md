# 🚀 Splitr Backend - Admin API

Backend API untuk **Splitr by BNI** - Platform split bill dengan payment gateway BNI.

## 📊 Features

### **Admin Dashboard API:**

- ✅ **Dashboard Summary** - Transaction stats, success rate, amounts
- ✅ **Charts Data** - Transaction trends, payment methods, categories
- ✅ **Transaction Management** - List, search, filter, detail
- ✅ **Geographic Analytics** - Branch-to-branch transfer analysis
- ✅ **Category Analytics** - Food, Beverage, Entertainment, Transport

### **Database:**

- ✅ **Users & Groups** - User management with BNI accounts
- ✅ **Bills & Items** - Bill creation with OCR support
- ✅ **Payments** - Instant & scheduled payments
- ✅ **Analytics** - Pre-seeded with 20,000+ realistic transactions
- ✅ **Geotagging** - BNI branch mapping for location insights

---

## 🔧 **Quick Setup (Gess)**

### **Prerequisites:**

- **Node.js** (v18+) - [Download](https://nodejs.org/)
- **Docker** - [Download](https://docker.com/get-started)
- **Git** - [Download](https://git-scm.com/)

### **1. Clone Repository**

```bash
git clone [repository-url]
cd splitr-backend
```

### **2. Install Dependencies**

```bash
npm install
```

### **3. Setup Environment**

```bash
# Copy environment template
cp .env.example .env

# Edit .env file if needed (default values should work)
```

**Default .env:**

```env
DATABASE_URL="postgresql://splitr_user:splitr_pass@localhost:5432/splitr_db"
PORT=3000
NODE_ENV="development"
```

### **4. Start Database**

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Verify database is running
docker ps
```

### **5. Setup Database Schema**

```bash
# Generate Prisma client
npx prisma generate

# Create database tables
npx prisma db push

# Seed with dummy data (20,000+ transactions)
npm run db:seed
```

### **6. Start Server**

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### **7. Verify Setup**

Open browser to: `http://localhost:3000/health`

**Expected Response:**

```json
{
  "status": "OK",
  "database": "connected",
  "stats": {
    "total_users": 7,
    "total_transactions": 22628,
    "total_amount": 2262800000
  }
}
```

---

## 🎯 **API Endpoints**

### **Base URL:** `http://localhost:3000`

### **Health Check:**

```
GET /health
```

### **Dashboard APIs:**

```
GET /api/admin/dashboard/summary
GET /api/admin/dashboard/charts/transactions?period=7
GET /api/admin/dashboard/charts/payment-methods
GET /api/admin/dashboard/charts/categories
```

### **Transaction APIs:**

```
GET /api/admin/transactions?page=1&limit=10
GET /api/admin/transactions?search=Citra
GET /api/admin/transactions?status=completed
GET /api/admin/transactions/:id
```

### **Analytics APIs:**

```
GET /api/admin/analytics/geographic
```

---

## 🗄️ **Database Access**

### **Prisma Studio (Database GUI):**

```bash
npx prisma studio
```

Opens: `http://localhost:5555` - Visual database browser

### **Direct PostgreSQL Access:**

```bash
# Using Docker exec
docker exec -it splitr-postgres psql -U splitr_user -d splitr_db

# Example queries:
SELECT COUNT(*) FROM payments;
SELECT * FROM users LIMIT 5;
SELECT category_name, COUNT(*) FROM bills
JOIN bill_categories ON bills.category_id = bill_categories.category_id
GROUP BY category_name;
```

### **Database Reset (if needed):**

```bash
# Reset database and re-seed
npx prisma db push --force-reset
npm run db:seed
```

---

## 📊 **Pre-seeded Data**

### **Users:** 7 realistic users

- Citra Panjaitan (1935826578)
- Ilham Kawil (1978654321)
- Nabila Ulhaq (1954219065)
- Hans Sye (1765324215)
- Yanan Isdi (1954219066)
- Diyaa Noventino (1423675943)
- Ivan Luthfian (1478567892)

### **Categories:**

- 🍽️ Food
- 🥤 Beverage
- 🎬 Entertainment
- 🚗 Transport
- 📦 Other

### **BNI Branches:**

- Jakarta Thamrin (001)
- Jakarta Kemang (002)
- Jakarta Kelapa Gading (003)
- Bandung Dago (004)
- Surabaya Darmo (005)

### **Statistics:**

- **22,000+ transactions** (realistic daily patterns)
- **94.2% success rate** (matching dashboard mockup)
- **Rp 2.2B+ total amount**
- **Geographic distribution** across 5 cities
- **Category distribution** across all types

---

## 🧪 **Testing dengan Postman**

### **Import Collection:**

1. Download: [Postman Collection](./postman/Splitr-Admin-API.postman_collection.json)
2. Import ke Postman
3. Set Environment Variable: `base_url = http://localhost:3000`

### **Quick Test Sequence:**

```
1. GET /health                              → Verify server
2. GET /api/admin/dashboard/summary         → Dashboard stats
3. GET /api/admin/transactions?limit=5      → Transaction list
4. GET /api/admin/dashboard/charts/categories → Category chart
5. GET /api/admin/analytics/geographic      → Geographic data
```

---

## 🔧 **Development Commands**

```bash
# Development server (auto-reload)
npm run dev

# Production server
npm start

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed dummy data

# Database reset
npx prisma db push --force-reset
npm run db:seed
```

---

## 🐳 **Docker Commands**

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker logs splitr-postgres

# Database shell
docker exec -it splitr-postgres psql -U splitr_user -d splitr_db

# Reset everything
docker-compose down -v
docker-compose up -d
npx prisma db push
npm run db:seed
```

---

## 📁 **Project Structure**

```
splitr-backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.js               # Dummy data seeder
├── routes/
│   ├── index.js              # Basic routes
│   └── admin.js              # Admin API routes
├── bin/
│   └── www                   # Server startup
├── app.js                    # Main application
├── docker-compose.yml        # PostgreSQL container
├── .env                      # Environment variables
└── package.json              # Dependencies & scripts
```

---

## 🚨 **Troubleshooting**

### **Database Connection Error:**

```bash
# Check if PostgreSQL is running
docker ps

# Restart database
docker-compose down
docker-compose up -d

# Check logs
docker logs splitr-postgres
```

### **Port 3000 Already in Use:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### **Prisma Client Error:**

```bash
# Regenerate Prisma client
npx prisma generate

# Reset database
npx prisma db push --force-reset
npm run db:seed
```

### **No Data in Database:**

```bash
# Re-seed database
npm run db:seed

# Verify data
npx prisma studio
# Check: http://localhost:5555
```

---

## 🎯 **Expected Dashboard Stats**

Setelah seeding berhasil, endpoint `/api/admin/dashboard/summary` harus return:

```json
{
  "today": {
    "transaction_count": 1200+,
    "amount_split": 45000000+,
    "success_rate": 94.2,
    "failed_rate": 5.8
  },
  "all_time": {
    "total_transactions": 22000+,
    "total_amount": 2200000000+
  }
}
```

---

## 📞 **Contact**

**Issues?** Create GitHub issue atau contact developer.

**Next Steps:**

1. ✅ **Backend API** (current)
2. 🔄 **Admin Dashboard** (React web)
3. 🔄 **Mobile App** (React Native)

---

## 📄 **License**

MIT License - Build by Kelompok 3
