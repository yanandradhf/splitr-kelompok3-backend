# API Contract: Get Friends List (👥)

## Endpoint
```
GET /api/mobile/friends
```

## Description
- Retrieves the list of all active friends for the authenticated user.
- Mengambil daftar semua teman aktif untuk pengguna yang terautentikasi.

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
  "friends": [
    {
      "friendshipId": "string",
      "friend": {
        "userId": "string",
        "name": "string",
        "email": "string",
        "accountNumber": "string"
      },
      "status": "string",
      "createdAt": "ISO 8601 datetime"
    }
  ]
}
```

### Response Schema
--Friends Array--
| Field   | Type  | Description                    |
|---------|-------|--------------------------------|
| friends | array | List of active friendships     |

--Friendship Object--
| Field        | Type   | Description                                |
|--------------|--------|--------------------------------------------|  
| friendshipId | string | Unique identifier for the friendship       |
| friend       | object | Friend user information                    |
| status       | string | Status of the friendship (always "active") |
| createdAt    | string | ISO 8601 datetime when friendship created  |

--Friend Object--
| Field         | Type   | Description                        | 
|---------------|--------|------------------------------------|  
| userId        | string | Unique identifier for the friend   |
| name          | string | Name of the friend                 |
| email         | string | Email address of the friend        |
| accountNumber | string | BNI account number of the friend   |

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
curl -X GET "../api/mobile/friends" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "friends": [
    {
      "friendshipId": "friendship_001",
      "friend": {
        "userId": "usr_002",
        "name": "Jane Smith",
        "email": "jane@example.com",
        "accountNumber": "1234567890"
      },
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "friendshipId": "friendship_002",
      "friend": {
        "userId": "usr_003",
        "name": "Bob Wilson",
        "email": "bob@example.com",
        "accountNumber": "0987654321"
      },
      "status": "active",
      "createdAt": "2024-01-14T15:45:00Z"
    }
  ]
}
```

## Business Logic
- Returns only active friendships
- Friendships are ordered by creation date (newest first)
- Only shows friends added by the authenticated user (one-way friendship)
- Includes friend's BNI account number for payment purposes
- Friend status is always "active" for returned results
- Empty array returned if user has no friends

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling
- User ID validation from token

---

# API Contract: Search User by Username (🔍)

## Endpoint
```
GET /api/mobile/friends/search
```

## Description
- Searches for a user by username to potentially add as a friend.
- Mencari pengguna berdasarkan username untuk kemungkinan ditambahkan sebagai teman.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| username  | string | Yes      | Username to search for         |

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "found": boolean,
  "user": {
    "userId": "string",
    "username": "string",
    "name": "string",
    "email": "string",
    "accountNumber": "string"
  },
  "isAlreadyFriend": boolean,
  "canAddFriend": boolean
}
```

### Response Schema
--Search Result Object--
| Field           | Type    | Description                                    |
|-----------------|---------|------------------------------------------------|
| found           | boolean | Whether a user with the username was found    |
| user            | object  | User information if found                      |
| isAlreadyFriend | boolean | Whether the user is already in friends list   |
| canAddFriend    | boolean | Whether the user can be added as friend       |

--User Object--
| Field         | Type   | Description                        |
|---------------|--------|------------------------------------|  
| userId        | string | Unique identifier for the user     |
| username      | string | Username of the user               |
| name          | string | Name of the user                   |
| email         | string | Email address of the user          |
| accountNumber | string | BNI account number of the user     |

### Error Responses

#### 400 Validation Error
```json
{
  "name": "ValidationError",
  "error": "Username dibutuhkan"
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
  "error": "Tidak ada user dengan username 'example_username'"
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
curl -X GET "../api/mobile/friends/search?username=johndoe" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "found": true,
  "user": {
    "userId": "usr_004",
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com",
    "accountNumber": "1122334455"
  },
  "isAlreadyFriend": false,
  "canAddFriend": true
}
```

## Business Logic
- Performs exact username match (case-insensitive)
- Excludes the authenticated user from search results
- Checks existing friendship status
- Returns user's BNI account number for payment purposes
- Provides flags to guide UI behavior (canAddFriend)
- Username search is case-insensitive
- Only returns active users

## Error Handling
- JWT validation with proper error classification
- Query parameter validation (username required)
- Database connection validation
- Prisma error handling with custom error names
- User existence validation
- Friendship status checking

---

# API Contract: Add Friend by Username (➕👥)

## Endpoint
```
POST /api/mobile/friends/add-by-username
```

## Description
- Adds a user as a friend by their username. Creates a one-way friendship relationship.
- Menambahkan pengguna sebagai teman berdasarkan username mereka. Membuat hubungan pertemanan satu arah.

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
  "username": "string"
}
```

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| username | string | Yes      | Username of user to add as friend |

## Response

### Success Response (200 OK)
```json
{
  "success": boolean,
  "message": "string",
  "friend": {
    "userId": "string",
    "username": "string",
    "name": "string",
    "email": "string"
  }
}
```

### Response Schema
--Success Object--
| Field   | Type    | Description                           |
|---------|---------|---------------------------------------|
| success | boolean | Whether the operation was successful  |
| message | string  | Success confirmation message          |
| friend  | object  | Information about the added friend    |

--Friend Object--
| Field    | Type   | Description                        |
|----------|--------|------------------------------------|  
| userId   | string | Unique identifier for the friend   |
| username | string | Username of the friend             |
| name     | string | Name of the friend                 |
| email    | string | Email address of the friend        |

### Error Responses

#### 400 Validation Error (Missing Username)
```json
{
  "name": "ValidationError",
  "error": "Username dibutuhkan"
}
```

#### 400 Validation Error (Self Addition)
```json
{
  "name": "ValidationError",
  "error": "Tidak bisa menambahkan diri sendiri sebagai teman"
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
  "error": "Tidak ada user dengan username 'example_username'"
}
```

#### 409 Conflict (Already Friends)
```json
{
  "name": "ConflictError",
  "error": "Anda sudah menambahkan John Doe ke daftar teman"
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
curl -X POST "../api/mobile/friends/add-by-username" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe"
  }'
```

### Response
```json
{
  "success": true,
  "message": "Friend added successfully",
  "friend": {
    "userId": "usr_004",
    "username": "johndoe",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

## Business Logic
- Creates one-way friendship (only from authenticated user to target user)
- Username search is case-insensitive
- Cannot add yourself as a friend
- Cannot add someone who is already your friend
- User must exist in the system
- Friendship status is set to "active"
- No notifications are sent (one-way friendship model)

## Error Handling
- JWT validation with proper error classification
- Request body validation (username required)
- Self-addition prevention
- User existence validation
- Duplicate friendship prevention
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Remove Friend (➖👥)

## Endpoint
```
DELETE /api/mobile/friends/remove/:friendUserId
```

## Description
- Removes a user from the friends list. Only removes the one-way friendship from the authenticated user.
- Menghapus user dari daftar teman. Hanya menghapus pertemanan satu arah dari pengguna yang terautentikasi.

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
| Parameter    | Type   | Required | Description                         |
|--------------|--------|----------|-------------------------------------|
| friendUserId | string | Yes      | User ID of the friend to be removed |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Friend removed successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Friend User ID)
```json
{
  "name": "ValidationError",
  "error": "ID teman dibutuhkan"
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

#### 404 Not Found (User Not Found)
```json
{
  "name": "NotFoundError",
  "error": "User tidak ditemukan"
}
```

#### 404 Not Found (Not Friends)
```json
{
  "name": "NotFoundError",
  "error": "User bukan teman Anda"
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
curl -X DELETE "../api/mobile/friends/remove/usr_004" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Friend removed successfully"
}
```

## Business Logic
- Removes one-way friendship (only from authenticated user)
- User must exist in the system
- Friendship must exist to be removed
- Friend user ID is validated before removal
- Removal is permanent and immediate
- No notifications are sent (one-way friendship model)

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (friendUserId required)
- User existence validation
- Friendship existence validation
- Database connection validation
- Prisma error handling with custom error names