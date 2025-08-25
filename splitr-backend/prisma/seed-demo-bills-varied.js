const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDemoBills() {
  console.log('🌱 Seeding realistic demo bills...');

  try {
    // Clean up existing demo bills
    const demoCodes = ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'];
    
    await prisma.payment.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.notification.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.billInvite.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.itemAssignment.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.billParticipant.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.billItem.deleteMany({ where: { bill: { billCode: { in: demoCodes } } } });
    await prisma.bill.deleteMany({ where: { billCode: { in: demoCodes } } });
    
    console.log('🧹 Cleaned up existing demo bills');

    // Get users
    const andra = await prisma.user.findFirst({ where: { auth: { username: 'andra' } } });
    const aulia = await prisma.user.findFirst({ where: { auth: { username: 'aulia' } } });
    const ilham = await prisma.user.findFirst({ where: { auth: { username: 'ilham' } } });
    const ivan = await prisma.user.findFirst({ where: { auth: { username: 'ivan' } } });

    if (!andra || !aulia || !ilham || !ivan) {
      throw new Error('Required users (andra, aulia, ilham, ivan) not found');
    }

    // Get categories
    const foodCat = await prisma.billCategory.findFirst({ where: { categoryName: 'Food' } });
    const beverageCat = await prisma.billCategory.findFirst({ where: { categoryName: 'Beverage' } });
    const entertainmentCat = await prisma.billCategory.findFirst({ where: { categoryName: 'Entertainment' } });

    // DEMO01: ANDRA HOST - Pizza Night (Total: 285,000)
    const bill1 = await prisma.bill.create({
      data: {
        hostId: andra.userId,
        billName: "Pizza Night",
        billCode: "DEMO01",
        totalAmount: 285000,
        maxPaymentDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 5,
        discountPct: 0,
        subTotal: 250000,
        taxAmount: 25000,
        serviceAmount: 12500,
        discountAmount: 2500,
        categoryId: foodCat?.categoryId,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      }
    });

    // Create bill items for DEMO01
    const pizza1 = await prisma.billItem.create({
      data: {
        billId: bill1.billId,
        itemName: "Large Pepperoni Pizza",
        price: 120000,
        quantity: 1,
        category: "food_item",
        isSharing: true,
        isVerified: true
      }
    });

    const pizza2 = await prisma.billItem.create({
      data: {
        billId: bill1.billId,
        itemName: "Large Margherita Pizza",
        price: 110000,
        quantity: 1,
        category: "food_item",
        isSharing: true,
        isVerified: true
      }
    });

    const drinks = await prisma.billItem.create({
      data: {
        billId: bill1.billId,
        itemName: "Soft Drinks",
        price: 20000,
        quantity: 1,
        category: "beverage",
        isSharing: false,
        isVerified: true
      }
    });

    // ANDRA (HOST) - Auto-completed
    const andra1 = await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: andra.userId,
        amountShare: 95000,
        subtotal: 83333,
        taxAmount: 8333,
        serviceAmount: 4167,
        discountAmount: 833,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }
    });
    
    // AULIA - Completed payment
    const aulia1 = await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: aulia.userId,
        amountShare: 95000,
        subtotal: 83333,
        taxAmount: 8333,
        serviceAmount: 4167,
        discountAmount: 833,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }
    });
    
    // ILHAM - Scheduled payment
    const ilham1 = await prisma.billParticipant.create({
      data: {
        billId: bill1.billId,
        userId: ilham.userId,
        amountShare: 95000,
        subtotal: 83333,
        taxAmount: 8333,
        serviceAmount: 4167,
        discountAmount: 833,
        paymentStatus: "scheduled",
        paidAt: null,
      }
    });

    // DEMO02: AULIA HOST - Movie Night (Total: 320,000)
    const bill2 = await prisma.bill.create({
      data: {
        hostId: aulia.userId,
        billName: "Movie Night",
        billCode: "DEMO02",
        totalAmount: 320000,
        maxPaymentDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: false,
        status: "completed",
        splitMethod: "equal",
        currency: "IDR",
        taxPct: 0,
        servicePct: 0,
        discountPct: 0,
        subTotal: 320000,
        taxAmount: 0,
        serviceAmount: 0,
        discountAmount: 0,
        categoryId: entertainmentCat?.categoryId,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      }
    });

    // Create bill items for DEMO02
    const tickets = await prisma.billItem.create({
      data: {
        billId: bill2.billId,
        itemName: "Movie Tickets",
        price: 60000,
        quantity: 4,
        category: "entertainment",
        isSharing: false,
        isVerified: true
      }
    });

    const popcorn = await prisma.billItem.create({
      data: {
        billId: bill2.billId,
        itemName: "Large Popcorn",
        price: 80000,
        quantity: 1,
        category: "food_item",
        isSharing: true,
        isVerified: true
      }
    });

    // All participants completed
    const aulia2 = await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: aulia.userId,
        amountShare: 80000,
        subtotal: 80000,
        taxAmount: 0,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
      }
    });
    
    const andra2 = await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: andra.userId,
        amountShare: 80000,
        subtotal: 80000,
        taxAmount: 0,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
      }
    });
    
    const ilham2 = await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: ilham.userId,
        amountShare: 80000,
        subtotal: 80000,
        taxAmount: 0,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 16 * 60 * 60 * 1000),
      }
    });
    
    const ivan2 = await prisma.billParticipant.create({
      data: {
        billId: bill2.billId,
        userId: ivan.userId,
        amountShare: 80000,
        subtotal: 80000,
        taxAmount: 0,
        serviceAmount: 0,
        discountAmount: 0,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 14 * 60 * 60 * 1000),
      }
    });

    // DEMO03: ILHAM HOST - Coffee Meetup (Total: 180,000) - EXPIRED
    const bill3 = await prisma.bill.create({
      data: {
        hostId: ilham.userId,
        billName: "Coffee Meetup",
        billCode: "DEMO03",
        totalAmount: 180000,
        maxPaymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: false,
        status: "expired",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 0,
        discountPct: 5,
        subTotal: 170000,
        taxAmount: 17000,
        serviceAmount: 0,
        discountAmount: 8500,
        categoryId: beverageCat?.categoryId,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      }
    });

    // Create bill items for DEMO03
    const coffee = await prisma.billItem.create({
      data: {
        billId: bill3.billId,
        itemName: "Specialty Coffee",
        price: 45000,
        quantity: 3,
        category: "beverage",
        isSharing: false,
        isVerified: true
      }
    });

    const pastry = await prisma.billItem.create({
      data: {
        billId: bill3.billId,
        itemName: "Croissant",
        price: 25000,
        quantity: 1,
        category: "food_item",
        isSharing: true,
        isVerified: true
      }
    });

    // ILHAM (HOST) - Auto-completed
    const ilham3 = await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: ilham.userId,
        amountShare: 60000,
        subtotal: 56667,
        taxAmount: 5667,
        serviceAmount: 0,
        discountAmount: 2833,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      }
    });
    
    // ANDRA - Failed payment
    const andra3 = await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: andra.userId,
        amountShare: 60000,
        subtotal: 56667,
        taxAmount: 5667,
        serviceAmount: 0,
        discountAmount: 2833,
        paymentStatus: "failed",
        paidAt: null,
      }
    });
    
    // IVAN - Pending payment
    const ivan3 = await prisma.billParticipant.create({
      data: {
        billId: bill3.billId,
        userId: ivan.userId,
        amountShare: 60000,
        subtotal: 56667,
        taxAmount: 5667,
        serviceAmount: 0,
        discountAmount: 2833,
        paymentStatus: "pending",
        paidAt: null,
      }
    });

    // DEMO04: IVAN HOST - Lunch Split (Total: 240,000)
    const bill4 = await prisma.bill.create({
      data: {
        hostId: ivan.userId,
        billName: "Team Lunch",
        billCode: "DEMO04",
        totalAmount: 240000,
        maxPaymentDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        allowScheduledPayment: true,
        status: "active",
        splitMethod: "custom",
        currency: "IDR",
        taxPct: 10,
        servicePct: 5,
        discountPct: 0,
        subTotal: 210000,
        taxAmount: 21000,
        serviceAmount: 10500,
        discountAmount: 1500,
        categoryId: foodCat?.categoryId,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }
    });

    // Create bill items for DEMO04
    const mainDish = await prisma.billItem.create({
      data: {
        billId: bill4.billId,
        itemName: "Nasi Padang",
        price: 55000,
        quantity: 3,
        category: "food_item",
        isSharing: false,
        isVerified: true
      }
    });

    const dessert = await prisma.billItem.create({
      data: {
        billId: bill4.billId,
        itemName: "Es Campur",
        price: 45000,
        quantity: 1,
        category: "dessert",
        isSharing: true,
        isVerified: true
      }
    });

    // IVAN (HOST) - Auto-completed
    const ivan4 = await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: ivan.userId,
        amountShare: 80000,
        subtotal: 70000,
        taxAmount: 7000,
        serviceAmount: 3500,
        discountAmount: 500,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      }
    });
    
    // ANDRA - Completed scheduled payment
    const andra4 = await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: andra.userId,
        amountShare: 80000,
        subtotal: 70000,
        taxAmount: 7000,
        serviceAmount: 3500,
        discountAmount: 500,
        paymentStatus: "completed_scheduled",
        paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      }
    });
    
    // AULIA - Completed payment
    const aulia4 = await prisma.billParticipant.create({
      data: {
        billId: bill4.billId,
        userId: aulia.userId,
        amountShare: 80000,
        subtotal: 70000,
        taxAmount: 7000,
        serviceAmount: 3500,
        discountAmount: 500,
        paymentStatus: "completed",
        paidAt: new Date(Date.now() - 30 * 60 * 1000),
      }
    });

    // Create item assignments
    const assignments = [
      // DEMO01 assignments
      { billId: bill1.billId, itemId: pizza1.itemId, participantId: andra1.participantId, qty: 0.33, amount: 40000 },
      { billId: bill1.billId, itemId: pizza1.itemId, participantId: aulia1.participantId, qty: 0.33, amount: 40000 },
      { billId: bill1.billId, itemId: pizza1.itemId, participantId: ilham1.participantId, qty: 0.34, amount: 40000 },
      { billId: bill1.billId, itemId: pizza2.itemId, participantId: andra1.participantId, qty: 0.33, amount: 36667 },
      { billId: bill1.billId, itemId: pizza2.itemId, participantId: aulia1.participantId, qty: 0.33, amount: 36667 },
      { billId: bill1.billId, itemId: pizza2.itemId, participantId: ilham1.participantId, qty: 0.34, amount: 36666 },
      { billId: bill1.billId, itemId: drinks.itemId, participantId: andra1.participantId, qty: 0.33, amount: 6666 },
      { billId: bill1.billId, itemId: drinks.itemId, participantId: aulia1.participantId, qty: 0.33, amount: 6667 },
      { billId: bill1.billId, itemId: drinks.itemId, participantId: ilham1.participantId, qty: 0.34, amount: 6667 },
      
      // DEMO02 assignments
      { billId: bill2.billId, itemId: tickets.itemId, participantId: aulia2.participantId, qty: 1, amount: 60000 },
      { billId: bill2.billId, itemId: tickets.itemId, participantId: andra2.participantId, qty: 1, amount: 60000 },
      { billId: bill2.billId, itemId: tickets.itemId, participantId: ilham2.participantId, qty: 1, amount: 60000 },
      { billId: bill2.billId, itemId: tickets.itemId, participantId: ivan2.participantId, qty: 1, amount: 60000 },
      { billId: bill2.billId, itemId: popcorn.itemId, participantId: aulia2.participantId, qty: 0.25, amount: 20000 },
      { billId: bill2.billId, itemId: popcorn.itemId, participantId: andra2.participantId, qty: 0.25, amount: 20000 },
      { billId: bill2.billId, itemId: popcorn.itemId, participantId: ilham2.participantId, qty: 0.25, amount: 20000 },
      { billId: bill2.billId, itemId: popcorn.itemId, participantId: ivan2.participantId, qty: 0.25, amount: 20000 },
      
      // DEMO03 assignments
      { billId: bill3.billId, itemId: coffee.itemId, participantId: ilham3.participantId, qty: 1, amount: 45000 },
      { billId: bill3.billId, itemId: coffee.itemId, participantId: andra3.participantId, qty: 1, amount: 45000 },
      { billId: bill3.billId, itemId: coffee.itemId, participantId: ivan3.participantId, qty: 1, amount: 45000 },
      { billId: bill3.billId, itemId: pastry.itemId, participantId: ilham3.participantId, qty: 0.33, amount: 8333 },
      { billId: bill3.billId, itemId: pastry.itemId, participantId: andra3.participantId, qty: 0.33, amount: 8334 },
      { billId: bill3.billId, itemId: pastry.itemId, participantId: ivan3.participantId, qty: 0.34, amount: 8333 },
      
      // DEMO04 assignments
      { billId: bill4.billId, itemId: mainDish.itemId, participantId: ivan4.participantId, qty: 1, amount: 55000 },
      { billId: bill4.billId, itemId: mainDish.itemId, participantId: andra4.participantId, qty: 1, amount: 55000 },
      { billId: bill4.billId, itemId: mainDish.itemId, participantId: aulia4.participantId, qty: 1, amount: 55000 },
      { billId: bill4.billId, itemId: dessert.itemId, participantId: ivan4.participantId, qty: 0.33, amount: 15000 },
      { billId: bill4.billId, itemId: dessert.itemId, participantId: andra4.participantId, qty: 0.33, amount: 15000 },
      { billId: bill4.billId, itemId: dessert.itemId, participantId: aulia4.participantId, qty: 0.34, amount: 15000 },
    ];

    for (const assignment of assignments) {
      await prisma.itemAssignment.create({
        data: {
          billId: assignment.billId,
          itemId: assignment.itemId,
          participantId: assignment.participantId,
          quantityAssigned: assignment.qty,
          amountAssigned: assignment.amount
        }
      });
    }

    // Create bill invites
    const bills = [bill1, bill2, bill3, bill4];
    for (const bill of bills) {
      await prisma.billInvite.create({
        data: {
          billId: bill.billId,
          joinCode: bill.billCode,
          inviteLink: `https://splitr.app/j/${bill.billCode}`,
          qrCodeUrl: `https://splitr.app/q/${bill.billCode}`,
          createdBy: bill.hostId,
          maxUses: 10,
          currentUses: 3,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
    }

    // Create payment records for completed payments
    const completedPayments = [
      // DEMO01 - Only host and aulia completed, ilham is scheduled
      { billId: bill1.billId, userId: andra.userId, amount: 95000, method: "host_advance" },
      { billId: bill1.billId, userId: aulia.userId, amount: 95000, method: "bni_mobile" },
      
      // DEMO02 - All completed
      { billId: bill2.billId, userId: aulia.userId, amount: 80000, method: "host_advance" },
      { billId: bill2.billId, userId: andra.userId, amount: 80000, method: "bni_mobile" },
      { billId: bill2.billId, userId: ilham.userId, amount: 80000, method: "bni_mobile" },
      { billId: bill2.billId, userId: ivan.userId, amount: 80000, method: "bni_mobile" },
      
      // DEMO03 - Only host completed
      { billId: bill3.billId, userId: ilham.userId, amount: 60000, method: "host_advance" },
      
      // DEMO04 - Host, aulia, and andra completed (andra via scheduled)
      { billId: bill4.billId, userId: ivan.userId, amount: 80000, method: "host_advance" },
      { billId: bill4.billId, userId: aulia.userId, amount: 80000, method: "bni_mobile" },
      { billId: bill4.billId, userId: andra.userId, amount: 80000, method: "bni_mobile" },
    ];

    for (const payment of completedPayments) {
      // Determine if this is a scheduled payment that completed
      const isScheduledPayment = payment.billId === bill4.billId && payment.userId === andra.userId;
      
      await prisma.payment.create({
        data: {
          amount: payment.amount,
          paymentMethod: payment.method,
          paymentType: isScheduledPayment ? "scheduled" : "instant",
          status: isScheduledPayment ? "completed_scheduled" : "completed",
          transactionId: `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          bniReferenceNumber: `BNI_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          paidAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          bill: { connect: { billId: payment.billId } },
          user: { connect: { userId: payment.userId } }
        }
      });
    }

    // Create scheduled payment records (only pending ones)
    const scheduledPayments = [
      { billId: bill1.billId, userId: ilham.userId, amount: 95000, scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) },
    ];

    for (const payment of scheduledPayments) {
      await prisma.payment.create({
        data: {
          amount: payment.amount,
          paymentMethod: "bni_mobile",
          paymentType: "scheduled",
          status: "pending",
          scheduledDate: payment.scheduledDate,
          transactionId: `SCH_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          bill: { connect: { billId: payment.billId } },
          user: { connect: { userId: payment.userId } }
        }
      });
    }

    // Create notifications
    const notifications = [
      // DEMO01 notifications
      { userId: aulia.userId, billId: bill1.billId, type: 'bill_assignment', title: 'Bill Assignment', message: `${andra.name} assigned you items in 'Pizza Night' - Total: Rp 95,000` },
      { userId: ilham.userId, billId: bill1.billId, type: 'payment_scheduled', title: 'Payment Scheduled', message: `Your payment for 'Pizza Night' has been scheduled - Rp 95,000` },
      { userId: aulia.userId, billId: bill1.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Pizza Night' has been completed - Rp 95,000` },
      
      // DEMO02 notifications
      { userId: andra.userId, billId: bill2.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Movie Night' has been completed - Rp 80,000` },
      { userId: ilham.userId, billId: bill2.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Movie Night' has been completed - Rp 80,000` },
      { userId: ivan.userId, billId: bill2.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Movie Night' has been completed - Rp 80,000` },
      { userId: aulia.userId, billId: bill2.billId, type: 'bill_completed', title: 'Bill Completed', message: `All payments for 'Movie Night' have been completed!` },
      
      // DEMO03 notifications
      { userId: andra.userId, billId: bill3.billId, type: 'payment_failed', title: 'Payment Failed', message: `Your payment for 'Coffee Meetup' has failed - Rp 60,000` },
      { userId: ivan.userId, billId: bill3.billId, type: 'bill_expired', title: 'Bill Expired', message: `'Coffee Meetup' has expired with pending payment - Rp 60,000` },
      
      // DEMO04 notifications
      { userId: andra.userId, billId: bill4.billId, type: 'payment_scheduled', title: 'Payment Scheduled', message: `Your payment for 'Team Lunch' has been scheduled - Rp 80,000` },
      { userId: aulia.userId, billId: bill4.billId, type: 'payment_completed', title: 'Payment Completed', message: `Your payment for 'Team Lunch' has been completed - Rp 80,000` },
    ];

    for (const notif of notifications) {
      await prisma.notification.create({
        data: {
          userId: notif.userId,
          billId: notif.billId,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          isRead: Math.random() > 0.5,
          createdAt: new Date(Date.now() - Math.random() * 3 * 60 * 60 * 1000)
        }
      });
    }

    console.log('✅ Demo bills created successfully!');
    console.log('📋 DEMO01: Pizza Night (ANDRA host) - Active, ILHAM scheduled');
    console.log('📋 DEMO02: Movie Night (AULIA host) - Completed, all paid');
    console.log('📋 DEMO03: Coffee Meetup (ILHAM host) - Expired, failed payments');
    console.log('📋 DEMO04: Team Lunch (IVAN host) - Active, ANDRA scheduled');
    console.log('💰 Total transaction value: Rp 1,025,000 (under 500k per user)');
    console.log('🔔 Created realistic bills with items, payments, and notifications');
    
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