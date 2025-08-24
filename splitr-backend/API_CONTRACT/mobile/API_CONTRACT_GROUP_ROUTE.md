# API Contract: Get User Groups (👥👥👥)
## Endpoint
```
GET /api/mobile/groups
```

## Description
- Retrieves all groups where the authenticated user is either the creator or a member. Only active groups are returned.
- Menampilkan data tentang semua grup yang dibuat atau diikuti oleh pengguna yang terautentikasi. Hanya grup aktif yang ditampilkan.

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

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "groups": [
    {
      "groupId": "string",
      "groupName": "string", 
      "description": "string",
      "isCreator": boolean,
      "creatorName": "string",
      "memberCount": number,
      "billCount": number,
      "members": [
        {
          "userId": "string",
          "name": "string",
          "isCreator": boolean,
          "joinedAt": "ISO 8601 datetime"
        }
      ],
      "createdAt": "ISO 8601 datetime"
    }
  ]
}
```

### Response schema
--Group Object--
| Field         | Type        | Description                                                 | 
|---------------|-------------|-------------------------------------------------------------|
| groupId       | string      | Unique identifier for the group                             |
| groupName     | string      | Name of the group                                           |
| description   | string      | Group description                                           |
| isCreator     | boolean     | Whether the authenticated user is the creator of this group |
| creatorName   | string      | Name of the group creator                                   |
| memberCount   | number      | Total number of members in the group                        |
| billCount     | number      | Total number of bills associated with the group             |
| members       | array       | List of group members                                       |
| createdAt     | string      | ISO 8601 datetime when the group was created                |

--Member Object--
| Field         | Type        | Description                                                 |
|---------------|-------------|-------------------------------------------------------------|
| userId        | string      | Unique identifier for the user                              |
| name          | string      | Name of the user                                            |
| isCreator     | boolean     | Whether this user is the creator of the group               |
| joinedAt      | string      | ISO 8601 datetime when the user joined the group            |

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
curl -X GET "../api/mobile/groups" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "groups": [
    {
      "groupId": "grp_123456",
      "groupName": "Weekend Trip",
      "description": "Planning our weekend getaway",
      "isCreator": true,
      "creatorName": "John Doe",
      "memberCount": 3,
      "billCount": 5,
      "members": [
        {
          "userId": "usr_001",
          "name": "John Doe",
          "isCreator": true,
          "joinedAt": "2024-01-15T10:30:00Z"
        },
        {
          "userId": "usr_002", 
          "name": "Jane Smith",
          "isCreator": false,
          "joinedAt": "2024-01-15T11:00:00Z"
        },
        {
          "userId": "usr_003",
          "name": "Bob Wilson", 
          "isCreator": false,
          "joinedAt": "2024-01-15T11:15:00Z"
        }
      ],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Business Logic
- Returns groups where user is creator OR member
- Only active groups (isActive: true)
- Ordered by creation date (newest first)
- Includes member count and bill count
- Shows creator status for current user
- Includes all group members with their details
- Groups are ordered by creation date in descending order (newest first)

## Error Handling
- JWT validation with proper error classification
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Create Group (➕👥👥👥)

## Endpoint
```
POST /api/mobile/groups/create
```

## Description
- Creates a new group with the authenticated user as the creator and adds specified friends as members.
- Membuat grup baru dengan pengguna yang terautentikasi sebagai pembuat dan menambahkan teman yang ditentukan sebagai anggota.

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

### Query Parameters
None

### Request Body
```json
{
  "groupName": "string",
  "description": "string",
  "memberIds": ["string"]
}
```

| Field       | Type     | Required | Description                           |
|-------------|----------|----------|---------------------------------------|
| groupName   | string   | Yes      | Name of the group to be created       |
| description | string   | No       | Optional description of the group     |
| memberIds   | array    | Yes      | Array of friend user IDs to add       |

## Response

### Success Response (200 OK)
```json
{
  "groupId": "string",
  "groupName": "string",
  "description": "string",
  "memberCount": number,
  "members": [
    {
      "userId": "string",
      "name": "string",
      "isCreator": boolean
    }
  ]
}
```

### Response Schema
--Group Object--
| Field       | Type    | Description                              |
|-------------|---------|------------------------------------------|
| groupId     | string  | Unique identifier for the created group  |
| groupName   | string  | Name of the group                        |
| description | string  | Group description                        |
| memberCount | number  | Total number of members in the group     |
| members     | array   | List of group members                    |

--Member Object--
| Field     | Type    | Description                              |
|-----------|---------|------------------------------------------|
| userId    | string  | Unique identifier for the user           |
| name      | string  | Name of the user                         |
| isCreator | boolean | Whether this user is the creator         |

### Error Responses

#### 400 Validation Error
```json
{
  "name": "ValidationError",
  "error": "Nama grup dibutuhkan"
}
```

#### 400 Validation Error (No Members)
```json
{
  "name": "ValidationError",
  "error": "Perlu 1 anggota lain selain pembuat untuk membuat grup"
}
```

#### 400 Validation Error (Invalid Members)
```json
{
  "name": "ValidationError",
  "error": "Hanya bisa menambahkan teman ke grup"
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
  "error": "Pembuat grup tidak ditemukan"
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
curl -X POST "../api/mobile/groups/create" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Weekend Trip",
    "description": "Planning our weekend getaway",
    "memberIds": ["usr_002", "usr_003"]
  }'
```

### Response
```json
{
  "groupId": "grp_123456",
  "groupName": "Weekend Trip",
  "description": "Planning our weekend getaway",
  "memberCount": 3,
  "members": [
    {
      "userId": "usr_001",
      "name": "John Doe",
      "isCreator": true
    },
    {
      "userId": "usr_002",
      "name": "Jane Smith",
      "isCreator": false
    },
    {
      "userId": "usr_003",
      "name": "Bob Wilson",
      "isCreator": false
    }
  ]
}
```

## Business Logic
- Creator is automatically added as a member with isCreator: true
- Only friends can be added as members (validated against user's friend list)
- At least one member (besides creator) is required
- Group notifications are sent to all added members
- Group name is required, description is optional
- Creator gets full permissions on the group

## Error Handling
- JWT validation with proper error classification
- Input validation for required fields
- Friend relationship validation
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling

---

# API Contract: Add Member to Group (➕👥)

## Endpoint
```
POST /api/mobile/groups/:groupId/members
```

## Description
- Adds a new member to an existing group. Only the group creator can add members, and only friends can be added.
- Menambahkan anggota baru ke grup yang sudah ada. Hanya pembuat grup yang dapat menambahkan anggota, dan hanya teman yang dapat ditambahkan.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| groupId   | string | Yes      | Unique identifier of the group |

### Query Parameters
None

### Request Body
```json
{
  "userId": "string"
}
```

| Field  | Type   | Required | Description                           |
|--------|--------|----------|---------------------------------------|
| userId | string | Yes      | User ID of the friend to add to group |

## Response

### Success Response (200 OK)
```json
{
  "message": "Member added successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
}
```

#### 400 Validation Error (Missing User ID)
```json
{
  "name": "ValidationError",
  "error": "ID User dibutuhkan"
}
```

#### 400 Validation Error (Self Addition)
```json
{
  "name": "ValidationError",
  "error": "Pembuat grup tidak bisa menambahkan diri sendiri"
}
```

#### 400 Validation Error (Not Friend)
```json
{
  "name": "ValidationError",
  "error": "Hanya bisa menambahkan teman ke grup"
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

#### 403 Forbidden
```json
{
  "name": "ForbiddenError",
  "error": "Hanya pembuat grup yang dapat menambahkan anggota"
}
```

#### 409 Conflict
```json
{
  "name": "ConflictError",
  "error": "User sudah menjadi member di grup ini"
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
curl -X POST "../api/mobile/groups/grp_123456/members" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "usr_004"
  }'
```

### Response
```json
{
  "message": "Member added successfully"
}
```

## Business Logic
- Only group creator can add members
- Cannot add yourself to the group
- Can only add users who are in your friend list
- Cannot add users who are already members
- Notifications are sent to the newly added member
- Friend relationship is validated before adding
- Group existence and creator permissions are verified

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId)
- Request body validation (userId)
- Creator permission validation
- Friend relationship validation
- Duplicate member prevention
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling

---

# API Contract: Delete Group Member (➖👥)

## Endpoint
```
DELETE /api/mobile/groups/:groupId/members/:userId
```

## Description
- Removes a member from an existing group. Only the group creator can remove members, and the creator cannot remove themselves.
- Menghapus anggota grup yang sudah ada. Hanya pembuat grup yang dapat menghapus anggota, dan pembuat tidak dapat menghapus keanggotaanya.

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
| Parameter | Type   | Required | Description                         |
|-----------|--------|----------|-------------------------------------|
| groupId   | string | Yes      | Unique identifier of the group      |
| userId    | string | Yes      | User ID of the member to be removed |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Member removed successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
}
```

#### 400 Validation Error (Missing Member ID)
```json
{
  "name": "ValidationError",
  "error": "ID member dibutuhkan"
}
```

#### 400 Validation Error (Self Removal)
```json
{
  "name": "ValidationError",
  "error": "Pembuat grup tidak bisa menghapus diri sendiri. Hapus grup sebagai gantinya."
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

#### 403 Forbidden
```json
{
  "name": "ForbiddenError",
  "error": "Hanya pembuat grup yang dapat menghapus anggota"
}
```

#### 404 Not Found (Member Not Found)
```json
{
  "name": "NotFoundError",
  "error": "Member tidak ditemukan di grup ini"
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
curl -X DELETE "../api/mobile/groups/grp_123456/members/usr_004" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Member removed successfully"
}
```

## Business Logic
- Only group creator can remove members
- Creator cannot remove themselves (must delete group instead)
- Member must exist in the group to be removed
- Group existence and creator permissions are verified
- Notification is sent to the removed member
- Member removal is permanent and immediate

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId and userId)
- Creator permission validation
- Member existence validation
- Self-removal prevention
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling

---

# API Contract: Get Group Details (📝👥👥👥)

## Endpoint
```
GET /api/mobile/groups/:groupId
```

## Description
- Retrieves detailed information about a specific group including members, recent bills, and friendship status. Only group members can access group details.
- Mengambil informasi detail tentang grup tertentu termasuk anggota, tagihan terbaru, dan status pertemanan. Hanya anggota grup yang dapat mengakses detail grup.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| groupId   | string | Yes      | Unique identifier of the group |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "groupId": "string",
  "groupName": "string",
  "description": "string",
  "isCreator": boolean,
  "creatorName": "string",
  "members": [
    {
      "userId": "string",
      "name": "string",
      "email": "string",
      "isCreator": boolean,
      "isCurrentUser": boolean,
      "isFriend": boolean,
      "canAddFriend": boolean,
      "joinedAt": "ISO 8601 datetime"
    }
  ],
  "recentBills": [
    {
      "billId": "string",
      "billName": "string",
      "totalAmount": number,
      "status": "string",
      "createdAt": "ISO 8601 datetime"
    }
  ],
  "createdAt": "ISO 8601 datetime"
}
```

### Response Schema
--Group Object--
| Field       | Type    | Description                                                 |
|-------------|---------|-------------------------------------------------------------|
| groupId     | string  | Unique identifier for the group                             |
| groupName   | string  | Name of the group                                           |
| description | string  | Group description                                           |
| isCreator   | boolean | Whether the authenticated user is the creator of this group |
| creatorName | string  | Name of the group creator                                   |
| members     | array   | List of group members with detailed information             |
| recentBills | array   | List of recent bills (up to 5 most recent)                 |
| createdAt   | string  | ISO 8601 datetime when the group was created               |

--Member Object--
| Field         | Type    | Description                                                 |
|---------------|---------|-------------------------------------------------------------|
| userId        | string  | Unique identifier for the user                              |
| name          | string  | Name of the user                                            |
| email         | string  | Email address of the user                                   |
| isCreator     | boolean | Whether this user is the creator of the group              |
| isCurrentUser | boolean | Whether this user is the authenticated user                 |
| isFriend      | boolean | Whether this user is a friend of the authenticated user    |
| canAddFriend  | boolean | Whether the authenticated user can add this user as friend |
| joinedAt      | string  | ISO 8601 datetime when the user joined the group           |

--Bill Object--
| Field       | Type   | Description                               |
|-------------|--------|-------------------------------------------|
| billId      | string | Unique identifier for the bill            |
| billName    | string | Name of the bill                          |
| totalAmount | number | Total amount of the bill                  |
| status      | string | Status of the bill (pending, completed)  |
| createdAt   | string | ISO 8601 datetime when the bill was created |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
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
  "error": "Grup tidak ditemukan atau Anda tidak memiliki akses"
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
curl -X GET "../api/mobile/groups/grp_123456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "groupId": "grp_123456",
  "groupName": "Weekend Trip",
  "description": "Planning our weekend getaway",
  "isCreator": true,
  "creatorName": "John Doe",
  "members": [
    {
      "userId": "usr_001",
      "name": "John Doe",
      "email": "john@example.com",
      "isCreator": true,
      "isCurrentUser": true,
      "isFriend": false,
      "canAddFriend": false,
      "joinedAt": "2024-01-15T10:30:00Z"
    },
    {
      "userId": "usr_002",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "isCreator": false,
      "isCurrentUser": false,
      "isFriend": true,
      "canAddFriend": false,
      "joinedAt": "2024-01-15T11:00:00Z"
    }
  ],
  "recentBills": [
    {
      "billId": "bill_001",
      "billName": "Dinner at Restaurant",
      "totalAmount": 150000,
      "status": "completed",
      "createdAt": "2024-01-16T19:30:00Z"
    }
  ],
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Business Logic
- Only group members (creator or regular members) can access group details
- Shows friendship status between authenticated user and other members
- Includes canAddFriend flag to indicate if user can add other members as friends
- Returns up to 5 most recent bills ordered by creation date
- Provides comprehensive member information including email and join date
- Access control ensures users can only see groups they belong to

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId)
- Member access validation (user must be in group)
- Database connection validation
- Prisma error handling with custom error names
- Group existence and access permission validation

---

# API Contract: Edit Group (✏️👥👥👥)

## Endpoint
```
PATCH /api/mobile/groups/edit/:groupId
```

## Description
- Updates group information such as name and description. Only the group creator can edit group details.
- Memperbarui informasi grup seperti nama dan deskripsi. Hanya pembuat grup yang dapat mengedit detail grup.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| groupId   | string | Yes      | Unique identifier of the group |

### Query Parameters
None

### Request Body
```json
{
  "groupName": "string",
  "description": "string"
}
```

| Field       | Type   | Required | Description                           |
|-------------|--------|----------|---------------------------------------|
| groupName   | string | No       | New name for the group (optional)     |
| description | string | No       | New description for the group (optional) |

**Note**: At least one field (groupName or description) must be provided.

## Response

### Success Response (200 OK)
```json
{
  "message": "Group updated successfully",
  "groupId": "string",
  "groupName": "string",
  "description": "string",
  "memberCount": number,
  "members": [
    {
      "userId": "string",
      "name": "string",
      "isCreator": boolean
    }
  ]
}
```

### Response Schema
--Group Object--
| Field       | Type    | Description                              |
|-------------|---------|------------------------------------------|
| message     | string  | Success confirmation message             |
| groupId     | string  | Unique identifier for the group          |
| groupName   | string  | Updated name of the group                |
| description | string  | Updated description of the group         |
| memberCount | number  | Total number of members in the group     |
| members     | array   | List of group members                    |

--Member Object--
| Field     | Type    | Description                              |
|-----------|---------|------------------------------------------|
| userId    | string  | Unique identifier for the user           |
| name      | string  | Name of the user                         |
| isCreator | boolean | Whether this user is the creator         |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
}
```

#### 400 Validation Error (No Fields to Update)
```json
{
  "name": "ValidationError",
  "error": "Tidak ada field yang diupdate. Berikan groupName atau description."
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

#### 403 Forbidden
```json
{
  "name": "ForbiddenError",
  "error": "Hanya pembuat grup yang dapat mengedit grup ini"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Grup tidak ditemukan"
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
curl -X PATCH "../api/mobile/groups/edit/grp_123456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "groupName": "Updated Weekend Trip",
    "description": "Updated description for our weekend getaway"
  }'
```

### Response
```json
{
  "message": "Group updated successfully",
  "groupId": "grp_123456",
  "groupName": "Updated Weekend Trip",
  "description": "Updated description for our weekend getaway",
  "memberCount": 3,
  "members": [
    {
      "userId": "usr_001",
      "name": "John Doe",
      "isCreator": true
    },
    {
      "userId": "usr_002",
      "name": "Jane Smith",
      "isCreator": false
    },
    {
      "userId": "usr_003",
      "name": "Bob Wilson",
      "isCreator": false
    }
  ]
}
```

## Business Logic
- Only group creator can edit group information
- At least one field (groupName or description) must be provided
- Both fields are optional but cannot both be empty
- Notifications are sent to all group members except the creator
- Group existence and creator permissions are verified
- Updated group information is returned in response
- Member list is included in response for convenience

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId)
- Request body validation (at least one field required)
- Creator permission validation
- Group existence validation
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling

---

# API Contract: Add Friend from Group Member (➕🤝)

## Endpoint
```
POST /api/mobile/groups/:groupId/add-friend/:memberId
```

## Description
- Adds a group member as a friend. Both users must be members of the same group, and they cannot already be friends.
- Menambahkan anggota grup sebagai teman. Kedua pengguna harus menjadi anggota grup yang sama, dan mereka belum berteman sebelumnya.

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
| Parameter | Type   | Required | Description                         |
|-----------|--------|----------|-------------------------------------|
| groupId   | string | Yes      | Unique identifier of the group      |
| memberId  | string | Yes      | User ID of the member to add as friend |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Friend added successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
}
```

#### 400 Validation Error (Missing Member ID)
```json
{
  "name": "ValidationError",
  "error": "ID member dibutuhkan"
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

#### 403 Forbidden (Not Group Member)
```json
{
  "name": "ForbiddenError",
  "error": "Anda bukan anggota grup ini"
}
```

#### 404 Not Found (Target Not in Group)
```json
{
  "name": "NotFoundError",
  "error": "User target tidak ada di grup ini"
}
```

#### 409 Conflict (Already Friends)
```json
{
  "name": "ConflictError",
  "error": "Sudah berteman"
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
curl -X POST "../api/mobile/groups/grp_123456/add-friend/usr_004" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Friend added successfully"
}
```

## Business Logic
- Both users must be members of the specified group
- Cannot add yourself as a friend
- Cannot add someone who is already your friend
- Creates a one-way friendship relationship
- Group membership is verified for both users
- Friendship status is checked before creation
- Only active group members can use this feature

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId and memberId)
- Self-addition prevention
- Group membership validation for both users
- Existing friendship detection
- Database connection validation
- Prisma error handling with custom error names
- Conflict detection for duplicate friendships

---

# API Contract: Leave Group (❌👥)

## Endpoint
```
POST /api/mobile/groups/:groupId/leave
```

## Description
- Allows a group member to leave the group. The group creator cannot leave and must delete the group instead.
- Memungkinkan anggota grup untuk keluar dari grup. Pembuat grup tidak dapat keluar dan harus menghapus grup sebagai gantinya.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| groupId   | string | Yes      | Unique identifier of the group |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Left group successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
}
```

#### 400 Validation Error (Creator Cannot Leave)
```json
{
  "name": "ValidationError",
  "error": "Pembuat grup tidak bisa keluar. Hapus grup sebagai gantinya."
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

#### 404 Not Found (Group Not Found)
```json
{
  "name": "NotFoundError",
  "error": "Grup tidak ditemukan"
}
```

#### 404 Not Found (Not a Member)
```json
{
  "name": "NotFoundError",
  "error": "Anda bukan anggota grup ini"
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
curl -X POST "../api/mobile/groups/grp_123456/leave" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Left group successfully"
}
```

## Business Logic
- Only regular members can leave the group
- Group creator cannot leave (must delete group instead)
- User must be a member of the group to leave
- Group existence is verified before processing
- Notification is sent to the group creator when member leaves
- Member removal is permanent and immediate
- User loses access to group content after leaving

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId)
- Creator leave prevention
- Group existence validation
- Member status validation
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling

---

# API Contract: Delete Group (❌👥👥👥)

## Endpoint
```
DELETE /api/mobile/groups/delete/:groupId
```

## Description
- Deletes an entire group and removes all members. Only the group creator can delete the group.
- Menghapus seluruh grup dan menghapus semua anggota. Hanya pembuat grup yang dapat menghapus grup.

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
| Parameter | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| groupId   | string | Yes      | Unique identifier of the group |

### Query Parameters
None

### Request Body
None

## Response

### Success Response (200 OK)
```json
{
  "message": "Group deleted successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Group ID)
```json
{
  "name": "ValidationError",
  "error": "ID grup dibutuhkan"
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

#### 403 Forbidden
```json
{
  "name": "ForbiddenError",
  "error": "Hanya pembuat grup yang dapat menghapus grup ini"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "Grup tidak ditemukan"
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
curl -X DELETE "../api/mobile/groups/delete/grp_123456" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Group deleted successfully"
}
```

## Business Logic
- Only group creator can delete the group
- All group members are removed before group deletion
- Notifications are sent to all members before deletion
- Group existence and creator permissions are verified
- Deletion is permanent and cannot be undone
- All associated data (members, bills) are handled appropriately
- Members lose access to group content immediately

## Error Handling
- JWT validation with proper error classification
- Path parameter validation (groupId)
- Creator permission validation
- Group existence validation
- Database connection validation
- Prisma error handling with custom error names
- Notification service error handling
- Cascading deletion handling

---