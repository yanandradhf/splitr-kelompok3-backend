# API Contract: Get Notifications

## Endpoint
```
GET /api/mobile/notifications
```

## Description
Retrieves notifications for the authenticated user with pagination and filtering options.
Mengambil notifikasi untuk pengguna yang terautentikasi dengan opsi filter.

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
| Parameter  | Type    | Required | Description                                    |
|------------|---------|----------|------------------------------------------------|
| limit      | number  | No       | Number of notifications to return (default: 20) |
| offset     | number  | No       | Number of notifications to skip (default: 0)   |
| unreadOnly | boolean | No       | Return only unread notifications (default: false) |

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "notifications": [
    {
      "notificationId": "string",
      "type": "string",
      "title": "string",
      "message": "string",
      "billId": "string",
      "billName": "string",
      "groupId": "string",
      "groupName": "string",
      "metadata": "object",
      "isRead": boolean,
      "sentAt": "ISO 8601 datetime",
      "createdAt": "ISO 8601 datetime"
    }
  ],
  "unreadCount": number,
  "totalCount": number
}
```

### Response Schema
--Notifications Array--
| Field         | Type  | Description                           |
|---------------|-------|---------------------------------------|
| notifications | array | List of notifications                 |
| unreadCount   | number| Total number of unread notifications  |
| totalCount    | number| Total number of notifications         |

--Notification Object--
| Field          | Type    | Description                                    |
|----------------|---------|------------------------------------------------|  
| notificationId | string  | Unique identifier for the notification         |
| type           | string  | Type of notification (payment_reminder, etc.)  |
| title          | string  | Title of the notification                      |
| message        | string  | Message content of the notification            |
| billId         | string  | Associated bill ID (if applicable)             |
| billName       | string  | Associated bill name (if applicable)           |
| groupId        | string  | Associated group ID (if applicable)            |
| groupName      | string  | Associated group name (if applicable)          |
| metadata       | object  | Additional metadata for the notification       |
| isRead         | boolean | Whether the notification has been read         |
| sentAt         | string  | ISO 8601 datetime when notification was sent   |
| createdAt      | string  | ISO 8601 datetime when notification was created |

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "ForbiddenError",
  "error": "Token invalid atau kadaluarsa"
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
curl -X GET "../api/mobile/notifications?limit=10&offset=0&unreadOnly=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "notifications": [
    {
      "notificationId": "notif_001",
      "type": "payment_reminder",
      "title": "Tagihan Nungguin Nih",
      "message": "Rp 80,000 buat 'Bakso Malam Minggu' masih nunggu dibayar, jangan kabur ya",
      "billId": "bill_001",
      "billName": "Bakso Malam Minggu",
      "groupId": null,
      "groupName": null,
      "metadata": {},
      "isRead": false,
      "sentAt": "2024-01-15T10:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "notificationId": "notif_002",
      "type": "group_invitation",
      "title": "Undangan Grup Baru",
      "message": "Kamu diundang ke grup 'Weekend Trip' oleh John Doe",
      "billId": null,
      "billName": null,
      "groupId": "grp_001",
      "groupName": "Weekend Trip",
      "metadata": {},
      "isRead": false,
      "sentAt": "2024-01-14T15:45:00Z",
      "createdAt": "2024-01-14T15:45:00Z"
    }
  ],
  "unreadCount": 5,
  "totalCount": 25
}
```

## Business Logic
- Returns notifications ordered by creation date (newest first)
- Supports pagination with limit and offset parameters
- Can filter to show only unread notifications
- Includes associated bill and group information when available
- Provides total counts for UI pagination and badge display
- Default limit is 20 notifications per request
- Metadata field can contain additional context-specific information

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling
- User ID validation from token
- Query parameter validation and defaults

---

# API Contract: Mark Notification as Read

## Endpoint
```
PUT /api/mobile/notifications/:notificationId/read
```

## Description
Marks a specific notification as read for the authenticated user.
Menandai notifikasi tertentu sudah dibaca untuk pengguna yang terautentikasi.

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
| Parameter      | Type   | Required | Description                           |
|----------------|--------|----------|---------------------------------------|
| notificationId | string | Yes      | Unique identifier of the notification |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Notification marked as read"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error
```json
{
  "name": "ValidationError",
  "error": "ID notifikasi dibutuhkan"
}
```

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "ForbiddenError",
  "error": "Token invalid atau kadaluarsa"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Notifikasi tidak ditemukan"
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
curl -X PUT "../api/mobile/notifications/notif_001/read" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Notification marked as read"
}
```

## Business Logic
- Only marks notifications belonging to the authenticated user
- Uses updateMany to ensure user ownership validation
- Notification must exist and belong to the user
- Operation is idempotent (can be called multiple times safely)
- No effect if notification is already marked as read

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (notificationId required)
- User ownership validation through database query
- Database connection validation
- Prisma error handling with custom error names
- Notification existence validation

---

# API Contract: Mark All Notifications as Read

## Endpoint
```
PUT /api/mobile/notifications/read-all
```

## Description
Marks all unread notifications as read for the authenticated user.
Menandai semua notifikasi yang belum dibaca sebagai terbaca untuk pengguna yang terautentikasi.

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
  "message": "All notifications marked as read",
  "count": number
}
```

### Response Schema
| Field   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| message | string | Success confirmation message                   |
| count   | number | Number of notifications that were marked as read |

### Error Responses

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "ForbiddenError",
  "error": "Token invalid atau kadaluarsa"
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
curl -X PUT "../api/mobile/notifications/read-all" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "All notifications marked as read",
  "count": 5
}
```

## Business Logic
- Only affects notifications belonging to the authenticated user
- Only updates notifications that are currently unread (isRead: false)
- Returns count of notifications that were actually updated
- Operation is idempotent (safe to call multiple times)
- Count will be 0 if all notifications were already read

## Error Handling
- JWT validation with proper error classification
- User ID validation from token
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Handle Group Notification Actions

## Endpoint
```
POST /api/mobile/notifications/group-action
```

## Description
Handles actions for group-related notifications such as group invitations.
Menangani aksi untuk notifikasi terkait grup seperti undangan grup.

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
  "notificationId": "string",
  "action": "string"
}
```

| Field          | Type   | Required | Description                           |
|----------------|--------|----------|---------------------------------------|
| notificationId | string | Yes      | ID of the group notification          |
| action         | string | Yes      | Action to perform ("view_group")      |

## Response

### Success Response (200 OK)
```json
{
  "message": "Notification marked as read",
  "groupId": "string"
}
```

### Response Schema
| Field   | Type   | Description                           |
|---------|--------|---------------------------------------|
| message | string | Success confirmation message          |
| groupId | string | ID of the group associated with notification |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "ID notifikasi dan action dibutuhkan"
}
```

#### 400 Validation Error (Invalid Action)
```json
{
  "name": "ValidationError",
  "error": "Action tidak valid. Hanya 'view_group' yang didukung."
}
```

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "ForbiddenError",
  "error": "Token invalid atau kadaluarsa"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Notifikasi undangan grup tidak ditemukan"
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
curl -X POST "../api/mobile/notifications/group-action" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "notificationId": "notif_001",
    "action": "view_group"
  }'
```

### Response
```json
{
  "message": "Notification marked as read",
  "groupId": "grp_123456"
}
```

## Business Logic
- Only handles group_invitation type notifications
- Currently supports only "view_group" action
- Marks notification as read when action is performed
- Returns groupId for navigation purposes
- Validates notification ownership by user
- Notification must exist and belong to authenticated user

## Error Handling
- JWT validation with proper error classification
- Request body validation (both fields required)
- Notification type validation (must be group_invitation)
- User ownership validation
- Action validation (only view_group supported)
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Handle Bill Notification Actions

## Endpoint
```
POST /api/mobile/notifications/bill-action
```

## Description
Handles actions for bill-related notifications such as bill invitations, payment reminders, etc.
Menangani aksi untuk notifikasi terkait tagihan seperti undangan tagihan, pengingat pembayaran, dll.

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
  "notificationId": "string",
  "action": "string"
}
```

| Field          | Type   | Required | Description                                        |
|----------------|--------|----------|----------------------------------------------------|  
| notificationId | string | Yes      | ID of the bill notification                        |
| action         | string | Yes      | Action to perform ("join_bill", "view_bill", "pay_now") |

## Response

### Success Response (200 OK)
```json
{
  "message": "string",
  "redirectTo": "string",
  "billData": {
    "billId": "string",
    "billCode": "string",
    "billName": "string",
    "status": "string"
  }
}
```

### Response Schema
--Action Response Object--
| Field      | Type   | Description                           |
|------------|--------|---------------------------------------|
| message    | string | Action-specific message               |
| redirectTo | string | URL path for client-side navigation   |
| billData   | object | Bill information for the action       |

--Bill Data Object--
| Field    | Type   | Description                    |
|----------|--------|---------------------------------|
| billId   | string | Unique identifier for the bill |
| billCode | string | Bill code for joining (if applicable) |
| billName | string | Name of the bill               |
| status   | string | Current status of the bill     |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "ID notifikasi dan action dibutuhkan"
}
```

#### 400 Validation Error (Invalid Action)
```json
{
  "name": "ValidationError",
  "error": "Action tidak valid"
}
```

#### 401 Unauthorized
```json
{
  "name": "UnauthorizedError",
  "error": "Access token dibutuhkan"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "ForbiddenError",
  "error": "Token invalid atau kadaluarsa"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Notifikasi tagihan tidak ditemukan"
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
curl -X POST "../api/mobile/notifications/bill-action" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "notificationId": "notif_002",
    "action": "join_bill"
  }'
```

### Response
```json
{
  "message": "Redirect to join bill",
  "redirectTo": "/bills/join/BILL123",
  "billData": {
    "billId": "bill_001",
    "billCode": "BILL123",
    "billName": "Weekend Dinner"
  }
}
```

## Business Logic
- Handles multiple bill notification types: bill_invitation, bill_assignment, payment_reminder, bill_expired
- Supports three actions: join_bill, view_bill, pay_now
- Always marks notification as read when action is performed
- Returns appropriate redirect URLs and bill data for client navigation
- Validates notification ownership by user
- Includes associated bill information in response

## Supported Actions
- **join_bill**: Redirects to bill joining page with bill code
- **view_bill**: Redirects to bill detail page
- **pay_now**: Redirects to payment page for the bill

## Error Handling
- JWT validation with proper error classification
- Request body validation (both fields required)
- Notification type validation (must be bill-related)
- User ownership validation
- Action validation (must be supported action)
- Database connection validation
- Prisma error handling with custom error names