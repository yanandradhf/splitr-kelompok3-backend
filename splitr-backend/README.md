# 🚀 Splitr Backend API

Backend API untuk **Splitr by BNI** - Platform split bill dengan payment gateway BNI.

## 📋 Quick Start

### 1. Clone & Install
```bash
git clone <repository-url>
cd splitr-backend
npm install
```

### 2. Setup Database
```bash
# Start PostgreSQL dengan Docker
docker-compose up -d

# Setup database schema
npx prisma generate
npx prisma db push

# Seed dengan data dummy
npm run db:seed
```

### 3. Start Server
```bash
# Development mode
npm run dev

# Server akan jalan di: http://localhost:3000
```

### 4. Test API
```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"OK","database":"connected","stats":{...}}
```

## 🧪 Testing dengan Postman

### Import Collection
1. Buka Postman
2. Import file: `postman/Splitr-Complete-EndToEnd.postman_collection.json`
3. Collection sudah include semua endpoint + dokumentasi

### Test Flow
1. **Authentication** → Login dengan user: `citra`, password: `password123`
2. **Categories** → Get categories (auto-save ke variables)
3. **Bills** → Create bill → Add participants → Payment
4. **Friends** → Search user → Add friend
5. **Notifications** → Check notifications

## 👥 Pre-seeded Users

| Username | Name | Password | PIN | BNI Account |
|----------|------|----------|-----|-------------|
| `citra` | Citra Panjaitan | `password123` | `123456` | 1935826578 |
| `ahmad` | Ahmad Sutanto | `password123` | `123456` | 1234567890 |
| `budi` | Budi Santoso | `password123` | `123456` | 0987654321 |
| `ilham` | Ilham Kawil | `password123` | `123456` | 1978654321 |
| `nabila` | Nabila Ulhaq | `password123` | `123456` | 1954219065 |

## 🗄️ Database

### Access Database
```bash
# Prisma Studio (GUI)
npx prisma studio
# Buka: http://localhost:5555

# Direct PostgreSQL
docker exec -it splitr-postgres psql -U splitr_user -d splitr_db
```

### Reset Database
```bash
npx prisma db push --force-reset
npm run db:seed
```

## 🎯 Main Endpoints

### Authentication
```
POST /api/mobile/auth/login
POST /api/mobile/auth/register
POST /api/mobile/auth/send-otp
POST /api/mobile/auth/verify-otp
```

### Bills
```
POST /api/mobile/bills/create
GET  /api/mobile/bills/:id
POST /api/mobile/bills/:id/add-participant-by-username
POST /api/mobile/bills/join-by-username
```

### Payments
```
POST /api/mobile/payments/verify-pin
POST /api/mobile/payments/pay
POST /api/mobile/payments/schedule
GET  /api/mobile/payments/history
```

### Friends
```
GET  /api/mobile/friends
GET  /api/mobile/friends/search?username=x
POST /api/mobile/friends/add
```

## 🔧 Development Commands

```bash
# Development server (auto-reload)
npm run dev

# Database commands
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
npm run db:seed        # Seed dummy data

# Docker commands
docker-compose up -d   # Start database
docker-compose down    # Stop database
docker logs splitr-postgres  # View logs
```

## 📁 Project Structure

```
splitr-backend/
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.js               # Data seeder
│   └── seeders/              # Seeder modules
├── routes/
│   ├── mobile/               # Mobile API routes
│   │   ├── auth.routes.js
│   │   ├── bill.routes.js
│   │   ├── payment.routes.js
│   │   └── ...
│   └── admin/                # Admin API routes
├── middleware/               # Auth & validation
├── services/                 # External services
├── postman/                  # API collection
├── docker-compose.yml        # PostgreSQL setup
├── .env                      # Environment config
└── package.json
```

## 🚨 Troubleshooting

### Database Connection Error
```bash
# Check if PostgreSQL running
docker ps

# Restart database
docker-compose down && docker-compose up -d
```

### Port 3000 Already in Use
```bash
# Find process
lsof -i :3000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

### No Data in Database
```bash
# Re-seed database
npm run db:seed

# Verify in Prisma Studio
npx prisma studio
```

## 🌐 Environment Variables

```env
DATABASE_URL="postgresql://splitr_user:splitr_pass@localhost:5432/splitr_db"
PORT=3000
NODE_ENV="development"
JWT_SECRET="splitr_secret_key"
```

## 📊 Expected Data After Seeding

- **Users**: 5 test users dengan friendship
- **Categories**: 4 categories (Food, Entertainment, Transport, Other)
- **BNI Accounts**: Dengan saldo untuk testing payment
- **Sample Data**: 22,000+ realistic transactions

## 🎯 Testing Scenarios

### 1. Complete Bill Flow
1. Login sebagai host (citra)
2. Create bill dengan items
3. Add participant (ahmad) dengan item assignment
4. Ahmad login → join bill → payment
5. Check payment history

### 2. Friend Management
1. Login sebagai citra
2. Search user "ahmad"
3. Add ahmad sebagai friend
4. Verify friendship created

### 3. Payment Flow
1. Verify PIN (123456)
2. Make instant payment
3. Schedule future payment
4. Check payment history & balance

## 📞 Support

**Issues?** Check troubleshooting section atau create GitHub issue.

**Next Steps:**
1. ✅ Backend API (current)
2. 🔄 Admin Dashboard (React)
3. 🔄 Mobile App (React Native)

---
**Built by Kelompok 3 - Splitr by BNI**