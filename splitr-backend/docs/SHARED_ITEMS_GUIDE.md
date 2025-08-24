# 🍽️ Shared Items API Guide

## Overview
When `isSharing: true`, items are split among multiple participants. The API now properly handles shared items by returning proportional amounts for each participant.

## Key Changes Made

### 1. **Notification Detail API** (`/from-notification/:identifier`)
```json
{
  "myItems": [
    {
      "itemName": "Lontong",
      "price": 235000,
      "quantity": 0.33,           // Your share (1/3 of total)
      "amount": 78333,            // Your proportional amount
      "category": "food_item",
      "isSharing": true,
      "displayQuantity": 0.33,    // Same as quantity for shared items
      "displayAmount": 78333      // Your actual share amount
    }
  ]
}
```

### 2. **Assigned Bills API** (`/assigned`)
```json
{
  "assignedBills": [
    {
      "myItems": [
        {
          "itemName": "Lontong",
          "price": 235000,
          "quantity": 0.33,           // Your proportional share
          "amount": 78333,            // Your share amount
          "category": "food_item",
          "isSharing": true,
          "displayQuantity": 0.33,    // Your share quantity
          "displayAmount": 78333      // Your share amount
        }
      ]
    }
  ]
}
```

### 3. **Master Bill Detail API** (`/:billId`)
```json
{
  "items": [
    {
      "itemId": "1493fe29-3615-4bb3-b894-37b156ec766d",
      "itemName": "Lontong",
      "price": 235000,
      "quantity": 1,              // Original total quantity
      "isSharing": true,          // Indicates this is a shared item
      "assignments": [
        {
          "participantName": "Andra Dhafa",
          "quantity": 0.33,        // Participant's share (1/3)
          "amount": 78333,         // Participant's amount
          "isSharedPortion": true  // Indicates this is a shared portion
        },
        {
          "participantName": "Aulia Rahman",
          "quantity": 0.33,
          "amount": 78333,
          "isSharedPortion": true
        },
        {
          "participantName": "Ilham Kawil",
          "quantity": 0.34,        // Slightly more to handle rounding
          "amount": 78334,
          "isSharedPortion": true
        }
      ]
    }
  ]
}
```

## Frontend Integration

### Understanding Shared vs Non-Shared Items

```javascript
// Frontend handling example
const processItems = (items) => {
  return items.map(item => {
    if (item.isSharing) {
      return {
        ...item,
        displayText: `${item.itemName} (shared portion)`,
        portionInfo: `Your share: ${item.quantity} of ${item.totalQuantity || 1}`,
        amountInfo: `Rp ${item.amount.toLocaleString()} of Rp ${item.price.toLocaleString()}`
      };
    } else {
      return {
        ...item,
        displayText: item.itemName,
        portionInfo: `Quantity: ${item.quantity}`,
        amountInfo: `Rp ${item.amount.toLocaleString()}`
      };
    }
  });
};
```

### Display Examples

#### For Shared Items:
```
🍽️ Lontong (shared portion)
   Your share: 0.33 of 1
   Rp 78,333 of Rp 235,000
```

#### For Individual Items:
```
🥤 Es Teh Manis
   Quantity: 3
   Rp 18,000
```

## Database Storage

### How Shared Items Are Stored:
1. **BillItem**: Stores original item with `isSharing: true`
2. **ItemAssignment**: Stores each participant's proportional share
3. **BillParticipant**: Stores participant's total amount including their share of shared items

### Example Database Records:

```sql
-- BillItem (original item)
INSERT INTO bill_items (item_name, price, quantity, is_sharing) 
VALUES ('Lontong', 235000, 1, true);

-- ItemAssignments (participant shares)
INSERT INTO item_assignments (item_id, participant_id, quantity_assigned, amount_assigned)
VALUES 
  ('item-1', 'participant-1', 0.33, 78333),  -- Andra's share
  ('item-1', 'participant-2', 0.33, 78333),  -- Aulia's share  
  ('item-1', 'participant-3', 0.34, 78334);  -- Ilham's share (handles rounding)
```

## API Response Consistency

All bill-related endpoints now include:
- `isSharing`: Boolean flag indicating if item is shared
- `displayQuantity`: Participant's actual share quantity
- `displayAmount`: Participant's actual share amount
- `isSharedPortion`: Flag in assignments indicating shared portion

## Frontend Recommendations

1. **Check `isSharing` flag** before displaying item information
2. **Use `displayQuantity` and `displayAmount`** for user-facing displays
3. **Show "shared portion" indicator** for shared items
4. **Calculate totals** using the provided amounts (already proportional)

## Migration Impact

This change affects:
- ✅ `/api/mobile/bills/from-notification/:identifier`
- ✅ `/api/mobile/bills/assigned`
- ✅ `/api/mobile/bills/:billId`
- ✅ `/api/mobile/bills/:billId/assignments`

All endpoints now consistently handle shared items with proper proportional calculations.