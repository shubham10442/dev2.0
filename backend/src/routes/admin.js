// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  validateRequest,
  updateRoleSchema,
  updateStatusSchema,
  createListingSchema,
  queryFilterSchema
} = require('../middleware/validate');

// In production, instantiate: const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();

/**
 * 1. KPI & SYSTEM ANALYTICS
 * GET /api/admin/analytics/overview
 */
router.get('/analytics/overview', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'DISPATCHER']), async (req, res) => {
  try {
    // In production, execute Prisma aggregate queries:
    // const totalUsers = await prisma.user.count();
    // const totalMeals = await prisma.foodListing.aggregate({ _sum: { servingsCount: true, quantityKg: true } });
    
    const stats = {
      totalUsers: 1248,
      verifiedDonors: 580,
      activeNgos: 668,
      totalListings: 4320,
      activeSurplusKg: 2840,
      totalServingsRescued: 89450,
      divertedWasteKg: 35780,
      co2OffsetKg: 89450,
      claimsCompleted: 3980,
      completionRate: '92.1%',
      recentTrends: [
        { month: 'Jan', meals: 12400, co2: 31000 },
        { month: 'Feb', meals: 15600, co2: 39000 },
        { month: 'Mar', meals: 19800, co2: 49500 },
        { month: 'Apr', meals: 24200, co2: 60500 },
        { month: 'May', meals: 28900, co2: 72250 }
      ]
    };

    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Analytics aggregation error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error calculating metrics.' });
  }
});

/**
 * 2. USER MANAGEMENT: PAGINATED DIRECTORY
 * GET /api/admin/users
 */
router.get('/users', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest(queryFilterSchema), async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 10 } = req.query;
    
    // Prisma Query Builder simulation:
    // const where = {
    //   ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search } }] } : {}),
    //   ...(role ? { role } : {}),
    //   ...(status ? { status } : {})
    // };
    // const [users, total] = await Promise.all([
    //   prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    //   prisma.user.count({ where })
    // ]);

    return res.status(200).json({
      success: true,
      meta: { page, limit, total: 1248, totalPages: Math.ceil(1248 / limit) },
      data: [
        {
          id: 'u-101',
          name: 'Royal Spice Caterers',
          email: 'chef.royalspice@gmail.com',
          role: 'DONOR',
          status: 'ACTIVE',
          licenseId: 'FSSAI-10019022008432',
          organization: 'Royal Hospitality Group',
          donationsCount: 142,
          createdAt: '2025-11-12T10:00:00Z'
        },
        {
          id: 'u-102',
          name: 'Hope Shelter Network',
          email: 'contact.hopeshelter@gmail.com',
          role: 'NGO',
          status: 'ACTIVE',
          licenseId: 'NGO-DARPAN-DL/2021/029184',
          organization: 'Hope Care Foundation',
          claimsCount: 88,
          createdAt: '2025-11-20T14:30:00Z'
        },
        {
          id: 'u-103',
          name: 'City Banquet Hall',
          email: 'manager.citybanquet@gmail.com',
          role: 'DONOR',
          status: 'PENDING_VERIFICATION',
          licenseId: 'FSSAI-20038190012847',
          organization: 'City Events Ltd',
          donationsCount: 0,
          createdAt: '2026-01-05T09:15:00Z'
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve user directory.' });
  }
});

/**
 * 3. USER MANAGEMENT: ROLE MUTATION
 * PATCH /api/admin/users/:id/role
 * Only SUPER_ADMIN can modify user authorization tiers.
 */
router.patch('/users/:id/role', authenticateToken, requireRole(['SUPER_ADMIN']), validateRequest(updateRoleSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Prisma:
    // const updated = await prisma.user.update({ where: { id }, data: { role } });
    // await prisma.auditLog.create({ data: { actorId: req.user.id, action: 'USER_ROLE_CHANGE', entityType: 'User', entityId: id, metadataAfter: { role } } });

    return res.status(200).json({
      success: true,
      message: `User ${id} role successfully updated to ${role}.`,
      data: { id, role }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update user role.' });
  }
});

/**
 * 4. USER MANAGEMENT: SUSPEND / ACTIVATE ACCOUNT
 * PATCH /api/admin/users/:id/status
 */
router.patch('/users/:id/status', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest(updateStatusSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    return res.status(200).json({
      success: true,
      message: `User ${id} status updated to ${status}.`,
      data: { id, status }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to update account status.' });
  }
});

/**
 * 5. RESOURCE / LISTINGS MANAGER: FULL CRUD
 * GET /api/admin/listings
 */
router.get('/listings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN', 'DISPATCHER']), async (req, res) => {
  try {
    const { status, foodType, search, page = 1, limit = 5 } = req.query;
    
    const allListings = [
      { id: 'list-501', title: '30 Servings Veg Thali', foodType: 'COOKED_MEALS', quantityKg: 30, servingsCount: 30, status: 'AVAILABLE', expiryTime: '2026-08-30T14:00:00Z', donorName: 'Royal Spice Caterers', pickupAddress: 'Connaught Place Station' },
      { id: 'list-502', title: '15 Packed Rice Bowls', foodType: 'COOKED_MEALS', quantityKg: 15, servingsCount: 15, status: 'CLAIMED', expiryTime: '2026-08-30T09:00:00Z', donorName: 'Green Earth Bistro', pickupAddress: 'Barakhamba Road' },
      { id: 'list-503', title: '25 Sourdough Loaves', foodType: 'BAKERY_BREAD', quantityKg: 25, servingsCount: 50, status: 'AVAILABLE', expiryTime: '2026-08-30T12:00:00Z', donorName: 'Golden Crust Bakery', pickupAddress: 'Khan Market' },
      { id: 'list-504', title: '40 Sandwich Boxes', foodType: 'PACKAGED_DRY', quantityKg: 20, servingsCount: 40, status: 'AVAILABLE', expiryTime: '2026-08-30T15:30:00Z', donorName: 'TechHub Conference', pickupAddress: 'Cyber City' },
      { id: 'list-505', title: '50 Portions Paneer Butter Masala', foodType: 'COOKED_MEALS', quantityKg: 35, servingsCount: 50, status: 'AVAILABLE', expiryTime: '2026-08-30T16:00:00Z', donorName: 'Spice Symphony Kitchen', pickupAddress: 'South Extension' },
      { id: 'list-506', title: '20 Fresh Fruit Salads & Juices', foodType: 'RAW_PRODUCE', quantityKg: 18, servingsCount: 20, status: 'AVAILABLE', expiryTime: '2026-08-30T13:30:00Z', donorName: 'Orchard Fresh Cafe', pickupAddress: 'Hauz Khas' },
      { id: 'list-507', title: '35 Hyderabadi Dum Biryani Trays', foodType: 'COOKED_MEALS', quantityKg: 40, servingsCount: 35, status: 'CLAIMED', expiryTime: '2026-08-30T18:00:00Z', donorName: 'Nizam Royal Kitchen', pickupAddress: 'Old Delhi' },
      { id: 'list-508', title: '60 Assorted Dinner Rolls & Buns', foodType: 'BAKERY_BREAD', quantityKg: 22, servingsCount: 60, status: 'AVAILABLE', expiryTime: '2026-08-30T11:00:00Z', donorName: 'Daily Bread Bakehouse', pickupAddress: 'Defence Colony' },
      { id: 'list-509', title: '25 Dal Makhani & Jeera Rice', foodType: 'COOKED_MEALS', quantityKg: 28, servingsCount: 25, status: 'AVAILABLE', expiryTime: '2026-08-30T17:00:00Z', donorName: 'Punjabi Rasoi', pickupAddress: 'Karol Bagh' },
      { id: 'list-510', title: '18 Whole Wheat Pasta Bowls', foodType: 'COOKED_MEALS', quantityKg: 15, servingsCount: 18, status: 'AVAILABLE', expiryTime: '2026-08-30T14:30:00Z', donorName: 'Bella Italia Trattoria', pickupAddress: 'Greater Kailash' },
      { id: 'list-511', title: '45 South Indian Idli & Sambar', foodType: 'COOKED_MEALS', quantityKg: 30, servingsCount: 45, status: 'CLAIMED', expiryTime: '2026-08-30T10:30:00Z', donorName: 'Sagar Ratna Express', pickupAddress: 'Lodhi Road' },
      { id: 'list-512', title: '30 Veg Hakka Noodles & Manchurian', foodType: 'COOKED_MEALS', quantityKg: 25, servingsCount: 30, status: 'AVAILABLE', expiryTime: '2026-08-30T16:45:00Z', donorName: 'Red Wok Bistro', pickupAddress: 'Saket' },
      { id: 'list-513', title: '22 Fresh Butter Croissants', foodType: 'BAKERY_BREAD', quantityKg: 14, servingsCount: 22, status: 'AVAILABLE', expiryTime: '2026-08-30T11:30:00Z', donorName: 'Le Petit Paris Bakery', pickupAddress: 'Vasant Vihar' },
      { id: 'list-514', title: '55 Khichdi & Mixed Veg Bowls', foodType: 'COOKED_MEALS', quantityKg: 38, servingsCount: 55, status: 'AVAILABLE', expiryTime: '2026-08-30T15:00:00Z', donorName: 'Satvik Bhojan Kendra', pickupAddress: 'Rohini' },
      { id: 'list-515', title: '40 Rajma Chawal Lunch Boxes', foodType: 'COOKED_MEALS', quantityKg: 32, servingsCount: 40, status: 'AVAILABLE', expiryTime: '2026-08-30T14:15:00Z', donorName: 'Delhi Delights Caterers', pickupAddress: 'Pitampura' },
      { id: 'list-516', title: '28 Stuffed Parathas with Curd', foodType: 'COOKED_MEALS', quantityKg: 24, servingsCount: 28, status: 'AVAILABLE', expiryTime: '2026-08-30T19:00:00Z', donorName: 'Highway Dhaba Kitchen', pickupAddress: 'GT Karnal Road' },
      { id: 'list-517', title: '16 Quinoa & Roasted Veggie Bowls', foodType: 'RAW_PRODUCE', quantityKg: 12, servingsCount: 16, status: 'CLAIMED', expiryTime: '2026-08-30T12:45:00Z', donorName: 'Healthy Harvest Cafe', pickupAddress: 'Chanakyapuri' },
      { id: 'list-518', title: '35 Mixed Vegetable Pulao Pots', foodType: 'COOKED_MEALS', quantityKg: 28, servingsCount: 35, status: 'AVAILABLE', expiryTime: '2026-08-30T17:30:00Z', donorName: 'Golden Spoon Banquets', pickupAddress: 'Janakpuri' },
      { id: 'list-519', title: '50 Multigrain Roti & Chana Packs', foodType: 'COOKED_MEALS', quantityKg: 30, servingsCount: 50, status: 'AVAILABLE', expiryTime: '2026-08-30T16:30:00Z', donorName: 'Desi Rasoi Express', pickupAddress: 'Laxmi Nagar' },
      { id: 'list-520', title: '24 Fresh Salads & Cut Melons', foodType: 'RAW_PRODUCE', quantityKg: 16, servingsCount: 24, status: 'AVAILABLE', expiryTime: '2026-08-30T13:00:00Z', donorName: 'Urban Green Co.', pickupAddress: 'Mayur Vihar' }
    ];

    const p = Number(page);
    const l = Number(limit);
    const startIndex = (p - 1) * l;
    const paginated = allListings.slice(startIndex, startIndex + l);

    return res.status(200).json({
      success: true,
      meta: { page: p, limit: l, total: allListings.length, totalPages: Math.ceil(allListings.length / l) },
      data: paginated
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch resource listings.' });
  }
});

/**
 * POST /api/admin/listings
 * Admin override creation
 */
router.post('/listings', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), validateRequest(createListingSchema), async (req, res) => {
  try {
    // In production: const newListing = await prisma.foodListing.create({ data: req.body });
    return res.status(201).json({
      success: true,
      message: 'Listing successfully created by administrator.',
      data: { id: `list-${Date.now()}`, ...req.body, status: 'AVAILABLE', createdAt: new Date().toISOString() }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create resource listing.' });
  }
});

/**
 * DELETE /api/admin/listings/:id
 * Admin force deletion
 */
router.delete('/listings/:id', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;
    // await prisma.foodListing.delete({ where: { id } });
    return res.status(200).json({
      success: true,
      message: `Resource listing ${id} has been permanently purged.`
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to purge listing.' });
  }
});

/**
 * 6. AUDIT TRAIL
 * GET /api/admin/audit-logs
 */
router.get('/audit-logs', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: [
        {
          id: 'log-001',
          actorName: 'Admin Sarah Connor',
          actorRole: 'SUPER_ADMIN',
          action: 'USER_STATUS_CHANGE',
          entityType: 'User',
          entityId: 'u-103',
          metadataAfter: { status: 'ACTIVE' },
          ipAddress: '192.168.1.45',
          timestamp: '2026-08-29T20:10:00Z'
        },
        {
          id: 'log-002',
          actorName: 'Admin Alex Vance',
          actorRole: 'ADMIN',
          action: 'LISTING_DELETE',
          entityType: 'FoodListing',
          entityId: 'list-489',
          metadataAfter: { reason: 'Expired food health safety policy violation' },
          ipAddress: '10.0.4.12',
          timestamp: '2026-08-29T19:45:00Z'
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit trail.' });
  }
});

/**
 * 7. DATA EXPORT (CSV STREAM)
 * GET /api/admin/export/:resource (users | listings | audit)
 */
router.get('/export/:resource', authenticateToken, requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  const { resource } = req.params;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=ann_${resource}_export_${Date.now()}.csv`);

  if (resource === 'users') {
    const csvContent = 'ID,Name,Email,Role,Status,LicenseId,CreatedAt\n' +
      'u-101,"Royal Spice Caterers",chef.royalspice@gmail.com,DONOR,ACTIVE,FSSAI-10019022008432,2025-11-12\n' +
      'u-102,"Hope Shelter Network",contact.hopeshelter@gmail.com,NGO,ACTIVE,NGO-DARPAN-DL/2021/029184,2025-11-20\n';
    return res.send(csvContent);
  }

  return res.send('ID,Title,QuantityKg,Servings,Status\nlist-501,"Steam Rice & Dal",45,120,AVAILABLE\n');
});

module.exports = router;
