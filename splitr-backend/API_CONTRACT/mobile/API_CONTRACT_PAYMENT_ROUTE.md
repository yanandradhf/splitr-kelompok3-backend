# API Contract: Get Payment Info for Bill (💳📋)

## Endpoint
```
GET /api/mobile/payment/info/:billId
```

## Description
- Retrieves payment information for a specific bill including amount, deadline, and payment options.
- Mengambil informasi pembayaran untuk tagihan tertentu termasuk jumlah, tenggat waktu, dan opsi pembayaran.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |

### Path Parameters
| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| billId    | string | Yes      | Unique bill identifier |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "paymentInfo": {
    "billId": "string",
    "billName": "string",
    "yourAmount": number,
    "paymentStatus": "string",
    "hostName": "string",
    "hostAccount": "string",
    "paymentDeadline": "ISO 8601 datetime",
    "canSchedule": boolean,
    "allowScheduledPayment": boolean,
    "isExpired": boolean,
    "timeRemaining": number
  }
}
```

### Response Schema
--Payment Info Object--
| Field                  | Type    | Description                           |
|------------------------|---------|---------------------------------------|
| billId                 | string  | Unique bill identifier                |
| billName               | string  | Name of the bill                      |
| yourAmount             | number  | Amount user needs to pay              |
| paymentStatus          | string  | Current payment status                |
| hostName               | string  | Name of the bill host                 |
| hostAccount            | string  | Host's BNI account number             |
| paymentDeadline        | string  | ISO 8601 datetime for payment deadline |
| canSchedule            | boolean | Whether scheduled payment is allowed  |
| allowScheduledPayment  | boolean | Bill setting for scheduled payments   |
| isExpired              | boolean | Whether payment deadline has passed   |
| timeRemaining          | number  | Milliseconds remaining until deadline |

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 403 Forbidden
```json
{
  "name": "ForbiddenError",
  "error": "You are not a participant in this bill"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Bill not found"
}
```

#### 500 Database Error
```json
{
  "name": "DatabaseError",
  "error": "Koneksi database tidak tersedia"
}
```

## Example

### Request
```bash
curl -X GET "../api/mobile/payment/info/bill_001" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "success": true,
  "paymentInfo": {
    "billId": "bill_001",
    "billName": "Weekend Dinner",
    "yourAmount": 75000.00,
    "paymentStatus": "pending",
    "hostName": "John Doe",
    "hostAccount": "1234567890",
    "paymentDeadline": "2024-01-16T14:30:00Z",
    "canSchedule": true,
    "allowScheduledPayment": true,
    "isExpired": false,
    "timeRemaining": 86400000
  }
}
```

## Business Logic
- Only bill participants can access payment info
- Calculates payment deadline based on bill settings
- If scheduled payment allowed: uses maxPaymentDate
- If not allowed: uses 24-hour deadline from bill creation
- Checks if payment deadline has expired
- Calculates remaining time in milliseconds
- Returns participant's share amount
- Includes host information for payment recipient

## Error Handling
- JWT validation with proper error classification
- User ID validation from token
- Bill existence validation
- Participant authorization check
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Create Payment (💳✅)

## Endpoint
```
POST /api/mobile/payment/create
```

## Description
- Creates a payment for a bill (instant or scheduled) with PIN verification and BNI transfer simulation.
- Membuat pembayaran untuk tagihan (instan atau terjadwal) dengan verifikasi PIN dan simulasi transfer BNI.

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

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "billId": "string",
  "amount": number,
  "pin": "string",
  "scheduledDate": "ISO 8601 datetime"
}
```

| Field        | Type   | Required | Description                           |
|--------------|--------|----------|---------------------------------------|
| billId       | string | Yes      | Unique bill identifier                |
| amount       | number | Yes      | Payment amount                        |
| pin          | string | Yes      | User's 6-digit PIN                    |
| scheduledDate| string | No       | ISO 8601 datetime for scheduled payment |

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "paymentType": "string",
  "message": "string",
  "receipt": {
    "paymentId": "string",
    "transactionId": "string",
    "bniReferenceNumber": "string",
    "amount": number,
    "status": "string",
    "scheduledDate": "ISO 8601 datetime",
    "paidAt": "ISO 8601 datetime",
    "bill": {
      "billId": "string",
      "billName": "string",
      "hostName": "string",
      "hostAccount": "string"
    },
    "breakdown": {
      "yourShare": number,
      "adminFee": number,
      "transferFee": number,
      "totalPaid": number
    }
  },
  "nextActions": {
    "canViewReceipt": boolean,
    "canViewBill": boolean,
    "canGoHome": boolean
  }
}
```

### Error Responses

#### 400 Bad Request (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Bill ID, amount, and PIN required"
}
```

#### 400 Bad Request (Payment Failed)
```json
{
  "error": "Payment failed",
  "message": "Insufficient balance",
  "code": "02"
}
```

#### 401 Unauthorized (Invalid PIN)
```json
{
  "name": "UnauthorizedError",
  "error": "Invalid PIN"
}
```

#### 404 Not Found
```json
{
  "error": "Bill not found"
}
```

## Example

### Request
```bash
curl -X POST "../api/mobile/payment/create" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "billId": "bill_001",
    "amount": 75000.00,
    "pin": "123456",
    "scheduledDate": "2024-01-20T10:00:00Z"
  }'
```

### Response
```json
{
  "success": true,
  "paymentType": "scheduled",
  "message": "Payment scheduled successfully!",
  "receipt": {
    "paymentId": "pay_001",
    "transactionId": "SCH1705123456ABC",
    "bniReferenceNumber": "SCH1705123456DEFGH",
    "amount": 75000.00,
    "status": "completed_scheduled",
    "scheduledDate": null,
    "paidAt": "2024-01-15T14:30:00Z",
    "bill": {
      "billId": "bill_001",
      "billName": "Weekend Dinner",
      "hostName": "John Doe",
      "hostAccount": "1234567890"
    },
    "breakdown": {
      "yourShare": 75000.00,
      "adminFee": 0,
      "transferFee": 0,
      "totalPaid": 75000.00
    }
  },
  "nextActions": {
    "canViewReceipt": true,
    "canViewBill": true,
    "canGoHome": true
  }
}
```

## Business Logic
- Verifies PIN using bcrypt comparison
- Validates payment amount matches participant's share
- Checks payment deadline hasn't expired
- Determines payment type (instant/scheduled) based on scheduledDate
- Simulates BNI transfer with balance deduction
- Creates payment record and updates participant status
- Creates activity log and notifications
- Both instant and scheduled payments deduct balance immediately
- Scheduled payment is record-keeping feature only

## Error Handling
- PIN verification with bcrypt
- Amount validation with tolerance for decimal precision
- Payment deadline validation
- BNI transfer simulation with balance checks
- Database transaction handling
- Comprehensive error classification

---

# API Contract: Get Payment History (📊💳)

## Endpoint
```
GET /api/mobile/payment/history
```

## Description
- Retrieves user's payment history with pagination, excluding payments where user is the host.
- Mengambil riwayat pembayaran pengguna dengan paginasi, tidak termasuk pembayaran di mana pengguna adalah host.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |

### Path Parameters
None

### Query Parameters
| Parameter | Type   | Required | Default | Description                           |
|-----------|--------|----------|---------|---------------------------------------|
| page      | number | No       | 1       | Page number for pagination            |
| limit     | number | No       | 10      | Number of items per page              |

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "payments": [
    {
      "paymentId": "string",
      "billName": "string",
      "billCode": "string",
      "hostName": "string",
      "amount": number,
      "paymentMethod": "string",
      "paymentType": "string",
      "scheduledDate": "ISO 8601 datetime",
      "transactionId": "string",
      "status": "string",
      "paidAt": "ISO 8601 datetime",
      "createdAt": "ISO 8601 datetime"
    }
  ],
  "pagination": {
    "page": number,
    "limit": number,
    "total": number,
    "totalPages": number
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 500 Database Error
```json
{
  "name": "DatabaseError",
  "error": "Koneksi database tidak tersedia"
}
```

## Example

### Request
```bash
curl -X GET "../api/mobile/payment/history?page=1&limit=5" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "success": true,
  "payments": [
    {
      "paymentId": "pay_001",
      "billName": "Weekend Dinner",
      "billCode": "WD001",
      "hostName": "John Doe",
      "amount": 75000.00,
      "paymentMethod": "BNI_TRANSFER",
      "paymentType": "instant",
      "scheduledDate": null,
      "transactionId": "TXN1705123456ABC",
      "status": "completed",
      "paidAt": "2024-01-15T14:30:00Z",
      "createdAt": "2024-01-15T14:25:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 5,
    "total": 12,
    "totalPages": 3
  }
}
```

## Business Logic
- Only shows payments where user is participant (not host)
- Excludes payments for bills hosted by the user
- Orders by creation date (newest first)
- Supports pagination with configurable page size
- Includes bill and host information
- Shows payment method and type details
- Includes transaction IDs and status

## Error Handling
- JWT validation with proper error classification
- User ID validation from token
- Database connection validation
- Pagination parameter validation
- Prisma error handling with custom error names

---

# API Contract: Get Payment Receipt Detail (🧾💳)

## Endpoint
```
GET /api/mobile/payment/:paymentId/receipt
```

## Description
- Retrieves detailed payment receipt including bill items, breakdown, and transaction information.
- Mengambil resi pembayaran terperinci termasuk item tagihan, rincian, dan informasi transaksi.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |

### Path Parameters
| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| paymentId | string | Yes      | Unique payment identifier |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "receipt": {
    "paymentId": "string",
    "transactionId": "string",
    "bniReferenceNumber": "string",
    "status": "string",
    "paymentType": "string",
    "scheduledDate": "ISO 8601 datetime",
    "amount": number,
    "paidAt": "ISO 8601 datetime",
    "paymentMethod": "string",
    "bill": {
      "billId": "string",
      "billName": "string",
      "billCode": "string",
      "category": "string",
      "categoryIcon": "string"
    },
    "payer": {
      "name": "string",
      "account": "string"
    },
    "recipient": {
      "name": "string",
      "account": "string"
    },
    "yourItems": [
      {
        "itemName": "string",
        "quantity": number,
        "price": number,
        "amount": number
      }
    ],
    "breakdown": {
      "subtotal": number,
      "taxAmount": number,
      "serviceAmount": number,
      "discountAmount": number,
      "yourShare": number,
      "adminFee": number,
      "transferFee": number,
      "totalPaid": number
    },
    "createdAt": "ISO 8601 datetime"
  },
  "actions": {
    "canDownloadReceipt": boolean,
    "canViewBill": boolean,
    "canContact": boolean
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Payment receipt not found"
}
```

## Example

### Request
```bash
curl -X GET "../api/mobile/payment/pay_001/receipt" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "success": true,
  "receipt": {
    "paymentId": "pay_001",
    "transactionId": "TXN1705123456ABC",
    "bniReferenceNumber": "BNI1705123456DEFGH",
    "status": "completed",
    "paymentType": "instant",
    "scheduledDate": null,
    "amount": 75000.00,
    "paidAt": "2024-01-15T14:30:00Z",
    "paymentMethod": "BNI_TRANSFER",
    "bill": {
      "billId": "bill_001",
      "billName": "Weekend Dinner",
      "billCode": "WD001",
      "category": "Food",
      "categoryIcon": "🍽️"
    },
    "payer": {
      "name": "Jane Smith",
      "account": "9876543210"
    },
    "recipient": {
      "name": "John Doe",
      "account": "1234567890"
    },
    "yourItems": [
      {
        "itemName": "Nasi Goreng",
        "quantity": 1,
        "price": 25000.00,
        "amount": 25000.00
      },
      {
        "itemName": "Es Teh",
        "quantity": 2,
        "price": 5000.00,
        "amount": 10000.00
      }
    ],
    "breakdown": {
      "subtotal": 35000.00,
      "taxAmount": 3500.00,
      "serviceAmount": 1750.00,
      "discountAmount": 0.00,
      "yourShare": 75000.00,
      "adminFee": 0,
      "transferFee": 0,
      "totalPaid": 75000.00
    },
    "createdAt": "2024-01-15T14:25:00Z"
  },
  "actions": {
    "canDownloadReceipt": true,
    "canViewBill": true,
    "canContact": true
  }
}
```

## Business Logic
- Only payment owner can access receipt
- Includes comprehensive payment details
- Shows assigned bill items with quantities and amounts
- Provides detailed cost breakdown
- Includes payer and recipient information
- Shows BNI reference number for tracking
- Includes available actions for user

## Error Handling
- JWT validation with proper error classification
- Payment ownership validation
- Payment existence validation
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Get BNI Account Balance (🏦💰)

## Endpoint
```
GET /api/mobile/payment/balance
```

## Description
- Retrieves the authenticated user's BNI account balance information.
- Mengambil informasi saldo rekening BNI pengguna yang terautentikasi.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |

### Path Parameters
None

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "account": {
    "accountNumber": "string",
    "accountName": "string",
    "branchCode": "string",
    "balance": number,
    "formattedBalance": "string"
  }
}
```

### Response Schema
--Account Object--
| Field            | Type   | Description                           |
|------------------|--------|---------------------------------------|
| accountNumber    | string | BNI account number                    |
| accountName      | string | Account holder name                   |
| branchCode       | string | BNI branch code                       |
| balance          | number | Current account balance               |
| formattedBalance | string | Formatted balance with currency       |

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 404 Not Found (User)
```json
{
  "name": "NotFoundError",
  "error": "User not found"
}
```

#### 404 Not Found (Account)
```json
{
  "name": "NotFoundError",
  "error": "BNI account not found"
}
```

## Example

### Request
```bash
curl -X GET "../api/mobile/payment/balance" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "success": true,
  "account": {
    "accountNumber": "1234567890",
    "accountName": "Jane Smith",
    "branchCode": "001",
    "balance": 2500000.00,
    "formattedBalance": "Rp 2,500,000"
  }
}
```

## Business Logic
- Retrieves user's BNI account number from user profile
- Fetches balance from BNI dummy account database
- Provides both numeric and formatted balance
- Includes account holder name and branch information
- Used for payment validation and user information

## Error Handling
- JWT validation with proper error classification
- User existence validation
- BNI account existence validation
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Get Payment Status (📊💳)

## Endpoint
```
GET /api/mobile/payment/:paymentId/status
```

## Description
- Retrieves the current status of a specific payment transaction.
- Mengambil status terkini dari transaksi pembayaran tertentu.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |

### Path Parameters
| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| paymentId | string | Yes      | Unique payment identifier |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "payment": {
    "paymentId": "string",
    "transactionId": "string",
    "amount": number,
    "paymentMethod": "string",
    "status": "string",
    "paidAt": "ISO 8601 datetime",
    "bniTransactionId": "string",
    "bill": {
      "billName": "string",
      "billCode": "string",
      "hostName": "string",
      "hostAccount": "string"
    }
  }
}
```

### Response Schema
--Payment Status Object--
| Field            | Type   | Description                           |
|------------------|--------|---------------------------------------|
| paymentId        | string | Unique payment identifier             |
| transactionId    | string | Transaction reference ID              |
| amount           | number | Payment amount                        |
| paymentMethod    | string | Payment method used                   |
| status           | string | Current payment status                |
| paidAt           | string | ISO 8601 datetime when payment was made |
| bniTransactionId | string | BNI transaction reference             |
| bill             | object | Associated bill information           |

--Bill Object--
| Field       | Type   | Description                    |
|-------------|--------|--------------------------------|
| billName    | string | Name of the bill               |
| billCode    | string | Bill reference code            |
| hostName    | string | Name of the bill host          |
| hostAccount | string | Host's BNI account number      |

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Payment not found"
}
```

## Example

### Request
```bash
curl -X GET "../api/mobile/payment/pay_001/status" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "success": true,
  "payment": {
    "paymentId": "pay_001",
    "transactionId": "TXN1705123456ABC",
    "amount": 75000.00,
    "paymentMethod": "BNI_TRANSFER",
    "status": "completed",
    "paidAt": "2024-01-15T14:30:00Z",
    "bniTransactionId": "BNI1705123456DEFGH",
    "bill": {
      "billName": "Weekend Dinner",
      "billCode": "WD001",
      "hostName": "John Doe",
      "hostAccount": "1234567890"
    }
  }
}
```

## Business Logic
- Only payment owner can check status
- Provides current payment status information
- Includes transaction reference numbers
- Shows associated bill information
- Used for payment tracking and confirmation
- Includes BNI transaction ID for bank reference

## Error Handling
- JWT validation with proper error classification
- Payment ownership validation
- Payment existence validation
- Database connection validation
- Prisma error handling with custom error names