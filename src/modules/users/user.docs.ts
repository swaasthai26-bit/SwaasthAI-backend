export const userDocs = {
  createUser: {
    summary: 'Create a new user profile',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              dateOfBirth: { type: 'string', format: 'date' },
              gender: { type: 'string', enum: ['male', 'female', 'other'] },
            },
            required: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
          },
        },
      },
    },
  },
  getUser: {
    summary: 'Get user details by id',
  },
  listUsers: {
    summary: 'List users, optionally filtered by search query',
  },
  updateUser: {
    summary: 'Update existing user profile',
  },
};
