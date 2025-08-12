class Admin {
  constructor(data = {}) {
    this.adminId = data.adminId || null;
    this.username = data.username || null;
    this.email = data.email || null;
    this.role = data.role || 'admin';
    this.lastLoginAt = data.lastLoginAt || null;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Static methods for database operations
  static async findByUsername(username) {
    // Database query implementation
    // return admin data if found
  }

  static async findById(adminId) {
    // Database query implementation
    // return admin data if found
  }

  static async updateLastLogin(adminId) {
    // Update lastLoginAt timestamp
    // return updated admin data
  }

  // Instance methods
  toJSON() {
    return {
      adminId: this.adminId,
      username: this.username,
      email: this.email,
      role: this.role,
      lastLoginAt: this.lastLoginAt
    };
  }

  // Validation methods
  static validateLoginData(data) {
    const errors = [];
    
    if (!data.username || data.username.trim().length < 3) {
      errors.push('Username must be at least 3 characters');
    }
    
    if (!data.password || data.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }
    
    return errors;
  }
}

module.exports = Admin;