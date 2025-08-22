# 📋 Frontend Requirements - Bills API

## 🎯 **Backend Sudah Siap, Frontend Harus Kirim Data Seperti Ini:**

### **1. Create Bill Request Format**

**Endpoint:** `POST /api/mobile/bills/create`

**Request Body yang HARUS dikirim frontend:**

```json
{
  "billName": "warmindo",
  "categoryId": "cat_food_001", // Wajib pakai categoryId, bukan string
  "totalAmount": 185130,
  "maxPaymentDate": "2024-01-16T10:00:00Z", // Wajib ISO string
  "allowScheduledPayment": false, // false untuk PAY_NOW, true untuk PAY_LATER
  "splitMethod": "custom",
  "currency": "IDR",
  
  "items": [
    {
      "itemName": "ayam bakar",
      "price": 18000,
      "quantity": 3,
      "category": "food_item", // food_item, beverage, sharing_item
      "isSharing": false,
      "isVerified": true
    },
    {
      "itemName": "gurame satu ekor",
      "price": 85000,
      "quantity": 1,
      "category": "sharing_item",
      "isSharing": true,
      "isVerified": true
    }
  ],
  
  "participants": [
    {
      "username": "akmal", // Wajib username, bukan UUID
      "items": [
        {
          "itemIndex": 0, // Index dari items array di atas
          "quantity": 1,
          "amount": 18000 // Untuk sharing items, ini amount portion
        },
        {
          "itemIndex": 1,
          "quantity": 1,
          "amount": 28333 // Portion dari sharing item
        }
      ]
    }
  ],
  
  "fees": {
    "taxPct": 10,
    "servicePct": 0,
    "discountPct": 10,
    "discountNominal": 0
  }
}
```

### **2. Payment Method Mapping**

**Frontend → Backend:**

```javascript
// PAY_NOW
{
  "maxPaymentDate": "2024-01-16T10:00:00Z", // 24 jam dari sekarang
  "allowScheduledPayment": false
}

// PAY_LATER  
{
  "maxPaymentDate": "2024-12-31T23:59:59Z", // Custom date
  "allowScheduledPayment": true
}
```

### **3. Category Mapping**

**Frontend harus ambil categoryId dulu:**

```javascript
// GET /api/mobile/categories
{
  "categories": [
    {
      "categoryId": "cat_food_001",
      "categoryName": "Food",
      "categoryIcon": "🍽️"
    },
    {
      "categoryId": "cat_entertainment_001", 
      "categoryName": "Entertainment",
      "categoryIcon": "🎬"
    }
  ]
}
```

### **4. Username Mapping**

**Frontend harus convert UUID ke username:**

```javascript
// Single user
// GET /api/mobile/users/{userId}/username
{
  "userId": "d23866f8-1ab1-4f31-8d39-a2cd3a4b8662",
  "username": "akmal",
  "name": "Akmal Fadhil"
}

// Batch users
// POST /api/mobile/users/batch-usernames
{
  "userIds": ["uuid1", "uuid2"]
}
// Response:
{
  "users": {
    "uuid1": {
      "username": "akmal", 
      "name": "Akmal Fadhil"
    }
  }
}
```

## 🔄 **Frontend Transformation Required**

### **Yang Harus Frontend Ubah:**

1. **Category:** `"Food and Beverage"` → `"cat_food_001"`
2. **Member IDs:** `"d23866f8-..."` → `"akmal"`  
3. **Item IDs:** `"kupckjc0x6e"` → `itemIndex: 0`
4. **Payment Method:** `"PAY_NOW"` → `maxPaymentDate + allowScheduledPayment`
5. **Assignments:** Group by member, convert to itemIndex

### **Contoh Transformation Function:**

```javascript
const transformToBackend = async (frontendData) => {
  // 1. Get category ID
  const categories = await fetch('/api/mobile/categories').then(r => r.json());
  const categoryId = categories.categories.find(c => 
    frontendData.category.includes(c.categoryName)
  )?.categoryId;

  // 2. Get usernames
  const userIds = frontendData.selectedMembers;
  const userMap = await fetch('/api/mobile/users/batch-usernames', {
    method: 'POST',
    body: JSON.stringify({ userIds })
  }).then(r => r.json());

  // 3. Transform items
  const items = frontendData.items.map(item => ({
    itemName: item.name,
    price: item.price,
    quantity: item.qty,
    category: item.isSharing ? "sharing_item" : "food_item",
    isSharing: item.isSharing,
    isVerified: true
  }));

  // 4. Group assignments by member
  const memberAssignments = {};
  frontendData.assignments.forEach(assignment => {
    if (assignment.memberId === "host") return;
    
    const username = userMap.users[assignment.memberId]?.username;
    if (!username) return;
    
    if (!memberAssignments[username]) {
      memberAssignments[username] = [];
    }
    
    const itemIndex = frontendData.items.findIndex(item => item.id === assignment.itemId);
    const item = frontendData.items[itemIndex];
    
    memberAssignments[username].push({
      itemIndex,
      quantity: item.isSharing ? 1 : assignment.shareQty,
      amount: item.isSharing ? assignment.shareQty : (item.price * assignment.shareQty)
    });
  });

  // 5. Build participants
  const participants = Object.keys(memberAssignments).map(username => ({
    username,
    items: memberAssignments[username]
  }));

  // 6. Payment deadline
  const maxPaymentDate = frontendData.paymentMethod === "PAY_NOW"
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    : frontendData.dueDate;

  return {
    billName: frontendData.billName,
    categoryId,
    totalAmount: frontendData.totals.grandTotal,
    maxPaymentDate,
    allowScheduledPayment: frontendData.paymentMethod === "PAY_LATER",
    splitMethod: "custom",
    currency: "IDR",
    items,
    participants,
    fees: frontendData.fees
  };
};
```

## 📋 **Complete Postman Examples**

### **1. Get Categories First**
```
GET {{base_url}}/api/mobile/categories
Authorization: Bearer {{token}}
```

### **2. Get Username Mapping**
```
POST {{base_url}}/api/mobile/users/batch-usernames
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "userIds": ["d23866f8-1ab1-4f31-8d39-a2cd3a4b8662"]
}
```

### **3. Create Bill (PAY_NOW)**
```
POST {{base_url}}/api/mobile/bills/create
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "billName": "warmindo",
  "categoryId": "cat_food_001",
  "totalAmount": 185130,
  "maxPaymentDate": "2024-01-16T10:00:00Z",
  "allowScheduledPayment": false,
  "splitMethod": "custom",
  "currency": "IDR",
  "items": [
    {
      "itemName": "ayam bakar",
      "price": 18000,
      "quantity": 3,
      "category": "food_item",
      "isSharing": false,
      "isVerified": true
    },
    {
      "itemName": "gurame satu ekor",
      "price": 85000,
      "quantity": 1,
      "category": "sharing_item", 
      "isSharing": true,
      "isVerified": true
    }
  ],
  "participants": [
    {
      "username": "akmal",
      "items": [
        {
          "itemIndex": 0,
          "quantity": 1,
          "amount": 18000
        },
        {
          "itemIndex": 1,
          "quantity": 1,
          "amount": 28333
        }
      ]
    }
  ],
  "fees": {
    "taxPct": 10,
    "servicePct": 0,
    "discountPct": 10,
    "discountNominal": 0
  }
}
```

### **4. Create Bill (PAY_LATER)**
```
POST {{base_url}}/api/mobile/bills/create
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "billName": "dinner party",
  "categoryId": "cat_food_001",
  "totalAmount": 500000,
  "maxPaymentDate": "2024-12-31T23:59:59Z",
  "allowScheduledPayment": true,
  "splitMethod": "custom",
  "currency": "IDR",
  "items": [
    {
      "itemName": "steak",
      "price": 150000,
      "quantity": 2,
      "category": "food_item",
      "isSharing": false,
      "isVerified": true
    }
  ],
  "participants": [
    {
      "username": "ilham",
      "items": [
        {
          "itemIndex": 0,
          "quantity": 1,
          "amount": 150000
        }
      ]
    }
  ],
  "fees": {
    "taxPct": 11,
    "servicePct": 5,
    "discountPct": 0,
    "discountNominal": 0
  }
}
```

## ⚠️ **Frontend WAJIB Lakukan:**

1. ✅ **Ambil categories** dulu sebelum create bill
2. ✅ **Convert UUID ke username** sebelum kirim participants  
3. ✅ **Gunakan itemIndex** bukan custom item IDs
4. ✅ **Set maxPaymentDate** sesuai payment method
5. ✅ **Group assignments** per participant
6. ✅ **Hitung amount** untuk sharing items

## 🔔 **Notification Flow (Otomatis dari Backend):**

1. **Create bill success** → Backend kirim `bill_assignment` notifications
2. **Participants dapat notif** → "You have items in 'warmindo' - Rp 46,333"
3. **Tap notification** → Frontend navigate ke bill detail
4. **Get bill detail** → `GET /api/mobile/bills/{billId}`
5. **Payment deadline** → Backend auto-expire setelah deadline
6. **Status tracking** → Host bisa lihat siapa yang sudah bayar

**Backend sudah handle semua logic, frontend tinggal kirim data sesuai format ini!** 🚀