# Profile Picture API Test Guide

## Endpoints yang Ditambahkan:

### 1. Upload Profile Picture
```
POST /api/mobile/profile/upload-picture
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body (form-data):
- profilePicture: [image file] (jpeg, jpg, png, gif, max 5MB)
```

**Response Success:**
```json
{
  "message": "Profile picture updated successfully",
  "profilePicture": "/uploads/profiles/user123_1234567890.jpg",
  "user": {
    "userId": "user123",
    "name": "John Doe",
    "profilePicture": "/uploads/profiles/user123_1234567890.jpg"
  }
}
```

### 2. Delete Profile Picture
```
DELETE /api/mobile/profile/picture
Authorization: Bearer <token>
```

**Response Success:**
```json
{
  "message": "Profile picture deleted successfully"
}
```

### 3. Get Profile Picture by Name
```
GET /api/mobile/profile/picture/:pictureName
```

**Response:** Image file

### 4. Get Profile (Updated)
```
GET /api/mobile/profile/
Authorization: Bearer <token>
```

**Response Success (now includes profilePicture & profilePictureName):**
```json
{
  "user": {
    "userId": "user123",
    "name": "John Doe",
    "email": "john@example.com",
    "username": "johndoe",
    "phone": "081234567890",
    "bniAccountNumber": "1234567890",
    "bniBranchCode": "001",
    "isVerified": true,
    "defaultPaymentMethod": "instant",
    "profilePicture": "/uploads/profiles/user123_1234567890.jpg",
    "profilePictureName": "user123_1234567890.jpg",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "stats": {
    "totalBills": 5,
    "totalSpent": 150000,
    "pendingPayments": 2
  }
}
```

## Testing dengan Postman:

### 1. Upload Profile Picture:
- Method: POST
- URL: `http://localhost:3000/api/mobile/profile/upload-picture`
- Headers: 
  - Authorization: `Bearer YOUR_JWT_TOKEN`
- Body: 
  - Type: form-data
  - Key: `profilePicture`
  - Value: Select image file

### 2. Access Uploaded Image:
- URL: `http://localhost:3000/api/mobile/profile/picture/filename.jpg`
- Method: GET (no auth needed)
- Alternative: `http://localhost:3000/uploads/profiles/filename.jpg` (direct static access)

## Database Changes:

Field baru ditambahkan ke tabel `users`:
```sql
ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255);
ALTER TABLE users ADD COLUMN profile_picture_name VARCHAR(100);
```

## File Storage:
- Location: `public/uploads/profiles/`
- Naming: `{userId}_{timestamp}.{extension}`
- Max Size: 5MB
- Allowed Types: jpeg, jpg, png, gif

## Security Features:
- File type validation
- File size limit (5MB)
- Automatic old file cleanup
- Unique filename generation
- Path traversal protection