// backend/src/middleware/validate.js
const { z } = require('zod');

/**
 * Generic request validator using Zod schemas
 * @param {object} schema - { body, query, params }
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    if (schema.params) req.params = schema.params.parse(req.params);
    if (schema.query) req.query = schema.query.parse(req.query);
    if (schema.body) req.body = schema.body.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed on input parameters.',
        details: error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    return res.status(500).json({ success: false, error: 'Internal validation error' });
  }
};

// Admin Validation Schemas
const updateRoleSchema = {
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DISPATCHER', 'DONOR', 'NGO'])
  })
};

const updateStatusSchema = {
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'REJECTED'])
  })
};

const createListingSchema = {
  body: z.object({
    title: z.string().min(3).max(100),
    description: z.string().optional(),
    foodType: z.enum(['COOKED_MEALS', 'BAKERY_BREAD', 'RAW_PRODUCE', 'PACKAGED_DRY', 'DAIRY', 'BEVERAGES']),
    quantityKg: z.number().positive(),
    servingsCount: z.number().int().positive(),
    expiryTime: z.string().datetime(),
    pickupWindow: z.string().min(3),
    locationAddress: z.string().min(5),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    donorId: z.string().uuid()
  })
};

const queryFilterSchema = {
  query: z.object({
    search: z.string().optional(),
    role: z.string().optional(),
    status: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10')
  })
};

module.exports = {
  validateRequest,
  updateRoleSchema,
  updateStatusSchema,
  createListingSchema,
  queryFilterSchema
};
