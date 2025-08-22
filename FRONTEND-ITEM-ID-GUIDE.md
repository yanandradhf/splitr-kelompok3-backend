# 🆔 Frontend Item ID Generation Guide

## 🎯 **Frontend Generate Item IDs (Recommended)**

### **Frontend harus generate unique item IDs sendiri:**

```javascript
// Frontend generate item IDs
const generateItemId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `item_${timestamp}_${random}`;
};

// Saat user add item
const addItem = (itemName, price, quantity) => {
  const newItem = {
    tempItemId: generateItemId(), // Frontend generated
    itemName,
    price,
    quantity,
    isSharing: false
  };
  
  setItems([...items, newItem]);
};
```

## 📋 **Backend Request Format (Updated)**

### **Create Bill dengan Frontend Item IDs:**

```json
{
  "billName": "warmindo",
  "totalAmount": 185130,
  "items": [
    {
      "tempItemId": "item_1704123456789_abc123",
      "itemName": "ayam bakar",
      "price": 18000,
      "quantity": 3,
      "category": "food_item",
      "isSharing": false,
      "isVerified": true
    },
    {
      "tempItemId": "item_1704123456790_def456", 
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
          "tempItemId": "item_1704123456789_abc123",
          "quantity": 1,
          "amount": 18000
        },
        {
          "tempItemId": "item_1704123456790_def456",
          "quantity": 1,
          "amount": 28333
        }
      ]
    }
  ]
}
```

## 🔄 **Frontend Assignment Logic:**

```javascript
// Frontend assignment dengan temp IDs
const assignItemToMember = (tempItemId, memberId, quantity, amount) => {
  const newAssignment = {
    tempItemId, // Frontend generated ID
    memberId,
    quantity,
    amount
  };
  
  setAssignments([...assignments, newAssignment]);
};

// Transform untuk backend
const transformForBackend = (billData) => {
  // Group assignments by member
  const memberAssignments = {};
  
  billData.assignments.forEach(assignment => {
    if (assignment.memberId === "host") return;
    
    if (!memberAssignments[assignment.memberId]) {
      memberAssignments[assignment.memberId] = [];
    }
    
    memberAssignments[assignment.memberId].push({
      tempItemId: assignment.tempItemId, // Use temp ID
      quantity: assignment.quantity,
      amount: assignment.amount
    });
  });
  
  // Convert to participants array
  const participants = Object.keys(memberAssignments).map(memberId => ({
    username: getUsernameByMemberId(memberId),
    items: memberAssignments[memberId]
  }));
  
  return {
    billName: billData.billName,
    totalAmount: billData.totalAmount,
    items: billData.items.map(item => ({
      tempItemId: item.tempItemId,
      itemName: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.isSharing ? "sharing_item" : "food_item",
      isSharing: item.isSharing,
      isVerified: true
    })),
    participants
  };
};
```

## 🎯 **Backend Response (Updated):**

```json
{
  "success": true,
  "billId": "bill_123",
  "billCode": "B123456",
  "items": [
    {
      "itemId": "uuid-generated-by-backend",
      "tempItemId": "item_1704123456789_abc123",
      "itemName": "ayam bakar",
      "price": 18000,
      "quantity": 3,
      "isSharing": false
    }
  ],
  "participantsAdded": 1,
  "notificationsSent": 1
}
```

## ✅ **Keuntungan Frontend Generate IDs:**

1. **No itemIndex** - Lebih clean, tidak bergantung urutan
2. **Unique IDs** - Setiap item punya ID unik
3. **Easy tracking** - Frontend bisa track items dengan ID
4. **Flexible** - Bisa reorder items tanpa masalah
5. **Consistent** - ID tetap sama dari create sampai assign

## 📱 **Postman Example (Updated):**

```json
{
  "billName": "warmindo",
  "items": [
    {
      "tempItemId": "item_1704123456789_abc123",
      "itemName": "ayam bakar",
      "price": 18000,
      "quantity": 3,
      "isSharing": false
    }
  ],
  "participants": [
    {
      "username": "akmal", 
      "items": [
        {
          "tempItemId": "item_1704123456789_abc123",
          "quantity": 1,
          "amount": 18000
        }
      ]
    }
  ]
}
```

**Frontend generate IDs sendiri = Lebih clean & flexible!** 🚀