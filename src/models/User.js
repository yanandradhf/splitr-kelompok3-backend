class User {
  constructor(data = {}) {
    this.user_id = data.user_id || null;
    this.name = data.name || null;
    this.email = data.email || null;
    this.phone = data.phone || null;
    this.bniAccountNumber = data.bniAccountNumber || null;
    this.bniBranchCode = data.bniBranchCode || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
  }

  // Static methods for database operations
  static async findById(userId) {
    // Database query for single user
  }

  static async findByAccountNumber(accountNumber) {
    // Find user by BNI account number
  }

  static async findAll(filters = {}) {
    // Get all users with optional filters
  }

  // Instance methods
  toJSON() {
    return {
      user_id: this.user_id,
      name: this.name,
      email: this.email,
      phone: this.phone,
      bniAccountNumber: this.bniAccountNumber,
      bniBranchCode: this.bniBranchCode,
      avatar: this.getAvatarUrl()
    };
  }

  getAvatarUrl() {
    if (this.name) {
      const colors = ['ff6b35', '4ecdc4', '45b7d1', 'f39c12', 'e74c3c', '9b59b6'];
      const colorIndex = this.name.length % colors.length;
      const backgroundColor = colors[colorIndex];
      
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=${backgroundColor}&color=fff`;
    }
    return null;
  }

  // Validation methods
  static validateUserData(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    }
    
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }
    
    if (!data.bniAccountNumber || data.bniAccountNumber.length < 8) {
      errors.push('BNI account number must be at least 8 digits');
    }
    
    return errors;
  }

  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

module.exports = User;