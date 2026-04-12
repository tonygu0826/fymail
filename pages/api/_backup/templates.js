export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  
  // 返回静态模板数据（模拟）
  res.status(200).json([
    {
      id: 'tpl_intro_warehouse',
      name: 'Warehouse Intro',
      slug: 'warehouse-intro',
      subject: 'FYWarehouse service introduction',
      previewText: 'A quick introduction to our warehouse and fulfillment services.',
      html: '<h1>FYWarehouse</h1><p>Thank you for your interest. We can support bonded warehouse, fulfillment, and local distribution workflows.</p>',
      text: 'FYWarehouse\\n\\nThank you for your interest. We can support bonded warehouse, fulfillment, and local distribution workflows.',
      category: 'sales',
      status: 'active',
      version: 1,
      parentId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z'
    },
    {
      id: 'tpl_followup_contact',
      name: 'Contact Follow-up',
      slug: 'contact-follow-up',
      subject: 'Following up on your warehouse request',
      previewText: 'Use this after an inbound website contact submission.',
      html: '<p>Hello {{firstName}},</p><p>We received your request and will follow up with the next operational steps.</p>',
      text: 'Hello {{firstName}},\\n\\nWe received your request and will follow up with the next operational steps.',
      category: 'operations',
      status: 'draft',
      version: 1,
      parentId: null,
      createdAt: '2026-03-24T00:00:00.000Z',
      updatedAt: '2026-03-24T00:00:00.000Z'
    }
  ]);
}