# API Contract: Transform Frontend Data (🔄📊)

## Endpoint
```
POST /api/mobile/bill/transform-frontend-data
```

## Description
- Helper endpoint to transform frontend bill data into backend-compatible format with category mapping and participant processing.
- Endpoint helper untuk mengubah data tagihan frontend menjadi format yang kompatibel dengan backend dengan pemetaan kategori dan pemrosesan peserta.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |
| Content-Type  | string | Yes      | Must be application/json        |

### Request Body
```json
{
  "billName": "string",
  "category": "string",
  "items": [
    {
      "id": "string",
      "name": "string",
      "price": number,
      "qty": number,
      "isSharing": boolean
    }
  ],
  "selectedMembers": ["string"],
  "assignments": [
    {
      "memberId": "string",
      "itemId": "string",
      "shareQty": number
    }
  ],
  "paymentMethod": "string",
  "fees": {},
  "totals": {
    "grandTotal": number
  }
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "backendData": {
    "billName": "string",
    "categoryId": "string",
    "totalAmount": number,
    "maxPaymentDate": "ISO 8601 datetime",
    "allowScheduledPayment": boolean,
    "splitMethod": "custom",
    "currency": "IDR",
    "items": [],
    "participants": [],
    "fees": {}
  },
  "mapping": {
    "categoryId": "string",
    "userMap": {},
    "itemIdToIndex": {},
    "participantCount": number
  }
}
```

## Business Logic
- Maps frontend categories to database category IDs
- Transforms items with sharing support
- Creates participant assignments with username mapping
- Calculates payment deadlines based on payment method
- Groups assignments by member for backend processing

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Category mapping validation
- User existence validation for participants

---

# API Contract: Create Bill (📝✨)

## Endpoint
```
POST /api/mobile/bill/create
```

## Description
- Creates a new bill with items, participants, and assignments. Supports frontend-calculated breakdowns and fees.
- Membuat tagihan baru dengan item, peserta, dan penugasan. Mendukung rincian dan biaya yang dihitung frontend.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "billName": "string",
  "categoryId": "string",
  "groupId": "string",
  "totalAmount": number,
  "items": [
    {
      "itemName": "string",
      "price": number,
      "quantity": number,
      "category": "string",
      "isSharing": boolean,
      "isVerified": boolean,
      "tempItemId": "string"
    }
  ],
  "participants": [
    {
      "userId": "string",
      "items": [
        {
          "tempItemId": "string",
          "quantity": number,
          "amount": number
        }
      ],
      "breakdown": {
        "subtotal": number,
        "taxAmount": number,
        "serviceAmount": number,
        "discountAmount": number,
        "totalAmount": number
      }
    }
  ],
  "fees": {
    "taxPct": number,
    "servicePct": number,
    "discountPct": number,
    "discountNominal": number,
    "subTotal": number,
    "taxAmount": number,
    "serviceAmount": number,
    "discountAmount": number
  },
  "receiptImageUrl": "string",
  "maxPaymentDate": "ISO 8601 datetime",
  "allowScheduledPayment": boolean,
  "splitMethod": "string",
  "currency": "string"
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "billId": "string",
  "billCode": "string",
  "billName": "string",
  "totalAmount": number,
  "maxPaymentDate": "ISO 8601 datetime",
  "allowScheduledPayment": boolean,
  "splitMethod": "string",
  "currency": "string",
  "status": "string",
  "category": "string",
  "group": "string",
  "items": [],
  "host": {
    "name": "string",
    "account": "string"
  },
  "inviteLink": "string",
  "qrCodeUrl": "string",
  "fees": {},
  "calculatedByFrontend": true,
  "participantsAdded": number,
  "notificationsSent": number,
  "participantBreakdowns": []
}
```

## Business Logic
- Generates unique 8-character bill code
- Creates bill with frontend-calculated fees and breakdowns
- Supports sharing items with proportional assignments
- Auto-completes host payment if they have items
- Creates bill invite with join code and QR code
- Sends notifications to participants (excluding host)
- Creates activity logs for bill creation
- Supports temporary item IDs for frontend mapping

## Error Handling
- Comprehensive validation for all required fields
- Database transaction handling for atomicity
- Notification service integration
- Proper error classification and messaging

---

# API Contract: Get Bill Totals by Status (📊💰)

## Endpoint
```
GET /api/mobile/bill/totals
```

## Description
- Retrieves bill totals grouped by status and user role (host vs participant).
- Mengambil total tagihan yang dikelompokkan berdasarkan status dan peran pengguna (host vs peserta).

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": [
    {
      "status": "string",
      "isHost": boolean,
      "totalAmount": number,
      "billCount": number
    }
  ]
}
```

## Business Logic
- Groups bills by status (active, completed, cancelled)
- Separates totals by user role (host vs participant)
- Calculates total amounts and bill counts
- Includes bills where user is either host or participant

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Aggregation error handling

---

# API Contract: Get Bill Activity (📋🔄)

## Endpoint
```
GET /api/mobile/bill/activity
```

## Description
- Retrieves comprehensive bill activity with detailed participant information and payment summaries.
- Mengambil aktivitas tagihan komprehensif dengan informasi peserta terperinci dan ringkasan pembayaran.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "data": {
    "active": {
      "hosted": [],
      "joined": []
    },
    "completed": {
      "hosted": [],
      "joined": []
    }
  },
  "summary": {
    "total": number,
    "byStatus": {
      "active": number,
      "completed": number,
      "cancelled": number
    },
    "byRole": {
      "hosted": number,
      "joined": number
    }
  }
}
```

## Business Logic
- Groups bills by status and role (hosted vs joined)
- Includes comprehensive bill details with items and participants
- Calculates payment summaries and completion rates
- Shows item assignments and participant payment status
- Provides activity summary statistics

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Complex query error handling

---

# API Contract: Join Bill (🤝📋)

## Endpoint
```
POST /api/mobile/bill/join
```

## Description
- Allows users to join an active bill using bill code with security validation.
- Memungkinkan pengguna bergabung dengan tagihan aktif menggunakan kode tagihan dengan validasi keamanan.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Request Body
```json
{
  "billCode": "string"
}
```

## Response

### Success Response (200 OK)
```json
{
  "message": "Successfully joined bill",
  "billId": "string",
  "billName": "string",
  "totalAmount": number,
  "yourShare": number,
  "totalParticipants": number,
  "maxPaymentDate": "ISO 8601 datetime",
  "allowScheduledPayment": boolean,
  "host": {
    "name": "string",
    "account": "string"
  },
  "items": []
}
```

## Business Logic
- Validates bill code and active status
- Checks user is not already a participant
- Requires invitation or friendship with host for security
- Recalculates equal split for all participants
- Updates invite usage statistics
- Creates join logs and activity records
- Sends notifications to host about new participant

## Error Handling
- Bill existence and status validation
- Duplicate participation prevention
- Security validation (invitation/friendship required)
- Database transaction handling

---

# API Contract: Get Personal Bill Detail (👤📋)

## Endpoint
```
GET /api/mobile/bill/personal/:identifier
```

## Description
- Retrieves personal bill view for participants with their assigned items and payment information.
- Mengambil tampilan tagihan personal untuk peserta dengan item yang ditugaskan dan informasi pembayaran.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Path Parameters
| Parameter  | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| identifier | string | Yes      | Bill ID or bill code           |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "viewType": "personal",
  "bill": {
    "billId": "string",
    "billCode": "string",
    "billName": "string",
    "totalBillAmount": number,
    "yourShare": number,
    "paymentStatus": "string",
    "paidAt": "ISO 8601 datetime",
    "category": "string",
    "hostName": "string",
    "hostAccount": "string",
    "paymentDeadline": "ISO 8601 datetime",
    "isExpired": boolean,
    "canSchedule": boolean,
    "myItems": [],
    "itemCount": number,
    "myBreakdown": {
      "subtotal": number,
      "taxAmount": number,
      "serviceAmount": number,
      "discountAmount": number,
      "totalAfterFees": number,
      "sharePercentage": number
    },
    "billBreakdown": {},
    "actions": {
      "canPay": boolean,
      "canSchedule": boolean,
      "showDeadline": boolean,
      "isPaid": boolean,
      "isFailed": boolean,
      "isScheduled": boolean,
      "isOverdue": boolean
    },
    "createdAt": "ISO 8601 datetime"
  }
}
```

## Business Logic
- Shows only user's assigned items and amounts
- Calculates personal breakdown from database values
- Determines available actions based on payment status
- Handles payment deadline calculations
- Supports both bill ID and bill code lookup
- Shows share percentage of total bill

## Error Handling
- Bill existence validation
- Participant authorization check
- Database connection validation

---

# API Contract: Get My Activity (📱🔄)

## Endpoint
```
GET /api/mobile/bill/my-activity
```

## Description
- Retrieves comprehensive activity view showing all bills where user is host or participant with detailed status information.
- Mengambil tampilan aktivitas komprehensif yang menunjukkan semua tagihan di mana pengguna adalah host atau peserta dengan informasi status terperinci.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Query Parameters
| Parameter | Type   | Required | Default | Description                    |
|-----------|--------|----------|---------|--------------------------------|
| status    | string | No       | all     | Filter by bill status          |
| limit     | number | No       | 20      | Number of items per page       |
| offset    | number | No       | 0       | Pagination offset              |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "myActivity": [
    {
      "billId": "string",
      "billCode": "string",
      "billName": "string",
      "totalBillAmount": number,
      "yourShare": number,
      "paymentStatus": "string",
      "paymentStatusDisplay": "string",
      "paidAt": "ISO 8601 datetime",
      "category": "string",
      "hostName": "string",
      "hostAccount": "string",
      "paymentDeadline": "ISO 8601 datetime",
      "isExpired": boolean,
      "canSchedule": boolean,
      "isHost": boolean,
      "role": "string",
      "participantCount": number,
      "myItems": [],
      "itemCount": number,
      "myBreakdown": {},
      "billBreakdown": {},
      "participantsStatus": [],
      "paymentSummary": {},
      "actions": {},
      "status": "string",
      "createdAt": "ISO 8601 datetime"
    }
  ],
  "pagination": {
    "total": number,
    "limit": number,
    "offset": number,
    "hasMore": boolean
  }
}
```

## Business Logic
- Shows bills where user is either host or participant
- Provides different data based on user role
- For hosts: shows participant payment status and summaries
- For participants: shows personal items and payment actions
- Handles overdue status display
- Supports status filtering and pagination
- Calculates payment summaries from database values

## Error Handling
- JWT validation with proper error classification
- Status filter validation
- Pagination parameter validation
- Database connection validation

---

# API Contract: Get Master Bill Detail (🏢📋)

## Endpoint
```
GET /api/mobile/bill/master/:identifier
```

## Description
- Retrieves complete bill view with all participants, items, assignments, and payment history for administrative purposes.
- Mengambil tampilan tagihan lengkap dengan semua peserta, item, penugasan, dan riwayat pembayaran untuk tujuan administratif.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Path Parameters
| Parameter  | Type   | Required | Description                    |
|------------|--------|----------|--------------------------------|
| identifier | string | Yes      | Bill ID or bill code           |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "viewType": "master",
  "bill": {
    "billId": "string",
    "billCode": "string",
    "billName": "string",
    "totalAmount": number,
    "maxPaymentDate": "ISO 8601 datetime",
    "allowScheduledPayment": boolean,
    "status": "string",
    "splitMethod": "string",
    "currency": "string",
    "receiptImageUrl": "string",
    "paymentDeadline": "ISO 8601 datetime",
    "isExpired": boolean,
    "fees": {},
    "category": {},
    "group": {},
    "host": {},
    "isHost": boolean,
    "userRole": "string",
    "items": [],
    "participants": [],
    "yourShare": number,
    "yourStatus": "string",
    "paymentSummary": {
      "totalParticipants": number,
      "completedCount": number,
      "pendingCount": number,
      "scheduledCount": number,
      "failedCount": number,
      "totalPaid": number,
      "totalPending": number,
      "totalScheduled": number,
      "totalFailed": number,
      "remainingAmount": number,
      "completionPercentage": number
    },
    "paymentHistory": {
      "completed": []
    },
    "inviteInfo": {},
    "createdAt": "ISO 8601 datetime",
    "updatedAt": "ISO 8601 datetime"
  }
}
```

## Business Logic
- Provides complete bill overview for hosts and administrators
- Shows all participants with detailed breakdown information
- Includes comprehensive payment summaries and statistics
- Shows item assignments for all participants
- Includes payment history and invite information
- Calculates completion percentages and remaining amounts
- Supports both bill ID and bill code lookup

## Error Handling
- Bill existence validation
- User role determination
- Database connection validation
- Complex query error handling

---

# API Contract: Add Participant by Username (👥➕)

## Endpoint
```
POST /api/mobile/bill/:billId/add-participant-by-username
```

## Description
- Adds a participant to a bill by username with item assignments and automatic amount calculation.
- Menambahkan peserta ke tagihan berdasarkan username dengan penugasan item dan perhitungan jumlah otomatis.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Path Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| billId    | string | Yes      | Unique bill identifier |

### Request Body
```json
{
  "username": "string",
  "items": [
    {
      "itemId": "string",
      "quantity": number
    }
  ]
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "User added as friend",
  "participant": {
    "userId": "string",
    "username": "string",
    "name": "string",
    "type": "string",
    "totalAmount": number,
    "itemCount": number
  },
  "billCode": "string"
}
```

## Business Logic
- Only bill host can add participants
- Finds user by username (case-insensitive)
- Prevents duplicate participants
- Determines participant type (host/friend/guest)
- Calculates total amount from assigned items
- Host participants get completed payment status
- Creates notifications based on participant type
- Creates activity logs for tracking

## Error Handling
- Bill ownership validation
- Username existence validation
- Duplicate participant prevention
- Item existence validation
- Database transaction handling

---

# API Contract: Re-assign Items to Participant (🔄📝)

## Endpoint
```
PUT /api/mobile/bill/:billId/participant/:participantId/assign-items
```

## Description
- Re-assigns items to a specific participant with automatic amount calculation and status updates.
- Menugaskan ulang item ke peserta tertentu dengan perhitungan jumlah otomatis dan pembaruan status.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Path Parameters
| Parameter     | Type   | Required | Description                    |
|---------------|--------|----------|--------------------------------|
| billId        | string | Yes      | Unique bill identifier         |
| participantId | string | Yes      | Unique participant identifier  |

### Request Body
```json
{
  "items": [
    {
      "itemId": "string",
      "quantity": number
    }
  ]
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Participant items re-assigned successfully",
  "participant": {
    "participantId": "string",
    "userId": "string",
    "name": "string",
    "account": "string",
    "amountShare": number,
    "paymentStatus": "string",
    "itemCount": number
  },
  "totalAmountReassigned": number
}
```

## Business Logic
- Only bill host can re-assign items
- Validates participant belongs to the bill
- Deletes existing assignments before creating new ones
- Calculates amounts from item prices and quantities
- Updates participant's total amount share
- Host participants get completed payment status
- Creates notifications for assignment updates
- Creates activity logs for tracking

## Error Handling
- Bill ownership validation
- Participant existence validation
- Item existence validation
- Database transaction handling
- Comprehensive error messaging

---

# API Contract: Get Item Assignments (📋🔍)

## Endpoint
```
GET /api/mobile/bill/:billId/assignments
```

## Description
- Retrieves detailed item assignments for a bill showing who is assigned to what items.
- Mengambil penugasan item terperinci untuk tagihan yang menunjukkan siapa yang ditugaskan ke item apa.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Path Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| billId    | string | Yes      | Unique bill identifier |

## Response

### Success Response (200 OK)
```json
{
  "billId": "string",
  "billName": "string",
  "totalAmount": number,
  "yourShare": number,
  "yourItems": [
    {
      "itemName": "string",
      "quantity": number,
      "amount": number,
      "isSharing": boolean,
      "displayQuantity": number,
      "displayAmount": number
    }
  ],
  "allItems": [
    {
      "itemId": "string",
      "itemName": "string",
      "price": number,
      "quantity": number,
      "isSharing": boolean,
      "assignments": [
        {
          "participantName": "string",
          "quantity": number,
          "amount": number,
          "isSharedPortion": boolean
        }
      ]
    }
  ],
  "participants": [
    {
      "participantId": "string",
      "name": "string",
      "amountShare": number,
      "paymentStatus": "string"
    }
  ]
}
```

## Business Logic
- Shows user's personal item assignments
- Displays all items with their assignments to all participants
- Handles sharing items with proportional display
- Shows participant payment status
- Only accessible to bill participants or host
- Calculates display quantities for shared items

## Error Handling
- Bill existence validation
- Participant authorization check
- Database connection validation

---

# API Contract: Update Bill (✏️📋)

## Endpoint
```
PUT /api/mobile/bill/:billId
```

## Description
- Updates bill information including items, categories, and settings. Only accessible to bill host.
- Memperbarui informasi tagihan termasuk item, kategori, dan pengaturan. Hanya dapat diakses oleh host tagihan.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Path Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| billId    | string | Yes      | Unique bill identifier |

### Request Body
```json
{
  "billName": "string",
  "categoryId": "string",
  "groupId": "string",
  "items": [
    {
      "itemName": "string",
      "price": number,
      "quantity": number,
      "category": "string",
      "isVerified": boolean
    }
  ],
  "receiptImageUrl": "string",
  "maxPaymentDate": "ISO 8601 datetime",
  "allowScheduledPayment": boolean,
  "splitMethod": "string",
  "currency": "string"
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Bill updated successfully",
  "bill": {}
}
```

## Business Logic
- Only bill host can update the bill
- Recalculates total amount from new items
- Deletes existing items and assignments before recreating
- Updates all provided fields (partial updates supported)
- Maintains data consistency through transactions
- Returns complete updated bill information

## Error Handling
- Bill ownership validation
- Database transaction handling
- Field validation for updates
- Comprehensive error classification

---

# API Contract: Delete Bill (🗑️📋)

## Endpoint
```
DELETE /api/mobile/bill/:billId
```

## Description
- Permanently deletes a bill and all related data. Only accessible to bill host.
- Menghapus permanen tagihan dan semua data terkait. Hanya dapat diakses oleh host tagihan.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Path Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| billId    | string | Yes      | Unique bill identifier |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Bill and all related data deleted successfully",
  "billId": "string"
}
```

## Business Logic
- Only bill host can delete the bill
- Deletes all related data in proper order:
  - Bill invites
  - Item assignments
  - Bill items
  - Bill participants
  - Activity logs
  - Main bill record
- Uses database transaction for atomicity
- Prevents orphaned data

## Error Handling
- Bill ownership validation
- Database transaction handling
- Foreign key constraint handling
- Comprehensive error messaging

---

# API Contract: Delete Bill Participant (👥🗑️)

## Endpoint
```
DELETE /api/mobile/bill/:billId/participant/:participantId
```

## Description
- Removes a participant from a bill along with their item assignments. Only accessible to bill host.
- Menghapus peserta dari tagihan beserta penugasan item mereka. Hanya dapat diakses oleh host tagihan.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

### Path Parameters
| Parameter     | Type   | Required | Description                   |
|---------------|--------|----------|-------------------------------|
| billId        | string | Yes      | Unique bill identifier        |
| participantId | string | Yes      | Unique participant identifier |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Participant removed successfully",
  "participantId": "string"
}
```

## Business Logic
- Only bill host can remove participants
- Validates participant belongs to the specified bill
- Deletes item assignments before removing participant
- Creates activity log for the removal
- Uses database transaction for atomicity
- Maintains referential integrity

## Error Handling
- Bill ownership validation
- Participant existence validation
- Database transaction handling
- Foreign key constraint handling