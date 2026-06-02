const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
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

      return res.status(200).json({
        users,
        events,
        registrations,
        logs
      });
    } catch (error) {
      console.error("Error fetching state:", error);
      return res.status(500).json({ error: "Failed to fetch state from database" });
    }
  }

  if (req.method === 'POST') {
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

      return res.status(200).json({ success: true, message: "State synchronized successfully" });
    } catch (error) {
      console.error("Error synchronizing state:", error);
      return res.status(500).json({ error: "Failed to synchronize state to database" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
