const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDemoBills() {
  console.log('🌱 Seeding varied demo bills...');

  try {
    // Clean up existing demo bills first
    await prisma.payment.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.notification.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.billInvite.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.itemAssignment.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.billParticipant.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.billItem.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
        }
      }
    });
    
    await prisma.bill.deleteMany({
      where: {
        billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04', 'DEMO05', 'DEMO06'] }
      }
    });
    
    console.log('🧹 Cleaned up existing demo bills');

    // Get users
    const andi = await prisma.user.findFirst({ where: { auth: { username: 'andi' } } });
    const andra = await prisma.user.findFirst({ where: { auth: { username: 'andra' } } });
    const aulia = await prisma.user.findFirst({ where: { auth: { username: 'aulia' } } });

    if (!andi || !andra || !aulia) {
      throw new Error('Required users (andi, andra, aulia) not found');
    }

    // DEMO01: ANDI HOST - Pizza Party (Subtotal: 360000, Tax 10%: 36000, Total: 396000)
    const bill1 = await prisma.bill.create({
      data: {
        hostId: andi.userId,
        billName: "Pizza Party",
        billCode: "DEMO01",
        totalAmount: 396000,
        maxPaymentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 0,
        discountPct: 0,
        subTotal: 360000,
        taxAmount: 36000,
        serviceAmount: 0,
        discountAmount: 0,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }
    });

    // ANDI (HOST) - 1 Large Pizza + 2 Coke = 120000 + tax = 132000
    await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: andi.userId,
        amountShare: 132000,
        subtotal: 120000,
        taxAmount: 12000,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }
    });
    
    // ANDRA - 1 Large Pizza + 4 Coke = 180000 + tax = 198000
    await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: andra.userId,
        amountShare: 198000,
        subtotal: 180000,
        taxAmount: 18000,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "pending",
        paidAt: null,
      }
    });
    
    // AULIA - 2 Coke = 60000 + tax = 66000
    await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: aulia.userId,
        amountShare: 66000,
        subtotal: 60000,
        taxAmount: 6000,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 30 * 60 * 1000),
      }
    });

    // DEMO02: ANDRA HOST - Completed bill with shared items
    const bill2 = await prisma.bill.create({
      data: {
        hostId: andra.userId,
        billName: "Sushi Dinner",
        billCode: "DEMO02",
        totalAmount: 720000,
        maxPaymentDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
        allowScheduledPayment: false,
        status: "completed",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 0,
        servicePct: 10,
        discountPct: 0,
        subTotal: 654545,
        taxAmount: 0,
        serviceAmount: 65455,
        discountAmount: 0,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      }
    });

    // ANDRA (HOST) - completed payment
    await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: andra.userId,
        amountShare: 280000,
        subtotal: 254545,
        taxAmount: 0,
        serviceAmount: 25455,
        discountAmount: 0,
        paymentStatus: "completed", // HOST AUTO-COMPLETED
        paidAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      }
    });
    
    // ANDI - completed payment
    await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: andi.userId,
        amountShare: 240000,
        subtotal: 218182,
        taxAmount: 0,
        serviceAmount: 21818,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
      }
    });
    
    // AULIA - completed payment
    await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: aulia.userId,
        amountShare: 200000,
        subtotal: 181818,
        taxAmount: 0,
        serviceAmount: 18182,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 16 * 60 * 60 * 1000),
      }
    });

    // DEMO03: AULIA HOST - Expired bill with failed payments
    const bill3 = await prisma.bill.create({
      data: {
        hostId: aulia.userId,
        billName: "Coffee Meeting",
        billCode: "DEMO03",
        totalAmount: 180000,
        maxPaymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (EXPIRED)
        allowScheduledPayment: false,
        status: "expired",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 5,
        discountPct: 0,
        subTotal: 157895,
        taxAmount: 15789,
        serviceAmount: 7895,
        discountAmount: 1579,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      }
    });

    // AULIA (HOST) - completed payment
    await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: aulia.userId,
        amountShare: 70000,
        subtotal: 61404,
        taxAmount: 6140,
        serviceAmount: 3070,
        discountAmount: 614,
        paymentStatus: "completed", // HOST AUTO-COMPLETED
        paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }
    });
    
    // ANDI - failed payment
    await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: andi.userId,
        amountShare: 60000,
        subtotal: 52632,
        taxAmount: 5263,
        serviceAmount: 2632,
        discountAmount: 527,
        paymentStatus: "failed",
        paidAt: null,
      }
    });
    
    // ANDRA - pending payment
    await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: andra.userId,
        amountShare: 50000,
        subtotal: 43859,
        taxAmount: 4386,
        serviceAmount: 2193,
        discountAmount: 438,
        paymentStatus: "pending",
        paidAt: null,
      }
    });

    // DEMO04: Lunch at Mall (Subtotal: 285000, Tax 10%: 28500, Discount 5%: 14250, Total: 299250)
    const bill4 = await prisma.bill.create({
      data: {
        hostId: aulia.userId,
        billName: "Lunch at Mall",
        billCode: "DEMO04",
        totalAmount: 299250,
        maxPaymentDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 0,
        discountPct: 5,
        subTotal: 285000,
        taxAmount: 28500,
        serviceAmount: 0,
        discountAmount: 14250,
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      }
    });

    // AULIA (HOST) - 1 Nasi Gudeg + 1 Ayam Bakar = 110000 + tax - discount = 115500
    await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: aulia.userId,
        amountShare: 115500,
        subtotal: 110000,
        taxAmount: 11000,
        serviceAmount: 0,
        discountAmount: 5500,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }
    });
    
    // ANDI - 1 Nasi Gudeg + 1 Ayam Bakar = 110000 + tax - discount = 115500
    await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: andi.userId,
        amountShare: 115500,
        subtotal: 110000,
        taxAmount: 11000,
        serviceAmount: 0,
        discountAmount: 5500,
        paymentStatus: "pending",
        paidAt: null,
      }
    });
    
    // ANDRA - 1 Ayam Bakar = 65000 + tax - discount = 68250
    await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: andra.userId,
        amountShare: 68250,
        subtotal: 65000,
        taxAmount: 6500,
        serviceAmount: 0,
        discountAmount: 3250,
        paymentStatus: "scheduled",
        paidAt: null,
      }
    });

    // Create items with correct pricing
    const billItems = [
      { billId: bill1.billId, items: [{ name: 'Large Pizza', price: 90000, qty: 2 }, { name: 'Coca Cola', price: 15000, qty: 8 }] },
      { billId: bill2.billId, items: [{ name: 'Salmon Sashimi', price: 280000, qty: 1, isSharing: true }, { name: 'Chicken Teriyaki', price: 60000, qty: 2 }] },
      { billId: bill3.billId, items: [{ name: 'Cappuccino', price: 35000, qty: 3 }, { name: 'Croissant', price: 25000, qty: 2 }] },
      { billId: bill4.billId, items: [{ name: 'Nasi Gudeg', price: 45000, qty: 2 }, { name: 'Ayam Bakar', price: 65000, qty: 3 }] }
    ];

    // Create items and assignments for all bills
    const createdItems = {};
    for (const billData of billItems) {
      createdItems[billData.billId] = [];
      for (const itemData of billData.items) {
        const item = await prisma.billItem.create({
          data: {
            billId: billData.billId,
            itemName: itemData.name,
            price: itemData.price,
            quantity: itemData.qty,
            category: 'food_item',
            isSharing: itemData.isSharing || false,
            isVerified: true
          }
        });
        createdItems[billData.billId].push(item);
      }
    }

    // Create item assignments with correct amounts
    const assignments = [
      // DEMO01 assignments (Pizza Party) - Total subtotal: 360000
      { billId: bill1.billId, userId: andi.userId, itemIndex: 0, qty: 1, amount: 90000 }, // Large Pizza
      { billId: bill1.billId, userId: andi.userId, itemIndex: 1, qty: 2, amount: 30000 }, // Coca Cola
      { billId: bill1.billId, userId: andra.userId, itemIndex: 0, qty: 1, amount: 90000 }, // Large Pizza
      { billId: bill1.billId, userId: andra.userId, itemIndex: 1, qty: 4, amount: 60000 }, // Coca Cola
      { billId: bill1.billId, userId: aulia.userId, itemIndex: 1, qty: 2, amount: 30000 }, // Coca Cola
      
      // DEMO02 assignments (Sushi Dinner)
      { billId: bill2.billId, userId: andra.userId, itemIndex: 0, qty: 0.4, amount: 112000 }, // Salmon Sashimi (shared)
      { billId: bill2.billId, userId: andi.userId, itemIndex: 0, qty: 0.35, amount: 98000 }, // Salmon Sashimi (shared)
      { billId: bill2.billId, userId: aulia.userId, itemIndex: 0, qty: 0.25, amount: 70000 }, // Salmon Sashimi (shared)
      { billId: bill2.billId, userId: andra.userId, itemIndex: 1, qty: 1, amount: 60000 }, // Chicken Teriyaki
      { billId: bill2.billId, userId: andi.userId, itemIndex: 1, qty: 1, amount: 60000 }, // Chicken Teriyaki
      
      // DEMO03 assignments (Coffee Meeting)
      { billId: bill3.billId, userId: aulia.userId, itemIndex: 0, qty: 1, amount: 35000 }, // Cappuccino
      { billId: bill3.billId, userId: andi.userId, itemIndex: 0, qty: 1, amount: 35000 }, // Cappuccino
      { billId: bill3.billId, userId: andra.userId, itemIndex: 0, qty: 1, amount: 35000 }, // Cappuccino
      { billId: bill3.billId, userId: aulia.userId, itemIndex: 1, qty: 1, amount: 25000 }, // Croissant
      { billId: bill3.billId, userId: andi.userId, itemIndex: 1, qty: 1, amount: 25000 }, // Croissant
      
      // DEMO04 assignments (Lunch at Mall)
      { billId: bill4.billId, userId: aulia.userId, itemIndex: 0, qty: 1, amount: 45000 }, // Nasi Gudeg
      { billId: bill4.billId, userId: andi.userId, itemIndex: 0, qty: 1, amount: 45000 }, // Nasi Gudeg
      { billId: bill4.billId, userId: aulia.userId, itemIndex: 1, qty: 1, amount: 65000 }, // Ayam Bakar
      { billId: bill4.billId, userId: andi.userId, itemIndex: 1, qty: 1, amount: 65000 }, // Ayam Bakar
      { billId: bill4.billId, userId: andra.userId, itemIndex: 1, qty: 1, amount: 65000 }, // Ayam Bakar
    ];

    // Get participants for assignments
    const participants = await prisma.billParticipant.findMany({
      where: {
        billId: { in: [bill1.billId, bill2.billId, bill3.billId, bill4.billId] }
      }
    });

    // Create item assignments
    for (const assignment of assignments) {
      const participant = participants.find(p => p.billId === assignment.billId && p.userId === assignment.userId);
      const item = createdItems[assignment.billId][assignment.itemIndex];
      
      if (participant && item) {
        await prisma.itemAssignment.create({
          data: {
            billId: assignment.billId,
            itemId: item.itemId,
            participantId: participant.participantId,
            quantityAssigned: assignment.qty,
            amountAssigned: assignment.amount
          }
        });
      }
    }

    // Create bill invites
    const bills = [bill1, bill2, bill3, bill4];
    const hosts = [andi, andra, aulia, aulia];
    
    for (let i = 0; i < bills.length; i++) {
      await prisma.billInvite.create({
        data: {
          billId: bills[i].billId,
          joinCode: bills[i].billCode,
          inviteLink: `https://splitr.app/j/${bills[i].billCode}`,
          qrCodeUrl: `https://splitr.app/q/${bills[i].billCode}`,
          createdBy: hosts[i].userId,
          maxUses: 10,
          currentUses: 2,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // Create host payment records with correct amounts
    const hostPayments = [
      { billId: bill1.billId, userId: andi.userId, amount: 132000 },
      { billId: bill2.billId, userId: andra.userId, amount: 280000 },
      { billId: bill3.billId, userId: aulia.userId, amount: 70000 },
      { billId: bill4.billId, userId: aulia.userId, amount: 115500 }
    ];

    for (const payment of hostPayments) {
      await prisma.payment.create({
        data: {
          amount: payment.amount,
          paymentMethod: "host_advance",
          paymentType: "instant",
          status: "completed",
          transactionId: `HOST_${Date.now()}_${payment.userId.slice(-4)}`,
          bniReferenceNumber: `HOST_${payment.billId.slice(-4)}`,
          paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          bill: { connect: { billId: payment.billId } },
          user: { connect: { userId: payment.userId } }
        }
      });
    }

    // Create participant payment records (only for completed ones)
    const participantPayments = [
      { billId: bill1.billId, userId: aulia.userId, amount: 66000 },
      { billId: bill2.billId, userId: andi.userId, amount: 240000 },
      { billId: bill2.billId, userId: aulia.userId, amount: 200000 }
    ];

    for (const payment of participantPayments) {
      await prisma.payment.create({
        data: {
          amount: payment.amount,
          paymentMethod: "bni_mobile",
          paymentType: "instant",
          status: "completed",
          transactionId: `TXN_${Date.now()}_${payment.userId.slice(-4)}`,
          bniReferenceNumber: `BNI_${Date.now()}_${payment.userId.slice(-4)}`,
          paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          bill: { connect: { billId: payment.billId } },
          user: { connect: { userId: payment.userId } }
        }
      });
    }

    // Create notifications for participants
    const notifications = [
      // DEMO01 notifications
      { userId: andra.userId, billId: bill1.billId, type: 'bill_assignment', title: 'Bill Assignment', message: `${andi.name} assigned you items in 'Pizza Party' - Total: Rp 198,000` },
      { userId: aulia.userId, billId: bill1.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Pizza Party' has been completed - Rp 66,000` },
      
      // DEMO02 notifications
      { userId: andi.userId, billId: bill2.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Sushi Dinner' has been completed - Rp 240,000` },
      { userId: aulia.userId, billId: bill2.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Sushi Dinner' has been completed - Rp 200,000` },
      
      // DEMO03 notifications
      { userId: andi.userId, billId: bill3.billId, type: 'payment_failed', title: 'Payment Failed', message: `Your payment for 'Coffee Meeting' has failed - Rp 60,000` },
      { userId: andra.userId, billId: bill3.billId, type: 'bill_assignment', title: 'Bill Assignment', message: `${aulia.name} assigned you items in 'Coffee Meeting' - Total: Rp 50,000` },
      
      // DEMO04 notifications
      { userId: andi.userId, billId: bill4.billId, type: 'bill_assignment', title: 'Bill Assignment', message: `${aulia.name} assigned you items in 'Lunch at Mall' - Total: Rp 110,000` },
      { userId: andra.userId, billId: bill4.billId, type: 'payment_scheduled', title: 'Payment Scheduled', message: `Your payment for 'Lunch at Mall' has been scheduled - Rp 90,000` }
    ];

    for (const notif of notifications) {
      await prisma.notification.create({
        data: {
          userId: notif.userId,
          billId: notif.billId,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: false,
          createdAt: new Date(Date.now() - Math.random() * 2 * 60 * 60 * 1000) // Random time within last 2 hours
        }
      });
    }

    console.log('✅ Demo bills created successfully!');
    console.log('📋 DEMO01: Pizza Party (ANDI host) - Active, mixed payments');
    console.log('📋 DEMO02: Sushi Dinner (ANDRA host) - Completed, all paid');
    console.log('📋 DEMO03: Coffee Meeting (AULIA host) - Expired, failed payments');
    console.log('📋 DEMO04: Lunch at Mall (AULIA host) - Active, ANDI pending');
    console.log('🔔 Created bills with items, payments, and notifications');
    console.log('');
    console.log('🧪 Test API: GET /api/mobile/bills/my-activity?limit=10');
    console.log('- ANDI: 1 hosted bill, 3 participant bills');
    console.log('- ANDRA: 1 hosted bill, 3 participant bills');
    console.log('- AULIA: 2 hosted bills, 2 participant bills');
    
  } catch (error) {
    console.error('❌ Error seeding demo bills:', error);
    throw error;
  }
}

async function main() {
  await seedDemoBills();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });