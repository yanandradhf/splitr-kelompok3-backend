class Transaction {
  constructor(data = {}) {
    this.payment_id = data.payment_id || null;
    this.transaction_id = data.transaction_id || null;
    this.amount = data.amount || 0;
    this.payment_method = data.payment_method || 'BNI_TRANSFER';
    this.status = data.status || 'pending';
    this.bni_reference = data.bni_reference || null;
    this.from_branch = data.from_branch || null;
    this.to_branch = data.to_branch || null;
    this.paid_at = data.paid_at || null;
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    
    // Related data
    this.user_id = data.user_id || null;
    this.bill_id = data.bill_id || null;
  }

  // Static methods for database operations
  static async findAll(filters = {}) {
    // Database query with filters
    // return paginated transaction list
  }

  static async findById(paymentId) {
    // Database query for single transaction
    // include user and bill data
  }

  static async findWithFilters(filters) {
    // Advanced filtering for transaction list
    // support pagination, sorting, search
  }

  static async getStatistics(dateRange = {}) {
    // Calculate transaction statistics
    // return aggregated data
  }

  static async getGeographicDistribution() {
    // Group transactions by branch codes/cities
    // return geographic data
  }

  // Instance methods
  toJSON() {
    return {
      payment_id: this.payment_id,
      transaction_id: this.transaction_id,
      amount: this.amount,
      amount_formatted: this.getFormattedAmount(),
      payment_method: this.payment_method,
      status: this.status,
      status_color: this.getStatusColor(),
      bni_reference: this.bni_reference,
      from_branch: this.from_branch,
      to_branch: this.to_branch,
      paid_at: this.paid_at,
      created_at: this.created_at
    };
  }

  getFormattedAmount() {
    return `Rp ${this.amount.toLocaleString('id-ID')}`;
  }

  getStatusColor() {
    const statusColors = {
      'completed': 'green',
      'pending': 'yellow',
      'failed': 'red'
    };
    return statusColors[this.status] || 'gray';
  }

  // Validation methods
  static validateTransactionData(data) {
    const errors = [];
    
    if (!data.amount || data.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }
    
    if (!data.payment_method) {
      errors.push('Payment method is required');
    }
    
    return errors;
  }
}

module.exports = Transaction;