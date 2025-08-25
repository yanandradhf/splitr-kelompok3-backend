# 📱 Notification API Documentation

## Base URL: `/api/mobile/notifications`

---

## 1. Get All Notifications

### **GET** `/api/mobile/notifications`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
```
page=1          // Page number (default: 1)
limit=20        // Items per page (default: 20)
unreadOnly=true // Show only unread notifications (default: false)
```

**Request Example:**
```bash
GET /api/mobile/notifications?page=1&limit=10&unreadOnly=true
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "notifications": [
    {
      "notificationId": "notif_001",
      "type": "payment_received",
      "title": "Payment Received",
      "message": "Andra Dhafa paid Rp 90.000 for Lunch Mall",
      "data": {
        "billId": "bill_123",
        "payerId": "user_456",
        "amount": 90000,
        "billName": "Lunch Mall"
      },
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "notificationId": "notif_002",
      "type": "payment_complete",
      "title": "All Payments Received",
      "message": "All participants have paid for Dinner KFC",
      "data": {
        "billId": "bill_124",
        "totalAmount": 450000,
        "participantCount": 5,
        "billName": "Dinner KFC"
      },
      "isRead": false,
      "createdAt": "2024-01-15T09:15:00.000Z"
    },
    {
      "notificationId": "notif_003",
      "type": "bill_assigned",
      "title": "New Bill Assignment",
      "message": "You've been assigned to pay Rp 75.000 for Movie Night",
      "data": {
        "billId": "bill_125",
        "amount": 75000,
        "hostName": "Citra Panjaitan",
        "billName": "Movie Night"
      },
      "isRead": true,
      "createdAt": "2024-01-14T20:45:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalPages": 3,
    "totalItems": 25,
    "unreadCount": 8
  }
}
```

---

## 2. Mark Notification as Read

### **PUT** `/api/mobile/notifications/:notificationId/read`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Example:**
```bash
PUT /api/mobile/notifications/notif_001/read
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "message": "Notification marked as read",
  "notification": {
    "notificationId": "notif_001",
    "isRead": true,
    "readAt": "2024-01-15T11:00:00.000Z"
  }
}
```

---

## 3. Mark All Notifications as Read

### **PUT** `/api/mobile/notifications/read-all`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Example:**
```bash
PUT /api/mobile/notifications/read-all
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "message": "All notifications marked as read",
  "updatedCount": 8
}
```

---

## 4. Delete Notification

### **DELETE** `/api/mobile/notifications/:notificationId`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Example:**
```bash
DELETE /api/mobile/notifications/notif_001
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response Example:**
```json
{
  "message": "Notification deleted successfully"
}
```

---

## 5. Create Notification (Testing Only)

### **POST** `/api/mobile/notifications`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "type": "payment_received",
  "title": "Payment Received",
  "message": "Andra Dhafa paid Rp 90.000 for Lunch Mall",
  "data": {
    "billId": "bill_123",
    "payerId": "user_456",
    "amount": 90000,
    "billName": "Lunch Mall"
  },
  "targetUserId": "user_789"
}
```

**Response Example:**
```json
{
  "message": "Notification created successfully",
  "notification": {
    "notificationId": "notif_004",
    "type": "payment_received",
    "title": "Payment Received",
    "message": "Andra Dhafa paid Rp 90.000 for Lunch Mall",
    "data": {
      "billId": "bill_123",
      "payerId": "user_456",
      "amount": 90000,
      "billName": "Lunch Mall"
    },
    "isRead": false,
    "createdAt": "2024-01-15T11:30:00.000Z"
  }
}
```

---

## 📋 Notification Types & Navigation

### **1. Payment Received (Host)**
```json
{
  "type": "payment_received",
  "title": "Payment Received",
  "message": "Andra Dhafa paid Rp 90.000 for Lunch Mall",
  "data": {
    "billId": "bill_123",
    "payerId": "user_456",
    "amount": 90000,
    "billName": "Lunch Mall"
  }
}
```
**Navigation:** `/bill-detail/:billId`

### **2. Payment Complete (Host)**
```json
{
  "type": "payment_complete",
  "title": "All Payments Received",
  "message": "All participants have paid for Dinner KFC",
  "data": {
    "billId": "bill_124",
    "totalAmount": 450000,
    "participantCount": 5,
    "billName": "Dinner KFC"
  }
}
```
**Navigation:** `/bill-detail/:billId`

### **3. Bill Assignment (Participant)**
```json
{
  "type": "bill_assigned",
  "title": "New Bill Assignment",
  "message": "You've been assigned to pay Rp 75.000 for Movie Night",
  "data": {
    "billId": "bill_125",
    "amount": 75000,
    "hostName": "Citra Panjaitan",
    "billName": "Movie Night"
  }
}
```
**Navigation:** `/bill-detail/:billId`

### **4. Payment Reminder (Participant)**
```json
{
  "type": "payment_reminder",
  "title": "Payment Reminder",
  "message": "Don't forget to pay Rp 120.000 for Cafe Hangout",
  "data": {
    "billId": "bill_126",
    "amount": 120000,
    "dueDate": "2024-01-20T00:00:00.000Z",
    "billName": "Cafe Hangout"
  }
}
```
**Navigation:** `/bill-detail/:billId`

### **5. Payment Overdue (Participant)**
```json
{
  "type": "payment_overdue",
  "title": "Payment Overdue",
  "message": "Your payment of Rp 85.000 for Restaurant Bill is overdue",
  "data": {
    "billId": "bill_127",
    "amount": 85000,
    "daysPastDue": 3,
    "billName": "Restaurant Bill"
  }
}
```
**Navigation:** `/bill-detail/:billId`

---

## 🔧 Error Responses

### **401 Unauthorized**
```json
{
  "error": "Access token required"
}
```

### **403 Forbidden**
```json
{
  "error": "Invalid token"
}
```

### **404 Not Found**
```json
{
  "error": "Notification not found"
}
```

### **500 Internal Server Error**
```json
{
  "error": "Failed to get notifications"
}
```

---

## 🎯 Usage Examples

### **Get Unread Notifications Only:**
```bash
GET /api/mobile/notifications?unreadOnly=true&limit=5
```

### **Pagination:**
```bash
GET /api/mobile/notifications?page=2&limit=10
```

### **Mark Notification as Read After Click:**
```bash
PUT /api/mobile/notifications/notif_001/read
```

### **Clear All Notifications:**
```bash
PUT /api/mobile/notifications/read-all
```

---

## 📱 Mobile App Integration

### **Notification Click Handler:**
```javascript
const handleNotificationClick = (notification) => {
  // Mark as read
  markAsRead(notification.notificationId);
  
  // Navigate based on type
  const { billId } = notification.data;
  navigation.navigate('BillDetail', { billId });
};
```

### **Badge Count:**
```javascript
const { unreadCount } = notificationResponse.pagination;
// Show badge with unreadCount
```

### **Real-time Updates:**
```javascript
// Use WebSocket or polling to get new notifications
// Update badge count and notification list
```