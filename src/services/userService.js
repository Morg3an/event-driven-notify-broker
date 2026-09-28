import crypto from 'crypto';

// In-memory user store for demo purposes
const users = [];

export const userService = {
  createUser({ name, email }) {
    if (!name || !email) {
      throw new Error('Name and email are required');
    }

    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      const error = new Error(`User with email "${email}" already exists`);
      error.statusCode = 409;
      throw error;
    }

    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    return newUser;
  },

  getAllUsers() {
    return [...users];
  },

  getUserById(id) {
    return users.find((u) => u.id === id) || null;
  },

  clearAll() {
    users.length = 0;
  },
};
