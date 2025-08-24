# API Contract: Get Profile

## Endpoint
```
GET /api/mobile/profile
```

## Description
Retrieves the authenticated user's profile information along with account statistics.
Mengambil informasi profil pengguna yang terautentikasi beserta statistik akun.

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
  "user": {
    "userId": "string",
    "name": "string",
    "email": "string",
    "username": "string",
    "phone": "string",
    "bniAccountNumber": "string",
    "bniBranchCode": "string",
    "isVerified": boolean,
    "defaultPaymentMethod": "string",
    "profilePictureUrl": "string",
    "profilePictureName": "string",
    "createdAt": "ISO 8601 datetime"
  },
  "stats": {
    "totalBills": number,
    "totalSpent": number,
    "pendingPayments": number
  }
}
```

### Response Schema
--User Object--
| Field                 | Type    | Description                                    |
|-----------------------|---------|------------------------------------------------|  
| userId                | string  | Unique identifier for the user                 |
| name                  | string  | Full name of the user                          |
| email                 | string  | Email address of the user                      |
| username              | string  | Username for authentication                    |
| phone                 | string  | Phone number of the user                       |
| bniAccountNumber      | string  | BNI bank account number                        |
| bniBranchCode         | string  | BNI branch code                                |
| isVerified            | boolean | Whether the user account is verified           |
| defaultPaymentMethod  | string  | Default payment method (instant/scheduled)     |
| profilePictureUrl     | string  | URL path to profile picture                    |
| profilePictureName    | string  | Filename of the profile picture                |
| createdAt             | string  | ISO 8601 datetime when account was created     |

--Stats Object--
| Field           | Type   | Description                                    |
|-----------------|--------|------------------------------------------------|
| totalBills      | number | Total number of bills user is involved in     |
| totalSpent      | number | Total amount spent by user (completed payments) |
| pendingPayments | number | Number of pending payments                     |

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

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "User profile not found"
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
curl -X GET "../api/mobile/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "user": {
    "userId": "usr_001",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "phone": "+628123456789",
    "bniAccountNumber": "1234567890",
    "bniBranchCode": "001",
    "isVerified": true,
    "defaultPaymentMethod": "instant",
    "profilePictureUrl": "/uploads/profiles/usr_001.jpg",
    "profilePictureName": "usr_001.jpg",
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "stats": {
    "totalBills": 15,
    "totalSpent": 450000.00,
    "pendingPayments": 3
  }
}
```

## Business Logic
- Returns comprehensive user profile information
- Includes authentication details (username, last login)
- Provides BNI banking information for payments
- Calculates real-time statistics:
  - Total bills: Bills where user is host OR participant
  - Total spent: Sum of all completed payments
  - Pending payments: Count of payments with pending status
- Profile picture information included if available
- User verification status for account security

## Error Handling
- JWT validation with proper error classification
- User existence validation
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling
- User ID validation from token

---

# API Contract: Update Profile

## Endpoint
```
PUT /api/mobile/profile
```

## Description
Updates the authenticated user's profile information. At least one field must be provided for update.
Memperbarui informasi profil pengguna yang terautentikasi. Setidaknya satu field harus disediakan untuk pembaruan.

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
  "name": "string",
  "phone": "string",
  "email": "string",
  "defaultPaymentMethod": "string"
}
```

| Field                | Type   | Required | Description                                        |
|----------------------|--------|----------|----------------------------------------------------|  
| name                 | string | No       | Full name of the user                              |
| phone                | string | No       | Phone number (numbers and + only)                 |
| email                | string | No       | Email address (must contain @ and .)              |
| defaultPaymentMethod | string | No       | Payment method ("instant" or "scheduled")         |

**Note**: At least one field must be provided for update.

## Response

### Success Response (200 OK)
```json
{
  "message": "Profile updated successfully",
  "user": {
    "userId": "string",
    "name": "string",
    "phone": "string",
    "email": "string",
    "defaultPaymentMethod": "string"
  }
}
```

### Response Schema
--Update Response Object--
| Field   | Type   | Description                           |
|---------|--------|---------------------------------------|
| message | string | Success confirmation message          |
| user    | object | Updated user information              |

--User Object--
| Field                | Type   | Description                                |
|----------------------|--------|--------------------------------------------|  
| userId               | string | Unique identifier for the user             |
| name                 | string | Updated full name of the user              |
| phone                | string | Updated phone number                       |
| email                | string | Updated email address                      |
| defaultPaymentMethod | string | Updated default payment method             |

### Error Responses

#### 400 Validation Error (No Fields)
```json
{
  "name": "ValidationError",
  "error": "Tidak ada field yang diupdate"
}
```

#### 400 Validation Error (Invalid Phone)
```json
{
  "name": "ValidationError",
  "error": "Nomor telepon tidak valid"
}
```

#### 400 Validation Error (Invalid Email)
```json
{
  "name": "ValidationError",
  "error": "Email tidak valid"
}
```

#### 400 Validation Error (Invalid Payment Method)
```json
{
  "name": "ValidationError",
  "error": "Metode pembayaran hanya boleh 'instant' atau 'scheduled'"
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

#### 409 Conflict
```json
{
  "name": "ConflictError",
  "error": "Email atau nomor telepon sudah digunakan"
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
curl -X PUT "../api/mobile/profile" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Smith",
    "phone": "+628123456789",
    "defaultPaymentMethod": "scheduled"
  }'
```

### Response
```json
{
  "message": "Profile updated successfully",
  "user": {
    "userId": "usr_001",
    "name": "John Smith",
    "phone": "+628123456789",
    "email": "john@example.com",
    "defaultPaymentMethod": "scheduled"
  }
}
```

## Business Logic
- At least one field must be provided for update
- Only provided fields are updated (partial update)
- Phone validation: only numbers and + symbol allowed
- Email validation: must contain @ and . characters
- Payment method validation: only "instant" or "scheduled" allowed
- Email and phone uniqueness enforced at database level
- Updates timestamp automatically
- Returns only updated user information (not full profile)

## Error Handling
- JWT validation with proper error classification
- Request body validation (at least one field required)
- Field format validation (phone, email, payment method)
- Uniqueness constraint handling (email/phone conflicts)
- Database connection validation
- Prisma error handling with custom error names
- User ID validation from token

---

# API Contract: Get Profile Picture

## Endpoint
```
GET /api/mobile/profile/picture
```

## Description
Retrieves the authenticated user's profile picture file. Returns the actual image file.
Mengambil file gambar profil pengguna yang terautentikasi. Mengembalikan file gambar yang sebenarnya.

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
**Content-Type**: `image/jpeg`, `image/jpg`, or `image/png`

Returns the actual image file as binary data.

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

#### 404 Not Found (No Profile Picture)
```json
{
  "name": "NotFoundError",
  "error": "No profile picture found"
}
```

#### 404 Not Found (File Not Found)
```json
{
  "name": "NotFoundError",
  "error": "Profile picture file not found"
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
curl -X GET "../api/mobile/profile/picture" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  --output profile_picture.jpg
```

### Response
Returns binary image data with appropriate Content-Type header.

## Business Logic
- Returns the actual image file, not JSON
- Checks database for profile picture filename
- Verifies file exists on filesystem before serving
- Supports JPEG, JPG, and PNG formats
- Only authenticated user can access their own profile picture
- Returns 404 if user has no profile picture set
- Returns 404 if database record exists but file is missing

## Error Handling
- JWT validation with proper error classification
- User ID validation from token
- Database connection validation
- Profile picture existence validation (database)
- File existence validation (filesystem)
- Prisma error handling with custom error names

---

# API Contract: Upload Profile Picture

## Endpoint
```
PUT /api/mobile/profile/upload-picture
```

## Description
Uploads a new profile picture for the authenticated user. Replaces existing profile picture if one exists.
Mengunggah gambar profil baru untuk pengguna yang terautentikasi. Mengganti gambar profil yang ada jika sudah ada.

## Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer <token>`

## Request

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

| Header        | Type   | Required | Description                     |
|---------------|--------|----------|---------------------------------|
| Authorization | string | Yes      | Bearer token for authentication |
| Content-Type  | string | Yes      | Must be multipart/form-data     |

### Path Parameters
None

### Query Parameters
None

### Request Body
**Form Data:**
| Field          | Type | Required | Description                           |
|----------------|------|----------|---------------------------------------|
| profilePicture | file | Yes      | Image file (JPEG, JPG, PNG only)     |

**File Constraints:**
- Maximum file size: 2MB
- Allowed formats: JPEG, JPG, PNG
- File will be renamed to userId + extension

## Response

### Success Response (200 OK)
```json
{
  "message": "Profile picture updated successfully",
  "profilePictureUrl": "string",
  "user": {
    "userId": "string",
    "name": "string",
    "profilePictureUrl": "string",
    "profilePictureName": "string"
  }
}
```

### Response Schema
--Upload Response Object--
| Field              | Type   | Description                           |
|--------------------|--------|---------------------------------------|
| message            | string | Success confirmation message          |
| profilePictureUrl  | string | URL path to the uploaded image        |
| user               | object | Updated user information              |

--User Object--
| Field               | Type   | Description                           |
|---------------------|--------|---------------------------------------|
| userId              | string | Unique identifier for the user        |
| name                | string | Full name of the user                 |
| profilePictureUrl   | string | URL path to profile picture           |
| profilePictureName  | string | Filename of the profile picture       |

### Error Responses

#### 400 Bad Request (No File)
```json
{
  "name": "BadRequestError",
  "error": "No image file provided"
}
```

#### 400 Bad Request (Invalid File Type)
```json
{
  "error": "Only image files (jpeg, jpg, png, gif) are allowed"
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
curl -X PUT "../api/mobile/profile/upload-picture" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -F "profilePicture=@/path/to/image.jpg"
```

### Response
```json
{
  "message": "Profile picture updated successfully",
  "profilePictureUrl": "/uploads/profiles/usr_001.jpg",
  "user": {
    "userId": "usr_001",
    "name": "John Doe",
    "profilePictureUrl": "/uploads/profiles/usr_001.jpg",
    "profilePictureName": "usr_001.jpg"
  }
}
```

## Business Logic
- Automatically deletes old profile picture if exists
- File is renamed to userId + original extension
- Maximum file size: 2MB (2 * 800 * 800 bytes)
- Only JPEG, JPG, PNG formats allowed
- File stored in `/public/uploads/profiles/` directory
- Database updated with new file information
- If database update fails, uploaded file is automatically deleted
- Replaces existing profile picture completely

## Error Handling
- JWT validation with proper error classification
- File upload validation (presence, type, size)
- Automatic cleanup on database failure
- Old file deletion before new upload
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Delete Profile Picture

## Endpoint
```
DELETE /api/mobile/profile/delete-picture
```

## Description
Deletes the authenticated user's profile picture from both database and filesystem.
Menghapus gambar profil pengguna yang terautentikasi dari database dan sistem file.

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
  "message": "Profile picture deleted successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

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

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "No profile picture found"
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
curl -X DELETE "../api/mobile/profile/delete-picture" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Profile picture deleted successfully"
}
```

## Business Logic
- Deletes file from filesystem first
- Updates database to remove profile picture references
- Sets profilePictureUrl and profilePictureName to null
- Only works if user has an existing profile picture
- File deletion is safe (checks existence before deletion)
- Database update happens after successful file deletion
- Updates user's updatedAt timestamp

## Error Handling
- JWT validation with proper error classification
- Profile picture existence validation
- File system operation validation
- Database connection validation
- Prisma error handling with custom error names
- User ID validation from token

---

# API Contract: Change Password

## Endpoint
```
PUT /api/mobile/profile/change-password
```

## Description
Changes the authenticated user's password. Requires current password verification.
Mengubah password pengguna yang terautentikasi. Memerlukan verifikasi password saat ini.

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
  "currentPassword": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

| Field           | Type   | Required | Description                           |
|-----------------|--------|----------|---------------------------------------|
| currentPassword | string | Yes      | User's current password               |
| newPassword     | string | Yes      | New password (minimum 8 characters)  |
| confirmPassword | string | Yes      | Confirmation of new password          |

## Response

### Success Response (200 OK)
```json
{
  "message": "Password changed successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Current password, new password, and confirm password required"
}
```

#### 400 Validation Error (Password Mismatch)
```json
{
  "name": "ValidationError",
  "error": "New password and confirm password do not match"
}
```

#### 400 Validation Error (Password Too Short)
```json
{
  "name": "ValidationError",
  "error": "Password minimal 8 karakter"
}
```

#### 400 Validation Error (Current Password Incorrect)
```json
{
  "name": "ValidationError",
  "error": "Current password is incorrect"
}
```

#### 400 Validation Error (Same Password)
```json
{
  "name": "ValidationError",
  "error": "Password baru tidak boleh sama dengan password saat ini"
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
  "error": "User authentication not found"
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
curl -X PUT "../api/mobile/profile/change-password" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "oldpassword123",
    "newPassword": "newpassword456",
    "confirmPassword": "newpassword456"
  }'
```

### Response
```json
{
  "message": "Password changed successfully"
}
```

## Business Logic
- All three fields are required
- New password must match confirm password
- Minimum password length: 8 characters
- Current password must be verified before change
- New password cannot be the same as current password
- Password is hashed using bcrypt with salt rounds of 10
- Updates userAuth table, not main user table
- No automatic logout after password change

## Error Handling
- JWT validation with proper error classification
- Request body validation (all fields required)
- Password confirmation matching
- Minimum length validation
- Current password verification
- Same password prevention
- Database connection validation
- Prisma error handling with custom error names
- User authentication record validation

---

# API Contract: Change PIN

## Endpoint
```
PUT /api/mobile/profile/change-pin
```

## Description
Changes the authenticated user's PIN. Requires current PIN verification.
Mengubah PIN pengguna yang terautentikasi. Memerlukan verifikasi PIN saat ini.

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
  "currentPin": "string",
  "newPin": "string",
  "confirmPin": "string"
}
```

| Field      | Type   | Required | Description                           |
|------------|--------|----------|---------------------------------------|
| currentPin | string | Yes      | User's current PIN (6 digits)        |
| newPin     | string | Yes      | New PIN (exactly 6 digits, numbers only) |
| confirmPin | string | Yes      | Confirmation of new PIN               |

## Response

### Success Response (200 OK)
```json
{
  "message": "PIN changed successfully"
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Current PIN, new PIN, and confirm PIN required"
}
```

#### 400 Validation Error (PIN Mismatch)
```json
{
  "name": "ValidationError",
  "error": "New PIN and confirm PIN do not match"
}
```

#### 400 Validation Error (Invalid PIN Length)
```json
{
  "name": "ValidationError",
  "error": "PIN tidak sesuai"
}
```

#### 400 Validation Error (Invalid PIN Format)
```json
{
  "name": "ValidationError",
  "error": "PIN tidak sesuai"
}
```

#### 400 Validation Error (Current PIN Incorrect)
```json
{
  "name": "ValidationError",
  "error": "Current PIN is incorrect"
}
```

#### 400 Validation Error (Same PIN)
```json
{
  "name": "ValidationError",
  "error": "PIN baru tidak boleh sama dengan PIN saat ini"
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
  "error": "User PIN not found"
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
curl -X PUT "../api/mobile/profile/change-pin" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "currentPin": "123456",
    "newPin": "654321",
    "confirmPin": "654321"
  }'
```

### Response
```json
{
  "message": "PIN changed successfully"
}
```

## Business Logic
- All three fields are required
- New PIN must match confirm PIN
- PIN must be exactly 6 digits
- PIN must contain only numbers (0-9)
- Current PIN must be verified before change
- New PIN cannot be the same as current PIN
- PIN is hashed using bcrypt with salt rounds of 10
- Updates main user table (encryptedPinHash field)
- Used for payment authentication and security

## Error Handling
- JWT validation with proper error classification
- Request body validation (all fields required)
- PIN confirmation matching
- Exact length validation (6 digits)
- Numeric format validation (numbers only)
- Current PIN verification
- Same PIN prevention
- Database connection validation
- Prisma error handling with custom error names
- User PIN record validation

---

# API Contract: Email Notifications Toggle

## Endpoint
```
PUT /api/mobile/profile/email-notifications-toggle
```

## Description
Toggles email notifications on or off for the authenticated user.
Mengaktifkan atau menonaktifkan notifikasi email untuk pengguna yang terautentikasi.

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
  "emailNotifToggle": boolean
}
```

| Field            | Type    | Required | Description                           |
|------------------|---------|----------|---------------------------------------|
| emailNotifToggle | boolean | Yes      | true to enable, false to disable      |

## Response

### Success Response (200 OK)
```json
{
  "message": "Email notifications enabled successfully"
}
```

### Response Schema
| Field   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| message | string | Dynamic message based on toggle state         |

**Message Examples:**
- `"Email notifications enabled successfully"` (when emailNotifToggle is true)
- `"Email notifications disabled successfully"` (when emailNotifToggle is false)

### Error Responses

#### 400 Validation Error (Invalid Type)
```json
{
  "name": "ValidationError",
  "error": "Invalid input: emailNotifToggle must be a boolean"
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

#### 500 Database Error
```json
{
  "name": "DatabaseError",
  "error": "Koneksi database tidak tersedia"
}
```

## Example

### Request (Enable Notifications)
```bash
curl -X PUT "../api/mobile/profile/email-notifications-toggle" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifToggle": true
  }'
```

### Response
```json
{
  "message": "Email notifications enabled successfully"
}
```

### Request (Disable Notifications)
```bash
curl -X PUT "../api/mobile/profile/email-notifications-toggle" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifToggle": false
  }'
```

### Response
```json
{
  "message": "Email notifications disabled successfully"
}
```

## Business Logic
- Only accepts boolean values (true/false)
- Updates user's emailNotifToggle field in database
- Updates user's updatedAt timestamp automatically
- Dynamic response message based on toggle state
- Controls whether user receives email notifications for:
  - Bill invitations
  - Payment reminders
  - Group activities
  - Account security alerts

## Error Handling
- JWT validation with proper error classification
- Request body validation (boolean type required)
- Database connection validation
- Prisma error handling with custom error names
- User ID validation from token
- Type validation for boolean input