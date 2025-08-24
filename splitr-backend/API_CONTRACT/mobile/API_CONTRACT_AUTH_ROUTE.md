# API Contract: Login (➜🚪)

## Endpoint
```
POST /api/mobile/auth/login
```

## Description
- Authenticates a user with username and password, returns JWT token and user information.
- Mengautentikasi pengguna dengan username dan password, mengembalikan token JWT dan informasi pengguna.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "username": "string",
  "password": "string"
}
```

| Field    | Type   | Required | Description                    |
|----------|--------|----------|--------------------------------|
| username | string | Yes      | User's username for login      |
| password | string | Yes      | User's password for login      |

## Response

### Success Response (200 OK)
```json
{
  "token": "string",
  "refreshTokenExp": "ISO 8601 datetime",
  "user": {
    "authId": "string",
    "userId": "string",
    "name": "string",
    "email": "string",
    "username": "string",
    "bniAccountNumber": "string"
  }
}
```

### Response Schema
--Login Response Object--
| Field           | Type   | Description                                    |
|-----------------|--------|------------------------------------------------|
| token           | string | JWT access token for authentication           |
| refreshTokenExp | string | ISO 8601 datetime when refresh token expires  |
| user            | object | User information                               |

--User Object--
| Field            | Type   | Description                           |
|------------------|--------|---------------------------------------|  
| authId           | string | Unique identifier for authentication  |
| userId           | string | Unique identifier for the user        |
| name             | string | Full name of the user                 |
| email            | string | Email address of the user             |
| username         | string | Username used for login               |
| bniAccountNumber | string | BNI bank account number               |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Username and password required"
}
```

#### 400 Validation Error (Invalid Credentials)
```json
{
  "name": "ValidationError",
  "error": "Invalid credentials"
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
curl -X POST "../api/mobile/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "password123"
  }'
```

### Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshTokenExp": "2024-01-16T10:30:00Z",
  "user": {
    "authId": "auth_001",
    "userId": "usr_001",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "bniAccountNumber": "1234567890"
  }
}
```

## Business Logic
- Validates username and password are provided
- Looks up user by username in userAuth table
- Verifies password using bcrypt comparison
- Generates JWT token with 24-hour expiration
- Updates user's last login timestamp
- Resets login attempts counter on successful login
- Stores refresh token in database with expiration
- Returns user information for client-side storage
- Token includes userId and authId in payload

## Error Handling
- Input validation for required fields
- Credential validation (username/password verification)
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling
- Secure password comparison using bcrypt

---

# API Contract: Validate BNI Account (✅🏦)

## Endpoint
```
POST /api/mobile/auth/validate-bni
```

## Description
- Validates BNI account credentials against the dummy account database. Used during registration process.
- Memvalidasi kredensial akun BNI terhadap database akun dummy. Digunakan selama proses registrasi.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "namaRekening": "string",
  "nomorRekening": "string"
}
```

| Field         | Type   | Required | Description                    |
|---------------|--------|----------|--------------------------------|
| namaRekening  | string | Yes      | BNI account holder name        |
| nomorRekening | string | Yes      | BNI account number             |

## Response

### Success Response (200 OK)
```json
{
  "valid": true,
  "branchCode": "string"
}
```

### Response Schema
| Field      | Type    | Description                           |
|------------|---------|---------------------------------------|
| valid      | boolean | Whether the BNI account is valid      |
| branchCode | string  | BNI branch code for the account       |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Nama rekening and nomor rekening required"
}
```

#### 404 Not Found (Account Not Found)
```json
{
  "name": "NotFoundError",
  "error": "BNI account not found or mismatch"
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
curl -X POST "../api/mobile/auth/validate-bni" \
  -H "Content-Type: application/json" \
  -d '{
    "namaRekening": "John Doe",
    "nomorRekening": "1234567890"
  }'
```

### Response
```json
{
  "valid": true,
  "branchCode": "001"
}
```

## Business Logic
- Both account holder name and account number are required
- Validates against bniDummyAccount table in database
- Only checks active accounts (isActive: true)
- Account holder name and number must match exactly
- Returns associated branch code for valid accounts
- Used as validation step before user registration
- No authentication required (public validation endpoint)

## Error Handling
- Input validation for both required fields
- Database connection validation
- Account existence and match validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Send OTP for Registration (✉️🔢)

## Endpoint
```
POST /api/mobile/auth/send-otp
```

## Description
- Sends OTP code to email for registration verification. Validates email availability before sending.
- Mengirim kode OTP ke email untuk verifikasi registrasi. Memvalidasi ketersediaan email sebelum mengirim.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "email": "string"
}
```

| Field | Type   | Required | Description                           |
|-------|--------|----------|---------------------------------------|
| email | string | Yes      | Email address for OTP delivery        |

## Response

### Success Response (200 OK)
```json
{
  "message": "OTP sent to email",
  "otp": "string"
}
```

### Response Schema
| Field   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| message | string | Success confirmation message                   |
| otp     | string | OTP code (shown for testing purposes only)    |

### Error Responses

#### 400 Validation Error (Missing Email)
```json
{
  "name": "ValidationError",
  "error": "Email required"
}
```

#### 400 Validation Error (Invalid Email Format)
```json
{
  "name": "ValidationError",
  "error": "Format email tidak valid"
}
```

#### 400 Validation Error (Email Already Registered)
```json
{
  "name": "ValidationError",
  "error": "Email already registered"
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
curl -X POST "../api/mobile/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### Response
```json
{
  "message": "OTP sent to email",
  "otp": "123456"
}
```

## Business Logic
- Email field is required
- Email format validation (must contain @ and .)
- Checks if email is already registered (prevents duplicates)
- Generates 6-digit OTP code (currently fixed as "123456" for testing)
- Deletes any existing OTP for the email before creating new one
- Stores OTP in database with 5-minute expiration
- OTP purpose set to "registration"
- Email sending is mocked (commented out for testing)
- Returns OTP in response for testing purposes only

## Error Handling
- Input validation for required email field
- Email format validation (basic @ and . check)
- Email availability validation (not already registered)
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Verify OTP for Registration (✅🔢)

## Endpoint
```
POST /api/mobile/auth/verify-otp
```

## Description
- Verifies OTP code for registration process. Returns temporary token for completing registration.
- Memverifikasi kode OTP untuk proses registrasi. Mengembalikan token sementara untuk menyelesaikan registrasi.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "email": "string",
  "otp": "string"
}
```

| Field | Type   | Required | Description                           |
|-------|--------|----------|---------------------------------------|
| email | string | Yes      | Email address used for OTP            |
| otp   | string | Yes      | 6-digit OTP code received via email   |

## Response

### Success Response (200 OK)
```json
{
  "verified": true,
  "tempToken": "string"
}
```

### Response Schema
| Field     | Type    | Description                                    |
|-----------|---------|------------------------------------------------|
| verified  | boolean | Whether OTP verification was successful        |
| tempToken | string  | Temporary token for completing registration    |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Email dan OTP dibutuhkan"
}
```

#### 400 Validation Error (Invalid Email Format)
```json
{
  "name": "ValidationError",
  "error": "Format email tidak valid"
}
```

#### 400 Validation Error (Invalid OTP Length)
```json
{
  "name": "ValidationError",
  "error": "OTP tidak sesuai"
}
```

#### 400 Validation Error (Invalid OTP Format)
```json
{
  "name": "ValidationError",
  "error": "OTP tidak sesuai"
}
```

#### 400 Validation Error (Invalid or Expired OTP)
```json
{
  "name": "ValidationError",
  "error": "OTP tidak valid atau sudah kadaluarsa"
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
curl -X POST "../api/mobile/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

### Response
```json
{
  "verified": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Business Logic
- Both email and OTP fields are required
- Email format validation (must contain @ and .)
- OTP must be exactly 6 digits
- OTP must contain only numbers (0-9)
- Validates OTP against database record
- Checks OTP purpose is "registration"
- Verifies OTP is not already used (isUsed: false)
- Checks OTP has not expired (expiresAt >= current time)
- Marks OTP as used after successful verification
- Generates temporary token with 10-minute expiration
- Temporary token contains email and verified flag
- Used for proceeding to complete registration

## Error Handling
- Input validation for both required fields
- Email format validation (basic @ and . check)
- OTP length validation (exactly 6 digits)
- OTP format validation (numbers only)
- OTP existence and validity validation
- OTP expiration check
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Verify PIN (✅🔢)

## Endpoint
```
POST /api/mobile/auth/verify-pin
```

## Description
- Verifies user's PIN for authentication purposes. Used for secure operations and payment confirmations.
- Memverifikasi PIN pengguna untuk tujuan autentikasi. Digunakan untuk operasi aman dan konfirmasi pembayaran.

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
  "pin": "string"
}
```

| Field | Type   | Required | Description                           |
|-------|--------|----------|---------------------------------------|
| pin   | string | Yes      | 6-digit PIN (numbers only)            |

## Response

### Success Response (200 OK)
```json
{
  "verified": true,
  "message": "PIN verified successfully"
}
```

### Response Schema
| Field    | Type    | Description                           |
|----------|---------|---------------------------------------|
| verified | boolean | Whether PIN verification was successful |
| message  | string  | Success confirmation message          |

### Error Responses

#### 400 Validation Error (Missing PIN)
```json
{
  "name": "ValidationError",
  "error": "PIN dibutuhkan"
}
```

#### 400 Validation Error (Invalid PIN Length)
```json
{
  "name": "ValidationError",
  "error": "PIN harus 6 digit"
}
```

#### 400 Validation Error (Invalid PIN Format)
```json
{
  "name": "ValidationError",
  "error": "PIN hanya boleh berisi angka"
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

#### 401 Unauthorized (Invalid PIN)
```json
{
  "name": "UnauthorizedError",
  "error": "PIN tidak valid"
}
```

#### 404 Not Found (PIN Not Set)
```json
{
  "name": "NotFoundError",
  "error": "PIN belum diatur"
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
curl -X POST "../api/mobile/auth/verify-pin" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "pin": "123456"
  }'
```

### Response
```json
{
  "verified": true,
  "message": "PIN verified successfully"
}
```

## Business Logic
- PIN field is required
- PIN must be exactly 6 digits
- PIN must contain only numbers (0-9)
- Validates against user's stored encrypted PIN hash
- Uses bcrypt comparison for secure PIN verification
- User must have PIN set up (not null in database)
- Used for payment confirmations and secure operations
- Returns verification status and confirmation message
- Extracts user ID from JWT token

## Error Handling
- JWT validation with proper error classification
- Input validation for required PIN field
- PIN length validation (exactly 6 digits)
- PIN format validation (numbers only)
- PIN existence validation (must be set)
- PIN correctness validation using bcrypt
- Database connection validation
- Prisma error handling with custom error names
- User ID validation from token

---

# API Contract: Complete Registration (✅📝)

## Endpoint
```
POST /api/mobile/auth/register
```

## Description
- Completes user registration after OTP verification. Creates user account with authentication credentials.
- Menyelesaikan registrasi pengguna setelah verifikasi OTP. Membuat akun pengguna dengan kredensial autentikasi.

## Authentication
- **Required**: No
- **Type**: None (uses temporary token from OTP verification)

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "tempToken": "string",
  "username": "string",
  "password": "string",
  "pin": "string",
  "namaRekening": "string",
  "nomorRekening": "string",
  "phone": "string"
}
```

| Field         | Type   | Required | Description                           |
|---------------|--------|----------|---------------------------------------|
| tempToken     | string | Yes      | Temporary token from OTP verification |
| username      | string | Yes      | Unique username for login             |
| password      | string | Yes      | Password (minimum 8 characters)       |
| pin           | string | Yes      | 6-digit PIN (numbers only)            |
| namaRekening  | string | Yes      | BNI account holder name               |
| nomorRekening | string | Yes      | BNI account number                    |
| phone         | string | Yes      | Phone number                          |

## Response

### Success Response (200 OK)
```json
{
  "message": "Registration successful",
  "user": {
    "userId": "string",
    "name": "string",
    "email": "string",
    "username": "string",
    "bniAccountNumber": "string"
  }
}
```

### Response Schema
--Registration Response Object--
| Field   | Type   | Description                           |
|---------|--------|---------------------------------------|
| message | string | Success confirmation message          |
| user    | object | Created user information              |

--User Object--
| Field            | Type   | Description                           |
|------------------|--------|---------------------------------------|
| userId           | string | Unique identifier for the user        |
| name             | string | Full name (from namaRekening)         |
| email            | string | Email address (from temp token)       |
| username         | string | Username for login                    |
| bniAccountNumber | string | BNI bank account number               |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Semua field dibutuhkan"
}
```

#### 400 Validation Error (Password Too Short)
```json
{
  "name": "ValidationError",
  "error": "Password minimal 8 karakter"
}
```

#### 400 Validation Error (Invalid PIN)
```json
{
  "name": "ValidationError",
  "error": "PIN tidak sesuai"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "UnauthorizedError",
  "error": "Token tidak valid atau sudah kadaluarsa"
}
```

#### 404 Not Found (Invalid BNI Account)
```json
{
  "name": "NotFoundError",
  "error": "Akun BNI tidak valid"
}
```

#### 409 Conflict (Username Taken)
```json
{
  "name": "ConflictError",
  "error": "Username sudah digunakan"
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
curl -X POST "../api/mobile/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "username": "johndoe",
    "password": "password123",
    "pin": "123456",
    "namaRekening": "John Doe",
    "nomorRekening": "1234567890",
    "phone": "+628123456789"
  }'
```

### Response
```json
{
  "message": "Registration successful",
  "user": {
    "userId": "usr_001",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "bniAccountNumber": "1234567890"
  }
}
```

## Business Logic
- All fields are required for registration
- Temporary token must be valid and not expired (10-minute expiration)
- Password must be at least 8 characters
- PIN must be exactly 6 digits (numbers only)
- BNI account validation against dummy account database
- Username uniqueness validation
- Email extracted from temporary token
- User name set to BNI account holder name
- PIN and password hashed using bcrypt (10 salt rounds)
- User marked as verified upon creation
- Database transaction ensures data consistency
- Branch code automatically assigned from BNI account

## Error Handling
- Input validation for all required fields
- Temporary token verification and expiration check
- Password length validation (minimum 8 characters)
- PIN format validation (6 digits, numbers only)
- BNI account existence and validity check
- Username uniqueness validation
- Database transaction handling
- Prisma error handling with custom error names
- Conflict detection for duplicate usernames

---

# API Contract: Send Reset OTP (✉️🔢)

## Endpoint
```
POST /api/mobile/auth/send-reset-otp
```

## Description
- Sends OTP code to registered email for password reset verification. Validates email is registered before sending.
- Mengirim kode OTP ke email terdaftar untuk verifikasi reset password. Memvalidasi email sudah terdaftar sebelum mengirim.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "email": "string"
}
```

| Field | Type   | Required | Description                           |
|-------|--------|----------|---------------------------------------|
| email | string | Yes      | Registered email address for reset    |

## Response

### Success Response (200 OK)
```json
{
  "message": "Reset OTP sent to email",
  "otp": "string"
}
```

### Response Schema
| Field   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| message | string | Success confirmation message                   |
| otp     | string | OTP code (shown for testing purposes only)    |

### Error Responses

#### 400 Validation Error (Missing Email)
```json
{
  "name": "ValidationError",
  "error": "Email dibutuhkan"
}
```

#### 400 Validation Error (Invalid Email Format)
```json
{
  "name": "ValidationError",
  "error": "Format email tidak valid"
}
```

#### 404 Not Found (Email Not Registered)
```json
{
  "name": "NotFoundError",
  "error": "Email tidak terdaftar"
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
curl -X POST "../api/mobile/auth/send-reset-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com"
  }'
```

### Response
```json
{
  "message": "Reset OTP sent to email",
  "otp": "123456"
}
```

## Business Logic
- Email field is required
- Email format validation (must contain @ and .)
- Checks if email is registered (opposite of registration OTP)
- Generates 6-digit OTP code (currently fixed as "123456" for testing)
- Deletes any existing reset OTP for the email before creating new one
- Stores OTP in database with 5-minute expiration
- OTP purpose set to "reset_password"
- Email sending is mocked (commented out for testing)
- Returns OTP in response for testing purposes only
- Used for password reset flow, not registration

## Error Handling
- Input validation for required email field
- Email format validation (basic @ and . check)
- Email registration validation (must be registered)
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Verify Reset OTP (✅🔢)

## Endpoint
```
POST /api/mobile/auth/verify-reset-otp
```

## Description
- Verifies OTP code for password reset process. Returns temporary token for completing password reset.
- Memverifikasi kode OTP untuk proses reset password. Mengembalikan token sementara untuk menyelesaikan reset password.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "email": "string",
  "otp": "string"
}
```

| Field | Type   | Required | Description                           |
|-------|--------|----------|---------------------------------------|
| email | string | Yes      | Email address used for reset OTP     |
| otp   | string | Yes      | 6-digit OTP code received via email   |

## Response

### Success Response (200 OK)
```json
{
  "verified": true,
  "tempToken": "string"
}
```

### Response Schema
| Field     | Type    | Description                                    |
|-----------|---------|------------------------------------------------|
| verified  | boolean | Whether OTP verification was successful        |
| tempToken | string  | Temporary token for completing password reset |

### Error Responses

#### 400 Validation Error (Missing Fields)
```json
{
  "name": "ValidationError",
  "error": "Email dan OTP dibutuhkan"
}
```

#### 400 Validation Error (Invalid Email Format)
```json
{
  "name": "ValidationError",
  "error": "Format email tidak valid"
}
```

#### 400 Validation Error (Invalid OTP Length)
```json
{
  "name": "ValidationError",
  "error": "OTP tidak sesuai"
}
```

#### 400 Validation Error (Invalid OTP Format)
```json
{
  "name": "ValidationError",
  "error": "PIN tidak sesuai"
}
```

#### 400 Validation Error (Invalid or Expired OTP)
```json
{
  "name": "ValidationError",
  "error": "OTP tidak valid atau sudah kadaluarsa"
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
curl -X POST "../api/mobile/auth/verify-reset-otp" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "otp": "123456"
  }'
```

### Response
```json
{
  "verified": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Business Logic
- Both email and OTP fields are required
- Email format validation (must contain @ and .)
- OTP must be exactly 6 digits
- OTP must contain only numbers (0-9)
- Validates OTP against database record
- Checks OTP purpose is "reset_password"
- Verifies OTP is not already used (isUsed: false)
- Checks OTP has not expired (expiresAt >= current time)
- Marks OTP as used after successful verification
- Generates temporary token with 10-minute expiration
- Temporary token contains email and purpose "reset"
- Used for proceeding to password reset completion

## Error Handling
- Input validation for both required fields
- Email format validation (basic @ and . check)
- OTP length validation (exactly 6 digits)
- OTP format validation (numbers only)
- OTP existence and validity validation
- OTP expiration check
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Reset Passwordv (🔑📝)

## Endpoint
```
POST /api/mobile/auth/reset-password
```

## Description
- Completes password reset using temporary token from OTP verification. Sets new password for the user account.
- Menyelesaikan reset password menggunakan token sementara dari verifikasi OTP. Menetapkan password baru untuk akun pengguna.

## Authentication
- **Required**: No
- **Type**: None (uses temporary token from OTP verification)

## Request

### Headers
```
Content-Type: application/json
```

| Header       | Type   | Required | Description                |
|--------------|--------|----------|----------------------------|
| Content-Type | string | Yes      | Must be application/json   |

### Path Parameters
None

### Query Parameters
None

### Request Body
```json
{
  "tempToken": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

| Field           | Type   | Required | Description                           |
|-----------------|--------|----------|---------------------------------------|
| tempToken       | string | Yes      | Temporary token from OTP verification |
| newPassword     | string | Yes      | New password (minimum 8 characters)  |
| confirmPassword | string | Yes      | Confirmation of new password          |

## Response

### Success Response (200 OK)
```json
{
  "message": "Password reset successfully"
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
  "error": "Semua field dibutuhkan"
}
```

#### 400 Validation Error (Password Mismatch)
```json
{
  "name": "ValidationError",
  "error": "Password tidak cocok"
}
```

#### 400 Validation Error (Password Too Short)
```json
{
  "name": "ValidationError",
  "error": "Password harus minimal 8 karakter"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "UnauthorizedError",
  "error": "Token tidak valid atau sudah kadaluarsa"
}
```

#### 401 Unauthorized (Invalid Token Purpose)
```json
{
  "name": "UnauthorizedError",
  "error": "Token tidak valid untuk reset password"
}
```

#### 404 Not Found (User Not Found)
```json
{
  "name": "NotFoundError",
  "error": "User tidak ditemukan"
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
curl -X POST "../api/mobile/auth/reset-password" \
  -H "Content-Type: application/json" \
  -d '{
    "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "newPassword": "newpassword123",
    "confirmPassword": "newpassword123"
  }'
```

### Response
```json
{
  "message": "Password reset successfully"
}
```

## Business Logic
- All three fields are required
- New password and confirm password must match
- Password must be at least 8 characters long
- Temporary token must be valid and not expired (10-minute expiration)
- Token purpose must be "reset" (from reset OTP verification)
- Finds user by email from token payload
- Updates password hash in userAuth table
- Password is hashed using bcrypt with 10 salt rounds
- Completes the password reset flow after OTP verification
- User can login with new password immediately

## Error Handling
- Input validation for all required fields
- Password confirmation matching validation
- Password length validation (minimum 8 characters)
- Temporary token verification and expiration check
- Token purpose validation (must be "reset")
- User existence validation by email
- Database connection validation
- Prisma error handling with custom error names

---

# API Contract: Get My BNI Account (🏦👤)

## Endpoint
```
GET /api/mobile/auth/my-account
```

## Description
- Retrieves the authenticated user's BNI account details including balance and branch information.
- Mengambil detail akun BNI pengguna yang terautentikasi termasuk saldo dan informasi cabang.

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
  "accountNumber": "string",
  "accountName": "string",
  "balance": number,
  "branchCode": "string",
  "branch": {
    "branchName": "string",
    "city": "string",
    "province": "string"
  }
}
```

### Response Schema
--Account Details Object--
| Field         | Type   | Description                           |
|---------------|--------|---------------------------------------|
| accountNumber | string | BNI account number                    |
| accountName   | string | Account holder name                   |
| balance       | number | Current account balance               |
| branchCode    | string | BNI branch code                       |
| branch        | object | Branch information                    |

--Branch Object--
| Field      | Type   | Description                    |
|------------|--------|--------------------------------|
| branchName | string | Name of the BNI branch         |
| city       | string | City where branch is located   |
| province   | string | Province where branch is located |

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

#### 404 Not Found (BNI Account Not Found)
```json
{
  "name": "NotFoundError",
  "error": "Akun BNI tidak ditemukan"
}
```

#### 404 Not Found (Account Details Not Found)
```json
{
  "name": "NotFoundError",
  "error": "Detail akun tidak ditemukan"
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
curl -X GET "../api/mobile/auth/my-account" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "accountNumber": "1234567890",
  "accountName": "John Doe",
  "balance": 5000000.00,
  "branchCode": "001",
  "branch": {
    "branchName": "Jakarta Thamrin",
    "city": "Jakarta",
    "province": "DKI Jakarta"
  }
}
```

## Business Logic
- Extracts user ID from JWT token
- Retrieves user's BNI account number from user table
- Fetches account details from bniDummyAccount table
- Retrieves branch information from bniBranch table
- Returns comprehensive account information including balance
- Balance is converted to float for proper numeric display
- User must have BNI account number associated
- Account must exist in dummy account database
- Branch information is optional (uses optional chaining)

## Error Handling
- JWT validation with proper error classification
- User ID validation from token
- BNI account existence validation
- Account details existence validation
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---

# API Contract: Logout (🚪🔒)

## Endpoint
```
POST /api/mobile/auth/logout
```

## Description
Logs out the authenticated user by invalidating their refresh token and clearing session data.
Mengeluarkan pengguna yang terautentikasi dengan membatalkan refresh token mereka dan menghapus data sesi.

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
  "message": "Logout successful."
}
```

### Response Schema
| Field   | Type   | Description                    |
|---------|--------|--------------------------------|
| message | string | Success confirmation message   |

### Error Responses

#### 401 Unauthorized (Missing Header)
```json
{
  "name": "UnauthorizedError",
  "error": "Authorization header tidak ada"
}
```

#### 401 Unauthorized (Missing Token)
```json
{
  "name": "ValidationError",
  "error": "Token dibutuhkan untuk logout"
}
```

#### 401 Unauthorized (Invalid Token)
```json
{
  "name": "UnauthorizedError",
  "error": "Token tidak valid untuk user ini"
}
```

#### 401 Unauthorized (Missing Auth ID)
```json
{
  "name": "UnauthorizedError",
  "error": "Auth ID tidak ditemukan di dalam token"
}
```

#### 404 Not Found
```json
{
  "name": "NotFoundError",
  "error": "User auth tidak ditemukan"
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
curl -X POST "../api/mobile/auth/logout" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Response
```json
{
  "message": "Logout successful."
}
```

## Business Logic
- Extracts authId from JWT token payload
- Validates Authorization header presence
- Extracts token from Authorization header
- Finds user authentication record by authId
- Validates that provided token matches stored refresh token
- Clears refresh token and expiration from database
- Resets login attempts and locked status
- Invalidates user session completely
- Token becomes unusable after logout
- User must login again to get new tokens

## Error Handling
- JWT validation with proper error classification
- Authorization header validation
- Token presence validation
- Auth ID validation from token payload
- User authentication record validation
- Token matching validation (security check)
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling

---