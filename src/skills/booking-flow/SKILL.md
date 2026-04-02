---
name: booking-flow
description: Step-by-step guide for booking, tracking, and cancelling rides. Covers price comparison, surge pricing, error handling, and address validation.
version: 1.0.0
tags:
  - rides
  - booking
  - uber
---

# Ride Booking Flow

You are guiding a user through booking a ride. Follow these steps precisely.

## Step 1: Get Destination

Ask the user where they want to go. If they mention a saved address (e.g., "take me home"), check working memory for saved addresses.

Ask for pickup location if not provided — default to "current location" if the user doesn't specify.

## Step 2: Resolve Addresses

Use the `geocode-address` tool to resolve BOTH pickup and dropoff addresses to coordinates.

- If geocoding fails, tell the user the address wasn't recognized and ask them to try a well-known landmark or more specific address.
- Do NOT proceed to estimates without valid coordinates.

## Step 3: Get Estimates

Use the `get-estimates` tool with the resolved coordinates.

Present results in a clear format:

```
Available rides from [pickup] to [dropoff]:

| Option     | Price  | ETA     | Surge |
|------------|--------|---------|-------|
| UberX      | $12.50 | 3 min   | 1.0x  |
| UberXL     | $18.75 | 5 min   | 1.0x  |
| Uber Black | $31.25 | 8 min   | 1.0x  |
```

If surge pricing is active (multiplier > 1.0), warn the user:
"Surge pricing is active (1.5x). Prices are higher than usual. Would you still like to proceed?"

If no cars are available, suggest waiting a few minutes and trying again.

## Step 4: Confirm and Book

NEVER book without explicit user confirmation. Ask:
"Would you like to book [product name] for [price]? (The system will ask you to approve this)"

Use the `book-ride` tool with the selected productId, fareId, and coordinates.

After booking, tell the user their trip ID and estimated pickup time.

## Step 5: Track

If the user asks about their ride status, use the `track-ride` tool.

Report: status, driver name and rating, vehicle details, ETA.

## Step 6: Cancel

If the user wants to cancel:
1. First use `track-ride` to check current status
2. Warn about fees:
   - PROCESSING: free cancellation
   - ACCEPTED: free cancellation
   - ARRIVING: $2.50 fee
   - IN_PROGRESS: $5.00 fee
3. Use the `cancel-ride` tool only after the user confirms

## Error Handling

- **Bad address**: Ask user to rephrase with a landmark or full street address
- **No cars available**: Suggest trying again in a few minutes or trying a different ride type
- **Surge pricing**: Always inform the user before proceeding
- **Trip not found**: Ask user to verify the trip ID
