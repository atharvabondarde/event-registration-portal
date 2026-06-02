const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const prisma = new PrismaClient({});

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit just in case

// GET /api/state: Retrieves all data from MongoDB
app.get('/api/state', async (req, res) => {
  try {
    let users = await prisma.user.findMany();
    if (!users || users.length === 0) {
      const defaultAdmin = {
        email: "admin@infotechway.com",
        password: "admin123",
        name: "System Admin",
        role: "admin"
      };
      await prisma.user.create({ data: defaultAdmin });
      users = [defaultAdmin];
    }
    const events = await prisma.event.findMany();
    const registrations = await prisma.registration.findMany();
    const logs = await prisma.log.findMany();

    res.json({
      users,
      events,
      registrations,
      logs
    });
  } catch (error) {
    console.error("Error fetching state:", error);
    res.status(500).json({ error: "Failed to fetch state from database" });
  }
});

// POST /api/state: Syncs the current application state to MongoDB
app.post('/api/state', async (req, res) => {
  try {
    const { users = [], events = [], registrations = [], logs = [] } = req.body;

    // Use a transaction to safely overwrite the current data
    await prisma.$transaction([
      prisma.user.deleteMany(),
      prisma.user.createMany({ data: users }),

      prisma.event.deleteMany(),
      prisma.event.createMany({ data: events }),

      prisma.registration.deleteMany(),
      prisma.registration.createMany({ data: registrations }),

      prisma.log.deleteMany(),
      prisma.log.createMany({ data: logs })
    ]);

    res.json({ success: true, message: "State synchronized successfully" });
  } catch (error) {
    console.error("Error synchronizing state:", error);
    res.status(500).json({ error: "Failed to synchronize state to database" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Event Portal API running on port ${PORT}`);
});
