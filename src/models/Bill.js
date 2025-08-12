class Bill {
  constructor(data = {}) {
    this.bill_id = data.bill_id || null;
    this.billName = data.billName || null;
    this.totalAmount = data.totalAmount || 0;
    this.status = data.status || 'active';
    this.host_user_id = data.host_user_id || null;
    this.category_id = data.category_id || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    
    // Related data (populated from joins)
    this.host = data.host || null;
    this.category = data.category || null;
  }

  // Static methods for database operations
  static async findById(billId) {
    // Database query for single bill
    // include host and category data
  }

  static async findAll(filters = {}) {
    // Get all bills with optional filters
  }

  static async findByCategory(categoryId) {
    // Find bills by category
  }

  // Instance methods
  toJSON() {
    return {
      bill_id: this.bill_id,
      billName: this.billName,
      totalAmount: this.totalAmount,
      totalAmount_formatted: this.getFormattedAmount(),
      status: this.status,
      host: this.host,
      category: this.category,
      created_at: this.created_at
    };
  }

  getFormattedAmount() {
    return `Rp ${this.totalAmount.toLocaleString('id-ID')}`;
  }

  // Validation methods
  static validateBillData(data) {
    const errors = [];
    
    if (!data.billName || data.billName.trim().length < 3) {
      errors.push('Bill name must be at least 3 characters');
    }
    
    if (!data.totalAmount || data.totalAmount <= 0) {
      errors.push('Total amount must be greater than 0');
    }
    
    if (!data.host_user_id) {
      errors.push('Host user ID is required');
    }
    
    return errors;
  }
}

module.exports = Bill;