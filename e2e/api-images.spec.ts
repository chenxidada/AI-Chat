import { test, expect } from '@playwright/test';

const API_URL = 'http://localhost:4000/api';

test.describe('Images API', () => {
  let uploadedImageId: string;

  test('should upload an image successfully', async ({ request }) => {
    // Create a simple test image buffer (1x1 PNG)
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    const response = await request.post(`${API_URL}/v1/images/upload`, {
      multipart: {
        file: {
          name: 'test-image.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });

    expect(response.status()).toBe(201);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
    expect(result.data.url).toBeDefined();
    expect(result.data.url).toMatch(/\/uploads\/images\/.*\.png/);
    expect(result.data.originalName).toBe('test-image.png');
    expect(result.data.mimeType).toBe('image/png');

    uploadedImageId = result.data.id;
  });

  test('should reject invalid file type', async ({ request }) => {
    const txtBuffer = Buffer.from('This is not an image');

    const response = await request.post(`${API_URL}/v1/images/upload`, {
      multipart: {
        file: {
          name: 'test.txt',
          mimeType: 'text/plain',
          buffer: txtBuffer,
        },
      },
    });

    // Should reject with 400 or 500 error
    expect([400, 415, 500]).toContain(response.status());
  });

  test('should query images by document', async ({ request }) => {
    // Use a valid UUID format (even if it doesn't exist in DB)
    const response = await request.get(`${API_URL}/v1/images`, {
      params: {
        documentId: '00000000-0000-0000-0000-000000000000',
      },
    });

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  test('should return empty array for query without documentId', async ({ request }) => {
    const response = await request.get(`${API_URL}/v1/images`);

    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  test('should delete an uploaded image', async ({ request }) => {
    // First upload an image
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f,
      0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc, 0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
    ]);

    const uploadResponse = await request.post(`${API_URL}/v1/images/upload`, {
      multipart: {
        file: {
          name: 'to-delete.png',
          mimeType: 'image/png',
          buffer: pngBuffer,
        },
      },
    });

    const uploadResult = await uploadResponse.json();
    const id = uploadResult.data.id;

    // Now delete it
    const deleteResponse = await request.delete(`${API_URL}/v1/images/${id}`);
    expect(deleteResponse.status()).toBe(200);

    // Try to delete again - should fail with 404
    const secondDeleteResponse = await request.delete(`${API_URL}/v1/images/${id}`);
    expect(secondDeleteResponse.status()).toBe(404);
  });
});
