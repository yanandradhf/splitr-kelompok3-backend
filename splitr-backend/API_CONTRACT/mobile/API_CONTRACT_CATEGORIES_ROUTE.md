# API Contract: Get All Categories (🗂️)

## Endpoint
```
GET /api/mobile/categories
```

## Description
- Retrieves all active bill categories available in the system. 
- Mengambil semua kategori tagihan aktif yang tersedia dalam sistem.

## Authentication
- **Required**: No
- **Type**: None

## Request

### Headers
None

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
  "categories": [
    {
      "categoryId": "string",
      "categoryName": "string",
      "categoryIcon": "string",
      "createdAt": "ISO 8601 datetime"
    }
  ]
}
```

### Response Schema
--Categories Array--
| Field      | Type  | Description                    |
|------------|-------|--------------------------------|
| categories | array | List of active bill categories |

--Category Object--
| Field        | Type   | Description                                |
|--------------|--------|--------------------------------------------|  
| categoryId   | string | Unique identifier for the category         |
| categoryName | string | Name of the category                       |
| categoryIcon | string | Icon identifier or URL for the category    |
| createdAt    | string | ISO 8601 datetime when category was created |

### Error Responses

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
curl -X GET "../api/mobile/categories"
```

### Response
```json
{
  "categories": [
    {
      "categoryId": "cat_001",
      "categoryName": "Food",
      "categoryIcon": "🍽️",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "categoryId": "cat_002",
      "categoryName": "Beverage",
      "categoryIcon": "🥤",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "categoryId": "cat_003",
      "categoryName": "Entertainment",
      "categoryIcon": "🎬",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "categoryId": "cat_004",
      "categoryName": "Transport",
      "categoryIcon": "🚗",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "categoryId": "cat_005",
      "categoryName": "Other",
      "categoryIcon": "📦",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Business Logic
- Returns only active categories (isActive: true)
- Categories are ordered alphabetically by name
- No authentication required (public endpoint)
- Used for bill creation and categorization
- Categories include visual icons for UI display
- System maintains predefined categories for consistency

## Error Handling
- Database connection validation
- Prisma error handling with custom error names
- Timeout and connection error handling
- No authentication errors (public endpoint)