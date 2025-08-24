const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDemoBills() {
  console.log('🌱 Seeding demo bills for Andra, Aulia, Ilham...');

  try {
    // Clean up existing demo bills first
    await prisma.payment.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.notification.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.billInvite.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.itemAssignment.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.billParticipant.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.billItem.deleteMany({
      where: {
        bill: {
          billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
        }
      }
    });
    
    await prisma.bill.deleteMany({
      where: {
        billCode: { in: ['DEMO01', 'DEMO02', 'DEMO03', 'DEMO04'] }
      }
    });
    
    console.log('🧹 Cleaned up existing demo bills');
    // Get all users first to see what's available
    const allUsers = await prisma.user.findMany({
      include: { auth: true }
    });
    
    console.log('Available users:', allUsers.map(u => ({ name: u.name, username: u.auth?.username })));
    
    // Get users by username
    const aulia = allUsers.find(u => u.auth?.username === 'aulia');
    const ilham = allUsers.find(u => u.auth?.username === 'ilham');
    const andra = allUsers.find(u => u.auth?.username === 'andra');

    if (!aulia || !ilham || !andra) {
      console.log('Missing users:', { aulia: !!aulia, ilham: !!ilham, andra: !!andra });
      throw new Error('Required users not found. Make sure users with usernames aulia, ilham, and andra exist.');
    }
    
    console.log('Found users:', {
      aulia: aulia.name,
      ilham: ilham.name, 
      andra: andra.name
    });

    // Get food category
    const foodCategory = await prisma.billCategory.findFirst({
      where: { categoryName: 'Food' }
    });

    const bills = [
      // Bill 1: Aulia host, Andra & Ilham participants
      {
        hostId: aulia.userId,
        billName: 'Makan Siang Warteg',
        billCode: `DEMO01`,
        totalAmount: 85000,
        items: [
          { name: 'Ayam Goreng', price: 15000, qty: 2 },
          { name: 'Nasi Putih', price: 5000, qty: 3 },
          { name: 'Es Teh', price: 3000, qty: 3 },
          { name: 'Sayur Asem', price: 8000, qty: 2 }
        ],
        participants: [
          { user: andra, share: 28000 },
          { user: ilham, share: 31000 }
        ]
      },
      // Bill 2: Ilham host, Aulia & Andra participants  
      {
        hostId: ilham.userId,
        billName: 'Nongkrong Cafe',
        billCode: 'DEMO02',
        totalAmount: 120000,
        items: [
          { name: 'Kopi Americano', price: 25000, qty: 2 },
          { name: 'Cappuccino', price: 28000, qty: 1 },
          { name: 'Sandwich', price: 35000, qty: 1 },
          { name: 'French Fries', price: 18000, qty: 2 }
        ],
        participants: [
          { user: aulia, share: 43000 },
          { user: andra, share: 35000 }
        ]
      },
      // Bill 3: Andra host, Aulia & Ilham participants
      {
        hostId: andra.userId,
        billName: 'Makan Malam Padang',
        billCode: 'DEMO03',
        totalAmount: 95000,
        items: [
          { name: 'Rendang', price: 25000, qty: 2 },
          { name: 'Gulai Ayam', price: 20000, qty: 1 },
          { name: 'Nasi Padang', price: 8000, qty: 3 },
          { name: 'Es Jeruk', price: 5000, qty: 3 }
        ],
        participants: [
          { user: aulia, share: 38000 },
          { user: ilham, share: 32000 }
        ]
      },
      // Bill 4: Aulia host again, all three participate
      {
        hostId: aulia.userId,
        billName: 'Beli Snack Kantor',
        billCode: 'DEMO04',
        totalAmount: 65000,
        items: [
          { name: 'Keripik', price: 12000, qty: 3 },
          { name: 'Coklat', price: 8000, qty: 2 },
          { name: 'Minuman Kaleng', price: 6000, qty: 3 },
          { name: 'Biskuit', price: 5000, qty: 2 }
        ],
        participants: [
          { user: andra, share: 22000 },
          { user: ilham, share: 21000 }
        ]
      }
    ];

    for (let i = 0; i < bills.length; i++) {
      const billData = bills[i];
      
      console.log(`Creating bill ${i + 1}: ${billData.billName}`);
      
      // Create bill
      const bill = await prisma.bill.create({
        data: {
          hostId: billData.hostId,
          categoryId: foodCategory?.categoryId,
          billName: billData.billName,
          billCode: billData.billCode,
          totalAmount: billData.totalAmount,
          maxPaymentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          allowScheduledPayment: true,
          status: 'active',
          splitMethod: 'custom',
          currency: 'IDR',
          subTotal: billData.totalAmount * 0.9,
          taxPct: 10,
          taxAmount: billData.totalAmount * 0.1,
          servicePct: 0,
          serviceAmount: 0,
          discountPct: 0,
          discountAmount: 0
        }
      });

      // Create items
      const createdItems = [];
      for (const item of billData.items) {
        const billItem = await prisma.billItem.create({
          data: {
            billId: bill.billId,
            itemName: item.name,
            price: item.price,
            quantity: item.qty,
            category: 'food_item',
            isSharing: false,
            isVerified: true
          }
        });
        createdItems.push(billItem);
      }

      // Create participants and assignments
      for (const participant of billData.participants) {
        const billParticipant = await prisma.billParticipant.create({
          data: {
            billId: bill.billId,
            userId: participant.user.userId,
            amountShare: participant.share,
            paymentStatus: Math.random() > 0.5 ? 'completed' : 'pending'
          }
        });

        // Create some item assignments (distribute items randomly)
        const itemsToAssign = createdItems.slice(0, 2); // Assign first 2 items
        for (const item of itemsToAssign) {
          await prisma.itemAssignment.create({
            data: {
              billId: bill.billId,
              itemId: item.itemId,
              participantId: billParticipant.participantId,
              quantityAssigned: 1,
              amountAssigned: item.price
            }
          });
        }
      }

      // Create bill invite
      await prisma.billInvite.create({
        data: {
          billId: bill.billId,
          joinCode: billData.billCode,
          inviteLink: `https://splitr.app/j/${billData.billCode}`,
          qrCodeUrl: `https://splitr.app/q/${billData.billCode}`,
          createdBy: billData.hostId,
          maxUses: 10,
          currentUses: billData.participants.length,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });

      // Create some notifications
      for (const participant of billData.participants) {
        await prisma.notification.create({
          data: {
            userId: participant.user.userId,
            billId: bill.billId,
            type: 'bill_assignment',
            title: 'Bill Assignment',
            message: `You have been assigned items in '${billData.billName}' - Total: Rp ${participant.share.toLocaleString()}`,
            metadata: {
              billName: billData.billName,
              billCode: billData.billCode,
              identifier: billData.billCode,
              amount: participant.share,
              action: 'view_bill'
            }
          }
        });
      }

      // Create some payments for completed participants
      const completedParticipants = await prisma.billParticipant.findMany({
        where: { 
          billId: bill.billId,
          paymentStatus: 'completed'
        }
      });

      for (const participant of completedParticipants) {
        await prisma.payment.create({
          data: {
            amount: participant.amountShare,
            paymentMethod: 'BNI_TRANSFER',
            paymentType: 'instant',
            status: 'completed',
            transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 4)}`,
            bniReferenceNumber: `BNI${Date.now().toString().slice(-8)}`,
            paidAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
            bill: {
              connect: { billId: bill.billId }
            },
            user: {
              connect: { userId: participant.userId }
            }
          }
        });
      }
    }

    console.log('✅ Demo bills seeded successfully!');
    console.log('📋 Created 4 bills with participants and payments');
    
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